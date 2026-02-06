/**
 * Get Teacher Sessions API Endpoint
 * Returns all sessions created by a specific teacher
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

// Inline helper functions
function parseUserPrincipal(header: string): any {
  try {
    const decoded = Buffer.from(header, 'base64').toString('utf-8');
    return JSON.parse(decoded);
  } catch {
    throw new Error('Invalid authentication header');
  }
}

// Assign roles based on email domain
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

// Inline table client creation - ISOLATED from any request context
function getTableClient(tableName: string): TableClient {
  const connectionString = process.env.AzureWebJobsStorage;
  if (!connectionString) {
    throw new Error('AzureWebJobsStorage not configured');
  }
  
  // Validate it's a proper connection string
  if (!connectionString.includes('AccountName=') || !connectionString.includes('AccountKey=')) {
    throw new Error('Invalid connection string format');
  }
  
  // Check if it's a local development connection string
  const isLocal = connectionString.includes("127.0.0.1") || 
                  connectionString.includes("localhost") || 
                  connectionString.includes("UseDevelopmentStorage=true");
  
  // Create table client with ONLY connection string authentication
  // Do NOT use any default credentials or managed identity
  const client = TableClient.fromConnectionString(
    connectionString, 
    tableName, 
    { 
      allowInsecureConnection: isLocal
    }
  );
  
  return client;
}

export async function getTeacherSessions(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  context.log('Processing GET /api/sessions/teacher/{teacherId} request');
  context.log('Request URL:', request.url);
  context.log('Request params:', JSON.stringify(request.params));

  try {
    // Parse authentication
    const principalHeader = request.headers.get('x-ms-client-principal');
    if (!principalHeader) {
      context.log('Missing x-ms-client-principal header');
      return {
        status: 401,
        jsonBody: { error: { code: 'UNAUTHORIZED', message: 'Missing authentication header', timestamp: Date.now() } }
      };
    }

    const principal = parseUserPrincipal(principalHeader);
    const userId = getUserId(principal);
    const isTeacher = hasRole(principal, 'teacher') || hasRole(principal, 'Teacher');
    
    context.log('User ID:', userId);
    context.log('Is teacher:', isTeacher);
    context.log('User roles:', principal.userRoles);

    // Check if user is a teacher
    if (!isTeacher) {
      return {
        status: 403,
        jsonBody: { error: { code: 'FORBIDDEN', message: 'Only teachers can access this endpoint', timestamp: Date.now() } }
      };
    }

    // Get teacherId from query parameter instead of route
    const teacherId = request.query.get('teacherId');
    context.log('TeacherId from query:', teacherId);
    
    if (!teacherId) {
      context.log('ERROR: Missing teacherId query parameter');
      return {
        status: 400,
        jsonBody: { error: { code: 'INVALID_REQUEST', message: 'Missing teacherId query parameter', timestamp: Date.now() } }
      };
    }

    // Verify the teacher is requesting their own sessions
    if (teacherId !== userId) {
      return {
        status: 403,
        jsonBody: { error: { code: 'FORBIDDEN', message: 'You can only access your own sessions', timestamp: Date.now() } }
      };
    }

    // Get sessions from storage
    const sessions: Session[] = [];
    
    context.log('Querying sessions table for teacherId:', teacherId);
    
    try {
      const sessionsTable = getTableClient('Sessions');
      context.log('Table client created successfully');
      
      // Query all sessions and filter by teacherId
      let entityCount = 0;
      for await (const entity of sessionsTable.listEntities({ 
        queryOptions: { filter: `PartitionKey eq 'SESSION'` } 
      })) {
        entityCount++;
        const session = entity as unknown as Session;
        if (session.teacherId === teacherId) {
          sessions.push(session);
        }
      }
      
      context.log('Total entities scanned:', entityCount);
      context.log('Found sessions for teacher:', sessions.length);
    } catch (storageError: any) {
      context.error('Storage query error:', storageError);
      context.error('Error name:', storageError.name);
      context.error('Error code:', storageError.code);
      context.error('Error message:', storageError.message);
      
      // Return empty sessions instead of error (graceful degradation)
      context.log('Returning empty sessions due to storage error');
    }

    // Sort by start time (most recent first)
    sessions.sort((a, b) => (b.startTime || 0) - (a.startTime || 0));

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
    const response = {
      sessions: sessions.map(s => ({
        sessionId: s.rowKey,
        classId: s.courseName,
        teacherId: s.teacherId,
        status: s.status,
        startAt: toISOString(s.startTime) || new Date().toISOString(),
        endAt: toISOString(s.endTime)
      }))
    };

    return {
      status: 200,
      jsonBody: response
    };

  } catch (error: any) {
    context.error('Error getting teacher sessions:', error);
    
    return {
      status: 500,
      jsonBody: {
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to get teacher sessions',
          details: error.message,
          timestamp: Date.now()
        }
      }
    };
  }
}

app.http('getTeacherSessions', {
  methods: ['GET'],
  route: 'teacher/sessions',
  authLevel: 'anonymous',
  handler: getTeacherSessions
});
