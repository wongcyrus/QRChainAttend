/**
 * Get Session API Endpoint
 * Feature: qr-chain-attendance
 * Requirements: 12.4
 * 
 * GET /api/sessions/{sessionId}
 * Returns session details, attendance records, chains, and real-time stats
 * Requires Teacher role and session ownership
 */

import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { AuthService } from '../services/AuthService';
import { SessionService } from '../services/SessionService';
import { attendanceService } from '../services/AttendanceService';
import { chainService } from '../services/ChainService';
import { Role, Session, AttendanceRecord, Chain, EntryStatus } from '../types';

/**
 * Session statistics computed from attendance records
 */
interface SessionStats {
  totalStudents: number;
  presentEntry: number;
  lateEntry: number;
  earlyLeave: number;
  exitVerified: number;
  notYetVerified: number;
}

/**
 * Session status response
 */
interface SessionStatusResponse {
  session: Session;
  attendance: AttendanceRecord[];
  chains: Chain[];
  stats: SessionStats;
}

/**
 * Compute real-time statistics from attendance records
 * Requirements: 12.4
 * 
 * @param attendance - Array of attendance records
 * @returns Session statistics
 */
function computeStats(attendance: AttendanceRecord[]): SessionStats {
  const stats: SessionStats = {
    totalStudents: attendance.length,
    presentEntry: 0,
    lateEntry: 0,
    earlyLeave: 0,
    exitVerified: 0,
    notYetVerified: 0
  };

  for (const record of attendance) {
    // Count entry status
    if (record.entryStatus === EntryStatus.PRESENT_ENTRY) {
      stats.presentEntry++;
    } else if (record.entryStatus === EntryStatus.LATE_ENTRY) {
      stats.lateEntry++;
    }

    // Count early leave
    if (record.earlyLeaveAt !== undefined) {
      stats.earlyLeave++;
    }

    // Count exit verified
    if (record.exitVerified) {
      stats.exitVerified++;
    }

    // Count not yet verified (has entry status but not exit verified and no early leave)
    if (record.entryStatus && !record.exitVerified && !record.earlyLeaveAt) {
      stats.notYetVerified++;
    }
  }

  return stats;
}

/**
 * HTTP trigger function to get session status
 */
export async function getSession(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  context.log('Processing GET /api/sessions/{sessionId} request');

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

    // Verify session exists and teacher owns it
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

    // Get attendance records for the session
    const attendance = await attendanceService.getAllAttendance(sessionId);

    // Get chains for the session
    const chains = await chainService.getChains(sessionId);

    // Compute real-time statistics (Requirement 12.4)
    const stats = computeStats(attendance);

    // Return session status response
    const response: SessionStatusResponse = {
      session,
      attendance,
      chains,
      stats
    };

    return {
      status: 200,
      jsonBody: response
    };

  } catch (error: any) {
    context.error('Error getting session status:', error);
    
    return {
      status: 500,
      jsonBody: {
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to get session status',
          details: error.message,
          timestamp: Date.now()
        }
      }
    };
  }
}

