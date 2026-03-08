/**
 * Get User Roles API Endpoint - REFACTORED (Self-contained)
 * No external service dependencies
 */

import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { getRolesFromEmail, parseAuthFromRequest } from '../utils/auth';

export async function getUserRoles(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  context.log('=== getUserRoles START ===');
  context.log('Method:', request.method);
  context.log('URL:', request.url);

  try {
    const principal = parseAuthFromRequest(request);
    
    if (!principal) {
      context.log('❌ Not authenticated');
      return {
        status: 401,
        jsonBody: { error: 'Not authenticated' }
      };
    }

    // Compute roles from email domain
    const email = principal.userDetails || principal.userId || '';
    context.log('✅ User email:', email);
    context.log('ORGANIZER_DOMAIN:', process.env.ORGANIZER_DOMAIN);
    context.log('ATTENDEE_DOMAIN:', process.env.ATTENDEE_DOMAIN);
    
    const roles = getRolesFromEmail(email);
    context.log('✅ Assigned roles:', JSON.stringify(roles));
    context.log('=== getUserRoles END ===');
    
    return {
      status: 200,
      jsonBody: {
        clientPrincipal: {
          userId: principal.userId,
          userDetails: email,
          identityProvider: principal.identityProvider,
          userRoles: roles,
          claims: principal.claims || []
        },
        userId: principal.userId,
        userDetails: email,
        identityProvider: principal.identityProvider,
        userRoles: roles,
        claims: principal.claims || []
      }
    };

  } catch (error: any) {
    context.error('❌ Error getting user roles:', error);
    context.error('Stack:', error.stack);
    
    return {
      status: 500,
      jsonBody: {
        error: 'Failed to get user roles',
        details: error.message
      }
    };
  }
}

app.http('getUserRoles', {
  methods: ['GET'],
  route: 'auth/me',
  authLevel: 'anonymous',
  handler: getUserRoles
});
