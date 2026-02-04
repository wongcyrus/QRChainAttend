/**
 * Seed Entry Chains API Endpoint
 * Feature: qr-chain-attendance
 * Requirements: 3.1
 * 
 * POST /api/sessions/{sessionId}/seed-entry?count=K
 * Seeds K entry chains by randomly selecting joined students
 * Requires Teacher role and session ownership
 */

import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { AuthService } from '../services/AuthService';
import { SessionService } from '../services/SessionService';
import { chainService } from '../services/ChainService';
import { Role, ChainPhase, SeedEntryResponse } from '../types';

/**
 * HTTP trigger function to seed entry chains
 */
export async function seedEntry(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  context.log('Processing POST /api/sessions/{sessionId}/seed-entry request');

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

    // Seed entry chains (Requirement 3.1)
    const chains = await chainService.seedChains(sessionId, ChainPhase.ENTRY, count);

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
    context.error('Error seeding entry chains:', error);
    
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
          message: 'Failed to seed entry chains',
          details: error.message,
          timestamp: Date.now()
        }
      }
    };
  }
}


app.http('seedEntry', {
  methods: ['POST'],
  route: 'sessions/{sessionId}/seed-entry',
  authLevel: 'anonymous',
  handler: seedEntry
});
