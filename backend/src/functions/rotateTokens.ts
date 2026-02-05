/**
 * Token Rotation Timer Function - REFACTORED (Self-contained)
 * Timer trigger that runs every 60 seconds
 */

import { app, InvocationContext, Timer } from '@azure/functions';
import { TableClient } from '@azure/data-tables';

function getTableClient(tableName: string): TableClient {
  const connectionString = process.env.AzureWebJobsStorage;
  if (!connectionString) {
    throw new Error('AzureWebJobsStorage not configured');
  }
  return TableClient.fromConnectionString(connectionString, tableName);
}

export async function rotateTokens(myTimer: Timer, context: InvocationContext): Promise<void> {
  context.log('Token rotation timer triggered at:', new Date().toISOString());

  try {
    const sessionsTable = getTableClient('Sessions');
    const tokensTable = getTableClient('Tokens');
    const now = Math.floor(Date.now() / 1000);

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
      
      // Process late entry tokens if active
      if (session.lateEntryActive && session.currentLateTokenId) {
        try {
          const token = await tokensTable.getEntity(sessionId, session.currentLateTokenId as string);
          
          // Check if expired
          if ((token.exp as number) <= now) {
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
            const newExp = now + 60; // 60 seconds TTL
            
            await tokensTable.createEntity({
              partitionKey: sessionId,
              rowKey: newTokenId,
              type: 'LATE_ENTRY',
              exp: newExp,
              status: 'ACTIVE',
              singleUse: true,
              createdAt: now
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
          
          // Check if expired
          if ((token.exp as number) <= now) {
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
            const newExp = now + 60; // 60 seconds TTL
            
            await tokensTable.createEntity({
              partitionKey: sessionId,
              rowKey: newTokenId,
              type: 'EARLY_LEAVE',
              exp: newExp,
              status: 'ACTIVE',
              singleUse: true,
              createdAt: now
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

    // Cleanup: Mark all expired tokens
    const expiredTokens = tokensTable.listEntities({
      queryOptions: {
        filter: `status eq 'ACTIVE' and exp lt ${now}`
      }
    });

    for await (const token of expiredTokens) {
      try {
        const updatedToken: any = {
          partitionKey: token.partitionKey,
          rowKey: token.rowKey,
          ...token,
          status: 'EXPIRED'
        };
        await tokensTable.updateEntity(updatedToken, 'Replace');
        tokensExpired++;
      } catch (error: any) {
        context.error(`Error marking token ${token.rowKey} as expired:`, error);
      }
    }

    context.log(`Token rotation completed: ${sessionsProcessed} sessions, ${tokensExpired} expired, ${tokensCreated} created`);
  } catch (error: any) {
    context.error('Error in token rotation:', error);
  }
}

// Generate random token ID
function generateTokenId(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Buffer.from(bytes).toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}

// Register timer trigger - runs every 60 seconds
app.timer('rotateTokens', {
  schedule: '0 * * * * *',
  handler: rotateTokens
});
