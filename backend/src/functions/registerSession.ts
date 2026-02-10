/**
 * Register Session API Endpoint
 * Registers a new user session
 */

import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { TableClient } from '@azure/data-tables';

function getTableClient(tableName: string): TableClient {
  const connectionString = process.env.AzureWebJobsStorage;
  if (!connectionString) {
    throw new Error('AzureWebJobsStorage not configured');
  }
  const isLocal = connectionString.includes("127.0.0.1") || connectionString.includes("localhost");
  return TableClient.fromConnectionString(connectionString, tableName, { allowInsecureConnection: isLocal });
}

export async function registerSession(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  context.log('Processing POST /api/auth/register-session request');

  try {
    const body = await request.json() as any;
    const { email, userId, sessionId } = body;

    if (!email || !userId || !sessionId) {
      return {
        status: 400,
        jsonBody: { error: 'Email, userId, and sessionId are required' }
      };
    }

    const sessionsTable = getTableClient('UserSessions');
    const now = Math.floor(Date.now() / 1000); // Unix timestamp in seconds

    // Create or update session
    const sessionEntity = {
      partitionKey: 'USERSESSION',
      rowKey: email,
      userId,
      sessionId,
      createdAt: now,
      lastActiveAt: now
    };

    await sessionsTable.upsertEntity(sessionEntity, 'Replace');

    context.log(`Registered session for user: ${email}`);

    return {
      status: 200,
      jsonBody: {
        success: true,
        sessionId
      }
    };

  } catch (error: any) {
    context.error('Error registering session:', error);
    
    return {
      status: 500,
      jsonBody: {
        error: 'Failed to register session',
        details: error.message
      }
    };
  }
}

app.http('registerSession', {
  methods: ['POST'],
  route: 'auth/register-session',
  authLevel: 'anonymous',
  handler: registerSession
});
