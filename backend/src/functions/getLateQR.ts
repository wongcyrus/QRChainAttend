/**
 * Get Late Entry QR Code API Endpoint
 * Feature: qr-chain-attendance
 * Requirements: 4.1
 * 
 * GET /api/sessions/{sessionId}/late-qr
 * Returns current active late entry token for teacher display
 * Requires Teacher role and session ownership
 */

import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { AuthService } from '../services/AuthService';
import { SessionService } from '../services/SessionService';
import { TokenService } from '../services/TokenService';
import { Role, SessionStatus } from '../types';

/**
 * Late Entry QR Response
 */
interface LateEntryQRResponse {
  tokenId: string;
  etag: string;
  exp: number;  // Unix timestamp
  qrData: string;  // Base64 encoded QR data
}

/**
 * HTTP trigger function to get current late entry QR code
 * Requirements: 4.1
 */
export async function getLateQR(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  context.log('Processing GET /api/sessions/{sessionId}/late-qr request');

  try {
    // Parse and validate authentication
    const authService = new AuthService();
    const principalHeader = request.headers.get('x-ms-client-principal');
    
    if (!principalHeader) {
      return {
        status: 401,
        jsonBody: {
          error: {
            code: 'UNAUTHORIZED',
            message: 'Missing authentication header',
            timestamp: Date.now()
          }
        }
      };
    }

    const principal = authService.parseUserPrincipal(principalHeader);
    
    // Require Teacher role (Requirement 4.1)
    try {
      authService.requireRole(principal, Role.TEACHER);
    } catch (error: any) {
      return {
        status: 403,
        jsonBody: {
          error: {
            code: 'FORBIDDEN',
            message: error.message,
            timestamp: Date.now()
          }
        }
      };
    }

    // Get session ID from route parameters
    const sessionId = request.params.sessionId;
    if (!sessionId) {
      return {
        status: 400,
        jsonBody: {
          error: {
            code: 'INVALID_REQUEST',
            message: 'Missing sessionId parameter',
            timestamp: Date.now()
          }
        }
      };
    }

    // Get session and validate ownership
    const sessionService = new SessionService();
    const session = await sessionService.getSession(sessionId);
    
    if (!session) {
      return {
        status: 404,
        jsonBody: {
          error: {
            code: 'NOT_FOUND',
            message: 'Session not found',
            timestamp: Date.now()
          }
        }
      };
    }

    // Verify teacher owns this session (Requirement 4.1)
    const teacherId = authService.getUserId(principal);
    if (session.teacherId !== teacherId) {
      return {
        status: 403,
        jsonBody: {
          error: {
            code: 'FORBIDDEN',
            message: 'Unauthorized: You do not own this session',
            timestamp: Date.now()
          }
        }
      };
    }

    // Validate that session is active (Requirement 4.1)
    if (session.status !== SessionStatus.ACTIVE) {
      return {
        status: 400,
        jsonBody: {
          error: {
            code: 'INVALID_STATE',
            message: 'Session is not active',
            timestamp: Date.now()
          }
        }
      };
    }

    // Check if late entry is active
    if (!session.lateEntryActive || !session.currentLateTokenId) {
      return {
        status: 400,
        jsonBody: {
          error: {
            code: 'INVALID_STATE',
            message: 'Late entry is not active for this session',
            timestamp: Date.now()
          }
        }
      };
    }

    // Get the current late entry token
    const tokenService = new TokenService();
    const token = await tokenService.getToken(session.currentLateTokenId, sessionId);
    
    if (!token) {
      return {
        status: 404,
        jsonBody: {
          error: {
            code: 'NOT_FOUND',
            message: 'Late entry token not found',
            timestamp: Date.now()
          }
        }
      };
    }

    // Validate token is still active
    const validation = await tokenService.validateToken(token.tokenId, sessionId);
    if (!validation.valid) {
      return {
        status: 400,
        jsonBody: {
          error: {
            code: 'TOKEN_EXPIRED',
            message: 'Current late entry token has expired',
            details: 'Token will be rotated shortly',
            timestamp: Date.now()
          }
        }
      };
    }

    // Generate QR data
    const qrData = {
      type: 'LATE_ENTRY',
      sessionId,
      tokenId: token.tokenId,
      etag: token.etag,
      exp: token.exp
    };
    const qrDataEncoded = Buffer.from(JSON.stringify(qrData)).toString('base64');

    // Return response
    const response: LateEntryQRResponse = {
      tokenId: token.tokenId,
      etag: token.etag,
      exp: token.exp,
      qrData: qrDataEncoded
    };

    return {
      status: 200,
      jsonBody: response
    };

  } catch (error: any) {
    context.error('Error getting late entry QR:', error);
    
    return {
      status: 500,
      jsonBody: {
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to get late entry QR code',
          details: error.message,
          timestamp: Date.now()
        }
      }
    };
  }
}

// Register the HTTP trigger
app.http('getLateQR', {
  methods: ['GET'],
  route: 'sessions/{sessionId}/late-qr',
  authLevel: 'anonymous',
  handler: getLateQR
});
