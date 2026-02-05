/**
 * Create Session API Endpoint - REFACTORED (Self-contained)
 * No external service dependencies
 */

import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { TableClient } from '@azure/data-tables';
import { randomUUID } from 'crypto';

// Inline types
interface CreateSessionRequest {
  classId: string;
  startAt: string;
  endAt: string;
  lateCutoffMinutes: number;
  exitWindowMinutes?: number;
  constraints?: any;
}

interface CreateSessionResponse {
  sessionId: string;
  sessionQR: string;
}

// Inline helper functions
function parseUserPrincipal(header: string): any {
  try {
    const decoded = Buffer.from(header, 'base64').toString('utf-8');
    return JSON.parse(decoded);
  } catch {
    throw new Error('Invalid authentication header');
  }
}

function getUserId(principal: any): string {
  return principal.userId || principal.userDetails;
}

function hasRole(principal: any, role: string): boolean {
  const roles = principal.userRoles || [];
  return roles.includes(role);
}

function getTableClient(tableName: string): TableClient {
  const connectionString = process.env.AzureWebJobsStorage;
  if (!connectionString) {
    throw new Error('AzureWebJobsStorage not configured');
  }
  return TableClient.fromConnectionString(connectionString, tableName);
}

export async function createSession(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  context.log('Processing POST /api/sessions request');

  try {
    // Parse authentication
    const principalHeader = request.headers.get('x-ms-client-principal');
    if (!principalHeader) {
      return {
        status: 401,
        jsonBody: { error: { code: 'UNAUTHORIZED', message: 'Missing authentication header', timestamp: Date.now() } }
      };
    }

    const principal = parseUserPrincipal(principalHeader);
    
    // Require Teacher role
    if (!hasRole(principal, 'Teacher') && !hasRole(principal, 'teacher')) {
      return {
        status: 403,
        jsonBody: { error: { code: 'FORBIDDEN', message: 'Teacher role required', timestamp: Date.now() } }
      };
    }

    // Parse request body
    const body = await request.json() as CreateSessionRequest;

    // Validate required fields
    if (!body.classId || !body.startAt || !body.endAt || body.lateCutoffMinutes === undefined) {
      return {
        status: 400,
        jsonBody: { error: { code: 'INVALID_REQUEST', message: 'Missing required fields', timestamp: Date.now() } }
      };
    }

    // Generate session ID
    const sessionId = randomUUID();
    const teacherId = getUserId(principal);
    const now = new Date().toISOString();

    // Create session entity
    const sessionsTable = getTableClient('Sessions');
    const entity = {
      partitionKey: 'SESSION',
      rowKey: sessionId,
      classId: body.classId,
      teacherId,
      startAt: body.startAt,
      endAt: body.endAt,
      lateCutoffMinutes: body.lateCutoffMinutes,
      exitWindowMinutes: body.exitWindowMinutes ?? 10,
      status: 'ACTIVE',
      ownerTransfer: true,
      constraints: body.constraints ? JSON.stringify(body.constraints) : undefined,
      lateEntryActive: false,
      earlyLeaveActive: false,
      createdAt: now
    };

    await sessionsTable.createEntity(entity);

    // Generate Session QR
    const qrData = {
      type: 'SESSION',
      sessionId,
      classId: body.classId
    };
    const sessionQR = Buffer.from(JSON.stringify(qrData)).toString('base64');

    const response: CreateSessionResponse = {
      sessionId,
      sessionQR
    };

    return {
      status: 201,
      jsonBody: response
    };

  } catch (error: any) {
    context.error('Error creating session:', error);
    
    return {
      status: 500,
      jsonBody: {
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to create session',
          details: error.message,
          timestamp: Date.now()
        }
      }
    };
  }
}

app.http('createSession', {
  methods: ['POST'],
  route: 'sessions',
  authLevel: 'anonymous',
  handler: createSession
});
