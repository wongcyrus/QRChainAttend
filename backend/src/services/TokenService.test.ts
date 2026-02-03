/**
 * Token Service Unit Tests
 * Feature: qr-chain-attendance
 * Requirements: 3.2, 3.5, 3.7, 4.1, 5.1, 6.5, 8.1, 8.2, 8.3, 8.4, 8.5
 */

import { TokenService } from "./TokenService";
import { TokenType, TokenStatus } from "../types";
import { getTableClient } from "../storage";
import { RestError } from "@azure/data-tables";

// Mock the storage module
jest.mock("../storage", () => ({
  getTableClient: jest.fn(),
  TableName: {
    TOKENS: "Tokens"
  }
}));

describe("TokenService", () => {
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

  describe("createToken", () => {
    it("should create a token with cryptographically random tokenId", async () => {
      const sessionId = "session-123";
      const ttlSeconds = 20;

      mockTableClient.createEntity.mockResolvedValue({
        etag: "W/\"datetime'2024-01-01T00%3A00%3A00.0000000Z'\""
      });

      const token = await tokenService.createToken({
        sessionId,
        type: TokenType.CHAIN,
        ttlSeconds,
        singleUse: true
      });

      // Verify token properties
      expect(token.tokenId).toBeDefined();
      expect(token.tokenId.length).toBeGreaterThan(40); // 32 bytes base64url encoded
      expect(token.sessionId).toBe(sessionId);
      expect(token.type).toBe(TokenType.CHAIN);
      expect(token.status).toBe(TokenStatus.ACTIVE);
      expect(token.singleUse).toBe(true);
      expect(token.etag).toBeDefined();

      // Verify expiration is approximately ttlSeconds from now
      const now = Math.floor(Date.now() / 1000);
      expect(token.exp).toBeGreaterThanOrEqual(now + ttlSeconds - 1);
      expect(token.exp).toBeLessThanOrEqual(now + ttlSeconds + 1);

      // Verify createEntity was called
      expect(mockTableClient.createEntity).toHaveBeenCalledTimes(1);
      const entityArg = mockTableClient.createEntity.mock.calls[0][0];
      expect(entityArg.partitionKey).toBe(sessionId);
      expect(entityArg.rowKey).toBe(token.tokenId);
      expect(entityArg.status).toBe(TokenStatus.ACTIVE);
    });

    it("should create chain token with chainId, issuedTo, and seq", async () => {
      const params = {
        sessionId: "session-123",
        type: TokenType.CHAIN,
        chainId: "chain-1",
        issuedTo: "student-456",
        seq: 5,
        ttlSeconds: 20,
        singleUse: true
      };

      mockTableClient.createEntity.mockResolvedValue({
        etag: "W/\"datetime'2024-01-01T00%3A00%3A00.0000000Z'\""
      });

      const token = await tokenService.createToken(params);

      expect(token.chainId).toBe("chain-1");
      expect(token.issuedTo).toBe("student-456");
      expect(token.seq).toBe(5);

      const entityArg = mockTableClient.createEntity.mock.calls[0][0];
      expect(entityArg.chainId).toBe("chain-1");
      expect(entityArg.issuedTo).toBe("student-456");
      expect(entityArg.seq).toBe(5);
    });

    it("should create late entry token with 60 second TTL", async () => {
      mockTableClient.createEntity.mockResolvedValue({
        etag: "W/\"datetime'2024-01-01T00%3A00%3A00.0000000Z'\""
      });

      const token = await tokenService.createToken({
        sessionId: "session-123",
        type: TokenType.LATE_ENTRY,
        ttlSeconds: 60,
        singleUse: true
      });

      const now = Math.floor(Date.now() / 1000);
      expect(token.exp).toBeGreaterThanOrEqual(now + 59);
      expect(token.exp).toBeLessThanOrEqual(now + 61);
      expect(token.type).toBe(TokenType.LATE_ENTRY);
    });

    it("should generate unique tokenIds for multiple tokens", async () => {
      mockTableClient.createEntity.mockResolvedValue({
        etag: "W/\"datetime'2024-01-01T00%3A00%3A00.0000000Z'\""
      });

      const tokens = await Promise.all([
        tokenService.createToken({
          sessionId: "session-123",
          type: TokenType.CHAIN,
          ttlSeconds: 20,
          singleUse: true
        }),
        tokenService.createToken({
          sessionId: "session-123",
          type: TokenType.CHAIN,
          ttlSeconds: 20,
          singleUse: true
        }),
        tokenService.createToken({
          sessionId: "session-123",
          type: TokenType.CHAIN,
          ttlSeconds: 20,
          singleUse: true
        })
      ]);

      // All tokenIds should be unique
      const tokenIds = tokens.map(t => t.tokenId);
      const uniqueIds = new Set(tokenIds);
      expect(uniqueIds.size).toBe(3);
    });
  });

  describe("getToken", () => {
    it("should return token when it exists", async () => {
      const sessionId = "session-123";
      const tokenId = "token-456";
      const now = Math.floor(Date.now() / 1000);

      mockTableClient.getEntity.mockResolvedValue({
        partitionKey: sessionId,
        rowKey: tokenId,
        type: TokenType.LATE_ENTRY,
        exp: now + 60,
        status: TokenStatus.ACTIVE,
        singleUse: true,
        createdAt: now,
        etag: "etag-123"
      });

      const token = await tokenService.getToken(tokenId, sessionId);

      expect(token).not.toBeNull();
      expect(token?.tokenId).toBe(tokenId);
      expect(token?.sessionId).toBe(sessionId);
      expect(token?.type).toBe(TokenType.LATE_ENTRY);
      expect(token?.status).toBe(TokenStatus.ACTIVE);
      expect(token?.etag).toBe("etag-123");
      expect(mockTableClient.getEntity).toHaveBeenCalledWith(sessionId, tokenId);
    });

    it("should return null when token does not exist", async () => {
      const sessionId = "session-123";
      const tokenId = "nonexistent-token";

      mockTableClient.getEntity.mockRejectedValue({
        statusCode: 404,
        message: "Not Found"
      });

      const token = await tokenService.getToken(tokenId, sessionId);

      expect(token).toBeNull();
      expect(mockTableClient.getEntity).toHaveBeenCalledWith(sessionId, tokenId);
    });

    it("should throw error for non-404 errors", async () => {
      const sessionId = "session-123";
      const tokenId = "token-456";

      mockTableClient.getEntity.mockRejectedValue({
        statusCode: 500,
        message: "Internal Server Error"
      });

      await expect(tokenService.getToken(tokenId, sessionId)).rejects.toEqual({
        statusCode: 500,
        message: "Internal Server Error"
      });
    });
  });

  describe("validateToken", () => {
    it("should return valid for active non-expired token", async () => {
      const tokenId = "token-123";
      const sessionId = "session-123";
      const now = Math.floor(Date.now() / 1000);

      mockTableClient.getEntity.mockResolvedValue({
        partitionKey: sessionId,
        rowKey: tokenId,
        type: TokenType.CHAIN,
        exp: now + 10, // Expires in 10 seconds
        status: TokenStatus.ACTIVE,
        singleUse: true,
        createdAt: now - 10,
        etag: "W/\"datetime'2024-01-01T00%3A00%3A00.0000000Z'\""
      });

      const result = await tokenService.validateToken(tokenId, sessionId);

      expect(result.valid).toBe(true);
      expect(result.token).toBeDefined();
      expect(result.token?.tokenId).toBe(tokenId);
      expect(result.token?.status).toBe(TokenStatus.ACTIVE);
      expect(result.error).toBeUndefined();
    });

    it("should return EXPIRED for expired token", async () => {
      const tokenId = "token-123";
      const sessionId = "session-123";
      const now = Math.floor(Date.now() / 1000);

      mockTableClient.getEntity.mockResolvedValue({
        partitionKey: sessionId,
        rowKey: tokenId,
        type: TokenType.CHAIN,
        exp: now - 10, // Expired 10 seconds ago
        status: TokenStatus.ACTIVE,
        singleUse: true,
        createdAt: now - 30,
        etag: "W/\"datetime'2024-01-01T00%3A00%3A00.0000000Z'\""
      });

      const result = await tokenService.validateToken(tokenId, sessionId);

      expect(result.valid).toBe(false);
      expect(result.error).toBe("EXPIRED");
      expect(result.token).toBeUndefined();
    });

    it("should return USED for already used token", async () => {
      const tokenId = "token-123";
      const sessionId = "session-123";
      const now = Math.floor(Date.now() / 1000);

      mockTableClient.getEntity.mockResolvedValue({
        partitionKey: sessionId,
        rowKey: tokenId,
        type: TokenType.CHAIN,
        exp: now + 10,
        status: TokenStatus.USED,
        singleUse: true,
        createdAt: now - 10,
        usedAt: now - 5,
        etag: "W/\"datetime'2024-01-01T00%3A00%3A00.0000000Z'\""
      });

      const result = await tokenService.validateToken(tokenId, sessionId);

      expect(result.valid).toBe(false);
      expect(result.error).toBe("USED");
    });

    it("should return REVOKED for revoked token", async () => {
      const tokenId = "token-123";
      const sessionId = "session-123";
      const now = Math.floor(Date.now() / 1000);

      mockTableClient.getEntity.mockResolvedValue({
        partitionKey: sessionId,
        rowKey: tokenId,
        type: TokenType.CHAIN,
        exp: now + 10,
        status: TokenStatus.REVOKED,
        singleUse: true,
        createdAt: now - 10,
        etag: "W/\"datetime'2024-01-01T00%3A00%3A00.0000000Z'\""
      });

      const result = await tokenService.validateToken(tokenId, sessionId);

      expect(result.valid).toBe(false);
      expect(result.error).toBe("REVOKED");
    });

    it("should return NOT_FOUND for non-existent token", async () => {
      const tokenId = "token-123";
      const sessionId = "session-123";

      mockTableClient.getEntity.mockRejectedValue({
        statusCode: 404,
        message: "Not Found"
      });

      const result = await tokenService.validateToken(tokenId, sessionId);

      expect(result.valid).toBe(false);
      expect(result.error).toBe("NOT_FOUND");
    });
  });

  describe("consumeToken", () => {
    it("should successfully consume valid token with correct ETag", async () => {
      const tokenId = "token-123";
      const sessionId = "session-123";
      const etag = "W/\"datetime'2024-01-01T00%3A00%3A00.0000000Z'\"";
      const now = Math.floor(Date.now() / 1000);

      const mockEntity = {
        partitionKey: sessionId,
        rowKey: tokenId,
        type: TokenType.CHAIN,
        exp: now + 10,
        status: TokenStatus.ACTIVE,
        singleUse: true,
        createdAt: now - 10,
        etag
      };

      mockTableClient.getEntity.mockResolvedValue(mockEntity);
      mockTableClient.updateEntity.mockResolvedValue({
        etag: "W/\"datetime'2024-01-01T00%3A00%3A01.0000000Z'\""
      });

      const result = await tokenService.consumeToken(tokenId, sessionId, etag);

      expect(result.success).toBe(true);
      expect(result.token).toBeDefined();
      expect(result.token?.status).toBe(TokenStatus.USED);
      expect(result.error).toBeUndefined();

      // Verify updateEntity was called with correct parameters
      expect(mockTableClient.updateEntity).toHaveBeenCalledTimes(1);
      const updateArgs = mockTableClient.updateEntity.mock.calls[0];
      expect(updateArgs[0].status).toBe(TokenStatus.USED);
      expect(updateArgs[0].usedAt).toBeDefined();
      expect(updateArgs[2]).toEqual({ etag });
    });

    it("should return ALREADY_USED on ETag mismatch (412 error)", async () => {
      const tokenId = "token-123";
      const sessionId = "session-123";
      const etag = "W/\"datetime'2024-01-01T00%3A00%3A00.0000000Z'\"";
      const now = Math.floor(Date.now() / 1000);

      mockTableClient.getEntity.mockResolvedValue({
        partitionKey: sessionId,
        rowKey: tokenId,
        type: TokenType.CHAIN,
        exp: now + 10,
        status: TokenStatus.ACTIVE,
        singleUse: true,
        createdAt: now - 10,
        etag
      });

      // Simulate ETag conflict (precondition failed)
      const etagError = new RestError("Precondition Failed", {
        statusCode: 412,
        request: {} as any,
        response: {} as any
      });
      mockTableClient.updateEntity.mockRejectedValue(etagError);

      const result = await tokenService.consumeToken(tokenId, sessionId, etag);

      expect(result.success).toBe(false);
      expect(result.error).toBe("ALREADY_USED");
      expect(result.token).toBeUndefined();
    });

    it("should return EXPIRED for expired token", async () => {
      const tokenId = "token-123";
      const sessionId = "session-123";
      const etag = "W/\"datetime'2024-01-01T00%3A00%3A00.0000000Z'\"";
      const now = Math.floor(Date.now() / 1000);

      mockTableClient.getEntity.mockResolvedValue({
        partitionKey: sessionId,
        rowKey: tokenId,
        type: TokenType.CHAIN,
        exp: now - 10, // Expired
        status: TokenStatus.ACTIVE,
        singleUse: true,
        createdAt: now - 30,
        etag
      });

      const result = await tokenService.consumeToken(tokenId, sessionId, etag);

      expect(result.success).toBe(false);
      expect(result.error).toBe("EXPIRED");
      // Should not attempt to update
      expect(mockTableClient.updateEntity).not.toHaveBeenCalled();
    });

    it("should return ALREADY_USED for already used token", async () => {
      const tokenId = "token-123";
      const sessionId = "session-123";
      const etag = "W/\"datetime'2024-01-01T00%3A00%3A00.0000000Z'\"";
      const now = Math.floor(Date.now() / 1000);

      mockTableClient.getEntity.mockResolvedValue({
        partitionKey: sessionId,
        rowKey: tokenId,
        type: TokenType.CHAIN,
        exp: now + 10,
        status: TokenStatus.USED,
        singleUse: true,
        createdAt: now - 10,
        usedAt: now - 5,
        etag
      });

      const result = await tokenService.consumeToken(tokenId, sessionId, etag);

      expect(result.success).toBe(false);
      expect(result.error).toBe("ALREADY_USED");
      expect(mockTableClient.updateEntity).not.toHaveBeenCalled();
    });

    it("should return REVOKED for revoked token", async () => {
      const tokenId = "token-123";
      const sessionId = "session-123";
      const etag = "W/\"datetime'2024-01-01T00%3A00%3A00.0000000Z'\"";
      const now = Math.floor(Date.now() / 1000);

      mockTableClient.getEntity.mockResolvedValue({
        partitionKey: sessionId,
        rowKey: tokenId,
        type: TokenType.CHAIN,
        exp: now + 10,
        status: TokenStatus.REVOKED,
        singleUse: true,
        createdAt: now - 10,
        etag
      });

      const result = await tokenService.consumeToken(tokenId, sessionId, etag);

      expect(result.success).toBe(false);
      expect(result.error).toBe("REVOKED");
      expect(mockTableClient.updateEntity).not.toHaveBeenCalled();
    });

    it("should return NOT_FOUND for non-existent token", async () => {
      const tokenId = "token-123";
      const sessionId = "session-123";
      const etag = "W/\"datetime'2024-01-01T00%3A00%3A00.0000000Z'\"";

      mockTableClient.getEntity.mockRejectedValue({
        statusCode: 404,
        message: "Not Found"
      });

      const result = await tokenService.consumeToken(tokenId, sessionId, etag);

      expect(result.success).toBe(false);
      expect(result.error).toBe("NOT_FOUND");
    });
  });

  describe("revokeToken", () => {
    it("should revoke an active token", async () => {
      const tokenId = "token-123";
      const sessionId = "session-123";
      const now = Math.floor(Date.now() / 1000);

      mockTableClient.getEntity.mockResolvedValue({
        partitionKey: sessionId,
        rowKey: tokenId,
        type: TokenType.CHAIN,
        exp: now + 10,
        status: TokenStatus.ACTIVE,
        singleUse: true,
        createdAt: now - 10,
        etag: "W/\"datetime'2024-01-01T00%3A00%3A00.0000000Z'\""
      });

      mockTableClient.updateEntity.mockResolvedValue({
        etag: "W/\"datetime'2024-01-01T00%3A00%3A01.0000000Z'\""
      });

      await tokenService.revokeToken(tokenId, sessionId);

      expect(mockTableClient.updateEntity).toHaveBeenCalledTimes(1);
      const updateArgs = mockTableClient.updateEntity.mock.calls[0];
      expect(updateArgs[0].status).toBe(TokenStatus.REVOKED);
    });

    it("should handle non-existent token gracefully", async () => {
      const tokenId = "token-123";
      const sessionId = "session-123";

      mockTableClient.getEntity.mockRejectedValue({
        statusCode: 404,
        message: "Not Found"
      });

      // Should not throw
      await expect(tokenService.revokeToken(tokenId, sessionId)).resolves.toBeUndefined();
      expect(mockTableClient.updateEntity).not.toHaveBeenCalled();
    });

    it("should revoke already used token", async () => {
      const tokenId = "token-123";
      const sessionId = "session-123";
      const now = Math.floor(Date.now() / 1000);

      mockTableClient.getEntity.mockResolvedValue({
        partitionKey: sessionId,
        rowKey: tokenId,
        type: TokenType.CHAIN,
        exp: now + 10,
        status: TokenStatus.USED,
        singleUse: true,
        createdAt: now - 10,
        usedAt: now - 5,
        etag: "W/\"datetime'2024-01-01T00%3A00%3A00.0000000Z'\""
      });

      mockTableClient.updateEntity.mockResolvedValue({
        etag: "W/\"datetime'2024-01-01T00%3A00%3A01.0000000Z'\""
      });

      await tokenService.revokeToken(tokenId, sessionId);

      expect(mockTableClient.updateEntity).toHaveBeenCalledTimes(1);
      const updateArgs = mockTableClient.updateEntity.mock.calls[0];
      expect(updateArgs[0].status).toBe(TokenStatus.REVOKED);
    });
  });

  describe("Edge Cases", () => {
    describe("Token expiration at exact timestamp", () => {
      it("should handle token expiring at exact timestamp in validateToken", async () => {
        const tokenId = "token-123";
        const sessionId = "session-123";
        const now = Math.floor(Date.now() / 1000);

        mockTableClient.getEntity.mockResolvedValue({
          partitionKey: sessionId,
          rowKey: tokenId,
          type: TokenType.CHAIN,
          exp: now, // Expires exactly now
          status: TokenStatus.ACTIVE,
          singleUse: true,
          createdAt: now - 20,
          etag: "W/\"datetime'2024-01-01T00%3A00%3A00.0000000Z'\""
        });

        const result = await tokenService.validateToken(tokenId, sessionId);

        // Token expired at exact timestamp should be invalid (exp <= now)
        expect(result.valid).toBe(false);
        expect(result.error).toBe("EXPIRED");
      });

      it("should handle token expiring at exact timestamp in consumeToken", async () => {
        const tokenId = "token-123";
        const sessionId = "session-123";
        const etag = "W/\"datetime'2024-01-01T00%3A00%3A00.0000000Z'\"";
        const now = Math.floor(Date.now() / 1000);

        mockTableClient.getEntity.mockResolvedValue({
          partitionKey: sessionId,
          rowKey: tokenId,
          type: TokenType.CHAIN,
          exp: now, // Expires exactly now
          status: TokenStatus.ACTIVE,
          singleUse: true,
          createdAt: now - 20,
          etag
        });

        const result = await tokenService.consumeToken(tokenId, sessionId, etag);

        // Token expired at exact timestamp should not be consumable
        expect(result.success).toBe(false);
        expect(result.error).toBe("EXPIRED");
        // Should not attempt to update the token
        expect(mockTableClient.updateEntity).not.toHaveBeenCalled();
      });

      it("should accept token that expires 1 second in the future", async () => {
        const tokenId = "token-123";
        const sessionId = "session-123";
        const now = Math.floor(Date.now() / 1000);

        mockTableClient.getEntity.mockResolvedValue({
          partitionKey: sessionId,
          rowKey: tokenId,
          type: TokenType.CHAIN,
          exp: now + 1, // Expires in 1 second
          status: TokenStatus.ACTIVE,
          singleUse: true,
          createdAt: now - 19,
          etag: "W/\"datetime'2024-01-01T00%3A00%3A00.0000000Z'\""
        });

        const result = await tokenService.validateToken(tokenId, sessionId);

        // Token should still be valid
        expect(result.valid).toBe(true);
        expect(result.token).toBeDefined();
      });
    });

    describe("ETag conflict error handling", () => {
      it("should return ALREADY_USED on ETag mismatch (412 error)", async () => {
        const tokenId = "token-123";
        const sessionId = "session-123";
        const etag = "W/\"datetime'2024-01-01T00%3A00%3A00.0000000Z'\"";
        const now = Math.floor(Date.now() / 1000);

        mockTableClient.getEntity.mockResolvedValue({
          partitionKey: sessionId,
          rowKey: tokenId,
          type: TokenType.CHAIN,
          exp: now + 10,
          status: TokenStatus.ACTIVE,
          singleUse: true,
          createdAt: now - 10,
          etag
        });

        // Simulate ETag conflict (precondition failed)
        const etagError = new RestError("Precondition Failed", {
          statusCode: 412,
          request: {} as any,
          response: {} as any
        });
        mockTableClient.updateEntity.mockRejectedValue(etagError);

        const result = await tokenService.consumeToken(tokenId, sessionId, etag);

        expect(result.success).toBe(false);
        expect(result.error).toBe("ALREADY_USED");
        expect(result.token).toBeUndefined();
      });

      it("should handle ETag conflict with different etag values", async () => {
        const tokenId = "token-123";
        const sessionId = "session-123";
        const oldEtag = "W/\"datetime'2024-01-01T00%3A00%3A00.0000000Z'\"";
        const newEtag = "W/\"datetime'2024-01-01T00%3A00%3A01.0000000Z'\"";
        const now = Math.floor(Date.now() / 1000);

        // Token was already updated (has new etag)
        mockTableClient.getEntity.mockResolvedValue({
          partitionKey: sessionId,
          rowKey: tokenId,
          type: TokenType.CHAIN,
          exp: now + 10,
          status: TokenStatus.ACTIVE,
          singleUse: true,
          createdAt: now - 10,
          etag: newEtag // Different from what we're trying to use
        });

        // Attempt to consume with old etag
        const etagError = new RestError("Precondition Failed", {
          statusCode: 412,
          request: {} as any,
          response: {} as any
        });
        mockTableClient.updateEntity.mockRejectedValue(etagError);

        const result = await tokenService.consumeToken(tokenId, sessionId, oldEtag);

        expect(result.success).toBe(false);
        expect(result.error).toBe("ALREADY_USED");
      });

      it("should verify ETag is passed to updateEntity", async () => {
        const tokenId = "token-123";
        const sessionId = "session-123";
        const etag = "W/\"datetime'2024-01-01T00%3A00%3A00.0000000Z'\"";
        const now = Math.floor(Date.now() / 1000);

        mockTableClient.getEntity.mockResolvedValue({
          partitionKey: sessionId,
          rowKey: tokenId,
          type: TokenType.CHAIN,
          exp: now + 10,
          status: TokenStatus.ACTIVE,
          singleUse: true,
          createdAt: now - 10,
          etag
        });

        mockTableClient.updateEntity.mockResolvedValue({
          etag: "W/\"datetime'2024-01-01T00%3A00%3A01.0000000Z'\""
        });

        await tokenService.consumeToken(tokenId, sessionId, etag);

        // Verify the etag was passed in the options
        expect(mockTableClient.updateEntity).toHaveBeenCalledWith(
          expect.objectContaining({
            status: TokenStatus.USED
          }),
          "Replace",
          { etag }
        );
      });
    });

    describe("Concurrent token consumption", () => {
      it("should handle concurrent token consumption attempts", async () => {
        const tokenId = "token-123";
        const sessionId = "session-123";
        const etag = "W/\"datetime'2024-01-01T00%3A00%3A00.0000000Z'\"";
        const now = Math.floor(Date.now() / 1000);

        const mockEntity = {
          partitionKey: sessionId,
          rowKey: tokenId,
          type: TokenType.CHAIN,
          exp: now + 10,
          status: TokenStatus.ACTIVE,
          singleUse: true,
          createdAt: now - 10,
          etag
        };

        // First call succeeds
        mockTableClient.getEntity.mockResolvedValueOnce(mockEntity);
        mockTableClient.updateEntity.mockResolvedValueOnce({
          etag: "W/\"datetime'2024-01-01T00%3A00%3A01.0000000Z'\""
        });

        // Second call gets ETag conflict
        mockTableClient.getEntity.mockResolvedValueOnce(mockEntity);
        const etagError = new RestError("Precondition Failed", {
          statusCode: 412,
          request: {} as any,
          response: {} as any
        });
        mockTableClient.updateEntity.mockRejectedValueOnce(etagError);

        const result1 = await tokenService.consumeToken(tokenId, sessionId, etag);
        const result2 = await tokenService.consumeToken(tokenId, sessionId, etag);

        expect(result1.success).toBe(true);
        expect(result2.success).toBe(false);
        expect(result2.error).toBe("ALREADY_USED");
      });

      it("should handle multiple concurrent attempts with same etag", async () => {
        const tokenId = "token-123";
        const sessionId = "session-123";
        const etag = "W/\"datetime'2024-01-01T00%3A00%3A00.0000000Z'\"";
        const now = Math.floor(Date.now() / 1000);

        const mockEntity = {
          partitionKey: sessionId,
          rowKey: tokenId,
          type: TokenType.CHAIN,
          exp: now + 10,
          status: TokenStatus.ACTIVE,
          singleUse: true,
          createdAt: now - 10,
          etag
        };

        // First call succeeds
        mockTableClient.getEntity.mockResolvedValueOnce(mockEntity);
        mockTableClient.updateEntity.mockResolvedValueOnce({
          etag: "W/\"datetime'2024-01-01T00%3A00%3A01.0000000Z'\""
        });

        // All subsequent calls fail with ETag conflict
        const etagError = new RestError("Precondition Failed", {
          statusCode: 412,
          request: {} as any,
          response: {} as any
        });

        for (let i = 0; i < 3; i++) {
          mockTableClient.getEntity.mockResolvedValueOnce(mockEntity);
          mockTableClient.updateEntity.mockRejectedValueOnce(etagError);
        }

        // Simulate 4 concurrent requests
        const results = await Promise.all([
          tokenService.consumeToken(tokenId, sessionId, etag),
          tokenService.consumeToken(tokenId, sessionId, etag),
          tokenService.consumeToken(tokenId, sessionId, etag),
          tokenService.consumeToken(tokenId, sessionId, etag)
        ]);

        // Only one should succeed
        const successCount = results.filter(r => r.success).length;
        const failureCount = results.filter(r => !r.success && r.error === "ALREADY_USED").length;

        expect(successCount).toBe(1);
        expect(failureCount).toBe(3);
      });

      it("should prevent double consumption even with status check race", async () => {
        const tokenId = "token-123";
        const sessionId = "session-123";
        const etag = "W/\"datetime'2024-01-01T00%3A00%3A00.0000000Z'\"";
        const now = Math.floor(Date.now() / 1000);

        const activeEntity = {
          partitionKey: sessionId,
          rowKey: tokenId,
          type: TokenType.CHAIN,
          exp: now + 10,
          status: TokenStatus.ACTIVE,
          singleUse: true,
          createdAt: now - 10,
          etag
        };

        // Both requests see ACTIVE status initially
        mockTableClient.getEntity.mockResolvedValueOnce(activeEntity);
        mockTableClient.getEntity.mockResolvedValueOnce(activeEntity);

        // First update succeeds
        mockTableClient.updateEntity.mockResolvedValueOnce({
          etag: "W/\"datetime'2024-01-01T00%3A00%3A01.0000000Z'\""
        });

        // Second update fails due to ETag mismatch
        const etagError = new RestError("Precondition Failed", {
          statusCode: 412,
          request: {} as any,
          response: {} as any
        });
        mockTableClient.updateEntity.mockRejectedValueOnce(etagError);

        // Simulate race condition where both requests check status before either updates
        const [result1, result2] = await Promise.all([
          tokenService.consumeToken(tokenId, sessionId, etag),
          tokenService.consumeToken(tokenId, sessionId, etag)
        ]);

        // One succeeds, one fails
        const results = [result1, result2];
        const successCount = results.filter(r => r.success).length;
        const failureCount = results.filter(r => !r.success && r.error === "ALREADY_USED").length;

        expect(successCount).toBe(1);
        expect(failureCount).toBe(1);
      });
    });

    describe("Additional edge cases for Requirements 3.5, 3.7, 16.5", () => {
      it("should handle token that expires during consumption attempt", async () => {
        const tokenId = "token-123";
        const sessionId = "session-123";
        const etag = "W/\"datetime'2024-01-01T00%3A00%3A00.0000000Z'\"";
        const now = Math.floor(Date.now() / 1000);

        // Token expires in 1 second when retrieved
        mockTableClient.getEntity.mockResolvedValue({
          partitionKey: sessionId,
          rowKey: tokenId,
          type: TokenType.CHAIN,
          exp: now + 1,
          status: TokenStatus.ACTIVE,
          singleUse: true,
          createdAt: now - 19,
          etag
        });

        mockTableClient.updateEntity.mockResolvedValue({
          etag: "W/\"datetime'2024-01-01T00%3A00%3A01.0000000Z'\""
        });

        // Simulate time passing - token should still be valid when checked
        const result = await tokenService.consumeToken(tokenId, sessionId, etag);

        // Should succeed if checked before expiration
        expect(result.success).toBe(true);
      });

      it("should handle storage errors other than 404 and 412", async () => {
        const tokenId = "token-123";
        const sessionId = "session-123";
        const etag = "W/\"datetime'2024-01-01T00%3A00%3A00.0000000Z'\"";
        const now = Math.floor(Date.now() / 1000);

        mockTableClient.getEntity.mockResolvedValue({
          partitionKey: sessionId,
          rowKey: tokenId,
          type: TokenType.CHAIN,
          exp: now + 10,
          status: TokenStatus.ACTIVE,
          singleUse: true,
          createdAt: now - 10,
          etag
        });

        // Simulate a 500 internal server error
        const serverError = new RestError("Internal Server Error", {
          statusCode: 500,
          request: {} as any,
          response: {} as any
        });
        mockTableClient.updateEntity.mockRejectedValue(serverError);

        // Should throw the error (not catch it)
        await expect(
          tokenService.consumeToken(tokenId, sessionId, etag)
        ).rejects.toThrow("Internal Server Error");
      });

      it("should handle token with very long TTL", async () => {
        const sessionId = "session-123";
        const ttlSeconds = 86400; // 24 hours

        mockTableClient.createEntity.mockResolvedValue({
          etag: "W/\"datetime'2024-01-01T00%3A00%3A00.0000000Z'\""
        });

        const token = await tokenService.createToken({
          sessionId,
          type: TokenType.SESSION,
          ttlSeconds,
          singleUse: false
        });

        const now = Math.floor(Date.now() / 1000);
        expect(token.exp).toBeGreaterThanOrEqual(now + ttlSeconds - 1);
        expect(token.exp).toBeLessThanOrEqual(now + ttlSeconds + 1);
      });

      it("should handle token with minimum TTL (1 second)", async () => {
        const sessionId = "session-123";
        const ttlSeconds = 1;

        mockTableClient.createEntity.mockResolvedValue({
          etag: "W/\"datetime'2024-01-01T00%3A00%3A00.0000000Z'\""
        });

        const token = await tokenService.createToken({
          sessionId,
          type: TokenType.CHAIN,
          ttlSeconds,
          singleUse: true
        });

        const now = Math.floor(Date.now() / 1000);
        expect(token.exp).toBeGreaterThanOrEqual(now);
        expect(token.exp).toBeLessThanOrEqual(now + 2);
      });

      it("should not consume token if status is USED even with valid etag", async () => {
        const tokenId = "token-123";
        const sessionId = "session-123";
        const etag = "W/\"datetime'2024-01-01T00%3A00%3A00.0000000Z'\"";
        const now = Math.floor(Date.now() / 1000);

        // Token is already USED
        mockTableClient.getEntity.mockResolvedValue({
          partitionKey: sessionId,
          rowKey: tokenId,
          type: TokenType.CHAIN,
          exp: now + 10,
          status: TokenStatus.USED,
          singleUse: true,
          createdAt: now - 10,
          usedAt: now - 5,
          etag
        });

        const result = await tokenService.consumeToken(tokenId, sessionId, etag);

        expect(result.success).toBe(false);
        expect(result.error).toBe("ALREADY_USED");
        // Should not attempt update
        expect(mockTableClient.updateEntity).not.toHaveBeenCalled();
      });
    });
  });
});
