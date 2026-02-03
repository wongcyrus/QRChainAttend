/**
 * Error Handling Middleware
 * Feature: qr-chain-attendance
 * Task: 20.1
 * 
 * Provides consistent error handling across all API endpoints with:
 * - Standardized error response format
 * - Error categorization and codes
 * - Comprehensive error logging
 * - HTTP status code mapping
 */

import { HttpResponseInit, InvocationContext } from '@azure/functions';

/**
 * Error Categories from Design Document
 */
export enum ErrorCategory {
  AUTHENTICATION = 'AUTHENTICATION',
  VALIDATION = 'VALIDATION',
  ANTI_CHEAT = 'ANTI_CHEAT',
  RESOURCE = 'RESOURCE',
  BUSINESS_LOGIC = 'BUSINESS_LOGIC',
  INTERNAL = 'INTERNAL'
}

/**
 * Error Codes from Design Document
 */
export enum ErrorCode {
  // Authentication Errors
  UNAUTHORIZED = 'UNAUTHORIZED',
  FORBIDDEN = 'FORBIDDEN',
  
  // Validation Errors
  INVALID_REQUEST = 'INVALID_REQUEST',
  EXPIRED_TOKEN = 'EXPIRED_TOKEN',
  TOKEN_ALREADY_USED = 'TOKEN_ALREADY_USED',
  INVALID_STATE = 'INVALID_STATE',
  
  // Anti-Cheat Errors
  RATE_LIMITED = 'RATE_LIMITED',
  LOCATION_VIOLATION = 'LOCATION_VIOLATION',
  GEOFENCE_VIOLATION = 'GEOFENCE_VIOLATION',
  WIFI_VIOLATION = 'WIFI_VIOLATION',
  
  // Resource Errors
  NOT_FOUND = 'NOT_FOUND',
  CONFLICT = 'CONFLICT',
  STORAGE_ERROR = 'STORAGE_ERROR',
  
  // Business Logic Errors
  INELIGIBLE_STUDENT = 'INELIGIBLE_STUDENT',
  INSUFFICIENT_STUDENTS = 'INSUFFICIENT_STUDENTS',
  SESSION_ENDED = 'SESSION_ENDED',
  
  // Internal Errors
  INTERNAL_ERROR = 'INTERNAL_ERROR'
}

/**
 * Standard Error Response Format
 * Requirements: All error scenarios
 */
export interface ErrorResponse {
  error: {
    code: string;          // Error code from ErrorCode enum
    message: string;       // Human-readable error message
    details?: any;         // Optional additional context
    timestamp: number;     // Unix timestamp
    requestId?: string;    // For support/debugging
  };
}

/**
 * Base Application Error Class
 * All custom errors extend this class
 */
export class AppError extends Error {
  public readonly code: ErrorCode;
  public readonly category: ErrorCategory;
  public readonly statusCode: number;
  public readonly details?: any;
  public readonly isOperational: boolean;

  constructor(
    code: ErrorCode,
    category: ErrorCategory,
    message: string,
    statusCode: number,
    details?: any,
    isOperational: boolean = true
  ) {
    super(message);
    Object.setPrototypeOf(this, new.target.prototype);
    
    this.code = code;
    this.category = category;
    this.statusCode = statusCode;
    this.details = details;
    this.isOperational = isOperational;
    
    Error.captureStackTrace(this);
  }
}

/**
 * Authentication Error
 * Requirements: 1.3, 1.4, 1.5
 */
export class AuthenticationError extends AppError {
  constructor(message: string = 'Authentication failed', details?: any) {
    super(
      ErrorCode.UNAUTHORIZED,
      ErrorCategory.AUTHENTICATION,
      message,
      401,
      details
    );
  }
}

/**
 * Authorization Error (Forbidden)
 * Requirements: 1.3, 1.4
 */
export class AuthorizationError extends AppError {
  constructor(message: string = 'Access forbidden', details?: any) {
    super(
      ErrorCode.FORBIDDEN,
      ErrorCategory.AUTHENTICATION,
      message,
      403,
      details
    );
  }
}

/**
 * Validation Error
 * Requirements: 2.1, 4.6, 5.2
 */
export class ValidationError extends AppError {
  constructor(message: string, details?: any) {
    super(
      ErrorCode.INVALID_REQUEST,
      ErrorCategory.VALIDATION,
      message,
      400,
      details
    );
  }
}

