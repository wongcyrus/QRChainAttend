/**
 * Cleanup Quiz Conversations Timer
 * Runs hourly to delete expired Foundry conversations that were not explicitly cleaned up.
 */

import { app, InvocationContext, Timer } from '@azure/functions';
import { getAgentClient } from '../utils/agentService';
import { listExpiredQuizConversations, removeQuizConversation } from '../utils/quizConversationStorage';

const MAX_CLEANUP_PER_RUN = 100;

export async function cleanupQuizConversations(_timer: Timer, context: InvocationContext): Promise<void> {
  context.log('Starting hourly quiz conversation cleanup');

  const agentClient = getAgentClient();
  const expired = await listExpiredQuizConversations(MAX_CLEANUP_PER_RUN);

  if (expired.length === 0) {
    context.log('No expired quiz conversations found');
    return;
  }

  let deleted = 0;
  let failed = 0;

  for (const item of expired) {
    try {
      await agentClient.deleteConversation(item.conversationId);
      await removeQuizConversation(item.sessionId, item.conversationId);
      deleted += 1;
    } catch (error: any) {
      failed += 1;
      context.error('Failed to cleanup quiz conversation', {
        sessionId: item.sessionId,
        conversationId: item.conversationId,
        expiresAt: item.expiresAt,
        message: error?.message,
        code: error?.code,
        status: error?.status
      });
    }
  }

  context.log('Hourly quiz conversation cleanup completed', {
    scanned: expired.length,
    deleted,
    failed
  });
}

app.timer('cleanupQuizConversations', {
  schedule: '0 0 * * * *',
  runOnStartup: false,
  handler: cleanupQuizConversations
});
