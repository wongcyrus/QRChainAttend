/**
 * Scan Processing Types
 * Feature: qr-chain-attendance
 */

export enum ScanFlow {
  ENTRY_CHAIN = "ENTRY_CHAIN",
  LATE_ENTRY = "LATE_ENTRY",
  EARLY_LEAVE = "EARLY_LEAVE",
  EXIT_CHAIN = "EXIT_CHAIN"
}

export enum ScanResult {
  SUCCESS = "SUCCESS",
  RATE_LIMITED = "RATE_LIMITED",
  LOCATION_VIOLATION = "LOCATION_VIOLATION",
  TOKEN_INVALID = "TOKEN_INVALID",
  TOKEN_EXPIRED = "TOKEN_EXPIRED",
  TOKEN_USED = "TOKEN_USED",
  UNAUTHORIZED = "UNAUTHORIZED"
}

export interface ScanMetadata {
  deviceFingerprint: string;
  gps?: {
    latitude: number;
    longitude: number;
  };
  bssid?: string;
  userAgent: string;
}

export interface ScanLog {
  sessionId: string;
  flow: ScanFlow;
  tokenId: string;
  holderId?: string;
  scannerId: string;
  deviceFingerprint: string;
  ip: string;
  bssid?: string;
  gps?: {
    latitude: number;
    longitude: number;
  };
  userAgent: string;
  result: ScanResult;
  error?: string;
  scannedAt: number; // Unix timestamp
}

export interface ScanLogEntity extends ScanLog {
  // Azure Table Storage keys
  PartitionKey: string; // sessionId
  RowKey: string; // timestamp + random
  Timestamp: Date;
}

export interface ScanLogParams {
  sessionId: string;
  flow: ScanFlow;
  tokenId: string;
  holderId?: string;
  scannerId: string;
  deviceFingerprint: string;
  ip: string;
  bssid?: string;
  gps?: {
    latitude: number;
    longitude: number;
  };
  userAgent: string;
  result: ScanResult;
  error?: string;
}

export interface ChainScanRequest {
  tokenId: string;
  etag: string;
  metadata: ScanMetadata;
}

export interface ChainScanResponse {
  success: boolean;
  holderMarked?: string;
  newHolder?: string;
  newToken?: string; // If baton transferred
  newTokenEtag?: string;
  error?: string;
}

export interface LateEntryScanRequest {
  tokenId: string;
  etag: string;
  metadata: ScanMetadata;
}

export interface EarlyLeaveScanRequest {
  tokenId: string;
  etag: string;
  metadata: ScanMetadata;
}

export interface ExitChainScanRequest {
  tokenId: string;
  etag: string;
  metadata: ScanMetadata;
}

export interface RateLimitResult {
  allowed: boolean;
  reason?: "DEVICE_LIMIT" | "IP_LIMIT";
}

export interface LocationValidationResult {
  valid: boolean;
  reason?: "GEOFENCE_VIOLATION" | "WIFI_VIOLATION";
}
