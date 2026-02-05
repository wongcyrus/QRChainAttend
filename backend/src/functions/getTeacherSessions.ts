/**
 * Get Teacher Sessions API Endpoint
 * Returns all sessions created by a specific teacher
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

export async function getTeacherSessions(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  context.log('Processing GET /api/sessions/teacher/{teacherId} request');

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
    const isTeacher = hasRole(principal, 'teacher') || hasRole(principal, 'Teacher');

    // Check if user is a teacher
    if (!isTeacher) {
      return {
        status: 403,
        jsonBody: { error: { code: 'FORBIDDEN', message: 'Only teachers can access this endpoint', timestamp: Date.now() } }
      };
    }

    // Get teacherId from route
    const teacherId = request.params.teacherId;
    if (!teacherId) {
      return {
        status: 400,
        jsonBody: { error: { code: 'INVALID_REQUEST', message: 'Missing teacherId', timestamp: Date.now() } }
      };
    }

    // Verify the teacher is requesting their own sessions
    if (teacherId !== userId) {
      return {
        status: 403,
        jsonBody: { error: { code: 'FORBIDDEN', message: 'You can only access your own sessions', timestamp: Date.now() } }
      };
    }

    // Get sessions from storage
    const sessionsTable = getTableClient('Sessions');
    const sessions: Session[] = [];
    
    // Query all sessions and filter by teacherId
    for await (const entity of sessionsTable.listEntities({ 
      queryOptions: { filter: `PartitionKey eq 'SESSION'` } 
    })) {
      const session = entity as unknown as Session;
      if (session.teacherId === teacherId) {
        sessions.push(session);
      }
    }

    // Sort by start time (most recent first)
    sessions.sort((a, b) => (b.startTime || 0) - (a.startTime || 0));

    // Helper to safely convert timestamp to ISO string
    const toISOString = (timestamp: number | undefined): string | undefined => {
      if (!timestamp || isNaN(timestamp)) return undefined;
      try {
        return new Date(timestamp * 1000).toISOString();
      } catch {
        return undefined;
      }
    };

    // Build response
    const response = {
      sessions: sessions.map(s => ({
        sessionId: s.rowKey,
        classId: s.courseName,
        teacherId: s.teacherId,
        status: s.status,
        startAt: toISOString(s.startTime) || new Date().toISOString(),
        endAt: toISOString(s.endTime)
      }))
    };

    return {
      status: 200,
      jsonBody: response
    };

  } catch (error: any) {
    context.error('Error getting teacher sessions:', error);
    
    return {
      status: 500,
      jsonBody: {
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to get teacher sessions',
          details: error.message,
          timestamp: Date.now()
        }
      }
    };
  }
}

app.http('getTeacherSessions', {
  methods: ['GET'],
  route: 'sessions/teacher/{teacherId}',
  authLevel: 'anonymous',
  handler: getTeacherSessions
});
