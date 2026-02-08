/**
 * Get Snapshot Chain Traces API Endpoint
 * Returns detailed chain transfer data for a snapshot
 */

import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { TableClient } from '@azure/data-tables';
import { getSnapshotChainTraces } from '../utils/snapshotService';

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

export async function getSnapshotTrace(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  context.log('Processing GET /api/sessions/{sessionId}/snapshots/{snapshotId}/chain-trace request');

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
    const snapshotId = request.params.snapshotId;

    if (!sessionId || !snapshotId) {
      return {
        status: 400,
        jsonBody: { error: { code: 'INVALID_REQUEST', message: 'Missing sessionId or snapshotId', timestamp: Date.now() } }
      };
    }

    // Get tables
    const snapshotsTable = getTableClient('AttendanceSnapshots');
    const chainsTable = getTableClient('Chains');
    const scanLogsTable = getTableClient('ScanLogs');

    // Verify snapshot exists
    try {
      await snapshotsTable.getEntity(sessionId, snapshotId);
    } catch (error: any) {
      if (error.statusCode === 404) {
        return {
          status: 404,
          jsonBody: { error: { code: 'SNAPSHOT_NOT_FOUND', message: 'Snapshot not found', timestamp: Date.now() } }
        };
      }
      throw error;
    }

    // Get chain traces
    const traces = await getSnapshotChainTraces(
      sessionId,
      snapshotId,
      chainsTable,
      scanLogsTable,
      context
    );

    return {
      status: 200,
      jsonBody: {
        success: true,
        snapshotId,
        chains: traces,
        totalChains: traces.length,
        totalTransfers: traces.reduce((sum, t) => sum + t.totalTransfers, 0),
        successfulTransfers: traces.reduce((sum, t) => sum + t.successfulTransfers, 0),
        failedTransfers: traces.reduce((sum, t) => sum + t.failedTransfers, 0)
      }
    };
  } catch (error: any) {
    context.error('Error getting snapshot trace:', error);
    
    return {
      status: 500,
      jsonBody: {
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to get snapshot trace',
          details: error.message,
          timestamp: Date.now()
        }
      }
    };
  }
}

app.http('getSnapshotTrace', {
  methods: ['GET'],
  route: 'sessions/{sessionId}/snapshots/{snapshotId}/chain-trace',
  authLevel: 'anonymous',
  handler: getSnapshotTrace
});
