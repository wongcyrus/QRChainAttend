/**
 * Start Exit Chain API Endpoint
 * Feature: qr-chain-attendance
 * Requirements: 6.1, 6.2
 * 
 * POST /api/sessions/{sessionId}/start-exit-chain?count=K
 * Starts K exit chains by randomly selecting eligible students
 * Requires Teacher role and session ownership
 */

import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { AuthService } from '../services/AuthService';
import { SessionService } from '../services/SessionService';
import { chainService } from '../services/ChainService';
import { Role, ChainPhase, SeedEntryResponse } from '../types';

/**
 * HTTP trigger function to start exit chains
 */
export async function startExitChain(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  context.log('Processing POST /api/sessions/{sessionId}/start-exit-chain request');

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
    
    // Require Teacher role
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

    // Get sessionId from route parameters
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

    // Get count from query parameters
    const countParam = request.query.get('count');
    if (!countParam) {
      return {
        status: 400,
        jsonBody: {
          error: {
            code: 'INVALID_REQUEST',
            message: 'Missing count query parameter',
            timestamp: Date.now()
          }
        }
      };
    }

    const count = parseInt(countParam, 10);
    if (isNaN(count) || count <= 0) {
      return {
        status: 400,
        jsonBody: {
          error: {
            code: 'INVALID_REQUEST',
            message: 'Invalid count parameter: must be a positive integer',
            timestamp: Date.now()
          }
        }
      };
    }

    // Verify session exists and teacher owns it
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

    const teacherId = authService.getUserId(principal);
    if (session.teacherId !== teacherId) {
      return {
        status: 403,
        jsonBody: {
          error: {
            code: 'FORBIDDEN',
            message: 'You do not own this session',
            timestamp: Date.now()
          }
        }
      };
    }

    // Start exit chains (Requirements 6.1, 6.2)
    // ChainService.seedChains with EXIT phase will automatically filter for eligible students:
    // - Only students with PRESENT_ENTRY or LATE_ENTRY status
    // - Who did not early-leave (no earlyLeaveAt timestamp)
    const chains = await chainService.seedChains(sessionId, ChainPhase.EXIT, count);

    // Return response
    const response: SeedEntryResponse = {
      chainsCreated: chains.length,
      initialHolders: chains.map(chain => chain.lastHolder!).filter(Boolean)
    };

    return {
      status: 200,
      jsonBody: response
    };

  } catch (error: any) {
    context.error('Error starting exit chains:', error);
    
    // Handle specific error cases
    if (error.message.includes('Insufficient eligible students')) {
      return {
        status: 400,
        jsonBody: {
          error: {
            code: 'INSUFFICIENT_STUDENTS',
            message: error.message,
            timestamp: Date.now()
          }
        }
      };
    }
    
    return {
      status: 500,
      jsonBody: {
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to start exit chains',
          details: error.message,
          timestamp: Date.now()
        }
      }
    };
  }
}


app.http('startExitChain', {
  methods: ['POST'],
  route: 'sessions/{sessionId}/start-exit-chain',
  authLevel: 'anonymous',
  handler: startExitChain
});
