/**
 * Session Management Types
 * Feature: qr-chain-attendance
 */

export enum SessionStatus {
  ACTIVE = "ACTIVE",
  ENDED = "ENDED"
}

export interface SessionConstraints {
  geofence?: {
    latitude: number;
    longitude: number;
    radiusMeters: number;
  };
  wifiAllowlist?: string[]; // SSIDs
}

export interface Session {
  sessionId: string;
  classId: string;
  teacherId: string;
  startAt: string; // ISO 8601
  endAt: string; // ISO 8601
  lateCutoffMinutes: number;
  exitWindowMinutes: number;
  status: SessionStatus;
  ownerTransfer: boolean;
  constraints?: SessionConstraints;
  lateEntryActive: boolean;
  currentLateTokenId?: string;
  earlyLeaveActive: boolean;
  currentEarlyTokenId?: string;
  createdAt: string;
  endedAt?: string;
}

export interface SessionEntity extends Session {
  // Azure Table Storage keys
  PartitionKey: string; // "SESSION"
  RowKey: string; // sessionId
  Timestamp: Date;
  ETag: string;
}

export interface CreateSessionRequest {
  classId: string;
  startAt: string; // ISO 8601
  endAt: string; // ISO 8601
  lateCutoffMinutes: number;
  exitWindowMinutes?: number;
  constraints?: SessionConstraints;
}

export interface CreateSessionResponse {
  sessionId: string;
  sessionQR: string; // Base64 encoded QR data
}

export interface SeedEntryResponse {
  chainsCreated: number;
  initialHolders: string[]; // studentIds
}

export interface SessionStatusResponse {
  session: Session;
  attendance: AttendanceRecord[];
  chains: Chain[];
  stats: SessionStats;
}

export interface SessionStats {
  totalStudents: number;
  presentEntry: number;
  lateEntry: number;
  earlyLeave: number;
  exitVerified: number;
  notYetVerified: number;
}

// Import types from other modules (will be defined)
import { AttendanceRecord } from "./attendance";
import { Chain } from "./chain";

export interface JoinSessionResponse {
  success: boolean;
  sessionId: string;
  studentId: string;
  message: string;
}
