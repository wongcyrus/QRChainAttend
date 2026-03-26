/**
 * Update Session Attendee List API Endpoint
 * PATCH /sessions/{sessionId}/attendee-list — add/remove emails from the per-session attendee list
 */

import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { parseAuthFromRequest, hasRole, getUserId } from '../utils/auth';
import { getTableClient, TableNames } from '../utils/database';
import { validateEmails, normalizeEmail } from '../utils/emailValidation';
import { checkSessionAccess } from '../utils/sessionAccess';

interface UpdateSessionAttendeeListRequest {
  addEmails?: string[];
  removeEmails?: string[];
}

export async function updateSessionAttendeeList(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  context.log('Processing PATCH /api/sessions/{sessionId}/attendee-list request');

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

    // Parse request body
    const body = await request.json() as UpdateSessionAttendeeListRequest;
    const addEmails = body.addEmails || [];
    const removeEmails = body.removeEmails || [];

    const sessionAttendeeTable = getTableClient(TableNames.SESSION_ATTENDEE_ENTRIES);

    // Load existing session attendee entries
    const existingEmails = new Set<string>();
    for await (const entity of sessionAttendeeTable.listEntities({
      queryOptions: { filter: `PartitionKey eq '${sessionId}'` }
    })) {
      existingEmails.add(entity.rowKey as string);
    }

    let addedCount = 0;
    let removedCount = 0;

    // Process addEmails: validate format, normalize, check duplicates
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

      // Normalize and deduplicate within the request
      const uniqueNewEmails = [...new Set(valid.map(e => normalizeEmail(e)))];

      // Check for duplicates against existing entries — reject if any already exist
      const duplicates = uniqueNewEmails.filter(email => existingEmails.has(email));
      if (duplicates.length > 0) {
        return {
          status: 409,
          jsonBody: {
            error: {
              code: 'DUPLICATE_EMAIL',
              message: 'One or more email addresses already exist in the session attendee list',
              details: { duplicateEmails: duplicates },
              timestamp: Date.now()
            }
          }
        };
      }

      const now = new Date().toISOString();
      for (const email of uniqueNewEmails) {
        await sessionAttendeeTable.createEntity({
          partitionKey: sessionId,
          rowKey: email,
          sourceListId: '',
          addedBy: organizerId,
          addedAt: now
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
          await sessionAttendeeTable.deleteEntity(sessionId, normalized);
          existingEmails.delete(normalized);
          removedCount++;
        }
      }
    }

    return {
      status: 200,
      jsonBody: {
        sessionId,
        addedCount,
        removedCount,
        emailCount: existingEmails.size,
        emails: [...existingEmails]
      }
    };

  } catch (error: any) {
    context.error('Error updating session attendee list:', error);

    return {
      status: 500,
      jsonBody: {
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to update session attendee list',
          details: error.message,
          timestamp: Date.now()
        }
      }
    };
  }
}

app.http('updateSessionAttendeeList', {
  methods: ['PATCH'],
  route: 'sessions/{sessionId}/attendee-list',
  authLevel: 'anonymous',
  handler: updateSessionAttendeeList
});
