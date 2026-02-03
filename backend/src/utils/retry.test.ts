/**
 * Retry Logic Tests
 * Feature: qr-chain-attendance
 * Task: 20.3
 * Requirements: Storage error handling
 */

import { RestError } from "@azure/data-tables";
import {
  withRetry,
  isRetryableError,
  calculateBackoffDelay,
  makeRetryable,
  withRetryBatch,
  withRetryStats,
  RetryOptions,
} from "./retry";
import {
  AppError,
  ErrorCode,
  TokenAlreadyUsedError,
  RateLimitedError,
  StorageError,
  ConflictError,
} from "../middleware/errors";

describe("Retry Logic", () => {
  describe("isRetryableError", () => {
    test("should NOT retry ETag conflicts (TOKEN_ALREADY_USED)", () => {
      const error = new TokenAlreadyUsedError();
      expect(isRetryableError(error)).toBe(false);
    });

    test("should NOT retry CONFLICT errors", () => {
      const error = new ConflictError();
      expect(isRetryableError(error)).toBe(false);
    });

    test("should NOT retry RATE_LIMITED errors", () => {
      const error = new RateLimitedError();
      expect(isRetryableError(error)).toBe(false);
    });

    test("should retry STORAGE_ERROR", () => {
      const error = new StorageError();
      expect(isRetryableError(error)).toBe(true);
    });

    test("should retry Azure RestError with ServerBusy code", () => {
      const error = new RestError("Server busy", {
        code: "ServerBusy",
        statusCode: 503,
      });
      expect(isRetryableError(error)).toBe(true);
    });

    test("should retry Azure RestError with InternalError code", () => {
      const error = new RestError("Internal error", {
        code: "InternalError",
        statusCode: 500,
      });
      expect(isRetryableError(error)).toBe(true);
    });

    test("should retry Azure RestError with OperationTimedOut code", () => {
      const error = new RestError("Operation timed out", {
        code: "OperationTimedOut",
        statusCode: 500,
      });
      expect(isRetryableError(error)).toBe(true);
    });

    test("should retry Azure RestError with 500 status code", () => {
      const error = new RestError("Internal server error", {
        statusCode: 500,
      });
      expect(isRetryableError(error)).toBe(true);
    });

    test("should retry Azure RestError with 502 status code", () => {
      const error = new RestError("Bad gateway", {
        statusCode: 502,
      });
      expect(isRetryableError(error)).toBe(true);
    });

    test("should retry Azure RestError with 503 status code", () => {
      const error = new RestError("Service unavailable", {
        statusCode: 503,
      });
      expect(isRetryableError(error)).toBe(true);
    });

    test("should retry Azure RestError with 504 status code", () => {
      const error = new RestError("Gateway timeout", {
        statusCode: 504,
      });
      expect(isRetryableError(error)).toBe(true);
    });

    test("should NOT retry Azure RestError with 404 status code", () => {
      const error = new RestError("Not found", {
        statusCode: 404,
      });
      expect(isRetryableError(error)).toBe(false);
    });

    test("should NOT retry Azure RestError with 400 status code", () => {
      const error = new RestError("Bad request", {
        statusCode: 400,
      });
      expect(isRetryableError(error)).toBe(false);
    });

    test("should retry network errors (TypeError from fetch)", () => {
      const error = new TypeError("fetch failed");
      expect(isRetryableError(error)).toBe(true);
    });

    test("should retry ECONNRESET errors", () => {
      const error = Object.assign(new Error("Connection reset"), {
        code: "ECONNRESET",
      });
      expect(isRetryableError(error)).toBe(true);
    });

    test("should retry ETIMEDOUT errors", () => {
      const error = Object.assign(new Error("Connection timed out"), {
        code: "ETIMEDOUT",
      });
      expect(isRetryableError(error)).toBe(true);
    });

    test("should NOT retry unknown errors by default", () => {
      const error = new Error("Unknown error");
      expect(isRetryableError(error)).toBe(false);
    });
  });

  describe("calculateBackoffDelay", () => {
    test("should calculate exponential backoff correctly", () => {
      const options = {
        maxRetries: 3,
        initialDelayMs: 100,
        maxDelayMs: 10000,
        backoffMultiplier: 2,
        useJitter: false,
      };

      // Attempt 0: 100ms
      expect(calculateBackoffDelay(0, options)).toBe(100);

      // Attempt 1: 200ms
      expect(calculateBackoffDelay(1, options)).toBe(200);

      // Attempt 2: 400ms
      expect(calculateBackoffDelay(2, options)).toBe(400);

      // Attempt 3: 800ms
      expect(calculateBackoffDelay(3, options)).toBe(800);
    });

    test("should cap delay at maxDelayMs", () => {
      const options = {
        maxRetries: 3,
        initialDelayMs: 100,
        maxDelayMs: 500,
        backoffMultiplier: 2,
        useJitter: false,
      };

      // Attempt 10 would be 102400ms, but should cap at 500ms
      expect(calculateBackoffDelay(10, options)).toBe(500);
    });

    test("should add jitter when enabled", () => {
      const options = {
        maxRetries: 3,
        initialDelayMs: 100,
        maxDelayMs: 10000,
        backoffMultiplier: 2,
        useJitter: true,
      };

      const delay1 = calculateBackoffDelay(2, options);
      const delay2 = calculateBackoffDelay(2, options);

      // Base delay is 400ms, jitter adds 0-25% (0-100ms)
      expect(delay1).toBeGreaterThanOrEqual(400);
      expect(delay1).toBeLessThanOrEqual(500);

      // Two calls should likely produce different values (not guaranteed but very likely)
      // We'll just check they're in valid range
      expect(delay2).toBeGreaterThanOrEqual(400);
      expect(delay2).toBeLessThanOrEqual(500);
    });
  });

  describe("withRetry", () => {
    test("should succeed on first attempt without retry", async () => {
      const operation = jest.fn().mockResolvedValue("success");

      const result = await withRetry(operation);

      expect(result).toBe("success");
      expect(operation).toHaveBeenCalledTimes(1);
    });

    test("should retry transient errors and eventually succeed", async () => {
      const operation = jest
        .fn()
        .mockRejectedValueOnce(new StorageError("Transient error"))
        .mockResolvedValue("success");

      const result = await withRetry(operation, {
        maxRetries: 3,
        initialDelayMs: 10,
      });

      expect(result).toBe("success");
      expect(operation).toHaveBeenCalledTimes(2);
    });

    test("should NOT retry non-retryable errors", async () => {
      const operation = jest
        .fn()
        .mockRejectedValue(new TokenAlreadyUsedError());

      await expect(
        withRetry(operation, { maxRetries: 3 })
      ).rejects.toThrow(TokenAlreadyUsedError);

      expect(operation).toHaveBeenCalledTimes(1);
    });

    test("should exhaust retries and throw last error", async () => {
      const error = new StorageError("Persistent error");
      const operation = jest.fn().mockRejectedValue(error);

      await expect(
        withRetry(operation, {
          maxRetries: 2,
          initialDelayMs: 10,
        })
      ).rejects.toThrow(StorageError);

      // Initial attempt + 2 retries = 3 total
      expect(operation).toHaveBeenCalledTimes(3);
    });

    test("should call onRetry callback before each retry", async () => {
      const onRetry = jest.fn();
      const operation = jest
        .fn()
        .mockRejectedValueOnce(new StorageError("Error 1"))
        .mockRejectedValueOnce(new StorageError("Error 2"))
        .mockResolvedValue("success");

      await withRetry(operation, {
        maxRetries: 3,
        initialDelayMs: 10,
        onRetry,
      });

      expect(onRetry).toHaveBeenCalledTimes(2);
      expect(onRetry).toHaveBeenNthCalledWith(
        1,
        expect.any(StorageError),
        1,
        expect.any(Number)
      );
      expect(onRetry).toHaveBeenNthCalledWith(
        2,
        expect.any(StorageError),
        2,
        expect.any(Number)
      );
    });

    test("should use custom shouldRetry function", async () => {
      const shouldRetry = jest.fn().mockReturnValue(false);
      const operation = jest.fn().mockRejectedValue(new Error("Custom error"));

      await expect(
        withRetry(operation, {
          maxRetries: 3,
          shouldRetry,
        })
      ).rejects.toThrow("Custom error");

      expect(operation).toHaveBeenCalledTimes(1);
      expect(shouldRetry).toHaveBeenCalledWith(expect.any(Error), 0);
    });

    test("should respect maxRetries configuration", async () => {
      const operation = jest.fn().mockRejectedValue(new StorageError());

      await expect(
        withRetry(operation, {
          maxRetries: 1,
          initialDelayMs: 10,
        })
      ).rejects.toThrow(StorageError);

      // Initial attempt + 1 retry = 2 total
      expect(operation).toHaveBeenCalledTimes(2);
    });

    test("should handle Azure RestError with transient status code", async () => {
      const operation = jest
        .fn()
        .mockRejectedValueOnce(
          new RestError("Service unavailable", { statusCode: 503 })
        )
        .mockResolvedValue("success");

      const result = await withRetry(operation, {
        maxRetries: 3,
        initialDelayMs: 10,
      });

      expect(result).toBe("success");
      expect(operation).toHaveBeenCalledTimes(2);
    });

    test("should handle network errors (TypeError)", async () => {
      const operation = jest
        .fn()
        .mockRejectedValueOnce(new TypeError("fetch failed"))
        .mockResolvedValue("success");

      const result = await withRetry(operation, {
        maxRetries: 3,
        initialDelayMs: 10,
      });

      expect(result).toBe("success");
      expect(operation).toHaveBeenCalledTimes(2);
    });
  });

  describe("makeRetryable", () => {
    test("should create retryable version of function", async () => {
      const originalFn = jest
        .fn()
        .mockRejectedValueOnce(new StorageError())
        .mockResolvedValue("success");

      const retryableFn = makeRetryable(originalFn, {
        maxRetries: 3,
        initialDelayMs: 10,
      });

      const result = await retryableFn();

      expect(result).toBe("success");
      expect(originalFn).toHaveBeenCalledTimes(2);
    });

    test("should preserve function arguments", async () => {
      const originalFn = jest.fn().mockResolvedValue("success");

      const retryableFn = makeRetryable(originalFn);

      await retryableFn("arg1", "arg2", 123);

      expect(originalFn).toHaveBeenCalledWith("arg1", "arg2", 123);
    });
  });

  describe("withRetryBatch", () => {
    test("should retry all operations independently", async () => {
      const op1 = jest
        .fn()
        .mockRejectedValueOnce(new StorageError())
        .mockResolvedValue("result1");

      const op2 = jest.fn().mockResolvedValue("result2");

      const op3 = jest
        .fn()
        .mockRejectedValueOnce(new StorageError())
        .mockResolvedValue("result3");

      const results = await withRetryBatch([op1, op2, op3], {
        maxRetries: 3,
        initialDelayMs: 10,
      });

      expect(results).toEqual(["result1", "result2", "result3"]);
      expect(op1).toHaveBeenCalledTimes(2);
      expect(op2).toHaveBeenCalledTimes(1);
      expect(op3).toHaveBeenCalledTimes(2);
    });

    test("should fail if any operation exhausts retries", async () => {
      const op1 = jest.fn().mockResolvedValue("result1");
      const op2 = jest.fn().mockRejectedValue(new StorageError());

      await expect(
        withRetryBatch([op1, op2], {
          maxRetries: 2,
          initialDelayMs: 10,
        })
      ).rejects.toThrow(StorageError);
    });
  });

  describe("withRetryStats", () => {
    test("should collect statistics for successful operation", async () => {
      const operation = jest.fn().mockResolvedValue("success");

      const [result, stats] = await withRetryStats(operation);

      expect(result).toBe("success");
      expect(stats.totalAttempts).toBe(1);
      expect(stats.successfulRetries).toBe(0);
      expect(stats.failedRetries).toBe(0);
      expect(stats.totalDelayMs).toBe(0);
    });

    test("should collect statistics for operation with retries", async () => {
      const operation = jest
        .fn()
        .mockRejectedValueOnce(new StorageError())
        .mockRejectedValueOnce(new StorageError())
        .mockResolvedValue("success");

      const [result, stats] = await withRetryStats(operation, {
        maxRetries: 3,
        initialDelayMs: 10,
        useJitter: false,
      });

      expect(result).toBe("success");
      expect(stats.totalAttempts).toBe(3);
      expect(stats.successfulRetries).toBe(1);
      expect(stats.failedRetries).toBe(0);
      // Delay: 10ms (attempt 1) + 20ms (attempt 2) = 30ms
      expect(stats.totalDelayMs).toBe(30);
    });

    test("should collect statistics for failed operation", async () => {
      const operation = jest.fn().mockRejectedValue(new StorageError());

      await expect(
        withRetryStats(operation, {
          maxRetries: 2,
          initialDelayMs: 10,
          useJitter: false,
        })
      ).rejects.toThrow(StorageError);

      // Can't check stats since it throws, but we can verify the operation was called
      expect(operation).toHaveBeenCalledTimes(3);
    });
  });

  describe("Edge Cases", () => {
    test("should handle zero maxRetries", async () => {
      const operation = jest.fn().mockRejectedValue(new StorageError());

      await expect(
        withRetry(operation, { maxRetries: 0 })
      ).rejects.toThrow(StorageError);

      expect(operation).toHaveBeenCalledTimes(1);
    });

    test("should handle very large backoff multiplier", async () => {
      const options = {
        maxRetries: 3,
        initialDelayMs: 100,
        maxDelayMs: 1000,
        backoffMultiplier: 10,
        useJitter: false,
      };

      // Attempt 2: 100 * 10^2 = 10000ms, capped at 1000ms
      expect(calculateBackoffDelay(2, options)).toBe(1000);
    });

    test("should handle operation that throws non-Error object", async () => {
      const operation = jest.fn().mockRejectedValue("string error");

      await expect(
        withRetry(operation, { maxRetries: 1 })
      ).rejects.toBe("string error");

      expect(operation).toHaveBeenCalledTimes(1);
    });

    test("should handle synchronous errors in operation", async () => {
      const operation = jest.fn().mockImplementation(() => {
        throw new StorageError("Sync error");
      });

      await expect(
        withRetry(operation, {
          maxRetries: 2,
          initialDelayMs: 10,
        })
      ).rejects.toThrow(StorageError);

      expect(operation).toHaveBeenCalledTimes(3);
    });
  });

  describe("Real-world Scenarios", () => {
    test("should handle intermittent network failures", async () => {
      let callCount = 0;
      const operation = jest.fn().mockImplementation(async () => {
        callCount++;
        if (callCount <= 2) {
          throw new TypeError("fetch failed");
        }
        return "success";
      });

      const result = await withRetry(operation, {
        maxRetries: 3,
        initialDelayMs: 10,
      });

      expect(result).toBe("success");
      expect(operation).toHaveBeenCalledTimes(3);
    });

    test("should handle Azure Table Storage throttling", async () => {
      const operation = jest
        .fn()
        .mockRejectedValueOnce(
          new RestError("Server busy", {
            code: "ServerBusy",
            statusCode: 503,
          })
        )
        .mockResolvedValue("success");

      const result = await withRetry(operation, {
        maxRetries: 3,
        initialDelayMs: 100,
      });

      expect(result).toBe("success");
      expect(operation).toHaveBeenCalledTimes(2);
    });

    test("should NOT retry ETag conflicts in concurrent scenarios", async () => {
      const operation = jest.fn().mockRejectedValue(
        new TokenAlreadyUsedError("Token consumed by another request")
      );

      await expect(
        withRetry(operation, { maxRetries: 3 })
      ).rejects.toThrow(TokenAlreadyUsedError);

      // Should fail immediately without retry
      expect(operation).toHaveBeenCalledTimes(1);
    });

    test("should handle mixed error types correctly", async () => {
      const operation = jest
        .fn()
        .mockRejectedValueOnce(new StorageError("Transient")) // Retry
        .mockRejectedValueOnce(new RateLimitedError()) // Don't retry
        .mockResolvedValue("success");

      await expect(
        withRetry(operation, {
          maxRetries: 3,
          initialDelayMs: 10,
        })
      ).rejects.toThrow(RateLimitedError);

      // First attempt + 1 retry (then rate limited) = 2 calls
      expect(operation).toHaveBeenCalledTimes(2);
    });
  });
});
