/**
 * Unit Tests for Get Session API Endpoint
 * Feature: qr-chain-attendance
 * Requirements: 12.4
 */

import { HttpRequest, InvocationContext } from '@azure/functions';
import { getSession } from './getSession';
import { SessionService } from '../services/SessionService';
import { attendanceService } from '../services/AttendanceService';
import { chainService } from '../services/ChainService';
import { AuthService } from '../services/AuthService';
import { 
  SessionStatus, 
  EntryStatus, 
  ChainPhase, 
  ChainState,
  Session,
  AttendanceRecord,
  Chain,
  Role
} from '../types';

// Mock storage module before importing services
jest.mock('../storage', () => ({
  getTableClient: jest.fn(),
  TableName: {
    SESSIONS: 'Sessions',
    ATTENDANCE: 'Attendance',
    TOKENS: 'Tokens',
    CHAINS: 'Chains',
    SCAN_LOGS: 'ScanLogs'
  }
}));

// Mock services
jest.mock('../services/SessionService');
jest.mock('../services/AuthService');

// Mock singleton services
jest.mock('../services/AttendanceService', () => ({
  attendanceService: {
    getAllAttendance: jest.fn()
  }
}));

jest.mock('../services/ChainService', () => ({
  chainService: {
    getChains: jest.fn()
  }
}));

