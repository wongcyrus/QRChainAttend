# Teacher View Image Issue - Container Name Fix

## Problem
Teachers cannot view student images in the capture results because of container name mismatch in stored URLs.

## Root Cause

**Old database records contain wrong container name:**

When images were uploaded before the fix, the `CaptureUploads` table stored:
```
blobUrl: "https://{account}.blob.core.windows.net/attendee-captures/{sessionId}/{captureId}/{attendeeId}.jpg"
```

But the actual blobs are in:
```
Container: student-captures
```

When teacher tries to view images:
1. Backend reads `blobUrl` from `CaptureUploads` table
2. `generateReadSasUrl()` extracts container name from URL → `attendee-captures`
3. Generates SAS token for wrong container
4. Image fails to load (container doesn't exist)

## Flow

```
Student Upload (Fixed) → student-captures container ✅
                      ↓
Database Record (Old) → blobUrl with "attendee-captures" ❌
                      ↓
Teacher View → generateReadSasUrl() → Wrong container → Image not found ❌
```

## Fix Applied

Added fallback in `generateReadSasUrl()` to handle legacy container names:

**File**: `backend/src/utils/blobStorage.ts`

```typescript
export function generateReadSasUrl(blobUrl: string): string {
  // ... extract container and blob name ...
  
  let containerName = pathParts[0];
  const blobName = pathParts.slice(1).join('/');

  // Fix: Handle legacy 'attendee-captures' container name
  // Old records may have 'attendee-captures' but actual container is 'student-captures'
  if (containerName === 'attendee-captures') {
    containerName = 'student-captures';
  }

  // ... generate SAS token with corrected container name ...
}
```

## What This Fixes

✅ **New uploads**: Already work (using correct container)
✅ **Old uploads**: Now work (container name corrected during SAS generation)
✅ **Teacher view**: Can now see all images regardless of when they were uploaded

## Alternative Solutions Considered

1. **Update all database records**: Would require migration script, risky
2. **Store blob name only**: Would require schema change
3. **Runtime correction** (chosen): Simple, safe, backward compatible

## Testing

After deployment:
1. Teacher initiates image capture
2. Students upload images
3. Teacher views capture results
4. All student images should display correctly
5. Old capture results should also work

## Related Files

- `backend/src/utils/blobStorage.ts` - SAS URL generation (fixed)
- `backend/src/functions/notifyImageUpload.ts` - Stores blobUrl in database
- `backend/src/functions/getCaptureResults.ts` - Retrieves images for teacher view
- `infrastructure/modules/storage.bicep` - Creates `student-captures` container
