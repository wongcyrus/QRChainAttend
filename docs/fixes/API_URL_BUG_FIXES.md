# API URL Bug Fixes

## Issue
Several fetch calls were missing `apiUrl` prefix, causing them to fail in production deployment where the API is at a different URL than the frontend.

## Fixed Components

### 1. CaptureHistory.tsx - Delete Capture
**Before:**
```typescript
const response = await fetch(`/api/sessions/${sessionId}/captures/${captureRequestId}`, {
  method: 'DELETE',
  headers
});
```

**After:**
```typescript
const apiUrl = process.env.NEXT_PUBLIC_API_URL || '/api';
const response = await fetch(`${apiUrl}/sessions/${sessionId}/captures/${captureRequestId}`, {
  method: 'DELETE',
  credentials: 'include',
  headers
});
```

### 2. RotatingQRDisplay.tsx - Start Early Leave
**Before:**
```typescript
const response = await fetch(`/api/sessions/${sessionId}/start-early-leave`, { 
  credentials: 'include',
  method: 'POST',
});
```

**After:**
```typescript
const apiUrl = process.env.NEXT_PUBLIC_API_URL || '/api';
const response = await fetch(`${apiUrl}/sessions/${sessionId}/start-early-leave`, { 
  credentials: 'include',
  method: 'POST',
});
```

### 3. RotatingQRDisplay.tsx - Stop Early Leave
**Before:**
```typescript
const response = await fetch(`/api/sessions/${sessionId}/stop-early-leave`, { 
  credentials: 'include',
  method: 'POST',
});
```

**After:**
```typescript
const apiUrl = process.env.NEXT_PUBLIC_API_URL || '/api';
const response = await fetch(`${apiUrl}/sessions/${sessionId}/stop-early-leave`, { 
  credentials: 'include',
  method: 'POST',
});
```

### 4. SessionEnrollment.tsx - Join Session
**Before:**
```typescript
const response = await fetch(`/api/sessions/${sessionQRData.sessionId}/join`, { 
  credentials: 'include',
  method: 'POST',
  // ...
});
```

**After:**
```typescript
const apiUrl = process.env.NEXT_PUBLIC_API_URL || '/api';
const response = await fetch(`${apiUrl}/sessions/${sessionQRData.sessionId}/join`, { 
  credentials: 'include',
  method: 'POST',
  // ...
});
```

## Why This Matters

In production:
- Frontend: `https://{app-name}.azurestaticapps.net`
- Backend: `https://{function-app}.azurewebsites.net/api`

Without `apiUrl` prefix, fetch calls go to the wrong URL and fail.

## Pattern to Follow

Always use:
```typescript
const apiUrl = process.env.NEXT_PUBLIC_API_URL || '/api';
const response = await fetch(`${apiUrl}/your/endpoint`, {
  credentials: 'include',  // For auth cookies
  // ... other options
});
```

## Files Fixed
- `frontend/src/components/CaptureHistory.tsx`
- `frontend/src/components/RotatingQRDisplay.tsx`
- `frontend/src/components/SessionEnrollment.tsx`
