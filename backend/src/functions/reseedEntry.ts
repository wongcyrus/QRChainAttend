/**
 * reseedEntry - STUB (Not Yet Implemented)
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

export async function reseedEntry(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  context.log('reseedEntry called - not yet implemented');

  const principalHeader = request.headers.get('x-ms-client-principal') || request.headers.get('x-client-principal');
  if (!principalHeader) {
    return {
      status: 401,
      jsonBody: {
        error: {
          code: 'UNAUTHORIZED',
          message: 'Missing authentication header',
          function: 'reseedEntry',
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
          function: 'reseedEntry',
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
        function: 'reseedEntry',
        timestamp: Date.now()
      }
    }
  };
}

app.http('reseedEntry', {
  methods: ['GET', 'POST'],
  route: 'reseedEntry',
  authLevel: 'anonymous',
  handler: reseedEntry
});
