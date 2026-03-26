/**
 * Unlink Session Attendee List API Endpoint
 * DELETE /sessions/{sessionId}/attendee-list — remove the per-session attendee list
 */

import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { parseAuthFromRequest, hasRole, getUserId } from '../utils/auth';
import { getTableClient, TableNames } from '../utils/database';
import { checkSessionAccess } from '../utils/sessionAccess';

export async function unlinkSessionAttendeeList(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  context.log('Processing DELETE /api/sessions/{sessionId}/attendee-list request');

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
    if (!hasRole(principal, 'Organizer') && !hasRole(principal, 'organizer')) {
      return {
        status: 403,
        jsonBody: { error: { code: 'FORBIDDEN', message: 'Organizer role required', timestamp: Date.now() } }
      };
    }

    const sessionId = request.params.sessionId;
    if (!sessionId) {
      return {
        status: 400,
        jsonBody: { error: { code: 'INVALID_REQUEST', message: 'Session ID is required', timestamp: Date.now() } }
      };
    }

    const organizerId = getUserId(principal);
    const sessionsTable = getTableClient(TableNames.SESSIONS);

    // Look up the session entity and verify organizer access
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

    const access = checkSessionAccess(session, organizerId);
    if (!access.hasAccess) {
      return {
        status: 403,
        jsonBody: { error: { code: 'FORBIDDEN', message: 'You do not have access to this session', timestamp: Date.now() } }
      };
    }

    // Query all SessionAttendeeEntries for this session and delete them
    const sessionAttendeeTable = getTableClient(TableNames.SESSION_ATTENDEE_ENTRIES);
    let deletedCount = 0;

    for await (const entity of sessionAttendeeTable.listEntities({
      queryOptions: { filter: `PartitionKey eq '${sessionId}'` }
    })) {
      await sessionAttendeeTable.deleteEntity(entity.partitionKey as string, entity.rowKey as string);
      deletedCount++;
    }

    // Update session entity: clear attendee list fields
    await sessionsTable.updateEntity(
      {
        partitionKey: 'SESSION',
        rowKey: sessionId,
        attendeeListId: '',
        hasAttendeeList: false
      },
      'Merge'
    );

    return {
      status: 200,
      jsonBody: {
        sessionId,
        deletedCount
      }
    };

  } catch (error: any) {
    context.error('Error unlinking session attendee list:', error);

    return {
      status: 500,
      jsonBody: {
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to unlink session attendee list',
          details: error.message,
          timestamp: Date.now()
        }
      }
    };
  }
}

app.http('unlinkSessionAttendeeList', {
  methods: ['DELETE'],
  route: 'sessions/{sessionId}/attendee-list',
  authLevel: 'anonymous',
  handler: unlinkSessionAttendeeList
});
