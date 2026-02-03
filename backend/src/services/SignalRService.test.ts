/**
 * SignalRService Unit Tests
 * Feature: qr-chain-attendance
 * Requirements: 12.1, 12.2, 12.3, 12.6
 */

import { SignalRService, AttendanceUpdate } from "./SignalRService";
import { EntryStatus, ChainPhase, ChainState, ChainUpdate } from "../types";

describe("SignalRService", () => {
  let service: SignalRService;

  beforeEach(() => {
    service = new SignalRService();
  });

  describe("broadcastAttendanceUpdate", () => {
    it("should create SignalR message for attendance update with entry status", () => {
      // Arrange
      const sessionId = "session-123";
      const update: AttendanceUpdate = {
        studentId: "student-456",
        entryStatus: EntryStatus.PRESENT_ENTRY
      };

      // Act
      const message = service.broadcastAttendanceUpdate(sessionId, update);

      // Assert
      expect(message).toEqual({
        target: "attendanceUpdate",
        arguments: [update],
        groupName: "session:session-123"
      });
    });

    it("should create SignalR message for attendance update with exit verified", () => {
      // Arrange
      const sessionId = "session-789";
      const update: AttendanceUpdate = {
        studentId: "student-101",
        exitVerified: true
      };

      // Act
      const message = service.broadcastAttendanceUpdate(sessionId, update);

      // Assert
      expect(message).toEqual({
        target: "attendanceUpdate",
        arguments: [update],
        groupName: "session:session-789"
      });
    });

    it("should create SignalR message for attendance update with early leave", () => {
      // Arrange
      const sessionId = "session-abc";
      const now = Math.floor(Date.now() / 1000);
      const update: AttendanceUpdate = {
        studentId: "student-202",
        earlyLeaveAt: now
      };

      // Act
      const message = service.broadcastAttendanceUpdate(sessionId, update);

      // Assert
      expect(message).toEqual({
        target: "attendanceUpdate",
        arguments: [update],
        groupName: "session:session-abc"
      });
    });

    it("should create SignalR message for attendance update with multiple fields", () => {
      // Arrange
      const sessionId = "session-xyz";
      const now = Math.floor(Date.now() / 1000);
      const update: AttendanceUpdate = {
        studentId: "student-303",
        entryStatus: EntryStatus.LATE_ENTRY,
        exitVerified: true,
        earlyLeaveAt: now
      };

      // Act
      const message = service.broadcastAttendanceUpdate(sessionId, update);

      // Assert
      expect(message).toEqual({
        target: "attendanceUpdate",
        arguments: [update],
        groupName: "session:session-xyz"
      });
    });

    it("should use correct group name format", () => {
      // Arrange
      const sessionId = "test-session-id";
      const update: AttendanceUpdate = {
        studentId: "student-id"
      };

      // Act
      const message = service.broadcastAttendanceUpdate(sessionId, update);

      // Assert
      expect(message.groupName).toBe("session:test-session-id");
      expect(message.groupName).toMatch(/^session:/);
    });
  });

  describe("broadcastChainUpdate", () => {
    it("should create SignalR message for entry chain update", () => {
      // Arrange
      const sessionId = "session-123";
      const update: ChainUpdate = {
        chainId: "chain-456",
        phase: ChainPhase.ENTRY,
        lastHolder: "student-789",
        lastSeq: 5,
        state: ChainState.ACTIVE
      };

      // Act
      const message = service.broadcastChainUpdate(sessionId, update);

      // Assert
      expect(message).toEqual({
        target: "chainUpdate",
        arguments: [update],
        groupName: "session:session-123"
      });
    });

    it("should create SignalR message for exit chain update", () => {
      // Arrange
      const sessionId = "session-abc";
      const update: ChainUpdate = {
        chainId: "chain-def",
        phase: ChainPhase.EXIT,
        lastHolder: "student-ghi",
        lastSeq: 12,
        state: ChainState.ACTIVE
      };

      // Act
      const message = service.broadcastChainUpdate(sessionId, update);

      // Assert
      expect(message).toEqual({
        target: "chainUpdate",
        arguments: [update],
        groupName: "session:session-abc"
      });
    });

    it("should create SignalR message for stalled chain update", () => {
      // Arrange
      const sessionId = "session-xyz";
      const update: ChainUpdate = {
        chainId: "chain-stalled",
        phase: ChainPhase.ENTRY,
        lastHolder: "student-last",
        lastSeq: 3,
        state: ChainState.STALLED
      };

      // Act
      const message = service.broadcastChainUpdate(sessionId, update);

      // Assert
      expect(message).toEqual({
        target: "chainUpdate",
        arguments: [update],
        groupName: "session:session-xyz"
      });
      expect(message.arguments[0].state).toBe(ChainState.STALLED);
    });

    it("should create SignalR message for completed chain update", () => {
      // Arrange
      const sessionId = "session-complete";
      const update: ChainUpdate = {
        chainId: "chain-done",
        phase: ChainPhase.EXIT,
        lastHolder: "student-final",
        lastSeq: 50,
        state: ChainState.COMPLETED
      };

      // Act
      const message = service.broadcastChainUpdate(sessionId, update);

      // Assert
      expect(message).toEqual({
        target: "chainUpdate",
        arguments: [update],
        groupName: "session:session-complete"
      });
      expect(message.arguments[0].state).toBe(ChainState.COMPLETED);
    });

    it("should handle chain update with sequence number 0", () => {
      // Arrange
      const sessionId = "session-new";
      const update: ChainUpdate = {
        chainId: "chain-new",
        phase: ChainPhase.ENTRY,
        lastHolder: "student-first",
        lastSeq: 0,
        state: ChainState.ACTIVE
      };

      // Act
      const message = service.broadcastChainUpdate(sessionId, update);

      // Assert
      expect(message.arguments[0].lastSeq).toBe(0);
    });
  });

  describe("broadcastStallAlert", () => {
    it("should create SignalR message for single stalled chain", () => {
      // Arrange
      const sessionId = "session-123";
      const chainIds = ["chain-stalled-1"];

      // Act
      const message = service.broadcastStallAlert(sessionId, chainIds);

      // Assert
      expect(message).toEqual({
        target: "stallAlert",
        arguments: [{ chainIds: ["chain-stalled-1"] }],
        groupName: "session:session-123"
      });
    });

    it("should create SignalR message for multiple stalled chains", () => {
      // Arrange
      const sessionId = "session-456";
      const chainIds = ["chain-1", "chain-2", "chain-3"];

      // Act
      const message = service.broadcastStallAlert(sessionId, chainIds);

      // Assert
      expect(message).toEqual({
        target: "stallAlert",
        arguments: [{ chainIds: ["chain-1", "chain-2", "chain-3"] }],
        groupName: "session:session-456"
      });
      expect(message.arguments[0].chainIds).toHaveLength(3);
    });

    it("should create SignalR message for empty stalled chains array", () => {
      // Arrange
      const sessionId = "session-789";
      const chainIds: string[] = [];

      // Act
      const message = service.broadcastStallAlert(sessionId, chainIds);

      // Assert
      expect(message).toEqual({
        target: "stallAlert",
        arguments: [{ chainIds: [] }],
        groupName: "session:session-789"
      });
      expect(message.arguments[0].chainIds).toHaveLength(0);
    });

    it("should wrap chainIds in an object", () => {
      // Arrange
      const sessionId = "session-test";
      const chainIds = ["chain-a", "chain-b"];

      // Act
      const message = service.broadcastStallAlert(sessionId, chainIds);

      // Assert
      expect(message.arguments[0]).toHaveProperty("chainIds");
      expect(Array.isArray(message.arguments[0].chainIds)).toBe(true);
    });
  });

  describe("getConnectionInfo", () => {
    it("should create connection info request with userId and groupName", () => {
      // Arrange
      const userId = "user-123";
      const sessionId = "session-456";

      // Act
      const connectionInfo = service.getConnectionInfo(userId, sessionId);

      // Assert
      expect(connectionInfo).toEqual({
        userId: "user-123",
        groupName: "session:session-456"
      });
    });

    it("should use correct group name format for connection", () => {
      // Arrange
      const userId = "teacher-789";
      const sessionId = "class-session-abc";

      // Act
      const connectionInfo = service.getConnectionInfo(userId, sessionId);

      // Assert
      expect(connectionInfo.groupName).toBe("session:class-session-abc");
      expect(connectionInfo.groupName).toMatch(/^session:/);
    });

    it("should preserve userId in connection info", () => {
      // Arrange
      const userId = "teacher@vtc.edu.hk";
      const sessionId = "session-xyz";

      // Act
      const connectionInfo = service.getConnectionInfo(userId, sessionId);

      // Assert
      expect(connectionInfo.userId).toBe("teacher@vtc.edu.hk");
    });
  });

  describe("Message structure validation", () => {
    it("should have consistent message structure across all broadcast methods", () => {
      // Arrange
      const sessionId = "session-test";

      // Act
      const attendanceMsg = service.broadcastAttendanceUpdate(sessionId, {
        studentId: "student-1"
      });
      const chainMsg = service.broadcastChainUpdate(sessionId, {
        chainId: "chain-1",
        phase: ChainPhase.ENTRY,
        lastHolder: "student-2",
        lastSeq: 1,
        state: ChainState.ACTIVE
      });
      const stallMsg = service.broadcastStallAlert(sessionId, ["chain-1"]);

      // Assert - All messages should have target, arguments, and groupName
      expect(attendanceMsg).toHaveProperty("target");
      expect(attendanceMsg).toHaveProperty("arguments");
      expect(attendanceMsg).toHaveProperty("groupName");

      expect(chainMsg).toHaveProperty("target");
      expect(chainMsg).toHaveProperty("arguments");
      expect(chainMsg).toHaveProperty("groupName");

      expect(stallMsg).toHaveProperty("target");
      expect(stallMsg).toHaveProperty("arguments");
      expect(stallMsg).toHaveProperty("groupName");

      // All should use the same group name format
      expect(attendanceMsg.groupName).toBe("session:session-test");
      expect(chainMsg.groupName).toBe("session:session-test");
      expect(stallMsg.groupName).toBe("session:session-test");
    });

    it("should have unique target names for each message type", () => {
      // Arrange
      const sessionId = "session-test";

      // Act
      const attendanceMsg = service.broadcastAttendanceUpdate(sessionId, {
        studentId: "student-1"
      });
      const chainMsg = service.broadcastChainUpdate(sessionId, {
        chainId: "chain-1",
        phase: ChainPhase.ENTRY,
        lastHolder: "student-2",
        lastSeq: 1,
        state: ChainState.ACTIVE
      });
      const stallMsg = service.broadcastStallAlert(sessionId, ["chain-1"]);

      // Assert - Each message type should have a unique target
      expect(attendanceMsg.target).toBe("attendanceUpdate");
      expect(chainMsg.target).toBe("chainUpdate");
      expect(stallMsg.target).toBe("stallAlert");

      // All targets should be different
      const targets = [attendanceMsg.target, chainMsg.target, stallMsg.target];
      const uniqueTargets = new Set(targets);
      expect(uniqueTargets.size).toBe(3);
    });

    it("should always have arguments as an array", () => {
      // Arrange
      const sessionId = "session-test";

      // Act
      const attendanceMsg = service.broadcastAttendanceUpdate(sessionId, {
        studentId: "student-1"
      });
      const chainMsg = service.broadcastChainUpdate(sessionId, {
        chainId: "chain-1",
        phase: ChainPhase.ENTRY,
        lastHolder: "student-2",
        lastSeq: 1,
        state: ChainState.ACTIVE
      });
      const stallMsg = service.broadcastStallAlert(sessionId, ["chain-1"]);

      // Assert
      expect(Array.isArray(attendanceMsg.arguments)).toBe(true);
      expect(Array.isArray(chainMsg.arguments)).toBe(true);
      expect(Array.isArray(stallMsg.arguments)).toBe(true);

      // Each should have exactly one argument
      expect(attendanceMsg.arguments).toHaveLength(1);
      expect(chainMsg.arguments).toHaveLength(1);
      expect(stallMsg.arguments).toHaveLength(1);
    });
  });

  describe("Edge cases", () => {
    it("should handle special characters in sessionId", () => {
      // Arrange
      const sessionId = "session-with-special-chars-!@#$%";
      const update: AttendanceUpdate = {
        studentId: "student-1"
      };

      // Act
      const message = service.broadcastAttendanceUpdate(sessionId, update);

      // Assert
      expect(message.groupName).toBe("session:session-with-special-chars-!@#$%");
    });

    it("should handle very long sessionId", () => {
      // Arrange
      const sessionId = "a".repeat(200);
      const update: AttendanceUpdate = {
        studentId: "student-1"
      };

      // Act
      const message = service.broadcastAttendanceUpdate(sessionId, update);

      // Assert
      expect(message.groupName).toBe(`session:${"a".repeat(200)}`);
    });

    it("should handle empty string studentId in attendance update", () => {
      // Arrange
      const sessionId = "session-123";
      const update: AttendanceUpdate = {
        studentId: ""
      };

      // Act
      const message = service.broadcastAttendanceUpdate(sessionId, update);

      // Assert
      expect(message.arguments[0].studentId).toBe("");
    });

    it("should handle very large sequence numbers in chain update", () => {
      // Arrange
      const sessionId = "session-123";
      const update: ChainUpdate = {
        chainId: "chain-1",
        phase: ChainPhase.ENTRY,
        lastHolder: "student-1",
        lastSeq: Number.MAX_SAFE_INTEGER,
        state: ChainState.ACTIVE
      };

      // Act
      const message = service.broadcastChainUpdate(sessionId, update);

      // Assert
      expect(message.arguments[0].lastSeq).toBe(Number.MAX_SAFE_INTEGER);
    });
  });
});
