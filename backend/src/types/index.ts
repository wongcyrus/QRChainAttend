/**
 * Type Definitions
 * Feature: qr-chain-attendance
 * 
 * Core data models and enums for the QR Chain Attendance System
 */

/**
 * Token Types
 * Requirements: 3.2, 4.1, 5.1, 6.5
 */
export enum TokenType {
  SESSION = "SESSION",
  CHAIN = "CHAIN",
  LATE_ENTRY = "LATE_ENTRY",
  EARLY_LEAVE = "EARLY_LEAVE",
  EXIT_CHAIN = "EXIT_CHAIN"
}

/**
 * Token Status
 * Requirements: 8.6
 */
export enum TokenStatus {
  ACTIVE = "ACTIVE",
  USED = "USED",
  EXPIRED = "EXPIRED",
  REVOKED = "REVOKED"
}

/**
 * Token Entity stored in Azure Table Storage
 * Requirements: 3.2, 3.5, 3.7, 8.1, 8.2, 8.3, 8.4, 8.5
 */
export interface TokenEntity {
  // Azure Table Storage keys
  partitionKey: string;    // sessionId (for efficient cleanup)
  rowKey: string;          // tokenId
  
  // Token data
  type: TokenType;
  chainId?: string;
  issuedTo?: string;       // holderId for chain tokens
  seq?: number;
  exp: number;             // Unix timestamp (seconds)
  status: TokenStatus;
  singleUse: boolean;
  
  // Timestamps
  createdAt: number;       // Unix timestamp (seconds)
  usedAt?: number;         // Unix timestamp (seconds)
  
  // Azure Table Storage metadata
  timestamp?: Date;
  etag?: string;
}

/**
 * Token object returned by service methods
 */
export interface Token {
  tokenId: string;
  sessionId: string;
  type: TokenType;
  chainId?: string;
  issuedTo?: string;
  seq?: number;
  exp: number;
  status: TokenStatus;
  singleUse: boolean;
  etag: string;
}

/**
 * Parameters for creating a new token
 */
export interface CreateTokenParams {
  sessionId: string;
  type: TokenType;
  chainId?: string;
  issuedTo?: string;  // holderId for chain tokens
  seq?: number;
  ttlSeconds: number;
  singleUse: boolean;
}

/**
 * Result of token consumption attempt
 */
export interface ConsumeResult {
  success: boolean;
  token?: Token;
  error?: "ALREADY_USED" | "EXPIRED" | "REVOKED" | "NOT_FOUND";
}

/**
 * Result of token validation
 */
export interface ValidationResult {
  valid: boolean;
  token?: Token;
  error?: "EXPIRED" | "USED" | "REVOKED" | "NOT_FOUND";
}

/**
 * User Roles
 * Requirements: 1.1, 1.2
 */
export enum Role {
  STUDENT = "student",
  TEACHER = "teacher"
}

/**
 * User Principal parsed from authentication
 */
export interface UserPrincipal {
  userId: string;
  userEmail: string;
  userRoles: Role[];
  identityProvider: string;
}

/**
 * Entry Status
 * Requirements: 3.3, 4.3
 */
export enum EntryStatus {
  PRESENT_ENTRY = "PRESENT_ENTRY",
  LATE_ENTRY = "LATE_ENTRY"
}

/**
 * Final Status
 * Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6
 */
export enum FinalStatus {
  PRESENT = "PRESENT",
  LATE = "LATE",
  LEFT_EARLY = "LEFT_EARLY",
  EARLY_LEAVE = "EARLY_LEAVE",
  ABSENT = "ABSENT"
}

/**
 * Session Status
 * Requirements: 2.2, 2.3
 */
export enum SessionStatus {
  ACTIVE = "ACTIVE",
  ENDED = "ENDED"
}

/**
 * Chain Phase
 * Requirements: 3.1, 6.1
 */
export enum ChainPhase {
  ENTRY = "ENTRY",
  EXIT = "EXIT"
}

/**
 * Chain State
 * Requirements: 11.1
 */
export enum ChainState {
  ACTIVE = "ACTIVE",
  STALLED = "STALLED",
  COMPLETED = "COMPLETED"
}

/**
 * Attendance Record Entity stored in Azure Table Storage
 * Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6, 7.7
 */
