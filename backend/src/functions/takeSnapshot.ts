/**
 * Take Snapshot API Endpoint
 * Creates a snapshot of current attendance by starting new chains
 * Can be called anytime (not restricted by session phase)
 */

import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { TableClient } from '@azure/data-tables';
import { randomUUID } from 'crypto';
import { createSnapshot } from '../utils/snapshotService';

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

export async function takeSnapshot(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  context.log('Processing POST /api/sessions/{sessionId}/snapshot request');

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
    
    // Require Teacher role
    if (!hasRole(principal, 'Teacher')) {
      return {
        status: 403,
        jsonBody: { error: { code: 'FORBIDDEN', message: 'Teacher role required', timestamp: Date.now() } }
      };
    }

    const sessionId = request.params.sessionId;
    const snapshotType = (request.query.get('type') || 'ENTRY') as 'ENTRY' | 'EXIT';
    const count = parseInt(request.query.get('count') || '3', 10);
    
    if (!sessionId) {
      return {
        status: 400,
        jsonBody: { error: { code: 'INVALID_REQUEST', message: 'Missing sessionId', timestamp: Date.now() } }
      };
    }

    if (count < 1 || count > 20) {
      return {
        status: 400,
        jsonBody: { error: { code: 'INVALID_REQUEST', message: 'Count must be between 1 and 20', timestamp: Date.now() } }
      };
    }

    const now = Math.floor(Date.now() / 1000);

    // Get tables
    const sessionsTable = getTableClient('Sessions');
    const attendanceTable = getTableClient('Attendance');
    const chainsTable = getTableClient('Chains');
    const tokensTable = getTableClient('Tokens');
    const snapshotsTable = getTableClient('AttendanceSnapshots');

    // Verify session exists
    let session;
    try {
      session = await sessionsTable.getEntity('SESSION', sessionId);
    } catch (error: any) {
      if (error.statusCode === 404) {
        return {
          status: 404,
          jsonBody: { error: { code: 'SESSION_NOT_FOUND', message: 'Session not found', timestamp: now } }
        };
      }
      throw error;
    }

    // Get all enrolled students
    const enrolledStudents: string[] = [];
    try {
      for await (const entity of attendanceTable.listEntities({
        queryOptions: {
          filter: `PartitionKey eq '${sessionId}'`
        }
      })) {
        enrolledStudents.push(entity.rowKey as string);
      }
    } catch (error) {
      context.warn(`Warning: Could not fetch enrolled students: ${error}`);
    }

    if (enrolledStudents.length === 0) {
      return {
        status: 400,
        jsonBody: { error: { code: 'NO_STUDENTS', message: 'No students enrolled in session', timestamp: now } }
      };
    }

    // Get existing snapshot count to determine snapshotIndex
    let snapshotIndex = 1;
    try {
      let snapshotCount = 0;
      for await (const entity of snapshotsTable.listEntities({
        queryOptions: {
          filter: `PartitionKey eq '${sessionId}'`
        }
      })) {
        snapshotCount++;
      }
      snapshotIndex = snapshotCount + 1;
    } catch (error) {
      context.warn(`Warning: Could not determine snapshot index: ${error}`);
    }

    // Create snapshot record
    const snapshot = await createSnapshot(
      sessionId,
      snapshotType,
      snapshotIndex,
      count,
      enrolledStudents.length,
      snapshotsTable
    );

    // Select random students and create chains
    const actualCount = Math.min(count, enrolledStudents.length);
    const selectedStudents: string[] = [];
    
    // Fisher-Yates shuffle
    const shuffled = [...enrolledStudents];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    
    for (let i = 0; i < actualCount; i++) {
      selectedStudents.push(shuffled[i]);
    }

    // Create chains
    const tokenTTL = parseInt(process.env.CHAIN_TOKEN_TTL_SECONDS || '20');
    const expiresAt = now + (tokenTTL * 1000);
    const createdChains: any[] = [];

    for (let i = 0; i < actualCount; i++) {
      const chainId = randomUUID();
      const tokenId = randomUUID();
      const holderId = selectedStudents[i];

      // Create chain entity with snapshot reference
      const chainEntity = {
        partitionKey: sessionId,
        rowKey: chainId,
        phase: snapshotType,
        snapshotId: snapshot.rowKey,
        snapshotIndex,
        index: i,
        state: 'ACTIVE',
        lastHolder: holderId,
        lastSeq: 0,
        lastAt: now,
        createdAt: now
      };
      await chainsTable.createEntity(chainEntity);

      // Create initial token
      const tokenEntity = {
        partitionKey: sessionId,
        rowKey: tokenId,
        chainId,
        snapshotId: snapshot.rowKey,
        holderId,
        seq: 0,
        expiresAt,
        createdAt: now
      };
      await tokensTable.createEntity(tokenEntity);

      createdChains.push({
        chainId,
        tokenId,
        holder: holderId,
        seq: 0
      });
    }

    context.log(`Snapshot created: ${snapshot.rowKey}, type: ${snapshotType}, chains: ${actualCount}`);

    return {
      status: 200,
      jsonBody: {
        success: true,
        snapshotId: snapshot.rowKey,
        snapshotType,
        snapshotIndex,
        chainsCreated: actualCount,
        initialHolders: selectedStudents,
        expiresAt,
        createdChains
      }
    };
  } catch (error: any) {
    context.error('Error taking snapshot:', error);
    
    return {
      status: 500,
      jsonBody: {
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to take snapshot',
          details: error.message,
          timestamp: Date.now()
        }
      }
    };
  }
}

app.http('takeSnapshot', {
  methods: ['POST'],
  route: 'sessions/{sessionId}/snapshot',
  authLevel: 'anonymous',
  handler: takeSnapshot
});
