/**
 * Error Handling Utility Tests
 * Feature: qr-chain-attendance
 * Task: 20.2
 * Requirements: 3.5, 3.7, 9.3, 10.1, 10.2
 */

import {
  getUserFriendlyMessage,
  shouldRetry,
  isRateLimitError,
  isLocationViolation,
  getLocationViolationType,
  formatErrorForDisplay,
  RateLimitTracker,
  fetchWithErrorHandling,
  parseErrorResponse,
  ERROR_MESSAGES,
  RATE_LIMIT_COOLDOWN,
} from './errorHandling';
import type { ErrorCode, ErrorResponse } from '@qr-attendance/shared';

describe('Error Handling Utility', () => {
  describe('getUserFriendlyMessage', () => {
    test('should return user-friendly message for EXPIRED_TOKEN', () => {
      const message = getUserFriendlyMessage('EXPIRED_TOKEN');
      expect(message).toBe('This QR code has expired. Please scan a new one.');
    });

    test('should return user-friendly message for TOKEN_ALREADY_USED', () => {
      const message = getUserFriendlyMessage('TOKEN_ALREADY_USED');
      expect(message).toBe('This QR code has already been scanned.');
    });

    test('should return user-friendly message for RATE_LIMITED with cooldown info', () => {
      const message = getUserFriendlyMessage('RATE_LIMITED');
      expect(message).toContain('Too many attempts');
      expect(message).toContain('60 seconds');
    });

    test('should return user-friendly message for GEOFENCE_VIOLATION with guidance', () => {
      const message = getUserFriendlyMessage('GEOFENCE_VIOLATION');
      expect(message).toContain('physically present in the classroom');
      expect(message).toContain('GPS location');
    });

    test('should return user-friendly message for WIFI_VIOLATION with guidance', () => {
      const message = getUserFriendlyMessage('WIFI_VIOLATION');
      expect(message).toContain('classroom Wi-Fi network');
    });

    test('should return user-friendly message for LOCATION_VIOLATION with guidance', () => {
      const message = getUserFriendlyMessage('LOCATION_VIOLATION');
      expect(message).toContain('in the classroom');
      expect(message).toContain('Wi-Fi network');
    });

    test('should handle unknown error codes', () => {
      const message = getUserFriendlyMessage('UNKNOWN_CODE' as ErrorCode);
      expect(message).toContain('unexpected error');
    });
  });

  describe('shouldRetry', () => {
    test('should return true for EXPIRED_TOKEN', () => {
      expect(shouldRetry('EXPIRED_TOKEN')).toBe(true);
    });

    test('should return true for STORAGE_ERROR', () => {
      expect(shouldRetry('STORAGE_ERROR')).toBe(true);
    });

    test('should return false for TOKEN_ALREADY_USED', () => {
      expect(shouldRetry('TOKEN_ALREADY_USED')).toBe(false);
    });

    test('should return false for RATE_LIMITED', () => {
      expect(shouldRetry('RATE_LIMITED')).toBe(false);
    });

    test('should return false for LOCATION_VIOLATION', () => {
      expect(shouldRetry('LOCATION_VIOLATION')).toBe(false);
    });

    test('should return false for GEOFENCE_VIOLATION', () => {
      expect(shouldRetry('GEOFENCE_VIOLATION')).toBe(false);
    });

    test('should return false for WIFI_VIOLATION', () => {
      expect(shouldRetry('WIFI_VIOLATION')).toBe(false);
    });

    test('should return false for CONFLICT', () => {
      expect(shouldRetry('CONFLICT')).toBe(false);
    });
  });

  describe('isRateLimitError', () => {
    test('should return true for RATE_LIMITED', () => {
      expect(isRateLimitError('RATE_LIMITED')).toBe(true);
    });

    test('should return false for other errors', () => {
      expect(isRateLimitError('EXPIRED_TOKEN')).toBe(false);
      expect(isRateLimitError('TOKEN_ALREADY_USED')).toBe(false);
    });
  });

  describe('isLocationViolation', () => {
    test('should return true for LOCATION_VIOLATION', () => {
      expect(isLocationViolation('LOCATION_VIOLATION')).toBe(true);
    });

    test('should return true for GEOFENCE_VIOLATION', () => {
      expect(isLocationViolation('GEOFENCE_VIOLATION')).toBe(true);
    });

    test('should return true for WIFI_VIOLATION', () => {
      expect(isLocationViolation('WIFI_VIOLATION')).toBe(true);
    });

    test('should return false for other errors', () => {
      expect(isLocationViolation('EXPIRED_TOKEN')).toBe(false);
      expect(isLocationViolation('RATE_LIMITED')).toBe(false);
    });
  });

  describe('getLocationViolationType', () => {
    test('should return "geofence" for GEOFENCE_VIOLATION', () => {
      expect(getLocationViolationType('GEOFENCE_VIOLATION')).toBe('geofence');
    });

    test('should return "wifi" for WIFI_VIOLATION', () => {
      expect(getLocationViolationType('WIFI_VIOLATION')).toBe('wifi');
    });

    test('should return "general" for LOCATION_VIOLATION', () => {
      expect(getLocationViolationType('LOCATION_VIOLATION')).toBe('general');
    });

    test('should return "general" for other errors', () => {
      expect(getLocationViolationType('EXPIRED_TOKEN')).toBe('general');
    });
  });

  describe('formatErrorForDisplay', () => {
    test('should format EXPIRED_TOKEN as warning with retry', () => {
      const formatted = formatErrorForDisplay(new Error('Token expired'), 'EXPIRED_TOKEN');
      expect(formatted.title).toBe('QR Code Expired');
      expect(formatted.type).toBe('warning');
      expect(formatted.canRetry).toBe(true);
    });

    test('should format TOKEN_ALREADY_USED as info without retry', () => {
      const formatted = formatErrorForDisplay(new Error('Already used'), 'TOKEN_ALREADY_USED');
      expect(formatted.title).toBe('Already Scanned');
      expect(formatted.type).toBe('info');
      expect(formatted.canRetry).toBe(false);
    });

    test('should format RATE_LIMITED with cooldown message', () => {
      const formatted = formatErrorForDisplay(new Error('Rate limited'), 'RATE_LIMITED');
      expect(formatted.title).toBe('Too Many Attempts');
      expect(formatted.type).toBe('warning');
      expect(formatted.canRetry).toBe(false);
      expect(formatted.message).toContain('60 seconds');
    });

    test('should format location violations with guidance', () => {
      const formatted = formatErrorForDisplay(new Error('Location failed'), 'GEOFENCE_VIOLATION');
      expect(formatted.title).toBe('Location Verification Failed');
      expect(formatted.type).toBe('warning');
      expect(formatted.canRetry).toBe(false);
      expect(formatted.guidance).toBeDefined();
      expect(formatted.guidance).toContain('GPS location');
    });

    test('should format authentication errors', () => {
      const formatted = formatErrorForDisplay(new Error('Unauthorized'), 'UNAUTHORIZED');
      expect(formatted.title).toBe('Access Denied');
      expect(formatted.type).toBe('error');
      expect(formatted.canRetry).toBe(false);
    });

    test('should format session ended as info', () => {
      const formatted = formatErrorForDisplay(new Error('Session ended'), 'SESSION_ENDED');
      expect(formatted.title).toBe('Session Ended');
      expect(formatted.type).toBe('info');
      expect(formatted.canRetry).toBe(false);
    });

    test('should handle string errors', () => {
      const formatted = formatErrorForDisplay('Something went wrong');
      expect(formatted.message).toBe('Something went wrong');
      expect(formatted.type).toBe('error');
    });
  });

  describe('parseErrorResponse', () => {
    test('should parse error response correctly', () => {
      const errorResponse: ErrorResponse = {
        error: {
          code: 'EXPIRED_TOKEN',
          message: 'Token has expired',
          details: { tokenId: '123' },
          timestamp: 1234567890,
          requestId: 'req-123',
        },
      };

      const parsed = parseErrorResponse(errorResponse);
      expect(parsed.code).toBe('EXPIRED_TOKEN');
      expect(parsed.message).toBe('Token has expired');
      expect(parsed.details).toEqual({ tokenId: '123' });
      expect(parsed.timestamp).toBe(1234567890);
      expect(parsed.requestId).toBe('req-123');
    });
  });

  describe('RateLimitTracker', () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    test('should start cooldown', () => {
      const tracker = new RateLimitTracker();
      tracker.startCooldown(60);
      
      expect(tracker.isInCooldown()).toBe(true);
      expect(tracker.getRemainingSeconds()).toBe(60);
    });

    test('should count down remaining seconds', () => {
      const tracker = new RateLimitTracker();
      tracker.startCooldown(60);
      
      jest.advanceTimersByTime(30000); // 30 seconds
      expect(tracker.getRemainingSeconds()).toBeLessThanOrEqual(30);
    });

    test('should end cooldown after duration', () => {
      const tracker = new RateLimitTracker();
      const callback = jest.fn();
      tracker.onCooldownEnd(callback);
      
      tracker.startCooldown(60);
      expect(tracker.isInCooldown()).toBe(true);
      
      jest.advanceTimersByTime(60000); // 60 seconds
      expect(tracker.isInCooldown()).toBe(false);
      expect(tracker.getRemainingSeconds()).toBe(0);
      expect(callback).toHaveBeenCalled();
    });

    test('should clear cooldown manually', () => {
      const tracker = new RateLimitTracker();
      const callback = jest.fn();
      tracker.onCooldownEnd(callback);
      
      tracker.startCooldown(60);
      expect(tracker.isInCooldown()).toBe(true);
      
      tracker.clearCooldown();
      expect(tracker.isInCooldown()).toBe(false);
      expect(tracker.getRemainingSeconds()).toBe(0);
      expect(callback).toHaveBeenCalled();
    });

    test('should handle multiple callbacks', () => {
      const tracker = new RateLimitTracker();
      const callback1 = jest.fn();
      const callback2 = jest.fn();
      
      tracker.onCooldownEnd(callback1);
      tracker.onCooldownEnd(callback2);
      
      tracker.startCooldown(60);
      jest.advanceTimersByTime(60000);
      
      expect(callback1).toHaveBeenCalled();
      expect(callback2).toHaveBeenCalled();
    });
  });

  describe('fetchWithErrorHandling', () => {
    let mockFetch: jest.Mock;

    beforeEach(() => {
      mockFetch = jest.fn();
      global.fetch = mockFetch;
    });

    afterEach(() => {
      jest.restoreAllMocks();
    });

    test('should return data on successful response', async () => {
      const mockData = { success: true, data: 'test' };
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => mockData,
      });

      const result = await fetchWithErrorHandling('/api/test');
      expect(result).toEqual(mockData);
    });

    test('should throw user-friendly error on EXPIRED_TOKEN', async () => {
      const errorResponse: ErrorResponse = {
        error: {
          code: 'EXPIRED_TOKEN',
          message: 'Token expired',
          timestamp: Date.now(),
          requestId: 'req-123',
        },
      };

      mockFetch.mockResolvedValue({
        ok: false,
        json: async () => errorResponse,
      });

      await expect(fetchWithErrorHandling('/api/test', {}, { retryOnExpiration: false }))
        .rejects.toThrow('This QR code has expired');
    });

    test('should retry on EXPIRED_TOKEN when enabled', async () => {
      const errorResponse: ErrorResponse = {
        error: {
          code: 'EXPIRED_TOKEN',
          message: 'Token expired',
          timestamp: Date.now(),
          requestId: 'req-123',
        },
      };

      const successData = { success: true };

      // First call fails, second succeeds
      mockFetch
        .mockResolvedValueOnce({
          ok: false,
          json: async () => errorResponse,
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => successData,
        });

      const result = await fetchWithErrorHandling('/api/test', {}, { retryOnExpiration: true });
      expect(result).toEqual(successData);
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    test('should not retry on TOKEN_ALREADY_USED', async () => {
      const errorResponse: ErrorResponse = {
        error: {
          code: 'TOKEN_ALREADY_USED',
          message: 'Already used',
          timestamp: Date.now(),
          requestId: 'req-123',
        },
      };

      mockFetch.mockResolvedValue({
        ok: false,
        json: async () => errorResponse,
      });

      await expect(fetchWithErrorHandling('/api/test'))
        .rejects.toThrow('This QR code has already been scanned');
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    test('should call onRateLimit callback for RATE_LIMITED', async () => {
      const errorResponse: ErrorResponse = {
        error: {
          code: 'RATE_LIMITED',
          message: 'Rate limited',
          timestamp: Date.now(),
          requestId: 'req-123',
        },
      };

      mockFetch.mockResolvedValue({
        ok: false,
        json: async () => errorResponse,
      });

      const onRateLimit = jest.fn();

      await expect(fetchWithErrorHandling('/api/test', {}, { onRateLimit }))
        .rejects.toThrow();
      expect(onRateLimit).toHaveBeenCalledWith(RATE_LIMIT_COOLDOWN);
    });

    test('should call onLocationViolation callback for location errors', async () => {
      const errorResponse: ErrorResponse = {
        error: {
          code: 'GEOFENCE_VIOLATION',
          message: 'Outside geofence',
          timestamp: Date.now(),
          requestId: 'req-123',
        },
      };

      mockFetch.mockResolvedValue({
        ok: false,
        json: async () => errorResponse,
      });

      const onLocationViolation = jest.fn();

      await expect(fetchWithErrorHandling('/api/test', {}, { onLocationViolation }))
        .rejects.toThrow();
      expect(onLocationViolation).toHaveBeenCalledWith('geofence', expect.any(String));
    });

    test('should handle network errors', async () => {
      mockFetch.mockRejectedValue(new TypeError('Failed to fetch'));

      await expect(fetchWithErrorHandling('/api/test'))
        .rejects.toThrow('Network error');
    });

    test('should respect maxRetries limit', async () => {
      const errorResponse: ErrorResponse = {
        error: {
          code: 'EXPIRED_TOKEN',
          message: 'Token expired',
          timestamp: Date.now(),
          requestId: 'req-123',
        },
      };

      mockFetch.mockResolvedValue({
        ok: false,
        json: async () => errorResponse,
      });

      await expect(fetchWithErrorHandling('/api/test', {}, { 
        retryOnExpiration: true,
        maxRetries: 2 
      })).rejects.toThrow();
      
      // Initial attempt + 2 retries = 3 calls
      expect(mockFetch).toHaveBeenCalledTimes(3);
    });
  });

  describe('ERROR_MESSAGES', () => {
    test('should have messages for all error codes', () => {
      const errorCodes: ErrorCode[] = [
        'UNAUTHORIZED',
        'FORBIDDEN',
        'INVALID_REQUEST',
        'EXPIRED_TOKEN',
        'TOKEN_ALREADY_USED',
        'INVALID_STATE',
        'RATE_LIMITED',
        'LOCATION_VIOLATION',
        'GEOFENCE_VIOLATION',
        'WIFI_VIOLATION',
        'NOT_FOUND',
        'CONFLICT',
        'STORAGE_ERROR',
        'INELIGIBLE_STUDENT',
        'INSUFFICIENT_STUDENTS',
        'SESSION_ENDED',
      ];

      errorCodes.forEach(code => {
        expect(ERROR_MESSAGES[code]).toBeDefined();
        expect(ERROR_MESSAGES[code].length).toBeGreaterThan(0);
      });
    });
  });
});
