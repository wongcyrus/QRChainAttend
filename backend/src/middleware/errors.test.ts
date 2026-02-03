/**
 * Error Handling Middleware Tests
 * Feature: qr-chain-attendance
 * Task: 20.1
 * 
 * Tests for error handling middleware including:
 * - Error class instantiation
 * - Error response formatting
 * - Error logging
 * - Error handler wrapper
 */

import { InvocationContext } from '@azure/functions';
import {
  AppError,
  AuthenticationError,
  AuthorizationError,
  ValidationError,
  TokenExpiredError,
  TokenAlreadyUsedError,
  InvalidStateError,
  RateLimitedError,
  LocationViolationError,
  GeofenceViolationError,
  WiFiViolationError,
  NotFoundError,
  ConflictError,
  StorageError,
  IneligibleStudentError,
  InsufficientStudentsError,
  SessionEndedError,
  InternalError,
  ErrorCode,
  ErrorCategory,
  formatErrorResponse,
  logError,
  withErrorHandling,
  convertErrorString
} from './errors';

describe('Error Classes', () => {
  describe('AppError', () => {
    it('should create an AppError with all properties', () => {
      const error = new AppError(
        ErrorCode.INVALID_REQUEST,
        ErrorCategory.VALIDATION,
        'Test error',
        400,
        { field: 'test' },
        true
      );

      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(AppError);
      expect(error.code).toBe(ErrorCode.INVALID_REQUEST);
      expect(error.category).toBe(ErrorCategory.VALIDATION);
      expect(error.message).toBe('Test error');
      expect(error.statusCode).toBe(400);
      expect(error.details).toEqual({ field: 'test' });
      expect(error.isOperational).toBe(true);
    });

    it('should default isOperational to true', () => {
      const error = new AppError(
        ErrorCode.INVALID_REQUEST,
        ErrorCategory.VALIDATION,
        'Test error',
        400
      );

      expect(error.isOperational).toBe(true);
    });
  });

  describe('AuthenticationError', () => {
    it('should create an authentication error with default message', () => {
      const error = new AuthenticationError();

      expect(error.code).toBe(ErrorCode.UNAUTHORIZED);
      expect(error.category).toBe(ErrorCategory.AUTHENTICATION);
      expect(error.message).toBe('Authentication failed');
      expect(error.statusCode).toBe(401);
      expect(error.isOperational).toBe(true);
    });

    it('should create an authentication error with custom message', () => {
      const error = new AuthenticationError('Missing token', { header: 'x-ms-client-principal' });

      expect(error.message).toBe('Missing token');
      expect(error.details).toEqual({ header: 'x-ms-client-principal' });
    });
  });

  describe('AuthorizationError', () => {
    it('should create an authorization error', () => {
      const error = new AuthorizationError('Insufficient permissions');

      expect(error.code).toBe(ErrorCode.FORBIDDEN);
      expect(error.category).toBe(ErrorCategory.AUTHENTICATION);
      expect(error.message).toBe('Insufficient permissions');
      expect(error.statusCode).toBe(403);
    });
  });

  describe('ValidationError', () => {
    it('should create a validation error', () => {
      const error = new ValidationError('Invalid field', { field: 'email' });

      expect(error.code).toBe(ErrorCode.INVALID_REQUEST);
      expect(error.category).toBe(ErrorCategory.VALIDATION);
      expect(error.message).toBe('Invalid field');
      expect(error.statusCode).toBe(400);
      expect(error.details).toEqual({ field: 'email' });
    });
  });

  describe('TokenExpiredError', () => {
    it('should create a token expired error', () => {
      const error = new TokenExpiredError();

      expect(error.code).toBe(ErrorCode.EXPIRED_TOKEN);
      expect(error.category).toBe(ErrorCategory.VALIDATION);
      expect(error.message).toBe('Token has expired');
      expect(error.statusCode).toBe(400);
    });
  });

  describe('TokenAlreadyUsedError', () => {
    it('should create a token already used error', () => {
      const error = new TokenAlreadyUsedError();

      expect(error.code).toBe(ErrorCode.TOKEN_ALREADY_USED);
      expect(error.category).toBe(ErrorCategory.VALIDATION);
      expect(error.message).toBe('Token has already been used');
      expect(error.statusCode).toBe(409);
    });
  });

  describe('InvalidStateError', () => {
    it('should create an invalid state error', () => {
      const error = new InvalidStateError('Session not active');

      expect(error.code).toBe(ErrorCode.INVALID_STATE);
      expect(error.category).toBe(ErrorCategory.VALIDATION);
      expect(error.message).toBe('Session not active');
      expect(error.statusCode).toBe(400);
    });
  });

  describe('RateLimitedError', () => {
    it('should create a rate limited error', () => {
      const error = new RateLimitedError('Too many requests', { limit: 10 });

      expect(error.code).toBe(ErrorCode.RATE_LIMITED);
      expect(error.category).toBe(ErrorCategory.ANTI_CHEAT);
      expect(error.message).toBe('Too many requests');
      expect(error.statusCode).toBe(429);
      expect(error.details).toEqual({ limit: 10 });
    });
  });

  describe('LocationViolationError', () => {
    it('should create a location violation error', () => {
      const error = new LocationViolationError('Outside geofence');

      expect(error.code).toBe(ErrorCode.LOCATION_VIOLATION);
      expect(error.category).toBe(ErrorCategory.ANTI_CHEAT);
      expect(error.message).toBe('Outside geofence');
      expect(error.statusCode).toBe(403);
    });
  });

  describe('GeofenceViolationError', () => {
    it('should create a geofence violation error', () => {
      const error = new GeofenceViolationError();

      expect(error.code).toBe(ErrorCode.GEOFENCE_VIOLATION);
      expect(error.category).toBe(ErrorCategory.ANTI_CHEAT);
      expect(error.message).toBe('Location outside allowed area');
      expect(error.statusCode).toBe(403);
    });
  });

  describe('WiFiViolationError', () => {
    it('should create a WiFi violation error', () => {
      const error = new WiFiViolationError();

      expect(error.code).toBe(ErrorCode.WIFI_VIOLATION);
      expect(error.category).toBe(ErrorCategory.ANTI_CHEAT);
      expect(error.message).toBe('Not connected to allowed WiFi network');
      expect(error.statusCode).toBe(403);
    });
  });

  describe('NotFoundError', () => {
    it('should create a not found error with default resource', () => {
      const error = new NotFoundError();

      expect(error.code).toBe(ErrorCode.NOT_FOUND);
      expect(error.category).toBe(ErrorCategory.RESOURCE);
      expect(error.message).toBe('Resource not found');
      expect(error.statusCode).toBe(404);
    });

    it('should create a not found error with custom resource', () => {
      const error = new NotFoundError('Session');

      expect(error.message).toBe('Session not found');
    });
  });

  describe('ConflictError', () => {
    it('should create a conflict error', () => {
      const error = new ConflictError('ETag mismatch');

      expect(error.code).toBe(ErrorCode.CONFLICT);
      expect(error.category).toBe(ErrorCategory.RESOURCE);
      expect(error.message).toBe('ETag mismatch');
      expect(error.statusCode).toBe(409);
    });
  });

  describe('StorageError', () => {
    it('should create a storage error', () => {
      const error = new StorageError('Table operation failed');

      expect(error.code).toBe(ErrorCode.STORAGE_ERROR);
      expect(error.category).toBe(ErrorCategory.RESOURCE);
      expect(error.message).toBe('Table operation failed');
      expect(error.statusCode).toBe(500);
      expect(error.isOperational).toBe(false);
    });
  });

  describe('IneligibleStudentError', () => {
    it('should create an ineligible student error', () => {
      const error = new IneligibleStudentError('Student not enrolled');

      expect(error.code).toBe(ErrorCode.INELIGIBLE_STUDENT);
      expect(error.category).toBe(ErrorCategory.BUSINESS_LOGIC);
      expect(error.message).toBe('Student not enrolled');
      expect(error.statusCode).toBe(400);
    });
  });

  describe('InsufficientStudentsError', () => {
    it('should create an insufficient students error', () => {
      const error = new InsufficientStudentsError();

      expect(error.code).toBe(ErrorCode.INSUFFICIENT_STUDENTS);
      expect(error.category).toBe(ErrorCategory.BUSINESS_LOGIC);
      expect(error.message).toBe('Not enough eligible students');
      expect(error.statusCode).toBe(400);
    });
  });

  describe('SessionEndedError', () => {
    it('should create a session ended error', () => {
      const error = new SessionEndedError();

      expect(error.code).toBe(ErrorCode.SESSION_ENDED);
      expect(error.category).toBe(ErrorCategory.BUSINESS_LOGIC);
      expect(error.message).toBe('Session has ended');
      expect(error.statusCode).toBe(400);
    });
  });

  describe('InternalError', () => {
    it('should create an internal error', () => {
      const error = new InternalError('Unexpected error');

      expect(error.code).toBe(ErrorCode.INTERNAL_ERROR);
      expect(error.category).toBe(ErrorCategory.INTERNAL);
      expect(error.message).toBe('Unexpected error');
      expect(error.statusCode).toBe(500);
      expect(error.isOperational).toBe(false);
    });
  });
});

