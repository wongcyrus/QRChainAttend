# Authentication Headers Refactoring

## Problem

Multiple files manually construct `x-ms-client-principal` headers with inconsistent patterns, causing authentication failures in production.

## Root Cause

When the frontend calls an external Azure Function App (not integrated with Static Web App), authentication headers must be:
1. Fetched from `/.auth/me` in production
2. Formatted as base64-encoded `x-ms-client-principal` header
3. Included in every API request

Currently, this logic is duplicated across 9+ files with inconsistent implementations.

## Solution

Created centralized utility: `frontend/src/utils/authHeaders.ts`

### Features
- ✅ Consistent auth header handling
- ✅ 5-minute caching to reduce auth API calls
- ✅ Works in both local and production environments
- ✅ Proper error handling
- ✅ TypeScript typed

### Usage

```typescript
import { getAuthHeaders } from '../utils/authHeaders';

// Before making API call
const headers = await getAuthHeaders();

const response = await fetch(`${apiUrl}/endpoint`, {
  method: 'POST',
  credentials: 'include',
  headers,  // Use the headers from utility
  body: JSON.stringify(data)
});
```

## Files Status

### ✅ Fixed
- `frontend/src/components/SnapshotManager.tsx` (4 functions)

### ⚠️ Need Fixing (Priority Order)

#### High Priority (Core Functionality)
1. **frontend/src/pages/teacher.tsx** (5 locations)
   - Main teacher page entry point
   - Session list loading
   - Session operations

2. **frontend/src/pages/student.tsx** (2 locations)
   - Main student page entry point
   - Session joining

3. **frontend/src/components/TeacherDashboard.tsx** (2 locations)
   - Session details loading
   - Real-time updates

4. **frontend/src/components/SimpleStudentView.tsx** (4 locations)
   - Student session view
   - Chain scanning
   - Token fetching

#### Medium Priority (Features)
5. **frontend/src/components/ChainManagementControls.tsx** (4 locations)
   - Seed entry chains
   - Start exit chains
   - Close chains
   - Set holder

6. **frontend/src/components/SessionCreationForm.tsx** (2 locations)
   - Create session
   - Update session

7. **frontend/src/components/SessionEndAndExportControls.tsx** (3 locations)
   - End session
   - Export attendance (2 formats)

#### Low Priority (Secondary Features)
8. **frontend/src/components/StudentSessionView.tsx** (2 locations)
   - Alternative student view

9. **frontend/src/components/ChainVisualization.tsx** (1 location)
   - Chain history display

## Migration Pattern

### Before (Inconsistent)
```typescript
const headers: HeadersInit = { 'Content-Type': 'application/json' };

const isLocal = process.env.NEXT_PUBLIC_ENVIRONMENT === 'local';
if (isLocal) {
  const mockPrincipal = {
    userId: 'mock-teacher-id',
    userDetails: 'teacher@vtc.edu.hk',
    userRoles: ['authenticated', 'teacher'],
    identityProvider: 'aad'
  };
  headers['x-ms-client-principal'] = Buffer.from(JSON.stringify(mockPrincipal)).toString('base64');
} else {
  const authResponse = await fetch('/.auth/me', { credentials: 'include' });
  const authData = await authResponse.json();
  if (authData.clientPrincipal) {
    headers['x-ms-client-principal'] = Buffer.from(JSON.stringify(authData.clientPrincipal)).toString('base64');
  } else {
    throw new Error('Not authenticated');
  }
}

const response = await fetch(`${apiUrl}/endpoint`, {
  method: 'POST',
  headers,
  body: JSON.stringify(data)
});
```

### After (Consistent)
```typescript
import { getAuthHeaders } from '../utils/authHeaders';

const headers = await getAuthHeaders();

const response = await fetch(`${apiUrl}/endpoint`, {
  method: 'POST',
  credentials: 'include',  // Important: Always include credentials
  headers,
  body: JSON.stringify(data)
});
```

## Benefits

1. **Consistency**: All files use the same authentication logic
2. **Performance**: Caching reduces redundant auth API calls
3. **Maintainability**: Single place to update auth logic
4. **Reliability**: Tested and working in production
5. **Type Safety**: TypeScript ensures correct usage

## Testing Checklist

After updating each file:
- [ ] Local development works (mock auth)
- [ ] Production authentication works
- [ ] API calls succeed with proper headers
- [ ] No 401 Unauthorized errors
- [ ] No 403 Forbidden errors

## Deployment

After fixing all files:
```bash
./deploy-production.sh
```

## Related Issues

- CORS configuration: Already fixed (credentials support enabled)
- Credentials in fetch: Already fixed (all fetch calls include credentials)
- Auth headers: In progress (this refactoring)

## Timeline

- **Phase 1** (Completed): Create utility and fix SnapshotManager
- **Phase 2** (Recommended): Fix high-priority files (teacher, student pages)
- **Phase 3** (Recommended): Fix medium-priority files (features)
- **Phase 4** (Optional): Fix low-priority files (secondary features)

## Notes

- The utility caches auth principal for 5 minutes
- Cache can be cleared with `clearAuthCache()` if needed
- Local development uses mock teacher credentials
- Production fetches from `/.auth/me` endpoint
