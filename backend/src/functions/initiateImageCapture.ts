/**
 * Initiate Image Capture API Endpoint
 * 
 * POST /api/sessions/{sessionId}/capture/initiate
 * 
 * This function handles organizer-initiated photo capture requests:
 * 1. Validates organizer authentication and session ownership
 * 2. Queries online students from Attendance table
 * 3. Generates unique captureRequestId (UUID)
 * 4. Calculates expiresAt timestamp (createdAt + 30 seconds)
 * 
 * Validates: Requirements 1.1, 1.2
 */

import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import * as df from 'durable-functions';
import { parseAuthFromRequest, hasRole, getUserId } from '../utils/auth';
import { getTableClient, TableNames } from '../utils/database';
import { randomUUID } from 'crypto';
import {
  InitiateCaptureResponse,
  CaptureErrorCode,
  CaptureRequest,
  CaptureRequestEvent
} from '../types/studentImageCapture';
import { generateStudentSasUrl } from '../utils/blobStorage';
import { createCaptureRequest } from '../utils/captureStorage';
import { broadcastToUser } from '../utils/signalrBroadcast';
import { logError, logInfo, logDebug } from '../utils/errorLogging';

/**
 * Initiate a capture request for a session
 * 
 * This is task 4.1 - creates the function skeleton with:
 * - Organizer authentication validation
 * - Session ownership verification
 * - Online attendee querying
 * - Capture request ID generation
 * - Expiration timestamp calculation
 * 
 * Subsequent tasks (4.2-4.5) will add:
 * - SAS URL generation
 * - Table Storage persistence
 * - SignalR broadcasting
 * - Response handling
 */