describe('formatErrorResponse', () => {
  it('should format AppError correctly', () => {
    const error = new ValidationError('Invalid input', { field: 'email' });
    const response = formatErrorResponse(error, 'test-request-id');

    expect(response.error.code).toBe(ErrorCode.INVALID_REQUEST);
    expect(response.error.message).toBe('Invalid input');
    expect(response.error.details).toEqual({ field: 'email' });
    expect(response.error.timestamp).toBeGreaterThan(0);
    expect(response.error.requestId).toBe('test-request-id');
  });

  it('should format unknown error correctly', () => {
    const error = new Error('Unknown error');
    const response = formatErrorResponse(error);

    expect(response.error.code).toBe(ErrorCode.INTERNAL_ERROR);
    expect(response.error.message).toBe('An unexpected error occurred');
    expect(response.error.timestamp).toBeGreaterThan(0);
    expect(response.error.requestId).toBeDefined();
  });

  it('should generate request ID if not provided', () => {
    const error = new ValidationError('Test');
    const response = formatErrorResponse(error);

    expect(response.error.requestId).toBeDefined();
    expect(typeof response.error.requestId).toBe('string');
  });

  it('should include error details in development mode', () => {
    const originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'development';

    const error = new Error('Test error');
    const response = formatErrorResponse(error);

    expect(response.error.details).toBe('Test error');

    process.env.NODE_ENV = originalEnv;
  });

  it('should not include error details in production mode', () => {
    const originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';

    const error = new Error('Test error');
    const response = formatErrorResponse(error);

    expect(response.error.details).toBeUndefined();

    process.env.NODE_ENV = originalEnv;
  });
});

