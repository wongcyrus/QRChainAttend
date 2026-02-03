/**
 * Unit tests for Stop Early Leave Window API Endpoint
 * Feature: qr-chain-attendance
 * Requirements: 5.2
 */

import { HttpRequest, InvocationContext } from '@azure/functions';
import { stopEarlyLeave } from './stopEarlyLeave';
import { AuthService } from '../services/AuthService';
import { SessionService } from '../services/SessionService';
import { Role, SessionStatus, Session } from '../types';

// Mock services
jest.mock('../services/AuthService');
jest.mock('../services/SessionService');

describe('stopEarlyLeave', () => {
  let mockAuthService: jest.Mocked<AuthService>;
  let mockSessionService: jest.Mocked<SessionService>;
  let mockContext: InvocationContext;

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();

    // Create mock instances
    mockAuthService = new AuthService() as jest.Mocked<AuthService>;
    mockSessionService = new SessionService() as jest.Mocked<SessionService>;

    // Mock context
    mockContext = {
      log: jest.fn(),
      error: jest.fn(),
    } as unknown as InvocationContext;

    // Setup default mock implementations
    (AuthService as jest.Mock).mockImplementation(() => mockAuthService);
    (SessionService as jest.Mock).mockImplementation(() => mockSessionService);
  });

  describe('Authentication and Authorization', () => {
    it('should return 401 when authentication header is missing', async () => {
      const request = {
        headers: new Map(),
        params: { sessionId: 'session-123' }
      } as unknown as HttpRequest;

      const response = await stopEarlyLeave(request, mockContext);

      expect(response.status).toBe(401);
      expect(response.jsonBody).toEqual({
        error: {
          code: 'UNAUTHORIZED',
          message: 'Missing authentication header',
          timestamp: expect.any(Number)
        }
      });
    });

    it('should return 403 when user does not have Teacher role', async () => {
      const request = {
        headers: new Map([['x-ms-client-principal', 'encoded-principal']]),
        params: { sessionId: 'session-123' }
      } as unknown as HttpRequest;

      mockAuthService.parseUserPrincipal = jest.fn().mockReturnValue({
        userId: 'student-123',
        userEmail: 'student@stu.edu.hk',
        userRoles: [Role.STUDENT]
      });

      mockAuthService.requireRole = jest.fn().mockImplementation(() => {
        throw new Error('Insufficient permissions');
      });

      const response = await stopEarlyLeave(request, mockContext);

      expect(response.status).toBe(403);
      expect(response.jsonBody).toEqual({
        error: {
          code: 'FORBIDDEN',
          message: 'Insufficient permissions',
          timestamp: expect.any(Number)
        }
      });
    });

    it('should return 403 when teacher does not own the session', async () => {
      const sessionId = 'session-123';
      const teacherId = 'teacher-123';
      const otherTeacherId = 'teacher-456';

      const request = {
        headers: new Map([['x-ms-client-principal', 'encoded-principal']]),
        params: { sessionId }
      } as unknown as HttpRequest;

      const mockSession: Session = {
        sessionId,
        classId: 'class-123',
        teacherId: otherTeacherId,
        startAt: new Date().toISOString(),
        endAt: new Date(Date.now() + 3600000).toISOString(),
        lateCutoffMinutes: 15,
        exitWindowMinutes: 10,
        status: SessionStatus.ACTIVE,
        ownerTransfer: true,
        lateEntryActive: false,
        earlyLeaveActive: true,
        createdAt: new Date().toISOString()
      };

      mockAuthService.parseUserPrincipal = jest.fn().mockReturnValue({
        userId: teacherId,
        userEmail: 'teacher@vtc.edu.hk',
        userRoles: [Role.TEACHER]
      });

      mockAuthService.requireRole = jest.fn();
      mockAuthService.getUserId = jest.fn().mockReturnValue(teacherId);
      mockSessionService.getSession = jest.fn().mockResolvedValue(mockSession);

      const response = await stopEarlyLeave(request, mockContext);

      expect(response.status).toBe(403);
      expect(response.jsonBody).toEqual({
        error: {
          code: 'FORBIDDEN',
          message: 'Unauthorized: You do not own this session',
          timestamp: expect.any(Number)
        }
      });
    });
  });

  describe('Request Validation', () => {
    it('should return 400 when sessionId parameter is missing', async () => {
      const request = {
        headers: new Map([['x-ms-client-principal', 'encoded-principal']]),
        params: {}
      } as unknown as HttpRequest;

      mockAuthService.parseUserPrincipal = jest.fn().mockReturnValue({
        userId: 'teacher-123',
        userEmail: 'teacher@vtc.edu.hk',
        userRoles: [Role.TEACHER]
      });

      mockAuthService.requireRole = jest.fn();

      const response = await stopEarlyLeave(request, mockContext);

      expect(response.status).toBe(400);
      expect(response.jsonBody).toEqual({
        error: {
          code: 'INVALID_REQUEST',
          message: 'Missing sessionId parameter',
          timestamp: expect.any(Number)
        }
      });
    });

    it('should return 404 when session does not exist', async () => {
      const sessionId = 'nonexistent-session';

      const request = {
        headers: new Map([['x-ms-client-principal', 'encoded-principal']]),
        params: { sessionId }
      } as unknown as HttpRequest;

      mockAuthService.parseUserPrincipal = jest.fn().mockReturnValue({
        userId: 'teacher-123',
        userEmail: 'teacher@vtc.edu.hk',
        userRoles: [Role.TEACHER]
      });

      mockAuthService.requireRole = jest.fn();
      mockSessionService.getSession = jest.fn().mockResolvedValue(null);

      const response = await stopEarlyLeave(request, mockContext);

      expect(response.status).toBe(404);
      expect(response.jsonBody).toEqual({
        error: {
          code: 'NOT_FOUND',
          message: 'Session not found',
          timestamp: expect.any(Number)
        }
      });
    });
  });

  describe('Business Logic Validation', () => {
    it('should return 400 when session is not active', async () => {
      const sessionId = 'session-123';
      const teacherId = 'teacher-123';

      const request = {
        headers: new Map([['x-ms-client-principal', 'encoded-principal']]),
        params: { sessionId }
      } as unknown as HttpRequest;

      const mockSession: Session = {
        sessionId,
        classId: 'class-123',
        teacherId,
        startAt: new Date().toISOString(),
        endAt: new Date(Date.now() + 3600000).toISOString(),
        lateCutoffMinutes: 15,
        exitWindowMinutes: 10,
        status: SessionStatus.ENDED,
        ownerTransfer: true,
        lateEntryActive: false,
        earlyLeaveActive: true,
        createdAt: new Date().toISOString()
      };

      mockAuthService.parseUserPrincipal = jest.fn().mockReturnValue({
        userId: teacherId,
        userEmail: 'teacher@vtc.edu.hk',
        userRoles: [Role.TEACHER]
      });

      mockAuthService.requireRole = jest.fn();
      mockAuthService.getUserId = jest.fn().mockReturnValue(teacherId);
      mockSessionService.getSession = jest.fn().mockResolvedValue(mockSession);

      const response = await stopEarlyLeave(request, mockContext);

      expect(response.status).toBe(400);
      expect(response.jsonBody).toEqual({
        error: {
          code: 'INVALID_STATE',
          message: 'Session is not active',
          timestamp: expect.any(Number)
        }
      });
    });

    it('should return 400 when early leave window is not active', async () => {
      const sessionId = 'session-123';
      const teacherId = 'teacher-123';

      const request = {
        headers: new Map([['x-ms-client-principal', 'encoded-principal']]),
        params: { sessionId }
      } as unknown as HttpRequest;

      const mockSession: Session = {
        sessionId,
        classId: 'class-123',
        teacherId,
        startAt: new Date().toISOString(),
        endAt: new Date(Date.now() + 3600000).toISOString(),
        lateCutoffMinutes: 15,
        exitWindowMinutes: 10,
        status: SessionStatus.ACTIVE,
        ownerTransfer: true,
        lateEntryActive: false,
        earlyLeaveActive: false,
        createdAt: new Date().toISOString()
      };

      mockAuthService.parseUserPrincipal = jest.fn().mockReturnValue({
        userId: teacherId,
        userEmail: 'teacher@vtc.edu.hk',
        userRoles: [Role.TEACHER]
      });

      mockAuthService.requireRole = jest.fn();
      mockAuthService.getUserId = jest.fn().mockReturnValue(teacherId);
      mockSessionService.getSession = jest.fn().mockResolvedValue(mockSession);

      const response = await stopEarlyLeave(request, mockContext);

      expect(response.status).toBe(400);
      expect(response.jsonBody).toEqual({
        error: {
          code: 'INVALID_STATE',
          message: 'Early leave window is not active',
          timestamp: expect.any(Number)
        }
      });
    });
  });

  describe('Successful Early Leave Stop', () => {
    it('should successfully stop early leave window and clear flag', async () => {
      const sessionId = 'session-123';
      const teacherId = 'teacher-123';

      const request = {
        headers: new Map([['x-ms-client-principal', 'encoded-principal']]),
        params: { sessionId }
      } as unknown as HttpRequest;

      const mockSession: Session = {
        sessionId,
        classId: 'class-123',
        teacherId,
        startAt: new Date().toISOString(),
        endAt: new Date(Date.now() + 3600000).toISOString(),
        lateCutoffMinutes: 15,
        exitWindowMinutes: 10,
        status: SessionStatus.ACTIVE,
        ownerTransfer: true,
        lateEntryActive: false,
        earlyLeaveActive: true,
        currentEarlyTokenId: 'token-123',
        createdAt: new Date().toISOString()
      };

      mockAuthService.parseUserPrincipal = jest.fn().mockReturnValue({
        userId: teacherId,
        userEmail: 'teacher@vtc.edu.hk',
        userRoles: [Role.TEACHER]
      });

      mockAuthService.requireRole = jest.fn();
      mockAuthService.getUserId = jest.fn().mockReturnValue(teacherId);
      mockSessionService.getSession = jest.fn().mockResolvedValue(mockSession);
      mockSessionService.updateEarlyLeaveStatus = jest.fn().mockResolvedValue(undefined);

      const response = await stopEarlyLeave(request, mockContext);

      expect(response.status).toBe(200);
      expect(response.jsonBody).toEqual({
        success: true,
        message: 'Early leave window stopped successfully'
      });

      // Verify that updateEarlyLeaveStatus was called with correct parameters
      expect(mockSessionService.updateEarlyLeaveStatus).toHaveBeenCalledWith(
        sessionId,
        false
      );

      // Verify logging
      expect(mockContext.log).toHaveBeenCalledWith(
        `Early leave window stopped for session ${sessionId}`
      );
    });

    it('should handle valid request with all required fields', async () => {
      const sessionId = 'session-456';
      const teacherId = 'teacher-456';

      const request = {
        headers: new Map([['x-ms-client-principal', 'encoded-principal']]),
        params: { sessionId }
      } as unknown as HttpRequest;

      const mockSession: Session = {
        sessionId,
        classId: 'class-456',
        teacherId,
        startAt: new Date().toISOString(),
        endAt: new Date(Date.now() + 7200000).toISOString(),
        lateCutoffMinutes: 20,
        exitWindowMinutes: 15,
        status: SessionStatus.ACTIVE,
        ownerTransfer: false,
        lateEntryActive: true,
        earlyLeaveActive: true,
        currentEarlyTokenId: 'token-456',
        createdAt: new Date().toISOString()
      };

      mockAuthService.parseUserPrincipal = jest.fn().mockReturnValue({
        userId: teacherId,
        userEmail: 'teacher@vtc.edu.hk',
        userRoles: [Role.TEACHER]
      });

      mockAuthService.requireRole = jest.fn();
      mockAuthService.getUserId = jest.fn().mockReturnValue(teacherId);
      mockSessionService.getSession = jest.fn().mockResolvedValue(mockSession);
      mockSessionService.updateEarlyLeaveStatus = jest.fn().mockResolvedValue(undefined);

      const response = await stopEarlyLeave(request, mockContext);

      expect(response.status).toBe(200);
      expect(response.jsonBody.success).toBe(true);
      expect(mockSessionService.updateEarlyLeaveStatus).toHaveBeenCalledTimes(1);
    });
  });

  describe('Error Handling', () => {
    it('should return 500 when SessionService throws an error', async () => {
      const sessionId = 'session-123';
      const teacherId = 'teacher-123';

      const request = {
        headers: new Map([['x-ms-client-principal', 'encoded-principal']]),
        params: { sessionId }
      } as unknown as HttpRequest;

      const mockSession: Session = {
        sessionId,
        classId: 'class-123',
        teacherId,
        startAt: new Date().toISOString(),
        endAt: new Date(Date.now() + 3600000).toISOString(),
        lateCutoffMinutes: 15,
        exitWindowMinutes: 10,
        status: SessionStatus.ACTIVE,
        ownerTransfer: true,
        lateEntryActive: false,
        earlyLeaveActive: true,
        createdAt: new Date().toISOString()
      };

      mockAuthService.parseUserPrincipal = jest.fn().mockReturnValue({
        userId: teacherId,
        userEmail: 'teacher@vtc.edu.hk',
        userRoles: [Role.TEACHER]
      });

      mockAuthService.requireRole = jest.fn();
      mockAuthService.getUserId = jest.fn().mockReturnValue(teacherId);
      mockSessionService.getSession = jest.fn().mockResolvedValue(mockSession);
      mockSessionService.updateEarlyLeaveStatus = jest.fn().mockRejectedValue(
        new Error('Database connection failed')
      );

      const response = await stopEarlyLeave(request, mockContext);

      expect(response.status).toBe(500);
      expect(response.jsonBody).toEqual({
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to stop early leave window',
          details: 'Database connection failed',
          timestamp: expect.any(Number)
        }
      });

      expect(mockContext.error).toHaveBeenCalledWith(
        'Error stopping early leave window:',
        expect.any(Error)
      );
    });

    it('should return 500 when getSession throws an unexpected error', async () => {
      const sessionId = 'session-123';

      const request = {
        headers: new Map([['x-ms-client-principal', 'encoded-principal']]),
        params: { sessionId }
      } as unknown as HttpRequest;

      mockAuthService.parseUserPrincipal = jest.fn().mockReturnValue({
        userId: 'teacher-123',
        userEmail: 'teacher@vtc.edu.hk',
        userRoles: [Role.TEACHER]
      });

      mockAuthService.requireRole = jest.fn();
      mockSessionService.getSession = jest.fn().mockRejectedValue(
        new Error('Storage service unavailable')
      );

      const response = await stopEarlyLeave(request, mockContext);

      expect(response.status).toBe(500);
      expect(response.jsonBody.error.code).toBe('INTERNAL_ERROR');
      expect(response.jsonBody.error.details).toBe('Storage service unavailable');
    });
  });
});
