/**
 * Get Session API Endpoint - REFACTORED (Self-contained)
 * No external service dependencies
 */

import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { TableClient } from '@azure/data-tables';

// Inline types
interface Session {
  partitionKey: string;
  rowKey: string;
  teacherId: string;
  courseName: string;
  status: 'ACTIVE' | 'ENDED';
  startTime: number;
  endTime?: number;
  timestamp?: Date;
  etag?: string;
}

interface AttendanceRecord {
  partitionKey: string;
  rowKey: string;
  studentId: string;
  entryStatus: string;
  entryTime?: number;
  exitVerified?: boolean;
  exitTime?: number;
}

interface Chain {
  partitionKey: string;
  rowKey: string;
  phase: string;
  currentToken: string;
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

// Inline table client creation
function getTableClient(tableName: string): TableClient {
  const connectionString = process.env.AzureWebJobsStorage;
  if (!connectionString) {
    throw new Error('AzureWebJobsStorage not configured');
  }
  return TableClient.fromConnectionString(connectionString, tableName);
}

export async function getSession(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  context.log('Processing GET /api/sessions/{sessionId} request');

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
    const userId = getUserId(principal);
    const isTeacher = hasRole(principal, 'Teacher');

    // Get sessionId
    const sessionId = request.params.sessionId;
    if (!sessionId) {
      return {
        status: 400,
        jsonBody: { error: { code: 'INVALID_REQUEST', message: 'Missing sessionId', timestamp: Date.now() } }
      };
    }

    // Get session from storage
    const sessionsTable = getTableClient('Sessions');
    let session: Session;
    
    try {
      const entity = await sessionsTable.getEntity('SESSION', sessionId);
      session = entity as unknown as Session;
    } catch (error: any) {
      if (error.statusCode === 404) {
        return {
          status: 404,
          jsonBody: { error: { code: 'NOT_FOUND', message: 'Session not found', timestamp: Date.now() } }
        };
      }
      throw error;
    }

    // Check ownership for teachers
    if (isTeacher && session.teacherId !== userId) {
      return {
        status: 403,
        jsonBody: { error: { code: 'FORBIDDEN', message: 'You do not own this session', timestamp: Date.now() } }
      };
    }

    // Get attendance records
    const attendanceTable = getTableClient('Attendance');
    const attendance: AttendanceRecord[] = [];
    
    for await (const entity of attendanceTable.listEntities({ queryOptions: { filter: `PartitionKey eq '${sessionId}'` } })) {
      attendance.push(entity as unknown as AttendanceRecord);
    }

    // Get chains
    const chainsTable = getTableClient('Chains');
    const chains: Chain[] = [];
    
    for await (const entity of chainsTable.listEntities({ queryOptions: { filter: `PartitionKey eq '${sessionId}'` } })) {
      chains.push(entity as unknown as Chain);
    }

    // Build response
    const response: any = {
      session: {
        sessionId: session.rowKey,
        teacherId: session.teacherId,
        courseName: session.courseName,
        status: session.status,
        startTime: session.startTime,
        endTime: session.endTime
      },
      attendance: attendance.map(a => ({
        studentId: a.studentId,
        entryStatus: a.entryStatus,
        entryTime: a.entryTime,
        exitVerified: a.exitVerified,
        exitTime: a.exitTime
      })),
      chains: chains.map(c => ({
        phase: c.phase,
        currentToken: c.currentToken
      }))
    };

    return {
      status: 200,
      jsonBody: response
    };

  } catch (error: any) {
    context.error('Error getting session:', error);
    
    return {
      status: 500,
      jsonBody: {
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to get session',
          details: error.message,
          timestamp: Date.now()
        }
      }
    };
  }
}

app.http('getSession', {
  methods: ['GET'],
  route: 'sessions/{sessionId}',
  authLevel: 'anonymous',
  handler: getSession
});