describe('logError', () => {
  let mockContext: InvocationContext;

  beforeEach(() => {
    mockContext = {
      warn: jest.fn(),
      error: jest.fn(),
      log: jest.fn(),
      trace: jest.fn(),
      debug: jest.fn()
    } as any;
  });

  it('should log operational AppError as warning', () => {
    const error = new ValidationError('Test error');
    logError(mockContext, error);

    expect(mockContext.warn).toHaveBeenCalledWith(
      'Operational error:',
      expect.objectContaining({
        message: 'Test error',
        code: ErrorCode.INVALID_REQUEST,
        category: ErrorCategory.VALIDATION,
        statusCode: 400,
        isOperational: true
      })
    );
  });

  it('should log non-operational AppError as error', () => {
    const error = new StorageError('Storage failed');
    logError(mockContext, error);

    expect(mockContext.error).toHaveBeenCalledWith(
      'Non-operational error:',
      expect.objectContaining({
        message: 'Storage failed',
        code: ErrorCode.STORAGE_ERROR,
        isOperational: false
      })
    );
  });

  it('should log unknown error as error', () => {
    const error = new Error('Unknown error');
    logError(mockContext, error);

    expect(mockContext.error).toHaveBeenCalledWith(
      'Unexpected error:',
      expect.objectContaining({
        name: 'Error',
        message: 'Unknown error'
      })
    );
  });

  it('should include additional info in log', () => {
    const error = new ValidationError('Test');
    const additionalInfo = { userId: '123', sessionId: 'abc' };
    logError(mockContext, error, additionalInfo);

    expect(mockContext.warn).toHaveBeenCalledWith(
      'Operational error:',
      expect.objectContaining({
        userId: '123',
        sessionId: 'abc'
      })
    );
  });
});

