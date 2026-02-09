/**
 * Scan Chain API Endpoint
 * Handles when a student scans another student's QR code to pass the chain
 */
import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { TableClient } from '@azure/data-tables';
import { randomUUID } from 'crypto';
import * as crypto from 'crypto';
import { broadcastAttendanceUpdate, broadcastChainUpdate } from '../utils/signalrBroadcast';
import { validateGeolocation } from '../utils/geolocation';

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
  const connectionString = process.env.AzureWebJobsStorage;
  if (!connectionString) {
    throw new Error('AzureWebJobsStorage not configured');
  }
  const isLocal = connectionString.includes("127.0.0.1") || connectionString.includes("localhost");
  return TableClient.fromConnectionString(connectionString, tableName, { allowInsecureConnection: isLocal });
}

export async function scanChain(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  context.log('Processing POST /api/sessions/{sessionId}/chains/{chainId}/scan request');

  try {
    // Parse authentication
    const principalHeader = request.headers.get('x-ms-client-principal');
    if (!principalHeader) {
      return {
        status: 401,
        jsonBody: { error: { code: 'UNAUTHORIZED', message: 'Missing authentication header', timestamp: Date.now() } }
      };
    }

    const principal = parseUserPrincipal(principalHeader);
    const studentEmail = principal.userDetails;
    
    // Require Student role
    if (!hasRole(principal, 'Student') && !hasRole(principal, 'student')) {
      return {
        status: 403,
        jsonBody: { error: { code: 'FORBIDDEN', message: 'Student role required', timestamp: Date.now() } }
      };
    }

    const sessionId = request.params.sessionId;
    const chainId = request.params.chainId;
    const body = await request.json() as any;
    const tokenId = body.tokenId;
    const challengeCode = body.challengeCode; // NEW: Challenge code entered by holder
    const scannerLocation = body.location || body.metadata?.gps; // Student's GPS location
    
    if (!sessionId || !chainId || !tokenId) {
      return {
        status: 400,
        jsonBody: { error: { code: 'INVALID_REQUEST', message: 'Missing sessionId, chainId, or tokenId', timestamp: Date.now() } }
      };
    }

    // NEW: Require challenge code
    if (!challengeCode) {
      return {
        status: 400,
        jsonBody: { error: { code: 'INVALID_REQUEST', message: 'Missing challengeCode. Holder must enter the challenge code shown to scanner.', timestamp: Date.now() } }
      };
    }

    const now = Date.now();
    const tokensTable = getTableClient('Tokens');
    const chainsTable = getTableClient('Chains');
    const attendanceTable = getTableClient('Attendance');
    const sessionsTable = getTableClient('Sessions');

    // Verify session exists and is active
    let session;
    try {
      session = await sessionsTable.getEntity('SESSION', sessionId);
      if (session.status !== 'ACTIVE') {
        return {
          status: 400,
          jsonBody: { error: { code: 'SESSION_ENDED', message: 'Session has ended', timestamp: now } }
        };
      }
    } catch (error: any) {
      if (error.statusCode === 404) {
        return {
          status: 404,
          jsonBody: { error: { code: 'NOT_FOUND', message: 'Session not found', timestamp: now } }
        };
      }
      throw error;
    }

    // Parse and validate geolocation
    let sessionLocation: { latitude: number; longitude: number } | undefined;
    if (session.location) {
      try {
        sessionLocation = typeof session.location === 'string' 
          ? JSON.parse(session.location as string)
          : session.location;
      } catch {
        // Invalid location format, ignore
      }
    }
    const geofenceRadius = session.geofenceRadius as number | undefined;
    const enforceGeofence = session.enforceGeofence as boolean | undefined;

    const geoCheck = validateGeolocation(
      sessionLocation,
      geofenceRadius,
      enforceGeofence,
      scannerLocation
    );

    const missingLocationWarning = !scannerLocation ? 'Location not provided' : undefined;
    if (missingLocationWarning) {
      context.warn(`Scan without location: student=${studentEmail}, session=${sessionId}, chain=${chainId}`);
    }
    const locationWarning = geoCheck.warning || missingLocationWarning;

    // Block scan if geofence is enforced and student is out of bounds
    if (geoCheck.shouldBlock) {
      return {
        status: 403,
        jsonBody: {
          error: {
            code: 'GEOFENCE_VIOLATION',
            message: geoCheck.warning || 'You are outside the allowed area for this class',
            details: geoCheck.distance ? `Distance: ${Math.round(geoCheck.distance)}m` : undefined,
            timestamp: now
          }
        }
      };
    }

    // Verify token exists and is valid
    let token;
    let chainData;
    try {
      token = await tokensTable.getEntity(sessionId, tokenId);
      chainData = await chainsTable.getEntity(sessionId, chainId);
      
      // Check if token has expired
      if (token.expiresAt && (token.expiresAt as number) < now) {
        return {
          status: 400,
          jsonBody: { error: { code: 'TOKEN_EXPIRED', message: 'Token has expired', timestamp: now } }
        };
      }
      
      // NEW: Validate challenge code
      if (!token.pendingChallenge || !token.challengeCode || !token.challengeExpiresAt) {
        return {
          status: 400,
          jsonBody: { 
            error: { 
              code: 'NO_PENDING_CHALLENGE', 
              message: 'No pending challenge. Scanner must request challenge first by scanning the QR code.', 
              timestamp: now 
            } 
          }
        };
      }
      
      // Check if challenge expired
      if ((token.challengeExpiresAt as number) < now) {
        return {
          status: 400,
          jsonBody: { 
            error: { 
              code: 'CHALLENGE_EXPIRED', 
              message: 'Challenge code has expired. Scanner must scan QR code again to get a new code.', 
              timestamp: now 
            } 
          }
        };
      }
      
      // Validate challenge code matches
      const enteredHash = crypto.createHash('sha256').update(challengeCode).digest('hex');
      if (enteredHash !== token.challengeCode) {
        context.warn(`Invalid challenge code entered for token ${tokenId}. Expected hash: ${token.challengeCode}, got: ${enteredHash}`);
        return {
          status: 403,
          jsonBody: { 
            error: { 
              code: 'INVALID_CHALLENGE', 
              message: 'Invalid challenge code. Please check the code and try again.', 
              timestamp: now 
            } 
          }
        };
      }
      
      // Verify the current user (holder) is the one who should validate
      // The holder is the one entering the code, not the scanner
      const scannerId = token.pendingChallenge as string;
      const holderId = token.holderId as string;
      
      if (studentEmail !== holderId) {
        return {
          status: 403,
          jsonBody: { 
            error: { 
              code: 'NOT_HOLDER', 
              message: 'Only the current holder can validate the challenge code.', 
              timestamp: now 
            } 
          }
        };
      }
      
      context.log(`Challenge validated: holder=${holderId}, scanner=${scannerId}, code verified`);
      
      // Verify token belongs to the correct chain
      if (token.chainId !== chainId) {
        return {
          status: 400,
          jsonBody: { error: { code: 'INVALID_TOKEN', message: 'Token does not belong to this chain', timestamp: now } }
        };
      }
    } catch (error: any) {
      if (error.statusCode === 404) {
        return {
          status: 404,
          jsonBody: { error: { code: 'TOKEN_NOT_FOUND', message: 'Token not found or already used', timestamp: now } }
        };
      }
      throw error;
    }

    // Get the previous holder and the scanner from challenge
    const previousHolder = token.holderId as string;
    const scannerId = token.pendingChallenge as string;
    
    // The holder (studentEmail) is validating the scanner's challenge
    // Scanner should become the new holder
    
    // Mark previous holder's attendance if not already marked
    try {
      const prevAttendance = await attendanceTable.getEntity(sessionId, previousHolder);
      
      if (!prevAttendance.entryStatus) {
        // Determine if late or present based on session start time
        const sessionStartTime = session.startTime as number;
        const lateCutoffMinutes = 15; // Default
        const lateCutoffTime = sessionStartTime + (lateCutoffMinutes * 60);
        
        const entryStatus = now > lateCutoffTime ? 'LATE_ENTRY' : 'PRESENT_ENTRY';
        
        const updateData: any = {
          partitionKey: sessionId,
          rowKey: previousHolder,
          entryStatus,
          entryAt: now
        };

        // Save scanner location if provided
        if (scannerLocation) {
          updateData.scanLocation = JSON.stringify(scannerLocation);
        }
        
        await attendanceTable.updateEntity(updateData, 'Merge');
        
        context.log(`Marked ${previousHolder} as ${entryStatus}`);
        
        // Broadcast attendance update for previous holder
        await broadcastAttendanceUpdate(sessionId, {
          studentId: previousHolder,
          entryStatus: entryStatus,
        }, context);
      }
    } catch (error: any) {
      context.log(`Warning: Could not update attendance for previous holder: ${error.message}`);
    }

    // Record location warning for the scanner
    if (locationWarning || scannerLocation) {
      try {
        const scannerUpdate: any = {
          partitionKey: sessionId,
          rowKey: scannerId  // Update scanner, not holder
        };
        if (scannerLocation) {
          scannerUpdate.scanLocation = JSON.stringify(scannerLocation);
        }
        if (locationWarning) {
          scannerUpdate.locationWarning = locationWarning;
          scannerUpdate.locationDistance = geoCheck.distance;
        }
        await attendanceTable.updateEntity(scannerUpdate, 'Merge');

        if (locationWarning) {
          await broadcastAttendanceUpdate(sessionId, {
            studentId: scannerId,
            locationWarning
          }, context);
        }
      } catch (error: any) {
        context.log(`Warning: Could not update attendance for scanner: ${error.message}`);
      }
    }

    // Delete the old token
    await tokensTable.deleteEntity(sessionId, tokenId);

    // Create new token for scanner (who becomes new holder)
    const newTokenId = randomUUID();
    const newSeq = (token.seq as number) + 1;
    const tokenTTL = parseInt(process.env.CHAIN_TOKEN_TTL_SECONDS || '20');
    const newExpiresAt = now + (tokenTTL * 1000);

    const newTokenEntity = {
      partitionKey: sessionId,
      rowKey: newTokenId,
      chainId,
      holderId: scannerId,  // Scanner becomes new holder
      seq: newSeq,
      expiresAt: newExpiresAt,
      createdAt: now
      // No challenge data yet - will be set when next scanner requests challenge
    };
    await tokensTable.createEntity(newTokenEntity);

    // Update chain
    await chainsTable.updateEntity({
      partitionKey: sessionId,
      rowKey: chainId,
      lastHolder: scannerId,  // Scanner is new holder
      lastSeq: newSeq,
      lastAt: now
    }, 'Merge');

    context.log(`Chain ${chainId} passed from ${previousHolder} to ${scannerId}, seq ${newSeq}`);

    // Broadcast chain update
    await broadcastChainUpdate(sessionId, {
      chainId,
      phase: chainData.phase,
      lastHolder: scannerId,  // Scanner is new holder
      lastSeq: newSeq,
      state: chainData.state
    }, context);

    return {
      status: 200,
      jsonBody: {
        success: true,
        newHolder: scannerId,  // Scanner is new holder
        seq: newSeq,
        previousHolder,
        token: newTokenId,
        expiresAt: newExpiresAt,
        locationWarning
      }
    };

  } catch (error: any) {
    context.error('Error scanning chain:', error);
    
    return {
      status: 500,
      jsonBody: {
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to scan chain',
          details: error.message,
          timestamp: Date.now()
        }
      }
    };
  }
}

app.http('scanChain', {
  methods: ['POST'],
  route: 'sessions/{sessionId}/chains/{chainId}/scan',
  authLevel: 'anonymous',
  handler: scanChain
});
