/**
 * Get User Roles Function
 * Returns user roles based on email domain
 * - @vtc.edu.hk = teacher
 * - @stu.vtc.edu.hk = student
 * - others = authenticated only
 */

import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';

interface TokenClaim {
  typ: string;
  val: string;
}

interface ClientPrincipal {
  identityProvider: string;
  userId: string;
  userDetails: string;
  userRoles: string[];
  claims?: TokenClaim[];
}

function getRoleFromEmail(email: string): string[] {
  const roles: string[] = ['authenticated'];
  
  if (!email) {
    return roles;
  }

  const emailLower = email.toLowerCase();
  
  // Check email domain
  if (emailLower.endsWith('@stu.vtc.edu.hk')) {
    roles.push('student');
  } else if (emailLower.endsWith('@vtc.edu.hk')) {
    roles.push('teacher');
  }
  
  return roles;
}

export async function getUserRoles(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  context.log('Getting user roles from email domain');

  try {
    // Get the client principal from the request header (set by Azure Static Web Apps)
    const clientPrincipalHeader = request.headers.get('x-ms-client-principal');
    
    if (!clientPrincipalHeader) {
      return {
        status: 401,
        jsonBody: { error: 'Not authenticated' }
      };
    }

    // Decode the base64-encoded client principal
    const decoded = Buffer.from(clientPrincipalHeader, 'base64').toString('utf-8');
    const clientPrincipal: ClientPrincipal = JSON.parse(decoded);

    const email = clientPrincipal.userDetails || '';
    const roles = getRoleFromEmail(email);

    context.log('User authenticated:', {
      email: email,
      assignedRoles: roles
    });

    return {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store, no-cache, must-revalidate'
      },
      jsonBody: {
        userId: clientPrincipal.userId,
        userDetails: clientPrincipal.userDetails,
        userRoles: roles,
        identityProvider: clientPrincipal.identityProvider
      }
    };
  } catch (error) {
    context.error('Error getting user roles:', error);
    return {
      status: 500,
      jsonBody: { 
        error: 'Failed to get user roles',
        message: error instanceof Error ? error.message : 'Unknown error'
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
