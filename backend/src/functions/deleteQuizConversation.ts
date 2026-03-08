/**
 * Delete Quiz Conversation API Endpoint
 * Explicitly deletes a Foundry conversation when live quiz screen share stops.
 */

import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { parseAuthFromRequest, hasRole } from '../utils/auth';
import { getAgentClient } from '../utils/agentService';
import { removeQuizConversation } from '../utils/quizConversationStorage';

export async function deleteQuizConversation(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  context.log('Processing DELETE /api/sessions/{sessionId}/quiz/conversation/{conversationId} request');

  try {
    const principal = parseAuthFromRequest(request);
    if (!principal) {
      return {
        status: 401,
        jsonBody: { error: { code: 'UNAUTHORIZED', message: 'Missing authentication header', timestamp: Date.now() } }
      };
    }

    if (!hasRole(principal, 'Organizer') && !hasRole(principal, 'organizer')) {
      return {
        status: 403,
        jsonBody: { error: { code: 'FORBIDDEN', message: 'Organizer role required', timestamp: Date.now() } }
      };
    }

    const sessionId = request.params.sessionId;
    const conversationId = request.params.conversationId;

    if (!sessionId || !conversationId) {
      return {
        status: 400,
        jsonBody: { error: { code: 'INVALID_REQUEST', message: 'Missing sessionId or conversationId', timestamp: Date.now() } }
      };
    }

    const agentClient = getAgentClient();
    await agentClient.deleteConversation(conversationId);
    await removeQuizConversation(sessionId, conversationId);

    return {
      status: 200,
      jsonBody: {
        sessionId,
        conversationId,
        deleted: true
      }
    };
  } catch (error: any) {
    context.error('Error deleting quiz conversation:', {
      message: error?.message,
      code: error?.code,
      status: error?.status,
      stack: error?.stack
    });

    return {
      status: 500,
      jsonBody: {
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to delete quiz conversation',
          details: error?.message || 'Unknown error',
          timestamp: Date.now()
        }
      }
    };
  }
}

app.http('deleteQuizConversation', {
  methods: ['DELETE'],
  route: 'sessions/{sessionId}/quiz/conversation/{conversationId}',
  authLevel: 'anonymous',
  handler: deleteQuizConversation
});
