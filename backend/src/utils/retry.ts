/**
 * Retry Logic with Exponential Backoff
 * Feature: qr-chain-attendance
 * Task: 20.3
 * Requirements: Storage error handling
 * 
 * Provides retry logic with exponential backoff for transient failures:
 * - Network errors
 * - Storage errors (Azure Table Storage transient issues)
 * 
 * Does NOT retry:
 * - ETag conflicts (TOKEN_ALREADY_USED, CONFLICT)
 * - Rate limits (RATE_LIMITED)
 * - Authentication/Authorization errors
 * - Validation errors
 */

import { RestError } from "@azure/data-tables";
import { AppError, ErrorCode } from "../middleware/errors";

/**
 * Retry configuration options
 */
export interface RetryOptions {
  /**
   * Maximum number of retry attempts
   * Default: 3
   */
  maxRetries?: number;

  /**
   * Initial delay in milliseconds before first retry
   * Default: 100ms
   */
  initialDelayMs?: number;

  /**
   * Maximum delay in milliseconds between retries
   * Default: 10000ms (10 seconds)
   */
  maxDelayMs?: number;

  /**
   * Exponential backoff multiplier
   * Default: 2 (doubles delay each retry)
   */
  backoffMultiplier?: number;

  /**
   * Whether to add random jitter to delay
   * Helps prevent thundering herd problem
   * Default: true
   */
  useJitter?: boolean;

  /**
   * Custom function to determine if error should be retried
   * If not provided, uses default retry logic
   */
  shouldRetry?: (error: Error, attempt: number) => boolean;

  /**
   * Callback invoked before each retry attempt
   * Useful for logging or metrics
   */
  onRetry?: (error: Error, attempt: number, delayMs: number) => void;
}

/**
 * Default retry configuration
 */
const DEFAULT_RETRY_OPTIONS: Required<Omit<RetryOptions, 'shouldRetry' | 'onRetry'>> = {
  maxRetries: 3,
  initialDelayMs: 100,
  maxDelayMs: 10000,
  backoffMultiplier: 2,
  useJitter: true,
};

/**
 * Error codes that should NOT be retried
 * Requirements: 3.7, 10.1, 10.2
 */
const NON_RETRYABLE_ERROR_CODES: ErrorCode[] = [
  ErrorCode.TOKEN_ALREADY_USED,
  ErrorCode.CONFLICT,
  ErrorCode.RATE_LIMITED,
  ErrorCode.UNAUTHORIZED,
  ErrorCode.FORBIDDEN,
  ErrorCode.INVALID_REQUEST,
  ErrorCode.INVALID_STATE,
  ErrorCode.INELIGIBLE_STUDENT,
  ErrorCode.INSUFFICIENT_STUDENTS,
  ErrorCode.SESSION_ENDED,
  ErrorCode.NOT_FOUND,
  ErrorCode.GEOFENCE_VIOLATION,
  ErrorCode.WIFI_VIOLATION,
  ErrorCode.LOCATION_VIOLATION,
];

/**
 * Azure Table Storage error codes that indicate transient failures
 * These should be retried
 */
const TRANSIENT_STORAGE_ERROR_CODES = [
  'ServerBusy',
  'InternalError',
  'OperationTimedOut',
  'ServiceTimeout',
  'RequestTimeout',
];

/**
 * HTTP status codes that indicate transient failures
 * These should be retried
 */
const TRANSIENT_HTTP_STATUS_CODES = [
  408, // Request Timeout
  429, // Too Many Requests (from Azure, not our rate limiting)
  500, // Internal Server Error
  502, // Bad Gateway
  503, // Service Unavailable
  504, // Gateway Timeout
];

/**
 * Determine if an error should be retried
 * Requirements: Storage error handling
 * 
 * @param error - Error to check
 * @returns true if error should be retried
 */
export function isRetryableError(error: Error): boolean {
  // Never retry AppError instances with non-retryable codes
  if (error instanceof AppError) {
    return !NON_RETRYABLE_ERROR_CODES.includes(error.code);
  }

  // Retry Azure Table Storage transient errors
  if (error instanceof RestError) {
    // Check error code
    if (error.code && TRANSIENT_STORAGE_ERROR_CODES.includes(error.code)) {
      return true;
    }

    // Check HTTP status code
    if (error.statusCode && TRANSIENT_HTTP_STATUS_CODES.includes(error.statusCode)) {
      return true;
    }

    // Don't retry 4xx errors (except 408, 429 handled above)
    if (error.statusCode && error.statusCode >= 400 && error.statusCode < 500) {
      return false;
    }

    // Retry 5xx errors
    if (error.statusCode && error.statusCode >= 500) {
      return true;
    }
  }

  // Retry network errors (TypeError from fetch)
  if (error instanceof TypeError && error.message.includes('fetch')) {
    return true;
  }

  // Retry ECONNRESET, ETIMEDOUT, etc.
  if (error && typeof error === 'object' && 'code' in error) {
    const errorCode = (error as any).code;
    if (typeof errorCode === 'string') {
      const networkErrorCodes = ['ECONNRESET', 'ETIMEDOUT', 'ENOTFOUND', 'ECONNREFUSED'];
      if (networkErrorCodes.includes(errorCode)) {
        return true;
      }
    }
  }

  // Default: don't retry unknown errors
  return false;
}

