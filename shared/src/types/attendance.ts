/**
 * Attendance Tracking Types
 * Feature: qr-chain-attendance
 */

export enum EntryStatus {
  PRESENT_ENTRY = "PRESENT_ENTRY",
  LATE_ENTRY = "LATE_ENTRY"
}

export enum FinalStatus {
  PRESENT = "PRESENT",
  LATE = "LATE",
  LEFT_EARLY = "LEFT_EARLY",
  EARLY_LEAVE = "EARLY_LEAVE",
  ABSENT = "ABSENT"
}

export interface AttendanceRecord {
  sessionId: string;
  studentId: string;
  entryStatus?: EntryStatus;
  entryAt?: number; // Unix timestamp
  exitVerified: boolean;
  exitVerifiedAt?: number; // Unix timestamp
  earlyLeaveAt?: number; // Unix timestamp
  finalStatus?: FinalStatus;
}

export interface AttendanceEntity extends AttendanceRecord {
  // Azure Table Storage keys
  PartitionKey: string; // sessionId
  RowKey: string; // studentId
  Timestamp: Date;
  ETag: string;
}

export interface AttendanceResponse {
  attendance: AttendanceRecord[];
}

export interface EndSessionResponse {
  finalAttendance: AttendanceRecord[];
}

export interface AttendanceUpdate {
  studentId: string;
  entryStatus?: EntryStatus;
  exitVerified?: boolean;
  earlyLeaveAt?: number;
}
