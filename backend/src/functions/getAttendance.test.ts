/**
 * Unit Tests for Get Attendance API Endpoint
 * Feature: qr-chain-attendance
 * Requirements: 14.1, 14.2, 14.3, 14.4, 14.5
 */

import { HttpRequest, InvocationContext } from '@azure/functions';
import { getAttendance } from './getAttendance';
import { SessionService } from '../services/SessionService';
import { attendanceService } from '../services/AttendanceService';
import { AuthService } from '../services/AuthService';
import { 
  SessionStatus, 
  EntryStatus, 
  FinalStatus,
  Session,
  AttendanceRecord,
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

describe('getAttendance', () => {
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

      const response = await getAttendance(request, mockContext);

      expect(response.status).toBe(401);
      expect(response.jsonBody).toMatchObject({
        error: {
          code: 'UNAUTHORIZED',
          message: 'Missing authentication header'
        }
      });
    });

    it('should return 403 when user does not have Teacher role (Requirement 14.5)', async () => {
      mockAuthService.requireRole = jest.fn().mockImplementation(() => {
        throw new Error('Insufficient permissions');
      });

      const request = {
        params: { sessionId: 'session-123' },
        query: new Map(),
        headers: new Map([['x-ms-client-principal', 'base64-encoded-principal']])
      } as any as HttpRequest;

      const response = await getAttendance(request, mockContext);

      expect(response.status).toBe(403);
      expect(response.jsonBody).toMatchObject({
        error: {
          code: 'FORBIDDEN',
          message: 'Insufficient permissions'
        }
      });
    });

    it('should return 403 when teacher does not own the session (Requirement 14.5)', async () => {
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

      const response = await getAttendance(request, mockContext);

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

      const response = await getAttendance(request, mockContext);

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

      const response = await getAttendance(request, mockContext);

      expect(response.status).toBe(404);
      expect(response.jsonBody).toMatchObject({
        error: {
          code: 'NOT_FOUND',
          message: 'Session not found'
        }
      });
    });
  });

  describe('Attendance Retrieval for Ended Sessions', () => {
    it('should return attendance with finalStatus for ended session (Requirements 14.1, 14.2)', async () => {
      // Mock ended session
      const mockSession: Session = {
        sessionId: 'session-123',
        classId: 'class-1',
        teacherId: 'teacher-123',
        startAt: '2024-01-01T10:00:00Z',
        endAt: '2024-01-01T12:00:00Z',
        lateCutoffMinutes: 15,
        exitWindowMinutes: 10,
        status: SessionStatus.ENDED,
        ownerTransfer: true,
        lateEntryActive: false,
        earlyLeaveActive: false,
        createdAt: '2024-01-01T09:00:00Z',
        endedAt: '2024-01-01T12:00:00Z'
      };

      // Mock attendance records with finalStatus (Requirement 14.2)
      const mockAttendance: AttendanceRecord[] = [
        {
          sessionId: 'session-123',
          studentId: 'student-1',
          entryStatus: EntryStatus.PRESENT_ENTRY,
          entryAt: 1704103200,
          exitVerified: true,
          exitVerifiedAt: 1704110400,
          finalStatus: FinalStatus.PRESENT
        },
        {
          sessionId: 'session-123',
          studentId: 'student-2',
          entryStatus: EntryStatus.LATE_ENTRY,
          entryAt: 1704104100,
          exitVerified: true,
          exitVerifiedAt: 1704110500,
          finalStatus: FinalStatus.LATE
        },
        {
          sessionId: 'session-123',
          studentId: 'student-3',
          entryStatus: EntryStatus.PRESENT_ENTRY,
          entryAt: 1704103300,
          exitVerified: false,
          earlyLeaveAt: 1704109500,
          finalStatus: FinalStatus.EARLY_LEAVE
        },
        {
          sessionId: 'session-123',
          studentId: 'student-4',
          exitVerified: false,
          finalStatus: FinalStatus.ABSENT
        }
      ];

      mockSessionService.getSession = jest.fn().mockResolvedValue(mockSession);
      (attendanceService.getAllAttendance as jest.Mock).mockResolvedValue(mockAttendance);

      const request = {
        params: { sessionId: 'session-123' },
        query: new Map(),
        headers: new Map([['x-ms-client-principal', 'base64-encoded-principal']])
      } as any as HttpRequest;

      const response = await getAttendance(request, mockContext);

      expect(response.status).toBe(200);
      expect(response.jsonBody).toMatchObject({
        attendance: mockAttendance
      });

      // Verify all records include finalStatus (Requirement 14.2)
      const attendance = response.jsonBody.attendance;
      expect(attendance).toHaveLength(4);
      attendance.forEach((record: AttendanceRecord) => {
        expect(record.finalStatus).toBeDefined();
      });
    });

    it('should include all required fields in attendance records (Requirement 14.2)', async () => {
      const mockSession: Session = {
        sessionId: 'session-123',
        classId: 'class-1',
        teacherId: 'teacher-123',
        startAt: '2024-01-01T10:00:00Z',
        endAt: '2024-01-01T12:00:00Z',
        lateCutoffMinutes: 15,
        exitWindowMinutes: 10,
        status: SessionStatus.ENDED,
        ownerTransfer: true,
        lateEntryActive: false,
        earlyLeaveActive: false,
        createdAt: '2024-01-01T09:00:00Z',
        endedAt: '2024-01-01T12:00:00Z'
      };

      const mockAttendance: AttendanceRecord[] = [
        {
          sessionId: 'session-123',
          studentId: 'student-1',
          entryStatus: EntryStatus.PRESENT_ENTRY,
          entryAt: 1704103200,
          exitVerified: true,
          exitVerifiedAt: 1704110400,
          finalStatus: FinalStatus.PRESENT
        }
      ];

      mockSessionService.getSession = jest.fn().mockResolvedValue(mockSession);
      (attendanceService.getAllAttendance as jest.Mock).mockResolvedValue(mockAttendance);

      const request = {
        params: { sessionId: 'session-123' },
        query: new Map(),
        headers: new Map([['x-ms-client-principal', 'base64-encoded-principal']])
      } as any as HttpRequest;

      const response = await getAttendance(request, mockContext);

      expect(response.status).toBe(200);
      
      const record = response.jsonBody.attendance[0];
      // Verify all required fields are present (Requirement 14.2)
      expect(record).toHaveProperty('studentId');
      expect(record).toHaveProperty('entryStatus');
      expect(record).toHaveProperty('entryAt');
      expect(record).toHaveProperty('exitVerified');
      expect(record).toHaveProperty('exitVerifiedAt');
      expect(record).toHaveProperty('finalStatus');
    });

    it('should return valid JSON format (Requirement 14.3)', async () => {
      const mockSession: Session = {
        sessionId: 'session-123',
        classId: 'class-1',
        teacherId: 'teacher-123',
        startAt: '2024-01-01T10:00:00Z',
        endAt: '2024-01-01T12:00:00Z',
        lateCutoffMinutes: 15,
        exitWindowMinutes: 10,
        status: SessionStatus.ENDED,
        ownerTransfer: true,
        lateEntryActive: false,
        earlyLeaveActive: false,
        createdAt: '2024-01-01T09:00:00Z',
        endedAt: '2024-01-01T12:00:00Z'
      };

      const mockAttendance: AttendanceRecord[] = [
        {
          sessionId: 'session-123',
          studentId: 'student-1',
          entryStatus: EntryStatus.PRESENT_ENTRY,
          entryAt: 1704103200,
          exitVerified: true,
          exitVerifiedAt: 1704110400,
          finalStatus: FinalStatus.PRESENT
        }
      ];

      mockSessionService.getSession = jest.fn().mockResolvedValue(mockSession);
      (attendanceService.getAllAttendance as jest.Mock).mockResolvedValue(mockAttendance);

      const request = {
        params: { sessionId: 'session-123' },
        query: new Map(),
        headers: new Map([['x-ms-client-principal', 'base64-encoded-principal']])
      } as any as HttpRequest;

      const response = await getAttendance(request, mockContext);

      expect(response.status).toBe(200);
      
      // Verify response can be serialized to JSON (Requirement 14.3)
      expect(() => JSON.stringify(response.jsonBody)).not.toThrow();
      
      // Verify response structure
      expect(response.jsonBody).toHaveProperty('attendance');
      expect(Array.isArray(response.jsonBody.attendance)).toBe(true);
    });
  });

  describe('Attendance Retrieval for Active Sessions', () => {
    it('should exclude finalStatus for active session (Requirement 14.4)', async () => {
      // Mock active session
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

      // Mock attendance records (may have finalStatus from storage, but should be filtered)
      const mockAttendance: AttendanceRecord[] = [
        {
          sessionId: 'session-123',
          studentId: 'student-1',
          entryStatus: EntryStatus.PRESENT_ENTRY,
          entryAt: 1704103200,
          exitVerified: true,
          exitVerifiedAt: 1704110400,
          finalStatus: FinalStatus.PRESENT  // Should be excluded
        },
        {
          sessionId: 'session-123',
          studentId: 'student-2',
          entryStatus: EntryStatus.LATE_ENTRY,
          entryAt: 1704104100,
          exitVerified: false
        }
      ];

      mockSessionService.getSession = jest.fn().mockResolvedValue(mockSession);
      (attendanceService.getAllAttendance as jest.Mock).mockResolvedValue(mockAttendance);

      const request = {
        params: { sessionId: 'session-123' },
        query: new Map(),
        headers: new Map([['x-ms-client-principal', 'base64-encoded-principal']])
      } as any as HttpRequest;

      const response = await getAttendance(request, mockContext);

      expect(response.status).toBe(200);
      
      // Verify finalStatus is excluded for all records (Requirement 14.4)
      const attendance = response.jsonBody.attendance;
      expect(attendance).toHaveLength(2);
      attendance.forEach((record: AttendanceRecord) => {
        expect(record.finalStatus).toBeUndefined();
      });

      // Verify other fields are still present
      expect(attendance[0]).toHaveProperty('studentId');
      expect(attendance[0]).toHaveProperty('entryStatus');
      expect(attendance[0]).toHaveProperty('exitVerified');
    });

    it('should return current attendance state without finalStatus for active session', async () => {
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
          exitVerified: false
        },
        {
          sessionId: 'session-123',
          studentId: 'student-2',
          exitVerified: false
        }
      ];

      mockSessionService.getSession = jest.fn().mockResolvedValue(mockSession);
      (attendanceService.getAllAttendance as jest.Mock).mockResolvedValue(mockAttendance);

      const request = {
        params: { sessionId: 'session-123' },
        query: new Map(),
        headers: new Map([['x-ms-client-principal', 'base64-encoded-principal']])
      } as any as HttpRequest;

      const response = await getAttendance(request, mockContext);

      expect(response.status).toBe(200);
      expect(response.jsonBody).toMatchObject({
        attendance: [
          {
            sessionId: 'session-123',
            studentId: 'student-1',
            entryStatus: EntryStatus.PRESENT_ENTRY,
            entryAt: 1704103200,
            exitVerified: false
          },
          {
            sessionId: 'session-123',
            studentId: 'student-2',
            exitVerified: false
          }
        ]
      });
    });
  });

  describe('Edge Cases', () => {
    it('should return empty attendance array when no students enrolled', async () => {
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

      const request = {
        params: { sessionId: 'session-123' },
        query: new Map(),
        headers: new Map([['x-ms-client-principal', 'base64-encoded-principal']])
      } as any as HttpRequest;

      const response = await getAttendance(request, mockContext);

      expect(response.status).toBe(200);
      expect(response.jsonBody).toMatchObject({
        attendance: []
      });
    });

    it('should handle attendance records with optional fields missing', async () => {
      const mockSession: Session = {
        sessionId: 'session-123',
        classId: 'class-1',
        teacherId: 'teacher-123',
        startAt: '2024-01-01T10:00:00Z',
        endAt: '2024-01-01T12:00:00Z',
        lateCutoffMinutes: 15,
        exitWindowMinutes: 10,
        status: SessionStatus.ENDED,
        ownerTransfer: true,
        lateEntryActive: false,
        earlyLeaveActive: false,
        createdAt: '2024-01-01T09:00:00Z',
        endedAt: '2024-01-01T12:00:00Z'
      };

      // Attendance record with minimal fields
      const mockAttendance: AttendanceRecord[] = [
        {
          sessionId: 'session-123',
          studentId: 'student-1',
          exitVerified: false,
          finalStatus: FinalStatus.ABSENT
        }
      ];

      mockSessionService.getSession = jest.fn().mockResolvedValue(mockSession);
      (attendanceService.getAllAttendance as jest.Mock).mockResolvedValue(mockAttendance);

      const request = {
        params: { sessionId: 'session-123' },
        query: new Map(),
        headers: new Map([['x-ms-client-principal', 'base64-encoded-principal']])
      } as any as HttpRequest;

      const response = await getAttendance(request, mockContext);

      expect(response.status).toBe(200);
      expect(response.jsonBody.attendance[0]).toMatchObject({
        sessionId: 'session-123',
        studentId: 'student-1',
        exitVerified: false,
        finalStatus: FinalStatus.ABSENT
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

      const response = await getAttendance(request, mockContext);

      expect(response.status).toBe(500);
      expect(response.jsonBody).toMatchObject({
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to get attendance records'
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

      const response = await getAttendance(request, mockContext);

      expect(response.status).toBe(500);
      expect(response.jsonBody).toMatchObject({
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to get attendance records'
        }
      });
    });
  });
});
