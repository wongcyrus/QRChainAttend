/**
 * Create Attendee List API Endpoint
 * POST /attendee-lists — Create a new master attendee list with name + emails
 */

import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { parseAuthFromRequest, hasRole, getUserId } from '../utils/auth';
import { getTableClient, TableNames } from '../utils/database';
import { randomUUID } from 'crypto';
import { validateEmails, normalizeEmail } from '../utils/emailValidation';

interface CreateAttendeeListRequest {
  name: string;
  emails: string[];
}

export async function createAttendeeList(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  context.log('Processing POST /api/attendee-lists request');

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

    // Parse request body
    const body = await request.json() as CreateAttendeeListRequest;

    // Validate list name is non-empty
    if (!body.name || body.name.trim().length === 0) {
      return {
        status: 400,
        jsonBody: { error: { code: 'INVALID_REQUEST', message: 'List name is required', timestamp: Date.now() } }
      };
    }

    // Validate emails array is non-empty
    if (!body.emails || !Array.isArray(body.emails) || body.emails.length === 0) {
      return {
        status: 400,
        jsonBody: { error: { code: 'INVALID_REQUEST', message: 'At least one email address is required', timestamp: Date.now() } }
      };
    }

    // Validate all emails
    const { valid, invalid } = validateEmails(body.emails);
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

    // Deduplicate emails (normalized/lowercased)
    const uniqueEmails = [...new Set(valid.map(e => normalizeEmail(e)))];

    const organizerId = getUserId(principal);
    const listId = randomUUID();
    const listName = body.name.trim();
    const now = new Date().toISOString();
    const table = getTableClient(TableNames.ATTENDEE_LIST_ENTRIES);

    // Store each unique email as an entry
    for (const email of uniqueEmails) {
      await table.createEntity({
        partitionKey: listId,
        rowKey: email,
        listName,
        organizerId,
        createdAt: now
      });
    }

    return {
      status: 201,
      jsonBody: {
        listId,
        listName,
        emailCount: uniqueEmails.length,
        emails: uniqueEmails
      }
    };

  } catch (error: any) {
    context.error('Error creating attendee list:', error);

    return {
      status: 500,
      jsonBody: {
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to create attendee list',
          details: error.message,
          timestamp: Date.now()
        }
      }
    };
  }
}

app.http('createAttendeeList', {
  methods: ['POST'],
  route: 'attendee-lists',
  authLevel: 'anonymous',
  handler: createAttendeeList
});
