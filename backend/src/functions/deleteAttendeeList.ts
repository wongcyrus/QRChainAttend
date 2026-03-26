/**
 * Delete Attendee List API Endpoint
 * DELETE /attendee-lists/{listId} — verify ownership, delete all entries for the list
 */

import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { parseAuthFromRequest, hasRole, getUserId } from '../utils/auth';
import { getTableClient, TableNames } from '../utils/database';

export async function deleteAttendeeList(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  context.log('Processing DELETE /api/attendee-lists/{listId} request');

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
    const entries: { rowKey: string }[] = [];
    let entryOrganizerId: string | null = null;

    for await (const entity of table.listEntities({
      queryOptions: { filter: `PartitionKey eq '${listId}'` }
    })) {
      if (entryOrganizerId === null) {
        entryOrganizerId = entity.organizerId as string;
      }
      entries.push({ rowKey: entity.rowKey as string });
    }

    // Return 404 if no entries found
    if (entries.length === 0) {
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

    // Delete all entries for the list
    for (const entry of entries) {
      await table.deleteEntity(listId, entry.rowKey);
    }

    return {
      status: 200,
      jsonBody: {
        listId,
        deletedCount: entries.length
      }
    };

  } catch (error: any) {
    context.error('Error deleting attendee list:', error);

    return {
      status: 500,
      jsonBody: {
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to delete attendee list',
          details: error.message,
          timestamp: Date.now()
        }
      }
    };
  }
}

app.http('deleteAttendeeList', {
  methods: ['DELETE'],
  route: 'attendee-lists/{listId}',
  authLevel: 'anonymous',
  handler: deleteAttendeeList
});
