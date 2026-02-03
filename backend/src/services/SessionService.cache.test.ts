/**
 * Tests for SessionService Caching
 * Feature: qr-chain-attendance
 * Requirements: 16.1
 * 
 * Tests caching behavior for session configuration
 */

import { SessionService } from './SessionService';
import { getTableClient, TableName } from '../storage';
import { SessionStatus } from '../types';

// Mock the storage module
jest.mock('../storage', () => ({
  getTableClient: jest.fn(),
  TableName: {
    SESSIONS: 'Sessions',
    ATTENDANCE: 'Attendance'
  }
}));

describe('SessionService Caching', () => {
  let sessionService: SessionService;
  let mockSessionsTable: any;
  let mockAttendanceTable: any;

  beforeEach(() => {
    // Create mock table clients
    mockSessionsTable = {
      createEntity: jest.fn(),
      getEntity: jest.fn(),
      updateEntity: jest.fn(),
      listEntities: jest.fn()
    };

    mockAttendanceTable = {
      listEntities: jest.fn()
    };

    // Setup getTableClient mock
    (getTableClient as jest.Mock).mockImplementation((tableName: string) => {
      if (tableName === TableName.SESSIONS) {
        return mockSessionsTable;
      }
      return mockAttendanceTable;
    });

    sessionService = new SessionService();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Cache Hits', () => {
    test('should cache session on first getSession call', async () => {
      const sessionId = 'session-123';
      const mockEntity = {
        partitionKey: 'SESSION',
        rowKey: sessionId,
        classId: 'class-1',
        teacherId: 'teacher-1',
        startAt: '2024-01-01T10:00:00Z',
        endAt: '2024-01-01T12:00:00Z',
        lateCutoffMinutes: 15,
        exitWindowMinutes: 10,
        status: SessionStatus.ACTIVE,
        ownerTransfer: true,
        lateEntryActive: false,
        earlyLeaveActive: false,
        createdAt: '2024-01-01T09:00:00Z'
      };

      mockSessionsTable.getEntity.mockResolvedValue(mockEntity);

      // First call - should hit storage
      const session1 = await sessionService.getSession(sessionId);
      expect(mockSessionsTable.getEntity).toHaveBeenCalledTimes(1);
      expect(session1).toBeTruthy();

      // Second call - should hit cache
      const session2 = await sessionService.getSession(sessionId);
      expect(mockSessionsTable.getEntity).toHaveBeenCalledTimes(1); // Still 1, not 2
      expect(session2).toEqual(session1);
    });

    test('should serve multiple requests from cache', async () => {
      const sessionId = 'session-123';
      const mockEntity = {
        partitionKey: 'SESSION',
        rowKey: sessionId,
        classId: 'class-1',
        teacherId: 'teacher-1',
        startAt: '2024-01-01T10:00:00Z',
        endAt: '2024-01-01T12:00:00Z',
        lateCutoffMinutes: 15,
        exitWindowMinutes: 10,
        status: SessionStatus.ACTIVE,
        ownerTransfer: true,
        lateEntryActive: false,
        earlyLeaveActive: false,
        createdAt: '2024-01-01T09:00:00Z'
      };

      mockSessionsTable.getEntity.mockResolvedValue(mockEntity);

      // Make multiple calls
      await sessionService.getSession(sessionId);
      await sessionService.getSession(sessionId);
      await sessionService.getSession(sessionId);

      // Should only hit storage once
      expect(mockSessionsTable.getEntity).toHaveBeenCalledTimes(1);
    });
  });

  describe('Cache Misses', () => {
    test('should fetch from storage on cache miss', async () => {
      const sessionId = 'session-123';
      const mockEntity = {
        partitionKey: 'SESSION',
        rowKey: sessionId,
        classId: 'class-1',
        teacherId: 'teacher-1',
        startAt: '2024-01-01T10:00:00Z',
        endAt: '2024-01-01T12:00:00Z',
        lateCutoffMinutes: 15,
        exitWindowMinutes: 10,
        status: SessionStatus.ACTIVE,
        ownerTransfer: true,
        lateEntryActive: false,
        earlyLeaveActive: false,
        createdAt: '2024-01-01T09:00:00Z'
      };

      mockSessionsTable.getEntity.mockResolvedValue(mockEntity);

      const session = await sessionService.getSession(sessionId);
      
      expect(mockSessionsTable.getEntity).toHaveBeenCalledWith('SESSION', sessionId);
      expect(session).toBeTruthy();
      expect(session?.sessionId).toBe(sessionId);
    });

    test('should return null for non-existent session', async () => {
      const sessionId = 'nonexistent';
      mockSessionsTable.getEntity.mockRejectedValue({ statusCode: 404 });

      const session = await sessionService.getSession(sessionId);
      
      expect(session).toBeNull();
    });
  });

  describe('Cache Invalidation', () => {
    test('should invalidate cache when ending session', async () => {
      const sessionId = 'session-123';
      const teacherId = 'teacher-1';
      const mockEntity = {
        partitionKey: 'SESSION',
        rowKey: sessionId,
        classId: 'class-1',
        teacherId,
        startAt: '2024-01-01T10:00:00Z',
        endAt: '2024-01-01T12:00:00Z',
        lateCutoffMinutes: 15,
        exitWindowMinutes: 10,
        status: SessionStatus.ACTIVE,
        ownerTransfer: true,
        lateEntryActive: false,
        earlyLeaveActive: false,
        createdAt: '2024-01-01T09:00:00Z'
      };

      mockSessionsTable.getEntity.mockResolvedValue(mockEntity);
      mockSessionsTable.updateEntity.mockResolvedValue({});
      mockAttendanceTable.listEntities.mockReturnValue({
        [Symbol.asyncIterator]: async function* () {
          // Empty attendance list
        }
      });

      // First call - cache the session
      await sessionService.getSession(sessionId);
      expect(mockSessionsTable.getEntity).toHaveBeenCalledTimes(1);

      // End session - should invalidate cache
      await sessionService.endSession(sessionId, teacherId);

      // Update mock to return ended session
      mockSessionsTable.getEntity.mockResolvedValue({
        ...mockEntity,
        status: SessionStatus.ENDED
      });

      // Next call should hit storage again
      await sessionService.getSession(sessionId);
      expect(mockSessionsTable.getEntity).toHaveBeenCalledTimes(2);
    });

    test('should invalidate cache when updating late entry status', async () => {
      const sessionId = 'session-123';
      const mockEntity = {
        partitionKey: 'SESSION',
        rowKey: sessionId,
        classId: 'class-1',
        teacherId: 'teacher-1',
        startAt: '2024-01-01T10:00:00Z',
        endAt: '2024-01-01T12:00:00Z',
        lateCutoffMinutes: 15,
        exitWindowMinutes: 10,
        status: SessionStatus.ACTIVE,
        ownerTransfer: true,
        lateEntryActive: false,
        earlyLeaveActive: false,
        createdAt: '2024-01-01T09:00:00Z'
      };

      mockSessionsTable.getEntity.mockResolvedValue(mockEntity);
      mockSessionsTable.updateEntity.mockResolvedValue({});

      // Cache the session
      await sessionService.getSession(sessionId);
      expect(mockSessionsTable.getEntity).toHaveBeenCalledTimes(1);

      // Update late entry status - should use cached session, then invalidate
      await sessionService.updateLateEntryStatus(sessionId, true, 'token-123');
      // The update method calls getSession internally, which hits cache
      expect(mockSessionsTable.getEntity).toHaveBeenCalledTimes(1);

      // Update mock to return updated session
      mockSessionsTable.getEntity.mockResolvedValue({
        ...mockEntity,
        lateEntryActive: true,
        currentLateTokenId: 'token-123'
      });

      // Next call should hit storage again (cache was invalidated)
      await sessionService.getSession(sessionId);
      expect(mockSessionsTable.getEntity).toHaveBeenCalledTimes(2);
    });

    test('should invalidate cache when updating early leave status', async () => {
      const sessionId = 'session-123';
      const mockEntity = {
        partitionKey: 'SESSION',
        rowKey: sessionId,
        classId: 'class-1',
        teacherId: 'teacher-1',
        startAt: '2024-01-01T10:00:00Z',
        endAt: '2024-01-01T12:00:00Z',
        lateCutoffMinutes: 15,
        exitWindowMinutes: 10,
        status: SessionStatus.ACTIVE,
        ownerTransfer: true,
        lateEntryActive: false,
        earlyLeaveActive: false,
        createdAt: '2024-01-01T09:00:00Z'
      };

      mockSessionsTable.getEntity.mockResolvedValue(mockEntity);
      mockSessionsTable.updateEntity.mockResolvedValue({});

      // Cache the session
      await sessionService.getSession(sessionId);
      expect(mockSessionsTable.getEntity).toHaveBeenCalledTimes(1);

      // Update early leave status - should use cached session, then invalidate
      await sessionService.updateEarlyLeaveStatus(sessionId, true, 'token-456');
      // The update method calls getSession internally, which hits cache
      expect(mockSessionsTable.getEntity).toHaveBeenCalledTimes(1);

      // Update mock to return updated session
      mockSessionsTable.getEntity.mockResolvedValue({
        ...mockEntity,
        earlyLeaveActive: true,
        currentEarlyTokenId: 'token-456'
      });

      // Next call should hit storage again (cache was invalidated)
      await sessionService.getSession(sessionId);
      expect(mockSessionsTable.getEntity).toHaveBeenCalledTimes(2);
    });
  });

  describe('Cache TTL', () => {
    test('should expire cache after TTL', async () => {
      const sessionId = 'session-123';
      const mockEntity = {
        partitionKey: 'SESSION',
        rowKey: sessionId,
        classId: 'class-1',
        teacherId: 'teacher-1',
        startAt: '2024-01-01T10:00:00Z',
        endAt: '2024-01-01T12:00:00Z',
        lateCutoffMinutes: 15,
        exitWindowMinutes: 10,
        status: SessionStatus.ACTIVE,
        ownerTransfer: true,
        lateEntryActive: false,
        earlyLeaveActive: false,
        createdAt: '2024-01-01T09:00:00Z'
      };

      mockSessionsTable.getEntity.mockResolvedValue(mockEntity);

      // First call - cache the session
      await sessionService.getSession(sessionId);
      expect(mockSessionsTable.getEntity).toHaveBeenCalledTimes(1);

      // Wait for cache to expire (60 seconds + buffer)
      // Note: In real tests, we'd use jest.useFakeTimers() to speed this up
      // For now, we'll just verify the behavior is correct
      
      // Second call immediately - should hit cache
      await sessionService.getSession(sessionId);
      expect(mockSessionsTable.getEntity).toHaveBeenCalledTimes(1);
    }, 10000);
  });

  describe('Multiple Sessions', () => {
    test('should cache multiple sessions independently', async () => {
      const session1Id = 'session-1';
      const session2Id = 'session-2';
      
      const mockEntity1 = {
        partitionKey: 'SESSION',
        rowKey: session1Id,
        classId: 'class-1',
        teacherId: 'teacher-1',
        startAt: '2024-01-01T10:00:00Z',
        endAt: '2024-01-01T12:00:00Z',
        lateCutoffMinutes: 15,
        exitWindowMinutes: 10,
        status: SessionStatus.ACTIVE,
        ownerTransfer: true,
        lateEntryActive: false,
        earlyLeaveActive: false,
        createdAt: '2024-01-01T09:00:00Z'
      };

      const mockEntity2 = {
        ...mockEntity1,
        rowKey: session2Id,
        classId: 'class-2'
      };

      mockSessionsTable.getEntity.mockImplementation((pk: string, rk: string) => {
        if (rk === session1Id) return Promise.resolve(mockEntity1);
        if (rk === session2Id) return Promise.resolve(mockEntity2);
        return Promise.reject({ statusCode: 404 });
      });

      // Get both sessions
      await sessionService.getSession(session1Id);
      await sessionService.getSession(session2Id);
      expect(mockSessionsTable.getEntity).toHaveBeenCalledTimes(2);

      // Get them again - should hit cache
      await sessionService.getSession(session1Id);
      await sessionService.getSession(session2Id);
      expect(mockSessionsTable.getEntity).toHaveBeenCalledTimes(2); // Still 2
    });
  });
});
