/**
 * POST /api/scan/early-leave
 * Feature: qr-chain-attendance
 * Requirements: 5.3, 5.5, 5.6
 * 
 * Process an early leave scan
 * 
 * Authorization: Student role required
 * 
 * Processing Flow:
 * 1. Extract user principal and validate Student role
 * 2. Validate early-leave window is active
 * 3. Call ValidationService for rate limit and location
 * 4. Call TokenService.consumeToken
 * 5. Call AttendanceService.markEarlyLeave
 * 6. Call ValidationService.logScan
 */

import { app, HttpRequest, HttpResponseInit, InvocationContext } from "@azure/functions";
import { authService } from "../services/AuthService";
import { validationService } from "../services/ValidationService";
import { tokenService } from "../services/TokenService";
import { attendanceService } from "../services/AttendanceService";
import { sessionService } from "../services/SessionService";
import { Role, ScanFlow, ScanResult, ScanMetadata } from "../types";
import { signalROutput, sendSignalRMessage } from "../utils/signalr";

/**
 * Early Leave Scan Request body
 */
interface EarlyLeaveScanRequest {
  sessionId: string;
  tokenId: string;
  etag: string;
  metadata: ScanMetadata;
}

/**
 * Early Leave Scan Response
 */
interface EarlyLeaveScanResponse {
  success: boolean;
  studentId?: string;
  error?: string;
}

/**
 * POST /api/scan/early-leave handler
 */
