/**
 * End Session API Endpoint
 * Feature: qr-chain-attendance
 * Requirements: 2.3, 7.1, 7.2, 7.3, 7.4, 7.5, 7.6
 * 
 * POST /api/sessions/{sessionId}/end
 * Ends a session and computes final attendance status for all students
 * Requires Teacher role and session ownership
 */

import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { AuthService } from '../services/AuthService';
import { SessionService } from '../services/SessionService';
import { attendanceService } from '../services/AttendanceService';
import { Role, EndSessionResponse } from '../types';

/**
 * HTTP trigger function to end a session
 */
export async function endSession(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  context.log('Processing POST /api/sessions/{sessionId}/end request');

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
    
    // Require Teacher role
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

    // Get sessionId from route parameters
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

    // Compute final attendance status (Requirement 7.1-7.6)
    const finalAttendance = await attendanceService.computeFinalStatus(sessionId);

    // End the session (Requirement 2.3)
    const teacherId = authService.getUserId(principal);
    await new SessionService().endSession(sessionId, teacherId);

    // Return response
    const response: EndSessionResponse = {
      finalAttendance
    };

    return {
      status: 200,
      jsonBody: response
    };

  } catch (error: any) {
    context.error('Error ending session:', error);
    
    // Handle specific error cases
    if (error.message.includes('not found')) {
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
    
    if (error.message.includes('Unauthorized') || error.message.includes('do not own')) {
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
    
    if (error.message.includes('already ended')) {
      return {
        status: 400,
        jsonBody: {
          error: {
            code: 'INVALID_STATE',
            message: error.message,
            timestamp: Date.now()
          }
        }
      };
    }
    
    return {
      status: 500,
      jsonBody: {
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to end session',
          details: error.message,
          timestamp: Date.now()
        }
      }
    };
  }
}

