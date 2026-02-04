/**
 * Token Rotation Timer Function
 * Feature: qr-chain-attendance
 * Requirements: 4.2, 5.1, 5.2
 * 
 * Timer-triggered Azure Function that runs every 60 seconds to:
 * - Query sessions with active late entry or early leave windows
 * - Mark expired tokens as EXPIRED
 * - Generate new tokens for active windows
 * - Update Session records with current token IDs
 */

import { app, InvocationContext, Timer } from "@azure/functions";
import { getTableClient, TableName } from "../storage";
import { SessionEntity, TokenEntity, TokenType, TokenStatus, SessionStatus } from "../types";
import { tokenService } from "../services/TokenService";
import { sessionService } from "../services/SessionService";
import { getConfig } from "../config";

/**
 * Timer trigger function that rotates tokens every 60 seconds
 * Requirements: 4.2, 5.1, 5.2
 */
export async function rotateTokens(myTimer: Timer, context: InvocationContext): Promise<void> {
  context.log("Token rotation timer triggered at:", new Date().toISOString());

  try {
    const config = getConfig();
    const sessionsTable = getTableClient(TableName.SESSIONS);
    const tokensTable = getTableClient(TableName.TOKENS);

    // Query all active sessions
    const sessionEntities = sessionsTable.listEntities<SessionEntity>({
      queryOptions: { 
        filter: `PartitionKey eq 'SESSION' and status eq '${SessionStatus.ACTIVE}'` 
      }
    });

    let sessionsProcessed = 0;
    let tokensExpired = 0;
    let tokensCreated = 0;

    // Process each active session
    for await (const sessionEntity of sessionEntities) {
      const sessionId = sessionEntity.rowKey;
      
      // Process late entry tokens if active
      if (sessionEntity.lateEntryActive && sessionEntity.currentLateTokenId) {
        const result = await rotateSessionToken(
          sessionId,
          sessionEntity.currentLateTokenId,
          TokenType.LATE_ENTRY,
          config.lateRotationSeconds,
          context
        );
        
        if (result.expired) {
          tokensExpired++;
        }
        
        if (result.newTokenId) {
          // Update session with new late entry token
          await sessionService.updateLateEntryStatus(sessionId, true, result.newTokenId);
          tokensCreated++;
          context.log(`Created new late entry token for session ${sessionId}: ${result.newTokenId}`);
        }
      }

      // Process early leave tokens if active
      if (sessionEntity.earlyLeaveActive && sessionEntity.currentEarlyTokenId) {
        const result = await rotateSessionToken(
          sessionId,
          sessionEntity.currentEarlyTokenId,
          TokenType.EARLY_LEAVE,
          config.earlyLeaveRotationSeconds,
          context
        );
        
        if (result.expired) {
          tokensExpired++;
        }
        
        if (result.newTokenId) {
          // Update session with new early leave token
          await sessionService.updateEarlyLeaveStatus(sessionId, true, result.newTokenId);
          tokensCreated++;
          context.log(`Created new early leave token for session ${sessionId}: ${result.newTokenId}`);
        }
      }

      sessionsProcessed++;
    }

    // Mark all expired tokens in the database
    // This is a cleanup operation for any tokens that weren't caught during rotation
    const now = Math.floor(Date.now() / 1000);
    const expiredTokens = tokensTable.listEntities<TokenEntity>({
      queryOptions: {
        filter: `status eq '${TokenStatus.ACTIVE}' and exp lt ${now}`
      }
    });

    for await (const tokenEntity of expiredTokens) {
      try {
        const updatedEntity: TokenEntity = {
          ...tokenEntity,
          status: TokenStatus.EXPIRED
        };
        
        await tokensTable.updateEntity(updatedEntity, "Replace");
        tokensExpired++;
        context.log(`Marked token ${tokenEntity.rowKey} as EXPIRED`);
      } catch (error: any) {
        // Log error but continue processing other tokens
        context.error(`Error marking token ${tokenEntity.rowKey} as expired:`, error);
      }
    }

    context.log(`Token rotation completed: ${sessionsProcessed} sessions processed, ${tokensExpired} tokens expired, ${tokensCreated} tokens created`);
  } catch (error: any) {
    context.error("Error in token rotation:", error);
    throw error;
  }
}

/**
 * Rotate a single session token (late entry or early leave)
 * 
 * @param sessionId - Session ID
 * @param currentTokenId - Current token ID
 * @param tokenType - Type of token (LATE_ENTRY or EARLY_LEAVE)
 * @param ttlSeconds - TTL for new token
 * @param context - Invocation context for logging
 * @returns Result with expired flag and new token ID if created
 */
async function rotateSessionToken(
  sessionId: string,
  currentTokenId: string,
  tokenType: TokenType.LATE_ENTRY | TokenType.EARLY_LEAVE,
  ttlSeconds: number,
  context: InvocationContext
): Promise<{ expired: boolean; newTokenId?: string }> {
  try {
    // Validate current token
    const validation = await tokenService.validateToken(currentTokenId, sessionId);
    
    // If token is expired, create a new one
    if (!validation.valid && validation.error === "EXPIRED") {
      context.log(`Token ${currentTokenId} expired, creating new ${tokenType} token`);
      
      // Create new token
      const newToken = await tokenService.createToken({
        sessionId,
        type: tokenType,
        ttlSeconds,
        singleUse: true
      });
      
      return {
        expired: true,
        newTokenId: newToken.tokenId
      };
    }
    
    // Token is still valid, no rotation needed
    return { expired: false };
  } catch (error: any) {
    context.error(`Error rotating token ${currentTokenId}:`, error);
    // On error, try to create a new token anyway to maintain service
    try {
      const newToken = await tokenService.createToken({
        sessionId,
        type: tokenType,
        ttlSeconds,
        singleUse: true
      });
      
      return {
        expired: true,
        newTokenId: newToken.tokenId
      };
    } catch (createError: any) {
      context.error(`Failed to create replacement token:`, createError);
      return { expired: false };
    }
  }
}

// Register timer trigger
// Runs every 60 seconds (0 seconds, every minute)

app.timer('rotateTokens', {
  schedule: '0 * * * * *',
  handler: rotateTokens
});
