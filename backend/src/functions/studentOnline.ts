/**
 * Student Online Status Tracking
 * Called when student connects/disconnects from SignalR
 * Broadcasts status changes to teacher dashboard via SignalR
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

async function broadcastToSignalR(sessionId: string, message: any, context: InvocationContext) {
  try {
    const signalRConnectionString = process.env.SIGNALR_CONNECTION_STRING;
    if (!signalRConnectionString || signalRConnectionString.includes('dummy')) {
      context.log('SignalR not configured, skipping broadcast');
      return;
    }

    // Parse connection string
    const endpointMatch = signalRConnectionString.match(/Endpoint=([^;]+)/);
    const accessKeyMatch = signalRConnectionString.match(/AccessKey=([^;]+)/);
    
    if (!endpointMatch || !accessKeyMatch) {
      context.log('Invalid SignalR connection string format');
      return;
    }

    const endpoint = endpointMatch[1];
    const accessKey = accessKeyMatch[1];
    const hubName = `dashboard${sessionId.replace(/-/g, '')}`;
    
    // Create JWT token for SignalR
    const crypto = require('crypto');
    const now = Math.floor(Date.now() / 1000);
    const expiry = now + 3600;
    
    const payload = {
      aud: `${endpoint}/api/v1/hubs/${hubName}`,
      iat: now,
      exp: expiry
    };
    
    const header = {
      typ: 'JWT',
      alg: 'HS256'
    };
    
    const encodedHeader = Buffer.from(JSON.stringify(header)).toString('base64url');
    const encodedPayload = Buffer.from(JSON.stringify(payload)).toString('base64url');
    const signature = crypto
      .createHmac('sha256', accessKey)
      .update(`${encodedHeader}.${encodedPayload}`)
      .digest('base64url');
    
    const token = `${encodedHeader}.${encodedPayload}.${signature}`;

    // Send message to SignalR
    const signalRUrl = `${endpoint}/api/v1/hubs/${hubName}`;
    const response = await fetch(signalRUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        target: 'attendanceUpdated',
        arguments: [message]
      })
    });

    if (!response.ok) {
      context.log(`SignalR broadcast failed: ${response.status}`);
    } else {
      context.log('SignalR broadcast successful');
    }
  } catch (error: any) {
    context.log(`SignalR broadcast error: ${error.message}`);
  }
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

      // Broadcast to SignalR so teacher dashboard updates in real-time
      await broadcastToSignalR(sessionId, {
        studentId: studentEmail,
        isOnline: isOnline,
        lastSeen: Date.now()
      }, context);

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
