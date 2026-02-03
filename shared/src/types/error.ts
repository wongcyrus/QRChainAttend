/**
 * Error Handling Types
 * Feature: qr-chain-attendance
 */

export type ErrorCode =
  // Authentication Errors
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  // Validation Errors
  | "INVALID_REQUEST"
  | "EXPIRED_TOKEN"
  | "TOKEN_ALREADY_USED"
  | "INVALID_STATE"
  // Anti-Cheat Errors
  | "RATE_LIMITED"
  | "LOCATION_VIOLATION"
  | "GEOFENCE_VIOLATION"
  | "WIFI_VIOLATION"
  // Resource Errors
  | "NOT_FOUND"
  | "CONFLICT"
  | "STORAGE_ERROR"
  // Business Logic Errors
  | "INELIGIBLE_STUDENT"
  | "INSUFFICIENT_STUDENTS"
  | "SESSION_ENDED";

export interface ErrorResponse {
  error: {
    code: ErrorCode;
    message: string;
    details?: any;
    timestamp: number;
    requestId: string;
  };
}

export class AppError extends Error {
  constructor(
    public code: ErrorCode,
    message: string,
    public details?: any
  ) {
    super(message);
    this.name = "AppError";
  }
}
