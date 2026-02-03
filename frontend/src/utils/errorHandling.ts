/**
 * Client-Side Error Handling Utility
 * Feature: qr-chain-attendance
 * Task: 20.2
 * Requirements: 3.5, 3.7, 9.3, 10.1, 10.2
 * 
 * Provides comprehensive error handling for the frontend including:
 * - User-friendly error messages
 * - Token expiration retry logic
 * - ETag conflict handling (no retry)
 * - Rate limit cooldown timers
 * - Location violation guidance
 */

import type { ErrorResponse, ErrorCode } from '@qr-attendance/shared';

/**
 * Error handling configuration
 */
export interface ErrorHandlingConfig {
  /**
   * Whether to automatically retry on token expiration
   * Default: true
   */
  retryOnExpiration?: boolean;

  /**
   * Maximum number of retries for expired tokens
   * Default: 1
   */
  maxRetries?: number;

  /**
   * Callback when rate limit is encountered
   * Receives cooldown time in seconds
   */
  onRateLimit?: (cooldownSeconds: number) => void;

  /**
   * Callback when location violation occurs
   * Receives violation type and guidance message
   */
  onLocationViolation?: (type: 'geofence' | 'wifi' | 'general', guidance: string) => void;
}

/**
 * User-friendly error messages mapped to error codes
 * Requirements: 3.5, 3.7, 9.3, 10.1, 10.2
 */
export const ERROR_MESSAGES: Record<ErrorCode, string> = {
  // Authentication Errors
  UNAUTHORIZED: 'You are not signed in. Please sign in to continue.',
  FORBIDDEN: 'You do not have permission to perform this action.',

  // Validation Errors
  INVALID_REQUEST: 'Invalid request. Please check your input and try again.',
  EXPIRED_TOKEN: 'This QR code has expired. Please scan a new one.',
  TOKEN_ALREADY_USED: 'This QR code has already been scanned.',
  INVALID_STATE: 'This action is not available at this time.',

  // Anti-Cheat Errors
  RATE_LIMITED: 'Too many attempts. Please wait before trying again.',
  LOCATION_VIOLATION: 'Location verification failed. Please ensure you are in the classroom.',
  GEOFENCE_VIOLATION: 'You must be physically present in the classroom to scan.',
  WIFI_VIOLATION: 'Please connect to the classroom Wi-Fi network.',

  // Resource Errors
  NOT_FOUND: 'The requested resource was not found.',
  CONFLICT: 'This action has already been completed by someone else.',
  STORAGE_ERROR: 'A server error occurred. Please try again later.',

  // Business Logic Errors
  INELIGIBLE_STUDENT: 'You are not eligible for this action.',
  INSUFFICIENT_STUDENTS: 'Not enough students available for this operation.',
  SESSION_ENDED: 'This session has ended.',
};

/**
 * Location violation guidance messages
 * Requirements: 9.3
 */
export const LOCATION_GUIDANCE: Record<string, string> = {
  GEOFENCE_VIOLATION: 'Please ensure you are physically present in the classroom. Your GPS location indicates you are outside the allowed area.',
  WIFI_VIOLATION: 'Please connect to the classroom Wi-Fi network. Your current network is not authorized for attendance.',
  LOCATION_VIOLATION: 'Please ensure you are in the classroom and connected to the correct Wi-Fi network. Enable location services if prompted.',
};

/**
 * Rate limit cooldown duration in seconds
 * Requirements: 10.1, 10.2
 */
export const RATE_LIMIT_COOLDOWN = 60; // 60 seconds as per design

/**
 * Errors that should NOT be retried
 * Requirements: 3.7
 */
const NO_RETRY_ERRORS: ErrorCode[] = [
  'TOKEN_ALREADY_USED',
  'CONFLICT',
  'RATE_LIMITED',
  'LOCATION_VIOLATION',
  'GEOFENCE_VIOLATION',
  'WIFI_VIOLATION',
  'UNAUTHORIZED',
  'FORBIDDEN',
  'INELIGIBLE_STUDENT',
  'SESSION_ENDED',
];

/**
 * Errors that can be retried
 * Requirements: 3.5
 */
const RETRYABLE_ERRORS: ErrorCode[] = [
  'EXPIRED_TOKEN',
  'STORAGE_ERROR',
];

/**
 * Parse error response from API
 */
export function parseErrorResponse(response: ErrorResponse): {
  code: ErrorCode;
  message: string;
  details?: any;
  timestamp: number;
  requestId: string;
} {
  return {
    code: response.error.code,
    message: response.error.message,
    details: response.error.details,
    timestamp: response.error.timestamp,
    requestId: response.error.requestId,
  };
}

