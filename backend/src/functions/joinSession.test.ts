/**
 * Join Session Function Tests
 * Feature: qr-chain-attendance
 * Requirements: 13.1
 */

import { HttpRequest, InvocationContext } from "@azure/functions";
import joinSessionHandler from "./joinSession";
import { authService } from "../services/AuthService";
import { getTableClient, TableName } from "../storage";
import { Role } from "../types";

// Mock dependencies
jest.mock("../services/AuthService");
jest.mock("../storage");

describe("joinSession", () => {
  let mockRequest: any;
  let mockContext: Partial<InvocationContext>;
  let mockSessionTableClient: any;
  let mockAttendanceTableClient: any;

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();

    // Mock context
    mockContext = {
      invocationId: "test-invocation-id",
      log: jest.fn(),
      error: jest.fn()
    };

    // Mock table clients
    mockSessionTableClient = {
      getEntity: jest.fn(),
      createEntity: jest.fn(),
      updateEntity: jest.fn()
    };

    mockAttendanceTableClient = {
      getEntity: jest.fn(),
      createEntity: jest.fn(),
      updateEntity: jest.fn()
    };

    (getTableClient as jest.Mock).mockImplementation((tableName: string) => {
      if (tableName === TableName.SESSIONS) {
        return mockSessionTableClient;
      }
      if (tableName === TableName.ATTENDANCE) {
        return mockAttendanceTableClient;
      }
      throw new Error(`Unknown table: ${tableName}`);
    });
  });

  describe("Authentication and Authorization", () => {
    it("should require student role", async () => {
      // Mock authentication - teacher role
      (authService.parseUserPrincipal as jest.Mock).mockReturnValue({
        userId: "teacher123",
        userEmail: "teacher@vtc.edu.hk",
        userRoles: [Role.TEACHER]
      });

      (authService.requireRole as jest.Mock).mockImplementation(() => {
        throw new Error("FORBIDDEN");
      });

      mockRequest = {
        params: { sessionId: "session123" },
        headers: new Map([["x-ms-client-principal", "encoded-principal"]])
      };

      const response = await joinSessionHandler(
        mockRequest as HttpRequest,
        mockContext as InvocationContext
      );

      expect(response.status).toBe(403);
      expect(response.jsonBody).toMatchObject({
        error: {
          code: "FORBIDDEN"
        }
      });
    });

    it("should reject unauthenticated requests", async () => {
      (authService.parseUserPrincipal as jest.Mock).mockImplementation(() => {
        throw new Error("UNAUTHORIZED");
      });

      mockRequest = {
        params: { sessionId: "session123" },
        headers: new Map()
      };

      const response = await joinSessionHandler(
        mockRequest as HttpRequest,
        mockContext as InvocationContext
      );

      expect(response.status).toBe(401);
      expect(response.jsonBody).toMatchObject({
        error: {
          code: "UNAUTHORIZED"
        }
      });
    });
  });

  describe("Session Validation", () => {
    beforeEach(() => {
      // Mock student authentication
      (authService.parseUserPrincipal as jest.Mock).mockReturnValue({
        userId: "student123",
        userEmail: "student@stu.edu.hk",
        userRoles: [Role.STUDENT]
      });

      (authService.requireRole as jest.Mock).mockImplementation(() => {
        // No-op for student role
      });

      (authService.getUserId as jest.Mock).mockReturnValue("student123");
    });

    it("should return 400 if session ID is missing", async () => {
      mockRequest = {
        params: {},
        headers: new Map([["x-ms-client-principal", "encoded-principal"]])
      };

      const response = await joinSessionHandler(
        mockRequest as HttpRequest,
        mockContext as InvocationContext
      );

      expect(response.status).toBe(400);
      expect(response.jsonBody).toMatchObject({
        error: {
          code: "INVALID_REQUEST",
          message: "Session ID is required"
        }
      });
    });

    it("should return 404 if session does not exist", async () => {
      mockRequest = {
        params: { sessionId: "nonexistent-session" },
        headers: new Map([["x-ms-client-principal", "encoded-principal"]])
      };

      // Mock session not found
      mockSessionTableClient.getEntity.mockRejectedValue({
        statusCode: 404
      });

      const response = await joinSessionHandler(
        mockRequest as HttpRequest,
        mockContext as InvocationContext
      );

      expect(response.status).toBe(404);
      expect(response.jsonBody).toMatchObject({
        error: {
          code: "NOT_FOUND",
          message: "Session not found"
        }
      });
    });
  });

  describe("Session Enrollment", () => {
    beforeEach(() => {
      // Mock student authentication
      (authService.parseUserPrincipal as jest.Mock).mockReturnValue({
        userId: "student123",
        userEmail: "student@stu.edu.hk",
        userRoles: [Role.STUDENT]
      });

      (authService.requireRole as jest.Mock).mockImplementation(() => {
        // No-op for student role
      });

      (authService.getUserId as jest.Mock).mockReturnValue("student123");

      // Mock session exists
      mockSessionTableClient.getEntity.mockResolvedValue({
        partitionKey: "SESSION",
        rowKey: "session123",
        classId: "CS101",
        status: "ACTIVE"
      });
    });

    it("should enroll a new student in the session", async () => {
      mockRequest = {
        params: { sessionId: "session123" },
        headers: new Map([["x-ms-client-principal", "encoded-principal"]])
      };

      // Mock student not yet enrolled (404)
      mockAttendanceTableClient.getEntity.mockRejectedValue({
        statusCode: 404
      });

      // Mock successful creation
      mockAttendanceTableClient.createEntity.mockResolvedValue({});

      const response = await joinSessionHandler(
        mockRequest as HttpRequest,
        mockContext as InvocationContext
      );

      expect(response.status).toBe(201);
      expect(response.jsonBody).toMatchObject({
        success: true,
        sessionId: "session123",
        studentId: "student123",
        message: "Successfully enrolled in session"
      });

      // Verify attendance record was created
      expect(mockAttendanceTableClient.createEntity).toHaveBeenCalledWith({
        partitionKey: "session123",
        rowKey: "student123",
        exitVerified: false
      });
    });

    it("should return success if student is already enrolled", async () => {
      mockRequest = {
        params: { sessionId: "session123" },
        headers: new Map([["x-ms-client-principal", "encoded-principal"]])
      };

      // Mock student already enrolled
      mockAttendanceTableClient.getEntity.mockResolvedValue({
        partitionKey: "session123",
        rowKey: "student123",
        exitVerified: false
      });

      const response = await joinSessionHandler(
        mockRequest as HttpRequest,
        mockContext as InvocationContext
      );

      expect(response.status).toBe(200);
      expect(response.jsonBody).toMatchObject({
        success: true,
        sessionId: "session123",
        studentId: "student123",
        message: "Already enrolled in session"
      });

      // Verify no new record was created
      expect(mockAttendanceTableClient.createEntity).not.toHaveBeenCalled();
    });

    it("should handle storage errors gracefully", async () => {
      mockRequest = {
        params: { sessionId: "session123" },
        headers: new Map([["x-ms-client-principal", "encoded-principal"]])
      };

      // Mock storage error
      mockAttendanceTableClient.getEntity.mockRejectedValue(
        new Error("Storage service unavailable")
      );

      const response = await joinSessionHandler(
        mockRequest as HttpRequest,
        mockContext as InvocationContext
      );

      expect(response.status).toBe(500);
      expect(response.jsonBody).toMatchObject({
        error: {
          code: "INTERNAL_ERROR",
          message: "Failed to join session"
        }
      });
    });
  });

  describe("Requirement 13.1: Session enrollment via QR", () => {
    it("should enroll student when scanning Session_QR code", async () => {
      // Mock student authentication
      (authService.parseUserPrincipal as jest.Mock).mockReturnValue({
        userId: "student456",
        userEmail: "student456@stu.edu.hk",
        userRoles: [Role.STUDENT]
      });

      (authService.requireRole as jest.Mock).mockImplementation(() => {
        // No-op for student role
      });

      (authService.getUserId as jest.Mock).mockReturnValue("student456");

      // Mock session exists
      mockSessionTableClient.getEntity.mockResolvedValue({
        partitionKey: "SESSION",
        rowKey: "session789",
        classId: "MATH201",
        status: "ACTIVE"
      });

      // Mock student not yet enrolled
      mockAttendanceTableClient.getEntity.mockRejectedValue({
        statusCode: 404
      });

      mockAttendanceTableClient.createEntity.mockResolvedValue({});

      mockRequest = {
        params: { sessionId: "session789" },
        headers: new Map([["x-ms-client-principal", "encoded-principal"]])
      };

      const response = await joinSessionHandler(
        mockRequest as HttpRequest,
        mockContext as InvocationContext
      );

      // Verify enrollment was successful
      expect(response.status).toBe(201);
      expect(response.jsonBody).toMatchObject({
        success: true,
        sessionId: "session789",
        studentId: "student456"
      });

      // Verify attendance record was created with correct structure
      expect(mockAttendanceTableClient.createEntity).toHaveBeenCalledWith(
        expect.objectContaining({
          partitionKey: "session789",
          rowKey: "student456",
          exitVerified: false
        })
      );
    });
  });
});
