/**
 * Unit Tests for Get Late Entry QR Code API Endpoint
 * Feature: qr-chain-attendance
 * Requirements: 4.1
 */

import { HttpRequest, InvocationContext } from '@azure/functions';
import { getLateQR } from './getLateQR';
import { AuthService } from '../services/AuthService';
import { SessionService } from '../services/SessionService';
import { TokenService } from '../services/TokenService';
import { Role, SessionStatus, TokenType, TokenStatus } from '../types';

// Mock services
jest.mock('../services/AuthService');
jest.mock('../services/SessionService');
jest.mock('../services/TokenService');

describe('getLateQR', () => {
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
      error: jest.fn(),
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

    // Mock TokenService
    mockTokenService = new TokenService() as jest.Mocked<TokenService>;

    // Set up constructor mocks
    (AuthService as jest.Mock).mockImplementation(() => mockAuthService);
    (SessionService as jest.Mock).mockImplementation(() => mockSessionService);
    (TokenService as jest.Mock).mockImplementation(() => mockTokenService);
  });

  describe('Authentication and Authorization', () => {
    it('should return 401 when authentication header is missing', async () => {
      const request = {
        headers: new Map(),
        params: { sessionId: 'session-123' }
      } as any as HttpRequest;

      const response = await getLateQR(request, mockContext);

      expect(response.status).toBe(401);
      expect(response.jsonBody).toEqual({
        error: {
          code: 'UNAUTHORIZED',
          message: 'Missing authentication header',
          timestamp: expect.any(Number)
        }
      });
    });

    it('should return 403 when user is not a teacher', async () => {
      mockAuthService.requireRole.mockImplementation(() => {
        throw new Error('User does not have required role: teacher');
      });

      const request = {
        headers: new Map([['x-ms-client-principal', 'encoded-principal']]),
        params: { sessionId: 'session-123' }
      } as any as HttpRequest;

      const response = await getLateQR(request, mockContext);

      expect(response.status).toBe(403);
      expect(response.jsonBody).toEqual({
        error: {
          code: 'FORBIDDEN',
          message: 'User does not have required role: teacher',
          timestamp: expect.any(Number)
        }
      });
    });

    it('should return 403 when teacher does not own the session', async () => {
      mockSessionService.getSession = jest.fn().mockResolvedValue({
        sessionId: 'session-123',
        teacherId: 'other-teacher',
        status: SessionStatus.ACTIVE,
        lateEntryActive: true,
        currentLateTokenId: 'token-123'
      });

      const request = {
        headers: new Map([['x-ms-client-principal', 'encoded-principal']]),
        params: { sessionId: 'session-123' }
      } as any as HttpRequest;

      const response = await getLateQR(request, mockContext);

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

  describe('Session Validation', () => {
    it('should return 400 when sessionId parameter is missing', async () => {
      const request = {
        headers: new Map([['x-ms-client-principal', 'encoded-principal']]),
        params: {}
      } as any as HttpRequest;

      const response = await getLateQR(request, mockContext);

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
      mockSessionService.getSession = jest.fn().mockResolvedValue(null);

      const request = {
        headers: new Map([['x-ms-client-principal', 'encoded-principal']]),
        params: { sessionId: 'nonexistent-session' }
      } as any as HttpRequest;

      const response = await getLateQR(request, mockContext);

      expect(response.status).toBe(404);
      expect(response.jsonBody).toEqual({
        error: {
          code: 'NOT_FOUND',
          message: 'Session not found',
          timestamp: expect.any(Number)
        }
      });
    });

    it('should return 400 when session is not active', async () => {
      mockSessionService.getSession = jest.fn().mockResolvedValue({
        sessionId: 'session-123',
        teacherId: 'teacher-123',
        status: SessionStatus.ENDED,
        lateEntryActive: false
      });

      const request = {
        headers: new Map([['x-ms-client-principal', 'encoded-principal']]),
        params: { sessionId: 'session-123' }
      } as any as HttpRequest;

      const response = await getLateQR(request, mockContext);

      expect(response.status).toBe(400);
      expect(response.jsonBody).toEqual({
        error: {
          code: 'INVALID_STATE',
          message: 'Session is not active',
          timestamp: expect.any(Number)
        }
      });
    });

    it('should return 400 when late entry is not active', async () => {
      mockSessionService.getSession = jest.fn().mockResolvedValue({
        sessionId: 'session-123',
        teacherId: 'teacher-123',
        status: SessionStatus.ACTIVE,
        lateEntryActive: false
      });

      const request = {
        headers: new Map([['x-ms-client-principal', 'encoded-principal']]),
        params: { sessionId: 'session-123' }
      } as any as HttpRequest;

      const response = await getLateQR(request, mockContext);

      expect(response.status).toBe(400);
      expect(response.jsonBody).toEqual({
        error: {
          code: 'INVALID_STATE',
          message: 'Late entry is not active for this session',
          timestamp: expect.any(Number)
        }
      });
    });

    it('should return 400 when late entry is active but no token exists', async () => {
      mockSessionService.getSession = jest.fn().mockResolvedValue({
        sessionId: 'session-123',
        teacherId: 'teacher-123',
        status: SessionStatus.ACTIVE,
        lateEntryActive: true,
        currentLateTokenId: undefined
      });

      const request = {
        headers: new Map([['x-ms-client-principal', 'encoded-principal']]),
        params: { sessionId: 'session-123' }
      } as any as HttpRequest;

      const response = await getLateQR(request, mockContext);

      expect(response.status).toBe(400);
      expect(response.jsonBody).toEqual({
        error: {
          code: 'INVALID_STATE',
          message: 'Late entry is not active for this session',
          timestamp: expect.any(Number)
        }
      });
    });
  });

  describe('Token Validation', () => {
    it('should return 404 when token does not exist', async () => {
      mockSessionService.getSession = jest.fn().mockResolvedValue({
        sessionId: 'session-123',
        teacherId: 'teacher-123',
        status: SessionStatus.ACTIVE,
        lateEntryActive: true,
        currentLateTokenId: 'token-123'
      });

      mockTokenService.getToken = jest.fn().mockResolvedValue(null);

      const request = {
        headers: new Map([['x-ms-client-principal', 'encoded-principal']]),
        params: { sessionId: 'session-123' }
      } as any as HttpRequest;

      const response = await getLateQR(request, mockContext);

      expect(response.status).toBe(404);
      expect(response.jsonBody).toEqual({
        error: {
          code: 'NOT_FOUND',
          message: 'Late entry token not found',
          timestamp: expect.any(Number)
        }
      });
    });

    it('should return 400 when token has expired', async () => {
      const expiredTime = Math.floor(Date.now() / 1000) - 100;

      mockSessionService.getSession = jest.fn().mockResolvedValue({
        sessionId: 'session-123',
        teacherId: 'teacher-123',
        status: SessionStatus.ACTIVE,
        lateEntryActive: true,
        currentLateTokenId: 'token-123'
      });

      mockTokenService.getToken = jest.fn().mockResolvedValue({
        tokenId: 'token-123',
        sessionId: 'session-123',
        type: TokenType.LATE_ENTRY,
        exp: expiredTime,
        status: TokenStatus.ACTIVE,
        singleUse: true,
        etag: 'etag-123'
      });

      mockTokenService.validateToken = jest.fn().mockResolvedValue({
        valid: false,
        error: 'EXPIRED'
      });

      const request = {
        headers: new Map([['x-ms-client-principal', 'encoded-principal']]),
        params: { sessionId: 'session-123' }
      } as any as HttpRequest;

      const response = await getLateQR(request, mockContext);

      expect(response.status).toBe(400);
      expect(response.jsonBody).toEqual({
        error: {
          code: 'TOKEN_EXPIRED',
          message: 'Current late entry token has expired',
          details: 'Token will be rotated shortly',
          timestamp: expect.any(Number)
        }
      });
    });
  });

  describe('Successful Response', () => {
    it('should return 200 with valid late entry QR data', async () => {
      const futureTime = Math.floor(Date.now() / 1000) + 60;

      mockSessionService.getSession = jest.fn().mockResolvedValue({
        sessionId: 'session-123',
        teacherId: 'teacher-123',
        status: SessionStatus.ACTIVE,
        lateEntryActive: true,
        currentLateTokenId: 'token-123'
      });

      mockTokenService.getToken = jest.fn().mockResolvedValue({
        tokenId: 'token-123',
        sessionId: 'session-123',
        type: TokenType.LATE_ENTRY,
        exp: futureTime,
        status: TokenStatus.ACTIVE,
        singleUse: true,
        etag: 'etag-123'
      });

      mockTokenService.validateToken = jest.fn().mockResolvedValue({
        valid: true,
        token: {
          tokenId: 'token-123',
          sessionId: 'session-123',
          type: TokenType.LATE_ENTRY,
          exp: futureTime,
          status: TokenStatus.ACTIVE,
          singleUse: true,
          etag: 'etag-123'
        }
      });

      const request = {
        headers: new Map([['x-ms-client-principal', 'encoded-principal']]),
        params: { sessionId: 'session-123' }
      } as any as HttpRequest;

      const response = await getLateQR(request, mockContext);

      expect(response.status).toBe(200);
      expect(response.jsonBody).toMatchObject({
        tokenId: 'token-123',
        etag: 'etag-123',
        exp: futureTime,
        qrData: expect.any(String)
      });

      // Verify QR data is properly encoded
      const qrData = JSON.parse(
        Buffer.from(response.jsonBody.qrData, 'base64').toString()
      );
      expect(qrData).toEqual({
        type: 'LATE_ENTRY',
        sessionId: 'session-123',
        tokenId: 'token-123',
        etag: 'etag-123',
        exp: futureTime
      });
    });

    it('should call all services with correct parameters', async () => {
      const futureTime = Math.floor(Date.now() / 1000) + 60;

      mockSessionService.getSession = jest.fn().mockResolvedValue({
        sessionId: 'session-123',
        teacherId: 'teacher-123',
        status: SessionStatus.ACTIVE,
        lateEntryActive: true,
        currentLateTokenId: 'token-123'
      });

      mockTokenService.getToken = jest.fn().mockResolvedValue({
        tokenId: 'token-123',
        sessionId: 'session-123',
        type: TokenType.LATE_ENTRY,
        exp: futureTime,
        status: TokenStatus.ACTIVE,
        singleUse: true,
        etag: 'etag-123'
      });

      mockTokenService.validateToken = jest.fn().mockResolvedValue({
        valid: true
      });

      const request = {
        headers: new Map([['x-ms-client-principal', 'encoded-principal']]),
        params: { sessionId: 'session-123' }
      } as any as HttpRequest;

      await getLateQR(request, mockContext);

      expect(mockAuthService.parseUserPrincipal).toHaveBeenCalledWith('encoded-principal');
      expect(mockAuthService.requireRole).toHaveBeenCalledWith(
        expect.objectContaining({ userId: 'teacher-123' }),
        Role.TEACHER
      );
      expect(mockSessionService.getSession).toHaveBeenCalledWith('session-123');
      expect(mockTokenService.getToken).toHaveBeenCalledWith('token-123', 'session-123');
      expect(mockTokenService.validateToken).toHaveBeenCalledWith('token-123', 'session-123');
    });
  });

  describe('Error Handling', () => {
    it('should return 500 when an unexpected error occurs', async () => {
      mockSessionService.getSession = jest.fn().mockRejectedValue(
        new Error('Database connection failed')
      );

      const request = {
        headers: new Map([['x-ms-client-principal', 'encoded-principal']]),
        params: { sessionId: 'session-123' }
      } as any as HttpRequest;

      const response = await getLateQR(request, mockContext);

      expect(response.status).toBe(500);
      expect(response.jsonBody).toEqual({
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to get late entry QR code',
          details: 'Database connection failed',
          timestamp: expect.any(Number)
        }
      });
      expect(mockContext.error).toHaveBeenCalled();
    });
  });
});
