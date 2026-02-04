/**
 * Create Session API Endpoint
 * Feature: qr-chain-attendance
 * Requirements: 2.1, 2.2, 2.5
 * 
 * POST /api/sessions
 * Creates a new session with the specified parameters
 * Requires Teacher role
 */

import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { AuthService } from '../services/AuthService';
import { SessionService } from '../services/SessionService';
import { Role, CreateSessionRequest, CreateSessionResponse } from '../types';

/**
 * HTTP trigger function to create a new session
 */
export async function createSession(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  context.log('Processing POST /api/sessions request');

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

    // Parse request body
    const body = await request.json() as CreateSessionRequest;

    // Validate required fields (Requirement 2.1)
    if (!body.classId || !body.startAt || !body.endAt || body.lateCutoffMinutes === undefined) {
      return {
        status: 400,
        jsonBody: {
          error: {
            code: 'INVALID_REQUEST',
            message: 'Missing required fields: classId, startAt, endAt, lateCutoffMinutes',
            timestamp: Date.now()
          }
        }
      };
    }

    // Create session
    const sessionService = new SessionService();
    const teacherId = authService.getUserId(principal);
    const { session, sessionQR } = await sessionService.createSession(teacherId, body);

    // Return response (Requirement 2.5)
    const response: CreateSessionResponse = {
      sessionId: session.sessionId,
      sessionQR
    };

    return {
      status: 201,
      jsonBody: response
    };

  } catch (error: any) {
    context.error('Error creating session:', error);
    
    return {
      status: 500,
      jsonBody: {
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to create session',
          details: error.message,
          timestamp: Date.now()
        }
      }
    };
  }
}

