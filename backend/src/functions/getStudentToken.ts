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
  const email = principal.userDetails || '';
  const emailLower = email.toLowerCase();
  
  // Check VTC domain-based roles
  if (role.toLowerCase() === 'teacher' && emailLower.endsWith('@vtc.edu.hk') && !emailLower.endsWith('@stu.vtc.edu.hk')) {
    return true;
  }
  
  if (role.toLowerCase() === 'student' && emailLower.endsWith('@stu.vtc.edu.hk')) {
    return true;
  }
  
  // Fallback to checking userRoles array
  const roles = principal.userRoles || [];
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

    const now = Math.floor(Date.now() / 1000); // Unix timestamp in seconds
    const tokensTable = getTableClient('Tokens');
    const chainsTable = getTableClient('Chains');

    // Find active token for this student
    const tokens = tokensTable.listEntities({
      queryOptions: { 
        filter: `PartitionKey eq '${sessionId}' and holderId eq '${studentId}'` 
      }
    });

    let activeToken = null;
    let expiredToken = null;

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
      } else if (token.expiresAt) {
        // Keep track of most recent expired token
        if (!expiredToken || (token.expiresAt as number) > (expiredToken.expiresAt as number)) {
          expiredToken = token;
        }
      }
    }

    // If we have an active token, return it
    if (activeToken) {
      return {
        status: 200,
        jsonBody: {
          isHolder: true,
          ...activeToken
        }
      };
    }

    // If we have an expired token, create a new one on-demand
    if (expiredToken) {
      const chainId = expiredToken.chainId as string;
      
      // Verify the chain is still active
      try {
        const chain = await chainsTable.getEntity(sessionId, chainId);
        
        if (chain.state === 'ACTIVE' && chain.lastHolder === studentId) {
          // Create new token on-demand
          const tokenTTL = parseInt(process.env.CHAIN_TOKEN_TTL_SECONDS || '10');
          const newTokenId = generateTokenId();
          const newExpiresAt = now + tokenTTL;

          await tokensTable.createEntity({
            partitionKey: sessionId,
            rowKey: newTokenId,
            chainId,
            holderId: studentId,
            seq: expiredToken.seq,
            expiresAt: newExpiresAt,
            createdAt: now
          });

          context.log(`Created new token on-demand for student ${studentId}, chain ${chainId}`);

          return {
            status: 200,
            jsonBody: {
              isHolder: true,
              token: newTokenId,
              chainId,
              seq: expiredToken.seq,
              expiresAt: newExpiresAt
            }
          };
        }
      } catch (error: any) {
        // Chain not found or error - student is no longer holder
        context.log(`Chain ${chainId} not found or inactive for student ${studentId}`);
      }
    }

    // No active or expired token - student is not a holder
    return {
      status: 200,
      jsonBody: {
        isHolder: false,
        token: null,
        chainId: null
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

// Generate random token ID
function generateTokenId(): string {
  const crypto = require('crypto');
  const bytes = crypto.randomBytes(32);
  return bytes.toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}

app.http('getStudentToken', {
  methods: ['GET'],
  route: 'sessions/{sessionId}/tokens/{studentId}',
  authLevel: 'anonymous',
  handler: getStudentToken
});
