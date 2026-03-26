/**
 * Get Attendee List API Endpoint
 * GET /attendee-lists/{listId} — return a single master list with all its email entries
 */

import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { parseAuthFromRequest, hasRole, getUserId } from '../utils/auth';
import { getTableClient, TableNames } from '../utils/database';

export async function getAttendeeList(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  context.log('Processing GET /api/attendee-lists/{listId} request');

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

    const listId = request.params.listId;
    if (!listId) {
      return {
        status: 400,
        jsonBody: { error: { code: 'INVALID_REQUEST', message: 'List ID is required', timestamp: Date.now() } }
      };
    }

    const organizerId = getUserId(principal);
    const table = getTableClient(TableNames.ATTENDEE_LIST_ENTRIES);

    // Query all entries for this listId (partitionKey)
    const emails: string[] = [];
    let listName: string | null = null;
    let entryOrganizerId: string | null = null;

    for await (const entity of table.listEntities({
      queryOptions: { filter: `PartitionKey eq '${listId}'` }
    })) {
      if (listName === null) {
        listName = entity.listName as string;
        entryOrganizerId = entity.organizerId as string;
      }
      emails.push(entity.rowKey as string);
    }

    // Return 404 if no entries found
    if (emails.length === 0) {
      return {
        status: 404,
        jsonBody: { error: { code: 'NOT_FOUND', message: 'Attendee list not found', timestamp: Date.now() } }
      };
    }

    // Verify the organizer owns the list
    if (entryOrganizerId !== organizerId) {
      return {
        status: 403,
        jsonBody: { error: { code: 'FORBIDDEN', message: 'You do not own this attendee list', timestamp: Date.now() } }
      };
    }

    return {
      status: 200,
      jsonBody: {
        listId,
        listName,
        emailCount: emails.length,
        emails
      }
    };

  } catch (error: any) {
    context.error('Error fetching attendee list:', error);

    return {
      status: 500,
      jsonBody: {
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to fetch attendee list',
          details: error.message,
          timestamp: Date.now()
        }
      }
    };
  }
}

app.http('getAttendeeList', {
  methods: ['GET'],
  route: 'attendee-lists/{listId}',
  authLevel: 'anonymous',
  handler: getAttendeeList
});
