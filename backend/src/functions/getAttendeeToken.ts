/**
 * Get Attendee Token API Endpoint
 * Returns the active chain token for a attendee if they are a holder
 */

import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { parseAuthFromRequest, hasRole, getUserId } from '../utils/auth';
import { getTableClient, TableNames } from '../utils/database';
export async function getAttendeeToken(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  context.log('Processing GET /api/sessions/{sessionId}/tokens/{attendeeId} request');

  try {
    // Parse authentication
    const principal = parseAuthFromRequest(request);
    if (!principal) {
      return {
        status: 401,
        jsonBody: { error: { code: 'UNAUTHORIZED', message: 'Missing authentication header', timestamp: Date.now() } }
      };
    }    const principalId = principal.userDetails || principal.userId;

    const sessionId = request.params.sessionId;
    const attendeeId = request.params.attendeeId;
    context.log(`[getStudentToken] request: sessionId=${sessionId || 'missing'}, attendeeId=${attendeeId || 'missing'}, principalId=${principalId || 'missing'}`);
    
    if (!sessionId || !attendeeId) {
      return {
        status: 400,
        jsonBody: { error: { code: 'INVALID_REQUEST', message: 'Missing sessionId or attendeeId', timestamp: Date.now() } }
      };
    }

    const hasStudentRole = hasRole(principal, 'Attendee') || hasRole(principal, 'attendee');
    const isSelfRequest = !!principalId && principalId === attendeeId;
    context.log(`[getStudentToken] auth: hasStudentRole=${hasStudentRole}, isSelfRequest=${isSelfRequest}`);
    if (!hasStudentRole && !isSelfRequest) {
      context.warn(`[getStudentToken] forbidden: principalId=${principalId || 'missing'} requested attendeeId=${attendeeId}`);
      return {
        status: 403,
        jsonBody: { error: { code: 'FORBIDDEN', message: 'Attendee role required', timestamp: Date.now() } }
      };
    }

    const now = Math.floor(Date.now() / 1000); // Unix timestamp in seconds
    const tokensTable = getTableClient(TableNames.TOKENS);
    const chainsTable = getTableClient(TableNames.CHAINS);

    // Find active token for this attendee
    const tokens = tokensTable.listEntities({
      queryOptions: { 
        filter: `PartitionKey eq '${sessionId}' and holderId eq '${attendeeId}'` 
      }
    });

    let activeToken = null;
    let expiredToken = null;
    let scannedTokenCount = 0;

    for await (const token of tokens) {
      scannedTokenCount += 1;
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
      context.log(`[getStudentToken] active token found: session=${sessionId}, attendee=${attendeeId}, tokenCount=${scannedTokenCount}`);
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
      context.log(`[getStudentToken] no active token; attempting regen from expired token: session=${sessionId}, attendee=${attendeeId}, chainId=${chainId}`);
      
      // Verify the chain is still active
      try {
        const chain = await chainsTable.getEntity(sessionId, chainId);
        
        if (chain.state === 'ACTIVE' && chain.lastHolder === attendeeId) {
          // Create new token on-demand
          const tokenTTL = parseInt(process.env.CHAIN_TOKEN_TTL_SECONDS || '25');
          const newTokenId = generateTokenId();
          const newExpiresAt = now + tokenTTL;

          await tokensTable.createEntity({
            partitionKey: sessionId,
            rowKey: newTokenId,
            chainId,
            holderId: attendeeId,
            seq: expiredToken.seq,
            expiresAt: newExpiresAt,
            createdAt: now
          });

          context.log(`Created new token on-demand for attendee ${attendeeId}, chain ${chainId}`);

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
        // Chain not found or error - attendee is no longer holder
        context.log(`[getStudentToken] chain not found/inactive during regen: chain=${chainId}, attendee=${attendeeId}, error=${error.message}`);
      }
    }

    // No active or expired token - attendee is not a holder
    context.log(`[getStudentToken] no holder token: session=${sessionId}, attendee=${attendeeId}, scannedTokenCount=${scannedTokenCount}`);
    return {
      status: 200,
      jsonBody: {
        isHolder: false,
        token: null,
        chainId: null
      }
    };

  } catch (error: any) {
    context.error('[getStudentToken] Error getting attendee token:', error);
    
    return {
      status: 500,
      jsonBody: {
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to get attendee token',
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

app.http('getAttendeeToken', {
  methods: ['GET'],
  route: 'sessions/{sessionId}/tokens/{attendeeId}',
  authLevel: 'anonymous',
  handler: getAttendeeToken
});