/**
 * Get user-friendly error message
 * Requirements: 3.5, 3.7, 9.3, 10.1, 10.2
 */
export function getUserFriendlyMessage(errorCode: ErrorCode, details?: any): string {
  const baseMessage = ERROR_MESSAGES[errorCode] || 'An unexpected error occurred. Please try again.';

  // Add specific guidance for location violations
  if (errorCode === 'GEOFENCE_VIOLATION' || errorCode === 'WIFI_VIOLATION' || errorCode === 'LOCATION_VIOLATION') {
    const guidance = LOCATION_GUIDANCE[errorCode] || LOCATION_GUIDANCE.LOCATION_VIOLATION;
    return `${baseMessage}\n\n${guidance}`;
  }

  // Add cooldown information for rate limits
  if (errorCode === 'RATE_LIMITED') {
    return `${baseMessage} You can try again in ${RATE_LIMIT_COOLDOWN} seconds.`;
  }

  // Add details if available
  if (details && typeof details === 'object') {
    if (details.reason) {
      return `${baseMessage} (${details.reason})`;
    }
  }

  return baseMessage;
}

/**
 * Check if an error should be retried
 * Requirements: 3.5, 3.7
 */
export function shouldRetry(errorCode: ErrorCode): boolean {
  // Never retry these errors
  if (NO_RETRY_ERRORS.includes(errorCode)) {
    return false;
  }

  // Retry these errors
  if (RETRYABLE_ERRORS.includes(errorCode)) {
    return true;
  }

  // Default: don't retry unknown errors
  return false;
}

/**
 * Check if error is a rate limit error
 * Requirements: 10.1, 10.2
 */
export function isRateLimitError(errorCode: ErrorCode): boolean {
  return errorCode === 'RATE_LIMITED';
}

/**
 * Check if error is a location violation
 * Requirements: 9.3
 */
export function isLocationViolation(errorCode: ErrorCode): boolean {
  return errorCode === 'LOCATION_VIOLATION' || 
         errorCode === 'GEOFENCE_VIOLATION' || 
         errorCode === 'WIFI_VIOLATION';
}

/**
 * Get location violation type
 * Requirements: 9.3
 */
export function getLocationViolationType(errorCode: ErrorCode): 'geofence' | 'wifi' | 'general' {
  if (errorCode === 'GEOFENCE_VIOLATION') return 'geofence';
  if (errorCode === 'WIFI_VIOLATION') return 'wifi';
  return 'general';
}

/**
 * Enhanced fetch with error handling and retry logic
 * Requirements: 3.5, 3.7, 9.3, 10.1, 10.2
 */
export async function fetchWithErrorHandling<T = any>(
  url: string,
  options: RequestInit = {},
  config: ErrorHandlingConfig = {}
): Promise<T> {
  const {
    retryOnExpiration = true,
    maxRetries = 1,
    onRateLimit,
    onLocationViolation,
  } = config;

  let retryCount = 0;

  const attemptFetch = async (): Promise<T> => {
    try {
      const response = await fetch(url, options);

      // Success
      if (response.ok) {
        return await response.json();
      }

      // Parse error response
      const errorResponse: ErrorResponse = await response.json();
      const { code, message, details } = parseErrorResponse(errorResponse);

      // Handle rate limit
      if (isRateLimitError(code)) {
        onRateLimit?.(RATE_LIMIT_COOLDOWN);
        throw new Error(getUserFriendlyMessage(code, details));
      }

      // Handle location violation
      if (isLocationViolation(code)) {
        const violationType = getLocationViolationType(code);
        const guidance = LOCATION_GUIDANCE[code] || LOCATION_GUIDANCE.LOCATION_VIOLATION;
        onLocationViolation?.(violationType, guidance);
        throw new Error(getUserFriendlyMessage(code, details));
      }

      // Handle token expiration with retry
      if (code === 'EXPIRED_TOKEN' && retryOnExpiration && retryCount < maxRetries) {
        retryCount++;
        // Wait a bit before retrying (allow time for new token to be generated)
        await new Promise(resolve => setTimeout(resolve, 500));
        return attemptFetch();
      }

      // Throw error with user-friendly message
      throw new Error(getUserFriendlyMessage(code, details));

    } catch (error) {
      // Network errors
      if (error instanceof TypeError && error.message.includes('fetch')) {
        throw new Error('Network error. Please check your internet connection and try again.');
      }

      // Re-throw other errors
      throw error;
    }
  };

  return attemptFetch();
}

