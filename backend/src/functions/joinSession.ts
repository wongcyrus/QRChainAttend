/**
 * Join Session API Endpoint - REFACTORED (Self-contained)
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

export async function joinSession(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  context.log('Processing POST /api/sessions/{sessionId}/join request');

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
    
    // Require Student role
    if (!hasRole(principal, 'Student')) {
      return {
        status: 403,
        jsonBody: { error: { code: 'FORBIDDEN', message: 'Student role required', timestamp: Date.now() } }
      };
    }

    const studentId = getUserId(principal);
    const sessionId = request.params.sessionId;
    
    if (!sessionId) {
      return {
        status: 400,
        jsonBody: { error: { code: 'INVALID_REQUEST', message: 'Missing sessionId', timestamp: Date.now() } }
      };
    }

    // Verify session exists
    const sessionsTable = getTableClient('Sessions');
    try {
      await sessionsTable.getEntity('SESSION', sessionId);
    } catch (error: any) {
      if (error.statusCode === 404) {
        return {
          status: 404,
          jsonBody: { error: { code: 'NOT_FOUND', message: 'Session not found', timestamp: Date.now() } }
        };
      }
      throw error;
    }

    // Create or check attendance record
    const attendanceTable = getTableClient('Attendance');
    
    try {
      // Check if already enrolled
      await attendanceTable.getEntity(sessionId, studentId);
      
      return {
        status: 200,
        jsonBody: {
          success: true,
          sessionId,
          studentId,
          message: 'Already enrolled in session'
        }
      };
    } catch (error: any) {
      if (error.statusCode === 404) {
        // Create new enrollment
        const entity = {
          partitionKey: sessionId,
          rowKey: studentId,
          exitVerified: false
        };
        
        await attendanceTable.createEntity(entity);
        
        return {
          status: 201,
          jsonBody: {
            success: true,
            sessionId,
            studentId,
            message: 'Successfully enrolled in session'
          }
        };
      }
      throw error;
    }

  } catch (error: any) {
    context.error('Error joining session:', error);
    
    return {
      status: 500,
      jsonBody: {
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to join session',
          details: error.message,
          timestamp: Date.now()
        }
      }
    };
  }
}

app.http('joinSession', {
  methods: ['POST'],
  route: 'sessions/{sessionId}/join',
  authLevel: 'anonymous',
  handler: joinSession
});