export interface AttendanceEntity {
  // Azure Table Storage keys
  partitionKey: string;    // sessionId (for efficient session queries)
  rowKey: string;          // studentId
  
  // Entry tracking
  entryStatus?: EntryStatus;
  entryAt?: number;        // Unix timestamp (seconds)
  
  // Exit tracking
  exitVerified: boolean;
  exitVerifiedAt?: number; // Unix timestamp (seconds)
  
  // Early leave tracking
  earlyLeaveAt?: number;   // Unix timestamp (seconds)
  
  // Final status
  finalStatus?: FinalStatus;
  
  // Azure Table Storage metadata
  timestamp?: Date;
  etag?: string;
}

/**
 * Attendance Record object returned by service methods
 */
export interface AttendanceRecord {
  sessionId: string;
  studentId: string;
  entryStatus?: EntryStatus;
  entryAt?: number;
  exitVerified: boolean;
  exitVerifiedAt?: number;
  earlyLeaveAt?: number;
  finalStatus?: FinalStatus;
}

/**
 * Scan Flow Types
 * Requirements: 15.2
 */
export enum ScanFlow {
  ENTRY_CHAIN = "ENTRY_CHAIN",
  LATE_ENTRY = "LATE_ENTRY",
  EARLY_LEAVE = "EARLY_LEAVE",
  EXIT_CHAIN = "EXIT_CHAIN"
}

/**
 * Scan Result Types
 * Requirements: 15.4
 */
export enum ScanResult {
  SUCCESS = "SUCCESS",
  RATE_LIMITED = "RATE_LIMITED",
  LOCATION_VIOLATION = "LOCATION_VIOLATION",
  TOKEN_INVALID = "TOKEN_INVALID",
  TOKEN_EXPIRED = "TOKEN_EXPIRED",
  TOKEN_USED = "TOKEN_USED",
  UNAUTHORIZED = "UNAUTHORIZED"
}

/**
 * Rate Limit Result
 * Requirements: 10.1, 10.2
 */
export interface RateLimitResult {
  allowed: boolean;
  reason?: "DEVICE_LIMIT" | "IP_LIMIT";
}

/**
 * Location Validation Result
 * Requirements: 9.1, 9.2, 9.3
 */
export interface LocationValidationResult {
  valid: boolean;
  reason?: "GEOFENCE_VIOLATION" | "WIFI_VIOLATION";
}

/**
 * GPS Coordinates
 * Requirements: 9.2
 */
export interface GpsCoordinates {
  latitude: number;
  longitude: number;
}

/**
 * Scan Metadata
 * Requirements: 9.5, 10.3, 15.3
 */
export interface ScanMetadata {
  deviceFingerprint: string;
  gps?: GpsCoordinates;
  bssid?: string;
  userAgent: string;
}

/**
 * Scan Log Parameters
 * Requirements: 15.1, 15.2, 15.3, 15.4
 */
export interface ScanLogParams {
  sessionId: string;
  flow: ScanFlow;
  tokenId: string;
  holderId?: string;
  scannerId: string;
  deviceFingerprint: string;
  ip: string;
  bssid?: string;
  gps?: GpsCoordinates;
  userAgent: string;
  result: ScanResult;
  error?: string;
}

/**
 * Scan Log Entity stored in Azure Table Storage
 * Requirements: 15.1, 15.2, 15.3, 15.4, 15.5
 */
export interface ScanLogEntity {
  // Azure Table Storage keys
  partitionKey: string;    // sessionId (for efficient teacher queries)
  rowKey: string;          // timestamp + random (for uniqueness and time-ordered)
  
  // Scan data
  flow: ScanFlow;
  tokenId: string;
  holderId?: string;
  scannerId: string;
  
  // Metadata
  deviceFingerprint: string;
  ip: string;
  bssid?: string;
  gps?: string;            // JSON serialized coordinates
  userAgent: string;
  
  // Result
  result: ScanResult;
  error?: string;
  
  // Timestamp
  scannedAt: number;       // Unix timestamp (seconds)
  
  // Azure Table Storage metadata
  timestamp?: Date;
}

/**
 * Session Constraints
 * Requirements: 2.4, 9.1, 9.2
 */
export interface SessionConstraints {
  geofence?: {
    latitude: number;
    longitude: number;
    radiusMeters: number;
  };
  wifiAllowlist?: string[];  // SSIDs
}

