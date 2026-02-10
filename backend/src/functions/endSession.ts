/**
 * End Session API Endpoint - REFACTORED (Self-contained)
 * No external service dependencies
 */

import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { TableClient } from '@azure/data-tables';

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
  // Use email (userDetails) as the ID for better readability
  return principal.userDetails || principal.userId;
}

function hasRole(principal: any, role: string): boolean {
  const email = principal.userDetails || '';
  const emailLower = email.toLowerCase();
  
  // Check VTC domain-based roles
  if (role.toLowerCase() === 'teacher' && emailLower.endsWith('@vtc.edu.hk') && !emailLower.endsWith('@stu.vtc.edu.hk')) {
    return true;
  }
  
  if (role.toLowerCase() === 'student' && emailLower.endsWith('@stu.vtc.edu.hk')) {
    return true;
  }
  
  // Fallback to checking userRoles array
  const roles = principal.userRoles || [];
  return roles.some((r: string) => r.toLowerCase() === role.toLowerCase());
}

function getTableClient(tableName: string): TableClient {
  const connectionString = process.env.AzureWebJobsStorage;
  if (!connectionString) {
    throw new Error('AzureWebJobsStorage not configured');
  }
  const isLocal = connectionString.includes("127.0.0.1") || connectionString.includes("localhost");
  return TableClient.fromConnectionString(connectionString, tableName, { allowInsecureConnection: isLocal });
}

export async function endSession(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  context.log('Processing POST /api/sessions/{sessionId}/end request');

  const now = Math.floor(Date.now() / 1000); // Unix timestamp in seconds

  try {
    // Parse authentication
    const principalHeader = request.headers.get('x-ms-client-principal');
    if (!principalHeader) {
      return {
        status: 401,
        jsonBody: { error: { code: 'UNAUTHORIZED', message: 'Missing authentication header', timestamp: now } }
      };
    }

    const principal = parseUserPrincipal(principalHeader);
    
    // Require Teacher role
    if (!hasRole(principal, 'Teacher')) {
      return {
        status: 403,
        jsonBody: { error: { code: 'FORBIDDEN', message: 'Teacher role required', timestamp: now } }
      };
    }

    const teacherId = getUserId(principal);
    const sessionId = request.params.sessionId;
    
    if (!sessionId) {
      return {
        status: 400,
        jsonBody: { error: { code: 'INVALID_REQUEST', message: 'Missing sessionId', timestamp: now } }
      };
    }

    // Get session
    const sessionsTable = getTableClient('Sessions');
    let session: any;
    
    try {
      session = await sessionsTable.getEntity('SESSION', sessionId);
    } catch (error: any) {
      if (error.statusCode === 404) {
        return {
          status: 404,
          jsonBody: { error: { code: 'NOT_FOUND', message: 'Session not found', timestamp: now } }
        };
      }
      throw error;
    }

    // Verify ownership
    if (session.teacherId !== teacherId) {
      return {
        status: 403,
        jsonBody: { error: { code: 'FORBIDDEN', message: 'You do not own this session', timestamp: now } }
      };
    }

    // Check if already ended
    if (session.status === 'ENDED') {
      return {
        status: 400,
        jsonBody: { error: { code: 'INVALID_STATE', message: 'Session already ended', timestamp: now } }
      };
    }

    // Update session status
    const updatedEntity = {
      ...session,
      status: 'ENDED',
      lateEntryActive: false,
      earlyLeaveActive: false,
      endedAt: now
    };

    await sessionsTable.updateEntity(updatedEntity, 'Replace');

    // Get attendance records
    const attendanceTable = getTableClient('Attendance');
    const attendance: any[] = [];
    
    for await (const entity of attendanceTable.listEntities({ queryOptions: { filter: `PartitionKey eq '${sessionId}'` } })) {
      attendance.push({
        studentId: entity.rowKey,
        entryStatus: entity.entryStatus,
        entryAt: entity.entryAt,
        exitVerified: entity.exitVerified,
        exitVerifiedAt: entity.exitVerifiedAt,
        earlyLeaveAt: entity.earlyLeaveAt,
        finalStatus: entity.finalStatus
      });
    }

    return {
      status: 200,
      jsonBody: {
        success: true,
        sessionId,
        attendance
      }
    };

  } catch (error: any) {
    context.error('Error ending session:', error);
    
    return {
      status: 500,
      jsonBody: {
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to end session',
          details: error.message,
          timestamp: now
        }
      }
    };
  }
}

app.http('endSession', {
  methods: ['POST'],
  route: 'sessions/{sessionId}/end',
  authLevel: 'anonymous',
  handler: endSession
});
