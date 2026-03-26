/**
 * Link Attendee List to Session API Endpoint
 * POST /sessions/{sessionId}/attendee-list — snapshot a master list into the session
 */

import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { parseAuthFromRequest, hasRole, getUserId } from '../utils/auth';
import { getTableClient, TableNames } from '../utils/database';
import { checkSessionAccess } from '../utils/sessionAccess';

interface LinkAttendeeListRequest {
  listId: string;
}

export async function linkAttendeeListToSession(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  context.log('Processing POST /api/sessions/{sessionId}/attendee-list request');

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

    // Parse request body
    const body = await request.json() as LinkAttendeeListRequest;
    if (!body.listId) {
      return {
        status: 400,
        jsonBody: { error: { code: 'INVALID_REQUEST', message: 'listId is required', timestamp: Date.now() } }
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

    // Check if session already has an attendee list linked
    if (session.hasAttendeeList === true || session.hasAttendeeList === 'true') {
      return {
        status: 409,
        jsonBody: { error: { code: 'LIST_ALREADY_LINKED', message: 'Session already has an attendee list linked. Unlink the existing list first.', timestamp: Date.now() } }
      };
    }

    // Query AttendeeListEntries for the listId and verify organizer owns the list
    const attendeeListTable = getTableClient(TableNames.ATTENDEE_LIST_ENTRIES);
    const emails: string[] = [];
    let listOrganizerId: string | null = null;

    for await (const entity of attendeeListTable.listEntities({
      queryOptions: { filter: `PartitionKey eq '${body.listId}'` }
    })) {
      if (listOrganizerId === null) {
        listOrganizerId = entity.organizerId as string;
      }
      emails.push(entity.rowKey as string);
    }

    // Return 404 if list not found
    if (emails.length === 0) {
      return {
        status: 404,
        jsonBody: { error: { code: 'NOT_FOUND', message: 'Attendee list not found', timestamp: Date.now() } }
      };
    }

    // Verify the organizer owns the list
    if (listOrganizerId !== organizerId) {
      return {
        status: 403,
        jsonBody: { error: { code: 'FORBIDDEN', message: 'You do not own this attendee list', timestamp: Date.now() } }
      };
    }

    // Copy all entries to SessionAttendeeEntries
    const sessionAttendeeTable = getTableClient(TableNames.SESSION_ATTENDEE_ENTRIES);
    const now = new Date().toISOString();

    for (const email of emails) {
      await sessionAttendeeTable.createEntity({
        partitionKey: sessionId,
        rowKey: email,
        sourceListId: body.listId,
        addedBy: 'SNAPSHOT',
        addedAt: now
      });
    }

    // Update session entity with attendeeListId and hasAttendeeList=true
    await sessionsTable.updateEntity(
      {
        partitionKey: 'SESSION',
        rowKey: sessionId,
        attendeeListId: body.listId,
        hasAttendeeList: true
      },
      'Merge'
    );

    return {
      status: 200,
      jsonBody: {
        sessionId,
        listId: body.listId,
        copiedCount: emails.length
      }
    };

  } catch (error: any) {
    context.error('Error linking attendee list to session:', error);

    return {
      status: 500,
      jsonBody: {
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to link attendee list to session',
          details: error.message,
          timestamp: Date.now()
        }
      }
    };
  }
}

app.http('linkAttendeeListToSession', {
  methods: ['POST'],
  route: 'sessions/{sessionId}/attendee-list',
  authLevel: 'anonymous',
  handler: linkAttendeeListToSession
});
