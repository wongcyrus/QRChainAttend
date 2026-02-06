/**
 * Stop Early Leave - REFACTORED (Simplified)
 */
import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { TableClient } from '@azure/data-tables';

function parseUserPrincipal(header: string): any {
  const decoded = Buffer.from(header, 'base64').toString('utf-8');
  return JSON.parse(decoded);
}

function hasRole(principal: any, role: string): boolean {
  const email = principal.userDetails || '';
  const emailLower = email.toLowerCase();
  
  // Check VTC domain-based roles
  if (role.toLowerCase() === 'teacher' && emailLower.endsWith('@vtc.edu.hk') && !emailLower.endsWith('@stu.vtc.edu.hk')) {
    return true;
  }
  
  if (role.toLowerCase() === 'student' && emailLower.endsWith('@stu.vtc.edu.hk')) {
    return true;
  }
  
  // Fallback to checking userRoles array
  const roles = principal.userRoles || [];
  return roles.some((r: string) => r.toLowerCase() === role.toLowerCase());
}

function getTableClient(tableName: string): TableClient {
  return TableClient.fromConnectionString(process.env.AzureWebJobsStorage!, tableName, { allowInsecureConnection: true });
}

export async function stopEarlyLeave(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  try {
    const principalHeader = request.headers.get('x-ms-client-principal');
    if (!principalHeader) {
      return { status: 401, jsonBody: { error: 'Unauthorized' } };
    }

    const principal = parseUserPrincipal(principalHeader);
    if (!hasRole(principal, 'Teacher')) {
      return { status: 403, jsonBody: { error: 'Forbidden' } };
    }

    const sessionId = request.params.sessionId;
    const sessionsTable = getTableClient('Sessions');
    const session = await sessionsTable.getEntity('SESSION', sessionId);

    // Update session to stop early leave
    const updatedSession: any = {
      partitionKey: session.partitionKey,
      rowKey: session.rowKey,
      ...session,
      earlyLeaveActive: false,
      currentEarlyTokenId: undefined
    };
    await sessionsTable.updateEntity(updatedSession, 'Replace');

    return { status: 200, jsonBody: { success: true, message: 'Early leave stopped' } };
  } catch (error: any) {
    context.error('Error:', error);
    return { status: 500, jsonBody: { error: 'Internal error' } };
  }
}

app.http('stopEarlyLeave', {
  methods: ['POST'],
  route: 'sessions/{sessionId}/stop-early-leave',
  authLevel: 'anonymous',
  handler: stopEarlyLeave
});
