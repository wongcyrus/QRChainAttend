/**
 * Get Quiz Responses API Endpoint
 * GET /api/sessions/{sessionId}/quiz/responses
 * Returns all quiz responses for a session
 */

import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { parseAuthFromRequest, hasRole } from '../utils/auth';
import { getTableClient, TableNames } from '../utils/database';

export async function getQuizResponses(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  context.log('Processing GET /api/sessions/{sessionId}/quiz/responses request');

  try {
    const sessionId = request.params.sessionId;

    if (!sessionId) {
      return {
        status: 400,
        jsonBody: { error: { code: 'INVALID_REQUEST', message: 'Session ID required', timestamp: Date.now() } }
      };
    }

    // Authenticate - require Organizer role
    const principal = parseAuthFromRequest(request);
    if (!principal || !hasRole(principal, 'Organizer')) {
      return {
        status: 401,
        jsonBody: { error: { code: 'UNAUTHORIZED', message: 'Organizer role required', timestamp: Date.now() } }
      };
    }

    // Get all responses for this session
    const responsesTable = getTableClient(TableNames.QUIZ_RESPONSES);
    const responses: any[] = [];

    const entities = responsesTable.listEntities({
      queryOptions: { filter: `PartitionKey eq '${sessionId}'` }
    });

    for await (const entity of entities) {
      responses.push({
        attendeeId: entity.attendeeId,
        questionId: entity.questionId,
        selectedAnswer: entity.selectedAnswer,
        isCorrect: entity.isCorrect,
        answeredAt: entity.answeredAt
      });
    }

    // Sort by answer time (newest first)
    responses.sort((a, b) => b.answeredAt - a.answeredAt);

    return {
      status: 200,
      jsonBody: {
        responses,
        count: responses.length
      }
    };

  } catch (error: any) {
    context.error('Error getting quiz responses:', error);
    return {
      status: 500,
      jsonBody: {
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to get quiz responses',
          timestamp: Date.now()
        }
      }
    };
  }
}

app.http('getQuizResponses', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'sessions/{sessionId}/quiz/responses',
  handler: getQuizResponses
});
