/**
 * Join Session API Endpoint - REFACTORED (Self-contained)
 * No external service dependencies
 */

import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { TableClient } from '@azure/data-tables';
import * as crypto from 'crypto';
import { validateGeolocation } from '../utils/geolocation';

// Inline helper functions
function parseUserPrincipal(header: string): any {
  try {
    const decoded = Buffer.from(header, 'base64').toString('utf-8');
    return JSON.parse(decoded);
  } catch {
    throw new Error('Invalid authentication header');
  }
}

function getUserId(principal: any): string {
  // Use email (userDetails) as the student ID for better readability
  return principal.userDetails || principal.userId;
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

function decryptToken(encryptedToken: string): any {
  try {
    const secret = process.env.QR_ENCRYPTION_KEY || 'default-secret-key-change-in-production';
    const algorithm = 'aes-256-cbc';
    const key = crypto.scryptSync(secret, 'salt', 32);
    
    const parts = encryptedToken.split(':');
    if (parts.length !== 2) {
      throw new Error('Invalid token format');
    }
    
    const iv = Buffer.from(parts[0], 'hex');
    const encrypted = parts[1];
    
    const decipher = crypto.createDecipheriv(algorithm, key, iv);
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return JSON.parse(decrypted);
  } catch (error) {
    throw new Error('Failed to decrypt token');
  }
}

export async function joinSession(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  context.log('Processing POST /api/sessions/{sessionId}/join request');

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
    
    // Require Student role
    if (!hasRole(principal, 'Student') && !hasRole(principal, 'student')) {
      return {
        status: 403,
        jsonBody: { error: { code: 'FORBIDDEN', message: 'Student role required', timestamp: Date.now() } }
      };
    }

    const studentId = getUserId(principal);
    const sessionId = request.params.sessionId;
    
    if (!sessionId) {
      return {
        status: 400,
        jsonBody: { error: { code: 'INVALID_REQUEST', message: 'Missing sessionId', timestamp: Date.now() } }
      };
    }

    // Parse request body for token validation and location
    let token: string | undefined;
    let studentLocation: { latitude: number; longitude: number; accuracy?: number } | undefined;
    try {
      const body = await request.json() as any;
      token = body?.token;
      studentLocation = body?.location;
    } catch {
      // No body or invalid JSON - token is optional for backward compatibility
    }

    // If token is provided, decrypt and validate it
    if (token) {
      try {
        const tokenData = decryptToken(token);
        
        // Verify token type
        if (tokenData.type !== 'ENTRY') {
          return {
            status: 403,
            jsonBody: { error: { code: 'INVALID_TOKEN_TYPE', message: 'Token is not an entry token', timestamp: Date.now() } }
          };
        }
        
        // Verify session ID matches
        if (tokenData.sessionId !== sessionId) {
          return {
            status: 403,
            jsonBody: { error: { code: 'SESSION_MISMATCH', message: 'Token session does not match', timestamp: Date.now() } }
          };
        }
        
        // Check if token is expired (20 seconds validity)
        const now = Math.floor(Date.now() / 1000);
        if (tokenData.expiresAt < now) {
          return {
            status: 403,
            jsonBody: { error: { code: 'TOKEN_EXPIRED', message: 'Entry token has expired', timestamp: Date.now() } }
          };
        }
      } catch (error: any) {
        return {
          status: 403,
          jsonBody: { error: { code: 'INVALID_TOKEN', message: 'Invalid or corrupted entry token', timestamp: Date.now() } }
        };
      }
    }

    // Verify session exists and get geolocation settings
    const sessionsTable = getTableClient('Sessions');
    let session;
    try {
      session = await sessionsTable.getEntity('SESSION', sessionId);
    } catch (error: any) {
      if (error.statusCode === 404) {
        return {
          status: 404,
          jsonBody: { error: { code: 'NOT_FOUND', message: 'Session not found', timestamp: Date.now() } }
        };
      }
      throw error;
    }

    // Parse geolocation settings
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

    // Validate geolocation
    const geoCheck = validateGeolocation(
      sessionLocation,
      geofenceRadius,
      enforceGeofence,
      studentLocation
    );

    const missingLocationWarning = !studentLocation ? 'Location not provided' : undefined;
    if (missingLocationWarning) {
      context.warn(`Join without location: student=${studentId}, session=${sessionId}`);
    }

    const locationWarning = geoCheck.warning || missingLocationWarning;

    // Block entry if geofence is enforced and student is out of bounds
    if (geoCheck.shouldBlock) {
      return {
        status: 403,
        jsonBody: {
          error: {
            code: 'GEOFENCE_VIOLATION',
            message: geoCheck.warning || 'You are outside the allowed area for this class',
            details: geoCheck.distance ? `Distance: ${Math.round(geoCheck.distance)}m` : undefined,
            timestamp: Date.now()
          }
        }
      };
    }

    // Create or check attendance record
    const attendanceTable = getTableClient('Attendance');
    
    try {
      // Check if already enrolled
      await attendanceTable.getEntity(sessionId, studentId);
      
      if (locationWarning) {
        await attendanceTable.updateEntity({
          partitionKey: sessionId,
          rowKey: studentId,
          locationWarning,
          locationDistance: geoCheck.distance
        }, 'Merge');
      }

      return {
        status: 200,
        jsonBody: {
          success: true,
          sessionId,
          studentId,
          message: 'Already enrolled in session',
          locationWarning
        }
      };
    } catch (error: any) {
      if (error.statusCode === 404) {
        // Create new enrollment with join timestamp and location data
        const entity: any = {
          partitionKey: sessionId,
          rowKey: studentId,
          exitVerified: false,
          joinedAt: Math.floor(Date.now() / 1000) // Unix timestamp in seconds
        };

        // Save location data if provided
        if (studentLocation) {
          entity.joinLocation = JSON.stringify(studentLocation);
        }

        // Add warning flag if out of geofence (but not blocked)
        if (locationWarning) {
          entity.locationWarning = locationWarning;
          entity.locationDistance = geoCheck.distance;
        }
        
        await attendanceTable.createEntity(entity);
        
        return {
          status: 201,
          jsonBody: {
            success: true,
            sessionId,
            studentId,
            message: 'Successfully enrolled in session',
            locationWarning
          }
        };
      }
      throw error;
    }

  } catch (error: any) {
    context.error('Error joining session:', error);
    
    return {
      status: 500,
      jsonBody: {
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to join session',
          details: error.message,
          timestamp: Date.now()
        }
      }
    };
  }
}

app.http('joinSession', {
  methods: ['POST'],
  route: 'sessions/{sessionId}/join',
  authLevel: 'anonymous',
  handler: joinSession
});
