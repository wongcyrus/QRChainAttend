/**
 * Scan Chain API Endpoint
 * Handles when a student scans another student's QR code to pass the chain
 */
import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { TableClient } from '@azure/data-tables';
import { randomUUID } from 'crypto';

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
  const isLocal = connectionString.includes("127.0.0.1") || connectionString.includes("localhost");
  return TableClient.fromConnectionString(connectionString, tableName, { allowInsecureConnection: isLocal });
}

export async function scanChain(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  context.log('Processing POST /api/sessions/{sessionId}/chains/{chainId}/scan request');

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
    const studentEmail = principal.userDetails;
    
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
    const attendanceTable = getTableClient('Attendance');
    const sessionsTable = getTableClient('Sessions');

    // Verify session exists and is active
    let session;
    try {
      session = await sessionsTable.getEntity('SESSION', sessionId);
      if (session.status !== 'ACTIVE') {
        return {
          status: 400,
          jsonBody: { error: { code: 'SESSION_ENDED', message: 'Session has ended', timestamp: now } }
        };
      }
    } catch (error: any) {
      if (error.statusCode === 404) {
        return {
          status: 404,
          jsonBody: { error: { code: 'NOT_FOUND', message: 'Session not found', timestamp: now } }
        };
      }
      throw error;
    }

    // Verify token exists and is valid
    let token;
    try {
      token = await tokensTable.getEntity(sessionId, tokenId);
      
      // Check if token has expired
      if (token.expiresAt && (token.expiresAt as number) < now) {
        return {
          status: 400,
          jsonBody: { error: { code: 'TOKEN_EXPIRED', message: 'Token has expired', timestamp: now } }
        };
      }
      
      // Verify token belongs to the correct chain
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
          jsonBody: { error: { code: 'TOKEN_NOT_FOUND', message: 'Token not found or already used', timestamp: now } }
        };
      }
      throw error;
    }

    // Get the previous holder (who had the token)
    const previousHolder = token.holderId as string;
    
    // Cannot scan your own QR code
    if (previousHolder === studentEmail) {
      return {
        status: 400,
        jsonBody: { error: { code: 'SELF_SCAN', message: 'Cannot scan your own QR code', timestamp: now } }
      };
    }

    // Mark previous holder's attendance if not already marked
    try {
      const prevAttendance = await attendanceTable.getEntity(sessionId, previousHolder);
      
      if (!prevAttendance.entryStatus) {
        // Determine if late or present based on session start time
        const sessionStartTime = session.startTime as number;
        const lateCutoffMinutes = 15; // Default
        const lateCutoffTime = sessionStartTime + (lateCutoffMinutes * 60);
        
        const entryStatus = now > lateCutoffTime ? 'LATE_ENTRY' : 'PRESENT_ENTRY';
        
        await attendanceTable.updateEntity({
          partitionKey: sessionId,
          rowKey: previousHolder,
          entryStatus,
          entryAt: now
        }, 'Merge');
        
        context.log(`Marked ${previousHolder} as ${entryStatus}`);
      }
    } catch (error: any) {
      context.log(`Warning: Could not update attendance for previous holder: ${error.message}`);
    }

    // Delete the old token
    await tokensTable.deleteEntity(sessionId, tokenId);

    // Create new token for current scanner
    const newTokenId = randomUUID();
    const newSeq = (token.seq as number) + 1;
    const tokenTTL = parseInt(process.env.CHAIN_TOKEN_TTL_SECONDS || '20');
    const newExpiresAt = now + (tokenTTL * 1000);

    const newTokenEntity = {
      partitionKey: sessionId,
      rowKey: newTokenId,
      chainId,
      holderId: studentEmail,
      seq: newSeq,
      expiresAt: newExpiresAt,
      createdAt: now
    };
    await tokensTable.createEntity(newTokenEntity);

    // Update chain
    await chainsTable.updateEntity({
      partitionKey: sessionId,
      rowKey: chainId,
      lastHolder: studentEmail,
      lastSeq: newSeq,
      lastAt: now
    }, 'Merge');

    context.log(`Chain ${chainId} passed from ${previousHolder} to ${studentEmail}, seq ${newSeq}`);

    return {
      status: 200,
      jsonBody: {
        success: true,
        newHolder: studentEmail,
        seq: newSeq,
        previousHolder,
        token: newTokenId,
        expiresAt: newExpiresAt
      }
    };

  } catch (error: any) {
    context.error('Error scanning chain:', error);
    
    return {
      status: 500,
      jsonBody: {
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to scan chain',
          details: error.message,
          timestamp: Date.now()
        }
      }
    };
  }
}

app.http('scanChain', {
  methods: ['POST'],
  route: 'sessions/{sessionId}/chains/{chainId}/scan',
  authLevel: 'anonymous',
  handler: scanChain
});
