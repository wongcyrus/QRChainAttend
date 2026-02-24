/**
 * startEarlyLeave - STUB (Not Yet Implemented)
 * This function deploys successfully but returns a placeholder response
 */
import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';

function parseUserPrincipal(header: string): any {
  try {
    const decoded = Buffer.from(header, 'base64').toString('utf-8');
    return JSON.parse(decoded);
  } catch {
    throw new Error('Invalid authentication header');
  }
}

function hasRole(principal: any, role: string): boolean {
  const roles = principal?.userRoles || [];
  return roles.some((r: string) => r.toLowerCase() === role.toLowerCase());
}

export async function startEarlyLeave(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  context.log('startEarlyLeave called - not yet implemented');

  const principalHeader = request.headers.get('x-ms-client-principal') || request.headers.get('x-client-principal');
  if (!principalHeader) {
    return {
      status: 401,
      jsonBody: {
        error: {
          code: 'UNAUTHORIZED',
          message: 'Missing authentication header',
          function: 'startEarlyLeave',
          timestamp: Date.now()
        }
      }
    };
  }

  const principal = parseUserPrincipal(principalHeader);
  if (!hasRole(principal, 'teacher')) {
    return {
      status: 403,
      jsonBody: {
        error: {
          code: 'FORBIDDEN',
          message: 'Teacher role required',
          function: 'startEarlyLeave',
          timestamp: Date.now()
        }
      }
    };
  }
  
  return {
    status: 501,
    jsonBody: {
      error: {
        code: 'NOT_IMPLEMENTED',
        message: 'This function is not yet implemented',
        function: 'startEarlyLeave',
        timestamp: Date.now()
      }
    }
  };
}

app.http('startEarlyLeave', {
  methods: ['GET', 'POST'],
  route: 'startEarlyLeave',
  authLevel: 'anonymous',
  handler: startEarlyLeave
});
