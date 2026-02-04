/**
 * Start Early Leave Window API Endpoint
 * Feature: qr-chain-attendance
 * Requirements: 5.1
 * 
 * POST /api/sessions/{sessionId}/start-early-leave
 * Activates early leave window and generates initial token
 * Requires Teacher role and session ownership
 */

import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { AuthService } from '../services/AuthService';
import { SessionService } from '../services/SessionService';
import { TokenService } from '../services/TokenService';
import { Role, SessionStatus, TokenType } from '../types';
import { getConfig } from '../config';

/**
 * Start Early Leave Response
 */
interface StartEarlyLeaveResponse {
  success: boolean;
  tokenId: string;
  etag: string;
  exp: number;  // Unix timestamp
  qrData: string;  // Base64 encoded QR data
}

/**
 * HTTP trigger function to start early leave window
 * Requirements: 5.1
 */
export async function startEarlyLeave(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  context.log('Processing POST /api/sessions/{sessionId}/start-early-leave request');

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
    
    // Require Teacher role (Requirement 5.1)
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

    // Verify teacher owns this session (Requirement 5.1)
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

    // Validate that session is active (Requirement 5.1)
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

    // Check if early leave is already active
    if (session.earlyLeaveActive) {
      return {
        status: 400,
        jsonBody: {
          error: {
            code: 'INVALID_STATE',
            message: 'Early leave window is already active',
            timestamp: Date.now()
          }
        }
      };
    }

    // Generate initial early-leave token (Requirement 5.1)
    const config = getConfig();
    const tokenService = new TokenService();
    const token = await tokenService.createToken({
      sessionId,
      type: TokenType.EARLY_LEAVE,
      ttlSeconds: config.earlyLeaveRotationSeconds,
      singleUse: true
    });

    // Set earlyLeaveActive flag and update session (Requirement 5.1)
    await sessionService.updateEarlyLeaveStatus(sessionId, true, token.tokenId);

    // Generate QR data
    const qrData = {
      type: 'EARLY_LEAVE',
      sessionId,
      tokenId: token.tokenId,
      etag: token.etag,
      exp: token.exp
    };
    const qrDataEncoded = Buffer.from(JSON.stringify(qrData)).toString('base64');

    // Return response
    const response: StartEarlyLeaveResponse = {
      success: true,
      tokenId: token.tokenId,
      etag: token.etag,
      exp: token.exp,
      qrData: qrDataEncoded
    };

    context.log(`Early leave window started for session ${sessionId}, token: ${token.tokenId}`);

    return {
      status: 200,
      jsonBody: response
    };

  } catch (error: any) {
    context.error('Error starting early leave window:', error);
    
    return {
      status: 500,
      jsonBody: {
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to start early leave window',
          details: error.message,
          timestamp: Date.now()
        }
      }
    };
  }
}

