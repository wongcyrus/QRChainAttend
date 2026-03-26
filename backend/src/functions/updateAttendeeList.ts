/**
 * Update Attendee List API Endpoint
 * PATCH /attendee-lists/{listId} — add/remove emails from a master attendee list
 */

import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { parseAuthFromRequest, hasRole, getUserId } from '../utils/auth';
import { getTableClient, TableNames } from '../utils/database';
import { validateEmails, normalizeEmail } from '../utils/emailValidation';

interface UpdateAttendeeListRequest {
  addEmails?: string[];
  removeEmails?: string[];
}

export async function updateAttendeeList(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  context.log('Processing PATCH /api/attendee-lists/{listId} request');

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

    // Verify ownership by reading at least one entry from the list
    let listName: string | null = null;
    let entryOrganizerId: string | null = null;
    const existingEmails = new Set<string>();

    for await (const entity of table.listEntities({
      queryOptions: { filter: `PartitionKey eq '${listId}'` }
    })) {
      if (listName === null) {
        listName = entity.listName as string;
        entryOrganizerId = entity.organizerId as string;
      }
      existingEmails.add(entity.rowKey as string);
    }

    // Return 404 if no entries found (list doesn't exist)
    if (existingEmails.size === 0) {
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

    // Parse request body
    const body = await request.json() as UpdateAttendeeListRequest;
    const addEmails = body.addEmails || [];
    const removeEmails = body.removeEmails || [];

    let addedCount = 0;
    let removedCount = 0;

    // Process addEmails: validate format, normalize, deduplicate, create new entries
    if (addEmails.length > 0) {
      const { valid, invalid } = validateEmails(addEmails);
      if (invalid.length > 0) {
        return {
          status: 400,
          jsonBody: {
            error: {
              code: 'INVALID_EMAIL',
              message: 'One or more email addresses are invalid',
              details: { invalidEmails: invalid },
              timestamp: Date.now()
            }
          }
        };
      }

      // Deduplicate normalized emails
      const uniqueNewEmails = [...new Set(valid.map(e => normalizeEmail(e)))];
      const now = new Date().toISOString();

      for (const email of uniqueNewEmails) {
        // Skip if already exists in the list
        if (existingEmails.has(email)) {
          continue;
        }
        await table.createEntity({
          partitionKey: listId,
          rowKey: email,
          listName: listName!,
          organizerId,
          createdAt: now
        });
        existingEmails.add(email);
        addedCount++;
      }
    }

    // Process removeEmails: normalize and delete matching entries
    if (removeEmails.length > 0) {
      for (const email of removeEmails) {
        const normalized = normalizeEmail(email);
        if (existingEmails.has(normalized)) {
          await table.deleteEntity(listId, normalized);
          existingEmails.delete(normalized);
          removedCount++;
        }
      }
    }

    return {
      status: 200,
      jsonBody: {
        listId,
        listName,
        addedCount,
        removedCount,
        emailCount: existingEmails.size,
        emails: [...existingEmails]
      }
    };

  } catch (error: any) {
    context.error('Error updating attendee list:', error);

    return {
      status: 500,
      jsonBody: {
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to update attendee list',
          details: error.message,
          timestamp: Date.now()
        }
      }
    };
  }
}

app.http('updateAttendeeList', {
  methods: ['PATCH'],
  route: 'attendee-lists/{listId}',
  authLevel: 'anonymous',
  handler: updateAttendeeList
});
