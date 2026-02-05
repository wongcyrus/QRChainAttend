/**
 * Token Rotation Timer Function - REFACTORED (Self-contained)
 * Timer trigger that runs every 60 seconds
 */

import { app, InvocationContext, Timer } from '@azure/functions';
import { TableClient } from '@azure/data-tables';
import { randomBytes } from 'crypto';

function getTableClient(tableName: string): TableClient {
  const connectionString = process.env.AzureWebJobsStorage;
  if (!connectionString) {
    throw new Error('AzureWebJobsStorage not configured');
  }
  const isLocal = connectionString.includes("127.0.0.1") || connectionString.includes("localhost");
  return TableClient.fromConnectionString(connectionString, tableName, { allowInsecureConnection: isLocal });
}

export async function rotateTokens(myTimer: Timer, context: InvocationContext): Promise<void> {
  context.log('Token rotation timer triggered at:', new Date().toISOString());

  try {
    const sessionsTable = getTableClient('Sessions');
    const tokensTable = getTableClient('Tokens');
    const chainsTable = getTableClient('Chains');
    const now = Date.now();

    let sessionsProcessed = 0;
    let tokensExpired = 0;
    let tokensCreated = 0;

    // Query all active sessions
    const sessionEntities = sessionsTable.listEntities({
      queryOptions: { 
        filter: `PartitionKey eq 'SESSION' and status eq 'ACTIVE'` 
      }
    });

    // Process each active session
    for await (const session of sessionEntities) {
      const sessionId = session.rowKey as string;
      
      // Process chain tokens - refresh expired tokens for active chains
      const chains = chainsTable.listEntities({
        queryOptions: {
          filter: `PartitionKey eq '${sessionId}' and state eq 'ACTIVE'`
        }
      });

      for await (const chain of chains) {
        const chainId = chain.rowKey as string;
        const lastHolder = chain.lastHolder as string;

        if (!lastHolder) continue; // Skip chains without holders

        // Find the most recent token for this chain
        const chainTokens = tokensTable.listEntities({
          queryOptions: {
            filter: `PartitionKey eq '${sessionId}' and chainId eq '${chainId}'`
          }
        });

        let mostRecentToken: any = null;
        let mostRecentExpiresAt = 0;

        for await (const token of chainTokens) {
          const expiresAt = token.expiresAt as number;
          if (expiresAt > mostRecentExpiresAt) {
            mostRecentExpiresAt = expiresAt;
            mostRecentToken = token;
          }
        }

        // Create a new token if:
        // 1. No token exists at all, OR
        // 2. The most recent token has expired or will expire soon (within 5 seconds)
        // This ensures seamless QR code refresh without waiting
        const shouldCreateToken = !mostRecentToken || (mostRecentExpiresAt <= now + 5000);

        if (shouldCreateToken) {
          const tokenTTL = parseInt(process.env.CHAIN_TOKEN_TTL_SECONDS || '20') * 1000;
          const newTokenId = generateTokenId();
          const newExpiresAt = now + tokenTTL;

          await tokensTable.createEntity({
            partitionKey: sessionId,
            rowKey: newTokenId,
            chainId,
            holderId: lastHolder,
            seq: chain.lastSeq,
            expiresAt: newExpiresAt,
            createdAt: now
          });

          tokensCreated++;
          context.log(`Created new token for chain ${chainId}, holder ${lastHolder}`);
        }
      }

      // Process late entry tokens if active
      if (session.lateEntryActive && session.currentLateTokenId) {
        try {
          const token = await tokensTable.getEntity(sessionId, session.currentLateTokenId as string);
          
          // Check if expired (convert to milliseconds)
          const tokenExp = (token.exp as number) * 1000;
          if (tokenExp <= now) {
            // Mark as expired
            const updatedToken: any = {
              partitionKey: token.partitionKey,
              rowKey: token.rowKey,
              ...token,
              status: 'EXPIRED'
            };
            await tokensTable.updateEntity(updatedToken, 'Replace');
            tokensExpired++;
            
            // Create new token
            const newTokenId = generateTokenId();
            const newExp = Math.floor(now / 1000) + 60; // 60 seconds TTL
            
            await tokensTable.createEntity({
              partitionKey: sessionId,
              rowKey: newTokenId,
              type: 'LATE_ENTRY',
              exp: newExp,
              status: 'ACTIVE',
              singleUse: true,
              createdAt: Math.floor(now / 1000)
            });
            
            // Update session with new token
            const updatedSession: any = {
              partitionKey: session.partitionKey,
              rowKey: session.rowKey,
              ...session,
              currentLateTokenId: newTokenId
            };
            await sessionsTable.updateEntity(updatedSession, 'Replace');
            
            tokensCreated++;
            context.log(`Rotated late entry token for session ${sessionId}`);
          }
        } catch (error: any) {
          context.error(`Error rotating late entry token for session ${sessionId}:`, error);
        }
      }

      // Process early leave tokens if active
      if (session.earlyLeaveActive && session.currentEarlyTokenId) {
        try {
          const token = await tokensTable.getEntity(sessionId, session.currentEarlyTokenId as string);
          
          // Check if expired (convert to milliseconds)
          const tokenExp = (token.exp as number) * 1000;
          if (tokenExp <= now) {
            // Mark as expired
            const updatedToken: any = {
              partitionKey: token.partitionKey,
              rowKey: token.rowKey,
              ...token,
              status: 'EXPIRED'
            };
            await tokensTable.updateEntity(updatedToken, 'Replace');
            tokensExpired++;
            
            // Create new token
            const newTokenId = generateTokenId();
            const newExp = Math.floor(now / 1000) + 60; // 60 seconds TTL
            
            await tokensTable.createEntity({
              partitionKey: sessionId,
              rowKey: newTokenId,
              type: 'EARLY_LEAVE',
              exp: newExp,
              status: 'ACTIVE',
              singleUse: true,
              createdAt: Math.floor(now / 1000)
            });
            
            // Update session with new token
            const updatedSession: any = {
              partitionKey: session.partitionKey,
              rowKey: session.rowKey,
              ...session,
              currentEarlyTokenId: newTokenId
            };
            await sessionsTable.updateEntity(updatedSession, 'Replace');
            
            tokensCreated++;
            context.log(`Rotated early leave token for session ${sessionId}`);
          }
        } catch (error: any) {
          context.error(`Error rotating early leave token for session ${sessionId}:`, error);
        }
      }

      sessionsProcessed++;
    }

    // Cleanup: Count expired chain tokens (no filter needed, check in code)
    const allTokens = tokensTable.listEntities();

    for await (const token of allTokens) {
      // Skip if doesn't have expiresAt or not expired
      if (!token.expiresAt || (token.expiresAt as number) > now) continue;
      
      tokensExpired++;
    }

    context.log(`Token rotation completed: ${sessionsProcessed} sessions, ${tokensExpired} expired, ${tokensCreated} created`);
  } catch (error: any) {
    context.error('Error in token rotation:', error);
  }
}

// Generate random token ID
function generateTokenId(): string {
  const bytes = randomBytes(32);
  return bytes.toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}

// Register timer trigger - runs every 5 seconds for responsive token refresh
app.timer('rotateTokens', {
  schedule: '*/5 * * * * *',
  handler: rotateTokens
});