/**
 * Rate limit tracker for client-side cooldown management
 * Requirements: 10.1, 10.2
 */
export class RateLimitTracker {
  private cooldownEndTime: number | null = null;
  private cooldownCallbacks: Array<() => void> = [];

  /**
   * Start a cooldown period
   */
  startCooldown(durationSeconds: number = RATE_LIMIT_COOLDOWN): void {
    this.cooldownEndTime = Date.now() + (durationSeconds * 1000);
    
    // Set timer to clear cooldown
    setTimeout(() => {
      this.cooldownEndTime = null;
      this.notifyCooldownEnd();
    }, durationSeconds * 1000);
  }

  /**
   * Check if currently in cooldown
   */
  isInCooldown(): boolean {
    if (!this.cooldownEndTime) return false;
    return Date.now() < this.cooldownEndTime;
  }

  /**
   * Get remaining cooldown time in seconds
   */
  getRemainingSeconds(): number {
    if (!this.cooldownEndTime) return 0;
    const remaining = Math.ceil((this.cooldownEndTime - Date.now()) / 1000);
    return Math.max(0, remaining);
  }

  /**
   * Register callback for when cooldown ends
   */
  onCooldownEnd(callback: () => void): void {
    this.cooldownCallbacks.push(callback);
  }

  /**
   * Notify all callbacks that cooldown has ended
   */
  private notifyCooldownEnd(): void {
    this.cooldownCallbacks.forEach(callback => callback());
    this.cooldownCallbacks = [];
  }

  /**
   * Clear cooldown manually
   */
  clearCooldown(): void {
    this.cooldownEndTime = null;
    this.notifyCooldownEnd();
  }
}

/**
 * Global rate limit tracker instance
 */
export const globalRateLimitTracker = new RateLimitTracker();

/**
 * Error display helper
 * Formats error for display in UI
 */
export interface FormattedError {
  title: string;
  message: string;
  type: 'error' | 'warning' | 'info';
  canRetry: boolean;
  guidance?: string;
}

/**
 * Format error for display
 * Requirements: 3.5, 3.7, 9.3, 10.1, 10.2
 */
export function formatErrorForDisplay(error: Error | string, errorCode?: ErrorCode): FormattedError {
  const message = typeof error === 'string' ? error : error.message;

  // Default formatted error
  const formatted: FormattedError = {
    title: 'Error',
    message,
    type: 'error',
    canRetry: false,
  };

  // If we have an error code, customize the display
  if (errorCode) {
    // Token expiration - can retry
    if (errorCode === 'EXPIRED_TOKEN') {
      formatted.title = 'QR Code Expired';
      formatted.type = 'warning';
      formatted.canRetry = true;
      formatted.message = 'This QR code has expired. Please scan a new one.';
    }

    // Token already used - cannot retry
    else if (errorCode === 'TOKEN_ALREADY_USED') {
      formatted.title = 'Already Scanned';
      formatted.type = 'info';
      formatted.canRetry = false;
      formatted.message = 'This QR code has already been scanned.';
    }

    // Rate limited - show cooldown
    else if (errorCode === 'RATE_LIMITED') {
      formatted.title = 'Too Many Attempts';
      formatted.type = 'warning';
      formatted.canRetry = false;
      formatted.message = `Please wait ${RATE_LIMIT_COOLDOWN} seconds before trying again.`;
    }

    // Location violations - show guidance
    else if (isLocationViolation(errorCode)) {
      formatted.title = 'Location Verification Failed';
      formatted.type = 'warning';
      formatted.canRetry = false;
      formatted.guidance = LOCATION_GUIDANCE[errorCode] || LOCATION_GUIDANCE.LOCATION_VIOLATION;
    }

    // Authentication errors
    else if (errorCode === 'UNAUTHORIZED' || errorCode === 'FORBIDDEN') {
      formatted.title = 'Access Denied';
      formatted.type = 'error';
      formatted.canRetry = false;
    }

    // Session ended
    else if (errorCode === 'SESSION_ENDED') {
      formatted.title = 'Session Ended';
      formatted.type = 'info';
      formatted.canRetry = false;
    }
  }

  return formatted;
}

/**
 * Log error for debugging
 * Includes error details and context
 */
export function logError(
  error: Error | string,
  context?: Record<string, any>
): void {
  const errorMessage = typeof error === 'string' ? error : error.message;
  const errorStack = error instanceof Error ? error.stack : undefined;

  console.error('[Error]', {
    message: errorMessage,
    stack: errorStack,
    context,
    timestamp: new Date().toISOString(),
  });
}
