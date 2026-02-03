/**
 * Tests for TokenService Caching
 * Feature: qr-chain-attendance
 * Requirements: 16.1
 * 
 * Tests caching behavior for rotating tokens (late entry, early leave)
 */

import { TokenService } from './TokenService';
import { getTableClient } from '../storage';
import { TokenType, TokenStatus } from '../types';

// Mock the storage module
jest.mock('../storage', () => ({
  getTableClient: jest.fn(),
  TableName: {
    TOKENS: 'Tokens'
  }
}));

describe('TokenService Caching', () => {
  let tokenService: TokenService;
  let mockTokensTable: any;

  beforeEach(() => {
    // Create mock table client
    mockTokensTable = {
      createEntity: jest.fn(),
      getEntity: jest.fn(),
      updateEntity: jest.fn()
    };

    // Setup getTableClient mock
    (getTableClient as jest.Mock).mockReturnValue(mockTokensTable);

    tokenService = new TokenService();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Cache Hits for Rotating Tokens', () => {
    test('should cache late entry token on first getToken call', async () => {
      const sessionId = 'session-123';
      const tokenId = 'token-late-123';
      const mockEntity = {
        partitionKey: sessionId,
        rowKey: tokenId,
        type: TokenType.LATE_ENTRY,
        exp: Math.floor(Date.now() / 1000) + 60,
        status: TokenStatus.ACTIVE,
        singleUse: true,
        createdAt: Math.floor(Date.now() / 1000),
        etag: 'etag-123'
      };

      mockTokensTable.getEntity.mockResolvedValue(mockEntity);

      // First call - should hit storage
      const token1 = await tokenService.getToken(tokenId, sessionId);
      expect(mockTokensTable.getEntity).toHaveBeenCalledTimes(1);
      expect(token1).toBeTruthy();

      // Second call - should hit cache
      const token2 = await tokenService.getToken(tokenId, sessionId);
      expect(mockTokensTable.getEntity).toHaveBeenCalledTimes(1); // Still 1
      expect(token2).toEqual(token1);
    });

    test('should cache early leave token on first getToken call', async () => {
      const sessionId = 'session-123';
      const tokenId = 'token-early-123';
      const mockEntity = {
        partitionKey: sessionId,
        rowKey: tokenId,
        type: TokenType.EARLY_LEAVE,
        exp: Math.floor(Date.now() / 1000) + 60,
        status: TokenStatus.ACTIVE,
        singleUse: true,
        createdAt: Math.floor(Date.now() / 1000),
        etag: 'etag-456'
      };

      mockTokensTable.getEntity.mockResolvedValue(mockEntity);

      // First call - should hit storage
      await tokenService.getToken(tokenId, sessionId);
      expect(mockTokensTable.getEntity).toHaveBeenCalledTimes(1);

      // Second call - should hit cache
      await tokenService.getToken(tokenId, sessionId);
      expect(mockTokensTable.getEntity).toHaveBeenCalledTimes(1);
    });

    test('should serve multiple requests from cache', async () => {
      const sessionId = 'session-123';
      const tokenId = 'token-late-123';
      const mockEntity = {
        partitionKey: sessionId,
        rowKey: tokenId,
        type: TokenType.LATE_ENTRY,
        exp: Math.floor(Date.now() / 1000) + 60,
        status: TokenStatus.ACTIVE,
        singleUse: true,
        createdAt: Math.floor(Date.now() / 1000),
        etag: 'etag-123'
      };

      mockTokensTable.getEntity.mockResolvedValue(mockEntity);

      // Make multiple calls
      await tokenService.getToken(tokenId, sessionId);
      await tokenService.getToken(tokenId, sessionId);
      await tokenService.getToken(tokenId, sessionId);

      // Should only hit storage once
      expect(mockTokensTable.getEntity).toHaveBeenCalledTimes(1);
    });
  });

  describe('No Caching for Chain Tokens', () => {
    test('should NOT cache chain tokens', async () => {
      const sessionId = 'session-123';
      const tokenId = 'token-chain-123';
      const mockEntity = {
        partitionKey: sessionId,
        rowKey: tokenId,
        type: TokenType.CHAIN,
        chainId: 'chain-1',
        issuedTo: 'student-1',
        seq: 1,
        exp: Math.floor(Date.now() / 1000) + 20,
        status: TokenStatus.ACTIVE,
        singleUse: true,
        createdAt: Math.floor(Date.now() / 1000),
        etag: 'etag-chain'
      };

      mockTokensTable.getEntity.mockResolvedValue(mockEntity);

      // First call
      await tokenService.getToken(tokenId, sessionId);
      expect(mockTokensTable.getEntity).toHaveBeenCalledTimes(1);

      // Second call - should hit storage again (not cached)
      await tokenService.getToken(tokenId, sessionId);
      expect(mockTokensTable.getEntity).toHaveBeenCalledTimes(2);
    });

    test('should NOT cache exit chain tokens', async () => {
      const sessionId = 'session-123';
      const tokenId = 'token-exit-123';
      const mockEntity = {
        partitionKey: sessionId,
        rowKey: tokenId,
        type: TokenType.EXIT_CHAIN,
        chainId: 'chain-exit-1',
        issuedTo: 'student-1',
        seq: 1,
        exp: Math.floor(Date.now() / 1000) + 20,
        status: TokenStatus.ACTIVE,
        singleUse: true,
        createdAt: Math.floor(Date.now() / 1000),
        etag: 'etag-exit'
      };

      mockTokensTable.getEntity.mockResolvedValue(mockEntity);

      // First call
      await tokenService.getToken(tokenId, sessionId);
      expect(mockTokensTable.getEntity).toHaveBeenCalledTimes(1);

      // Second call - should hit storage again (not cached)
      await tokenService.getToken(tokenId, sessionId);
      expect(mockTokensTable.getEntity).toHaveBeenCalledTimes(2);
    });

    test('should NOT cache session tokens', async () => {
      const sessionId = 'session-123';
      const tokenId = 'token-session-123';
      const mockEntity = {
        partitionKey: sessionId,
        rowKey: tokenId,
        type: TokenType.SESSION,
        exp: Math.floor(Date.now() / 1000) + 3600,
        status: TokenStatus.ACTIVE,
        singleUse: false,
        createdAt: Math.floor(Date.now() / 1000),
        etag: 'etag-session'
      };

      mockTokensTable.getEntity.mockResolvedValue(mockEntity);

      // First call
      await tokenService.getToken(tokenId, sessionId);
      expect(mockTokensTable.getEntity).toHaveBeenCalledTimes(1);

      // Second call - should hit storage again (not cached)
      await tokenService.getToken(tokenId, sessionId);
      expect(mockTokensTable.getEntity).toHaveBeenCalledTimes(2);
    });
  });

  describe('Cache Invalidation on Consumption', () => {
    test('should invalidate cache when consuming late entry token', async () => {
      const sessionId = 'session-123';
      const tokenId = 'token-late-123';
      const etag = 'etag-123';
      const mockEntity = {
        partitionKey: sessionId,
        rowKey: tokenId,
        type: TokenType.LATE_ENTRY,
        exp: Math.floor(Date.now() / 1000) + 60,
        status: TokenStatus.ACTIVE,
        singleUse: true,
        createdAt: Math.floor(Date.now() / 1000),
        etag
      };

      mockTokensTable.getEntity.mockResolvedValue(mockEntity);
      mockTokensTable.updateEntity.mockResolvedValue({ etag: 'new-etag' });

      // Cache the token
      await tokenService.getToken(tokenId, sessionId);
      expect(mockTokensTable.getEntity).toHaveBeenCalledTimes(1);

      // Consume token - should invalidate cache
      await tokenService.consumeToken(tokenId, sessionId, etag);

      // Update mock to return used token
      mockTokensTable.getEntity.mockResolvedValue({
        ...mockEntity,
        status: TokenStatus.USED
      });

      // Next call should hit storage again
      await tokenService.getToken(tokenId, sessionId);
      expect(mockTokensTable.getEntity).toHaveBeenCalledTimes(3); // 1 initial + 1 in consume + 1 after
    });

    test('should invalidate cache when consuming early leave token', async () => {
      const sessionId = 'session-123';
      const tokenId = 'token-early-123';
      const etag = 'etag-456';
      const mockEntity = {
        partitionKey: sessionId,
        rowKey: tokenId,
        type: TokenType.EARLY_LEAVE,
        exp: Math.floor(Date.now() / 1000) + 60,
        status: TokenStatus.ACTIVE,
        singleUse: true,
        createdAt: Math.floor(Date.now() / 1000),
        etag
      };

      mockTokensTable.getEntity.mockResolvedValue(mockEntity);
      mockTokensTable.updateEntity.mockResolvedValue({ etag: 'new-etag' });

      // Cache the token
      await tokenService.getToken(tokenId, sessionId);
      expect(mockTokensTable.getEntity).toHaveBeenCalledTimes(1);

      // Consume token - should invalidate cache
      await tokenService.consumeToken(tokenId, sessionId, etag);

      // Update mock to return used token
      mockTokensTable.getEntity.mockResolvedValue({
        ...mockEntity,
        status: TokenStatus.USED
      });

      // Next call should hit storage again
      await tokenService.getToken(tokenId, sessionId);
      expect(mockTokensTable.getEntity).toHaveBeenCalledTimes(3);
    });
  });

  describe('Cache Key Uniqueness', () => {
    test('should cache tokens with same ID but different sessions separately', async () => {
      const tokenId = 'token-123';
      const session1Id = 'session-1';
      const session2Id = 'session-2';
      
      const mockEntity1 = {
        partitionKey: session1Id,
        rowKey: tokenId,
        type: TokenType.LATE_ENTRY,
        exp: Math.floor(Date.now() / 1000) + 60,
        status: TokenStatus.ACTIVE,
        singleUse: true,
        createdAt: Math.floor(Date.now() / 1000),
        etag: 'etag-1'
      };

      const mockEntity2 = {
        partitionKey: session2Id,
        rowKey: tokenId,
        type: TokenType.LATE_ENTRY,
        exp: Math.floor(Date.now() / 1000) + 60,
        status: TokenStatus.ACTIVE,
        singleUse: true,
        createdAt: Math.floor(Date.now() / 1000),
        etag: 'etag-2'
      };

      mockTokensTable.getEntity.mockImplementation((pk: string, _rk: string) => {
        if (pk === session1Id) return Promise.resolve(mockEntity1);
        if (pk === session2Id) return Promise.resolve(mockEntity2);
        return Promise.reject({ statusCode: 404 });
      });

      // Get tokens from both sessions
      const token1 = await tokenService.getToken(tokenId, session1Id);
      const token2 = await tokenService.getToken(tokenId, session2Id);
      
      expect(mockTokensTable.getEntity).toHaveBeenCalledTimes(2);
      expect(token1?.sessionId).toBe(session1Id);
      expect(token2?.sessionId).toBe(session2Id);

      // Get them again - should hit cache
      await tokenService.getToken(tokenId, session1Id);
      await tokenService.getToken(tokenId, session2Id);
      expect(mockTokensTable.getEntity).toHaveBeenCalledTimes(2); // Still 2
    });
  });

  describe('Cache Miss Handling', () => {
    test('should fetch from storage on cache miss', async () => {
      const sessionId = 'session-123';
      const tokenId = 'token-late-123';
      const mockEntity = {
        partitionKey: sessionId,
        rowKey: tokenId,
        type: TokenType.LATE_ENTRY,
        exp: Math.floor(Date.now() / 1000) + 60,
        status: TokenStatus.ACTIVE,
        singleUse: true,
        createdAt: Math.floor(Date.now() / 1000),
        etag: 'etag-123'
      };

      mockTokensTable.getEntity.mockResolvedValue(mockEntity);

      const token = await tokenService.getToken(tokenId, sessionId);
      
      expect(mockTokensTable.getEntity).toHaveBeenCalledWith(sessionId, tokenId);
      expect(token).toBeTruthy();
      expect(token?.tokenId).toBe(tokenId);
    });

    test('should return null for non-existent token', async () => {
      const sessionId = 'session-123';
      const tokenId = 'nonexistent';
      mockTokensTable.getEntity.mockRejectedValue({ statusCode: 404 });

      const token = await tokenService.getToken(tokenId, sessionId);
      
      expect(token).toBeNull();
    });
  });

  describe('Multiple Rotating Tokens', () => {
    test('should cache multiple rotating tokens independently', async () => {
      const sessionId = 'session-123';
      const lateTokenId = 'token-late-123';
      const earlyTokenId = 'token-early-123';
      
      const mockLateEntity = {
        partitionKey: sessionId,
        rowKey: lateTokenId,
        type: TokenType.LATE_ENTRY,
        exp: Math.floor(Date.now() / 1000) + 60,
        status: TokenStatus.ACTIVE,
        singleUse: true,
        createdAt: Math.floor(Date.now() / 1000),
        etag: 'etag-late'
      };

      const mockEarlyEntity = {
        partitionKey: sessionId,
        rowKey: earlyTokenId,
        type: TokenType.EARLY_LEAVE,
        exp: Math.floor(Date.now() / 1000) + 60,
        status: TokenStatus.ACTIVE,
        singleUse: true,
        createdAt: Math.floor(Date.now() / 1000),
        etag: 'etag-early'
      };

      mockTokensTable.getEntity.mockImplementation((pk: string, rk: string) => {
        if (rk === lateTokenId) return Promise.resolve(mockLateEntity);
        if (rk === earlyTokenId) return Promise.resolve(mockEarlyEntity);
        return Promise.reject({ statusCode: 404 });
      });

      // Get both tokens
      await tokenService.getToken(lateTokenId, sessionId);
      await tokenService.getToken(earlyTokenId, sessionId);
      expect(mockTokensTable.getEntity).toHaveBeenCalledTimes(2);

      // Get them again - should hit cache
      await tokenService.getToken(lateTokenId, sessionId);
      await tokenService.getToken(earlyTokenId, sessionId);
      expect(mockTokensTable.getEntity).toHaveBeenCalledTimes(2); // Still 2
    });
  });
});
