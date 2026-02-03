/**
 * Get Attendance API Endpoint
 * Feature: qr-chain-attendance
 * Requirements: 14.1, 14.2, 14.3, 14.4, 14.5
 * 
 * GET /api/sessions/{sessionId}/attendance
 * Returns attendance records for a session
 * Includes finalStatus if session has ended
 * Requires Teacher role and session ownership
 */

import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { AuthService } from '../services/AuthService';
import { SessionService } from '../services/SessionService';
import { attendanceService } from '../services/AttendanceService';
import { Role, AttendanceRecord, SessionStatus } from '../types';

/**
 * Attendance response
 * Requirements: 14.1, 14.2, 14.3
 */
interface AttendanceResponse {
  attendance: AttendanceRecord[];
}

/**
 * HTTP trigger function to get attendance records
 * Requirements: 14.1, 14.2, 14.3, 14.4, 14.5
 */
export async function getAttendance(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  context.log('Processing GET /api/sessions/{sessionId}/attendance request');

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
    
    // Require Teacher role (Requirement 14.5)
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

    // Verify session exists and teacher owns it (Requirement 14.5)
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

    const teacherId = authService.getUserId(principal);
    if (session.teacherId !== teacherId) {
      return {
        status: 403,
        jsonBody: {
          error: {
            code: 'FORBIDDEN',
            message: 'You do not own this session',
            timestamp: Date.now()
          }
        }
      };
    }

    // Get attendance records for the session (Requirement 14.1)
    const attendance = await attendanceService.getAllAttendance(sessionId);

    // If session is not ended, exclude finalStatus from records (Requirement 14.4)
    // If session is ended, finalStatus is already included (Requirement 14.1)
    const filteredAttendance = session.status === SessionStatus.ENDED
      ? attendance  // Include finalStatus for ended sessions
      : attendance.map(record => {
          // Exclude finalStatus for active sessions
          const { finalStatus, ...recordWithoutFinalStatus } = record;
          return recordWithoutFinalStatus as AttendanceRecord;
        });

    // Return attendance records (Requirements 14.2, 14.3)
    const response: AttendanceResponse = {
      attendance: filteredAttendance
    };

    return {
      status: 200,
      jsonBody: response
    };

  } catch (error: any) {
    context.error('Error getting attendance records:', error);
    
    return {
      status: 500,
      jsonBody: {
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to get attendance records',
          details: error.message,
          timestamp: Date.now()
        }
      }
    };
  }
}

// Register the HTTP trigger
app.http('getAttendance', {
  methods: ['GET'],
  route: 'sessions/{sessionId}/attendance',
  authLevel: 'anonymous',
  handler: getAttendance
});
