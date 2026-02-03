/**
 * Unit tests for Reseed Entry Chain API Endpoint
 * Feature: qr-chain-attendance
 * Requirements: 11.3, 11.5
 */

import { HttpRequest, InvocationContext } from '@azure/functions';
import { reseedEntry } from './reseedEntry';
import { AuthService } from '../services/AuthService';
import { SessionService } from '../services/SessionService';
import { chainService } from '../services/ChainService';
import { Role, ChainPhase, SessionStatus } from '../types';

// Mock dependencies
jest.mock('../services/AuthService');
jest.mock('../services/SessionService');
jest.mock('../services/ChainService');

describe('reseedEntry API Endpoint', () => {
  let mockContext: InvocationContext;
  let mockAuthService: jest.Mocked<AuthService>;
  let mockSessionService: jest.Mocked<SessionService>;

  const mockPrincipal = {
    userId: 'teacher-123',
    userEmail: 'teacher@vtc.edu.hk',
    userRoles: [Role.TEACHER],
    identityProvider: 'aad',
  };

  const mockSession = {
    sessionId: 'session-123',
    classId: 'CS101',
    teacherId: 'teacher-123',
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

  const mockChains = [
    {
      sessionId: 'session-123',
      phase: ChainPhase.ENTRY,
      chainId: 'chain-1',
      index: 1,
      state: 'ACTIVE' as const,
      lastHolder: 'student-1',
      lastSeq: 0,
      lastAt: Math.floor(Date.now() / 1000),
    },
    {
      sessionId: 'session-123',
      phase: ChainPhase.ENTRY,
      chainId: 'chain-2',
      index: 1,
      state: 'ACTIVE' as const,
      lastHolder: 'student-2',
      lastSeq: 0,
      lastAt: Math.floor(Date.now() / 1000),
    },
  ];

  beforeEach(() => {
    mockContext = {
      log: jest.fn(),
      error: jest.fn(),
    } as any;

    mockAuthService = new AuthService() as jest.Mocked<AuthService>;
    mockAuthService.parseUserPrincipal = jest.fn().mockReturnValue(mockPrincipal);
    mockAuthService.requireRole = jest.fn();
    mockAuthService.getUserId = jest.fn().mockReturnValue('teacher-123');

    mockSessionService = new SessionService() as jest.Mocked<SessionService>;
    mockSessionService.getSession = jest.fn().mockResolvedValue(mockSession);

    (AuthService as jest.Mock).mockImplementation(() => mockAuthService);
    (SessionService as jest.Mock).mockImplementation(() => mockSessionService);
    (chainService.reseedChains as jest.Mock) = jest.fn().mockResolvedValue(mockChains);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Authentication and Authorization', () => {
    it('should return 401 when authentication header is missing', async () => {
      const request = {
        headers: new Map(),
        params: { sessionId: 'session-123' },
        query: new Map([['count', '2']]),
      } as any as HttpRequest;

      const response = await reseedEntry(request, mockContext);

      expect(response.status).toBe(401);
      expect(response.jsonBody).toEqual({
        error: {
          code: 'UNAUTHORIZED',
          message: 'Missing authentication header',
          timestamp: expect.any(Number),
        },
      });
    });

    it('should return 403 when user is not a teacher', async () => {
      mockAuthService.requireRole = jest.fn().mockImplementation(() => {
        throw new Error('User does not have required role: teacher');
      });

      const request = {
        headers: new Map([['x-ms-client-principal', 'encoded-principal']]),
        params: { sessionId: 'session-123' },
        query: new Map([['count', '2']]),
      } as any as HttpRequest;

      const response = await reseedEntry(request, mockContext);

      expect(response.status).toBe(403);
      expect(response.jsonBody).toEqual({
        error: {
          code: 'FORBIDDEN',
          message: 'User does not have required role: teacher',
          timestamp: expect.any(Number),
        },
      });
    });

    it('should return 403 when teacher does not own the session', async () => {
      mockAuthService.getUserId = jest.fn().mockReturnValue('different-teacher');

      const request = {
        headers: new Map([['x-ms-client-principal', 'encoded-principal']]),
        params: { sessionId: 'session-123' },
        query: new Map([['count', '2']]),
      } as any as HttpRequest;

      const response = await reseedEntry(request, mockContext);

      expect(response.status).toBe(403);
      expect(response.jsonBody).toEqual({
        error: {
          code: 'FORBIDDEN',
          message: 'You do not own this session',
          timestamp: expect.any(Number),
        },
      });
    });
  });

  describe('Request Validation', () => {
    it('should return 400 when sessionId is missing', async () => {
      const request = {
        headers: new Map([['x-ms-client-principal', 'encoded-principal']]),
        params: {},
        query: new Map([['count', '2']]),
      } as any as HttpRequest;

      const response = await reseedEntry(request, mockContext);

      expect(response.status).toBe(400);
      expect(response.jsonBody).toEqual({
        error: {
          code: 'INVALID_REQUEST',
          message: 'Missing sessionId parameter',
          timestamp: expect.any(Number),
        },
      });
    });

    it('should return 400 when count parameter is missing', async () => {
      const request = {
        headers: new Map([['x-ms-client-principal', 'encoded-principal']]),
        params: { sessionId: 'session-123' },
        query: new Map(),
      } as any as HttpRequest;

      const response = await reseedEntry(request, mockContext);

      expect(response.status).toBe(400);
      expect(response.jsonBody).toEqual({
        error: {
          code: 'INVALID_REQUEST',
          message: 'Missing count query parameter',
          timestamp: expect.any(Number),
        },
      });
    });

    it('should return 400 when count is not a positive integer', async () => {
      const request = {
        headers: new Map([['x-ms-client-principal', 'encoded-principal']]),
        params: { sessionId: 'session-123' },
        query: new Map([['count', '0']]),
      } as any as HttpRequest;

      const response = await reseedEntry(request, mockContext);

      expect(response.status).toBe(400);
      expect(response.jsonBody).toEqual({
        error: {
          code: 'INVALID_REQUEST',
          message: 'Invalid count parameter: must be a positive integer',
          timestamp: expect.any(Number),
        },
      });
    });

    it('should return 400 when count is not a number', async () => {
      const request = {
        headers: new Map([['x-ms-client-principal', 'encoded-principal']]),
        params: { sessionId: 'session-123' },
        query: new Map([['count', 'invalid']]),
      } as any as HttpRequest;

      const response = await reseedEntry(request, mockContext);

      expect(response.status).toBe(400);
      expect(response.jsonBody).toEqual({
        error: {
          code: 'INVALID_REQUEST',
          message: 'Invalid count parameter: must be a positive integer',
          timestamp: expect.any(Number),
        },
      });
    });

    it('should return 404 when session does not exist', async () => {
      mockSessionService.getSession = jest.fn().mockResolvedValue(null);

      const request = {
        headers: new Map([['x-ms-client-principal', 'encoded-principal']]),
        params: { sessionId: 'nonexistent-session' },
        query: new Map([['count', '2']]),
      } as any as HttpRequest;

      const response = await reseedEntry(request, mockContext);

      expect(response.status).toBe(404);
      expect(response.jsonBody).toEqual({
        error: {
          code: 'NOT_FOUND',
          message: 'Session not found',
          timestamp: expect.any(Number),
        },
      });
    });
  });

  describe('Reseed Entry Chains - Requirements 11.3, 11.5', () => {
    it('should successfully reseed entry chains with specified count', async () => {
      const request = {
        headers: new Map([['x-ms-client-principal', 'encoded-principal']]),
        params: { sessionId: 'session-123' },
        query: new Map([['count', '2']]),
      } as any as HttpRequest;

      const response = await reseedEntry(request, mockContext);

      expect(response.status).toBe(200);
      expect(response.jsonBody).toEqual({
        chainsCreated: 2,
        initialHolders: ['student-1', 'student-2'],
      });

      expect(chainService.reseedChains).toHaveBeenCalledWith(
        'session-123',
        ChainPhase.ENTRY,
        2
      );
    });

    it('should call ChainService.reseedChains with ENTRY phase', async () => {
      const request = {
        headers: new Map([['x-ms-client-principal', 'encoded-principal']]),
        params: { sessionId: 'session-123' },
        query: new Map([['count', '3']]),
      } as any as HttpRequest;

      await reseedEntry(request, mockContext);

      expect(chainService.reseedChains).toHaveBeenCalledWith(
        'session-123',
        ChainPhase.ENTRY,
        3
      );
    });

    it('should return 400 when insufficient eligible students', async () => {
      (chainService.reseedChains as jest.Mock).mockRejectedValue(
        new Error('Insufficient eligible students: requested 5, available 2')
      );

      const request = {
        headers: new Map([['x-ms-client-principal', 'encoded-principal']]),
        params: { sessionId: 'session-123' },
        query: new Map([['count', '5']]),
      } as any as HttpRequest;

      const response = await reseedEntry(request, mockContext);

      expect(response.status).toBe(400);
      expect(response.jsonBody).toEqual({
        error: {
          code: 'INSUFFICIENT_STUDENTS',
          message: 'Insufficient eligible students: requested 5, available 2',
          timestamp: expect.any(Number),
        },
      });
    });

    it('should handle large chain counts', async () => {
      const largeChainArray = Array.from({ length: 20 }, (_, i) => ({
        ...mockChains[0],
        chainId: `chain-${i}`,
        lastHolder: `student-${i}`,
      }));

      (chainService.reseedChains as jest.Mock).mockResolvedValue(largeChainArray);

      const request = {
        headers: new Map([['x-ms-client-principal', 'encoded-principal']]),
        params: { sessionId: 'session-123' },
        query: new Map([['count', '20']]),
      } as any as HttpRequest;

      const response = await reseedEntry(request, mockContext);

      expect(response.status).toBe(200);
      expect(response.jsonBody.chainsCreated).toBe(20);
      expect(response.jsonBody.initialHolders).toHaveLength(20);
    });

    it('should filter out chains without holders', async () => {
      const chainsWithoutHolders = [
        { ...mockChains[0], lastHolder: 'student-1' },
        { ...mockChains[1], lastHolder: undefined },
      ];

      (chainService.reseedChains as jest.Mock).mockResolvedValue(chainsWithoutHolders);

      const request = {
        headers: new Map([['x-ms-client-principal', 'encoded-principal']]),
        params: { sessionId: 'session-123' },
        query: new Map([['count', '2']]),
      } as any as HttpRequest;

      const response = await reseedEntry(request, mockContext);

      expect(response.status).toBe(200);
      expect(response.jsonBody.initialHolders).toEqual(['student-1']);
    });
  });

  describe('Error Handling', () => {
    it('should return 500 for unexpected errors', async () => {
      (chainService.reseedChains as jest.Mock).mockRejectedValue(
        new Error('Unexpected database error')
      );

      const request = {
        headers: new Map([['x-ms-client-principal', 'encoded-principal']]),
        params: { sessionId: 'session-123' },
        query: new Map([['count', '2']]),
      } as any as HttpRequest;

      const response = await reseedEntry(request, mockContext);

      expect(response.status).toBe(500);
      expect(response.jsonBody).toEqual({
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to reseed entry chains',
          details: 'Unexpected database error',
          timestamp: expect.any(Number),
        },
      });
    });

    it('should log errors to context', async () => {
      (chainService.reseedChains as jest.Mock).mockRejectedValue(
        new Error('Test error')
      );

      const request = {
        headers: new Map([['x-ms-client-principal', 'encoded-principal']]),
        params: { sessionId: 'session-123' },
        query: new Map([['count', '2']]),
      } as any as HttpRequest;

      await reseedEntry(request, mockContext);

      expect(mockContext.error).toHaveBeenCalledWith(
        'Error reseeding entry chains:',
        expect.any(Error)
      );
    });
  });

  describe('Integration with ChainService', () => {
    it('should pass correct parameters to ChainService', async () => {
      const request = {
        headers: new Map([['x-ms-client-principal', 'encoded-principal']]),
        params: { sessionId: 'test-session' },
        query: new Map([['count', '7']]),
      } as any as HttpRequest;

      await reseedEntry(request, mockContext);

      expect(chainService.reseedChains).toHaveBeenCalledWith(
        'test-session',
        ChainPhase.ENTRY,
        7
      );
    });

    it('should return response matching ChainService output', async () => {
      const customChains = [
        {
          sessionId: 'session-123',
          phase: ChainPhase.ENTRY,
          chainId: 'custom-chain-1',
          index: 2,
          state: 'ACTIVE' as const,
          lastHolder: 'custom-student-1',
          lastSeq: 0,
          lastAt: Math.floor(Date.now() / 1000),
        },
      ];

      (chainService.reseedChains as jest.Mock).mockResolvedValue(customChains);

      const request = {
        headers: new Map([['x-ms-client-principal', 'encoded-principal']]),
        params: { sessionId: 'session-123' },
        query: new Map([['count', '1']]),
      } as any as HttpRequest;

      const response = await reseedEntry(request, mockContext);

      expect(response.jsonBody).toEqual({
        chainsCreated: 1,
        initialHolders: ['custom-student-1'],
      });
    });
  });
});