describe('withErrorHandling', () => {
  let mockContext: InvocationContext;

  beforeEach(() => {
    mockContext = {
      warn: jest.fn(),
      error: jest.fn(),
      log: jest.fn(),
      trace: jest.fn(),
      debug: jest.fn()
    } as any;
  });

  it('should return handler result on success', async () => {
    const handler = jest.fn().mockResolvedValue({ status: 200, jsonBody: { success: true } });
    const wrappedHandler = withErrorHandling(handler);

    const result = await wrappedHandler({}, mockContext);

    expect(result).toEqual({ status: 200, jsonBody: { success: true } });
    expect(handler).toHaveBeenCalled();
  });

  it('should catch and format AppError', async () => {
    const handler = jest.fn().mockRejectedValue(new ValidationError('Invalid input'));
    const wrappedHandler = withErrorHandling(handler);

    const result = await wrappedHandler({}, mockContext);

    expect(result.status).toBe(400);
    expect(result.jsonBody).toMatchObject({
      error: {
        code: ErrorCode.INVALID_REQUEST,
        message: 'Invalid input'
      }
    });
    expect(mockContext.warn).toHaveBeenCalled();
  });

  it('should catch and format unknown error', async () => {
    const handler = jest.fn().mockRejectedValue(new Error('Unknown error'));
    const wrappedHandler = withErrorHandling(handler);

    const result = await wrappedHandler({}, mockContext);

    expect(result.status).toBe(500);
    expect(result.jsonBody).toMatchObject({
      error: {
        code: ErrorCode.INTERNAL_ERROR,
        message: 'An unexpected error occurred'
      }
    });
    expect(mockContext.error).toHaveBeenCalled();
  });

  it('should use correct status code for different errors', async () => {
    const testCases = [
      { error: new AuthenticationError(), expectedStatus: 401 },
      { error: new AuthorizationError(), expectedStatus: 403 },
      { error: new ValidationError('Test'), expectedStatus: 400 },
      { error: new NotFoundError(), expectedStatus: 404 },
      { error: new ConflictError(), expectedStatus: 409 },
      { error: new RateLimitedError(), expectedStatus: 429 },
      { error: new InternalError(), expectedStatus: 500 }
    ];

    for (const testCase of testCases) {
      const handler = jest.fn().mockRejectedValue(testCase.error);
      const wrappedHandler = withErrorHandling(handler);

      const result = await wrappedHandler({}, mockContext);

      expect(result.status).toBe(testCase.expectedStatus);
    }
  });
});

describe('convertErrorString', () => {
  it('should convert ALREADY_USED to TokenAlreadyUsedError', () => {
    const error = convertErrorString('ALREADY_USED');
    expect(error).toBeInstanceOf(TokenAlreadyUsedError);
  });

  it('should convert EXPIRED to TokenExpiredError', () => {
    const error = convertErrorString('EXPIRED');
    expect(error).toBeInstanceOf(TokenExpiredError);
  });

  it('should convert REVOKED to ValidationError', () => {
    const error = convertErrorString('REVOKED');
    expect(error).toBeInstanceOf(ValidationError);
    expect(error.message).toBe('Token has been revoked');
  });

  it('should convert NOT_FOUND to NotFoundError', () => {
    const error = convertErrorString('NOT_FOUND');
    expect(error).toBeInstanceOf(NotFoundError);
  });

  it('should convert DEVICE_LIMIT to RateLimitedError', () => {
    const error = convertErrorString('DEVICE_LIMIT');
    expect(error).toBeInstanceOf(RateLimitedError);
    expect(error.message).toBe('Device rate limit exceeded');
  });

  it('should convert IP_LIMIT to RateLimitedError', () => {
    const error = convertErrorString('IP_LIMIT');
    expect(error).toBeInstanceOf(RateLimitedError);
    expect(error.message).toBe('IP rate limit exceeded');
  });

  it('should convert GEOFENCE_VIOLATION to GeofenceViolationError', () => {
    const error = convertErrorString('GEOFENCE_VIOLATION');
    expect(error).toBeInstanceOf(GeofenceViolationError);
  });

  it('should convert WIFI_VIOLATION to WiFiViolationError', () => {
    const error = convertErrorString('WIFI_VIOLATION');
    expect(error).toBeInstanceOf(WiFiViolationError);
  });

  it('should convert unknown string to InternalError', () => {
    const error = convertErrorString('UNKNOWN_ERROR');
    expect(error).toBeInstanceOf(InternalError);
    expect(error.message).toBe('Unknown error: UNKNOWN_ERROR');
  });
});

describe('Error Response Format Consistency', () => {
  it('should have consistent structure across all error types', () => {
    const errors = [
      new AuthenticationError(),
      new AuthorizationError(),
      new ValidationError('Test'),
      new TokenExpiredError(),
      new TokenAlreadyUsedError(),
      new InvalidStateError('Test'),
      new RateLimitedError(),
      new LocationViolationError('Test'),
      new GeofenceViolationError(),
      new WiFiViolationError(),
      new NotFoundError(),
      new ConflictError(),
      new StorageError(),
      new IneligibleStudentError(),
      new InsufficientStudentsError(),
      new SessionEndedError(),
      new InternalError()
    ];

    for (const error of errors) {
      const response = formatErrorResponse(error);

      // Check structure
      expect(response).toHaveProperty('error');
      expect(response.error).toHaveProperty('code');
      expect(response.error).toHaveProperty('message');
      expect(response.error).toHaveProperty('timestamp');
      expect(response.error).toHaveProperty('requestId');

      // Check types
      expect(typeof response.error.code).toBe('string');
      expect(typeof response.error.message).toBe('string');
      expect(typeof response.error.timestamp).toBe('number');
      expect(typeof response.error.requestId).toBe('string');
    }
  });
});
