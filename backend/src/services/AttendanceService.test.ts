/**
 * AttendanceService Unit Tests
 * Feature: qr-chain-attendance
 * Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6, 7.7
 */

import { AttendanceService } from "./AttendanceService";
import { EntryStatus, FinalStatus } from "../types";
import { getTableClient } from "../storage";

// Mock the storage module
jest.mock("../storage", () => ({
  getTableClient: jest.fn(),
  TableName: {
    ATTENDANCE: "Attendance"
  }
}));

describe("AttendanceService", () => {
  let service: AttendanceService;
  let mockTableClient: any;

  beforeEach(() => {
    // Create mock table client
    mockTableClient = {
      createEntity: jest.fn(),
      getEntity: jest.fn(),
      updateEntity: jest.fn(),
      listEntities: jest.fn()
    };

    // Mock getTableClient to return our mock
    (getTableClient as jest.Mock).mockReturnValue(mockTableClient);

    // Create service instance
    service = new AttendanceService();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("markEntry", () => {
    it("should create new attendance record with PRESENT_ENTRY status", async () => {
      const sessionId = "session-123";
      const studentId = "student-456";
      const status = EntryStatus.PRESENT_ENTRY;

      // Mock getEntity to throw 404 (record doesn't exist)
      mockTableClient.getEntity.mockRejectedValue({ statusCode: 404 });
      mockTableClient.createEntity.mockResolvedValue({});

      const result = await service.markEntry(sessionId, studentId, status);

      expect(mockTableClient.getEntity).toHaveBeenCalledWith(sessionId, studentId);
      expect(mockTableClient.createEntity).toHaveBeenCalledWith(
        expect.objectContaining({
          partitionKey: sessionId,
          rowKey: studentId,
          entryStatus: status,
          entryAt: expect.any(Number),
          exitVerified: false
        })
      );
      expect(result.record.sessionId).toBe(sessionId);
      expect(result.record.studentId).toBe(studentId);
      expect(result.record.entryStatus).toBe(status);
      expect(result.record.entryAt).toBeDefined();
      expect(result.record.exitVerified).toBe(false);
      
      // Verify SignalR message
      expect(result.signalRMessage).toBeDefined();
      expect(result.signalRMessage.target).toBe("attendanceUpdate");
      expect(result.signalRMessage.groupName).toBe(`session:${sessionId}`);
      expect(result.signalRMessage.arguments[0]).toEqual({
        studentId,
        entryStatus: status
      });
    });

    it("should create new attendance record with LATE_ENTRY status", async () => {
      const sessionId = "session-123";
      const studentId = "student-456";
      const status = EntryStatus.LATE_ENTRY;

      mockTableClient.getEntity.mockRejectedValue({ statusCode: 404 });
      mockTableClient.createEntity.mockResolvedValue({});

      const result = await service.markEntry(sessionId, studentId, status);

      expect(mockTableClient.createEntity).toHaveBeenCalledWith(
        expect.objectContaining({
          entryStatus: status
        })
      );
      expect(result.record.entryStatus).toBe(status);
      expect(result.signalRMessage).toBeDefined();
    });

    it("should update existing attendance record with entry status", async () => {
      const sessionId = "session-123";
      const studentId = "student-456";
      const status = EntryStatus.PRESENT_ENTRY;

      const existingEntity = {
        partitionKey: sessionId,
        rowKey: studentId,
        exitVerified: false
      };

      mockTableClient.getEntity.mockResolvedValue(existingEntity);
      mockTableClient.updateEntity.mockResolvedValue({});

      const result = await service.markEntry(sessionId, studentId, status);

      expect(mockTableClient.updateEntity).toHaveBeenCalledWith(
        expect.objectContaining({
          partitionKey: sessionId,
          rowKey: studentId,
          entryStatus: status,
          entryAt: expect.any(Number),
          exitVerified: false
        }),
        "Merge"
      );
      expect(result.record.entryStatus).toBe(status);
      expect(result.signalRMessage).toBeDefined();
    });
  });

  describe("markExitVerified", () => {
    it("should create new attendance record with exitVerified=true", async () => {
      const sessionId = "session-123";
      const studentId = "student-456";

      mockTableClient.getEntity.mockRejectedValue({ statusCode: 404 });
      mockTableClient.createEntity.mockResolvedValue({});

      const result = await service.markExitVerified(sessionId, studentId);

      expect(mockTableClient.createEntity).toHaveBeenCalledWith(
        expect.objectContaining({
          partitionKey: sessionId,
          rowKey: studentId,
          exitVerified: true,
          exitVerifiedAt: expect.any(Number)
        })
      );
      expect(result.record.exitVerified).toBe(true);
      expect(result.record.exitVerifiedAt).toBeDefined();
      
      // Verify SignalR message
      expect(result.signalRMessage).toBeDefined();
      expect(result.signalRMessage.target).toBe("attendanceUpdate");
      expect(result.signalRMessage.arguments[0]).toEqual({
        studentId,
        exitVerified: true
      });
    });

    it("should update existing attendance record with exitVerified=true", async () => {
      const sessionId = "session-123";
      const studentId = "student-456";

      const existingEntity = {
        partitionKey: sessionId,
        rowKey: studentId,
        entryStatus: EntryStatus.PRESENT_ENTRY,
        entryAt: 1000,
        exitVerified: false
      };

      mockTableClient.getEntity.mockResolvedValue(existingEntity);
      mockTableClient.updateEntity.mockResolvedValue({});

      const result = await service.markExitVerified(sessionId, studentId);

      expect(mockTableClient.updateEntity).toHaveBeenCalledWith(
        expect.objectContaining({
          partitionKey: sessionId,
          rowKey: studentId,
          entryStatus: EntryStatus.PRESENT_ENTRY,
          entryAt: 1000,
          exitVerified: true,
          exitVerifiedAt: expect.any(Number)
        }),
        "Merge"
      );
      expect(result.record.exitVerified).toBe(true);
      expect(result.signalRMessage).toBeDefined();
    });
  });

  describe("markEarlyLeave", () => {
    it("should create new attendance record with earlyLeaveAt timestamp", async () => {
      const sessionId = "session-123";
      const studentId = "student-456";

      mockTableClient.getEntity.mockRejectedValue({ statusCode: 404 });
      mockTableClient.createEntity.mockResolvedValue({});

      const result = await service.markEarlyLeave(sessionId, studentId);

      expect(mockTableClient.createEntity).toHaveBeenCalledWith(
        expect.objectContaining({
          partitionKey: sessionId,
          rowKey: studentId,
          exitVerified: false,
          earlyLeaveAt: expect.any(Number)
        })
      );
      expect(result.record.earlyLeaveAt).toBeDefined();
      
      // Verify SignalR message
      expect(result.signalRMessage).toBeDefined();
      expect(result.signalRMessage.target).toBe("attendanceUpdate");
      expect(result.signalRMessage.arguments[0]).toEqual({
        studentId,
        earlyLeaveAt: expect.any(Number)
      });
    });

    it("should update existing attendance record with earlyLeaveAt timestamp", async () => {
      const sessionId = "session-123";
      const studentId = "student-456";

      const existingEntity = {
        partitionKey: sessionId,
        rowKey: studentId,
        entryStatus: EntryStatus.PRESENT_ENTRY,
        entryAt: 1000,
        exitVerified: false
      };

      mockTableClient.getEntity.mockResolvedValue(existingEntity);
      mockTableClient.updateEntity.mockResolvedValue({});

      const result = await service.markEarlyLeave(sessionId, studentId);

      expect(mockTableClient.updateEntity).toHaveBeenCalledWith(
        expect.objectContaining({
          partitionKey: sessionId,
          rowKey: studentId,
          entryStatus: EntryStatus.PRESENT_ENTRY,
          entryAt: 1000,
          exitVerified: false,
          earlyLeaveAt: expect.any(Number)
        }),
        "Merge"
      );
      expect(result.record.earlyLeaveAt).toBeDefined();
      expect(result.signalRMessage).toBeDefined();
    });
  });

  describe("computeFinalStatus - Decision Tree Logic", () => {
    it("should compute EARLY_LEAVE when earlyLeaveAt exists (priority 1)", async () => {
      const sessionId = "session-123";

      const entities = [
        {
          partitionKey: sessionId,
          rowKey: "student-1",
          entryStatus: EntryStatus.PRESENT_ENTRY,
          entryAt: 1000,
          exitVerified: true,
          exitVerifiedAt: 2000,
          earlyLeaveAt: 1500 // Early leave takes precedence
        }
      ];

      mockTableClient.listEntities.mockReturnValue({
        [Symbol.asyncIterator]: async function* () {
          for (const entity of entities) {
            yield entity;
          }
        }
      });
      mockTableClient.updateEntity.mockResolvedValue({});

      const results = await service.computeFinalStatus(sessionId);

      expect(results).toHaveLength(1);
      expect(results[0].finalStatus).toBe(FinalStatus.EARLY_LEAVE);
      expect(mockTableClient.updateEntity).toHaveBeenCalledWith(
        expect.objectContaining({
          finalStatus: FinalStatus.EARLY_LEAVE
        }),
        "Merge"
      );
    });

    it("should compute PRESENT when PRESENT_ENTRY + exitVerified", async () => {
      const sessionId = "session-123";

      const entities = [
        {
          partitionKey: sessionId,
          rowKey: "student-1",
          entryStatus: EntryStatus.PRESENT_ENTRY,
          entryAt: 1000,
          exitVerified: true,
          exitVerifiedAt: 2000
        }
      ];

      mockTableClient.listEntities.mockReturnValue({
        [Symbol.asyncIterator]: async function* () {
          for (const entity of entities) {
            yield entity;
          }
        }
      });
      mockTableClient.updateEntity.mockResolvedValue({});

      const results = await service.computeFinalStatus(sessionId);

      expect(results).toHaveLength(1);
      expect(results[0].finalStatus).toBe(FinalStatus.PRESENT);
    });

    it("should compute LEFT_EARLY when PRESENT_ENTRY + !exitVerified", async () => {
      const sessionId = "session-123";

      const entities = [
        {
          partitionKey: sessionId,
          rowKey: "student-1",
          entryStatus: EntryStatus.PRESENT_ENTRY,
          entryAt: 1000,
          exitVerified: false
        }
      ];

      mockTableClient.listEntities.mockReturnValue({
        [Symbol.asyncIterator]: async function* () {
          for (const entity of entities) {
            yield entity;
          }
        }
      });
      mockTableClient.updateEntity.mockResolvedValue({});

      const results = await service.computeFinalStatus(sessionId);

      expect(results).toHaveLength(1);
      expect(results[0].finalStatus).toBe(FinalStatus.LEFT_EARLY);
    });

    it("should compute LATE when LATE_ENTRY + exitVerified", async () => {
      const sessionId = "session-123";

      const entities = [
        {
          partitionKey: sessionId,
          rowKey: "student-1",
          entryStatus: EntryStatus.LATE_ENTRY,
          entryAt: 1500,
          exitVerified: true,
          exitVerifiedAt: 2000
        }
      ];

      mockTableClient.listEntities.mockReturnValue({
        [Symbol.asyncIterator]: async function* () {
          for (const entity of entities) {
            yield entity;
          }
        }
      });
      mockTableClient.updateEntity.mockResolvedValue({});

      const results = await service.computeFinalStatus(sessionId);

      expect(results).toHaveLength(1);
      expect(results[0].finalStatus).toBe(FinalStatus.LATE);
    });

    it("should compute LEFT_EARLY when LATE_ENTRY + !exitVerified", async () => {
      const sessionId = "session-123";

      const entities = [
        {
          partitionKey: sessionId,
          rowKey: "student-1",
          entryStatus: EntryStatus.LATE_ENTRY,
          entryAt: 1500,
          exitVerified: false
        }
      ];

      mockTableClient.listEntities.mockReturnValue({
        [Symbol.asyncIterator]: async function* () {
          for (const entity of entities) {
            yield entity;
          }
        }
      });
      mockTableClient.updateEntity.mockResolvedValue({});

      const results = await service.computeFinalStatus(sessionId);

      expect(results).toHaveLength(1);
      expect(results[0].finalStatus).toBe(FinalStatus.LEFT_EARLY);
    });

    it("should compute ABSENT when no entry status", async () => {
      const sessionId = "session-123";

      const entities = [
        {
          partitionKey: sessionId,
          rowKey: "student-1",
          exitVerified: false
        }
      ];

      mockTableClient.listEntities.mockReturnValue({
        [Symbol.asyncIterator]: async function* () {
          for (const entity of entities) {
            yield entity;
          }
        }
      });
      mockTableClient.updateEntity.mockResolvedValue({});

      const results = await service.computeFinalStatus(sessionId);

      expect(results).toHaveLength(1);
      expect(results[0].finalStatus).toBe(FinalStatus.ABSENT);
    });

    it("should compute final status for multiple students", async () => {
      const sessionId = "session-123";

      const entities = [
        {
          partitionKey: sessionId,
          rowKey: "student-1",
          entryStatus: EntryStatus.PRESENT_ENTRY,
          entryAt: 1000,
          exitVerified: true,
          exitVerifiedAt: 2000
        },
        {
          partitionKey: sessionId,
          rowKey: "student-2",
          entryStatus: EntryStatus.LATE_ENTRY,
          entryAt: 1500,
          exitVerified: true,
          exitVerifiedAt: 2000
        },
        {
          partitionKey: sessionId,
          rowKey: "student-3",
          entryStatus: EntryStatus.PRESENT_ENTRY,
          entryAt: 1000,
          exitVerified: false
        },
        {
          partitionKey: sessionId,
          rowKey: "student-4",
          exitVerified: false
        }
      ];

      mockTableClient.listEntities.mockReturnValue({
        [Symbol.asyncIterator]: async function* () {
          for (const entity of entities) {
            yield entity;
          }
        }
      });
      mockTableClient.updateEntity.mockResolvedValue({});

      const results = await service.computeFinalStatus(sessionId);

      expect(results).toHaveLength(4);
      expect(results[0].finalStatus).toBe(FinalStatus.PRESENT);
      expect(results[1].finalStatus).toBe(FinalStatus.LATE);
      expect(results[2].finalStatus).toBe(FinalStatus.LEFT_EARLY);
      expect(results[3].finalStatus).toBe(FinalStatus.ABSENT);
    });
  });

  describe("getAttendance", () => {
    it("should return attendance record for existing student", async () => {
      const sessionId = "session-123";
      const studentId = "student-456";

      const entity = {
        partitionKey: sessionId,
        rowKey: studentId,
        entryStatus: EntryStatus.PRESENT_ENTRY,
        entryAt: 1000,
        exitVerified: true,
        exitVerifiedAt: 2000
      };

      mockTableClient.getEntity.mockResolvedValue(entity);

      const result = await service.getAttendance(sessionId, studentId);

      expect(result).not.toBeNull();
      expect(result?.sessionId).toBe(sessionId);
      expect(result?.studentId).toBe(studentId);
      expect(result?.entryStatus).toBe(EntryStatus.PRESENT_ENTRY);
    });

    it("should return null for non-existent student", async () => {
      const sessionId = "session-123";
      const studentId = "student-456";

      mockTableClient.getEntity.mockRejectedValue({ statusCode: 404 });

      const result = await service.getAttendance(sessionId, studentId);

      expect(result).toBeNull();
    });
  });

  describe("getAllAttendance", () => {
    it("should return all attendance records for a session", async () => {
      const sessionId = "session-123";

      const entities = [
        {
          partitionKey: sessionId,
          rowKey: "student-1",
          entryStatus: EntryStatus.PRESENT_ENTRY,
          entryAt: 1000,
          exitVerified: true,
          exitVerifiedAt: 2000
        },
        {
          partitionKey: sessionId,
          rowKey: "student-2",
          entryStatus: EntryStatus.LATE_ENTRY,
          entryAt: 1500,
          exitVerified: false
        }
      ];

      mockTableClient.listEntities.mockReturnValue({
        [Symbol.asyncIterator]: async function* () {
          for (const entity of entities) {
            yield entity;
          }
        }
      });

      const results = await service.getAllAttendance(sessionId);

      expect(results).toHaveLength(2);
      expect(results[0].studentId).toBe("student-1");
      expect(results[1].studentId).toBe("student-2");
    });

    it("should return empty array for session with no attendance records", async () => {
      const sessionId = "session-123";

      mockTableClient.listEntities.mockReturnValue({
        [Symbol.asyncIterator]: async function* () {
          // Empty iterator
        }
      });

      const results = await service.getAllAttendance(sessionId);

      expect(results).toHaveLength(0);
    });
  });

  describe("Edge Cases", () => {
    it("should handle student with only exitVerified (no entry)", async () => {
      const sessionId = "session-123";

      const entities = [
        {
          partitionKey: sessionId,
          rowKey: "student-1",
          exitVerified: true,
          exitVerifiedAt: 2000
        }
      ];

      mockTableClient.listEntities.mockReturnValue({
        [Symbol.asyncIterator]: async function* () {
          for (const entity of entities) {
            yield entity;
          }
        }
      });
      mockTableClient.updateEntity.mockResolvedValue({});

      const results = await service.computeFinalStatus(sessionId);

      expect(results).toHaveLength(1);
      expect(results[0].finalStatus).toBe(FinalStatus.ABSENT);
    });

    it("should handle student with only earlyLeaveAt (no entry or exit)", async () => {
      const sessionId = "session-123";

      const entities = [
        {
          partitionKey: sessionId,
          rowKey: "student-1",
          exitVerified: false,
          earlyLeaveAt: 1500
        }
      ];

      mockTableClient.listEntities.mockReturnValue({
        [Symbol.asyncIterator]: async function* () {
          for (const entity of entities) {
            yield entity;
          }
        }
      });
      mockTableClient.updateEntity.mockResolvedValue({});

      const results = await service.computeFinalStatus(sessionId);

      expect(results).toHaveLength(1);
      expect(results[0].finalStatus).toBe(FinalStatus.EARLY_LEAVE);
    });

    it("should handle concurrent updates gracefully", async () => {
      const sessionId = "session-123";
      const studentId = "student-456";

      const existingEntity = {
        partitionKey: sessionId,
        rowKey: studentId,
        entryStatus: EntryStatus.PRESENT_ENTRY,
        entryAt: 1000,
        exitVerified: false
      };

      mockTableClient.getEntity.mockResolvedValue(existingEntity);
      mockTableClient.updateEntity.mockResolvedValue({});

      // Simulate concurrent updates
      const results = await Promise.all([
        service.markExitVerified(sessionId, studentId),
        service.markEarlyLeave(sessionId, studentId)
      ]);

      // Both updates should succeed (Merge mode allows this)
      expect(mockTableClient.updateEntity).toHaveBeenCalledTimes(2);
      
      // Both should return SignalR messages
      expect(results[0].signalRMessage).toBeDefined();
      expect(results[1].signalRMessage).toBeDefined();
    });
  });
});
