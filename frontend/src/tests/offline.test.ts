/**
 * Offline Handling Tests
 * Feature: qr-chain-attendance
 * Requirement: 20.5 - Offline message display and handling
 * 
 * Tests for offline detection, messaging, and operation queuing.
 */

import { renderHook, act } from '@testing-library/react';
import { useOnlineStatus, useOnlineStatusCallback } from '../hooks/useOnlineStatus';
import { OfflineQueue, fetchWithOfflineQueue } from '../utils/offlineQueue';

describe('Offline Handling', () => {
  describe('useOnlineStatus Hook', () => {
    let originalNavigator: Navigator;

    beforeEach(() => {
      originalNavigator = global.navigator;
    });

    afterEach(() => {
      global.navigator = originalNavigator;
    });

    test('should initialize with navigator.onLine status', () => {
      Object.defineProperty(global.navigator, 'onLine', {
        writable: true,
        value: true,
      });

      const { result } = renderHook(() => useOnlineStatus());
      expect(result.current.isOnline).toBe(true);
      expect(result.current.wasOffline).toBe(false);
    });

    test('should detect offline status', () => {
      Object.defineProperty(global.navigator, 'onLine', {
        writable: true,
        value: false,
      });

      const { result } = renderHook(() => useOnlineStatus());
      expect(result.current.isOnline).toBe(false);
    });

    test('should update status when online event fires', () => {
      Object.defineProperty(global.navigator, 'onLine', {
        writable: true,
        value: false,
      });

      const { result } = renderHook(() => useOnlineStatus());
      expect(result.current.isOnline).toBe(false);

      // Simulate online event
      act(() => {
        Object.defineProperty(global.navigator, 'onLine', {
          writable: true,
          value: true,
        });
        window.dispatchEvent(new Event('online'));
      });

      expect(result.current.isOnline).toBe(true);
    });

    test('should update status when offline event fires', () => {
      Object.defineProperty(global.navigator, 'onLine', {
        writable: true,
        value: true,
      });

      const { result } = renderHook(() => useOnlineStatus());
      expect(result.current.isOnline).toBe(true);

      // Simulate offline event
      act(() => {
        Object.defineProperty(global.navigator, 'onLine', {
          writable: true,
          value: false,
        });
        window.dispatchEvent(new Event('offline'));
      });

      expect(result.current.isOnline).toBe(false);
      expect(result.current.wasOffline).toBe(true);
    });

    test('should track wasOffline flag', () => {
      Object.defineProperty(global.navigator, 'onLine', {
        writable: true,
        value: true,
      });

      const { result } = renderHook(() => useOnlineStatus());
      expect(result.current.wasOffline).toBe(false);

      // Go offline
      act(() => {
        Object.defineProperty(global.navigator, 'onLine', {
          writable: true,
          value: false,
        });
        window.dispatchEvent(new Event('offline'));
      });

      expect(result.current.wasOffline).toBe(true);

      // Go back online
      act(() => {
        Object.defineProperty(global.navigator, 'onLine', {
          writable: true,
          value: true,
        });
        window.dispatchEvent(new Event('online'));
      });

      // wasOffline should still be true
      expect(result.current.wasOffline).toBe(true);
    });
  });

  describe('useOnlineStatusCallback Hook', () => {
    test('should call callback when status changes', () => {
      Object.defineProperty(global.navigator, 'onLine', {
        writable: true,
        value: true,
      });

      const callback = jest.fn();
      renderHook(() => useOnlineStatusCallback(callback));

      expect(callback).toHaveBeenCalledWith(true);

      // Simulate offline event
      act(() => {
        Object.defineProperty(global.navigator, 'onLine', {
          writable: true,
          value: false,
        });
        window.dispatchEvent(new Event('offline'));
      });

      expect(callback).toHaveBeenCalledWith(false);
    });
  });

  describe('OfflineQueue', () => {
    let queue: OfflineQueue;

    beforeEach(() => {
      queue = new OfflineQueue({
        maxRetries: 3,
        retryDelay: 100,
      });
    });

    afterEach(() => {
      queue.clear();
    });

    test('should add operations to queue', () => {
      const operation = jest.fn().mockResolvedValue('success');
      const id = queue.add(operation, 'test operation');

      expect(queue.size()).toBe(1);
      expect(id).toMatch(/^op_/);
    });

    test('should remove operations from queue', () => {
      const operation = jest.fn().mockResolvedValue('success');
      const id = queue.add(operation);

      expect(queue.size()).toBe(1);
      queue.remove(id);
      expect(queue.size()).toBe(0);
    });

    test('should retry successful operations and remove from queue', async () => {
      const operation = jest.fn().mockResolvedValue('success');
      const onSuccess = jest.fn();
      
      const testQueue = new OfflineQueue({
        maxRetries: 3,
        onSuccess,
      });

      const id = testQueue.add(operation);
      await testQueue.retry(id);

      expect(operation).toHaveBeenCalledTimes(1);
      expect(onSuccess).toHaveBeenCalledWith(id, 'success');
      expect(testQueue.size()).toBe(0);
    });

    test('should retry failed operations up to maxRetries', async () => {
      const operation = jest.fn().mockRejectedValue(new Error('Network error'));
      const onError = jest.fn();
      
      const testQueue = new OfflineQueue({
        maxRetries: 2,
        onError,
      });

      const id = testQueue.add(operation);

      // First retry
      await testQueue.retry(id);
      expect(operation).toHaveBeenCalledTimes(1);
      expect(testQueue.size()).toBe(1);

      // Second retry
      await testQueue.retry(id);
      expect(operation).toHaveBeenCalledTimes(2);
      expect(testQueue.size()).toBe(0); // Removed after max retries
      expect(onError).toHaveBeenCalledWith(id, expect.any(Error));
    });

    test('should retry all queued operations', async () => {
      const op1 = jest.fn().mockResolvedValue('success1');
      const op2 = jest.fn().mockResolvedValue('success2');
      const op3 = jest.fn().mockResolvedValue('success3');

      queue.add(op1, 'operation 1');
      queue.add(op2, 'operation 2');
      queue.add(op3, 'operation 3');

      expect(queue.size()).toBe(3);

      await queue.retryAll();

      expect(op1).toHaveBeenCalledTimes(1);
      expect(op2).toHaveBeenCalledTimes(1);
      expect(op3).toHaveBeenCalledTimes(1);
      expect(queue.size()).toBe(0);
    });

    test('should call onRetry callback', async () => {
      const operation = jest.fn().mockRejectedValue(new Error('Network error'));
      const onRetry = jest.fn();
      
      const testQueue = new OfflineQueue({
        maxRetries: 3,
        onRetry,
      });

      const id = testQueue.add(operation);
      await testQueue.retry(id);

      expect(onRetry).toHaveBeenCalledWith(id, 1);
    });

    test('should clear all operations', () => {
      queue.add(jest.fn(), 'op1');
      queue.add(jest.fn(), 'op2');
      queue.add(jest.fn(), 'op3');

      expect(queue.size()).toBe(3);
      queue.clear();
      expect(queue.size()).toBe(0);
    });

    test('should get all queued operations', () => {
      const op1 = jest.fn();
      const op2 = jest.fn();

      queue.add(op1, 'operation 1');
      queue.add(op2, 'operation 2');

      const operations = queue.getAll();
      expect(operations).toHaveLength(2);
      expect(operations[0].description).toBe('operation 1');
      expect(operations[1].description).toBe('operation 2');
    });
  });

  describe('fetchWithOfflineQueue', () => {
    let mockFetch: jest.Mock;
    let queue: OfflineQueue;

    beforeEach(() => {
      mockFetch = jest.fn();
      global.fetch = mockFetch;
      queue = new OfflineQueue();
    });

    afterEach(() => {
      queue.clear();
    });

    test('should return response on successful fetch', async () => {
      const mockResponse = {
        status: 200,
        statusText: 'OK',
        ok: true,
      };
      mockFetch.mockResolvedValue(mockResponse);

      const response = await fetchWithOfflineQueue('/api/test', {}, { queue });
      expect(response).toBe(mockResponse);
      expect(queue.size()).toBe(0);
    });

    test('should queue operation on network error', async () => {
      mockFetch.mockRejectedValue(new TypeError('Failed to fetch'));

      await expect(
        fetchWithOfflineQueue('/api/test', {}, { queue, autoQueue: true })
      ).rejects.toThrow();

      expect(queue.size()).toBe(1);
    });

    test('should queue operation on 503 Service Unavailable', async () => {
      const mockResponse = {
        status: 503,
        statusText: 'Service Unavailable',
        ok: false,
      };
      mockFetch.mockResolvedValue(mockResponse);

      await expect(
        fetchWithOfflineQueue('/api/test', {}, { queue, autoQueue: true })
      ).rejects.toThrow('Network unavailable');

      expect(queue.size()).toBe(1);
    });

    test('should not queue operation when autoQueue is false', async () => {
      mockFetch.mockRejectedValue(new TypeError('Failed to fetch'));

      await expect(
        fetchWithOfflineQueue('/api/test', {}, { queue, autoQueue: false })
      ).rejects.toThrow();

      expect(queue.size()).toBe(0);
    });

    test('should include description in queued operation', async () => {
      mockFetch.mockRejectedValue(new TypeError('Failed to fetch'));

      await expect(
        fetchWithOfflineQueue(
          '/api/test',
          {},
          { queue, description: 'Test operation' }
        )
      ).rejects.toThrow();

      const operations = queue.getAll();
      expect(operations[0].description).toBe('Test operation');
    });
  });

  describe('Offline Handling Integration', () => {
    test('should handle complete offline-to-online flow', async () => {
      // Setup
      const queue = new OfflineQueue({ maxRetries: 3 });
      const mockFetch = jest.fn();
      global.fetch = mockFetch;

      // Simulate offline - fetch fails
      mockFetch.mockRejectedValueOnce(new TypeError('Failed to fetch'));

      // Try to make request while offline
      await expect(
        fetchWithOfflineQueue('/api/scan', {}, { queue })
      ).rejects.toThrow();

      // Operation should be queued
      expect(queue.size()).toBe(1);

      // Simulate connection restored - fetch succeeds
      mockFetch.mockResolvedValueOnce({
        status: 200,
        statusText: 'OK',
        ok: true,
      });

      // Retry queued operations
      await queue.retryAll();

      // Queue should be empty after successful retry
      expect(queue.size()).toBe(0);
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });
  });
});
