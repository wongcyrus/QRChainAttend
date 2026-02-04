/**
 * SignalR Negotiate Endpoint
 * Feature: qr-chain-attendance
 * Requirements: 12.6
 * 
 * POST /api/sessions/{sessionId}/dashboard/negotiate
 * Establishes SignalR connection for real-time dashboard updates
 * Requires Teacher role and session ownership
 */

import { app, HttpRequest, HttpResponseInit, InvocationContext, input } from '@azure/functions';
import { AuthService } from '../services/AuthService';
import { SessionService } from '../services/SessionService';
import { Role } from '../types';

/**
 * Define SignalR input binding for connection negotiation
 * This binding automatically generates connection info for the client
 */
const signalRConnectionInfo = input.generic({
  type: 'signalRConnectionInfo',
  name: 'connectionInfo',
  hubName: 'attendance',
  userId: '{userId}',
  connectionStringSetting: 'SIGNALR_CONNECTION_STRING'
});

/**
 * HTTP trigger function for SignalR connection negotiation
 * 
 * This endpoint enables teachers to establish a SignalR connection
 * for receiving real-time dashboard updates. The connection is
 * authenticated using Entra ID tokens and scoped to a specific session.
 * 
 * Requirements: 12.6
 */
export async function negotiate(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  context.log('Processing POST /api/sessions/{sessionId}/dashboard/negotiate request');

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
    
    // Require Teacher role (Requirement 12.6)
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

    // Get SignalR connection info from input binding
    // The Azure Functions runtime automatically populates this with:
    // - url: SignalR Service endpoint URL
    // - accessToken: JWT token for authentication
    // The connection will be added to the group "session:{sessionId}"
    const connectionInfo = context.extraInputs.get(signalRConnectionInfo);

    context.log(`SignalR connection negotiated for teacher ${teacherId} on session ${sessionId}`);

    // Return connection info to client
    // Client will use this to establish WebSocket connection
    return {
      status: 200,
      jsonBody: connectionInfo
    };

  } catch (error: any) {
    context.error('Error negotiating SignalR connection:', error);
    
    return {
      status: 500,
      jsonBody: {
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to negotiate SignalR connection',
          details: error.message,
          timestamp: Date.now()
        }
      }
    };
  }
}


app.http('negotiate', {
  methods: ['POST'],
  route: 'sessions/{sessionId}/dashboard/negotiate',
  authLevel: 'anonymous',
  handler: negotiate
});
