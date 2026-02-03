/**
 * ChainService Unit Tests
 * Feature: qr-chain-attendance
 * Requirements: 3.1, 3.3, 3.4, 3.6, 6.1, 6.2, 6.3, 6.4, 11.1, 11.2, 11.3, 11.5
 */

import { ChainService } from "./ChainService";
import { tokenService } from "./TokenService";
import { attendanceService } from "./AttendanceService";
import { getTableClient } from "../storage";
import {
  ChainPhase,
  ChainState,
  TokenType,
  EntryStatus,
  ChainScanParams
} from "../types";

// Mock dependencies
jest.mock("../storage");
jest.mock("./TokenService");
jest.mock("./AttendanceService");

describe("ChainService", () => {
  let chainService: ChainService;
  let mockTableClient: any;

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();

    // Create mock table client
    mockTableClient = {
      createEntity: jest.fn(),
      getEntity: jest.fn(),
      updateEntity: jest.fn(),
      listEntities: jest.fn()
    };

    (getTableClient as jest.Mock).mockReturnValue(mockTableClient);

    // Create service instance
    chainService = new ChainService();
  });

  describe("seedChains", () => {
    it("should create exact count of entry chains", async () => {
      const sessionId = "session-1";
      const count = 3;
      const eligibleStudents = ["student-1", "student-2", "student-3", "student-4"];

      // Mock getAllAttendance to return eligible students
      (attendanceService.getAllAttendance as jest.Mock).mockResolvedValue(
        eligibleStudents.map(id => ({ studentId: id }))
      );

      // Mock createEntity
      mockTableClient.createEntity.mockResolvedValue({});

      // Mock createToken
      (tokenService.createToken as jest.Mock).mockResolvedValue({
        tokenId: "token-123",
        etag: "etag-123"
      });

      const chains = await chainService.seedChains(sessionId, ChainPhase.ENTRY, count);

      expect(chains).toHaveLength(count);
      expect(mockTableClient.createEntity).toHaveBeenCalledTimes(count);
      expect(tokenService.createToken).toHaveBeenCalledTimes(count);

      // Verify chain properties
      chains.forEach(chain => {
        expect(chain.sessionId).toBe(sessionId);
        expect(chain.phase).toBe(ChainPhase.ENTRY);
        expect(chain.index).toBe(0);
        expect(chain.state).toBe(ChainState.ACTIVE);
        expect(chain.lastSeq).toBe(0);
        expect(chain.lastHolder).toBeDefined();
        expect(eligibleStudents).toContain(chain.lastHolder);
      });
    });

    it("should create exact count of exit chains", async () => {
      const sessionId = "session-1";
      const count = 2;
      const eligibleStudents = [
        { studentId: "student-1", entryStatus: EntryStatus.PRESENT_ENTRY },
        { studentId: "student-2", entryStatus: EntryStatus.LATE_ENTRY },
        { studentId: "student-3", entryStatus: EntryStatus.PRESENT_ENTRY, earlyLeaveAt: 123456 }
      ];

      // Mock getAllAttendance
      (attendanceService.getAllAttendance as jest.Mock).mockResolvedValue(eligibleStudents);

      // Mock createEntity
      mockTableClient.createEntity.mockResolvedValue({});

      // Mock createToken
      (tokenService.createToken as jest.Mock).mockResolvedValue({
        tokenId: "token-123",
        etag: "etag-123"
      });

      const chains = await chainService.seedChains(sessionId, ChainPhase.EXIT, count);

      expect(chains).toHaveLength(count);
      
      // Verify only eligible students (not early-leave) were selected
      chains.forEach(chain => {
        expect(chain.lastHolder).not.toBe("student-3"); // early-leave student
        expect(["student-1", "student-2"]).toContain(chain.lastHolder);
      });
    });

    it("should throw error when insufficient eligible students", async () => {
      const sessionId = "session-1";
      const count = 5;
      const eligibleStudents = ["student-1", "student-2"];

      // Mock getAllAttendance
      (attendanceService.getAllAttendance as jest.Mock).mockResolvedValue(
        eligibleStudents.map(id => ({ studentId: id }))
      );

      await expect(
        chainService.seedChains(sessionId, ChainPhase.ENTRY, count)
      ).rejects.toThrow("Insufficient eligible students");
    });

    it("should issue chain tokens with 20 second TTL", async () => {
      const sessionId = "session-1";
      const count = 1;

      // Mock getAllAttendance
      (attendanceService.getAllAttendance as jest.Mock).mockResolvedValue([
        { studentId: "student-1" }
      ]);

      // Mock createEntity
      mockTableClient.createEntity.mockResolvedValue({});

      // Mock createToken
      (tokenService.createToken as jest.Mock).mockResolvedValue({
        tokenId: "token-123",
        etag: "etag-123"
      });

      await chainService.seedChains(sessionId, ChainPhase.ENTRY, count);

      expect(tokenService.createToken).toHaveBeenCalledWith(
        expect.objectContaining({
          ttlSeconds: 20,
          singleUse: true,
          type: TokenType.CHAIN
        })
      );
    });
  });

  describe("processChainScan", () => {
    it("should mark holder as PRESENT_ENTRY for entry chain", async () => {
      const params: ChainScanParams = {
        sessionId: "session-1",
        tokenId: "token-123",
        etag: "etag-123",
        scannerId: "scanner-1",
        scanMetadata: {
          deviceFingerprint: "device-1",
          userAgent: "test-agent"
        }
      };

      // Mock consumeToken success
      (tokenService.consumeToken as jest.Mock).mockResolvedValue({
        success: true,
        token: {
          tokenId: "token-123",
          type: TokenType.CHAIN,
          chainId: "chain-1",
          issuedTo: "holder-1",
          seq: 0
        }
      });

      // Mock markEntry with SignalR message
      (attendanceService.markEntry as jest.Mock).mockResolvedValue({
        record: { studentId: "holder-1", entryStatus: EntryStatus.PRESENT_ENTRY },
        signalRMessage: {
          target: "attendanceUpdate",
          arguments: [{ studentId: "holder-1", entryStatus: EntryStatus.PRESENT_ENTRY }],
          groupName: "session:session-1"
        }
      });

      // Mock createToken for baton transfer
      (tokenService.createToken as jest.Mock).mockResolvedValue({
        tokenId: "token-456",
        etag: "etag-456"
      });

      // Mock getEntity and updateEntity
      mockTableClient.getEntity.mockResolvedValue({
        partitionKey: "session-1",
        rowKey: "chain-1",
        phase: ChainPhase.ENTRY,
        lastSeq: 0
      });
      mockTableClient.updateEntity.mockResolvedValue({});

      const result = await chainService.processChainScan(params);

      expect(result.success).toBe(true);
      expect(result.holderMarked).toBe("holder-1");
      expect(result.newHolder).toBe("scanner-1");
      
      // Verify SignalR messages are included
      expect(result.signalRMessages).toBeDefined();
      expect(result.signalRMessages).toHaveLength(2); // attendance + chain update
      expect(result.signalRMessages![0].target).toBe("attendanceUpdate");
      expect(result.signalRMessages![1].target).toBe("chainUpdate");

      expect(attendanceService.markEntry).toHaveBeenCalledWith(
        "session-1",
        "holder-1",
        EntryStatus.PRESENT_ENTRY
      );
    });

    it("should mark holder as exit verified for exit chain", async () => {
      const params: ChainScanParams = {
        sessionId: "session-1",
        tokenId: "token-123",
        etag: "etag-123",
        scannerId: "scanner-1",
        scanMetadata: {
          deviceFingerprint: "device-1",
          userAgent: "test-agent"
        }
      };

      // Mock consumeToken success
      (tokenService.consumeToken as jest.Mock).mockResolvedValue({
        success: true,
        token: {
          tokenId: "token-123",
          type: TokenType.EXIT_CHAIN,
          chainId: "chain-1",
          issuedTo: "holder-1",
          seq: 0
        }
      });

      // Mock markExitVerified with SignalR message
      (attendanceService.markExitVerified as jest.Mock).mockResolvedValue({
        record: { studentId: "holder-1", exitVerified: true },
        signalRMessage: {
          target: "attendanceUpdate",
          arguments: [{ studentId: "holder-1", exitVerified: true }],
          groupName: "session:session-1"
        }
      });

      // Mock createToken for baton transfer
      (tokenService.createToken as jest.Mock).mockResolvedValue({
        tokenId: "token-456",
        etag: "etag-456"
      });

      // Mock getEntity and updateEntity
      mockTableClient.getEntity.mockResolvedValue({
        partitionKey: "session-1",
        rowKey: "chain-1",
        phase: ChainPhase.EXIT,
        lastSeq: 0
      });
      mockTableClient.updateEntity.mockResolvedValue({});

      const result = await chainService.processChainScan(params);

      expect(result.success).toBe(true);
      expect(result.signalRMessages).toBeDefined();
      expect(result.signalRMessages).toHaveLength(2);
      
      expect(attendanceService.markExitVerified).toHaveBeenCalledWith(
        "session-1",
        "holder-1"
      );
    });

    it("should transfer baton to scanner with incremented sequence", async () => {
      const params: ChainScanParams = {
        sessionId: "session-1",
        tokenId: "token-123",
        etag: "etag-123",
        scannerId: "scanner-1",
        scanMetadata: {
          deviceFingerprint: "device-1",
          userAgent: "test-agent"
        }
      };

      // Mock consumeToken success
      (tokenService.consumeToken as jest.Mock).mockResolvedValue({
        success: true,
        token: {
          tokenId: "token-123",
          type: TokenType.CHAIN,
          chainId: "chain-1",
          issuedTo: "holder-1",
          seq: 5
        }
      });

      // Mock markEntry with SignalR message
      (attendanceService.markEntry as jest.Mock).mockResolvedValue({
        record: { studentId: "holder-1", entryStatus: EntryStatus.PRESENT_ENTRY },
        signalRMessage: {
          target: "attendanceUpdate",
          arguments: [{ studentId: "holder-1", entryStatus: EntryStatus.PRESENT_ENTRY }],
          groupName: "session:session-1"
        }
      });

      // Mock createToken for baton transfer
      (tokenService.createToken as jest.Mock).mockResolvedValue({
        tokenId: "token-456",
        etag: "etag-456"
      });

      // Mock getEntity and updateEntity
      mockTableClient.getEntity.mockResolvedValue({
        partitionKey: "session-1",
        rowKey: "chain-1",
        phase: ChainPhase.ENTRY,
        lastSeq: 5
      });
      mockTableClient.updateEntity.mockResolvedValue({});

      await chainService.processChainScan(params);

      // Verify new token created with seq+1
      expect(tokenService.createToken).toHaveBeenCalledWith(
        expect.objectContaining({
          seq: 6,
          issuedTo: "scanner-1"
        })
      );

      // Verify chain updated with new holder and seq
      expect(mockTableClient.updateEntity).toHaveBeenCalledWith(
        expect.objectContaining({
          lastHolder: "scanner-1",
          lastSeq: 6
        }),
        "Merge"
      );
    });

    it("should return error when token consumption fails", async () => {
      const params: ChainScanParams = {
        sessionId: "session-1",
        tokenId: "token-123",
        etag: "etag-123",
        scannerId: "scanner-1",
        scanMetadata: {
          deviceFingerprint: "device-1",
          userAgent: "test-agent"
        }
      };

      // Mock consumeToken failure
      (tokenService.consumeToken as jest.Mock).mockResolvedValue({
        success: false,
        error: "ALREADY_USED"
      });

      const result = await chainService.processChainScan(params);

      expect(result.success).toBe(false);
      expect(result.error).toBe("ALREADY_USED");
      expect(attendanceService.markEntry).not.toHaveBeenCalled();
    });
  });

  describe("detectStalledChains", () => {
    it("should detect chains idle for more than 90 seconds", async () => {
      const sessionId = "session-1";
      const now = Math.floor(Date.now() / 1000);
      const stalledTime = now - 100; // 100 seconds ago

      // Mock listEntities
      const mockEntities = [
        {
          partitionKey: sessionId,
          rowKey: "chain-1",
          phase: ChainPhase.ENTRY,
          state: ChainState.ACTIVE,
          lastAt: stalledTime,
          index: 0,
          lastSeq: 0
        },
        {
          partitionKey: sessionId,
          rowKey: "chain-2",
          phase: ChainPhase.ENTRY,
          state: ChainState.ACTIVE,
          lastAt: now - 50, // Not stalled
          index: 0,
          lastSeq: 0
        }
      ];

      mockTableClient.listEntities.mockReturnValue({
        [Symbol.asyncIterator]: async function* () {
          for (const entity of mockEntities) {
            yield entity;
          }
        }
      });

      // Mock updateEntity
      mockTableClient.updateEntity.mockResolvedValue({});

      const stalledChains = await chainService.detectStalledChains(
        sessionId,
        ChainPhase.ENTRY
      );

      expect(stalledChains.chains).toHaveLength(1);
      expect(stalledChains.chains[0].chainId).toBe("chain-1");
      expect(stalledChains.chains[0].state).toBe(ChainState.STALLED);
      
      // Verify SignalR message is included
      expect(stalledChains.signalRMessage).toBeDefined();
      expect(stalledChains.signalRMessage!.target).toBe("stallAlert");
      expect(stalledChains.signalRMessage!.arguments[0]).toEqual({
        chainIds: ["chain-1"]
      });

      // Verify chain was marked as stalled
      expect(mockTableClient.updateEntity).toHaveBeenCalledWith(
        expect.objectContaining({
          state: ChainState.STALLED
        }),
        "Merge"
      );
    });

    it("should not detect chains idle for less than 90 seconds", async () => {
      const sessionId = "session-1";
      const now = Math.floor(Date.now() / 1000);

      // Mock listEntities
      const mockEntities = [
        {
          partitionKey: sessionId,
          rowKey: "chain-1",
          phase: ChainPhase.ENTRY,
          state: ChainState.ACTIVE,
          lastAt: now - 80, // 80 seconds ago - not stalled
          index: 0,
          lastSeq: 0
        }
      ];

      mockTableClient.listEntities.mockReturnValue({
        [Symbol.asyncIterator]: async function* () {
          for (const entity of mockEntities) {
            yield entity;
          }
        }
      });

      const stalledChains = await chainService.detectStalledChains(
        sessionId,
        ChainPhase.ENTRY
      );

      expect(stalledChains.chains).toHaveLength(0);
      expect(stalledChains.signalRMessage).toBeUndefined();
      expect(mockTableClient.updateEntity).not.toHaveBeenCalled();
    });
  });

  describe("reseedChains", () => {
    it("should create new chains with incremented index", async () => {
      const sessionId = "session-1";
      const count = 2;

      // Mock getAllAttendance
      (attendanceService.getAllAttendance as jest.Mock).mockResolvedValue([
        { studentId: "student-1" },
        { studentId: "student-2" },
        { studentId: "student-3" }
      ]);

      // Mock listEntities to return existing chains with max index 2
      const mockEntities = [
        {
          partitionKey: sessionId,
          rowKey: "chain-1",
          phase: ChainPhase.ENTRY,
          index: 1,
          lastSeq: 0
        },
        {
          partitionKey: sessionId,
          rowKey: "chain-2",
          phase: ChainPhase.ENTRY,
          index: 2,
          lastSeq: 0
        }
      ];

      mockTableClient.listEntities.mockReturnValue({
        [Symbol.asyncIterator]: async function* () {
          for (const entity of mockEntities) {
            yield entity;
          }
        }
      });

      // Mock createEntity
      mockTableClient.createEntity.mockResolvedValue({});

      // Mock createToken
      (tokenService.createToken as jest.Mock).mockResolvedValue({
        tokenId: "token-123",
        etag: "etag-123"
      });

      const chains = await chainService.reseedChains(sessionId, ChainPhase.ENTRY, count);

      expect(chains).toHaveLength(count);
      
      // Verify all new chains have index 3 (max + 1)
      chains.forEach(chain => {
        expect(chain.index).toBe(3);
      });
    });

    it("should start with index 1 when no existing chains", async () => {
      const sessionId = "session-1";
      const count = 1;

      // Mock getAllAttendance
      (attendanceService.getAllAttendance as jest.Mock).mockResolvedValue([
        { studentId: "student-1" }
      ]);

      // Mock listEntities to return no existing chains
      mockTableClient.listEntities.mockReturnValue({
        [Symbol.asyncIterator]: async function* () {
          // Empty
        }
      });

      // Mock createEntity
      mockTableClient.createEntity.mockResolvedValue({});

      // Mock createToken
      (tokenService.createToken as jest.Mock).mockResolvedValue({
        tokenId: "token-123",
        etag: "etag-123"
      });

      const chains = await chainService.reseedChains(sessionId, ChainPhase.ENTRY, count);

      expect(chains).toHaveLength(count);
      expect(chains[0].index).toBe(1);
    });
  });
});
