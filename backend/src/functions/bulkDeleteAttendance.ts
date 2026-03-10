/**
 * Bulk Delete Attendance API Endpoint
 * DELETE /api/sessions/{sessionId}/attendance?all=true
 * Deletes all attendance records for a session
 */

import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { parseAuthFromRequest, hasRole, getUserId } from '../utils/auth';
import { getTableClient, TableNames } from '../utils/database';

export async function bulkDeleteAttendance(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  context.log('Processing DELETE /api/sessions/{sessionId}/attendance (bulk) request');

  try {
    const sessionId = request.params.sessionId;
    const all = request.query.get('all');

    if (!sessionId) {
      return {
        status: 400,
        jsonBody: { error: { code: 'INVALID_REQUEST', message: 'Session ID required', timestamp: Date.now() } }
      };
    }

    if (all !== 'true') {
      return {
        status: 400,
        jsonBody: { error: { code: 'INVALID_REQUEST', message: 'Query parameter all=true required for bulk delete', timestamp: Date.now() } }
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

    // Check ownership (only owner, not co-organizers for bulk delete)
    if (session.organizerId !== organizerId) {
      return {
        status: 403,
        jsonBody: { error: { code: 'FORBIDDEN', message: 'Only session owner can bulk delete attendance', timestamp: Date.now() } }
      };
    }

    // Delete all attendance records
    const attendanceTable = getTableClient(TableNames.ATTENDANCE);
    let deletedCount = 0;
    
    try {
      const records = attendanceTable.listEntities({
        queryOptions: { filter: `PartitionKey eq '${sessionId}'` }
      });

      for await (const record of records) {
        await attendanceTable.deleteEntity(record.partitionKey as string, record.rowKey as string);
        deletedCount++;
      }
    } catch (error: any) {
      context.error('Failed to delete some attendance records:', error.message);
      throw error;
    }

    // Log deletion
    const deletionLogTable = getTableClient(TableNames.DELETION_LOG);
    const logEntry = {
      partitionKey: organizerId,
      rowKey: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      deletedEntityType: 'AttendanceBulk',
      deletedEntityId: sessionId,
      sessionId: sessionId,
      deletedAt: new Date().toISOString(),
      deletedBy: organizerId,
      details: JSON.stringify({ deletedCount })
    };

    await deletionLogTable.createEntity(logEntry);

    context.log(`Bulk deleted ${deletedCount} attendance records from session ${sessionId}`);

    return {
      status: 200,
      jsonBody: {
        success: true,
        sessionId: sessionId,
        deletedCount: deletedCount
      }
    };

  } catch (error: any) {
    context.error('Error bulk deleting attendance:', error);
    return {
      status: 500,
      jsonBody: {
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to bulk delete attendance',
          details: error.message,
          timestamp: Date.now()
        }
      }
    };
  }
}

app.http('bulkDeleteAttendance', {
  methods: ['DELETE'],
  authLevel: 'anonymous',
  route: 'sessions/{sessionId}/attendance',
  handler: bulkDeleteAttendance
});