/**
 * Calculate delay for next retry attempt using exponential backoff
 * 
 * @param attempt - Current retry attempt (0-indexed)
 * @param options - Retry options
 * @returns Delay in milliseconds
 */
export function calculateBackoffDelay(
  attempt: number,
  options: Required<Omit<RetryOptions, 'shouldRetry' | 'onRetry'>>
): number {
  const { initialDelayMs, maxDelayMs, backoffMultiplier, useJitter } = options;

  // Calculate exponential delay: initialDelay * (multiplier ^ attempt)
  let delay = initialDelayMs * Math.pow(backoffMultiplier, attempt);

  // Cap at maximum delay
  delay = Math.min(delay, maxDelayMs);

  // Add jitter to prevent thundering herd
  if (useJitter) {
    // Random jitter between 0% and 25% of delay
    const jitter = Math.random() * 0.25 * delay;
    delay = delay + jitter;
  }

  return Math.floor(delay);
}

/**
 * Sleep for specified milliseconds
 * 
 * @param ms - Milliseconds to sleep
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Execute an operation with retry logic and exponential backoff
 * Requirements: Storage error handling
 * 
 * @param operation - Async operation to execute
 * @param options - Retry configuration options
 * @returns Result of the operation
 * @throws Last error if all retries exhausted
 */
export async function withRetry<T>(
  operation: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const config = {
    ...DEFAULT_RETRY_OPTIONS,
    ...options,
  };

  const shouldRetryFn = options.shouldRetry || isRetryableError;

  let lastError: Error;
  let attempt = 0;

  while (attempt <= config.maxRetries) {
    try {
      // Execute the operation
      return await operation();
    } catch (error: any) {
      lastError = error;

      // Check if we should retry
      const shouldRetry = shouldRetryFn(error, attempt);

      // If this is the last attempt or error is not retryable, throw
      if (attempt >= config.maxRetries || !shouldRetry) {
        throw error;
      }

      // Calculate delay for next retry
      const delayMs = calculateBackoffDelay(attempt, config);

      // Invoke retry callback if provided
      if (options.onRetry) {
        options.onRetry(error, attempt + 1, delayMs);
      }

      // Wait before retrying
      await sleep(delayMs);

      // Increment attempt counter
      attempt++;
    }
  }

  // This should never be reached, but TypeScript needs it
  throw lastError!;
}

/**
 * Retry decorator for class methods
 * Wraps a method with retry logic
 * 
 * Usage:
 * ```typescript
 * class MyService {
 *   @retry({ maxRetries: 3 })
 *   async myMethod() {
 *     // method implementation
 *   }
 * }
 * ```
 */
export function retry(options: RetryOptions = {}) {
  return function (
    target: any,
    propertyKey: string,
    descriptor: PropertyDescriptor
  ) {
    const originalMethod = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      return withRetry(
        () => originalMethod.apply(this, args),
        options
      );
    };

    return descriptor;
  };
}

/**
 * Create a retryable version of a function
 * 
 * @param fn - Function to make retryable
 * @param options - Retry options
 * @returns Retryable version of the function
 */
export function makeRetryable<T extends (...args: any[]) => Promise<any>>(
  fn: T,
  options: RetryOptions = {}
): T {
  return (async (...args: any[]) => {
    return withRetry(() => fn(...args), options);
  }) as T;
}

/**
 * Batch retry utility for multiple operations
 * Retries each operation independently
 * 
 * @param operations - Array of operations to execute
 * @param options - Retry options
 * @returns Array of results (in same order as operations)
 */
export async function withRetryBatch<T>(
  operations: Array<() => Promise<T>>,
  options: RetryOptions = {}
): Promise<T[]> {
  return Promise.all(
    operations.map(op => withRetry(op, options))
  );
}

/**
 * Retry statistics for monitoring
 */
export interface RetryStats {
  totalAttempts: number;
  successfulRetries: number;
  failedRetries: number;
  totalDelayMs: number;
}

/**
 * Execute operation with retry and collect statistics
 * Useful for monitoring and metrics
 * 
 * @param operation - Operation to execute
 * @param options - Retry options
 * @returns Tuple of [result, stats]
 */
export async function withRetryStats<T>(
  operation: () => Promise<T>,
  options: RetryOptions = {}
): Promise<[T, RetryStats]> {
  const stats: RetryStats = {
    totalAttempts: 0,
    successfulRetries: 0,
    failedRetries: 0,
    totalDelayMs: 0,
  };

  const config = {
    ...DEFAULT_RETRY_OPTIONS,
    ...options,
  };

  const shouldRetryFn = options.shouldRetry || isRetryableError;

  let lastError: Error;
  let attempt = 0;

  while (attempt <= config.maxRetries) {
    stats.totalAttempts++;

    try {
      const result = await operation();
      
      // If we had previous failures, count this as a successful retry
      if (attempt > 0) {
        stats.successfulRetries++;
      }

      return [result, stats];
    } catch (error: any) {
      lastError = error;

      const shouldRetry = shouldRetryFn(error, attempt);

      if (attempt >= config.maxRetries || !shouldRetry) {
        stats.failedRetries++;
        throw error;
      }

      const delayMs = calculateBackoffDelay(attempt, config);
      stats.totalDelayMs += delayMs;

      if (options.onRetry) {
        options.onRetry(error, attempt + 1, delayMs);
      }

      await sleep(delayMs);
      attempt++;
    }
  }

  throw lastError!;
}
