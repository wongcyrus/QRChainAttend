/**
 * Check Session API Endpoint
 * Checks if a user already has an active session
 */

import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { TableClient } from '@azure/data-tables';

function parseUserPrincipal(header: string): any {
  try {
    const decoded = Buffer.from(header, 'base64').toString('utf-8');
    return JSON.parse(decoded);
  } catch {
    throw new Error('Invalid authentication header');
  }
}

function hasRole(principal: any, role: string): boolean {
  const roles = principal?.userRoles || [];
  return roles.some((r: string) => r.toLowerCase() === role.toLowerCase());
}

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
    const principalHeader = request.headers.get('x-ms-client-principal') || request.headers.get('x-client-principal');
    if (!principalHeader) {
      return {
        status: 401,
        jsonBody: { error: 'Not authenticated' }
      };
    }

    const principal = parseUserPrincipal(principalHeader);
    if (!hasRole(principal, 'authenticated')) {
      return {
        status: 403,
        jsonBody: { error: 'Forbidden' }
      };
    }

    const body = await request.json() as any;
    const email = body.email;

    if (!email) {
      return {
        status: 400,
        jsonBody: { error: 'Email is required' }
      };
    }

    const principalEmail = principal.userDetails || '';
    if (principalEmail && principalEmail.toLowerCase() !== String(email).toLowerCase()) {
      return {
        status: 403,
        jsonBody: { error: 'Email does not match authenticated user' }
      };
    }

    const sessionsTable = getTableClient('UserSessions');
    const now = Math.floor(Date.now() / 1000); // Unix timestamp in seconds

    try {
      const session = await sessionsTable.getEntity('USERSESSION', email);
      
      // Check if session is still valid (less than 24 hours old)
      const sessionAge = now - (session.createdAt as number);
      const isValid = sessionAge < 24 * 60 * 60; // 24 hours in seconds

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
