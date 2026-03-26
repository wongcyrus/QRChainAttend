/**
 * Get Attendee Lists API Endpoint
 * GET /attendee-lists — return all master lists owned by the authenticated organizer
 */

import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { parseAuthFromRequest, hasRole, getUserId } from '../utils/auth';
import { getTableClient, TableNames } from '../utils/database';

export async function getAttendeeLists(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  context.log('Processing GET /api/attendee-lists request');

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

    const organizerId = getUserId(principal);
    const table = getTableClient(TableNames.ATTENDEE_LIST_ENTRIES);

    // Query all entries where organizerId matches
    const listsMap = new Map<string, { listId: string; listName: string; emailCount: number }>();

    for await (const entity of table.listEntities({
      queryOptions: { filter: `organizerId eq '${organizerId}'` }
    })) {
      const listId = entity.partitionKey as string;
      const existing = listsMap.get(listId);
      if (existing) {
        existing.emailCount++;
      } else {
        listsMap.set(listId, {
          listId,
          listName: entity.listName as string,
          emailCount: 1
        });
      }
    }

    return {
      status: 200,
      jsonBody: {
        lists: Array.from(listsMap.values())
      }
    };

  } catch (error: any) {
    context.error('Error fetching attendee lists:', error);

    return {
      status: 500,
      jsonBody: {
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to fetch attendee lists',
          details: error.message,
          timestamp: Date.now()
        }
      }
    };
  }
}

app.http('getAttendeeLists', {
  methods: ['GET'],
  route: 'attendee-lists',
  authLevel: 'anonymous',
  handler: getAttendeeLists
});
