# CaptureRequests Table Partition Key Change

## Change Summary

Changed the CaptureRequests table from using a constant partition key to using `sessionId` as the partition key for better data partitioning and query performance.

## Before (Constant Partition Key)
```typescript
partitionKey: 'CAPTURE_REQUEST'  // All records in one partition
rowKey: captureRequestId
```

## After (Session-based Partition Key)
```typescript
partitionKey: sessionId  // Partitioned by session
rowKey: captureRequestId
```

## Benefits

1. **Better Partitioning**: Capture requests are distributed across partitions by session
2. **Improved Scalability**: Avoids single partition bottleneck
3. **Logical Grouping**: All captures for a session are in the same partition
4. **Better Query Performance**: Can efficiently query all captures for a session

## Files Changed

### Type Definition
- `backend/src/types/studentImageCapture.ts` - Updated CaptureRequest interface

### Storage Utilities
- `backend/src/utils/captureStorage.ts`
  - `getCaptureRequest(sessionId, captureRequestId)` - Added sessionId parameter
  - `updateCaptureRequest(sessionId, captureRequestId, updates)` - Added sessionId parameter

### Backend Functions
- `backend/src/functions/initiateImageCapture.ts` - Use sessionId as partition key when creating
- `backend/src/functions/notifyImageUpload.ts` - Pass sessionId to get/update calls
- `backend/src/functions/analyzeCaptureImages.ts` - Pass sessionId to getCaptureRequest
- `backend/src/functions/getCaptureResults.ts` - Pass sessionId to getCaptureRequest
- `backend/src/functions/deleteCaptureRequest.ts` - Use sessionId for get/delete operations
- `backend/src/functions/processCaptureTimeoutActivity.ts` - Query to find sessionId, then use it

## Migration Note

**Existing data**: Old records with `partitionKey: 'CAPTURE_REQUEST'` will not be accessible with the new code. 

**Options**:
1. **Clean slate**: Delete old CaptureRequests table data (recommended for development)
2. **Migration script**: Create a script to copy old records to new partition keys
3. **Dual read**: Add fallback logic to check old partition key if not found in new

For development environment, simply clearing the table is the easiest approach since capture requests are temporary (expire after 30 seconds).

## Testing

After deployment:
1. Initiate a new capture request
2. Verify it's stored with sessionId as partition key
3. Test upload notification
4. Test capture results retrieval
5. Test capture deletion

All operations should work correctly with the new partition key structure.
