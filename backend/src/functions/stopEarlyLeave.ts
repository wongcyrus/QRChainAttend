/**
 * Stop Early Leave Window API Endpoint
 * Feature: qr-chain-attendance
 * Requirements: 5.2
 * 
 * POST /api/sessions/{sessionId}/stop-early-leave
 * Deactivates early leave window and stops token generation
 * Requires Teacher role and session ownership
 */

import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { AuthService } from '../services/AuthService';
import { SessionService } from '../services/SessionService';
import { Role, SessionStatus } from '../types';

/**
 * Stop Early Leave Response
 */
interface StopEarlyLeaveResponse {
  success: boolean;
  message: string;
}

/**
 * HTTP trigger function to stop early leave window
 * Requirements: 5.2
 */
export async function stopEarlyLeave(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  context.log('Processing POST /api/sessions/{sessionId}/stop-early-leave request');

  try {
    // Parse and validate authentication
    const authService = new AuthService();
    const principalHeader = request.headers.get('x-ms-client-principal');
    
    if (!principalHeader) {
      return {
        status: 401,
        jsonBody: {
          error: {
            code: 'UNAUTHORIZED',
            message: 'Missing authentication header',
            timestamp: Date.now()
          }
        }
      };
    }

    const principal = authService.parseUserPrincipal(principalHeader);
    
    // Require Teacher role (Requirement 5.2)
    try {
      authService.requireRole(principal, Role.TEACHER);
    } catch (error: any) {
      return {
        status: 403,
        jsonBody: {
          error: {
            code: 'FORBIDDEN',
            message: error.message,
            timestamp: Date.now()
          }
        }
      };
    }

    // Get session ID from route parameters
    const sessionId = request.params.sessionId;
    if (!sessionId) {
      return {
        status: 400,
        jsonBody: {
          error: {
            code: 'INVALID_REQUEST',
            message: 'Missing sessionId parameter',
            timestamp: Date.now()
          }
        }
      };
    }

    // Get session and validate ownership
    const sessionService = new SessionService();
    const session = await sessionService.getSession(sessionId);
    
    if (!session) {
      return {
        status: 404,
        jsonBody: {
          error: {
            code: 'NOT_FOUND',
            message: 'Session not found',
            timestamp: Date.now()
          }
        }
      };
    }

    // Verify teacher owns this session (Requirement 5.2)
    const teacherId = authService.getUserId(principal);
    if (session.teacherId !== teacherId) {
      return {
        status: 403,
        jsonBody: {
          error: {
            code: 'FORBIDDEN',
            message: 'Unauthorized: You do not own this session',
            timestamp: Date.now()
          }
        }
      };
    }

    // Validate that session is active
    if (session.status !== SessionStatus.ACTIVE) {
      return {
        status: 400,
        jsonBody: {
          error: {
            code: 'INVALID_STATE',
            message: 'Session is not active',
            timestamp: Date.now()
          }
        }
      };
    }

    // Check if early leave is currently active
    if (!session.earlyLeaveActive) {
      return {
        status: 400,
        jsonBody: {
          error: {
            code: 'INVALID_STATE',
            message: 'Early leave window is not active',
            timestamp: Date.now()
          }
        }
      };
    }

    // Clear earlyLeaveActive flag (Requirement 5.2)
    await sessionService.updateEarlyLeaveStatus(sessionId, false);

    // Return response
    const response: StopEarlyLeaveResponse = {
      success: true,
      message: 'Early leave window stopped successfully'
    };

    context.log(`Early leave window stopped for session ${sessionId}`);

    return {
      status: 200,
      jsonBody: response
    };

  } catch (error: any) {
    context.error('Error stopping early leave window:', error);
    
    return {
      status: 500,
      jsonBody: {
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to stop early leave window',
          details: error.message,
          timestamp: Date.now()
        }
      }
    };
  }
}


app.http('stopEarlyLeave', {
  methods: ['POST'],
  route: 'sessions/{sessionId}/stop-early-leave',
  authLevel: 'anonymous',
  handler: stopEarlyLeave
});
