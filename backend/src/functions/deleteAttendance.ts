/**
 * Delete Attendance Record API Endpoint
 * DELETE /api/sessions/{sessionId}/attendance/{attendeeId}
 */

import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { parseAuthFromRequest, hasRole, getUserId } from '../utils/auth';
import { getTableClient, TableNames } from '../utils/database';

export async function deleteAttendance(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  context.log('Processing DELETE /api/sessions/{sessionId}/attendance/{attendeeId} request');

  try {
    const sessionId = request.params.sessionId;
    const attendeeId = request.params.attendeeId;

    if (!sessionId || !attendeeId) {
      return {
        status: 400,
        jsonBody: { error: { code: 'INVALID_REQUEST', message: 'Session ID and Attendee ID required', timestamp: Date.now() } }
      };
    }

    // Authenticate
    const principal = parseAuthFromRequest(request);
    if (!principal || !hasRole(principal, 'Organizer')) {
      return {
        status: 401,
        jsonBody: { error: { code: 'UNAUTHORIZED', message: 'Organizer role required', timestamp: Date.now() } }
      };
    }

    const organizerId = getUserId(principal);

    // Verify session ownership
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

    // Check ownership (owner or co-organizer)
    const isOwner = session.organizerId === organizerId;
    const isCoOrganizer = session.coOrganizers?.includes(organizerId);

    if (!isOwner && !isCoOrganizer) {
      return {
        status: 403,
        jsonBody: { error: { code: 'FORBIDDEN', message: 'Not authorized to modify this session', timestamp: Date.now() } }
      };
    }

    // Delete attendance record
    const attendanceTable = getTableClient(TableNames.ATTENDANCE);
    
    try {
      await attendanceTable.deleteEntity(sessionId, attendeeId);
    } catch (error: any) {
      if (error.statusCode === 404) {
        return {
          status: 404,
          jsonBody: { error: { code: 'NOT_FOUND', message: 'Attendance record not found', timestamp: Date.now() } }
        };
      }
      throw error;
    }

    // Log deletion
    const deletionLogTable = getTableClient(TableNames.DELETION_LOG);
    const logEntry = {
      partitionKey: organizerId,
      rowKey: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      deletedEntityType: 'Attendance',
      deletedEntityId: attendeeId,
      sessionId: sessionId,
      deletedAt: new Date().toISOString(),
      deletedBy: organizerId
    };

    await deletionLogTable.createEntity(logEntry);

    context.log(`Deleted attendance: ${attendeeId} from session ${sessionId}`);

    return {
      status: 200,
      jsonBody: {
        success: true,
        deletedAttendeeId: attendeeId,
        sessionId: sessionId
      }
    };

  } catch (error: any) {
    context.error('Error deleting attendance:', error);
    return {
      status: 500,
      jsonBody: {
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to delete attendance record',
          details: error.message,
          timestamp: Date.now()
        }
      }
    };
  }
}

app.http('deleteAttendance', {
  methods: ['DELETE'],
  authLevel: 'anonymous',
  route: 'sessions/{sessionId}/attendance/{attendeeId}',
  handler: deleteAttendance
});
