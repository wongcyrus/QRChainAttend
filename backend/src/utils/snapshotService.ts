/**
 * Snapshot Service
 * Handles snapshot creation, storage, and chain trace retrieval
 */

import { TableClient } from '@azure/data-tables';
import { randomUUID } from 'crypto';
import { InvocationContext } from '@azure/functions';

export interface SnapshotEntity {
  partitionKey: string;      // sessionId
  rowKey: string;            // snapshotId
  snapshotType: 'ENTRY' | 'EXIT';
  snapshotIndex: number;
  capturedAt: number;
  chainsCreated: number;
  studentsCaptured: number;
  notes?: string;
  createdAt: number;
}

export interface ChainTransfer {
  seq: number;
  holder: string;
  timestamp: number;
  nextHolder?: string;
  success: boolean;
  error?: string;
}

export interface ChainTraceData {
  chainId: string;
  phase: 'ENTRY' | 'EXIT';
  snapshotId: string;
  createdAt: number;
  transfers: ChainTransfer[];
  totalTransfers: number;
  successfulTransfers: number;
  failedTransfers: number;
  lastUpdate: number;
  state: 'ACTIVE' | 'STALLED' | 'COMPLETED';
}

export interface SnapshotComparison {
  snapshot1: {
    snapshotId: string;
    capturedAt: number;
    totalScans: number;
    studentsAppeared: string[];
  };
  snapshot2: {
    snapshotId: string;
    capturedAt: number;
    totalScans: number;
    studentsAppeared: string[];
  };
  differences: {
    newStudents: string[];
    absentStudents: string[];
    duplicateScans: string[];
    timeDifference: number; // seconds
  };
}

/**
 * Create a new snapshot
 */
export async function createSnapshot(
  sessionId: string,
  snapshotType: 'ENTRY' | 'EXIT',
  snapshotIndex: number,
  chainsCreated: number,
  studentsCaptured: number,
  snapshotsTable: TableClient,
  notes?: string
): Promise<SnapshotEntity> {
  const snapshotId = randomUUID();
  const now = Math.floor(Date.now() / 1000);

  const snapshot: SnapshotEntity = {
    partitionKey: sessionId,
    rowKey: snapshotId,
    snapshotType,
    snapshotIndex,
    capturedAt: now,
    chainsCreated,
    studentsCaptured,
    notes,
    createdAt: now
  };

  await snapshotsTable.createEntity(snapshot);
  return snapshot;
}

/**
 * Get all snapshots for a session
 */
export async function getSessionSnapshots(
  sessionId: string,
  snapshotsTable: TableClient
): Promise<SnapshotEntity[]> {
  const snapshots: SnapshotEntity[] = [];

  for await (const entity of snapshotsTable.listEntities({
    queryOptions: {
      filter: `PartitionKey eq '${sessionId}'`
    }
  })) {
     snapshots.push(entity as any as SnapshotEntity);
  }

  // Sort by capturedAt descending
  return snapshots.sort((a, b) => b.capturedAt - a.capturedAt);
}

/**
 * Build chain trace from ScanLogs
 */
export async function buildChainTrace(
  sessionId: string,
  chainId: string,
  snapshotId: string,
  scanLogsTable: TableClient,
  context: InvocationContext
): Promise<ChainTraceData> {
  const transfers: ChainTransfer[] = [];
  let totalTransfers = 0;
  let successfulTransfers = 0;
  let failedTransfers = 0;
  let lastUpdate = 0;

  try {
    // Query ScanLogs for this chain and snapshot
    for await (const entity of scanLogsTable.listEntities({
      queryOptions: {
        filter: `PartitionKey eq '${sessionId}' and snapshotId eq '${snapshotId}' and chainId eq '${chainId}'`
      }
    })) {
      const scanLog = entity as any;
      totalTransfers++;

      const transfer: ChainTransfer = {
        seq: scanLog.seq || 0,
        holder: scanLog.holderId || 'unknown',
        timestamp: scanLog.scannedAt || 0,
        nextHolder: scanLog.scannerId,
        success: scanLog.result === 'SUCCESS',
        error: scanLog.error
      };

      if (transfer.success) {
        successfulTransfers++;
      } else {
        failedTransfers++;
      }

      lastUpdate = Math.max(lastUpdate, transfer.timestamp);
      transfers.push(transfer);
    }

    // Sort by sequence and timestamp
    transfers.sort((a, b) => {
      if (a.seq !== b.seq) return a.seq - b.seq;
      return a.timestamp - b.timestamp;
    });
  } catch (error) {
    context.warn(`Error building chain trace for ${chainId}: ${error}`);
  }

  return {
    chainId,
    phase: chainId.includes('exit') ? 'EXIT' : 'ENTRY',
    snapshotId,
    createdAt: Math.floor(Date.now() / 1000),
    transfers,
    totalTransfers,
    successfulTransfers,
    failedTransfers,
    lastUpdate,
    state: failedTransfers === 0 && totalTransfers > 0 ? 'ACTIVE' : 'STALLED'
  };
}

