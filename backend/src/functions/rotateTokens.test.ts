/**
 * Token Rotation Timer Function Tests
 * Feature: qr-chain-attendance
 * Requirements: 4.2, 5.1, 5.2
 */

import { InvocationContext, Timer } from "@azure/functions";
import { rotateTokens } from "./rotateTokens";
import { tokenService } from "../services/TokenService";
import { sessionService } from "../services/SessionService";
import { getTableClient, TableName } from "../storage";
import { 
  SessionEntity, 
  TokenEntity, 
  TokenType, 
  TokenStatus, 
  SessionStatus,
  CreateTokenParams
} from "../types";
import { getConfig } from "../config";

// Mock dependencies
jest.mock("../services/TokenService");
jest.mock("../services/SessionService");
jest.mock("../storage");
jest.mock("../config");

describe("rotateTokens Timer Function", () => {
  let mockContext: InvocationContext;
  let mockTimer: Timer;
  let mockSessionsTable: any;
  let mockTokensTable: any;

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();

    // Mock InvocationContext
    mockContext = {
      log: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
      info: jest.fn(),
      debug: jest.fn(),
      trace: jest.fn(),
    } as any;

    // Mock Timer
    mockTimer = {
      isPastDue: false,
      schedule: {
        adjustForDST: false,
      },
      scheduleStatus: {
        last: new Date().toISOString(),
        next: new Date().toISOString(),
        lastUpdated: new Date().toISOString(),
      },
    } as Timer;

    // Mock table clients
    mockSessionsTable = {
      listEntities: jest.fn(),
    };

    mockTokensTable = {
      listEntities: jest.fn(),
      updateEntity: jest.fn(),
    };

    (getTableClient as jest.Mock).mockImplementation((tableName: TableName) => {
      if (tableName === TableName.SESSIONS) {
        return mockSessionsTable;
      }
      if (tableName === TableName.TOKENS) {
        return mockTokensTable;
      }
      return {};
    });

    // Mock config
    (getConfig as jest.Mock).mockReturnValue({
      lateRotationSeconds: 60,
      earlyLeaveRotationSeconds: 60,
    });
  });

  describe("Session Processing", () => {
    it("should process sessions with active late entry tokens", async () => {
      // Arrange
      const sessionId = "session-1";
      const currentTokenId = "old-token-1";
      const newTokenId = "new-token-1";

      const sessionEntity: SessionEntity = {
        partitionKey: "SESSION",
        rowKey: sessionId,
        classId: "class-1",
        teacherId: "teacher-1",
        startAt: new Date().toISOString(),
        endAt: new Date(Date.now() + 3600000).toISOString(),
        lateCutoffMinutes: 15,
        exitWindowMinutes: 10,
        status: SessionStatus.ACTIVE,
        ownerTransfer: true,
        lateEntryActive: true,
        currentLateTokenId: currentTokenId,
        earlyLeaveActive: false,
        createdAt: new Date().toISOString(),
      };

      // Mock session query
      mockSessionsTable.listEntities.mockReturnValue({
        [Symbol.asyncIterator]: async function* () {
          yield sessionEntity;
        },
      });

      // Mock token validation (expired)
      (tokenService.validateToken as jest.Mock).mockResolvedValue({
        valid: false,
        error: "EXPIRED",
      });

      // Mock token creation
      (tokenService.createToken as jest.Mock).mockResolvedValue({
        tokenId: newTokenId,
        sessionId,
        type: TokenType.LATE_ENTRY,
        exp: Math.floor(Date.now() / 1000) + 60,
        status: TokenStatus.ACTIVE,
        singleUse: true,
        etag: "etag-1",
      });

      // Mock session update
      (sessionService.updateLateEntryStatus as jest.Mock).mockResolvedValue(undefined);

      // Mock expired tokens query (empty)
      mockTokensTable.listEntities.mockReturnValue({
        [Symbol.asyncIterator]: async function* () {},
      });

      // Act
      await rotateTokens(mockTimer, mockContext);

      // Assert
      expect(tokenService.validateToken).toHaveBeenCalledWith(currentTokenId, sessionId);
      expect(tokenService.createToken).toHaveBeenCalledWith({
        sessionId,
        type: TokenType.LATE_ENTRY,
        ttlSeconds: 60,
        singleUse: true,
      });
      expect(sessionService.updateLateEntryStatus).toHaveBeenCalledWith(
        sessionId,
        true,
        newTokenId
      );
      expect(mockContext.log).toHaveBeenCalledWith(
        expect.stringContaining(`Created new late entry token for session ${sessionId}`)
      );
    });

    it("should process sessions with active early leave tokens", async () => {
      // Arrange
      const sessionId = "session-2";
      const currentTokenId = "old-token-2";
      const newTokenId = "new-token-2";

      const sessionEntity: SessionEntity = {
        partitionKey: "SESSION",
        rowKey: sessionId,
        classId: "class-2",
        teacherId: "teacher-2",
        startAt: new Date().toISOString(),
        endAt: new Date(Date.now() + 3600000).toISOString(),
        lateCutoffMinutes: 15,
        exitWindowMinutes: 10,
        status: SessionStatus.ACTIVE,
        ownerTransfer: true,
        lateEntryActive: false,
        earlyLeaveActive: true,
        currentEarlyTokenId: currentTokenId,
        createdAt: new Date().toISOString(),
      };

      // Mock session query
      mockSessionsTable.listEntities.mockReturnValue({
        [Symbol.asyncIterator]: async function* () {
          yield sessionEntity;
        },
      });

      // Mock token validation (expired)
      (tokenService.validateToken as jest.Mock).mockResolvedValue({
        valid: false,
        error: "EXPIRED",
      });

      // Mock token creation
      (tokenService.createToken as jest.Mock).mockResolvedValue({
        tokenId: newTokenId,
        sessionId,
        type: TokenType.EARLY_LEAVE,
        exp: Math.floor(Date.now() / 1000) + 60,
        status: TokenStatus.ACTIVE,
        singleUse: true,
        etag: "etag-2",
      });

      // Mock session update
      (sessionService.updateEarlyLeaveStatus as jest.Mock).mockResolvedValue(undefined);

      // Mock expired tokens query (empty)
      mockTokensTable.listEntities.mockReturnValue({
        [Symbol.asyncIterator]: async function* () {},
      });

      // Act
      await rotateTokens(mockTimer, mockContext);

      // Assert
      expect(tokenService.validateToken).toHaveBeenCalledWith(currentTokenId, sessionId);
      expect(tokenService.createToken).toHaveBeenCalledWith({
        sessionId,
        type: TokenType.EARLY_LEAVE,
        ttlSeconds: 60,
        singleUse: true,
      });
      expect(sessionService.updateEarlyLeaveStatus).toHaveBeenCalledWith(
        sessionId,
        true,
        newTokenId
      );
      expect(mockContext.log).toHaveBeenCalledWith(
        expect.stringContaining(`Created new early leave token for session ${sessionId}`)
      );
    });

    it("should not rotate tokens that are still valid", async () => {
      // Arrange
      const sessionId = "session-3";
      const currentTokenId = "valid-token";

      const sessionEntity: SessionEntity = {
        partitionKey: "SESSION",
        rowKey: sessionId,
        classId: "class-3",
        teacherId: "teacher-3",
        startAt: new Date().toISOString(),
        endAt: new Date(Date.now() + 3600000).toISOString(),
        lateCutoffMinutes: 15,
        exitWindowMinutes: 10,
        status: SessionStatus.ACTIVE,
        ownerTransfer: true,
        lateEntryActive: true,
        currentLateTokenId: currentTokenId,
        earlyLeaveActive: false,
        createdAt: new Date().toISOString(),
      };

      // Mock session query
      mockSessionsTable.listEntities.mockReturnValue({
        [Symbol.asyncIterator]: async function* () {
          yield sessionEntity;
        },
      });

      // Mock token validation (still valid)
      (tokenService.validateToken as jest.Mock).mockResolvedValue({
        valid: true,
        token: {
          tokenId: currentTokenId,
          sessionId,
          type: TokenType.LATE_ENTRY,
          exp: Math.floor(Date.now() / 1000) + 30,
          status: TokenStatus.ACTIVE,
          singleUse: true,
          etag: "etag-3",
        },
      });

      // Mock expired tokens query (empty)
      mockTokensTable.listEntities.mockReturnValue({
        [Symbol.asyncIterator]: async function* () {},
      });

      // Act
      await rotateTokens(mockTimer, mockContext);

      // Assert
      expect(tokenService.validateToken).toHaveBeenCalledWith(currentTokenId, sessionId);
      expect(tokenService.createToken).not.toHaveBeenCalled();
      expect(sessionService.updateLateEntryStatus).not.toHaveBeenCalled();
    });

    it("should skip sessions without active rotating tokens", async () => {
      // Arrange
      const sessionEntity: SessionEntity = {
        partitionKey: "SESSION",
        rowKey: "session-4",
        classId: "class-4",
        teacherId: "teacher-4",
        startAt: new Date().toISOString(),
        endAt: new Date(Date.now() + 3600000).toISOString(),
        lateCutoffMinutes: 15,
        exitWindowMinutes: 10,
        status: SessionStatus.ACTIVE,
        ownerTransfer: true,
        lateEntryActive: false,
        earlyLeaveActive: false,
        createdAt: new Date().toISOString(),
      };

      // Mock session query
      mockSessionsTable.listEntities.mockReturnValue({
        [Symbol.asyncIterator]: async function* () {
          yield sessionEntity;
        },
      });

      // Mock expired tokens query (empty)
      mockTokensTable.listEntities.mockReturnValue({
        [Symbol.asyncIterator]: async function* () {},
      });

      // Act
      await rotateTokens(mockTimer, mockContext);

      // Assert
      expect(tokenService.validateToken).not.toHaveBeenCalled();
      expect(tokenService.createToken).not.toHaveBeenCalled();
    });

    it("should process multiple sessions in one run", async () => {
      // Arrange
      const sessions: SessionEntity[] = [
        {
          partitionKey: "SESSION",
          rowKey: "session-5",
          classId: "class-5",
          teacherId: "teacher-5",
          startAt: new Date().toISOString(),
          endAt: new Date(Date.now() + 3600000).toISOString(),
          lateCutoffMinutes: 15,
          exitWindowMinutes: 10,
          status: SessionStatus.ACTIVE,
          ownerTransfer: true,
          lateEntryActive: true,
          currentLateTokenId: "token-5",
          earlyLeaveActive: false,
          createdAt: new Date().toISOString(),
        },
        {
          partitionKey: "SESSION",
          rowKey: "session-6",
          classId: "class-6",
          teacherId: "teacher-6",
          startAt: new Date().toISOString(),
          endAt: new Date(Date.now() + 3600000).toISOString(),
          lateCutoffMinutes: 15,
          exitWindowMinutes: 10,
          status: SessionStatus.ACTIVE,
          ownerTransfer: true,
          lateEntryActive: false,
          earlyLeaveActive: true,
          currentEarlyTokenId: "token-6",
          createdAt: new Date().toISOString(),
        },
      ];

      // Mock session query
      mockSessionsTable.listEntities.mockReturnValue({
        [Symbol.asyncIterator]: async function* () {
          for (const session of sessions) {
            yield session;
          }
        },
      });

      // Mock token validation (all expired)
      (tokenService.validateToken as jest.Mock).mockResolvedValue({
        valid: false,
        error: "EXPIRED",
      });

      // Mock token creation
      (tokenService.createToken as jest.Mock)
        .mockResolvedValueOnce({
          tokenId: "new-token-5",
          sessionId: "session-5",
          type: TokenType.LATE_ENTRY,
          exp: Math.floor(Date.now() / 1000) + 60,
          status: TokenStatus.ACTIVE,
          singleUse: true,
          etag: "etag-5",
        })
        .mockResolvedValueOnce({
          tokenId: "new-token-6",
          sessionId: "session-6",
          type: TokenType.EARLY_LEAVE,
          exp: Math.floor(Date.now() / 1000) + 60,
          status: TokenStatus.ACTIVE,
          singleUse: true,
          etag: "etag-6",
        });

      // Mock session updates
      (sessionService.updateLateEntryStatus as jest.Mock).mockResolvedValue(undefined);
      (sessionService.updateEarlyLeaveStatus as jest.Mock).mockResolvedValue(undefined);

      // Mock expired tokens query (empty)
      mockTokensTable.listEntities.mockReturnValue({
        [Symbol.asyncIterator]: async function* () {},
      });

      // Act
      await rotateTokens(mockTimer, mockContext);

      // Assert
      expect(tokenService.createToken).toHaveBeenCalledTimes(2);
      expect(sessionService.updateLateEntryStatus).toHaveBeenCalledTimes(1);
      expect(sessionService.updateEarlyLeaveStatus).toHaveBeenCalledTimes(1);
    });
  });

  describe("Expired Token Cleanup", () => {
    it("should mark expired tokens as EXPIRED", async () => {
      // Arrange
      const now = Math.floor(Date.now() / 1000);
      const expiredToken: TokenEntity = {
        partitionKey: "session-7",
        rowKey: "expired-token-1",
        type: TokenType.CHAIN,
        exp: now - 100,
        status: TokenStatus.ACTIVE,
        singleUse: true,
        createdAt: now - 200,
      };

      // Mock session query (empty)
      mockSessionsTable.listEntities.mockReturnValue({
        [Symbol.asyncIterator]: async function* () {},
      });

      // Mock expired tokens query
      mockTokensTable.listEntities.mockReturnValue({
        [Symbol.asyncIterator]: async function* () {
          yield expiredToken;
        },
      });

      mockTokensTable.updateEntity.mockResolvedValue({});

      // Act
      await rotateTokens(mockTimer, mockContext);

      // Assert
      expect(mockTokensTable.updateEntity).toHaveBeenCalledWith(
        expect.objectContaining({
          status: TokenStatus.EXPIRED,
        }),
        "Replace"
      );
      expect(mockContext.log).toHaveBeenCalledWith(
        expect.stringContaining("Marked token expired-token-1 as EXPIRED")
      );
    });

    it("should continue processing if one token update fails", async () => {
      // Arrange
      const now = Math.floor(Date.now() / 1000);
      const expiredTokens: TokenEntity[] = [
        {
          partitionKey: "session-8",
          rowKey: "expired-token-2",
          type: TokenType.CHAIN,
          exp: now - 100,
          status: TokenStatus.ACTIVE,
          singleUse: true,
          createdAt: now - 200,
        },
        {
          partitionKey: "session-9",
          rowKey: "expired-token-3",
          type: TokenType.CHAIN,
          exp: now - 100,
          status: TokenStatus.ACTIVE,
          singleUse: true,
          createdAt: now - 200,
        },
      ];

      // Mock session query (empty)
      mockSessionsTable.listEntities.mockReturnValue({
        [Symbol.asyncIterator]: async function* () {},
      });

      // Mock expired tokens query
      mockTokensTable.listEntities.mockReturnValue({
        [Symbol.asyncIterator]: async function* () {
          for (const token of expiredTokens) {
            yield token;
          }
        },
      });

      // First update fails, second succeeds
      mockTokensTable.updateEntity
        .mockRejectedValueOnce(new Error("Update failed"))
        .mockResolvedValueOnce({});

      // Act
      await rotateTokens(mockTimer, mockContext);

      // Assert
      expect(mockTokensTable.updateEntity).toHaveBeenCalledTimes(2);
      expect(mockContext.error).toHaveBeenCalledWith(
        expect.stringContaining("Error marking token expired-token-2 as expired"),
        expect.any(Error)
      );
      expect(mockContext.log).toHaveBeenCalledWith(
        expect.stringContaining("Marked token expired-token-3 as EXPIRED")
      );
    });
  });

  describe("Error Handling", () => {
    it("should handle errors gracefully and create replacement token", async () => {
      // Arrange
      const sessionId = "session-10";
      const currentTokenId = "error-token";
      const newTokenId = "replacement-token";

      const sessionEntity: SessionEntity = {
        partitionKey: "SESSION",
        rowKey: sessionId,
        classId: "class-10",
        teacherId: "teacher-10",
        startAt: new Date().toISOString(),
        endAt: new Date(Date.now() + 3600000).toISOString(),
        lateCutoffMinutes: 15,
        exitWindowMinutes: 10,
        status: SessionStatus.ACTIVE,
        ownerTransfer: true,
        lateEntryActive: true,
        currentLateTokenId: currentTokenId,
        earlyLeaveActive: false,
        createdAt: new Date().toISOString(),
      };

      // Mock session query
      mockSessionsTable.listEntities.mockReturnValue({
        [Symbol.asyncIterator]: async function* () {
          yield sessionEntity;
        },
      });

      // Mock token validation (error)
      (tokenService.validateToken as jest.Mock).mockRejectedValue(
        new Error("Validation error")
      );

      // Mock token creation (succeeds on retry)
      (tokenService.createToken as jest.Mock).mockResolvedValue({
        tokenId: newTokenId,
        sessionId,
        type: TokenType.LATE_ENTRY,
        exp: Math.floor(Date.now() / 1000) + 60,
        status: TokenStatus.ACTIVE,
        singleUse: true,
        etag: "etag-10",
      });

      // Mock session update
      (sessionService.updateLateEntryStatus as jest.Mock).mockResolvedValue(undefined);

      // Mock expired tokens query (empty)
      mockTokensTable.listEntities.mockReturnValue({
        [Symbol.asyncIterator]: async function* () {},
      });

      // Act
      await rotateTokens(mockTimer, mockContext);

      // Assert
      expect(mockContext.error).toHaveBeenCalledWith(
        expect.stringContaining(`Error rotating token ${currentTokenId}`),
        expect.any(Error)
      );
      expect(tokenService.createToken).toHaveBeenCalled();
      expect(sessionService.updateLateEntryStatus).toHaveBeenCalledWith(
        sessionId,
        true,
        newTokenId
      );
    });

    it("should log completion summary", async () => {
      // Arrange
      mockSessionsTable.listEntities.mockReturnValue({
        [Symbol.asyncIterator]: async function* () {},
      });

      mockTokensTable.listEntities.mockReturnValue({
        [Symbol.asyncIterator]: async function* () {},
      });

      // Act
      await rotateTokens(mockTimer, mockContext);

      // Assert
      expect(mockContext.log).toHaveBeenCalledWith(
        expect.stringContaining("Token rotation completed")
      );
    });
  });
});
