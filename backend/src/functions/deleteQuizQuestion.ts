/**
 * Delete Quiz Question API Endpoint
 * DELETE /api/sessions/{sessionId}/quiz/questions/{questionId}
 * Deletes question and all related responses
 */

import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { parseAuthFromRequest, hasRole, getUserId } from '../utils/auth';
import { getTableClient, TableNames } from '../utils/database';

export async function deleteQuizQuestion(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  context.log('Processing DELETE /api/sessions/{sessionId}/quiz/questions/{questionId} request');

  try {
    const sessionId = request.params.sessionId;
    const questionId = request.params.questionId;

    if (!sessionId || !questionId) {
      return {
        status: 400,
        jsonBody: { error: { code: 'INVALID_REQUEST', message: 'Session ID and Question ID required', timestamp: Date.now() } }
      };
    }

    // Authenticate
    const principal = parseAuthFromRequest(request);
    if (!principal || !hasRole(principal, 'Organizer')) {
      return {
        status: 401,
        jsonBody: { error: { code: 'UNAUTHORIZED', message: 'Organizer role required', timestamp: Date.now() } }
      };
    }

    const organizerId = getUserId(principal);

    // Verify session ownership
    const sessionsTable = getTableClient(TableNames.SESSIONS);
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

    // Check ownership
    const isOwner = session.organizerId === organizerId;
    const isCoOrganizer = session.coOrganizers?.includes(organizerId);

    if (!isOwner && !isCoOrganizer) {
      return {
        status: 403,
        jsonBody: { error: { code: 'FORBIDDEN', message: 'Not authorized to modify this session', timestamp: Date.now() } }
      };
    }

    // Delete question
    const questionsTable = getTableClient(TableNames.QUIZ_QUESTIONS);
    
    try {
      await questionsTable.deleteEntity(sessionId, questionId);
    } catch (error: any) {
      if (error.statusCode === 404) {
        return {
          status: 404,
          jsonBody: { error: { code: 'NOT_FOUND', message: 'Question not found', timestamp: Date.now() } }
        };
      }
      throw error;
    }

    // Delete all responses for this question
    const responsesTable = getTableClient(TableNames.QUIZ_RESPONSES);
    let deletedResponsesCount = 0;
    
    try {
      const responses = responsesTable.listEntities({
        queryOptions: { filter: `PartitionKey eq '${sessionId}' and questionId eq '${questionId}'` }
      });

      for await (const response of responses) {
        await responsesTable.deleteEntity(response.partitionKey as string, response.rowKey as string);
        deletedResponsesCount++;
      }
    } catch (error: any) {
      context.warn('Failed to delete some responses:', error.message);
    }

    // Log deletion
    const deletionLogTable = getTableClient(TableNames.DELETION_LOG);
    const logEntry = {
      partitionKey: organizerId,
      rowKey: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      deletedEntityType: 'QuizQuestion',
      deletedEntityId: questionId,
      sessionId: sessionId,
      deletedAt: new Date().toISOString(),
      deletedBy: organizerId,
      details: JSON.stringify({ deletedResponses: deletedResponsesCount })
    };

    await deletionLogTable.createEntity(logEntry);

    context.log(`Deleted quiz question: ${questionId}, ${deletedResponsesCount} responses`);

    return {
      status: 200,
      jsonBody: {
        success: true,
        deletedQuestionId: questionId,
        sessionId: sessionId,
        deletedResponses: deletedResponsesCount
      }
    };

  } catch (error: any) {
    context.error('Error deleting quiz question:', error);
    return {
      status: 500,
      jsonBody: {
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to delete quiz question',
          details: error.message,
          timestamp: Date.now()
        }
      }
    };
  }
}

app.http('deleteQuizQuestion', {
  methods: ['DELETE'],
  authLevel: 'anonymous',
  route: 'sessions/{sessionId}/quiz/questions/{questionId}',
  handler: deleteQuizQuestion
});
