# Container Not Found Error - Root Cause Analysis

## Issue
Students uploading images receive "container not found" error when the backend tries to verify the blob exists.

## Root Cause
**Container name mismatch between infrastructure and backend code:**

- **Infrastructure** (`infrastructure/modules/storage.bicep`): Creates container named `student-captures`
- **Backend code** (`backend/src/utils/blobStorage.ts`): Was using `attendee-captures`
- **Inconsistency** (`backend/src/functions/deleteCaptureRequest.ts`): Was hardcoded to `student-captures`

## Flow Where Error Occurs

1. **Student uploads image** → Frontend calls `PUT` to SAS URL
2. **SAS URL generated** with blob path: `student-captures/{sessionId}/{captureRequestId}/{attendeeId}.jpg`
3. **Image uploads successfully** to blob storage
4. **Frontend notifies backend** → `POST /api/sessions/{sessionId}/capture/{captureRequestId}/upload`
5. **Backend verifies blob exists** → Calls `verifyBlobExists(blobName)`
6. **Error occurs here** → Backend looks in `attendee-captures` container (wrong name)
7. **Container not found** → Returns 400 error to student

## Fix Applied

Changed constant in `backend/src/utils/blobStorage.ts`:

```typescript
// Before
export const STUDENT_CAPTURES_CONTAINER = 'attendee-captures';

// After
export const STUDENT_CAPTURES_CONTAINER = 'student-captures';
```

## Files Using This Constant

1. ✅ `backend/src/utils/blobStorage.ts` - `generateStudentSasUrl()`, `verifyBlobExists()`
2. ✅ `backend/src/functions/notifyImageUpload.ts` - Imports constant for blob URL construction
3. ⚠️ `backend/src/functions/deleteCaptureRequest.ts` - Was hardcoded, now will use correct constant

## Verification Needed

After deployment:
1. Student should be able to upload image successfully
2. Backend should verify blob exists in correct container
3. Upload notification should complete without errors
4. Image should appear in organizer's capture results

## Related Code Locations

- **Container creation**: `infrastructure/modules/storage.bicep:214`
- **SAS URL generation**: `backend/src/utils/blobStorage.ts:65-110`
- **Blob verification**: `backend/src/utils/blobStorage.ts:185-226`
- **Upload notification**: `backend/src/functions/notifyImageUpload.ts:45-361`
- **Frontend upload**: `frontend/src/components/AttendeeCaptureUI.tsx:380-450`

## Prevention

The infrastructure uses `student-captures` consistently. Backend should always import and use the `STUDENT_CAPTURES_CONTAINER` constant rather than hardcoding container names.
