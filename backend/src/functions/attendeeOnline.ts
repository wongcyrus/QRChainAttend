/**
 * Attendee Online Status Tracking
 * Called when attendee connects/disconnects from SignalR
 * Broadcasts status changes to organizer dashboard via SignalR
 */

import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { parseAuthFromRequest, hasRole, getUserId } from '../utils/auth';
import { getTableClient, TableNames } from '../utils/database';
import { broadcastAttendanceUpdate } from '../utils/signalrBroadcast';

export async function attendeeOnline(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  context.log('Processing POST /api/sessions/{sessionId}/attendee-online request');

  try {
    const principal = parseAuthFromRequest(request);
    if (!principal) {
      return {
        status: 401,
        jsonBody: { error: { code: 'UNAUTHORIZED', message: 'Missing authentication header', timestamp: Date.now() } }
      };
    }    if (!hasRole(principal, 'attendee')) {
      return {
        status: 403,
        jsonBody: { error: { code: 'FORBIDDEN', message: 'Attendee role required', timestamp: Date.now() } }
      };
    }
    const sessionId = request.params.sessionId;
    const attendeeId = principal.userDetails || principal.userId;
    
    if (!sessionId || !attendeeId) {
      return {
        status: 400,
        jsonBody: { error: { code: 'INVALID_REQUEST', message: 'Missing sessionId or email', timestamp: Date.now() } }
      };
    }

    const body = await request.json() as any;
    const isOnline = body.isOnline !== false; // Default to true

    // Update attendance record with online status
    const attendanceTable = getTableClient(TableNames.ATTENDANCE);
    
    try {
      const record = await attendanceTable.getEntity(sessionId, attendeeId);
      
      // Update online status and last seen timestamp
      await attendanceTable.updateEntity({
        partitionKey: sessionId,
        rowKey: attendeeId,
        isOnline: isOnline,
        lastSeen: Math.floor(Date.now() / 1000)
      }, 'Merge');

      context.log(`Updated online status for ${attendeeId}: ${isOnline}`);

      // Broadcast to SignalR so organizer dashboard updates in real-time
      await broadcastAttendanceUpdate(sessionId, {
        attendeeId: attendeeId,
        isOnline: isOnline,
      }, context);

      return {
        status: 200,
        jsonBody: { success: true }
      };
    } catch (error: any) {
      if (error.statusCode === 404) {
        return {
          status: 404,
          jsonBody: { error: { code: 'NOT_FOUND', message: 'Attendee not in session', timestamp: Date.now() } }
        };
      }
      throw error;
    }

  } catch (error: any) {
    context.error('Error updating online status:', error);
    
    return {
      status: 500,
      jsonBody: {
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to update online status',
          details: error.message,
          timestamp: Date.now()
        }
      }
    };
  }
}

app.http('attendeeOnline', {
  methods: ['POST'],
  route: 'sessions/{sessionId}/attendee-online',
  authLevel: 'anonymous',
  handler: attendeeOnline
});
