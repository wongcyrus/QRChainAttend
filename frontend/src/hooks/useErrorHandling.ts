/**
 * Error Handling Hook
 * Feature: qr-chain-attendance
 * Task: 20.2
 * Requirements: 3.5, 3.7, 9.3, 10.1, 10.2
 * 
 * React hook for managing error state, retry logic, and cooldown timers
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  getUserFriendlyMessage,
  shouldRetry,
  isRateLimitError,
  isLocationViolation,
  getLocationViolationType,
  formatErrorForDisplay,
  type FormattedError,
  RATE_LIMIT_COOLDOWN,
} from '../utils/errorHandling';

export interface UseErrorHandlingOptions {
  /**
   * Callback when error occurs
   */
  onError?: (error: FormattedError) => void;

  /**
   * Callback when rate limit cooldown ends
   */
  onCooldownEnd?: () => void;

  /**
   * Auto-clear error after specified milliseconds
   */
  autoClearMs?: number;
}

export interface UseErrorHandlingReturn {
  /**
   * Current error state
   */
  error: FormattedError | null;

  /**
   * Error code if available
   */
  errorCode: ErrorCode | null;

  /**
   * Whether currently in rate limit cooldown
   */
  isInCooldown: boolean;

  /**
   * Remaining cooldown time in seconds
   */
  cooldownSeconds: number;

  /**
   * Set an error
   */
  setError: (error: Error | string, code?: ErrorCode) => void;

  /**
   * Clear current error
   */
  clearError: () => void;

  /**
   * Start rate limit cooldown
   */
  startCooldown: (durationSeconds?: number) => void;

  /**
   * Check if error can be retried
   */
  canRetry: boolean;
}

/**
 * Hook for managing error state and cooldown timers
 * Requirements: 3.5, 3.7, 9.3, 10.1, 10.2
 */
export function useErrorHandling(options: UseErrorHandlingOptions = {}): UseErrorHandlingReturn {
  const { onError, onCooldownEnd, autoClearMs } = options;

  const [error, setErrorState] = useState<FormattedError | null>(null);
  const [errorCode, setErrorCode] = useState<ErrorCode | null>(null);
  const [isInCooldown, setIsInCooldown] = useState(false);
  const [cooldownSeconds, setCooldownSeconds] = useState(0);

  const cooldownTimerRef = useRef<NodeJS.Timeout | null>(null);
  const autoClearTimerRef = useRef<NodeJS.Timeout | null>(null);
  const cooldownIntervalRef = useRef<NodeJS.Timeout | null>(null);

  /**
   * Clear all timers
   */
  const clearTimers = useCallback(() => {
    if (cooldownTimerRef.current) {
      clearTimeout(cooldownTimerRef.current);
      cooldownTimerRef.current = null;
    }
    if (autoClearTimerRef.current) {
      clearTimeout(autoClearTimerRef.current);
      autoClearTimerRef.current = null;
    }
    if (cooldownIntervalRef.current) {
      clearInterval(cooldownIntervalRef.current);
      cooldownIntervalRef.current = null;
    }
  }, []);

  /**
   * Start cooldown
   */
  const startCooldown = useCallback((durationSeconds: number = RATE_LIMIT_COOLDOWN) => {
    setIsInCooldown(true);
    setCooldownSeconds(durationSeconds);

    // Update countdown every second
    cooldownIntervalRef.current = setInterval(() => {
      setCooldownSeconds(prev => {
        const next = prev - 1;
        if (next <= 0) {
          if (cooldownIntervalRef.current) {
            clearInterval(cooldownIntervalRef.current);
            cooldownIntervalRef.current = null;
          }
        }
        return Math.max(0, next);
      });
    }, 1000);

    // End cooldown after duration
    cooldownTimerRef.current = setTimeout(() => {
      setIsInCooldown(false);
      setCooldownSeconds(0);
      if (cooldownIntervalRef.current) {
        clearInterval(cooldownIntervalRef.current);
        cooldownIntervalRef.current = null;
      }
      onCooldownEnd?.();
    }, durationSeconds * 1000);
  }, [onCooldownEnd]);

  /**
   * Set error
   */
  const setError = useCallback((err: Error | string, code?: ErrorCode) => {
    const formatted = formatErrorForDisplay(err, code);
    setErrorState(formatted);
    setErrorCode(code || null);

    // Call error callback
    onError?.(formatted);

    // Auto-clear if specified
    if (autoClearMs) {
      autoClearTimerRef.current = setTimeout(() => {
        setErrorState(null);
        setErrorCode(null);
      }, autoClearMs);
    }

    // Start cooldown if rate limited
    if (code && isRateLimitError(code)) {
      startCooldown(RATE_LIMIT_COOLDOWN);
    }
  }, [onError, autoClearMs, startCooldown]);

  /**
   * Clear error
   */
  const clearError = useCallback(() => {
    setErrorState(null);
    setErrorCode(null);
    clearTimers();
  }, [clearTimers]);

  /**
   * Cleanup on unmount
   */
  useEffect(() => {
    return () => {
      clearTimers();
    };
  }, [clearTimers]);

  /**
   * Check if current error can be retried
   */
  const canRetry = errorCode ? shouldRetry(errorCode) : false;

  return {
    error,
    errorCode,
    isInCooldown,
    cooldownSeconds,
    setError,
    clearError,
    startCooldown,
    canRetry,
  };
}

