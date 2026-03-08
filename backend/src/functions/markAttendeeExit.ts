/**
 * Mark Attendee Exit
 * Allows organizer to manually mark a attendee as having left the session
 */

import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { parseAuthFromRequest, hasRole, getUserId } from '../utils/auth';
import { getTableClient, TableNames } from '../utils/database';
export async function markAttendeeExit(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  context.log('Processing POST /api/sessions/{sessionId}/mark-exit request');

  try {
    const principal = parseAuthFromRequest(request);
    if (!principal) {
      return {
        status: 401,
        jsonBody: { error: { code: 'UNAUTHORIZED', message: 'Missing authentication header' } }
      };
    }    
    if (!hasRole(principal, 'Organizer')) {
      return {
        status: 403,
        jsonBody: { error: { code: 'FORBIDDEN', message: 'Organizer role required' } }
      };
    }

    const sessionId = request.params.sessionId;
    const body = await request.json() as any;
    const { attendeeId } = body;

    if (!sessionId || !attendeeId) {
      return {
        status: 400,
        jsonBody: { error: { code: 'INVALID_REQUEST', message: 'Missing sessionId or attendeeId' } }
      };
    }

    const attendanceTable = getTableClient(TableNames.ATTENDANCE);
    const now = Math.floor(Date.now() / 1000);

    // Get attendance record
    const attendance = await attendanceTable.getEntity(sessionId, attendeeId);

    // Mark as exited
    await attendanceTable.updateEntity({
      partitionKey: sessionId,
      rowKey: attendeeId,
      exitVerified: true,
      leftAt: now
    }, 'Merge');

    context.log(`Marked attendee ${attendeeId} as exited from session ${sessionId}`);

    return {
      status: 200,
      jsonBody: {
        success: true,
        attendeeId,
        leftAt: now
      }
    };

  } catch (error: any) {
    context.error('Error marking attendee exit:', error);
    
    return {
      status: 500,
      jsonBody: {
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to mark attendee exit',
          details: error.message
        }
      }
    };
  }
}

app.http('markAttendeeExit', {
  methods: ['POST'],
  route: 'sessions/{sessionId}/mark-exit',
  authLevel: 'anonymous',
  handler: markAttendeeExit
});
