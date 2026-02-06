/**
 * Get Roles Function for Azure Static Web Apps
 * This function is called by Static Web Apps to assign custom roles
 * Based on: https://learn.microsoft.com/en-us/azure/static-web-apps/assign-roles-microsoft-graph
 */

import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';

// Assign roles based on email domain
function getRolesFromEmail(email: string): string[] {
  const roles: string[] = [];
  
  if (!email) return roles;
  
  const emailLower = email.toLowerCase();
  
  // Students: @stu.vtc.edu.hk
  if (emailLower.endsWith('@stu.vtc.edu.hk')) {
    roles.push('student');
  }
  // Teachers: @vtc.edu.hk (but not @stu.vtc.edu.hk)
  else if (emailLower.endsWith('@vtc.edu.hk')) {
    roles.push('teacher');
  }
  
  return roles;
}

export async function getRoles(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  context.log('Processing POST /api/auth/roles request');

  try {
    // Get the user principal from the header (provided by Static Web Apps)
    const principalHeader = request.headers.get('x-ms-client-principal');
    
    if (!principalHeader) {
      context.log('No x-ms-client-principal header found');
      return {
        status: 200,
        jsonBody: {
          roles: []
        }
      };
    }

    // Decode the principal
    const principal = JSON.parse(Buffer.from(principalHeader, 'base64').toString('utf-8'));
    const email = principal.userDetails || '';
    
    context.log('User email:', email);
    
    // Compute roles from email domain
    const roles = getRolesFromEmail(email);
    
    context.log('Assigned roles:', roles);
    
    // Return roles in the format expected by Static Web Apps
    return {
      status: 200,
      jsonBody: {
        roles: roles
      }
    };

  } catch (error: any) {
    context.error('Error getting roles:', error);
    
    // Return empty roles on error (fail safe)
    return {
      status: 200,
      jsonBody: {
        roles: []
      }
    };
  }
}

app.http('getRoles', {
  methods: ['POST'],
  route: 'auth/roles',
  authLevel: 'anonymous',
  handler: getRoles
});
