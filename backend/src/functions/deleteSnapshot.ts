/**
 * Delete Snapshot API Endpoint
 * DELETE /api/sessions/{sessionId}/snapshots/{snapshotId}
 */

import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { parseAuthFromRequest, hasRole, getUserId } from '../utils/auth';
import { getTableClient, TableNames } from '../utils/database';

export async function deleteSnapshot(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  context.log('Processing DELETE /api/sessions/{sessionId}/snapshots/{snapshotId} request');

  try {
    const sessionId = request.params.sessionId;
    const snapshotId = request.params.snapshotId;

    if (!sessionId || !snapshotId) {
      return {
        status: 400,
        jsonBody: { error: { code: 'INVALID_REQUEST', message: 'Session ID and Snapshot ID required', timestamp: Date.now() } }
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

    // Check ownership
    const isOwner = session.organizerId === organizerId;
    const isCoOrganizer = session.coOrganizers?.includes(organizerId);

    if (!isOwner && !isCoOrganizer) {
      return {
        status: 403,
        jsonBody: { error: { code: 'FORBIDDEN', message: 'Not authorized to modify this session', timestamp: Date.now() } }
      };
    }

    // Delete snapshot
    const snapshotsTable = getTableClient(TableNames.ATTENDANCE_SNAPSHOTS);
    
    try {
      await snapshotsTable.deleteEntity(sessionId, snapshotId);
    } catch (error: any) {
      if (error.statusCode === 404) {
        return {
          status: 404,
          jsonBody: { error: { code: 'NOT_FOUND', message: 'Snapshot not found', timestamp: Date.now() } }
        };
      }
      throw error;
    }

    // Log deletion
    const deletionLogTable = getTableClient(TableNames.DELETION_LOG);
    const logEntry = {
      partitionKey: organizerId,
      rowKey: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      deletedEntityType: 'Snapshot',
      deletedEntityId: snapshotId,
      sessionId: sessionId,
      deletedAt: new Date().toISOString(),
      deletedBy: organizerId
    };

    await deletionLogTable.createEntity(logEntry);

    context.log(`Deleted snapshot: ${snapshotId} from session ${sessionId}`);

    return {
      status: 200,
      jsonBody: {
        success: true,
        deletedSnapshotId: snapshotId,
        sessionId: sessionId
      }
    };

  } catch (error: any) {
    context.error('Error deleting snapshot:', error);
    return {
      status: 500,
      jsonBody: {
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to delete snapshot',
          details: error.message,
          timestamp: Date.now()
        }
      }
    };
  }
}

app.http('deleteSnapshot', {
  methods: ['DELETE'],
  authLevel: 'anonymous',
  route: 'sessions/{sessionId}/snapshots/{snapshotId}',
  handler: deleteSnapshot
});
