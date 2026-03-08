import { getTableClient, TableNames } from './database';

const DEFAULT_TTL_SECONDS = 2 * 60 * 60;
let tableEnsured = false;

export interface QuizConversationRecord {
  sessionId: string;
  conversationId: string;
  expiresAt: number;
}

function getTtlSeconds(): number {
  const configured = Number(process.env.QUIZ_CONVERSATION_TTL_SECONDS || DEFAULT_TTL_SECONDS);
  if (!Number.isFinite(configured) || configured <= 0) {
    return DEFAULT_TTL_SECONDS;
  }
  return Math.floor(configured);
}

async function ensureTableExists(): Promise<void> {
  if (tableEnsured) {
    return;
  }

  const table = getTableClient(TableNames.QUIZ_CONVERSATIONS);
  try {
    await table.createTable();
  } catch (error: any) {
    const status = error?.statusCode || error?.status;
    if (status !== 409) {
      throw error;
    }
  }

  tableEnsured = true;
}

export async function upsertQuizConversation(sessionId: string, conversationId: string): Promise<void> {
  if (!sessionId || !conversationId) {
    return;
  }

  await ensureTableExists();

  const now = Math.floor(Date.now() / 1000);
  const ttlSeconds = getTtlSeconds();

  const table = getTableClient(TableNames.QUIZ_CONVERSATIONS);
  await table.upsertEntity(
    {
      partitionKey: sessionId,
      rowKey: conversationId,
      sessionId,
      conversationId,
      lastSeenAt: now,
      expiresAt: now + ttlSeconds,
      updatedAt: now
    },
    'Merge'
  );
}

export async function removeQuizConversation(sessionId: string, conversationId: string): Promise<void> {
  if (!sessionId || !conversationId) {
    return;
  }

  await ensureTableExists();

  const table = getTableClient(TableNames.QUIZ_CONVERSATIONS);
  try {
    await table.deleteEntity(sessionId, conversationId);
  } catch (error: any) {
    const status = error?.statusCode || error?.status;
    if (status !== 404) {
      throw error;
    }
  }
}

export async function listExpiredQuizConversations(limit: number = 100): Promise<QuizConversationRecord[]> {
  await ensureTableExists();

  const now = Math.floor(Date.now() / 1000);
  const table = getTableClient(TableNames.QUIZ_CONVERSATIONS);
  const iterator = table.listEntities({
    queryOptions: {
      filter: `expiresAt le ${now}`
    }
  });

  const results: QuizConversationRecord[] = [];
  for await (const entity of iterator) {
    const sessionId = String((entity as any).partitionKey || '');
    const conversationId = String((entity as any).rowKey || '');
    const expiresAt = Number((entity as any).expiresAt || 0);

    if (!sessionId || !conversationId) {
      continue;
    }

    results.push({
      sessionId,
      conversationId,
      expiresAt
    });

    if (results.length >= limit) {
      break;
    }
  }

  return results;
}
