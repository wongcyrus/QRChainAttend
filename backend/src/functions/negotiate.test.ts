/**
 * Unit Tests for SignalR Negotiate Endpoint
 * Feature: qr-chain-attendance
 * Requirements: 12.6
 */

import { HttpRequest, InvocationContext } from '@azure/functions';
import { negotiate } from './negotiate';
import { SessionService } from '../services/SessionService';
import { Session, SessionStatus, Role } from '../types';

// Mock dependencies
jest.mock('../services/SessionService');

describe('negotiate endpoint', () => {
  let mockContext: InvocationContext;
  let mockSessionService: jest.Mocked<SessionService>;

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();

    // Mock InvocationContext
    mockContext = {
      log: jest.fn(),
      error: jest.fn(),
      extraInputs: {
        get: jest.fn()
      }
    } as any;

    // Mock SessionService
    mockSessionService = new SessionService() as jest.Mocked<SessionService>;
    (SessionService as jest.Mock).mockImplementation(() => mockSessionService);
  });

  /**
   * Helper to create mock HTTP request
   */
  function createMockRequest(
    sessionId: string,
    principalHeader?: string
  ): HttpRequest {
    return {
      params: { sessionId },
      headers: {
        get: (name: string) => {
          if (name === 'x-ms-client-principal') {
            return principalHeader;
          }
          return null;
        }
      }
    } as any;
  }

  /**
   * Helper to create mock user principal header
   */
  function createPrincipalHeader(userId: string, email: string): string {
    const principal = {
      userId,
      userDetails: email,
      identityProvider: 'aad',
      userRoles: []
    };
    return Buffer.from(JSON.stringify(principal)).toString('base64');
  }

  /**
   * Helper to create mock session
   */
  function createMockSession(sessionId: string, teacherId: string): Session {
    return {
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
  }

  describe('Authentication and Authorization', () => {
    test('should return 401 when authentication header is missing', async () => {
      const request = createMockRequest('session-123');
      
      const response = await negotiate(request, mockContext);
      
      expect(response.status).toBe(401);
      expect(response.jsonBody).toMatchObject({
        error: {
          code: 'UNAUTHORIZED',
          message: 'Missing authentication header'
        }
      });
    });

    test('should return 403 when user is not a teacher', async () => {
      const studentEmail = 'student@stu.edu.hk';
      const principalHeader = createPrincipalHeader('student-123', studentEmail);
      const request = createMockRequest('session-123', principalHeader);
      
      const response = await negotiate(request, mockContext);
      
      expect(response.status).toBe(403);
      expect(response.jsonBody).toMatchObject({
        error: {
          code: 'FORBIDDEN',
          message: expect.stringContaining('teacher')
        }
      });
    });

    test('should allow teacher with @vtc.edu.hk email', async () => {
      const teacherEmail = 'teacher@vtc.edu.hk';
      const teacherId = 'teacher-123';
      const sessionId = 'session-123';
      const principalHeader = createPrincipalHeader(teacherId, teacherEmail);
      const request = createMockRequest(sessionId, principalHeader);

      const mockSession = createMockSession(sessionId, teacherId);
      mockSessionService.getSession.mockResolvedValue(mockSession);

      const mockConnectionInfo = {
        url: 'https://signalr.service.signalr.net/client/?hub=attendance',
        accessToken: 'mock-jwt-token'
      };
      (mockContext.extraInputs.get as jest.Mock).mockReturnValue(mockConnectionInfo);
      
      const response = await negotiate(request, mockContext);
      
      expect(response.status).toBe(200);
    });
  });

  describe('Session Validation', () => {
    test('should return 400 when sessionId is missing', async () => {
      const teacherEmail = 'teacher@vtc.edu.hk';
      const principalHeader = createPrincipalHeader('teacher-123', teacherEmail);
      const request = {
        params: {},
        headers: {
          get: (name: string) => name === 'x-ms-client-principal' ? principalHeader : null
        }
      } as any;
      
      const response = await negotiate(request, mockContext);
      
      expect(response.status).toBe(400);
      expect(response.jsonBody).toMatchObject({
        error: {
          code: 'INVALID_REQUEST',
          message: 'Missing sessionId parameter'
        }
      });
    });

    test('should return 404 when session does not exist', async () => {
      const teacherEmail = 'teacher@vtc.edu.hk';
      const principalHeader = createPrincipalHeader('teacher-123', teacherEmail);
      const request = createMockRequest('nonexistent-session', principalHeader);

      mockSessionService.getSession.mockResolvedValue(null);
      
      const response = await negotiate(request, mockContext);
      
      expect(response.status).toBe(404);
      expect(response.jsonBody).toMatchObject({
        error: {
          code: 'NOT_FOUND',
          message: 'Session not found'
        }
      });
    });

    test('should return 403 when teacher does not own the session', async () => {
      const teacherEmail = 'teacher@vtc.edu.hk';
      const teacherId = 'teacher-123';
      const sessionId = 'session-123';
      const principalHeader = createPrincipalHeader(teacherId, teacherEmail);
      const request = createMockRequest(sessionId, principalHeader);

      // Session owned by different teacher
      const mockSession = createMockSession(sessionId, 'other-teacher-456');
      mockSessionService.getSession.mockResolvedValue(mockSession);
      
      const response = await negotiate(request, mockContext);
      
      expect(response.status).toBe(403);
      expect(response.jsonBody).toMatchObject({
        error: {
          code: 'FORBIDDEN',
          message: 'You do not own this session'
        }
      });
    });
  });

  describe('SignalR Connection Negotiation', () => {
    test('should return SignalR connection info on success', async () => {
      const teacherEmail = 'teacher@vtc.edu.hk';
      const teacherId = 'teacher-123';
      const sessionId = 'session-123';
      const principalHeader = createPrincipalHeader(teacherId, teacherEmail);
      const request = createMockRequest(sessionId, principalHeader);

      const mockSession = createMockSession(sessionId, teacherId);
      mockSessionService.getSession.mockResolvedValue(mockSession);

      const mockConnectionInfo = {
        url: 'https://signalr.service.signalr.net/client/?hub=attendance',
        accessToken: 'mock-jwt-token-abc123'
      };
      (mockContext.extraInputs.get as jest.Mock).mockReturnValue(mockConnectionInfo);
      
      const response = await negotiate(request, mockContext);
      
      expect(response.status).toBe(200);
      expect(response.jsonBody).toEqual(mockConnectionInfo);
      expect(response.jsonBody).toHaveProperty('url');
      expect(response.jsonBody).toHaveProperty('accessToken');
    });

    test('should call SessionService.getSession with correct sessionId', async () => {
      const teacherEmail = 'teacher@vtc.edu.hk';
      const teacherId = 'teacher-123';
      const sessionId = 'session-456';
      const principalHeader = createPrincipalHeader(teacherId, teacherEmail);
      const request = createMockRequest(sessionId, principalHeader);

      const mockSession = createMockSession(sessionId, teacherId);
      mockSessionService.getSession.mockResolvedValue(mockSession);

      const mockConnectionInfo = {
        url: 'https://signalr.service.signalr.net/client/?hub=attendance',
        accessToken: 'mock-jwt-token'
      };
      (mockContext.extraInputs.get as jest.Mock).mockReturnValue(mockConnectionInfo);
      
      await negotiate(request, mockContext);
      
      expect(mockSessionService.getSession).toHaveBeenCalledWith(sessionId);
    });

    test('should retrieve connection info from SignalR input binding', async () => {
      const teacherEmail = 'teacher@vtc.edu.hk';
      const teacherId = 'teacher-123';
      const sessionId = 'session-123';
      const principalHeader = createPrincipalHeader(teacherId, teacherEmail);
      const request = createMockRequest(sessionId, principalHeader);

      const mockSession = createMockSession(sessionId, teacherId);
      mockSessionService.getSession.mockResolvedValue(mockSession);

      const mockConnectionInfo = {
        url: 'https://signalr.service.signalr.net/client/?hub=attendance',
        accessToken: 'mock-jwt-token'
      };
      (mockContext.extraInputs.get as jest.Mock).mockReturnValue(mockConnectionInfo);
      
      await negotiate(request, mockContext);
      
      expect(mockContext.extraInputs.get).toHaveBeenCalled();
    });

    test('should log successful negotiation', async () => {
      const teacherEmail = 'teacher@vtc.edu.hk';
      const teacherId = 'teacher-123';
      const sessionId = 'session-123';
      const principalHeader = createPrincipalHeader(teacherId, teacherEmail);
      const request = createMockRequest(sessionId, principalHeader);

      const mockSession = createMockSession(sessionId, teacherId);
      mockSessionService.getSession.mockResolvedValue(mockSession);

      const mockConnectionInfo = {
        url: 'https://signalr.service.signalr.net/client/?hub=attendance',
        accessToken: 'mock-jwt-token'
      };
      (mockContext.extraInputs.get as jest.Mock).mockReturnValue(mockConnectionInfo);
      
      await negotiate(request, mockContext);
      
      expect(mockContext.log).toHaveBeenCalledWith(
        expect.stringContaining(`SignalR connection negotiated for teacher ${teacherId} on session ${sessionId}`)
      );
    });
  });

  describe('Error Handling', () => {
    test('should return 500 when SessionService throws error', async () => {
      const teacherEmail = 'teacher@vtc.edu.hk';
      const teacherId = 'teacher-123';
      const sessionId = 'session-123';
      const principalHeader = createPrincipalHeader(teacherId, teacherEmail);
      const request = createMockRequest(sessionId, principalHeader);

      mockSessionService.getSession.mockRejectedValue(new Error('Database connection failed'));
      
      const response = await negotiate(request, mockContext);
      
      expect(response.status).toBe(500);
      expect(response.jsonBody).toMatchObject({
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to negotiate SignalR connection',
          details: 'Database connection failed'
        }
      });
    });

    test('should log error when exception occurs', async () => {
      const teacherEmail = 'teacher@vtc.edu.hk';
      const teacherId = 'teacher-123';
      const sessionId = 'session-123';
      const principalHeader = createPrincipalHeader(teacherId, teacherEmail);
      const request = createMockRequest(sessionId, principalHeader);

      const error = new Error('Unexpected error');
      mockSessionService.getSession.mockRejectedValue(error);
      
      await negotiate(request, mockContext);
      
      expect(mockContext.error).toHaveBeenCalledWith(
        'Error negotiating SignalR connection:',
        error
      );
    });
  });

  describe('Requirements Validation', () => {
    test('Requirement 12.6: Uses Azure Functions SignalR input binding', async () => {
      // This test verifies that the function uses the SignalR input binding
      // by checking that it retrieves connection info from extraInputs
      const teacherEmail = 'teacher@vtc.edu.hk';
      const teacherId = 'teacher-123';
      const sessionId = 'session-123';
      const principalHeader = createPrincipalHeader(teacherId, teacherEmail);
      const request = createMockRequest(sessionId, principalHeader);

      const mockSession = createMockSession(sessionId, teacherId);
      mockSessionService.getSession.mockResolvedValue(mockSession);

      const mockConnectionInfo = {
        url: 'https://signalr.service.signalr.net/client/?hub=attendance',
        accessToken: 'mock-jwt-token'
      };
      (mockContext.extraInputs.get as jest.Mock).mockReturnValue(mockConnectionInfo);
      
      const response = await negotiate(request, mockContext);
      
      // Verify SignalR input binding was used
      expect(mockContext.extraInputs.get).toHaveBeenCalled();
      expect(response.status).toBe(200);
      expect(response.jsonBody).toEqual(mockConnectionInfo);
    });

    test('Requirement 12.6: Authenticates with Entra ID token', async () => {
      // This test verifies that the function validates Entra ID authentication
      const teacherEmail = 'teacher@vtc.edu.hk';
      const teacherId = 'teacher-123';
      const sessionId = 'session-123';
      const principalHeader = createPrincipalHeader(teacherId, teacherEmail);
      const request = createMockRequest(sessionId, principalHeader);

      const mockSession = createMockSession(sessionId, teacherId);
      mockSessionService.getSession.mockResolvedValue(mockSession);

      const mockConnectionInfo = {
        url: 'https://signalr.service.signalr.net/client/?hub=attendance',
        accessToken: 'mock-jwt-token'
      };
      (mockContext.extraInputs.get as jest.Mock).mockReturnValue(mockConnectionInfo);
      
      const response = await negotiate(request, mockContext);
      
      // Verify authentication was checked
      expect(response.status).toBe(200);
      
      // Verify that missing auth returns 401
      const requestNoAuth = createMockRequest(sessionId);
      const responseNoAuth = await negotiate(requestNoAuth, mockContext);
      expect(responseNoAuth.status).toBe(401);
    });

    test('Requirement 12.6: Returns SignalR connection info', async () => {
      // This test verifies that the function returns proper SignalR connection info
      const teacherEmail = 'teacher@vtc.edu.hk';
      const teacherId = 'teacher-123';
      const sessionId = 'session-123';
      const principalHeader = createPrincipalHeader(teacherId, teacherEmail);
      const request = createMockRequest(sessionId, principalHeader);

      const mockSession = createMockSession(sessionId, teacherId);
      mockSessionService.getSession.mockResolvedValue(mockSession);

      const mockConnectionInfo = {
        url: 'https://signalr.service.signalr.net/client/?hub=attendance',
        accessToken: 'mock-jwt-token-xyz789'
      };
      (mockContext.extraInputs.get as jest.Mock).mockReturnValue(mockConnectionInfo);
      
      const response = await negotiate(request, mockContext);
      
      // Verify connection info structure
      expect(response.status).toBe(200);
      expect(response.jsonBody).toHaveProperty('url');
      expect(response.jsonBody).toHaveProperty('accessToken');
      expect(typeof response.jsonBody.url).toBe('string');
      expect(typeof response.jsonBody.accessToken).toBe('string');
    });
  });

  describe('Edge Cases', () => {
    test('should handle empty sessionId parameter', async () => {
      const teacherEmail = 'teacher@vtc.edu.hk';
      const principalHeader = createPrincipalHeader('teacher-123', teacherEmail);
      const request = createMockRequest('', principalHeader);
      
      const response = await negotiate(request, mockContext);
      
      expect(response.status).toBe(400);
    });

    test('should handle malformed principal header', async () => {
      const request = createMockRequest('session-123', 'invalid-base64!!!');
      
      const response = await negotiate(request, mockContext);
      
      // Should fail during parsing
      expect(response.status).toBeGreaterThanOrEqual(400);
    });

    test('should handle session with different status', async () => {
      const teacherEmail = 'teacher@vtc.edu.hk';
      const teacherId = 'teacher-123';
      const sessionId = 'session-123';
      const principalHeader = createPrincipalHeader(teacherId, teacherEmail);
      const request = createMockRequest(sessionId, principalHeader);

      const mockSession = createMockSession(sessionId, teacherId);
      mockSession.status = SessionStatus.ENDED;
      mockSessionService.getSession.mockResolvedValue(mockSession);

      const mockConnectionInfo = {
        url: 'https://signalr.service.signalr.net/client/?hub=attendance',
        accessToken: 'mock-jwt-token'
      };
      (mockContext.extraInputs.get as jest.Mock).mockReturnValue(mockConnectionInfo);
      
      const response = await negotiate(request, mockContext);
      
      // Should still allow connection even if session is ended
      // (teacher may want to view final state)
      expect(response.status).toBe(200);
    });
  });
});
