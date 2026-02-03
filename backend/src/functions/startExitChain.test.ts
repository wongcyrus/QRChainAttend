/**
 * Unit Tests for Start Exit Chain API Endpoint
 * Feature: qr-chain-attendance
 * Requirements: 6.1, 6.2
 */

import { HttpRequest, InvocationContext } from '@azure/functions';
import { startExitChain } from './startExitChain';
import { SessionService } from '../services/SessionService';
import { chainService } from '../services/ChainService';
import { AuthService } from '../services/AuthService';
import { Role, SessionStatus, ChainPhase, ChainState, Chain } from '../types';

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

// Mock chainService singleton
jest.mock('../services/ChainService', () => ({
  chainService: {
    seedChains: jest.fn()
  }
}));

describe('startExitChain', () => {
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

  /**
   * Test: Successful exit chain start
   * Requirements: 6.1, 6.2
   */
  test('should successfully start exit chains and return created chains', async () => {
    const sessionId = 'session-123';
    const count = 3;
    
    const mockSession = {
      sessionId,
      classId: 'class-1',
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
    };

    const mockChains: Chain[] = [
      {
        sessionId,
        phase: ChainPhase.EXIT,
        chainId: 'chain-1',
        index: 0,
        state: ChainState.ACTIVE,
        lastHolder: 'student-1',
        lastSeq: 0,
        lastAt: Math.floor(Date.now() / 1000)
      },
      {
        sessionId,
        phase: ChainPhase.EXIT,
        chainId: 'chain-2',
        index: 0,
        state: ChainState.ACTIVE,
        lastHolder: 'student-2',
        lastSeq: 0,
        lastAt: Math.floor(Date.now() / 1000)
      },
      {
        sessionId,
        phase: ChainPhase.EXIT,
        chainId: 'chain-3',
        index: 0,
        state: ChainState.ACTIVE,
        lastHolder: 'student-3',
        lastSeq: 0,
        lastAt: Math.floor(Date.now() / 1000)
      }
    ];

    mockSessionService.getSession = jest.fn().mockResolvedValue(mockSession);
    (chainService.seedChains as jest.Mock).mockResolvedValue(mockChains);

    const request = {
      params: { sessionId },
      query: new Map([['count', '3']]),
      headers: new Map([['x-ms-client-principal', 'base64-encoded-principal']])
    } as any as HttpRequest;

    const response = await startExitChain(request, mockContext);

    expect(response.status).toBe(200);
    expect(response.jsonBody).toEqual({
      chainsCreated: 3,
      initialHolders: ['student-1', 'student-2', 'student-3']
    });

    // Verify ChainService.seedChains was called with EXIT phase
    expect(chainService.seedChains).toHaveBeenCalledWith(
      sessionId,
      ChainPhase.EXIT,
      count
    );
  });

  /**
   * Test: Exit chains filter eligible students
   * Requirements: 6.2
   * 
   * ChainService.seedChains with EXIT phase should only select students with:
   * - PRESENT_ENTRY or LATE_ENTRY status
   * - No earlyLeaveAt timestamp
   */
  test('should call seedChains with EXIT phase to filter eligible students', async () => {
    const sessionId = 'session-123';
    const count = 2;
    
    const mockSession = {
      sessionId,
      teacherId: 'teacher-123',
      status: SessionStatus.ACTIVE
    };

    const mockChains: Chain[] = [
      {
        sessionId,
        phase: ChainPhase.EXIT,
        chainId: 'chain-1',
        index: 0,
        state: ChainState.ACTIVE,
        lastHolder: 'student-1',
        lastSeq: 0,
        lastAt: Math.floor(Date.now() / 1000)
      },
      {
        sessionId,
        phase: ChainPhase.EXIT,
        chainId: 'chain-2',
        index: 0,
        state: ChainState.ACTIVE,
        lastHolder: 'student-2',
        lastSeq: 0,
        lastAt: Math.floor(Date.now() / 1000)
      }
    ];

    mockSessionService.getSession = jest.fn().mockResolvedValue(mockSession);
    (chainService.seedChains as jest.Mock).mockResolvedValue(mockChains);

    const request = {
      params: { sessionId },
      query: new Map([['count', '2']]),
      headers: new Map([['x-ms-client-principal', 'base64-encoded-principal']])
    } as any as HttpRequest;

    await startExitChain(request, mockContext);

    // Verify EXIT phase is used (which triggers eligibility filtering in ChainService)
    expect(chainService.seedChains).toHaveBeenCalledWith(
      sessionId,
      ChainPhase.EXIT,
      count
    );
  });

  /**
   * Test: Missing authentication header
   * Requirements: 6.1
   */
  test('should return 401 when authentication header is missing', async () => {
    const request = {
      params: { sessionId: 'session-123' },
      query: new Map([['count', '3']]),
      headers: new Map()
    } as any as HttpRequest;

    const response = await startExitChain(request, mockContext);

    expect(response.status).toBe(401);
    expect(response.jsonBody.error.code).toBe('UNAUTHORIZED');
  });

  /**
   * Test: Non-teacher role
   * Requirements: 6.1
   */
  test('should return 403 when user is not a teacher', async () => {
    mockAuthService.requireRole = jest.fn().mockImplementation(() => {
      throw new Error('User does not have required role: teacher');
    });

    const request = {
      params: { sessionId: 'session-123' },
      query: new Map([['count', '3']]),
      headers: new Map([['x-ms-client-principal', 'base64-encoded-principal']])
    } as any as HttpRequest;

    const response = await startExitChain(request, mockContext);

    expect(response.status).toBe(403);
    expect(response.jsonBody.error.code).toBe('FORBIDDEN');
  });

  /**
   * Test: Missing session ID parameter
   * Requirements: 6.1
   */
  test('should return 400 when sessionId parameter is missing', async () => {
    const request = {
      params: {},
      query: new Map([['count', '3']]),
      headers: new Map([['x-ms-client-principal', 'base64-encoded-principal']])
    } as any as HttpRequest;

    const response = await startExitChain(request, mockContext);

    expect(response.status).toBe(400);
    expect(response.jsonBody.error.code).toBe('INVALID_REQUEST');
    expect(response.jsonBody.error.message).toContain('sessionId');
  });

  /**
   * Test: Missing count query parameter
   * Requirements: 6.1
   */
  test('should return 400 when count query parameter is missing', async () => {
    const request = {
      params: { sessionId: 'session-123' },
      query: new Map(),
      headers: new Map([['x-ms-client-principal', 'base64-encoded-principal']])
    } as any as HttpRequest;

    const response = await startExitChain(request, mockContext);

    expect(response.status).toBe(400);
    expect(response.jsonBody.error.code).toBe('INVALID_REQUEST');
    expect(response.jsonBody.error.message).toContain('count');
  });

  /**
   * Test: Invalid count parameter (not a number)
   * Requirements: 6.1
   */
  test('should return 400 when count parameter is not a valid number', async () => {
    const request = {
      params: { sessionId: 'session-123' },
      query: new Map([['count', 'invalid']]),
      headers: new Map([['x-ms-client-principal', 'base64-encoded-principal']])
    } as any as HttpRequest;

    const response = await startExitChain(request, mockContext);

    expect(response.status).toBe(400);
    expect(response.jsonBody.error.code).toBe('INVALID_REQUEST');
    expect(response.jsonBody.error.message).toContain('positive integer');
  });

  /**
   * Test: Invalid count parameter (zero)
   * Requirements: 6.1
   */
  test('should return 400 when count parameter is zero', async () => {
    const request = {
      params: { sessionId: 'session-123' },
      query: new Map([['count', '0']]),
      headers: new Map([['x-ms-client-principal', 'base64-encoded-principal']])
    } as any as HttpRequest;

    const response = await startExitChain(request, mockContext);

    expect(response.status).toBe(400);
    expect(response.jsonBody.error.code).toBe('INVALID_REQUEST');
    expect(response.jsonBody.error.message).toContain('positive integer');
  });

  /**
   * Test: Invalid count parameter (negative)
   * Requirements: 6.1
   */
  test('should return 400 when count parameter is negative', async () => {
    const request = {
      params: { sessionId: 'session-123' },
      query: new Map([['count', '-5']]),
      headers: new Map([['x-ms-client-principal', 'base64-encoded-principal']])
    } as any as HttpRequest;

    const response = await startExitChain(request, mockContext);

    expect(response.status).toBe(400);
    expect(response.jsonBody.error.code).toBe('INVALID_REQUEST');
    expect(response.jsonBody.error.message).toContain('positive integer');
  });

  /**
   * Test: Session not found
   * Requirements: 6.1
   */
  test('should return 404 when session does not exist', async () => {
    mockSessionService.getSession = jest.fn().mockResolvedValue(null);

    const request = {
      params: { sessionId: 'nonexistent-session' },
      query: new Map([['count', '3']]),
      headers: new Map([['x-ms-client-principal', 'base64-encoded-principal']])
    } as any as HttpRequest;

    const response = await startExitChain(request, mockContext);

    expect(response.status).toBe(404);
    expect(response.jsonBody.error.code).toBe('NOT_FOUND');
  });

  /**
   * Test: Unauthorized - teacher does not own session
   * Requirements: 6.1
   */
  test('should return 403 when teacher does not own the session', async () => {
    const mockSession = {
      sessionId: 'session-123',
      teacherId: 'different-teacher',
      status: SessionStatus.ACTIVE
    };

    mockSessionService.getSession = jest.fn().mockResolvedValue(mockSession);

    const request = {
      params: { sessionId: 'session-123' },
      query: new Map([['count', '3']]),
      headers: new Map([['x-ms-client-principal', 'base64-encoded-principal']])
    } as any as HttpRequest;

    const response = await startExitChain(request, mockContext);

    expect(response.status).toBe(403);
    expect(response.jsonBody.error.code).toBe('FORBIDDEN');
    expect(response.jsonBody.error.message).toContain('do not own');
  });

  /**
   * Test: Insufficient eligible students
   * Requirements: 6.2
   */
  test('should return 400 when there are insufficient eligible students', async () => {
    const mockSession = {
      sessionId: 'session-123',
      teacherId: 'teacher-123',
      status: SessionStatus.ACTIVE
    };

    mockSessionService.getSession = jest.fn().mockResolvedValue(mockSession);
    (chainService.seedChains as jest.Mock).mockRejectedValue(
      new Error('Insufficient eligible students: requested 5, available 2')
    );

    const request = {
      params: { sessionId: 'session-123' },
      query: new Map([['count', '5']]),
      headers: new Map([['x-ms-client-principal', 'base64-encoded-principal']])
    } as any as HttpRequest;

    const response = await startExitChain(request, mockContext);

    expect(response.status).toBe(400);
    expect(response.jsonBody.error.code).toBe('INSUFFICIENT_STUDENTS');
    expect(response.jsonBody.error.message).toContain('Insufficient eligible students');
  });

  /**
   * Test: Returns exact count of chains created
   * Requirements: 6.1
   */
  test('should return exact count of chains created', async () => {
    const sessionId = 'session-123';
    const count = 5;
    
    const mockSession = {
      sessionId,
      teacherId: 'teacher-123',
      status: SessionStatus.ACTIVE
    };

    const mockChains: Chain[] = Array.from({ length: count }, (_, i) => ({
      sessionId,
      phase: ChainPhase.EXIT,
      chainId: `chain-${i + 1}`,
      index: 0,
      state: ChainState.ACTIVE,
      lastHolder: `student-${i + 1}`,
      lastSeq: 0,
      lastAt: Math.floor(Date.now() / 1000)
    }));

    mockSessionService.getSession = jest.fn().mockResolvedValue(mockSession);
    (chainService.seedChains as jest.Mock).mockResolvedValue(mockChains);

    const request = {
      params: { sessionId },
      query: new Map([['count', count.toString()]]),
      headers: new Map([['x-ms-client-principal', 'base64-encoded-principal']])
    } as any as HttpRequest;

    const response = await startExitChain(request, mockContext);

    expect(response.status).toBe(200);
    expect(response.jsonBody.chainsCreated).toBe(count);
    expect(response.jsonBody.initialHolders).toHaveLength(count);
  });

  /**
   * Test: Returns initial holders list
   * Requirements: 6.1
   */
  test('should return list of initial holders', async () => {
    const sessionId = 'session-123';
    
    const mockSession = {
      sessionId,
      teacherId: 'teacher-123',
      status: SessionStatus.ACTIVE
    };

    const mockChains: Chain[] = [
      {
        sessionId,
        phase: ChainPhase.EXIT,
        chainId: 'chain-1',
        index: 0,
        state: ChainState.ACTIVE,
        lastHolder: 'student-alice',
        lastSeq: 0,
        lastAt: Math.floor(Date.now() / 1000)
      },
      {
        sessionId,
        phase: ChainPhase.EXIT,
        chainId: 'chain-2',
        index: 0,
        state: ChainState.ACTIVE,
        lastHolder: 'student-bob',
        lastSeq: 0,
        lastAt: Math.floor(Date.now() / 1000)
      }
    ];

    mockSessionService.getSession = jest.fn().mockResolvedValue(mockSession);
    (chainService.seedChains as jest.Mock).mockResolvedValue(mockChains);

    const request = {
      params: { sessionId },
      query: new Map([['count', '2']]),
      headers: new Map([['x-ms-client-principal', 'base64-encoded-principal']])
    } as any as HttpRequest;

    const response = await startExitChain(request, mockContext);

    expect(response.status).toBe(200);
    expect(response.jsonBody.initialHolders).toEqual(['student-alice', 'student-bob']);
  });

  /**
   * Test: Error handling for internal errors
   * Requirements: 6.1
   */
  test('should return 500 on internal error', async () => {
    mockSessionService.getSession = jest.fn().mockRejectedValue(new Error('Database error'));

    const request = {
      params: { sessionId: 'session-123' },
      query: new Map([['count', '3']]),
      headers: new Map([['x-ms-client-principal', 'base64-encoded-principal']])
    } as any as HttpRequest;

    const response = await startExitChain(request, mockContext);

    expect(response.status).toBe(500);
    expect(response.jsonBody.error.code).toBe('INTERNAL_ERROR');
    expect(mockContext.error).toHaveBeenCalled();
  });

  /**
   * Test: Handles chains with undefined lastHolder
   * Requirements: 6.1
   */
  test('should filter out undefined holders from response', async () => {
    const sessionId = 'session-123';
    
    const mockSession = {
      sessionId,
      teacherId: 'teacher-123',
      status: SessionStatus.ACTIVE
    };

    const mockChains: Chain[] = [
      {
        sessionId,
        phase: ChainPhase.EXIT,
        chainId: 'chain-1',
        index: 0,
        state: ChainState.ACTIVE,
        lastHolder: 'student-1',
        lastSeq: 0,
        lastAt: Math.floor(Date.now() / 1000)
      },
      {
        sessionId,
        phase: ChainPhase.EXIT,
        chainId: 'chain-2',
        index: 0,
        state: ChainState.ACTIVE,
        lastHolder: undefined, // Edge case: no holder
        lastSeq: 0,
        lastAt: Math.floor(Date.now() / 1000)
      }
    ];

    mockSessionService.getSession = jest.fn().mockResolvedValue(mockSession);
    (chainService.seedChains as jest.Mock).mockResolvedValue(mockChains);

    const request = {
      params: { sessionId },
      query: new Map([['count', '2']]),
      headers: new Map([['x-ms-client-principal', 'base64-encoded-principal']])
    } as any as HttpRequest;

    const response = await startExitChain(request, mockContext);

    expect(response.status).toBe(200);
    expect(response.jsonBody.chainsCreated).toBe(2);
    expect(response.jsonBody.initialHolders).toEqual(['student-1']); // Filtered out undefined
  });
});
