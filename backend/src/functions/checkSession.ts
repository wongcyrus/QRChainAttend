/**
 * Check Session API Endpoint
 * Checks if a user already has an active session
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

export async function checkSession(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  context.log('Processing POST /api/auth/check-session request');

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
    const now = Date.now();

    try {
      const session = await sessionsTable.getEntity('USERSESSION', email);
      
      // Check if session is still valid (less than 24 hours old)
      const sessionAge = now - (session.createdAt as number);
      const isValid = sessionAge < 24 * 60 * 60 * 1000; // 24 hours

      if (isValid) {
        return {
          status: 200,
          jsonBody: {
            hasActiveSession: true,
            sessionId: session.sessionId,
            createdAt: session.createdAt
          }
        };
      } else {
        // Session expired, delete it
        await sessionsTable.deleteEntity('USERSESSION', email);
      }
    } catch (error: any) {
      if (error.statusCode === 404) {
        // No session found
        return {
          status: 200,
          jsonBody: { hasActiveSession: false }
        };
      }
      throw error;
    }

    return {
      status: 200,
      jsonBody: { hasActiveSession: false }
    };

  } catch (error: any) {
    context.error('Error checking session:', error);
    
    return {
      status: 500,
      jsonBody: {
        error: 'Failed to check session',
        details: error.message
      }
    };
  }
}

app.http('checkSession', {
  methods: ['POST'],
  route: 'auth/check-session',
  authLevel: 'anonymous',
  handler: checkSession
});
