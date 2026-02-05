/**
 * Get Student Token API Endpoint
 * Returns the active chain token for a student if they are a holder
 */

import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { TableClient } from '@azure/data-tables';

// Inline helper functions
function parseUserPrincipal(header: string): any {
  try {
    const decoded = Buffer.from(header, 'base64').toString('utf-8');
    return JSON.parse(decoded);
  } catch {
    throw new Error('Invalid authentication header');
  }
}

function hasRole(principal: any, role: string): boolean {
  const roles = principal.userRoles || [];
  return roles.includes(role);
}

function getTableClient(tableName: string): TableClient {
  const connectionString = process.env.AzureWebJobsStorage;
  if (!connectionString) {
    throw new Error('AzureWebJobsStorage not configured');
  }
  return TableClient.fromConnectionString(connectionString, tableName);
}

export async function getStudentToken(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  context.log('Processing GET /api/sessions/{sessionId}/tokens/{studentId} request');

  try {
    // Parse authentication
    const principalHeader = request.headers.get('x-ms-client-principal');
    if (!principalHeader) {
      return {
        status: 401,
        jsonBody: { error: { code: 'UNAUTHORIZED', message: 'Missing authentication header', timestamp: Date.now() } }
      };
    }

    const principal = parseUserPrincipal(principalHeader);
    
    // Require Student role
    if (!hasRole(principal, 'Student') && !hasRole(principal, 'student')) {
      return {
        status: 403,
        jsonBody: { error: { code: 'FORBIDDEN', message: 'Student role required', timestamp: Date.now() } }
      };
    }

    const sessionId = request.params.sessionId;
    const studentId = request.params.studentId;
    
    if (!sessionId || !studentId) {
      return {
        status: 400,
        jsonBody: { error: { code: 'INVALID_REQUEST', message: 'Missing sessionId or studentId', timestamp: Date.now() } }
      };
    }

    // Find active token for this student
    const tokensTable = getTableClient('Tokens');
    const tokens = tokensTable.listEntities({
      queryOptions: { 
        filter: `PartitionKey eq '${sessionId}' and holderId eq '${studentId}'` 
      }
    });

    const now = Date.now();
    let activeToken = null;

    for await (const token of tokens) {
      // Check if token is still valid (not expired)
      if (token.expiresAt && (token.expiresAt as number) > now) {
        activeToken = {
          token: token.rowKey,
          chainId: token.chainId,
          seq: token.seq,
          expiresAt: token.expiresAt
        };
        break;
      }
    }

    if (!activeToken) {
      return {
        status: 200,
        jsonBody: {
          isHolder: false,
          token: null,
          chainId: null
        }
      };
    }

    return {
      status: 200,
      jsonBody: {
        isHolder: true,
        ...activeToken
      }
    };

  } catch (error: any) {
    context.error('Error getting student token:', error);
    
    return {
      status: 500,
      jsonBody: {
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to get student token',
          details: error.message,
          timestamp: Date.now()
        }
      }
    };
  }
}

app.http('getStudentToken', {
  methods: ['GET'],
  route: 'sessions/{sessionId}/tokens/{studentId}',
  authLevel: 'anonymous',
  handler: getStudentToken
});
