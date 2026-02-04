/**
 * Token Management Service
 * Feature: qr-chain-attendance
 * Requirements: 3.2, 3.5, 3.7, 4.1, 5.1, 6.5, 8.1, 8.2, 8.3, 8.4, 8.5, 16.1
 * 
 * Manages token lifecycle with TTL and single-use enforcement using ETag concurrency control
 * 
 * Caching Strategy:
 * - Rotating tokens (late entry, early leave) cached for 55 seconds
 * - Reduces Table Storage queries for frequently accessed rotating tokens
 * - Cache invalidated when tokens are consumed or rotated
 * - Improves p95 latency for scan operations (Requirement 16.1)
 */

import { randomBytes } from "crypto";
import { getTableClient, TableName } from "../storage";
import {
  Token,
  TokenEntity,
  TokenType,
  TokenStatus,
  CreateTokenParams,
  ConsumeResult,
  ValidationResult
} from "../types";
import { RestError } from "@azure/data-tables";
import { Cache, createCache } from "../utils/cache";

/**
 * TokenService class
 * Provides CRUD operations for tokens with cryptographic randomness and ETag concurrency
 */
export class TokenService {
  private tableClient = getTableClient(TableName.TOKENS);
  
  // Cache for rotating tokens (55 second TTL - slightly less than token rotation period)
  // This ensures we fetch fresh tokens before they rotate
  private rotatingTokenCache: Cache<Token> = createCache<Token>({ defaultTTL: 55000 });

  /**
   * Create a new token with cryptographically random tokenId
   * Requirements: 8.1, 8.2
   * 
   * @param params - Token creation parameters
   * @returns Created token with ETag
   */
  async createToken(params: CreateTokenParams): Promise<Token> {
    // Generate cryptographically random tokenId (32 bytes, base64url encoded)
    const tokenId = this.generateTokenId();
    
    // Calculate expiration timestamp (Unix seconds)
    const now = Math.floor(Date.now() / 1000);
    const exp = now + params.ttlSeconds;
    
    // Create token entity
    const entity: TokenEntity = {
      partitionKey: params.sessionId,
      rowKey: tokenId,
      type: params.type,
      chainId: params.chainId,
      issuedTo: params.issuedTo,
      seq: params.seq,
      exp,
      status: TokenStatus.ACTIVE,
      singleUse: params.singleUse,
      createdAt: now,
    };
    
    // Store in Azure Table Storage
    const result = await this.tableClient.createEntity(entity);
    
    // Return token with ETag
    return this.entityToToken(entity, result.etag || "");
  }

  /**
   * Get token by ID with caching for rotating tokens
   * 
   * Cache Strategy:
   * - Cache rotating tokens (LATE_ENTRY, EARLY_LEAVE) for 55 seconds
   * - Chain tokens are not cached (short-lived, single-use)
   * - Reduces Table Storage queries for frequently accessed rotating tokens
   * 
   * @param tokenId - Token identifier
   * @param sessionId - Session identifier (partition key)
   * @returns Token object or null if not found
   */
  async getToken(tokenId: string, sessionId: string): Promise<Token | null> {
    // Check cache for rotating tokens
    const cacheKey = `${sessionId}:${tokenId}`;
    const cached = this.rotatingTokenCache.get(cacheKey);
    if (cached) {
      return cached;
    }
    
    // Cache miss - fetch from storage
    try {
      const entity = await this.tableClient.getEntity<TokenEntity>(
        sessionId,
        tokenId
      );
      const token = this.entityToToken(entity, entity.etag!);
      
      // Cache rotating tokens only
      if (token.type === TokenType.LATE_ENTRY || token.type === TokenType.EARLY_LEAVE) {
        this.rotatingTokenCache.set(cacheKey, token);
      }
      
      return token;
    } catch (error: any) {
      if (error.statusCode === 404) {
        return null;
      }
      throw error;
    }
  }

  /**
   * Validate token status and expiration
   * Requirements: 3.5, 8.5
   * 
   * @param tokenId - Token identifier
   * @returns Validation result with token if valid
   */
  async validateToken(tokenId: string, sessionId: string): Promise<ValidationResult> {
    try {
      // Retrieve token from storage
      const entity = await this.tableClient.getEntity<TokenEntity>(
        sessionId,
        tokenId
      );
      
      const now = Math.floor(Date.now() / 1000);
      
      // Check if expired
      if (entity.exp <= now) {
        return {
          valid: false,
          error: "EXPIRED"
        };
      }
      
      // Check if already used
      if (entity.status === TokenStatus.USED) {
        return {
          valid: false,
          error: "USED"
        };
      }
      
      // Check if revoked
      if (entity.status === TokenStatus.REVOKED) {
        return {
          valid: false,
          error: "REVOKED"
        };
      }
      
      // Token is valid
      return {
        valid: true,
        token: this.entityToToken(entity, entity.etag!)
      };
    } catch (error: any) {
      if (error.statusCode === 404) {
        return {
          valid: false,
          error: "NOT_FOUND"
        };
      }
      throw error;
    }
  }