/**
 * Get all chain traces for a snapshot
 */
export async function getSnapshotChainTraces(
  sessionId: string,
  snapshotId: string,
  chainsTable: TableClient,
  scanLogsTable: TableClient,
  context: InvocationContext
): Promise<ChainTraceData[]> {
  const traces: ChainTraceData[] = [];

  try {
    // Get all chains for this snapshot
    for await (const entity of chainsTable.listEntities({
      queryOptions: {
        filter: `PartitionKey eq '${sessionId}' and snapshotId eq '${snapshotId}'`
      }
    })) {
      const chain = entity as any;
      const trace = await buildChainTrace(
        sessionId,
        chain.rowKey,
        snapshotId,
        scanLogsTable,
        context
      );
      traces.push(trace);
    }
  } catch (error) {
    context.warn(`Error getting chain traces for snapshot ${snapshotId}: ${error}`);
  }

  return traces;
}

/**
 * Compare two snapshots
 */
export async function compareSnapshots(
  sessionId: string,
  snapshotId1: string,
  snapshotId2: string,
  scanLogsTable: TableClient,
  context: InvocationContext
): Promise<SnapshotComparison> {
  // Get students from first snapshot
  const students1 = new Set<string>();
  const scans1 = new Map<string, number>();

  try {
    for await (const entity of scanLogsTable.listEntities({
      queryOptions: {
        filter: `PartitionKey eq '${sessionId}' and snapshotId eq '${snapshotId1}'`
      }
    })) {
      const log = entity as any;
      const student = log.scannerId || log.holderId;
      students1.add(student);
      scans1.set(student, (scans1.get(student) || 0) + 1);
    }
  } catch (error) {
    context.warn(`Error reading snapshot 1: ${error}`);
  }

  // Get students from second snapshot
  const students2 = new Set<string>();
  const scans2 = new Map<string, number>();
  let capturedAt1 = 0;
  let capturedAt2 = 0;

  try {
    for await (const entity of scanLogsTable.listEntities({
      queryOptions: {
        filter: `PartitionKey eq '${sessionId}' and snapshotId eq '${snapshotId2}'`
      }
    })) {
      const log = entity as any;
      const student = log.scannerId || log.holderId;
      students2.add(student);
      scans2.set(student, (scans2.get(student) || 0) + 1);
      if (log.scannedAt > capturedAt2) {
        capturedAt2 = log.scannedAt;
      }
    }
  } catch (error) {
    context.warn(`Error reading snapshot 2: ${error}`);
  }

  // Find differences
  const newStudents = Array.from(students2).filter(s => !students1.has(s));
  const absentStudents = Array.from(students1).filter(s => !students2.has(s));
  const duplicates = Array.from(students1).filter(s => students2.has(s));

  return {
    snapshot1: {
      snapshotId: snapshotId1,
      capturedAt: capturedAt1,
      totalScans: scans1.size,
      studentsAppeared: Array.from(students1)
    },
    snapshot2: {
      snapshotId: snapshotId2,
      capturedAt: capturedAt2,
      totalScans: scans2.size,
      studentsAppeared: Array.from(students2)
    },
    differences: {
      newStudents,
      absentStudents,
      duplicateScans: duplicates,
      timeDifference: capturedAt2 - capturedAt1
    }
  };
}
