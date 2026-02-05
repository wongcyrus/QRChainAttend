/**
 * Student Online Status Tracking
 * Called when student connects/disconnects from SignalR
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

function getTableClient(tableName: string): TableClient {
  const connectionString = process.env.AzureWebJobsStorage;
  if (!connectionString) {
    throw new Error('AzureWebJobsStorage not configured');
  }
  const isLocal = connectionString.includes("127.0.0.1") || connectionString.includes("localhost");
  return TableClient.fromConnectionString(connectionString, tableName, { allowInsecureConnection: isLocal });
}

export async function studentOnline(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  context.log('Processing POST /api/sessions/{sessionId}/student-online request');

  try {
    const principalHeader = request.headers.get('x-ms-client-principal');
    if (!principalHeader) {
      return {
        status: 401,
        jsonBody: { error: { code: 'UNAUTHORIZED', message: 'Missing authentication header', timestamp: Date.now() } }
      };
    }

    const principal = parseUserPrincipal(principalHeader);
    const sessionId = request.params.sessionId;
    const studentEmail = principal.userDetails;
    
    if (!sessionId || !studentEmail) {
      return {
        status: 400,
        jsonBody: { error: { code: 'INVALID_REQUEST', message: 'Missing sessionId or email', timestamp: Date.now() } }
      };
    }

    const body = await request.json() as any;
    const isOnline = body.isOnline !== false; // Default to true

    // Update attendance record with online status
    const attendanceTable = getTableClient('Attendance');
    
    try {
      const record = await attendanceTable.getEntity(sessionId, studentEmail);
      
      // Update online status and last seen timestamp
      await attendanceTable.updateEntity({
        partitionKey: sessionId,
        rowKey: studentEmail,
        isOnline: isOnline,
        lastSeen: Date.now()
      }, 'Merge');

      context.log(`Updated online status for ${studentEmail}: ${isOnline}`);

      return {
        status: 200,
        jsonBody: { success: true }
      };
    } catch (error: any) {
      if (error.statusCode === 404) {
        return {
          status: 404,
          jsonBody: { error: { code: 'NOT_FOUND', message: 'Student not in session', timestamp: Date.now() } }
        };
      }
      throw error;
    }

  } catch (error: any) {
    context.error('Error updating online status:', error);
    
    return {
      status: 500,
      jsonBody: {
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to update online status',
          details: error.message,
          timestamp: Date.now()
        }
      }
    };
  }
}

app.http('studentOnline', {
  methods: ['POST'],
  route: 'sessions/{sessionId}/student-online',
  authLevel: 'anonymous',
  handler: studentOnline
});
