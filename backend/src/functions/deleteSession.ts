/**
 * Delete Session API Endpoint - With Cascade Delete & Logging
 * Deletes a session and all related records (attendance, chains, tokens, scan logs)
 * Logs all deletions to DeletionLog table
 */

import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { TableClient } from '@azure/data-tables';

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
  return principal.userDetails || principal.userId;
}

// Assign roles based on email domain
function getRolesFromEmail(email: string): string[] {
  const roles: string[] = ['authenticated'];
  if (!email) return roles;
  
  const emailLower = email.toLowerCase();
  
  // Students: @stu.vtc.edu.hk
  if (emailLower.endsWith('@stu.vtc.edu.hk')) {
    roles.push('student');
  }
  // Teachers: @vtc.edu.hk (but not @stu.vtc.edu.hk)
  else if (emailLower.endsWith('@vtc.edu.hk')) {
    roles.push('teacher');
  }
  
  return roles;
}

function getTableClient(tableName: string): TableClient {
  const connectionString = process.env.AzureWebJobsStorage;
  if (!connectionString) {
    throw new Error('AzureWebJobsStorage is not configured');
  }
  return TableClient.fromConnectionString(connectionString, tableName);
}

interface DeletionSummary {
  deletedAttendance: number;
  deletedChains: number;
  deletedTokens: number;
  deletedScanLogs: number;
  deletedSession: boolean;
}

