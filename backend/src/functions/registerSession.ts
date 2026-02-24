/**
 * Register Session API Endpoint
 * Registers a new user session
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

export async function registerSession(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  context.log('Processing POST /api/auth/register-session request');

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
    const { email, userId, sessionId } = body;

    if (!email || !userId || !sessionId) {
      return {
        status: 400,
        jsonBody: { error: 'Email, userId, and sessionId are required' }
      };
    }

    const principalEmail = principal.userDetails || '';
    if (principalEmail && principalEmail.toLowerCase() !== String(email).toLowerCase()) {
      return {
        status: 403,
        jsonBody: { error: 'Email does not match authenticated user' }
      };
    }

    const principalUserId = principal.userId || '';
    if (principalUserId && principalUserId !== userId) {
      return {
        status: 403,
        jsonBody: { error: 'User ID does not match authenticated user' }
      };
    }

    const sessionsTable = getTableClient('UserSessions');
    const now = Math.floor(Date.now() / 1000); // Unix timestamp in seconds

    // Create or update session
    const sessionEntity = {
      partitionKey: 'USERSESSION',
      rowKey: email,
      userId: principalUserId || userId,
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
