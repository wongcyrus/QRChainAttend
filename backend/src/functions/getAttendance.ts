/**
 * Get Attendance API Endpoint - REFACTORED (Self-contained)
 * No external service dependencies
 */

import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { parseAuthFromRequest, hasRole, getUserId } from '../utils/auth';
import { getTableClient, TableNames } from '../utils/database';
import { checkSessionAccess } from '../utils/sessionAccess';
export async function getAttendance(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  context.log('Processing GET /api/sessions/{sessionId}/attendance request');

  try {
    // Parse authentication
    const principal = parseAuthFromRequest(request);
    if (!principal) {
      return {
        status: 401,
        jsonBody: { error: { code: 'UNAUTHORIZED', message: 'Missing authentication header', timestamp: Date.now() } }
      };
    }    
    // Require Organizer role
    if (!hasRole(principal, 'Organizer')) {
      return {
        status: 403,
        jsonBody: { error: { code: 'FORBIDDEN', message: 'Organizer role required', timestamp: Date.now() } }
      };
    }

    const organizerId = getUserId(principal);
    const sessionId = request.params.sessionId;
    
    if (!sessionId) {
      return {
        status: 400,
        jsonBody: { error: { code: 'INVALID_REQUEST', message: 'Missing sessionId', timestamp: Date.now() } }
      };
    }

    // Verify session exists and organizer owns it
    const sessionsTable = getTableClient(TableNames.SESSIONS);
    let session: any;
    
    try {
      session = await sessionsTable.getEntity('SESSION', sessionId);
    } catch (error: any) {
      if (error.statusCode === 404) {
        return {
          status: 404,
          jsonBody: { error: { code: 'NOT_FOUND', message: 'Session not found', timestamp: Date.now() } }
        };
      }
      throw error;
    }

    // Verify access (owner or co-organizer)
    const access = checkSessionAccess(session, organizerId);
    if (!access.hasAccess) {
      return {
        status: 403,
        jsonBody: { error: { code: 'FORBIDDEN', message: 'You do not have access to this session', timestamp: Date.now() } }
      };
    }

    // Get attendance records
    const attendanceTable = getTableClient(TableNames.ATTENDANCE);
    const attendance: any[] = [];
    
    for await (const entity of attendanceTable.listEntities({ queryOptions: { filter: `PartitionKey eq '${sessionId}'` } })) {
      attendance.push({
        attendeeId: entity.rowKey,
        entryStatus: entity.entryStatus,
        entryMethod: entity.entryMethod, // DIRECT_QR or CHAIN
        entryAt: entity.entryAt,
        exitVerified: entity.exitVerified,
        exitMethod: entity.exitMethod, // DIRECT_QR or CHAIN
        exitedAt: entity.exitedAt, // Exit timestamp
        earlyLeaveAt: entity.earlyLeaveAt,
        finalStatus: entity.finalStatus,
        locationWarning: entity.locationWarning,
        locationDistance: entity.locationDistance,
        // Use joinedAt if available, otherwise fall back to Timestamp (for existing records)
        joinedAt: entity.joinedAt || (entity.timestamp ? Math.floor(new Date(entity.timestamp).getTime() / 1000) : undefined)
      });
    }

    // If session has an attendee list, compute absentees and add listSummary
    if (session.hasAttendeeList === true || session.hasAttendeeList === 'true') {
      const sessionAttendeeTable = getTableClient(TableNames.SESSION_ATTENDEE_ENTRIES);
      const listedEmails: string[] = [];

      for await (const entity of sessionAttendeeTable.listEntities({
        queryOptions: { filter: `PartitionKey eq '${sessionId}'` }
      })) {
        listedEmails.push(entity.rowKey as string);
      }

      // Build set of emails that have attendance records (normalize to lowercase)
      const presentEmails = new Set(
        attendance.map(record => (record.attendeeId as string).toLowerCase())
      );

      // Compute absentees: listed emails not in attendance
      const absentees = listedEmails.filter(email => !presentEmails.has(email.toLowerCase()));

      // Append absentee records
      for (const email of absentees) {
        attendance.push({
          attendeeId: email,
          finalStatus: 'ABSENT',
          entryStatus: undefined,
          entryMethod: undefined,
          entryAt: undefined,
          exitVerified: undefined,
          exitMethod: undefined,
          exitedAt: undefined,
          earlyLeaveAt: undefined,
          locationWarning: undefined,
          locationDistance: undefined,
          joinedAt: undefined
        });
      }

      const totalListed = listedEmails.length;
      const absentCount = absentees.length;
      const presentCount = totalListed - absentCount;

      return {
        status: 200,
        jsonBody: {
          attendance,
          listSummary: {
            totalListed,
            presentCount,
            absentCount
          }
        }
      };
    }

    return {
      status: 200,
      jsonBody: { attendance }
    };

  } catch (error: any) {
    context.error('Error getting attendance:', error);
    
    return {
      status: 500,
      jsonBody: {
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to get attendance',
          details: error.message,
          timestamp: Date.now()
        }
      }
    };
  }
}

app.http('getAttendance', {
  methods: ['GET'],
  route: 'sessions/{sessionId}/attendance',
  authLevel: 'anonymous',
  handler: getAttendance
});
