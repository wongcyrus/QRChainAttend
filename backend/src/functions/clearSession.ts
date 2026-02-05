/**
 * Clear Session API Endpoint
 * Clears a user's active session
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

export async function clearSession(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  context.log('Processing POST /api/auth/clear-session request');

  try {
    const body = await request.json() as any;
    const email = body.email;

    if (!email) {
      return {
        status: 400,
        jsonBody: { error: 'Email is required' }
      };
    }

    const sessionsTable = getTableClient('UserSessions');

    try {
      await sessionsTable.deleteEntity('USERSESSION', email);
      context.log(`Cleared session for user: ${email}`);
    } catch (error: any) {
      if (error.statusCode === 404) {
        // Session doesn't exist, that's fine
        context.log(`No session found for user: ${email}`);
      } else {
        throw error;
      }
    }

    return {
      status: 200,
      jsonBody: { success: true }
    };

  } catch (error: any) {
    context.error('Error clearing session:', error);
    
    return {
      status: 500,
      jsonBody: {
        error: 'Failed to clear session',
        details: error.message
      }
    };
  }
}

app.http('clearSession', {
  methods: ['POST'],
  route: 'auth/clear-session',
  authLevel: 'anonymous',
  handler: clearSession
});
