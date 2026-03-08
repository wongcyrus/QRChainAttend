/**
 * Remove Co-Organizer API Endpoint
 * Allows session owner to remove a co-organizer from session
 */

import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { parseAuthFromRequest, hasRole, getUserId } from '../utils/auth';
import { getTableClient, TableNames } from '../utils/database';

interface RemoveCoTeacherRequest {
  coTeacherEmail: string;
}

export async function removeCoOrganizer(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  context.log('Processing DELETE /api/sessions/{sessionId}/share request');

  try {
    const sessionId = request.params.sessionId;
    if (!sessionId) {
      return {
        status: 400,
        jsonBody: { error: { code: 'INVALID_REQUEST', message: 'Session ID is required', timestamp: Date.now() } }
      };
    }

    // Parse authentication
    const principal = parseAuthFromRequest(request);
    if (!principal) {
      return {
        status: 401,
        jsonBody: { error: { code: 'UNAUTHORIZED', message: 'Missing authentication header', timestamp: Date.now() } }
      };
    }    const userId = getUserId(principal);

    // Require Organizer role
    if (!hasRole(principal, 'Organizer') && !hasRole(principal, 'organizer')) {
      return {
        status: 403,
        jsonBody: { error: { code: 'FORBIDDEN', message: 'Organizer role required', timestamp: Date.now() } }
      };
    }

    // Parse request body
    const body = await request.json() as RemoveCoTeacherRequest;
    if (!body.coTeacherEmail) {
      return {
        status: 400,
        jsonBody: { error: { code: 'INVALID_REQUEST', message: 'coTeacherEmail is required', timestamp: Date.now() } }
      };
    }

    const coTeacherEmail = body.coTeacherEmail.toLowerCase();

    const sessionsTable = getTableClient(TableNames.SESSIONS);

    // Get session and verify ownership
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

    // Only session owner can remove co-teachers
    if (session.organizerId !== userId) {
      return {
        status: 403,
        jsonBody: { error: { code: 'FORBIDDEN', message: 'Only session owner can remove co-teachers', timestamp: Date.now() } }
      };
    }

    // Parse existing co-teachers
    let coTeachers: string[] = [];
    if (session.coTeachers) {
      try {
        coTeachers = JSON.parse(session.coTeachers);
      } catch {
        coTeachers = [];
      }
    }

    // Check if co-organizer exists
    const index = coTeachers.indexOf(coTeacherEmail);
    if (index === -1) {
      return {
        status: 404,
        jsonBody: { error: { code: 'NOT_FOUND', message: 'Co-organizer not found in this session', timestamp: Date.now() } }
      };
    }

    // Remove co-organizer
    coTeachers.splice(index, 1);

    // Update session
    await sessionsTable.updateEntity({
      partitionKey: 'SESSION',
      rowKey: sessionId,
      coTeachers: JSON.stringify(coTeachers)
    }, 'Merge');

    context.log(`Co-organizer ${coTeacherEmail} removed from session ${sessionId} by ${userId}`);

    return {
      status: 200,
      jsonBody: {
        message: 'Co-organizer removed successfully',
        sessionId,
        coTeachers
      }
    };

  } catch (error: any) {
    context.error('Error removing co-organizer:', error);
    return {
      status: 500,
      jsonBody: {
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to remove co-organizer',
          details: error.message,
          timestamp: Date.now()
        }
      }
    };
  }
}

app.http('removeCoOrganizer', {
  methods: ['DELETE'],
  route: 'sessions/{sessionId}/remove-co-organizer',
  authLevel: 'anonymous',
  handler: removeCoOrganizer
});
