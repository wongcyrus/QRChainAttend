/**
 * Property-Based Tests for TokenService
 * Feature: qr-chain-attendance
 * Requirements: 3.2, 3.5, 3.7, 4.1, 6.5, 8.3, 8.4
 * 
 * These tests validate universal properties that should hold across all valid inputs
 * using property-based testing with fast-check.
 */

import * as fc from "fast-check";
import { TokenService } from "./TokenService";
import { TokenType, TokenStatus } from "../types";
import { getTableClient, TableName } from "../storage";
import { RestError } from "@azure/data-tables";

// Mock the storage module
jest.mock("../storage", () => ({
  getTableClient: jest.fn(),
  TableName: {
    TOKENS: "Tokens"
  }
}));

describe("TokenService - Property-Based Tests", () => {
  let tokenService: TokenService;
  let mockTableClient: any;

  beforeEach(() => {
    // Create mock table client
    mockTableClient = {
      createEntity: jest.fn(),
      getEntity: jest.fn(),
      updateEntity: jest.fn(),
      deleteEntity: jest.fn()
    };

    // Mock getTableClient to return our mock
    (getTableClient as jest.Mock).mockReturnValue(mockTableClient);

    // Create fresh service instance
    tokenService = new TokenService();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  /**
   * Property 12: Chain token TTL is 20 seconds
   * **Validates: Requirements 3.2**
   * 
   * For any chain token, its expiration time should be 20 seconds from creation.
   */
  describe("Property 12: Chain token TTL is 20 seconds", () => {
    it("should create chain tokens with exactly 20 second TTL", async () => {
      await fc.assert(
        fc.asyncProperty(
          // Generate arbitrary session IDs
          fc.uuid(),
          // Generate arbitrary chain IDs
          fc.uuid(),
          // Generate arbitrary student IDs
          fc.uuid(),
          // Generate arbitrary sequence numbers
          fc.integer({ min: 0, max: 1000 }),
          async (sessionId, chainId, studentId, seq) => {
            mockTableClient.createEntity.mockResolvedValue({
              etag: "W/\"datetime'2024-01-01T00%3A00%3A00.0000000Z'\""
            });

            const beforeCreate = Math.floor(Date.now() / 1000);
            
            const token = await tokenService.createToken({
              sessionId,
              type: TokenType.CHAIN,
              chainId,
              issuedTo: studentId,
              seq,
              ttlSeconds: 20,
              singleUse: true
            });

            const afterCreate = Math.floor(Date.now() / 1000);

            // Property: Chain token expiration must be 20 seconds from creation
            // Allow 1 second tolerance for test execution time
            expect(token.exp).toBeGreaterThanOrEqual(beforeCreate + 20);
            expect(token.exp).toBeLessThanOrEqual(afterCreate + 20);
            
            // Verify the token has correct type
            expect(token.type).toBe(TokenType.CHAIN);
          }
        ),
        { numRuns: 100 }
      );
    });

    it("should create exit chain tokens with exactly 20 second TTL", async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.uuid(),
          fc.uuid(),
          fc.uuid(),
          fc.integer({ min: 0, max: 1000 }),
          async (sessionId, chainId, studentId, seq) => {
            mockTableClient.createEntity.mockResolvedValue({
              etag: "W/\"datetime'2024-01-01T00%3A00%3A00.0000000Z'\""
            });

            const beforeCreate = Math.floor(Date.now() / 1000);
            
            const token = await tokenService.createToken({
              sessionId,
              type: TokenType.EXIT_CHAIN,
              chainId,
              issuedTo: studentId,
              seq,
              ttlSeconds: 20,
              singleUse: true
            });

            const afterCreate = Math.floor(Date.now() / 1000);

            // Property: Exit chain token expiration must be 20 seconds from creation
            expect(token.exp).toBeGreaterThanOrEqual(beforeCreate + 20);
            expect(token.exp).toBeLessThanOrEqual(afterCreate + 20);
            
            expect(token.type).toBe(TokenType.EXIT_CHAIN);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * Property 17: Single-use token enforcement
   * **Validates: Requirements 3.7, 4.4, 5.5, 6.6, 8.3, 8.4**
   * 
   * For any token, attempting to scan it a second time should fail due to ETag concurrency control.
   */
  describe("Property 17: Single-use token enforcement", () => {
    it("should prevent any token from being consumed twice", async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.uuid(),
          fc.constantFrom(
            TokenType.CHAIN,
            TokenType.LATE_ENTRY,
            TokenType.EARLY_LEAVE,
            TokenType.EXIT_CHAIN
          ),
          fc.integer({ min: 20, max: 120 }),
          async (sessionId, tokenType, ttlSeconds) => {
            const tokenId = "test-token-" + Math.random().toString(36).substring(7);
            const etag = "W/\"datetime'2024-01-01T00%3A00%3A00.0000000Z'\"";
            const now = Math.floor(Date.now() / 1000);

            const mockEntity = {
              partitionKey: sessionId,
              rowKey: tokenId,
              type: tokenType,
              exp: now + ttlSeconds,
              status: TokenStatus.ACTIVE,
              singleUse: true,
              createdAt: now,
              etag
            };

            // First consumption attempt - succeeds
            mockTableClient.getEntity.mockResolvedValueOnce(mockEntity);
            mockTableClient.updateEntity.mockResolvedValueOnce({
              etag: "W/\"datetime'2024-01-01T00%3A00%3A01.0000000Z'\""
            });

            const result1 = await tokenService.consumeToken(tokenId, sessionId, etag);

            // Property: First consumption must succeed
            expect(result1.success).toBe(true);
            expect(result1.token?.status).toBe(TokenStatus.USED);

            // Second consumption attempt - fails with ETag conflict
            mockTableClient.getEntity.mockResolvedValueOnce(mockEntity);
            const etagError = new RestError("Precondition Failed", {
              statusCode: 412,
              request: {} as any,
              response: {} as any
            });
            mockTableClient.updateEntity.mockRejectedValueOnce(etagError);

            const result2 = await tokenService.consumeToken(tokenId, sessionId, etag);

            // Property: Second consumption must fail with ALREADY_USED
            expect(result2.success).toBe(false);
            expect(result2.error).toBe("ALREADY_USED");
          }
        ),
        { numRuns: 100 }
      );
    });

    it("should enforce single-use for tokens already marked as USED", async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.uuid(),
          fc.constantFrom(
            TokenType.CHAIN,
            TokenType.LATE_ENTRY,
            TokenType.EARLY_LEAVE,
            TokenType.EXIT_CHAIN
          ),
          fc.integer({ min: 20, max: 120 }),
          async (sessionId, tokenType, ttlSeconds) => {
            const tokenId = "test-token-" + Math.random().toString(36).substring(7);
            const etag = "W/\"datetime'2024-01-01T00%3A00%3A00.0000000Z'\"";
            const now = Math.floor(Date.now() / 1000);

            // Token already marked as USED
            const mockEntity = {
              partitionKey: sessionId,
              rowKey: tokenId,
              type: tokenType,
              exp: now + ttlSeconds,
              status: TokenStatus.USED,
              singleUse: true,
              createdAt: now - 10,
              usedAt: now - 5,
              etag
            };

            mockTableClient.getEntity.mockResolvedValue(mockEntity);

            const result = await tokenService.consumeToken(tokenId, sessionId, etag);

            // Property: Attempting to consume already-used token must fail
            expect(result.success).toBe(false);
            expect(result.error).toBe("ALREADY_USED");
            
            // Should not attempt to update the entity
            expect(mockTableClient.updateEntity).not.toHaveBeenCalled();
          }
        ),
        { numRuns: 100 }
      );
    });

    it("should enforce single-use across concurrent consumption attempts", async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.uuid(),
          fc.constantFrom(
            TokenType.CHAIN,
            TokenType.LATE_ENTRY,
            TokenType.EARLY_LEAVE,
            TokenType.EXIT_CHAIN
          ),
          async (sessionId, tokenType) => {
            const tokenId = "test-token-" + Math.random().toString(36).substring(7);
            const etag = "W/\"datetime'2024-01-01T00%3A00%3A00.0000000Z'\"";
            const now = Math.floor(Date.now() / 1000);

            const mockEntity = {
              partitionKey: sessionId,
              rowKey: tokenId,
              type: tokenType,
              exp: now + 60,
              status: TokenStatus.ACTIVE,
              singleUse: true,
              createdAt: now,
              etag
            };

            // Simulate concurrent attempts
            // First attempt succeeds
            mockTableClient.getEntity.mockResolvedValueOnce(mockEntity);
            mockTableClient.updateEntity.mockResolvedValueOnce({
              etag: "W/\"datetime'2024-01-01T00%3A00%3A01.0000000Z'\""
            });

            // Second concurrent attempt gets ETag conflict
            mockTableClient.getEntity.mockResolvedValueOnce(mockEntity);
            const etagError = new RestError("Precondition Failed", {
              statusCode: 412,
              request: {} as any,
              response: {} as any
            });
            mockTableClient.updateEntity.mockRejectedValueOnce(etagError);

            // Third concurrent attempt also gets ETag conflict
            mockTableClient.getEntity.mockResolvedValueOnce(mockEntity);
            mockTableClient.updateEntity.mockRejectedValueOnce(etagError);

            const results = await Promise.all([
              tokenService.consumeToken(tokenId, sessionId, etag),
              tokenService.consumeToken(tokenId, sessionId, etag),
              tokenService.consumeToken(tokenId, sessionId, etag)
            ]);

            // Property: Exactly one consumption must succeed
            const successCount = results.filter(r => r.success).length;
            expect(successCount).toBe(1);

            // Property: All failed attempts must return ALREADY_USED
            const failedResults = results.filter(r => !r.success);
            failedResults.forEach(result => {
              expect(result.error).toBe("ALREADY_USED");
            });
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * Property 19: Late entry token TTL is 60 seconds
   * **Validates: Requirements 4.1**
   * 
   * For any late entry token, its expiration time should be 60 seconds from creation.
   */
  describe("Property 19: Late entry token TTL is 60 seconds", () => {
    it("should create late entry tokens with exactly 60 second TTL", async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.uuid(),
          async (sessionId) => {
            mockTableClient.createEntity.mockResolvedValue({
              etag: "W/\"datetime'2024-01-01T00%3A00%3A00.0000000Z'\""
            });

            const beforeCreate = Math.floor(Date.now() / 1000);
            
            const token = await tokenService.createToken({
              sessionId,
              type: TokenType.LATE_ENTRY,
              ttlSeconds: 60,
              singleUse: true
            });

            const afterCreate = Math.floor(Date.now() / 1000);

            // Property: Late entry token expiration must be 60 seconds from creation
            // Allow 1 second tolerance for test execution time
            expect(token.exp).toBeGreaterThanOrEqual(beforeCreate + 60);
            expect(token.exp).toBeLessThanOrEqual(afterCreate + 60);
            
            expect(token.type).toBe(TokenType.LATE_ENTRY);
          }
        ),
        { numRuns: 100 }
      );
    });

    it("should create early leave tokens with exactly 60 second TTL", async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.uuid(),
          async (sessionId) => {
            mockTableClient.createEntity.mockResolvedValue({
              etag: "W/\"datetime'2024-01-01T00%3A00%3A00.0000000Z'\""
            });

            const beforeCreate = Math.floor(Date.now() / 1000);
            
            const token = await tokenService.createToken({
              sessionId,
              type: TokenType.EARLY_LEAVE,
              ttlSeconds: 60,
              singleUse: true
            });

            const afterCreate = Math.floor(Date.now() / 1000);

            // Property: Early leave token expiration must be 60 seconds from creation
            expect(token.exp).toBeGreaterThanOrEqual(beforeCreate + 60);
            expect(token.exp).toBeLessThanOrEqual(afterCreate + 60);
            
            expect(token.type).toBe(TokenType.EARLY_LEAVE);
          }
        ),
        { numRuns: 100 }
      );
    });

    it("should respect the configured TTL for rotating tokens", async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.uuid(),
          fc.constantFrom(TokenType.LATE_ENTRY, TokenType.EARLY_LEAVE),
          fc.integer({ min: 30, max: 120 }), // Various TTL values
          async (sessionId, tokenType, ttlSeconds) => {
            mockTableClient.createEntity.mockResolvedValue({
              etag: "W/\"datetime'2024-01-01T00%3A00%3A00.0000000Z'\""
            });

            const beforeCreate = Math.floor(Date.now() / 1000);
            
            const token = await tokenService.createToken({
              sessionId,
              type: tokenType,
              ttlSeconds,
              singleUse: true
            });

            const afterCreate = Math.floor(Date.now() / 1000);

            // Property: Token expiration must match configured TTL
            expect(token.exp).toBeGreaterThanOrEqual(beforeCreate + ttlSeconds);
            expect(token.exp).toBeLessThanOrEqual(afterCreate + ttlSeconds);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * Property 31: Exit token expiration
   * **Validates: Requirements 6.5**
   * 
   * For any exit chain token, it should expire after 20 seconds and be marked as EXPIRED.
   */
  describe("Property 31: Exit token expiration", () => {
    it("should reject expired exit chain tokens", async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.uuid(),
          fc.uuid(),
          fc.uuid(),
          fc.integer({ min: 1, max: 100 }), // How many seconds past expiration
          async (sessionId, chainId, studentId, secondsPastExpiration) => {
            const tokenId = "test-token-" + Math.random().toString(36).substring(7);
            const etag = "W/\"datetime'2024-01-01T00%3A00%3A00.0000000Z'\"";
            const now = Math.floor(Date.now() / 1000);

            // Token expired in the past
            const mockEntity = {
              partitionKey: sessionId,
              rowKey: tokenId,
              type: TokenType.EXIT_CHAIN,
              chainId,
              issuedTo: studentId,
              exp: now - secondsPastExpiration, // Expired
              status: TokenStatus.ACTIVE,
              singleUse: true,
              createdAt: now - 20 - secondsPastExpiration,
              etag
            };

            mockTableClient.getEntity.mockResolvedValue(mockEntity);

            // Try to validate expired token
            const validationResult = await tokenService.validateToken(tokenId, sessionId);

            // Property: Expired exit chain token must be rejected
            expect(validationResult.valid).toBe(false);
            expect(validationResult.error).toBe("EXPIRED");

            // Try to consume expired token
            const consumeResult = await tokenService.consumeToken(tokenId, sessionId, etag);

            // Property: Expired token cannot be consumed
            expect(consumeResult.success).toBe(false);
            expect(consumeResult.error).toBe("EXPIRED");
            
            // Should not attempt to update expired token
            expect(mockTableClient.updateEntity).not.toHaveBeenCalled();
          }
        ),
        { numRuns: 100 }
      );
    });

    it("should reject tokens that expire at exact timestamp boundary", async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.uuid(),
          fc.constantFrom(
            TokenType.CHAIN,
            TokenType.EXIT_CHAIN,
            TokenType.LATE_ENTRY,
            TokenType.EARLY_LEAVE
          ),
          async (sessionId, tokenType) => {
            const tokenId = "test-token-" + Math.random().toString(36).substring(7);
            const etag = "W/\"datetime'2024-01-01T00%3A00%3A00.0000000Z'\"";
            const now = Math.floor(Date.now() / 1000);

            // Token expires exactly at current time
            const mockEntity = {
              partitionKey: sessionId,
              rowKey: tokenId,
              type: tokenType,
              exp: now, // Expires exactly now
              status: TokenStatus.ACTIVE,
              singleUse: true,
              createdAt: now - 20,
              etag
            };

            mockTableClient.getEntity.mockResolvedValue(mockEntity);

            const result = await tokenService.validateToken(tokenId, sessionId);

            // Property: Token expiring at exact timestamp must be invalid
            // Using <= comparison, so exp === now means expired
            expect(result.valid).toBe(false);
            expect(result.error).toBe("EXPIRED");
          }
        ),
        { numRuns: 100 }
      );
    });

    it("should accept tokens that have not yet expired", async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.uuid(),
          fc.constantFrom(
            TokenType.CHAIN,
            TokenType.EXIT_CHAIN,
            TokenType.LATE_ENTRY,
            TokenType.EARLY_LEAVE
          ),
          fc.integer({ min: 1, max: 120 }), // Seconds until expiration
          async (sessionId, tokenType, secondsUntilExpiration) => {
            const tokenId = "test-token-" + Math.random().toString(36).substring(7);
            const etag = "W/\"datetime'2024-01-01T00%3A00%3A00.0000000Z'\"";
            const now = Math.floor(Date.now() / 1000);

            // Token expires in the future
            const mockEntity = {
              partitionKey: sessionId,
              rowKey: tokenId,
              type: tokenType,
              exp: now + secondsUntilExpiration,
              status: TokenStatus.ACTIVE,
              singleUse: true,
              createdAt: now,
              etag
            };

            mockTableClient.getEntity.mockResolvedValue(mockEntity);

            const result = await tokenService.validateToken(tokenId, sessionId);

            // Property: Non-expired token must be valid
            expect(result.valid).toBe(true);
            expect(result.token).toBeDefined();
            expect(result.token?.status).toBe(TokenStatus.ACTIVE);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * Additional property: Token ID uniqueness
   * Ensures that generated token IDs are unique across multiple creations
   */
  describe("Additional Property: Token ID uniqueness", () => {
    it("should generate unique token IDs for all tokens", async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.uuid(),
          fc.integer({ min: 10, max: 50 }), // Number of tokens to create
          async (sessionId, tokenCount) => {
            mockTableClient.createEntity.mockResolvedValue({
              etag: "W/\"datetime'2024-01-01T00%3A00%3A00.0000000Z'\""
            });

            const tokens = await Promise.all(
              Array.from({ length: tokenCount }, () =>
                tokenService.createToken({
                  sessionId,
                  type: TokenType.CHAIN,
                  ttlSeconds: 20,
                  singleUse: true
                })
              )
            );

            const tokenIds = tokens.map(t => t.tokenId);
            const uniqueIds = new Set(tokenIds);

            // Property: All token IDs must be unique
            expect(uniqueIds.size).toBe(tokenCount);
          }
        ),
        { numRuns: 50 } // Reduced runs since this creates many tokens
      );
    });
  });

  /**
   * Additional property: Token status transitions
   * Ensures tokens follow valid state transitions
   */
  describe("Additional Property: Token status transitions", () => {
    it("should transition from ACTIVE to USED when consumed", async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.uuid(),
          fc.constantFrom(
            TokenType.CHAIN,
            TokenType.LATE_ENTRY,
            TokenType.EARLY_LEAVE,
            TokenType.EXIT_CHAIN
          ),
          async (sessionId, tokenType) => {
            const tokenId = "test-token-" + Math.random().toString(36).substring(7);
            const etag = "W/\"datetime'2024-01-01T00%3A00%3A00.0000000Z'\"";
            const now = Math.floor(Date.now() / 1000);

            const mockEntity = {
              partitionKey: sessionId,
              rowKey: tokenId,
              type: tokenType,
              exp: now + 60,
              status: TokenStatus.ACTIVE,
              singleUse: true,
              createdAt: now,
              etag
            };

            mockTableClient.getEntity.mockResolvedValue(mockEntity);
            mockTableClient.updateEntity.mockResolvedValue({
              etag: "W/\"datetime'2024-01-01T00%3A00%3A01.0000000Z'\""
            });

            const result = await tokenService.consumeToken(tokenId, sessionId, etag);

            // Property: Successful consumption must transition status to USED
            expect(result.success).toBe(true);
            expect(result.token?.status).toBe(TokenStatus.USED);
            
            // Verify the update was called with USED status
            const updateCall = mockTableClient.updateEntity.mock.calls[0];
            expect(updateCall[0].status).toBe(TokenStatus.USED);
            expect(updateCall[0].usedAt).toBeDefined();
          }
        ),
        { numRuns: 100 }
      );
    });

    it("should transition from ACTIVE to REVOKED when revoked", async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.uuid(),
          fc.constantFrom(
            TokenType.CHAIN,
            TokenType.LATE_ENTRY,
            TokenType.EARLY_LEAVE,
            TokenType.EXIT_CHAIN
          ),
          async (sessionId, tokenType) => {
            const tokenId = "test-token-" + Math.random().toString(36).substring(7);
            const now = Math.floor(Date.now() / 1000);

            const mockEntity = {
              partitionKey: sessionId,
              rowKey: tokenId,
              type: tokenType,
              exp: now + 60,
              status: TokenStatus.ACTIVE,
              singleUse: true,
              createdAt: now,
              etag: "W/\"datetime'2024-01-01T00%3A00%3A00.0000000Z'\""
            };

            mockTableClient.getEntity.mockResolvedValue(mockEntity);
            mockTableClient.updateEntity.mockResolvedValue({
              etag: "W/\"datetime'2024-01-01T00%3A00%3A01.0000000Z'\""
            });

            await tokenService.revokeToken(tokenId, sessionId);

            // Property: Revocation must update status to REVOKED
            const updateCall = mockTableClient.updateEntity.mock.calls[0];
            expect(updateCall[0].status).toBe(TokenStatus.REVOKED);
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
