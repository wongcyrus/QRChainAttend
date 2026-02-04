/**
 * POST /api/scan/exit-chain
 * Feature: qr-chain-attendance
 * Requirements: 6.3, 6.4, 6.6, 6.7
 * 
 * Process an exit chain scan
 * 
 * Authorization: Student role required
 * 
 * Processing Flow:
 * 1. Extract user principal and validate Student role
 * 2. Call ValidationService for rate limit and location
 * 3. Call ChainService.processChainScan with EXIT phase
 * 4. Call ValidationService.logScan
 */

import { app, HttpRequest, HttpResponseInit, InvocationContext } from "@azure/functions";
import { authService } from "../services/AuthService";
import { validationService } from "../services/ValidationService";
import { chainService } from "../services/ChainService";
import { sessionService } from "../services/SessionService";
import { Role, ScanFlow, ScanResult, ScanMetadata } from "../types";
import { signalROutput, sendSignalRMessage } from "../utils/signalr";

/**
 * Exit Chain Scan Request body
 */
interface ExitChainScanRequest {
  sessionId: string;
  tokenId: string;
  etag: string;
  metadata: ScanMetadata;
}

/**
 * Exit Chain Scan Response
 */
interface ExitChainScanResponse {
  success: boolean;
  holderMarked?: string;
  newHolder?: string;
  newToken?: string;
  newTokenEtag?: string;
  error?: string;
}

/**
 * POST /api/scan/exit-chain handler
 */
export async function scanExitChain(
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
    const body = await request.json() as ExitChainScanRequest;
    
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

    // Step 2: Check rate limits
    const rateLimitResult = validationService.checkRateLimit(
      body.metadata.deviceFingerprint,
      ip
    );

    if (!rateLimitResult.allowed) {
      await validationService.logScan({
        sessionId: body.sessionId,
        flow: ScanFlow.EXIT_CHAIN,
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

    // Get session to check constraints
    const session = await sessionService.getSession(body.sessionId);
    if (!session) {
      await validationService.logScan({
        sessionId: body.sessionId,
        flow: ScanFlow.EXIT_CHAIN,
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

    // Step 2: Validate location constraints
    const locationResult = validationService.validateLocation(
      session.constraints,
      body.metadata.gps,
      body.metadata.bssid
    );

    if (!locationResult.valid) {
      await validationService.logScan({
        sessionId: body.sessionId,
        flow: ScanFlow.EXIT_CHAIN,
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

    // Step 3: Process exit chain scan
    const scanResult = await chainService.processChainScan({
      sessionId: body.sessionId,
      tokenId: body.tokenId,
      etag: body.etag,
      scannerId: principal.userId,
      scanMetadata: body.metadata
    });

    // Step 4: Log scan attempt and broadcast SignalR update
    if (scanResult.success) {
      await validationService.logScan({
        sessionId: body.sessionId,
        flow: ScanFlow.EXIT_CHAIN,
        tokenId: body.tokenId,
        holderId: scanResult.holderMarked,
        scannerId: principal.userId,
        deviceFingerprint: body.metadata.deviceFingerprint,
        ip,
        bssid: body.metadata.bssid,
        gps: body.metadata.gps,
        userAgent: body.metadata.userAgent,
        result: ScanResult.SUCCESS
      });

      // Send SignalR update if available
      if (scanResult.signalRMessages && scanResult.signalRMessages.length > 0) {
        scanResult.signalRMessages.forEach(msg => sendSignalRMessage(context, msg));
      }

      const response: ExitChainScanResponse = {
        success: true,
        holderMarked: scanResult.holderMarked,
        newHolder: scanResult.newHolder
      };

      return {
        status: 200,
        jsonBody: response
      };
    } else {
      // Determine result type from error
      let result = ScanResult.TOKEN_INVALID;
      if (scanResult.error === "ALREADY_USED") {
        result = ScanResult.TOKEN_USED;
      } else if (scanResult.error === "EXPIRED") {
        result = ScanResult.TOKEN_EXPIRED;
      }

      await validationService.logScan({
        sessionId: body.sessionId,
        flow: ScanFlow.EXIT_CHAIN,
        tokenId: body.tokenId,
        scannerId: principal.userId,
        deviceFingerprint: body.metadata.deviceFingerprint,
        ip,
        bssid: body.metadata.bssid,
        gps: body.metadata.gps,
        userAgent: body.metadata.userAgent,
        result,
        error: scanResult.error
      });

      return {
        status: 400,
        jsonBody: {
          error: {
            code: scanResult.error,
            message: `Scan failed: ${scanResult.error}`,
            timestamp: Date.now()
          }
        }
      };
    }
  } catch (error: any) {
    context.error("Error processing exit chain scan:", error);
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
