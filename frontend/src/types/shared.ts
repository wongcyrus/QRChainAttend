/**
 * Shared types for QR Chain Attendance
 * These replace the archived @qr-attendance/shared package
 */

// Session types
export interface Session {
  sessionId: string;
  classId: string;
  teacherId: string;
  startAt: string;
  endAt: string;
  lateCutoffMinutes: number;
  exitWindowMinutes: number;
  status: SessionStatus;
  ownerTransfer: boolean;
  lateEntryActive: boolean;
  earlyLeaveActive: boolean;
  createdAt: string;
  // Geolocation fields
  location?: {
    latitude: number;
    longitude: number;
  };
  geofenceRadius?: number; // in meters
  enforceGeofence?: boolean; // true = block, false = warning only
}

export type SessionStatus = 'ACTIVE' | 'ENDED';

// QR Data types
export interface SessionQRData {
  type: 'SESSION';
  sessionId: string;
  timestamp: number;
}

export interface ChainQRData {
  type: 'CHAIN_ENTRY' | 'CHAIN_EXIT' | 'CHAIN';
  sessionId: string;
  chainId: string;
  holderId: string;
  tokenId: string;
  etag: string;
  timestamp: number;
  expiresAt: number;
}

export interface RotatingQRData {
  type: 'LATE_ENTRY' | 'EARLY_LEAVE';
  sessionId: string;
  tokenId: string;
  timestamp: number;
  expiresAt: number;
}

// Response types
export interface JoinSessionResponse {
  success: boolean;
  sessionId: string;
  studentId: string;
  message: string;
  locationWarning?: string;
}

export interface ChainScanResponse {
  success: boolean;
  message: string;
  holderMarked: boolean;
  newHolder?: string;
  newToken?: string;
  newTokenEtag?: string;
  locationWarning?: string;
}

// Scan metadata
export interface ScanMetadata {
  scannedAt?: number;
  scannerLocation?: {
    latitude: number;
    longitude: number;
  };
  deviceInfo?: string;
  deviceFingerprint?: string;
  gps?: {
    latitude: number;
    longitude: number;
    accuracy?: number;
  };
  bssid?: string;
  userAgent?: string;
}

// Error response
export interface ErrorResponse {
  error: {
    code: string;
    message: string;
    details?: string;
    timestamp: number;
  };
}

// Snapshot types
export interface Snapshot {
  snapshotId: string;
  sessionId: string;
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
    timeDifference: number;
  };
}
