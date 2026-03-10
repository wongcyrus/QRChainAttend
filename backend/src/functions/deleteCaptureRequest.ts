/**
 * Delete Capture Request API Endpoint
 * DELETE /api/sessions/{sessionId}/capture/{captureRequestId}
 * Deletes capture request and all associated images from blob storage
 */

import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { parseAuthFromRequest, hasRole, getUserId } from '../utils/auth';
import { getTableClient, TableNames } from '../utils/database';
import { BlobServiceClient } from '@azure/storage-blob';

export async function deleteCaptureRequest(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  context.log('Processing DELETE /api/sessions/{sessionId}/capture/{captureRequestId} request');

  try {
    const sessionId = request.params.sessionId;
    const captureRequestId = request.params.captureRequestId;

    if (!sessionId || !captureRequestId) {
      return {
        status: 400,
        jsonBody: { error: { code: 'INVALID_REQUEST', message: 'Session ID and Capture Request ID required', timestamp: Date.now() } }
      };
    }

    // Authenticate
    const principal = parseAuthFromRequest(request);
    if (!principal || !hasRole(principal, 'Organizer')) {
      return {
        status: 401,
        jsonBody: { error: { code: 'UNAUTHORIZED', message: 'Organizer role required', timestamp: Date.now() } }
      };
    }

    const organizerId = getUserId(principal);

    // Verify session ownership
    const sessionsTable = getTableClient(TableNames.SESSIONS);
    let session: any;
    
    try {
      session = await sessionsTable.getEntity('SESSION', sessionId);
    } catch (error: any) {
      if (error.statusCode === 404) {
        return {
          status: 404,
          jsonBody: { error: { code: 'NOT_FOUND', message: 'Session not found', timestamp: Date.now() } }
        };
      }
      throw error;
    }

    // Check ownership
    const isOwner = session.organizerId === organizerId;
    const isCoOrganizer = session.coOrganizers?.includes(organizerId);

    if (!isOwner && !isCoOrganizer) {
      return {
        status: 403,
        jsonBody: { error: { code: 'FORBIDDEN', message: 'Not authorized to modify this session', timestamp: Date.now() } }
      };
    }

    // Get capture request to find associated images
    const captureRequestsTable = getTableClient(TableNames.CAPTURE_REQUESTS);
    let captureRequest: any;
    
    try {
      captureRequest = await captureRequestsTable.getEntity(sessionId, captureRequestId);
    } catch (error: any) {
      if (error.statusCode === 404) {
        return {
          status: 404,
          jsonBody: { error: { code: 'NOT_FOUND', message: 'Capture request not found', timestamp: Date.now() } }
        };
      }
      throw error;
    }

    // Delete images from blob storage
    const connectionString = process.env.AzureWebJobsStorage;
    if (!connectionString) {
      throw new Error('AzureWebJobsStorage not configured');
    }

    const blobServiceClient = BlobServiceClient.fromConnectionString(connectionString);
    const containerClient = blobServiceClient.getContainerClient('student-captures');
    
    let deletedImagesCount = 0;

    // Check if container exists before trying to delete blobs
    try {
      const containerExists = await containerClient.exists();
      if (containerExists) {
        // Delete all blobs with prefix: sessionId/captureRequestId/
        const prefix = `${sessionId}/${captureRequestId}/`;
        
        for await (const blob of containerClient.listBlobsFlat({ prefix })) {
          try {
            await containerClient.deleteBlob(blob.name);
            deletedImagesCount++;
            context.log(`Deleted blob: ${blob.name}`);
          } catch (error: any) {
            context.warn(`Failed to delete blob ${blob.name}:`, error.message);
          }
        }
      } else {
        context.warn('Blob container does not exist, skipping blob deletion');
      }
    } catch (error: any) {
      context.warn('Failed to access blob storage:', error.message);
    }

    // Delete from CaptureResults table
    const captureResultsTable = getTableClient(TableNames.CAPTURE_RESULTS);
    let deletedResultsCount = 0;
    
    try {
      const results = captureResultsTable.listEntities({
        queryOptions: { filter: `PartitionKey eq '${sessionId}' and captureRequestId eq '${captureRequestId}'` }
      });

      for await (const result of results) {
        await captureResultsTable.deleteEntity(result.partitionKey as string, result.rowKey as string);
        deletedResultsCount++;
      }
    } catch (error: any) {
      context.warn('Failed to delete some capture results:', error.message);
    }

    // Delete capture request
    await captureRequestsTable.deleteEntity(sessionId, captureRequestId);

    // Log deletion
    const deletionLogTable = getTableClient(TableNames.DELETION_LOG);
    const logEntry = {
      partitionKey: organizerId,
      rowKey: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      deletedEntityType: 'CaptureRequest',
      deletedEntityId: captureRequestId,
      sessionId: sessionId,
      deletedAt: new Date().toISOString(),
      deletedBy: organizerId,
      details: JSON.stringify({
        deletedImages: deletedImagesCount,
        deletedResults: deletedResultsCount
      })
    };

    await deletionLogTable.createEntity(logEntry);

    context.log(`Deleted capture request: ${captureRequestId}, ${deletedImagesCount} images, ${deletedResultsCount} results`);

    return {
      status: 200,
      jsonBody: {
        success: true,
        deletedCaptureRequestId: captureRequestId,
        sessionId: sessionId,
        deletedImages: deletedImagesCount,
        deletedResults: deletedResultsCount
      }
    };

  } catch (error: any) {
    context.error('Error deleting capture request:', error);
    return {
      status: 500,
      jsonBody: {
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to delete capture request',
          details: error.message,
          timestamp: Date.now()
        }
      }
    };
  }
}

app.http('deleteCaptureRequest', {
  methods: ['DELETE'],
  authLevel: 'anonymous',
  route: 'sessions/{sessionId}/capture/{captureRequestId}/delete',
  handler: deleteCaptureRequest
});
