/**
 * Unit Tests for Start Early Leave Window API Endpoint
 * Feature: qr-chain-attendance
 * Requirements: 5.1
 */

import { HttpRequest, InvocationContext } from '@azure/functions';
import { startEarlyLeave } from './startEarlyLeave';
import { SessionService } from '../services/SessionService';
import { TokenService } from '../services/TokenService';
import { AuthService } from '../services/AuthService';
import { Role, SessionStatus, TokenType, Token } from '../types';

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
jest.mock('../services/TokenService');
jest.mock('../services/AuthService');
jest.mock('../config', () => ({
  getConfig: () => ({
    earlyLeaveRotationSeconds: 60
  })
}));

describe('startEarlyLeave', () => {
  let mockContext: InvocationContext;
  let mockAuthService: jest.Mocked<AuthService>;
  let mockSessionService: jest.Mocked<SessionService>;
  let mockTokenService: jest.Mocked<TokenService>;

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

    // Mock TokenService
    mockTokenService = new TokenService() as jest.Mocked<TokenService>;
    (TokenService as jest.Mock).mockImplementation(() => mockTokenService);
  });

  /**
   * Test: Successful early leave window start
   * Requirements: 5.1
   */
  test('should successfully start early leave window and generate initial token', async () => {
    const sessionId = 'session-123';
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

    const mockToken: Token = {
      tokenId: 'token-123',
      sessionId,
      type: TokenType.EARLY_LEAVE,
      exp: Math.floor(Date.now() / 1000) + 60,
      status: 'ACTIVE' as any,
      singleUse: true,
      etag: 'etag-123'
    };

    mockSessionService.getSession = jest.fn().mockResolvedValue(mockSession);
    mockSessionService.updateEarlyLeaveStatus = jest.fn().mockResolvedValue(undefined);
    mockTokenService.createToken = jest.fn().mockResolvedValue(mockToken);

    const request = {
      params: { sessionId },
      headers: new Map([['x-ms-client-principal', 'base64-encoded-principal']])
    } as any as HttpRequest;

    const response = await startEarlyLeave(request, mockContext);

    expect(response.status).toBe(200);
    expect(response.jsonBody).toHaveProperty('success', true);
    expect(response.jsonBody).toHaveProperty('tokenId', 'token-123');
    expect(response.jsonBody).toHaveProperty('etag', 'etag-123');
    expect(response.jsonBody).toHaveProperty('exp');
    expect(response.jsonBody).toHaveProperty('qrData');

    // Verify QR data is properly encoded
    const qrData = JSON.parse(Buffer.from(response.jsonBody.qrData, 'base64').toString());
    expect(qrData.type).toBe('EARLY_LEAVE');
    expect(qrData.sessionId).toBe(sessionId);
    expect(qrData.tokenId).toBe('token-123');

    // Verify services were called correctly
    expect(mockSessionService.getSession).toHaveBeenCalledWith(sessionId);
    expect(mockTokenService.createToken).toHaveBeenCalledWith({
      sessionId,
      type: TokenType.EARLY_LEAVE,
      ttlSeconds: 60,
      singleUse: true
    });
    expect(mockSessionService.updateEarlyLeaveStatus).toHaveBeenCalledWith(
      sessionId,
      true,
      'token-123'
    );
  });

  /**
   * Test: Missing authentication header
   * Requirements: 5.1
   */
  test('should return 401 when authentication header is missing', async () => {
    const request = {
      params: { sessionId: 'session-123' },
      headers: new Map()
    } as any as HttpRequest;

    const response = await startEarlyLeave(request, mockContext);

    expect(response.status).toBe(401);
    expect(response.jsonBody.error.code).toBe('UNAUTHORIZED');
  });

  /**
   * Test: Non-teacher role
   * Requirements: 5.1
   */
  test('should return 403 when user is not a teacher', async () => {
    mockAuthService.requireRole = jest.fn().mockImplementation(() => {
      throw new Error('User does not have required role: teacher');
    });

    const request = {
      params: { sessionId: 'session-123' },
      headers: new Map([['x-ms-client-principal', 'base64-encoded-principal']])
    } as any as HttpRequest;

    const response = await startEarlyLeave(request, mockContext);

    expect(response.status).toBe(403);
    expect(response.jsonBody.error.code).toBe('FORBIDDEN');
  });

  /**
   * Test: Missing session ID parameter
   * Requirements: 5.1
   */
  test('should return 400 when sessionId parameter is missing', async () => {
    const request = {
      params: {},
      headers: new Map([['x-ms-client-principal', 'base64-encoded-principal']])
    } as any as HttpRequest;

    const response = await startEarlyLeave(request, mockContext);

    expect(response.status).toBe(400);
    expect(response.jsonBody.error.code).toBe('INVALID_REQUEST');
    expect(response.jsonBody.error.message).toContain('sessionId');
  });

  /**
   * Test: Session not found
   * Requirements: 5.1
   */
  test('should return 404 when session does not exist', async () => {
    mockSessionService.getSession = jest.fn().mockResolvedValue(null);

    const request = {
      params: { sessionId: 'nonexistent-session' },
      headers: new Map([['x-ms-client-principal', 'base64-encoded-principal']])
    } as any as HttpRequest;

    const response = await startEarlyLeave(request, mockContext);

    expect(response.status).toBe(404);
    expect(response.jsonBody.error.code).toBe('NOT_FOUND');
  });

  /**
   * Test: Unauthorized - teacher does not own session
   * Requirements: 5.1
   */
  test('should return 403 when teacher does not own the session', async () => {
    const mockSession = {
      sessionId: 'session-123',
      teacherId: 'different-teacher',
      status: SessionStatus.ACTIVE,
      earlyLeaveActive: false
    };

    mockSessionService.getSession = jest.fn().mockResolvedValue(mockSession);

    const request = {
      params: { sessionId: 'session-123' },
      headers: new Map([['x-ms-client-principal', 'base64-encoded-principal']])
    } as any as HttpRequest;

    const response = await startEarlyLeave(request, mockContext);

    expect(response.status).toBe(403);
    expect(response.jsonBody.error.code).toBe('FORBIDDEN');
    expect(response.jsonBody.error.message).toContain('do not own');
  });

  /**
   * Test: Session not active
   * Requirements: 5.1
   */
  test('should return 400 when session is not active', async () => {
    const mockSession = {
      sessionId: 'session-123',
      teacherId: 'teacher-123',
      status: SessionStatus.ENDED,
      earlyLeaveActive: false
    };

    mockSessionService.getSession = jest.fn().mockResolvedValue(mockSession);

    const request = {
      params: { sessionId: 'session-123' },
      headers: new Map([['x-ms-client-principal', 'base64-encoded-principal']])
    } as any as HttpRequest;

    const response = await startEarlyLeave(request, mockContext);

    expect(response.status).toBe(400);
    expect(response.jsonBody.error.code).toBe('INVALID_STATE');
    expect(response.jsonBody.error.message).toContain('not active');
  });

  /**
   * Test: Early leave already active
   * Requirements: 5.1
   */
  test('should return 400 when early leave window is already active', async () => {
    const mockSession = {
      sessionId: 'session-123',
      teacherId: 'teacher-123',
      status: SessionStatus.ACTIVE,
      earlyLeaveActive: true,
      currentEarlyTokenId: 'existing-token'
    };

    mockSessionService.getSession = jest.fn().mockResolvedValue(mockSession);

    const request = {
      params: { sessionId: 'session-123' },
      headers: new Map([['x-ms-client-principal', 'base64-encoded-principal']])
    } as any as HttpRequest;

    const response = await startEarlyLeave(request, mockContext);

    expect(response.status).toBe(400);
    expect(response.jsonBody.error.code).toBe('INVALID_STATE');
    expect(response.jsonBody.error.message).toContain('already active');
  });

  /**
   * Test: Token creation with correct TTL
   * Requirements: 5.1
   */
  test('should create token with correct TTL from config', async () => {
    const sessionId = 'session-123';
    const mockSession = {
      sessionId,
      teacherId: 'teacher-123',
      status: SessionStatus.ACTIVE,
      earlyLeaveActive: false
    };

    const mockToken: Token = {
      tokenId: 'token-123',
      sessionId,
      type: TokenType.EARLY_LEAVE,
      exp: Math.floor(Date.now() / 1000) + 60,
      status: 'ACTIVE' as any,
      singleUse: true,
      etag: 'etag-123'
    };

    mockSessionService.getSession = jest.fn().mockResolvedValue(mockSession);
    mockSessionService.updateEarlyLeaveStatus = jest.fn().mockResolvedValue(undefined);
    mockTokenService.createToken = jest.fn().mockResolvedValue(mockToken);

    const request = {
      params: { sessionId },
      headers: new Map([['x-ms-client-principal', 'base64-encoded-principal']])
    } as any as HttpRequest;

    await startEarlyLeave(request, mockContext);

    expect(mockTokenService.createToken).toHaveBeenCalledWith({
      sessionId,
      type: TokenType.EARLY_LEAVE,
      ttlSeconds: 60, // From mocked config
      singleUse: true
    });
  });

  /**
   * Test: Error handling
   * Requirements: 5.1
   */
  test('should return 500 on internal error', async () => {
    mockSessionService.getSession = jest.fn().mockRejectedValue(new Error('Database error'));

    const request = {
      params: { sessionId: 'session-123' },
      headers: new Map([['x-ms-client-principal', 'base64-encoded-principal']])
    } as any as HttpRequest;

    const response = await startEarlyLeave(request, mockContext);

    expect(response.status).toBe(500);
    expect(response.jsonBody.error.code).toBe('INTERNAL_ERROR');
    expect(mockContext.error).toHaveBeenCalled();
  });
});