  /**
   * Consume token with ETag optimistic concurrency control
   * Requirements: 3.7, 8.3, 8.4
   * 
   * This method atomically marks a token as USED, ensuring single-use enforcement.
   * If the ETag doesn't match (another request consumed it first), returns ALREADY_USED error.
   * 
   * Cache Strategy:
   * - Invalidate cache on consumption
   * 
   * @param tokenId - Token identifier
   * @param sessionId - Session identifier (partition key)
   * @param etag - Current ETag for optimistic concurrency
   * @returns Consume result indicating success or failure reason
   */
  async consumeToken(tokenId: string, sessionId: string, etag: string): Promise<ConsumeResult> {
    try {
      // First, retrieve the current token to validate it
      const entity = await this.tableClient.getEntity<TokenEntity>(
        sessionId,
        tokenId
      );
      
      const now = Math.floor(Date.now() / 1000);
      
      // Check if expired
      if (entity.exp <= now) {
        return {
          success: false,
          error: "EXPIRED"
        };
      }
      
      // Check if already used
      if (entity.status === TokenStatus.USED) {
        return {
          success: false,
          error: "ALREADY_USED"
        };
      }
      
      // Check if revoked
      if (entity.status === TokenStatus.REVOKED) {
        return {
          success: false,
          error: "REVOKED"
        };
      }
      
      // Update token status to USED with ETag condition
      const updatedEntity: TokenEntity = {
        ...entity,
        status: TokenStatus.USED,
        usedAt: now
      };
      
      // Use updateEntity with etag for optimistic concurrency control
      const result = await this.tableClient.updateEntity(
        updatedEntity,
        "Replace",
        { etag }
      );
      
      // Invalidate cache
      const cacheKey = `${sessionId}:${tokenId}`;
      this.rotatingTokenCache.delete(cacheKey);
      
      // Success - token consumed
      return {
        success: true,
        token: this.entityToToken(updatedEntity, result.etag || "")
      };
    } catch (error: any) {
      // ETag mismatch - token was already consumed by another request
      if (error instanceof RestError && error.statusCode === 412) {
        return {
          success: false,
          error: "ALREADY_USED"
        };
      }
      
      // Token not found
      if (error.statusCode === 404) {
        return {
          success: false,
          error: "NOT_FOUND"
        };
      }
      
      // Other errors - rethrow
      throw error;
    }
  }

  /**
   * Revoke a token
   * Requirements: 8.6
   * 
   * @param tokenId - Token identifier
   * @param sessionId - Session identifier (partition key)
   */
  async revokeToken(tokenId: string, sessionId: string): Promise<void> {
    try {
      // Retrieve current token
      const entity = await this.tableClient.getEntity<TokenEntity>(
        sessionId,
        tokenId
      );
      
      // Update status to REVOKED
      const updatedEntity: TokenEntity = {
        ...entity,
        status: TokenStatus.REVOKED
      };
      
      await this.tableClient.updateEntity(updatedEntity, "Replace");
    } catch (error: any) {
      // If token doesn't exist, consider it already revoked
      if (error.statusCode === 404) {
        return;
      }
      throw error;
    }
  }

  /**
   * Generate cryptographically random tokenId
   * Requirements: 8.1
   * 
   * Uses Node.js crypto.randomBytes for cryptographic randomness
   * Returns 32 bytes encoded as base64url (URL-safe, no padding)
   * 
   * @returns Random token identifier
   */
  private generateTokenId(): string {
    // Generate 32 random bytes
    const bytes = randomBytes(32);
    
    // Encode as base64url (URL-safe, no padding)
    return bytes
      .toString("base64")
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=/g, "");
  }

  /**
   * Convert TokenEntity to Token
   * 
   * @param entity - Token entity from storage
   * @param etag - ETag from storage
   * @returns Token object
   */
  private entityToToken(entity: TokenEntity, etag: string): Token {
    return {
      tokenId: entity.rowKey,
      sessionId: entity.partitionKey,
      type: entity.type,
      chainId: entity.chainId,
      issuedTo: entity.issuedTo,
      seq: entity.seq,
      exp: entity.exp,
      status: entity.status,
      singleUse: entity.singleUse,
      etag
    };
  }
}

// Lazy-initialized singleton instance
let _tokenService: TokenService | null = null;

export function getTokenService(): TokenService {
  if (!_tokenService) {
    _tokenService = new TokenService();
  }
  return _tokenService;
}

// For backward compatibility
export const tokenService = new Proxy({} as TokenService, {
  get(target, prop) {
    return getTokenService()[prop as keyof TokenService];
  }
});