export async function deleteSession(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  context.log('Processing DELETE /api/sessions/{sessionId} request');

  try {
    // Extract session ID from URL
    const sessionId = request.params.sessionId;
    if (!sessionId) {
      return {
        status: 400,
        jsonBody: { error: { code: 'INVALID_REQUEST', message: 'Session ID is required', timestamp: Date.now() } }
      };
    }

    // Extract delete scope for recurring sessions (default: 'this')
    const deleteScope = request.query.get('scope') || 'this';
    if (!['this', 'future', 'all'].includes(deleteScope)) {
      return {
        status: 400,
        jsonBody: { error: { code: 'INVALID_REQUEST', message: 'Invalid delete scope. Must be: this, future, or all', timestamp: Date.now() } }
      };
    }

    // Extract and validate authentication
    const principalHeader = request.headers.get('x-ms-client-principal');
    if (!principalHeader) {
      return {
        status: 401,
        jsonBody: { error: { code: 'UNAUTHORIZED', message: 'Not authenticated', timestamp: Date.now() } }
      };
    }

    const principal = parseUserPrincipal(principalHeader);
    const userId = getUserId(principal);
    
    // Extract email to determine role (userDetails contains the email)
    const teacherEmail = principal.userDetails || '';
    const roles = getRolesFromEmail(teacherEmail);

    // Verify teacher role
    if (!roles.includes('teacher')) {
      return {
        status: 403,
        jsonBody: { error: { code: 'FORBIDDEN', message: 'Only teachers can delete sessions', timestamp: Date.now() } }
      };
    }

    const sessionsTable = getTableClient('Sessions');
    
    // Verify session exists and belongs to this teacher
    let session: any;
    try {
      const entity = await sessionsTable.getEntity('SESSION', sessionId);
      session = entity as any;
      
      // Check if teacher owns this session
      if (session.teacherId !== userId) {
        return {
          status: 403,
          jsonBody: { error: { code: 'FORBIDDEN', message: 'You can only delete your own sessions', timestamp: Date.now() } }
        };
      }
    } catch (error: any) {
      if (error.statusCode === 404) {
        return {
          status: 404,
          jsonBody: { error: { code: 'NOT_FOUND', message: 'Session not found', timestamp: Date.now() } }
        };
      }
      throw error;
    }

    // Determine which sessions to delete
    let sessionIdsToDelete: string[] = [sessionId];
    let isRecurringSession = !!session.parentSessionId || (session.isRecurring && deleteScope !== 'this');

    if (isRecurringSession) {
      const parentId = session.parentSessionId || sessionId;
      const currentOccurrence = session.occurrenceNumber || 1;

      context.log(`Recurring session detected. Parent: ${parentId}, Current: ${currentOccurrence}, Scope: ${deleteScope}`);

      // Fetch all sessions with same parent
      try {
        const allSessions: any[] = [];
        for await (const entity of sessionsTable.listEntities()) {
          const s = entity as any;
          if (s.parentSessionId === parentId) {
            allSessions.push(s);
          }
        }

        if (deleteScope === 'future') {
          // Delete current and all future sessions
          sessionIdsToDelete = allSessions
            .filter((s: any) => (s.occurrenceNumber || 1) >= currentOccurrence)
            .map((s: any) => s.rowKey);
          context.log(`Future scope: deleting ${sessionIdsToDelete.length} sessions from occurrence ${currentOccurrence} onwards`);
        } else if (deleteScope === 'all') {
          // Delete all sessions in recurring group
          sessionIdsToDelete = allSessions.map((s: any) => s.rowKey);
          context.log(`All scope: deleting all ${sessionIdsToDelete.length} sessions in recurring group`);
        }
      } catch (error: any) {
        context.warn(`Error fetching recurring sessions: ${error.message}`);
      }
    }

    const totalSessions = sessionIdsToDelete.length;
    const deletionSummary: DeletionSummary = {
      deletedAttendance: 0,
      deletedChains: 0,
      deletedTokens: 0,
      deletedScanLogs: 0,
      deletedSession: false
    };

    // Delete all sessions in the scope
    for (const sid of sessionIdsToDelete) {
      // 1. Delete Attendance records
      try {
        const attendanceTable = getTableClient('Attendance');
        for await (const entity of attendanceTable.listEntities({ 
          queryOptions: { filter: `PartitionKey eq '${sid}'` } 
        })) {
          await attendanceTable.deleteEntity(entity.partitionKey, entity.rowKey);
          deletionSummary.deletedAttendance++;
        }
      } catch (error: any) {
        context.warn(`Error deleting attendance for session ${sid}: ${error.message}`);
      }

      // 2. Delete Chains
      try {
        const chainsTable = getTableClient('Chains');
        for await (const entity of chainsTable.listEntities({ 
          queryOptions: { filter: `PartitionKey eq '${sid}'` } 
        })) {
          await chainsTable.deleteEntity(entity.partitionKey, entity.rowKey);
          deletionSummary.deletedChains++;
        }
      } catch (error: any) {
        context.warn(`Error deleting chains for session ${sid}: ${error.message}`);
      }

      // 3. Delete Tokens
      try {
        const tokensTable = getTableClient('Tokens');
        for await (const entity of tokensTable.listEntities({ 
          queryOptions: { filter: `PartitionKey eq '${sid}'` } 
        })) {
          await tokensTable.deleteEntity(entity.partitionKey, entity.rowKey);
          deletionSummary.deletedTokens++;
        }
      } catch (error: any) {
        context.warn(`Error deleting tokens for session ${sid}: ${error.message}`);
      }

      // 4. Delete ScanLogs
      try {
        const scanLogsTable = getTableClient('ScanLogs');
        for await (const entity of scanLogsTable.listEntities({ 
          queryOptions: { filter: `PartitionKey eq '${sid}'` } 
        })) {
          await scanLogsTable.deleteEntity(entity.partitionKey, entity.rowKey);
          deletionSummary.deletedScanLogs++;
        }
      } catch (error: any) {
        context.warn(`Error deleting scan logs for session ${sid}: ${error.message}`);
      }

      // 5. Delete the Session itself
      try {
        await sessionsTable.deleteEntity('SESSION', sid);
        context.log(`Deleted session: ${sid}`);
      } catch (error: any) {
        context.error(`Error deleting session ${sid}: ${error.message}`);
        throw error;
      }
    }

    deletionSummary.deletedSession = sessionIdsToDelete.length > 0;

    // 6. Log the deletion
    try {
      const deletionLogTable = getTableClient('DeletionLog');
      const logEntry = {
        partitionKey: new Date().toISOString().split('T')[0],  // Date partition
        rowKey: `${sessionId}_${Date.now()}`,  // Unique row
        sessionId,
        teacherId: userId,
        sessionName: session.classId,
        deletedAt: new Date().toISOString(),
        deletedSessionCount: totalSessions,
        deleteScope: isRecurringSession ? deleteScope : undefined,
        deletedAttendance: deletionSummary.deletedAttendance,
        deletedChains: deletionSummary.deletedChains,
        deletedTokens: deletionSummary.deletedTokens,
        deletedScanLogs: deletionSummary.deletedScanLogs,
        totalRecordsDeleted: deletionSummary.deletedAttendance + deletionSummary.deletedChains + deletionSummary.deletedTokens + deletionSummary.deletedScanLogs + totalSessions
      };
      await deletionLogTable.createEntity(logEntry);
      context.log(`Logged deletion for session(s): ${sessionIdsToDelete.join(',')}`);
    } catch (error: any) {
      context.warn(`Error logging deletion: ${error.message}`);
      // Continue even if logging fails
    }

    return {
      status: 200,
      jsonBody: {
        success: true,
        message: `${totalSessions} session${totalSessions > 1 ? 's' : ''} deleted successfully`,
        details: {
          sessionId,
          sessionName: session.classId,
          sessionsDeleted: totalSessions,
          deleteScope: isRecurringSession ? deleteScope : undefined,
          isRecurring: isRecurringSession,
          deletionSummary
        }
      }
    };

  } catch (error: any) {
    context.error('Error deleting session:', error);
    
    return {
      status: 500,
      jsonBody: {
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to delete session',
          timestamp: Date.now()
        }
      }
    };
  }
}

app.http('deleteSession', {
  methods: ['DELETE'],
  route: 'sessions/{sessionId}',
  authLevel: 'anonymous',
  handler: deleteSession
});
