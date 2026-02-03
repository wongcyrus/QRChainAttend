/**
 * Chain Management Types
 * Feature: qr-chain-attendance
 */

export enum ChainPhase {
  ENTRY = "ENTRY",
  EXIT = "EXIT"
}

export enum ChainState {
  ACTIVE = "ACTIVE",
  STALLED = "STALLED",
  COMPLETED = "COMPLETED"
}

export interface Chain {
  sessionId: string;
  phase: ChainPhase;
  chainId: string;
  index: number; // Incremented on reseed
  state: ChainState;
  lastHolder?: string;
  lastSeq: number;
  lastAt?: number; // Unix timestamp
}

export interface ChainEntity extends Chain {
  // Azure Table Storage keys
  PartitionKey: string; // sessionId
  RowKey: string; // chainId
  createdAt: number;
  Timestamp: Date;
  ETag: string;
}

export interface ChainScanParams {
  sessionId: string;
  tokenId: string;
  etag: string;
  scannerId: string;
  scanMetadata: ScanMetadata;
}

export interface ChainScanResult {
  success: boolean;
  holderMarked?: string; // studentId who got credit
  newHolder?: string; // studentId who became new holder
  error?: string;
}

export interface ChainUpdate {
  chainId: string;
  phase: ChainPhase;
  lastHolder: string;
  lastSeq: number;
  state: ChainState;
}

// Import from scan types
import { ScanMetadata } from "./scan";