export async function scanEarlyLeave(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  try {
    // Step 1: Extract and validate authentication
    const principalHeader = request.headers.get("x-ms-client-principal");
    if (!principalHeader) {
      return {
        status: 401,
        jsonBody: {
          error: {
            code: "UNAUTHORIZED",
            message: "Missing authentication header",
            timestamp: Date.now()
          }
        }
      };
    }

    const principal = authService.parseUserPrincipal(principalHeader);
    
    // Validate Student role
    try {
      authService.requireRole(principal, Role.STUDENT);
    } catch (error: any) {
      return {
        status: 403,
        jsonBody: {
          error: {
            code: "FORBIDDEN",
            message: error.message,
            timestamp: Date.now()
          }
        }
      };
    }

    // Parse request body
    const body = await request.json() as EarlyLeaveScanRequest;
    
    if (!body.sessionId || !body.tokenId || !body.etag || !body.metadata) {
      return {
        status: 400,
        jsonBody: {
          error: {
            code: "INVALID_REQUEST",
            message: "Missing required fields: sessionId, tokenId, etag, metadata",
            timestamp: Date.now()
          }
        }
      };
    }

    // Extract IP address
    const ip = request.headers.get("x-forwarded-for")?.split(",")[0] || 
                request.headers.get("x-real-ip") || 
                "unknown";

    // Get session to check constraints and early leave status
    const session = await sessionService.getSession(body.sessionId);
    if (!session) {
      await validationService.logScan({
        sessionId: body.sessionId,
        flow: ScanFlow.EARLY_LEAVE,
        tokenId: body.tokenId,
        scannerId: principal.userId,
        deviceFingerprint: body.metadata.deviceFingerprint,
        ip,
        bssid: body.metadata.bssid,
        gps: body.metadata.gps,
        userAgent: body.metadata.userAgent,
        result: ScanResult.TOKEN_INVALID,
        error: "Session not found"
      });

      return {
        status: 404,
        jsonBody: {
          error: {
            code: "NOT_FOUND",
            message: "Session not found",
            timestamp: Date.now()
          }
        }
      };
    }

    // Step 2: Validate early-leave window is active (Requirement 5.2)
    if (!session.earlyLeaveActive) {
      await validationService.logScan({
        sessionId: body.sessionId,
        flow: ScanFlow.EARLY_LEAVE,
        tokenId: body.tokenId,
        scannerId: principal.userId,
        deviceFingerprint: body.metadata.deviceFingerprint,
        ip,
        bssid: body.metadata.bssid,
        gps: body.metadata.gps,
        userAgent: body.metadata.userAgent,
        result: ScanResult.TOKEN_INVALID,
        error: "Early leave window is not active"
      });

      return {
        status: 400,
        jsonBody: {
          error: {
            code: "INVALID_STATE",
            message: "Early leave window is not active",
            timestamp: Date.now()
          }
        }
      };
    }

    // Step 3: Check rate limits
    const rateLimitResult = validationService.checkRateLimit(
      body.metadata.deviceFingerprint,
      ip
    );

    if (!rateLimitResult.allowed) {
      await validationService.logScan({
        sessionId: body.sessionId,
        flow: ScanFlow.EARLY_LEAVE,
        tokenId: body.tokenId,
        scannerId: principal.userId,
        deviceFingerprint: body.metadata.deviceFingerprint,
        ip,
        bssid: body.metadata.bssid,
        gps: body.metadata.gps,
        userAgent: body.metadata.userAgent,
        result: ScanResult.RATE_LIMITED,
        error: rateLimitResult.reason
      });

      return {
        status: 429,
        jsonBody: {
          error: {
            code: "RATE_LIMITED",
            message: `Rate limit exceeded: ${rateLimitResult.reason}`,
            timestamp: Date.now()
          }
        }
      };
    }

    // Step 3: Validate location constraints
    const locationResult = validationService.validateLocation(
      session.constraints,
      body.metadata.gps,
      body.metadata.bssid
    );

    if (!locationResult.valid) {
      await validationService.logScan({
        sessionId: body.sessionId,
        flow: ScanFlow.EARLY_LEAVE,
        tokenId: body.tokenId,
        scannerId: principal.userId,
        deviceFingerprint: body.metadata.deviceFingerprint,
        ip,
        bssid: body.metadata.bssid,
        gps: body.metadata.gps,
        userAgent: body.metadata.userAgent,
        result: ScanResult.LOCATION_VIOLATION,
        error: locationResult.reason
      });

      return {
        status: 403,
        jsonBody: {
          error: {
            code: "LOCATION_VIOLATION",
            message: `Location validation failed: ${locationResult.reason}`,
            timestamp: Date.now()
          }
        }
      };
    }

    // Step 4: Consume token (atomic ETag check)
    const consumeResult = await tokenService.consumeToken(
      body.tokenId,
      body.sessionId,
      body.etag
    );

    if (!consumeResult.success) {
      // Determine result type from error
      let result = ScanResult.TOKEN_INVALID;
      if (consumeResult.error === "ALREADY_USED") {
        result = ScanResult.TOKEN_USED;
      } else if (consumeResult.error === "EXPIRED") {
        result = ScanResult.TOKEN_EXPIRED;
      }

      await validationService.logScan({
        sessionId: body.sessionId,
        flow: ScanFlow.EARLY_LEAVE,
        tokenId: body.tokenId,
        scannerId: principal.userId,
        deviceFingerprint: body.metadata.deviceFingerprint,
        ip,
        bssid: body.metadata.bssid,
        gps: body.metadata.gps,
        userAgent: body.metadata.userAgent,
        result,
        error: consumeResult.error
      });

      return {
        status: 400,
        jsonBody: {
          error: {
            code: consumeResult.error,
            message: `Token consumption failed: ${consumeResult.error}`,
            timestamp: Date.now()
          }
        }
      };
    }

    // Step 5: Mark student as early leave
    const markResult = await attendanceService.markEarlyLeave(
      body.sessionId,
      principal.userId
    );

    // Send SignalR update if available
    if (markResult.signalRMessage) {
      sendSignalRMessage(context, markResult.signalRMessage);
    }

    // Step 6: Log successful scan
    await validationService.logScan({
      sessionId: body.sessionId,
      flow: ScanFlow.EARLY_LEAVE,
      tokenId: body.tokenId,
      scannerId: principal.userId,
      deviceFingerprint: body.metadata.deviceFingerprint,
      ip,
      bssid: body.metadata.bssid,
      gps: body.metadata.gps,
      userAgent: body.metadata.userAgent,
      result: ScanResult.SUCCESS
    });

    const response: EarlyLeaveScanResponse = {
      success: true,
      studentId: principal.userId
    };

    return {
      status: 200,
      jsonBody: response
    };
  } catch (error: any) {
    context.error("Error processing early leave scan:", error);
    return {
      status: 500,
      jsonBody: {
        error: {
          code: "INTERNAL_ERROR",
          message: "An error occurred processing the scan",
          timestamp: Date.now()
        }
      }
    };
  }
}

// Register the function with SignalR output binding

app.http('scanEarlyLeave', {
  methods: ['POST'],
  route: 'scan/early-leave',
  authLevel: 'anonymous',
  handler: scanEarlyLeave
});
