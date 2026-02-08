/**
 * SignalR Broadcast Utility
 * Provides functions to broadcast attendance and chain updates via SignalR
 */
import { InvocationContext } from '@azure/functions';

export async function broadcastAttendanceUpdate(
  sessionId: string,
  update: {
    studentId: string;
    entryStatus?: string;
    exitVerified?: boolean;
    earlyLeaveAt?: number;
    isOnline?: boolean;
    locationWarning?: string;
  },
  context: InvocationContext
): Promise<void> {
  try {
    const signalRConnectionString = process.env.SIGNALR_CONNECTION_STRING;
    if (!signalRConnectionString || signalRConnectionString.includes('dummy')) {
      context.log('SignalR not configured, skipping attendance broadcast');
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

    // Send attendance update to SignalR
    const signalRUrl = `${endpoint}/api/v1/hubs/${hubName}`;
    context.log(`Broadcasting attendance update to: ${signalRUrl}`);
    
    const response = await fetch(signalRUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        target: 'attendanceUpdate',
        arguments: [update]
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      context.log(`Attendance broadcast failed: ${response.status} - ${errorText}`);
    } else {
      context.log('Attendance broadcast successful');
    }
  } catch (error: any) {
    context.log(`Attendance broadcast error: ${error.message}`);
  }
}

export async function broadcastChainUpdate(
  sessionId: string,
  update: {
    chainId: string;
    phase: string;
    lastHolder: string;
    lastSeq: number;
    state: string;
  },
  context: InvocationContext
): Promise<void> {
  try {
    const signalRConnectionString = process.env.SIGNALR_CONNECTION_STRING;
    if (!signalRConnectionString || signalRConnectionString.includes('dummy')) {
      context.log('SignalR not configured, skipping chain broadcast');
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

    // Send chain update to SignalR
    const signalRUrl = `${endpoint}/api/v1/hubs/${hubName}`;
    context.log(`Broadcasting chain update to: ${signalRUrl}`);
    
    const response = await fetch(signalRUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        target: 'chainUpdate',
        arguments: [update]
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      context.log(`Chain broadcast failed: ${response.status} - ${errorText}`);
    } else {
      context.log('Chain broadcast successful');
    }
  } catch (error: any) {
    context.log(`Chain broadcast error: ${error.message}`);
  }
}

export async function broadcastStallAlert(
  sessionId: string,
  chainIds: string[],
  context: InvocationContext
): Promise<void> {
  try {
    const signalRConnectionString = process.env.SIGNALR_CONNECTION_STRING;
    if (!signalRConnectionString || signalRConnectionString.includes('dummy')) {
      context.log('SignalR not configured, skipping stall alert broadcast');
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

    // Send stall alert to SignalR
    const signalRUrl = `${endpoint}/api/v1/hubs/${hubName}`;
    context.log(`Broadcasting stall alert to: ${signalRUrl}`);
    
    const response = await fetch(signalRUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        target: 'stallAlert',
        arguments: [chainIds]
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      context.log(`Stall alert broadcast failed: ${response.status} - ${errorText}`);
    } else {
      context.log('Stall alert broadcast successful');
    }
  } catch (error: any) {
    context.log(`Stall alert broadcast error: ${error.message}`);
  }
}
