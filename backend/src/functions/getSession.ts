/**
 * Get Session API Endpoint - REFACTORED (Self-contained)
 * No external service dependencies
 */

import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { TableClient } from '@azure/data-tables';

// Inline types
interface Session {
  partitionKey: string;
  rowKey: string;
  teacherId: string;
  courseName: string;
  status: 'ACTIVE' | 'ENDED';
  startTime: number;
  endTime?: number;
  timestamp?: Date;
  etag?: string;
}

interface AttendanceRecord {
  partitionKey: string;
  rowKey: string;
  studentId: string;
  entryStatus: string;
  entryTime?: number;
  exitVerified?: boolean;
  exitTime?: number;
}

interface Chain {
  partitionKey: string;
  rowKey: string;
  phase: string;
  currentToken: string;
}

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
  // Use email (userDetails) as the ID for better readability
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

// Inline table client creation
function getTableClient(tableName: string): TableClient {
  const connectionString = process.env.AzureWebJobsStorage;
  if (!connectionString) {
    throw new Error('AzureWebJobsStorage not configured');
  }
  const isLocal = connectionString.includes("127.0.0.1") || connectionString.includes("localhost");
  return TableClient.fromConnectionString(connectionString, tableName, { allowInsecureConnection: isLocal });
}

export async function getSession(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  context.log('Processing GET /api/sessions/{sessionId} request');

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
    const userId = getUserId(principal);
    const isTeacher = hasRole(principal, 'Teacher');

    // Get sessionId
    const sessionId = request.params.sessionId;
    if (!sessionId) {
      return {
        status: 400,
        jsonBody: { error: { code: 'INVALID_REQUEST', message: 'Missing sessionId', timestamp: Date.now() } }
      };
    }

    // Get session from storage
    const sessionsTable = getTableClient('Sessions');
    let session: Session;
    
    try {
      const entity = await sessionsTable.getEntity('SESSION', sessionId);
      session = entity as unknown as Session;
    } catch (error: any) {
      if (error.statusCode === 404) {
        return {
          status: 404,
          jsonBody: { error: { code: 'NOT_FOUND', message: 'Session not found', timestamp: Date.now() } }
        };
      }
      throw error;
    }

    // Check ownership for teachers
    if (isTeacher && session.teacherId !== userId) {
      return {
        status: 403,
        jsonBody: { error: { code: 'FORBIDDEN', message: 'You do not own this session', timestamp: Date.now() } }
      };
    }

    // Get attendance records
    const attendanceTable = getTableClient('Attendance');
    const attendance: AttendanceRecord[] = [];
    const now = Date.now();
    const onlineThreshold = 30000; // Consider online if seen in last 30 seconds
    
    for await (const entity of attendanceTable.listEntities({ queryOptions: { filter: `PartitionKey eq '${sessionId}'` } })) {
      const record = entity as any;
      
      // Check if student is online based on lastSeen timestamp only
      const lastSeen = record.lastSeen ? (record.lastSeen as number) : 0;
      const isRecentlyActive = lastSeen > 0 && (now - lastSeen) < onlineThreshold;
      
      attendance.push({
        ...record,
        isOnline: isRecentlyActive, // Only use timestamp, ignore the isOnline flag
        // Use joinedAt if available, otherwise fall back to Timestamp (for existing records)
        joinedAt: record.joinedAt || (record.timestamp ? Math.floor(new Date(record.timestamp).getTime() / 1000) : undefined)
      } as unknown as AttendanceRecord);
    }

    // Get chains
    const chainsTable = getTableClient('Chains');
    const chains: Chain[] = [];
    
    for await (const entity of chainsTable.listEntities({ queryOptions: { filter: `PartitionKey eq '${sessionId}'` } })) {
      chains.push(entity as unknown as Chain);
    }

    // Get active tokens to identify current holders
    const tokensTable = getTableClient('Tokens');
    const activeHolders = new Set<string>();
    
    for await (const token of tokensTable.listEntities({ queryOptions: { filter: `PartitionKey eq '${sessionId}'` } })) {
      // Check if token is still valid
      if (token.expiresAt && (token.expiresAt as number) > now) {
        activeHolders.add(token.holderId as string);
      }
    }

    // Calculate stats
    const stats = {
      totalStudents: attendance.length,
      onlineStudents: attendance.filter(a => (a as any).isOnline).length,
      presentEntry: attendance.filter(a => a.entryStatus === 'PRESENT_ENTRY').length,
      lateEntry: attendance.filter(a => a.entryStatus === 'LATE_ENTRY').length,
      earlyLeave: attendance.filter(a => a.exitTime && a.exitTime < (session.endTime || 0)).length,
      exitVerified: attendance.filter(a => a.exitVerified).length,
      notYetVerified: attendance.filter(a => !a.exitVerified).length,
      activeHolders: activeHolders.size
    };

    // Helper to safely convert timestamp to ISO string
    const toISOString = (timestamp: number | undefined): string | undefined => {
      if (!timestamp || isNaN(timestamp)) return undefined;
      try {
        return new Date(timestamp * 1000).toISOString();
      } catch {
        return undefined;
      }
    };

    // Build response
    const response: any = {
      session: {
        sessionId: session.rowKey,
        classId: session.courseName,
        teacherId: session.teacherId,
        startAt: toISOString(session.startTime) || new Date().toISOString(),
        endAt: toISOString(session.endTime),
        lateCutoffMinutes: 15, // Default value
        exitWindowMinutes: 30, // Default value
        status: session.status,
        ownerTransfer: false,
        lateEntryActive: false,
        earlyLeaveActive: false,
        createdAt: toISOString(session.startTime) || new Date().toISOString()
      },
      attendance: attendance.map(a => ({
        sessionId,
        studentId: a.studentId || a.rowKey, // Use rowKey (email) as fallback
        entryStatus: a.entryStatus,
        entryAt: a.entryTime,
        exitVerified: a.exitVerified || false,
        exitVerifiedAt: a.exitTime,
        joinedAt: (a as any).joinedAt, // Include join timestamp
        isOnline: (a as any).isOnline || false,
        isHolder: activeHolders.has(a.studentId || a.rowKey) // Check if student is a current holder
      })),
      chains: chains.map(c => ({
        sessionId,
        phase: c.phase,
        chainId: c.rowKey,
        index: 0,
        state: 'ACTIVE',
        lastHolder: undefined,
        lastSeq: 0,
        lastAt: undefined
      })),
      stats
    };

    return {
      status: 200,
      jsonBody: response
    };

  } catch (error: any) {
    context.error('Error getting session:', error);
    
    return {
      status: 500,
      jsonBody: {
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to get session',
          details: error.message,
          timestamp: Date.now()
        }
      }
    };
  }
}

app.http('getSession', {
  methods: ['GET'],
  route: 'sessions/{sessionId}',
  authLevel: 'anonymous',
  handler: getSession
});
