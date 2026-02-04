/**
 * Join Session Function
 * Feature: qr-chain-attendance
 * Requirements: 13.1
 * 
 * POST /api/sessions/{sessionId}/join
 * 
 * Allows a student to join/enroll in a session by scanning the Session_QR code.
 * Creates an attendance record for the student if one doesn't exist.
 */

import { app, HttpRequest, HttpResponseInit, InvocationContext } from "@azure/functions";
import { authService } from "../services/AuthService";
import { Role } from "../types";
import { getTableClient, TableName } from "../storage";
import { AttendanceEntity } from "../types";

/**
 * Join session request (no body needed, student ID comes from auth)
 */
export interface JoinSessionRequest {
  // Empty - student ID comes from authentication
}

/**
 * Join session response
 */
export interface JoinSessionResponse {
  success: boolean;
  sessionId: string;
  studentId: string;
  message: string;
}

/**
 * Join Session Handler
 * 
 * Enrolls a student in a session by creating an attendance record.
 * This is called when a student scans a Session_QR code.
 * 
 * @param request - HTTP request
 * @param context - Invocation context
 * @returns HTTP response
 */
export async function joinSessionHandler(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  try {
    // Extract and validate authentication
    const header = request.headers.get("x-ms-client-principal") || undefined;
    const principal = authService.parseUserPrincipal(header);
    authService.requireRole(principal, Role.STUDENT);
    
    const studentId = authService.getUserId(principal);
    
    // Get session ID from route parameters
    const sessionId = request.params.sessionId;
    if (!sessionId) {
      return {
        status: 400,
        jsonBody: {
          error: {
            code: "INVALID_REQUEST",
            message: "Session ID is required",
            timestamp: Date.now(),
            requestId: context.invocationId
          }
        }
      };
    }
    
    // Verify session exists
    const sessionTableClient = getTableClient(TableName.SESSIONS);
    try {
      await sessionTableClient.getEntity("SESSION", sessionId);
    } catch (error: any) {
      if (error.statusCode === 404) {
        return {
          status: 404,
          jsonBody: {
            error: {
              code: "NOT_FOUND",
              message: "Session not found",
              timestamp: Date.now(),
              requestId: context.invocationId
            }
          }
        };
      }
      throw error;
    }
    
    // Create or update attendance record to enroll student
    const attendanceTableClient = getTableClient(TableName.ATTENDANCE);
    
    try {
      // Check if student is already enrolled
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const existing = await attendanceTableClient.getEntity<AttendanceEntity>(
        sessionId,
        studentId
      );
      
      // Student already enrolled
      context.log(`Student ${studentId} already enrolled in session ${sessionId}`);
      
      return {
        status: 200,
        jsonBody: {
          success: true,
          sessionId,
          studentId,
          message: "Already enrolled in session"
        } as JoinSessionResponse
      };
    } catch (error: any) {
      // If record doesn't exist (404), create new enrollment
      if (error.statusCode === 404) {
        const newEntity: AttendanceEntity = {
          partitionKey: sessionId,
          rowKey: studentId,
          exitVerified: false
          // entryStatus, entryAt, etc. will be set when student scans chain QR
        };
        
        await attendanceTableClient.createEntity(newEntity);
        
        context.log(`Student ${studentId} enrolled in session ${sessionId}`);
        
        return {
          status: 201,
          jsonBody: {
            success: true,
            sessionId,
            studentId,
            message: "Successfully enrolled in session"
          } as JoinSessionResponse
        };
      }
      
      // Other errors
      throw error;
    }
  } catch (error: any) {
    context.error("Error in joinSession:", error);
    
    // Handle specific error types
    if (error.message === "UNAUTHORIZED" || error.message === "FORBIDDEN") {
      return {
        status: error.message === "UNAUTHORIZED" ? 401 : 403,
        jsonBody: {
          error: {
            code: error.message,
            message: error.message === "UNAUTHORIZED" 
              ? "Authentication required" 
              : "Insufficient permissions",
            timestamp: Date.now(),
            requestId: context.invocationId
          }
        }
      };
    }
    
    // Generic error response
    return {
      status: 500,
      jsonBody: {
        error: {
          code: "INTERNAL_ERROR",
          message: "Failed to join session",
          timestamp: Date.now(),
          requestId: context.invocationId
        }
      }
    };
  }
}

// Register the function

export default joinSessionHandler;

app.http('joinSession', {
  methods: ['POST'],
  route: 'sessions/{sessionId}/join',
  authLevel: 'anonymous',
  handler: joinSessionHandler
});