describe('getSession', () => {
  let mockContext: InvocationContext;
  let mockAuthService: jest.Mocked<AuthService>;
  let mockSessionService: jest.Mocked<SessionService>;

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();

    // Mock context
    mockContext = {
      log: jest.fn(),
      error: jest.fn()
    } as any;

    // Mock AuthService
    mockAuthService = new AuthService() as jest.Mocked<AuthService>;
    mockAuthService.parseUserPrincipal = jest.fn().mockReturnValue({
      userId: 'teacher-123',
      userEmail: 'teacher@vtc.edu.hk',
      userRoles: [Role.TEACHER],
      identityProvider: 'aad'
    });
    mockAuthService.requireRole = jest.fn();
    mockAuthService.getUserId = jest.fn().mockReturnValue('teacher-123');
    (AuthService as jest.Mock).mockImplementation(() => mockAuthService);

    // Mock SessionService
    mockSessionService = new SessionService() as jest.Mocked<SessionService>;
    (SessionService as jest.Mock).mockImplementation(() => mockSessionService);
  });

  describe('Authentication and Authorization', () => {
    it('should return 401 when authentication header is missing', async () => {
      const request = {
        params: { sessionId: 'session-123' },
        query: new Map(),
        headers: new Map()
      } as any as HttpRequest;

      const response = await getSession(request, mockContext);

      expect(response.status).toBe(401);
      expect(response.jsonBody).toMatchObject({
        error: {
          code: 'UNAUTHORIZED',
          message: 'Missing authentication header'
        }
      });
    });

    it('should return 403 when user does not have Teacher role', async () => {
      mockAuthService.requireRole = jest.fn().mockImplementation(() => {
        throw new Error('Insufficient permissions');
      });

      const request = {
        params: { sessionId: 'session-123' },
        query: new Map(),
        headers: new Map([['x-ms-client-principal', 'base64-encoded-principal']])
      } as any as HttpRequest;

      const response = await getSession(request, mockContext);

      expect(response.status).toBe(403);
      expect(response.jsonBody).toMatchObject({
        error: {
          code: 'FORBIDDEN',
          message: 'Insufficient permissions'
        }
      });
    });

    it('should return 403 when teacher does not own the session', async () => {
      const mockSession: Session = {
        sessionId: 'session-123',
        classId: 'class-1',
        teacherId: 'other-teacher-456',
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

      mockSessionService.getSession = jest.fn().mockResolvedValue(mockSession);

      const request = {
        params: { sessionId: 'session-123' },
        query: new Map(),
        headers: new Map([['x-ms-client-principal', 'base64-encoded-principal']])
      } as any as HttpRequest;

      const response = await getSession(request, mockContext);

      expect(response.status).toBe(403);
      expect(response.jsonBody).toMatchObject({
        error: {
          code: 'FORBIDDEN',
          message: 'You do not own this session'
        }
      });
    });
  });

  describe('Request Validation', () => {
    it('should return 400 when sessionId parameter is missing', async () => {
      const request = {
        params: {},
        query: new Map(),
        headers: new Map([['x-ms-client-principal', 'base64-encoded-principal']])
      } as any as HttpRequest;

      const response = await getSession(request, mockContext);

      expect(response.status).toBe(400);
      expect(response.jsonBody).toMatchObject({
        error: {
          code: 'INVALID_REQUEST',
          message: 'Missing sessionId parameter'
        }
      });
    });

    it('should return 404 when session does not exist', async () => {
      mockSessionService.getSession = jest.fn().mockResolvedValue(null);

      const request = {
        params: { sessionId: 'session-123' },
        query: new Map(),
        headers: new Map([['x-ms-client-principal', 'base64-encoded-principal']])
      } as any as HttpRequest;

      const response = await getSession(request, mockContext);

      expect(response.status).toBe(404);
      expect(response.jsonBody).toMatchObject({
        error: {
          code: 'NOT_FOUND',
          message: 'Session not found'
        }
      });
    });
  });

  describe('Successful Session Retrieval', () => {
    it('should return session with attendance, chains, and stats', async () => {
      // Mock session
      const mockSession: Session = {
        sessionId: 'session-123',
        classId: 'class-1',
        teacherId: 'teacher-123',
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

      // Mock attendance records
      const mockAttendance: AttendanceRecord[] = [
        {
          sessionId: 'session-123',
          studentId: 'student-1',
          entryStatus: EntryStatus.PRESENT_ENTRY,
          entryAt: 1704103200,
          exitVerified: true,
          exitVerifiedAt: 1704110400
        },
        {
          sessionId: 'session-123',
          studentId: 'student-2',
          entryStatus: EntryStatus.LATE_ENTRY,
          entryAt: 1704104100,
          exitVerified: false
        },
        {
          sessionId: 'session-123',
          studentId: 'student-3',
          entryStatus: EntryStatus.PRESENT_ENTRY,
          entryAt: 1704103300,
          exitVerified: false,
          earlyLeaveAt: 1704109500
        }
      ];

      // Mock chains
      const mockChains: Chain[] = [
        {
          sessionId: 'session-123',
          chainId: 'chain-1',
          phase: ChainPhase.ENTRY,
          index: 0,
          state: ChainState.ACTIVE,
          lastHolder: 'student-1',
          lastSeq: 5,
          lastAt: 1704103500
        },
        {
          sessionId: 'session-123',
          chainId: 'chain-2',
          phase: ChainPhase.ENTRY,
          index: 0,
          state: ChainState.STALLED,
          lastHolder: 'student-2',
          lastSeq: 2,
          lastAt: 1704103200
        }
      ];

      mockSessionService.getSession = jest.fn().mockResolvedValue(mockSession);
      (attendanceService.getAllAttendance as jest.Mock).mockResolvedValue(mockAttendance);
      (chainService.getChains as jest.Mock).mockResolvedValue(mockChains);

      const request = {
        params: { sessionId: 'session-123' },
        query: new Map(),
        headers: new Map([['x-ms-client-principal', 'base64-encoded-principal']])
      } as any as HttpRequest;

      const response = await getSession(request, mockContext);

      expect(response.status).toBe(200);
      expect(response.jsonBody).toMatchObject({
        session: mockSession,
        attendance: mockAttendance,
        chains: mockChains,
        stats: {
          totalStudents: 3,
          presentEntry: 2,
          lateEntry: 1,
          earlyLeave: 1,
          exitVerified: 1,
          notYetVerified: 1
        }
      });
    });

    it('should compute correct stats for empty attendance', async () => {
      const mockSession: Session = {
        sessionId: 'session-123',
        classId: 'class-1',
        teacherId: 'teacher-123',
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

      mockSessionService.getSession = jest.fn().mockResolvedValue(mockSession);
      (attendanceService.getAllAttendance as jest.Mock).mockResolvedValue([]);
      (chainService.getChains as jest.Mock).mockResolvedValue([]);

      const request = {
        params: { sessionId: 'session-123' },
        query: new Map(),
        headers: new Map([['x-ms-client-principal', 'base64-encoded-principal']])
      } as any as HttpRequest;

      const response = await getSession(request, mockContext);

      expect(response.status).toBe(200);
      expect(response.jsonBody).toMatchObject({
        stats: {
          totalStudents: 0,
          presentEntry: 0,
          lateEntry: 0,
          earlyLeave: 0,
          exitVerified: 0,
          notYetVerified: 0
        }
      });
    });

    it('should compute correct stats with all present and exit verified', async () => {
      const mockSession: Session = {
        sessionId: 'session-123',
        classId: 'class-1',
        teacherId: 'teacher-123',
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

      const mockAttendance: AttendanceRecord[] = [
        {
          sessionId: 'session-123',
          studentId: 'student-1',
          entryStatus: EntryStatus.PRESENT_ENTRY,
          entryAt: 1704103200,
          exitVerified: true,
          exitVerifiedAt: 1704110400
        },
        {
          sessionId: 'session-123',
          studentId: 'student-2',
          entryStatus: EntryStatus.PRESENT_ENTRY,
          entryAt: 1704103300,
          exitVerified: true,
          exitVerifiedAt: 1704110500
        }
      ];

      mockSessionService.getSession = jest.fn().mockResolvedValue(mockSession);
      (attendanceService.getAllAttendance as jest.Mock).mockResolvedValue(mockAttendance);
      (chainService.getChains as jest.Mock).mockResolvedValue([]);

      const request = {
        params: { sessionId: 'session-123' },
        query: new Map(),
        headers: new Map([['x-ms-client-principal', 'base64-encoded-principal']])
      } as any as HttpRequest;

      const response = await getSession(request, mockContext);

      expect(response.status).toBe(200);
      expect(response.jsonBody).toMatchObject({
        stats: {
          totalStudents: 2,
          presentEntry: 2,
          lateEntry: 0,
          earlyLeave: 0,
          exitVerified: 2,
          notYetVerified: 0
        }
      });
    });

    it('should compute correct stats with mixed attendance states', async () => {
      const mockSession: Session = {
        sessionId: 'session-123',
        classId: 'class-1',
        teacherId: 'teacher-123',
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

      const mockAttendance: AttendanceRecord[] = [
        // Present entry, exit verified
        {
          sessionId: 'session-123',
          studentId: 'student-1',
          entryStatus: EntryStatus.PRESENT_ENTRY,
          entryAt: 1704103200,
          exitVerified: true,
          exitVerifiedAt: 1704110400
        },
        // Late entry, not exit verified
        {
          sessionId: 'session-123',
          studentId: 'student-2',
          entryStatus: EntryStatus.LATE_ENTRY,
          entryAt: 1704104100,
          exitVerified: false
        },
        // Present entry, early leave
        {
          sessionId: 'session-123',
          studentId: 'student-3',
          entryStatus: EntryStatus.PRESENT_ENTRY,
          entryAt: 1704103300,
          exitVerified: false,
          earlyLeaveAt: 1704109500
        },
        // No entry status (joined but not marked)
        {
          sessionId: 'session-123',
          studentId: 'student-4',
          exitVerified: false
        },
        // Late entry, exit verified
        {
          sessionId: 'session-123',
          studentId: 'student-5',
          entryStatus: EntryStatus.LATE_ENTRY,
          entryAt: 1704104200,
          exitVerified: true,
          exitVerifiedAt: 1704110600
        }
      ];

      mockSessionService.getSession = jest.fn().mockResolvedValue(mockSession);
      (attendanceService.getAllAttendance as jest.Mock).mockResolvedValue(mockAttendance);
      (chainService.getChains as jest.Mock).mockResolvedValue([]);

      const request = {
        params: { sessionId: 'session-123' },
        query: new Map(),
        headers: new Map([['x-ms-client-principal', 'base64-encoded-principal']])
      } as any as HttpRequest;

      const response = await getSession(request, mockContext);

      expect(response.status).toBe(200);
      expect(response.jsonBody).toMatchObject({
        stats: {
          totalStudents: 5,
          presentEntry: 2,
          lateEntry: 2,
          earlyLeave: 1,
          exitVerified: 2,
          notYetVerified: 1 // student-2 has late entry but not exit verified and no early leave
        }
      });
    });
  });

  describe('Error Handling', () => {
    it('should return 500 when session service throws error', async () => {
      mockSessionService.getSession = jest.fn().mockRejectedValue(new Error('Database error'));

      const request = {
        params: { sessionId: 'session-123' },
        query: new Map(),
        headers: new Map([['x-ms-client-principal', 'base64-encoded-principal']])
      } as any as HttpRequest;

      const response = await getSession(request, mockContext);

      expect(response.status).toBe(500);
      expect(response.jsonBody).toMatchObject({
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to get session status'
        }
      });
    });

    it('should return 500 when attendance service throws error', async () => {
      const mockSession: Session = {
        sessionId: 'session-123',
        classId: 'class-1',
        teacherId: 'teacher-123',
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

      mockSessionService.getSession = jest.fn().mockResolvedValue(mockSession);
      (attendanceService.getAllAttendance as jest.Mock).mockRejectedValue(
        new Error('Attendance fetch error')
      );

      const request = {
        params: { sessionId: 'session-123' },
        query: new Map(),
        headers: new Map([['x-ms-client-principal', 'base64-encoded-principal']])
      } as any as HttpRequest;

      const response = await getSession(request, mockContext);

      expect(response.status).toBe(500);
      expect(response.jsonBody).toMatchObject({
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to get session status'
        }
      });
    });

    it('should return 500 when chain service throws error', async () => {
      const mockSession: Session = {
        sessionId: 'session-123',
        classId: 'class-1',
        teacherId: 'teacher-123',
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

      mockSessionService.getSession = jest.fn().mockResolvedValue(mockSession);
      (attendanceService.getAllAttendance as jest.Mock).mockResolvedValue([]);
      (chainService.getChains as jest.Mock).mockRejectedValue(
        new Error('Chain fetch error')
      );

      const request = {
        params: { sessionId: 'session-123' },
        query: new Map(),
        headers: new Map([['x-ms-client-principal', 'base64-encoded-principal']])
      } as any as HttpRequest;

      const response = await getSession(request, mockContext);

      expect(response.status).toBe(500);
      expect(response.jsonBody).toMatchObject({
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to get session status'
        }
      });
    });
  });
});
