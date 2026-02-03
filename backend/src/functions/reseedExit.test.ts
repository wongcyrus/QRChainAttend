/**
 * Unit tests for Reseed Exit Chain API Endpoint
 * Feature: qr-chain-attendance
 * Requirements: 11.3, 11.5
 */

import { HttpRequest, InvocationContext } from '@azure/functions';
import { reseedExit } from './reseedExit';
import { AuthService } from '../services/AuthService';
import { SessionService } from '../services/SessionService';
import { chainService } from '../services/ChainService';
import { Role, ChainPhase, SessionStatus, Chain, ChainState } from '../types';

// Mock dependencies
jest.mock('../services/AuthService');
jest.mock('../services/SessionService');
jest.mock('../services/ChainService');

describe('reseedExit endpoint', () => {
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

    // Mock SessionService
    mockSessionService = new SessionService() as jest.Mocked<SessionService>;
    mockSessionService.getSession = jest.fn().mockResolvedValue({
      sessionId: 'session-123',
      classId: 'class-456',
      teacherId: 'teacher-123',
      startAt: new Date().toISOString(),
      endAt: new Date(Date.now() + 3600000).toISOString(),
      lateCutoffMinutes: 15,
      exitWindowMinutes: 10,
      status: SessionStatus.ACTIVE,
      ownerTransfer: true,
      lateEntryActive: false,
      earlyLeaveActive: false,
      createdAt: new Date().toISOString()
    });

    // Mock ChainService
    const mockChains: Chain[] = [
      {
        sessionId: 'session-123',
        phase: ChainPhase.EXIT,
        chainId: 'chain-1',
        index: 1,
        state: ChainState.ACTIVE,
        lastHolder: 'student-1',
        lastSeq: 0,
        lastAt: Math.floor(Date.now() / 1000)
      },
      {
        sessionId: 'session-123',
        phase: ChainPhase.EXIT,
        chainId: 'chain-2',
        index: 1,
        state: ChainState.ACTIVE,
        lastHolder: 'student-2',
        lastSeq: 0,
        lastAt: Math.floor(Date.now() / 1000)
      }
    ];
    (chainService.reseedChains as jest.Mock).mockResolvedValue(mockChains);

    // Set up constructor mocks
    (AuthService as jest.Mock).mockImplementation(() => mockAuthService);
    (SessionService as jest.Mock).mockImplementation(() => mockSessionService);
  });

  describe('Authentication and Authorization', () => {
    test('should return 401 when authentication header is missing', async () => {
      const request = {
        headers: new Map(),
        params: { sessionId: 'session-123' },
        query: new URLSearchParams('count=2')
      } as any as HttpRequest;

      const response = await reseedExit(request, mockContext);

      expect(response.status).toBe(401);
      expect(response.jsonBody).toEqual({
        error: {
          code: 'UNAUTHORIZED',
          message: 'Missing authentication header',
          timestamp: expect.any(Number)
        }
      });
    });

    test('should return 403 when user does not have Teacher role', async () => {
      mockAuthService.requireRole.mockImplementation(() => {
        throw new Error('User does not have required role');
      });

      const request = {
        headers: new Map([['x-ms-client-principal', 'encoded-principal']]),
        params: { sessionId: 'session-123' },
        query: new URLSearchParams('count=2')
      } as any as HttpRequest;

      const response = await reseedExit(request, mockContext);

      expect(response.status).toBe(403);
      expect(response.jsonBody).toEqual({
        error: {
          code: 'FORBIDDEN',
          message: 'User does not have required role',
          timestamp: expect.any(Number)
        }
      });
    });

    test('should return 403 when teacher does not own the session', async () => {
      mockAuthService.getUserId.mockReturnValue('different-teacher');

      const request = {
        headers: new Map([['x-ms-client-principal', 'encoded-principal']]),
        params: { sessionId: 'session-123' },
        query: new URLSearchParams('count=2')
      } as any as HttpRequest;

      const response = await reseedExit(request, mockContext);

      expect(response.status).toBe(403);
      expect(response.jsonBody).toEqual({
        error: {
          code: 'FORBIDDEN',
          message: 'You do not own this session',
          timestamp: expect.any(Number)
        }
      });
    });
  });

  describe('Request Validation', () => {
    test('should return 400 when sessionId is missing', async () => {
      const request = {
        headers: new Map([['x-ms-client-principal', 'encoded-principal']]),
        params: {},
        query: new URLSearchParams('count=2')
      } as any as HttpRequest;

      const response = await reseedExit(request, mockContext);

      expect(response.status).toBe(400);
      expect(response.jsonBody).toEqual({
        error: {
          code: 'INVALID_REQUEST',
          message: 'Missing sessionId parameter',
          timestamp: expect.any(Number)
        }
      });
    });

    test('should return 400 when count parameter is missing', async () => {
      const request = {
        headers: new Map([['x-ms-client-principal', 'encoded-principal']]),
        params: { sessionId: 'session-123' },
        query: new URLSearchParams()
      } as any as HttpRequest;

      const response = await reseedExit(request, mockContext);

      expect(response.status).toBe(400);
      expect(response.jsonBody).toEqual({
        error: {
          code: 'INVALID_REQUEST',
          message: 'Missing count query parameter',
          timestamp: expect.any(Number)
        }
      });
    });

    test('should return 400 when count is not a positive integer', async () => {
      const request = {
        headers: new Map([['x-ms-client-principal', 'encoded-principal']]),
        params: { sessionId: 'session-123' },
        query: new URLSearchParams('count=0')
      } as any as HttpRequest;

      const response = await reseedExit(request, mockContext);

      expect(response.status).toBe(400);
      expect(response.jsonBody).toEqual({
        error: {
          code: 'INVALID_REQUEST',
          message: 'Invalid count parameter: must be a positive integer',
          timestamp: expect.any(Number)
        }
      });
    });

    test('should return 400 when count is not a number', async () => {
      const request = {
        headers: new Map([['x-ms-client-principal', 'encoded-principal']]),
        params: { sessionId: 'session-123' },
        query: new URLSearchParams('count=abc')
      } as any as HttpRequest;

      const response = await reseedExit(request, mockContext);

      expect(response.status).toBe(400);
      expect(response.jsonBody).toEqual({
        error: {
          code: 'INVALID_REQUEST',
          message: 'Invalid count parameter: must be a positive integer',
          timestamp: expect.any(Number)
        }
      });
    });

    test('should return 404 when session does not exist', async () => {
      mockSessionService.getSession.mockResolvedValue(null);

      const request = {
        headers: new Map([['x-ms-client-principal', 'encoded-principal']]),
        params: { sessionId: 'nonexistent-session' },
        query: new URLSearchParams('count=2')
      } as any as HttpRequest;

      const response = await reseedExit(request, mockContext);

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

  describe('Successful Reseed', () => {
    test('should successfully reseed exit chains and return chain count', async () => {
      const request = {
        headers: new Map([['x-ms-client-principal', 'encoded-principal']]),
        params: { sessionId: 'session-123' },
        query: new URLSearchParams('count=2')
      } as any as HttpRequest;

      const response = await reseedExit(request, mockContext);

      expect(response.status).toBe(200);
      expect(response.jsonBody).toEqual({
        chainsCreated: 2,
        initialHolders: ['student-1', 'student-2']
      });

      // Verify ChainService.reseedChains was called with correct parameters
      expect(chainService.reseedChains).toHaveBeenCalledWith(
        'session-123',
        ChainPhase.EXIT,
        2
      );
    });

    test('should handle single chain reseed', async () => {
      const mockChain: Chain = {
        sessionId: 'session-123',
        phase: ChainPhase.EXIT,
        chainId: 'chain-1',
        index: 1,
        state: ChainState.ACTIVE,
        lastHolder: 'student-1',
        lastSeq: 0,
        lastAt: Math.floor(Date.now() / 1000)
      };
      (chainService.reseedChains as jest.Mock).mockResolvedValue([mockChain]);

      const request = {
        headers: new Map([['x-ms-client-principal', 'encoded-principal']]),
        params: { sessionId: 'session-123' },
        query: new URLSearchParams('count=1')
      } as any as HttpRequest;

      const response = await reseedExit(request, mockContext);

      expect(response.status).toBe(200);
      expect(response.jsonBody).toEqual({
        chainsCreated: 1,
        initialHolders: ['student-1']
      });
    });

    test('should handle large chain count', async () => {
      const mockChains: Chain[] = Array.from({ length: 10 }, (_, i) => ({
        sessionId: 'session-123',
        phase: ChainPhase.EXIT,
        chainId: `chain-${i}`,
        index: 1,
        state: ChainState.ACTIVE,
        lastHolder: `student-${i}`,
        lastSeq: 0,
        lastAt: Math.floor(Date.now() / 1000)
      }));
      (chainService.reseedChains as jest.Mock).mockResolvedValue(mockChains);

      const request = {
        headers: new Map([['x-ms-client-principal', 'encoded-principal']]),
        params: { sessionId: 'session-123' },
        query: new URLSearchParams('count=10')
      } as any as HttpRequest;

      const response = await reseedExit(request, mockContext);

      expect(response.status).toBe(200);
      expect(response.jsonBody.chainsCreated).toBe(10);
      expect(response.jsonBody.initialHolders).toHaveLength(10);
    });
  });

  describe('Error Handling', () => {
    test('should return 400 when insufficient eligible students', async () => {
      (chainService.reseedChains as jest.Mock).mockRejectedValue(
        new Error('Insufficient eligible students: requested 5, available 2')
      );

      const request = {
        headers: new Map([['x-ms-client-principal', 'encoded-principal']]),
        params: { sessionId: 'session-123' },
        query: new URLSearchParams('count=5')
      } as any as HttpRequest;

      const response = await reseedExit(request, mockContext);

      expect(response.status).toBe(400);
      expect(response.jsonBody).toEqual({
        error: {
          code: 'INSUFFICIENT_STUDENTS',
          message: 'Insufficient eligible students: requested 5, available 2',
          timestamp: expect.any(Number)
        }
      });
    });

    test('should return 500 for unexpected errors', async () => {
      (chainService.reseedChains as jest.Mock).mockRejectedValue(
        new Error('Database connection failed')
      );

      const request = {
        headers: new Map([['x-ms-client-principal', 'encoded-principal']]),
        params: { sessionId: 'session-123' },
        query: new URLSearchParams('count=2')
      } as any as HttpRequest;

      const response = await reseedExit(request, mockContext);

      expect(response.status).toBe(500);
      expect(response.jsonBody).toEqual({
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to reseed exit chains',
          details: 'Database connection failed',
          timestamp: expect.any(Number)
        }
      });
    });
  });

  describe('Requirements Validation', () => {
    test('should call ChainService.reseedChains with EXIT phase (Requirement 11.3)', async () => {
      const request = {
        headers: new Map([['x-ms-client-principal', 'encoded-principal']]),
        params: { sessionId: 'session-123' },
        query: new URLSearchParams('count=2')
      } as any as HttpRequest;

      await reseedExit(request, mockContext);

      expect(chainService.reseedChains).toHaveBeenCalledWith(
        'session-123',
        ChainPhase.EXIT,
        expect.any(Number)
      );
    });

    test('should return new chain count (Requirement 11.3)', async () => {
      const request = {
        headers: new Map([['x-ms-client-principal', 'encoded-principal']]),
        params: { sessionId: 'session-123' },
        query: new URLSearchParams('count=2')
      } as any as HttpRequest;

      const response = await reseedExit(request, mockContext);

      expect(response.jsonBody).toHaveProperty('chainsCreated');
      expect(response.jsonBody.chainsCreated).toBe(2);
    });

    test('should require Teacher role (Requirement 11.3)', async () => {
      const request = {
        headers: new Map([['x-ms-client-principal', 'encoded-principal']]),
        params: { sessionId: 'session-123' },
        query: new URLSearchParams('count=2')
      } as any as HttpRequest;

      await reseedExit(request, mockContext);

      expect(mockAuthService.requireRole).toHaveBeenCalledWith(
        expect.any(Object),
        Role.TEACHER
      );
    });

    test('should require session ownership (Requirement 11.3)', async () => {
      const request = {
        headers: new Map([['x-ms-client-principal', 'encoded-principal']]),
        params: { sessionId: 'session-123' },
        query: new URLSearchParams('count=2')
      } as any as HttpRequest;

      await reseedExit(request, mockContext);

      expect(mockSessionService.getSession).toHaveBeenCalledWith('session-123');
      expect(mockAuthService.getUserId).toHaveBeenCalled();
    });
  });
});