/**
 * Token Expired Error
 * Requirements: 3.5, 4.1, 5.1, 6.5
 */
export class TokenExpiredError extends AppError {
  constructor(message: string = 'Token has expired', details?: any) {
    super(
      ErrorCode.EXPIRED_TOKEN,
      ErrorCategory.VALIDATION,
      message,
      400,
      details
    );
  }
}

/**
 * Token Already Used Error
 * Requirements: 3.7, 4.4, 5.5, 6.6, 8.3, 8.4
 */
export class TokenAlreadyUsedError extends AppError {
  constructor(message: string = 'Token has already been used', details?: any) {
    super(
      ErrorCode.TOKEN_ALREADY_USED,
      ErrorCategory.VALIDATION,
      message,
      409,
      details
    );
  }
}

/**
 * Invalid State Error
 * Requirements: 4.6, 5.2
 */
export class InvalidStateError extends AppError {
  constructor(message: string, details?: any) {
    super(
      ErrorCode.INVALID_STATE,
      ErrorCategory.VALIDATION,
      message,
      400,
      details
    );
  }
}

/**
 * Rate Limited Error
 * Requirements: 10.1, 10.2, 10.4
 */
export class RateLimitedError extends AppError {
  constructor(message: string = 'Rate limit exceeded', details?: any) {
    super(
      ErrorCode.RATE_LIMITED,
      ErrorCategory.ANTI_CHEAT,
      message,
      429,
      details
    );
  }
}

/**
 * Location Violation Error
 * Requirements: 9.1, 9.2, 9.3
 */
export class LocationViolationError extends AppError {
  constructor(message: string, details?: any) {
    super(
      ErrorCode.LOCATION_VIOLATION,
      ErrorCategory.ANTI_CHEAT,
      message,
      403,
      details
    );
  }
}

/**
 * Geofence Violation Error
 * Requirements: 9.2
 */
export class GeofenceViolationError extends AppError {
  constructor(message: string = 'Location outside allowed area', details?: any) {
    super(
      ErrorCode.GEOFENCE_VIOLATION,
      ErrorCategory.ANTI_CHEAT,
      message,
      403,
      details
    );
  }
}

/**
 * WiFi Violation Error
 * Requirements: 9.1
 */
export class WiFiViolationError extends AppError {
  constructor(message: string = 'Not connected to allowed WiFi network', details?: any) {
    super(
      ErrorCode.WIFI_VIOLATION,
      ErrorCategory.ANTI_CHEAT,
      message,
      403,
      details
    );
  }
}

/**
 * Not Found Error
 * Requirements: All endpoints
 */
export class NotFoundError extends AppError {
  constructor(resource: string = 'Resource', details?: any) {
    super(
      ErrorCode.NOT_FOUND,
      ErrorCategory.RESOURCE,
      `${resource} not found`,
      404,
      details
    );
  }
}

/**
 * Conflict Error (ETag mismatch)
 * Requirements: 3.7, 8.4, 16.5
 */
export class ConflictError extends AppError {
  constructor(message: string = 'Resource conflict', details?: any) {
    super(
      ErrorCode.CONFLICT,
      ErrorCategory.RESOURCE,
      message,
      409,
      details
    );
  }
}

/**
 * Storage Error
 * Requirements: All storage operations
 */
export class StorageError extends AppError {
  constructor(message: string = 'Storage operation failed', details?: any) {
    super(
      ErrorCode.STORAGE_ERROR,
      ErrorCategory.RESOURCE,
      message,
      500,
      details,
      false // Not operational - indicates infrastructure issue
    );
  }
}

/**
 * Ineligible Student Error
 * Requirements: 6.2
 */
export class IneligibleStudentError extends AppError {
  constructor(message: string = 'Student not eligible for this operation', details?: any) {
    super(
      ErrorCode.INELIGIBLE_STUDENT,
      ErrorCategory.BUSINESS_LOGIC,
      message,
      400,
      details
    );
  }
}

/**
 * Insufficient Students Error
 * Requirements: 3.1, 6.1, 11.3
 */
export class InsufficientStudentsError extends AppError {
  constructor(message: string = 'Not enough eligible students', details?: any) {
    super(
      ErrorCode.INSUFFICIENT_STUDENTS,
      ErrorCategory.BUSINESS_LOGIC,
      message,
      400,
      details
    );
  }
}

/**
 * Session Ended Error
 * Requirements: 2.3
 */