/**
 * Hook for handling API errors with automatic retry
 * Requirements: 3.5, 3.7
 */
export interface UseApiErrorHandlingOptions extends UseErrorHandlingOptions {
  /**
   * Maximum number of retries for retryable errors
   */
  maxRetries?: number;

  /**
   * Delay between retries in milliseconds
   */
  retryDelayMs?: number;
}

export interface UseApiErrorHandlingReturn extends UseErrorHandlingReturn {
  /**
   * Execute an async operation with error handling and retry
   */
  executeWithRetry: <T>(
    operation: () => Promise<T>,
    onSuccess?: (result: T) => void
  ) => Promise<T | null>;

  /**
   * Whether an operation is currently executing
   */
  isExecuting: boolean;

  /**
   * Current retry attempt number
   */
  retryAttempt: number;
}

/**
 * Hook for API error handling with automatic retry logic
 * Requirements: 3.5, 3.7
 */
export function useApiErrorHandling(
  options: UseApiErrorHandlingOptions = {}
): UseApiErrorHandlingReturn {
  const { maxRetries = 1, retryDelayMs = 500, ...errorOptions } = options;

  const errorHandling = useErrorHandling(errorOptions);
  const [isExecuting, setIsExecuting] = useState(false);
  const [retryAttempt, setRetryAttempt] = useState(0);

  /**
   * Execute operation with retry logic
   */
  const executeWithRetry = useCallback(
    async <T,>(
      operation: () => Promise<T>,
      onSuccess?: (result: T) => void
    ): Promise<T | null> => {
      setIsExecuting(true);
      setRetryAttempt(0);
      errorHandling.clearError();

      let attempt = 0;

      const attemptOperation = async (): Promise<T | null> => {
        try {
          const result = await operation();
          onSuccess?.(result);
          setIsExecuting(false);
          setRetryAttempt(0);
          return result;
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          
          // Try to extract error code from message
          let errorCode: ErrorCode | undefined;
          const codeMatch = errorMessage.match(/^([A-Z_]+):/);
          if (codeMatch) {
            errorCode = codeMatch[1] as ErrorCode;
          }

          // Check if we should retry
          if (errorCode && shouldRetry(errorCode) && attempt < maxRetries) {
            attempt++;
            setRetryAttempt(attempt);
            
            // Wait before retrying
            await new Promise(resolve => setTimeout(resolve, retryDelayMs));
            
            return attemptOperation();
          }

          // No retry - set error and return null
          errorHandling.setError(errorMessage, errorCode);
          setIsExecuting(false);
          setRetryAttempt(0);
          return null;
        }
      };

      return attemptOperation();
    },
    [maxRetries, retryDelayMs, errorHandling]
  );

  return {
    ...errorHandling,
    executeWithRetry,
    isExecuting,
    retryAttempt,
  };
}
