/**
 * Mark Student Exit
 * Allows teacher to manually mark a student as having left the session
 */

import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { TableClient } from '@azure/data-tables';

function parseUserPrincipal(header: string): any {
  try {
    const decoded = Buffer.from(header, 'base64').toString('utf-8');
    return JSON.parse(decoded);
  } catch {
    throw new Error('Invalid authentication header');
  }
}

function hasRole(principal: any, role: string): boolean {
  const email = principal.userDetails || '';
  const emailLower = email.toLowerCase();
  
  if (role.toLowerCase() === 'teacher' && emailLower.endsWith('@vtc.edu.hk') && !emailLower.endsWith('@stu.vtc.edu.hk')) {
    return true;
  }
  
  const roles = principal.userRoles || [];
  return roles.some((r: string) => r.toLowerCase() === role.toLowerCase());
}

function getTableClient(tableName: string): TableClient {
  const connectionString = process.env.AzureWebJobsStorage;
  if (!connectionString) {
    throw new Error('AzureWebJobsStorage not configured');
  }
  const isLocal = connectionString.includes("127.0.0.1") || connectionString.includes("localhost");
  return TableClient.fromConnectionString(connectionString, tableName, { allowInsecureConnection: isLocal });
}

export async function markStudentExit(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  context.log('Processing POST /api/sessions/{sessionId}/mark-exit request');

  try {
    const principalHeader = request.headers.get('x-ms-client-principal');
    if (!principalHeader) {
      return {
        status: 401,
        jsonBody: { error: { code: 'UNAUTHORIZED', message: 'Missing authentication header' } }
      };
    }

    const principal = parseUserPrincipal(principalHeader);
    
    if (!hasRole(principal, 'Teacher')) {
      return {
        status: 403,
        jsonBody: { error: { code: 'FORBIDDEN', message: 'Teacher role required' } }
      };
    }

    const sessionId = request.params.sessionId;
    const body = await request.json() as any;
    const { studentId } = body;

    if (!sessionId || !studentId) {
      return {
        status: 400,
        jsonBody: { error: { code: 'INVALID_REQUEST', message: 'Missing sessionId or studentId' } }
      };
    }

    const attendanceTable = getTableClient('Attendance');
    const now = Math.floor(Date.now() / 1000);

    // Get attendance record
    const attendance = await attendanceTable.getEntity(sessionId, studentId);

    // Mark as exited
    await attendanceTable.updateEntity({
      partitionKey: sessionId,
      rowKey: studentId,
      exitVerified: true,
      leftAt: now
    }, 'Merge');

    context.log(`Marked student ${studentId} as exited from session ${sessionId}`);

    return {
      status: 200,
      jsonBody: {
        success: true,
        studentId,
        leftAt: now
      }
    };

  } catch (error: any) {
    context.error('Error marking student exit:', error);
    
    return {
      status: 500,
      jsonBody: {
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to mark student exit',
          details: error.message
        }
      }
    };
  }
}

app.http('markStudentExit', {
  methods: ['POST'],
  route: 'sessions/{sessionId}/mark-exit',
  authLevel: 'anonymous',
  handler: markStudentExit
});
