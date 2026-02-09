/**
 * Request Challenge API Endpoint
 * Generates a unique one-time challenge code for a specific scanner
 */
import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { TableClient } from '@azure/data-tables';
import * as crypto from 'crypto';

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
  
  if (role.toLowerCase() === 'teacher' && emailLower.endsWith('@vtc.edu.hk') && !emailLower.endsWith('@stu.vtc.edu.hk')) {
    return true;
  }
  
  if (role.toLowerCase() === 'student' && emailLower.endsWith('@stu.vtc.edu.hk')) {
    return true;
  }
  
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

function generateChallengeCode(tokenId: string, scannerId: string, timestamp: number): string {
  const hash = crypto.createHash('sha256')
    .update(`${tokenId}:${scannerId}:${timestamp}`)
    .digest('hex');
  
  // Convert to 6-digit code
  const code = parseInt(hash.substring(0, 8), 16) % 1000000;
  return code.toString().padStart(6, '0');
}

export async function requestChallenge(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  context.log('Processing POST /api/sessions/{sessionId}/chains/{chainId}/request-challenge');

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
    const scannerId = principal.userDetails; // Scanner's email
    
    // Require Student role
    if (!hasRole(principal, 'Student') && !hasRole(principal, 'student')) {
      return {
        status: 403,
        jsonBody: { error: { code: 'FORBIDDEN', message: 'Student role required', timestamp: Date.now() } }
      };
    }

    const sessionId = request.params.sessionId;
    const chainId = request.params.chainId;
    const body = await request.json() as any;
    const tokenId = body.tokenId;
    
    if (!sessionId || !chainId || !tokenId) {
      return {
        status: 400,
        jsonBody: { error: { code: 'INVALID_REQUEST', message: 'Missing sessionId, chainId, or tokenId', timestamp: Date.now() } }
      };
    }

    const now = Date.now();
    const tokensTable = getTableClient('Tokens');
    const chainsTable = getTableClient('Chains');

    // Verify token exists and is valid
    let token;
    let chainData;
    try {
      token = await tokensTable.getEntity(sessionId, tokenId);
      chainData = await chainsTable.getEntity(sessionId, chainId);
      
      // Check if token expired
      if (token.expiresAt && (token.expiresAt as number) < now) {
        return {
          status: 400,
          jsonBody: { error: { code: 'TOKEN_EXPIRED', message: 'Token has expired', timestamp: now } }
        };
      }
      
      // Verify token belongs to this chain
      if (token.chainId !== chainId) {
        return {
          status: 400,
          jsonBody: { error: { code: 'INVALID_TOKEN', message: 'Token does not belong to this chain', timestamp: now } }
        };
      }
    } catch (error: any) {
      if (error.statusCode === 404) {
        return {
          status: 404,
          jsonBody: { error: { code: 'NOT_FOUND', message: 'Token or chain not found', timestamp: now } }
        };
      }
      throw error;
    }

    const holderId = token.holderId as string;
    
    // Cannot scan your own QR code
    if (holderId === scannerId) {
      return {
        status: 400,
        jsonBody: { error: { code: 'SELF_SCAN', message: 'Cannot scan your own QR code', timestamp: now } }
      };
    }

    // Generate unique challenge code for this scanner
    const challengeCode = generateChallengeCode(tokenId, scannerId, now);
    const challengeHash = crypto.createHash('sha256').update(challengeCode).digest('hex');
    
    // Store challenge in token (expires in 30 seconds)
    const challengeTTL = parseInt(process.env.CHALLENGE_TTL_SECONDS || '30');
    const challengeExpiresAt = now + (challengeTTL * 1000);
    
    await tokensTable.updateEntity({
      partitionKey: sessionId,
      rowKey: tokenId,
      pendingChallenge: scannerId,
      challengeCode: challengeHash,
      challengeExpiresAt
    }, 'Merge');

    context.log(`Challenge generated for scanner ${scannerId} on token ${tokenId}, code: ${challengeCode}`);

    return {
      status: 200,
      jsonBody: {
        challengeCode,
        holderId,
        holderName: holderId.split('@')[0], // Extract name from email
        expiresAt: challengeExpiresAt,
        expiresIn: challengeTTL
      }
    };

  } catch (error: any) {
    context.error('Error generating challenge:', error);
    
    return {
      status: 500,
      jsonBody: {
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to generate challenge',
          details: error.message,
          timestamp: Date.now()
        }
      }
    };
  }
}

app.http('requestChallenge', {
  methods: ['POST'],
  route: 'sessions/{sessionId}/chains/{chainId}/request-challenge',
  authLevel: 'anonymous',
  handler: requestChallenge
});