export async function initiateImageCapture(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  context.log('Processing POST /api/sessions/{sessionId}/capture/initiate request');

  let sessionId: string | undefined;
  let captureRequestId: string | undefined;

  try {
    // ========================================================================
    // Step 1: Validate organizer authentication
    // ========================================================================
    
    const principal = parseAuthFromRequest(request);
    
    if (!principal) {
      return {
        status: 401,
        jsonBody: {
          error: {
            code: CaptureErrorCode.UNAUTHORIZED,
            message: 'Missing authentication header',
            timestamp: Date.now()
          }
        }
      };
    }    
    // Require Organizer role
    if (!hasRole(principal, 'Organizer') && !hasRole(principal, 'organizer')) {
      return {
        status: 403,
        jsonBody: {
          error: {
            code: CaptureErrorCode.FORBIDDEN,
            message: 'Organizer role required',
            timestamp: Date.now()
          }
        }
      };
    }

    const organizerId = getUserId(principal);
    sessionId = request.params.sessionId;
    
    if (!sessionId) {
      return {
        status: 400,
        jsonBody: {
          error: {
            code: CaptureErrorCode.INVALID_REQUEST,
            message: 'Missing sessionId',
            timestamp: Date.now()
          }
        }
      };
    }

    // ========================================================================
    // Step 2: Verify session exists and organizer owns it
    // ========================================================================
    
    const sessionsTable = getTableClient(TableNames.SESSIONS);
    let session: any;
    
    try {
      session = await sessionsTable.getEntity('SESSION', sessionId);
    } catch (error: any) {
      if (error.statusCode === 404) {
        return {
          status: 404,
          jsonBody: {
            error: {
              code: CaptureErrorCode.SESSION_NOT_FOUND,
              message: 'Session not found',
              timestamp: Date.now()
            }
          }
        };
      }
      throw error;
    }

    // Verify ownership
    if (session.organizerId !== organizerId) {
      return {
        status: 403,
        jsonBody: {
          error: {
            code: CaptureErrorCode.FORBIDDEN,
            message: 'You do not own this session',
            timestamp: Date.now()
          }
        }
      };
    }

    // ========================================================================
    // Step 3: Query online students from Attendance table
    // ========================================================================
    
    const attendanceTable = getTableClient(TableNames.ATTENDANCE);
    const onlineStudentIds: string[] = [];
    
    // Query all attendance records for this session
    for await (const entity of attendanceTable.listEntities({
      queryOptions: {
        filter: `PartitionKey eq '${sessionId}'`
      }
    })) {
      // Check if attendee is online (isOnline flag)
      if (entity.isOnline === true) {
        onlineStudentIds.push(entity.rowKey as string);
      }
    }

    // Check if there are any online students
    if (onlineStudentIds.length === 0) {
      return {
        status: 400,
        jsonBody: {
          error: {
            code: CaptureErrorCode.NO_ONLINE_STUDENTS,
            message: 'No online students available for capture',
            timestamp: Date.now()
          }
        }
      };
    }

    context.log(`Found ${onlineStudentIds.length} online students for session ${sessionId}`);

    // ========================================================================
    // Step 4: Generate unique captureRequestId (UUID)
    // ========================================================================
    
    captureRequestId = randomUUID();
    context.log(`Generated capture request ID: ${captureRequestId}`);

    // ========================================================================
    // Step 5: Calculate expiresAt timestamp (createdAt + 30 seconds)
    // ========================================================================
    
    const createdAt = new Date();
    const expiresAt = new Date(createdAt.getTime() + 30000); // 30 seconds
    
    context.log(`Capture window: ${createdAt.toISOString()} to ${expiresAt.toISOString()}`);

    // ========================================================================
    // Step 6: Generate SAS URLs for all online students
    // ========================================================================
    
    // Generate SAS URLs for each online attendee
    const studentSasUrls = new Map<string, string>();
    
    for (const attendeeId of onlineStudentIds) {
      const sasUrl = generateStudentSasUrl(sessionId, captureRequestId, attendeeId);
      studentSasUrls.set(attendeeId, sasUrl);
      context.log(`Generated SAS URL for attendee: ${attendeeId}`);
    }
    
    context.log(`Generated ${studentSasUrls.size} SAS URLs for online students`);

    // ========================================================================
    // Step 7: Store capture request in Table Storage
    // ========================================================================
    
    // Create CaptureRequest entity with status 'ACTIVE'
    const captureRequestEntity: CaptureRequest = {
      partitionKey: sessionId,
      rowKey: captureRequestId,
      sessionId,
      organizerId,
      status: 'ACTIVE',
      createdAt: createdAt.toISOString(),
      expiresAt: expiresAt.toISOString(),
      onlineStudentIds: JSON.stringify(onlineStudentIds),
      onlineStudentCount: onlineStudentIds.length,
      uploadedCount: 0
    };
    
    // Store in Table Storage
    await createCaptureRequest(captureRequestEntity);
    context.log(`Stored capture request in Table Storage: ${captureRequestId}`);

    // ========================================================================
    // Step 7.5: Start Durable Orchestrator for timeout handling
    // ========================================================================
    
    const client = df.getClient(context);
    
    const orchestratorInput = {
      captureRequestId,
      expiresAt: expiresAt.toISOString(),
      sessionId
    };
    
    try {
      const instanceId = await client.startNew(
        'captureTimeoutOrchestrator',
        {
          instanceId: captureRequestId, // Use captureRequestId as instance ID
          input: orchestratorInput
        }
      );
      
      context.log(`Started orchestrator instance: ${instanceId}`);
      context.log(`Orchestrator input: ${JSON.stringify(orchestratorInput)}`);
      
    } catch (error: any) {
      context.error(`Failed to start orchestrator: ${error.message}`);
      logError(
        context,
        'Failed to start timeout orchestrator',
        error,
        {
          sessionId,
          captureRequestId
        }
      );
      
      return {
        status: 500,
        jsonBody: {
          error: {
            code: CaptureErrorCode.INTERNAL_ERROR,
            message: 'Failed to start timeout orchestrator',
            details: error.message,
            timestamp: Date.now()
          }
        }
      };
    }

    // ========================================================================
    // Step 8: Broadcast capture request via SignalR
    // ========================================================================
    
    // Send captureRequest event to each attendee with their SAS URL
    context.log(`Broadcasting capture request to ${onlineStudentIds.length} students`);
    context.log(`Attendee IDs to broadcast to: ${JSON.stringify(onlineStudentIds)}`);
    
    for (const attendeeId of onlineStudentIds) {
      const sasUrl = studentSasUrls.get(attendeeId);
      if (!sasUrl) {
        context.warn(`No SAS URL found for attendee ${attendeeId}, skipping broadcast`);
        continue;
      }
      
      // Construct the blob name for this attendee
      const blobName = `${sessionId}/${captureRequestId}/${attendeeId}.jpg`;
      
      // Create the capture request event payload
      const captureRequestEvent: CaptureRequestEvent = {
        captureRequestId,
        sasUrl,
        expiresAt: expiresAt.getTime(), // Unix timestamp in milliseconds
        blobName
      };
      
      context.log(`Broadcasting to attendee: ${attendeeId} with event:`, JSON.stringify(captureRequestEvent));
      
      // Broadcast to this specific attendee
      await broadcastToUser(
        sessionId,
        attendeeId,
        'captureRequest',
        captureRequestEvent,
        context
      );
      
      context.log(`Broadcasted capture request to attendee: ${attendeeId}`);
    }
    
    context.log(`Completed broadcasting to all ${onlineStudentIds.length} students`);

    // ========================================================================
    // Step 6: Return success response to organizer
    // ========================================================================
    
    const response: InitiateCaptureResponse = {
      captureRequestId,
      expiresAt: expiresAt.getTime(), // Unix timestamp in milliseconds
      onlineStudentCount: onlineStudentIds.length
    };

    context.log(`Capture request initiated successfully: ${JSON.stringify(response)}`);

    logInfo(context, 'Capture request initiated successfully', {
      sessionId,
      captureRequestId,
      attendeeId: organizerId
    });

    return {
      status: 201,
      jsonBody: response
    };

  } catch (error: any) {
    logError(
      context,
      'Failed to initiate capture request',
      error,
      {
        sessionId,
        errorType: error.name,
        errorCode: CaptureErrorCode.INTERNAL_ERROR,
        requestHeaders: {
          'x-ms-client-principal': request.headers.get('x-ms-client-principal') || '',
          'content-type': request.headers.get('content-type') || ''
        }
      }
    );
    
    return {
      status: 500,
      jsonBody: {
        error: {
          code: CaptureErrorCode.INTERNAL_ERROR,
          message: 'Failed to initiate capture request',
          details: error.message,
          timestamp: Date.now()
        }
      }
    };
  }
}

// Register the Azure Function with Durable Client input binding
app.http('initiateImageCapture', {
  methods: ['POST'],
  route: 'sessions/{sessionId}/capture/initiate',
  authLevel: 'anonymous',
  extraInputs: [df.input.durableClient()],
  handler: initiateImageCapture
});