export class SessionEndedError extends AppError {
  constructor(message: string = 'Session has ended', details?: any) {
    super(
      ErrorCode.SESSION_ENDED,
      ErrorCategory.BUSINESS_LOGIC,
      message,
      400,
      details
    );
  }
}

/**
 * Internal Error
 * Requirements: All error scenarios
 */
export class InternalError extends AppError {
  constructor(message: string = 'Internal server error', details?: any) {
    super(
      ErrorCode.INTERNAL_ERROR,
      ErrorCategory.INTERNAL,
      message,
      500,
      details,
      false // Not operational
    );
  }
}

/**
 * Generate a unique request ID for error tracking
 */
function generateRequestId(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Format error as ErrorResponse
 * Requirements: All error scenarios
 * 
 * @param error - Error object
 * @param requestId - Optional request ID
 * @returns Formatted error response
 */
export function formatErrorResponse(error: Error, requestId?: string): ErrorResponse {
  const timestamp = Date.now();
  const id = requestId || generateRequestId();

  // Handle AppError instances
  if (error instanceof AppError) {
    return {
      error: {
        code: error.code,
        message: error.message,
        details: error.details,
        timestamp,
        requestId: id
      }
    };
  }

  // Handle unknown errors
  return {
    error: {
      code: ErrorCode.INTERNAL_ERROR,
      message: 'An unexpected error occurred',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined,
      timestamp,
      requestId: id
    }
  };
}

/**
 * Log error with appropriate level and context
 * Requirements: All error scenarios
 * 
 * @param context - Azure Functions invocation context
 * @param error - Error object
 * @param additionalInfo - Additional context information
 */
export function logError(
  context: InvocationContext,
  error: Error,
  additionalInfo?: Record<string, any>
): void {
  const errorInfo: Record<string, any> = {
    name: error.name,
    message: error.message,
    stack: error.stack,
    ...additionalInfo
  };

  if (error instanceof AppError) {
    errorInfo.code = error.code;
    errorInfo.category = error.category;
    errorInfo.statusCode = error.statusCode;
    errorInfo.details = error.details;
    errorInfo.isOperational = error.isOperational;

    // Log operational errors as warnings, non-operational as errors
    if (error.isOperational) {
      context.warn('Operational error:', errorInfo);
    } else {
      context.error('Non-operational error:', errorInfo);
    }
  } else {
    // Unknown errors are always logged as errors
    context.error('Unexpected error:', errorInfo);
  }
}

/**
 * Error Handler Wrapper
 * Wraps an Azure Function handler with error handling
 * Requirements: All error scenarios
 * 
 * @param handler - The function handler to wrap
 * @returns Wrapped handler with error handling
 */
export function withErrorHandling<T extends unknown[]>(
  handler: (...args: T) => Promise<HttpResponseInit>
): (...args: T) => Promise<HttpResponseInit> {
  return async (...args: T): Promise<HttpResponseInit> => {
    // Extract context (should be last argument)
    const context = args[args.length - 1] as InvocationContext;
    const requestId = generateRequestId();

    try {
      return await handler(...args);
    } catch (error: any) {
      // Log the error
      logError(context, error, { requestId });

      // Format and return error response
      const errorResponse = formatErrorResponse(error, requestId);
      
      // Determine status code
      let statusCode = 500;
      if (error instanceof AppError) {
        statusCode = error.statusCode;
      }

      return {
        status: statusCode,
        jsonBody: errorResponse
      };
    }
  };
}

/**
 * Convert common error strings to AppError instances
 * Useful for converting service layer errors to proper error types
 * 
 * @param errorString - Error string from service layer
 * @returns AppError instance
 */
export function convertErrorString(errorString: string): AppError {
  switch (errorString) {
    case 'ALREADY_USED':
      return new TokenAlreadyUsedError();
    case 'EXPIRED':
      return new TokenExpiredError();
    case 'REVOKED':
      return new ValidationError('Token has been revoked');
    case 'NOT_FOUND':
      return new NotFoundError('Token');
    case 'DEVICE_LIMIT':
      return new RateLimitedError('Device rate limit exceeded');
    case 'IP_LIMIT':
      return new RateLimitedError('IP rate limit exceeded');
    case 'GEOFENCE_VIOLATION':
      return new GeofenceViolationError();
    case 'WIFI_VIOLATION':
      return new WiFiViolationError();
    default:
      return new InternalError(`Unknown error: ${errorString}`);
  }
}
