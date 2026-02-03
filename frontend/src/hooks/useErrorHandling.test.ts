/**
 * Error Handling Hook Tests
 * Feature: qr-chain-attendance
 * Task: 20.2
 * Requirements: 3.5, 3.7, 9.3, 10.1, 10.2
 */

import { renderHook, act, waitFor } from '@testing-library/react';
import { useErrorHandling, useApiErrorHandling } from './useErrorHandling';
import type { ErrorCode } from '@qr-attendance/shared';

describe('useErrorHandling', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  test('should initialize with no error', () => {
    const { result } = renderHook(() => useErrorHandling());
    
    expect(result.current.error).toBeNull();
    expect(result.current.errorCode).toBeNull();
    expect(result.current.isInCooldown).toBe(false);
    expect(result.current.cooldownSeconds).toBe(0);
  });

  test('should set error', () => {
    const { result } = renderHook(() => useErrorHandling());
    
    act(() => {
      result.current.setError('Test error', 'EXPIRED_TOKEN');
    });

    expect(result.current.error).not.toBeNull();
    expect(result.current.error?.message).toContain('expired');
    expect(result.current.errorCode).toBe('EXPIRED_TOKEN');
  });

  test('should clear error', () => {
    const { result } = renderHook(() => useErrorHandling());
    
    act(() => {
      result.current.setError('Test error', 'EXPIRED_TOKEN');
    });

    expect(result.current.error).not.toBeNull();

    act(() => {
      result.current.clearError();
    });

    expect(result.current.error).toBeNull();
    expect(result.current.errorCode).toBeNull();
  });

  test('should call onError callback', () => {
    const onError = jest.fn();
    const { result } = renderHook(() => useErrorHandling({ onError }));
    
    act(() => {
      result.current.setError('Test error', 'EXPIRED_TOKEN');
    });

    expect(onError).toHaveBeenCalledWith(expect.objectContaining({
      message: expect.any(String),
      type: expect.any(String),
    }));
  });

  test('should auto-clear error after specified time', () => {
    const { result } = renderHook(() => useErrorHandling({ autoClearMs: 3000 }));
    
    act(() => {
      result.current.setError('Test error', 'EXPIRED_TOKEN');
    });

    expect(result.current.error).not.toBeNull();

    act(() => {
      jest.advanceTimersByTime(3000);
    });

    expect(result.current.error).toBeNull();
  });

  test('should start cooldown for rate limit errors', () => {
    const { result } = renderHook(() => useErrorHandling());
    
    act(() => {
      result.current.setError('Rate limited', 'RATE_LIMITED');
    });

    expect(result.current.isInCooldown).toBe(true);
    expect(result.current.cooldownSeconds).toBe(60);
  });

  test('should count down cooldown seconds', () => {
    const { result } = renderHook(() => useErrorHandling());
    
    act(() => {
      result.current.startCooldown(60);
    });

    expect(result.current.cooldownSeconds).toBe(60);

    act(() => {
      jest.advanceTimersByTime(1000);
    });

    expect(result.current.cooldownSeconds).toBe(59);

    act(() => {
      jest.advanceTimersByTime(29000);
    });

    expect(result.current.cooldownSeconds).toBe(30);
  });

  test('should end cooldown after duration', () => {
    const onCooldownEnd = jest.fn();
    const { result } = renderHook(() => useErrorHandling({ onCooldownEnd }));
    
    act(() => {
      result.current.startCooldown(60);
    });

    expect(result.current.isInCooldown).toBe(true);

    act(() => {
      jest.advanceTimersByTime(60000);
    });

    expect(result.current.isInCooldown).toBe(false);
    expect(result.current.cooldownSeconds).toBe(0);
    expect(onCooldownEnd).toHaveBeenCalled();
  });

  test('should indicate if error can be retried', () => {
    const { result } = renderHook(() => useErrorHandling());
    
    // Retryable error
    act(() => {
      result.current.setError('Token expired', 'EXPIRED_TOKEN');
    });
    expect(result.current.canRetry).toBe(true);

    // Non-retryable error
    act(() => {
      result.current.setError('Already used', 'TOKEN_ALREADY_USED');
    });
    expect(result.current.canRetry).toBe(false);
  });

  test('should format different error types correctly', () => {
    const { result } = renderHook(() => useErrorHandling());
    
    // Warning type
    act(() => {
      result.current.setError('Token expired', 'EXPIRED_TOKEN');
    });
    expect(result.current.error?.type).toBe('warning');

    // Info type
    act(() => {
      result.current.setError('Already scanned', 'TOKEN_ALREADY_USED');
    });
    expect(result.current.error?.type).toBe('info');

    // Error type
    act(() => {
      result.current.setError('Unauthorized', 'UNAUTHORIZED');
    });
    expect(result.current.error?.type).toBe('error');
  });
});

describe('useApiErrorHandling', () => {
  test('should execute operation successfully', async () => {
    const { result } = renderHook(() => useApiErrorHandling());
    const mockOperation = jest.fn().mockResolvedValue({ success: true });
    const onSuccess = jest.fn();

    let returnValue: any;
    await act(async () => {
      returnValue = await result.current.executeWithRetry(mockOperation, onSuccess);
    });

    expect(returnValue).toEqual({ success: true });
    expect(onSuccess).toHaveBeenCalledWith({ success: true });
    expect(result.current.error).toBeNull();
    expect(result.current.isExecuting).toBe(false);
  });

  test('should set error on operation failure', async () => {
    const { result } = renderHook(() => useApiErrorHandling());
    const mockOperation = jest.fn().mockRejectedValue(new Error('Operation failed'));

    let returnValue: any;
    await act(async () => {
      returnValue = await result.current.executeWithRetry(mockOperation);
    });

    expect(returnValue).toBeNull();
    expect(result.current.error).not.toBeNull();
    expect(result.current.isExecuting).toBe(false);
  });

  test('should not retry on non-retryable errors', async () => {
    const { result } = renderHook(() => useApiErrorHandling({ maxRetries: 2 }));
    const mockOperation = jest.fn()
      .mockRejectedValue(new Error('TOKEN_ALREADY_USED: Already scanned'));

    let returnValue: any = undefined;
    
    await act(async () => {
      try {
        returnValue = await result.current.executeWithRetry(mockOperation);
      } catch (e) {
        // Expected to fail
      }
    });

    expect(returnValue).toBeNull();
    expect(mockOperation).toHaveBeenCalledTimes(1);
    expect(result.current.error).not.toBeNull();
  });

  test('should set isExecuting during operation', async () => {
    const { result } = renderHook(() => useApiErrorHandling());
    const mockOperation = jest.fn().mockResolvedValue({ success: true });

    await act(async () => {
      await result.current.executeWithRetry(mockOperation);
    });

    // After completion, should not be executing
    expect(result.current.isExecuting).toBe(false);
  });

  test('should clear error before new operation', async () => {
    const { result } = renderHook(() => useApiErrorHandling());
    
    // First operation fails
    const failOperation = jest.fn().mockRejectedValue(new Error('Failed'));
    await act(async () => {
      const res = await result.current.executeWithRetry(failOperation);
      expect(res).toBeNull();
    });
    
    // Should have error after failure
    await waitFor(() => {
      expect(result.current.error).not.toBeNull();
    });

    // Second operation succeeds
    const successOperation = jest.fn().mockResolvedValue({ success: true });
    await act(async () => {
      await result.current.executeWithRetry(successOperation);
    });
    
    // Error should be cleared
    expect(result.current.error).toBeNull();
  });
});
