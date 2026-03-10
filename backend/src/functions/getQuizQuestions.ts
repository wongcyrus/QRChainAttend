/**
 * Get Quiz Questions API Endpoint
 * GET /api/sessions/{sessionId}/quiz/questions
 * Returns all quiz questions for a session
 */

import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { parseAuthFromRequest, hasRole } from '../utils/auth';
import { getTableClient, TableNames } from '../utils/database';

export async function getQuizQuestions(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  context.log('Processing GET /api/sessions/{sessionId}/quiz/questions request');

  try {
    const sessionId = request.params.sessionId;

    if (!sessionId) {
      return {
        status: 400,
        jsonBody: { error: { code: 'INVALID_REQUEST', message: 'Session ID required', timestamp: Date.now() } }
      };
    }

    // Authenticate - allow both Organizer and Attendee
    const principal = parseAuthFromRequest(request);
    if (!principal) {
      return {
        status: 401,
        jsonBody: { error: { code: 'UNAUTHORIZED', message: 'Authentication required', timestamp: Date.now() } }
      };
    }

    // Get all questions for this session
    const questionsTable = getTableClient(TableNames.QUIZ_QUESTIONS);
    const questions: any[] = [];

    const entities = questionsTable.listEntities({
      queryOptions: { filter: `PartitionKey eq '${sessionId}'` }
    });

    for await (const entity of entities) {
      questions.push({
        questionId: entity.rowKey,
        questionText: entity.question,  // Field is 'question' not 'questionText'
        options: JSON.parse(entity.options as string),
        correctAnswer: entity.correctAnswer,
        difficulty: entity.difficulty,
        slideId: entity.slideId,
        createdAt: entity.createdAt
      });
    }

    // Sort by creation time (newest first)
    questions.sort((a, b) => b.createdAt - a.createdAt);

    return {
      status: 200,
      jsonBody: {
        questions,
        count: questions.length
      }
    };

  } catch (error: any) {
    context.error('Error getting quiz questions:', error);
    return {
      status: 500,
      jsonBody: {
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to get quiz questions',
          timestamp: Date.now()
        }
      }
    };
  }
}

app.http('getQuizQuestions', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'sessions/{sessionId}/quiz/questions',
  handler: getQuizQuestions
});