/**
 * Chain Entity stored in Azure Table Storage
 * Requirements: 3.1, 6.1, 11.1, 11.5
 */
export interface ChainEntity {
  // Azure Table Storage keys
  partitionKey: string;    // sessionId
  rowKey: string;          // chainId
  
  // Chain data
  phase: ChainPhase;
  index: number;           // Incremented on reseed
  state: ChainState;
  lastHolder?: string;
  lastSeq: number;
  lastAt?: number;         // Unix timestamp (seconds)
  
  // Timestamps
  createdAt: number;       // Unix timestamp (seconds)
  
  // Azure Table Storage metadata
  timestamp?: Date;
  etag?: string;
}

/**
 * Chain object returned by service methods
 */
export interface Chain {
  sessionId: string;
  phase: ChainPhase;
  chainId: string;
  index: number;
  state: ChainState;
  lastHolder?: string;
  lastSeq: number;
  lastAt?: number;
}

/**
 * Chain Scan Parameters
 * Requirements: 3.3, 3.4, 6.3, 6.4
 */
export interface ChainScanParams {
  sessionId: string;
  tokenId: string;
  etag: string;
  scannerId: string;
  scanMetadata: ScanMetadata;
}

/**
 * Chain Scan Result
 * Requirements: 3.3, 3.4, 6.3, 6.4, 12.1, 12.2
 * 
 * Note: SignalRMessage is imported from SignalRService
 */
export interface ChainScanResult {
  success: boolean;
  holderMarked?: string;  // studentId who got credit
  newHolder?: string;     // studentId who became new holder
  error?: string;
  signalRMessages?: any[];  // SignalR messages to broadcast (SignalRMessage[])
}

/**
 * Chain Update for SignalR notifications
 * Requirements: 12.2
 */
export interface ChainUpdate {
  chainId: string;
  phase: ChainPhase;
  lastHolder: string;
  lastSeq: number;
  state: ChainState;
}

/**
 * Session Entity stored in Azure Table Storage
 * Requirements: 2.1, 2.2, 2.3, 2.4, 2.5
 */
export interface SessionEntity {
  // Azure Table Storage keys
  partitionKey: string;    // "SESSION"
  rowKey: string;          // sessionId (GUID)
  
  // Session data
  classId: string;
  teacherId: string;
  startAt: string;         // ISO 8601
  endAt: string;           // ISO 8601
  lateCutoffMinutes: number;
  exitWindowMinutes: number;
  status: SessionStatus;
  
  // Configuration
  ownerTransfer: boolean;
  constraints?: string;    // JSON serialized SessionConstraints
  
  // Current state
  lateEntryActive: boolean;
  currentLateTokenId?: string;
  earlyLeaveActive: boolean;
  currentEarlyTokenId?: string;
  
  // Timestamps
  createdAt: string;       // ISO 8601
  endedAt?: string;        // ISO 8601
  
  // Azure Table Storage metadata
  timestamp?: Date;
  etag?: string;
}

/**
 * Session object returned by service methods
 */
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
  constraints?: SessionConstraints;
  lateEntryActive: boolean;
  currentLateTokenId?: string;
  earlyLeaveActive: boolean;
  currentEarlyTokenId?: string;
  createdAt: string;
  endedAt?: string;
}

/**
 * Create Session Request
 * Requirements: 2.1
 */
export interface CreateSessionRequest {
  classId: string;
  startAt: string;  // ISO 8601
  endAt: string;    // ISO 8601
  lateCutoffMinutes: number;
  exitWindowMinutes?: number;
  constraints?: SessionConstraints;
}

/**
 * Create Session Response
 * Requirements: 2.5
 */
export interface CreateSessionResponse {
  sessionId: string;
  sessionQR: string;  // Base64 encoded QR data
}

/**
 * Seed Entry Response
 * Requirements: 3.1
 */
export interface SeedEntryResponse {
  chainsCreated: number;
  initialHolders: string[];  // studentIds
}

/**
 * End Session Response
 * Requirements: 2.3, 7.7
 */
export interface EndSessionResponse {
  finalAttendance: AttendanceRecord[];
}

/**
 * Session QR Data
 * Requirements: 2.5
 */
export interface SessionQRData {
  type: "SESSION";
  sessionId: string;
  classId: string;
}
