# Authentication State Fix

## Problem
The login/logout panel was not updating after authentication without a hard refresh. Users would log in or out, but the UI would still show the old state.

## Root Causes

1. **Stale State on Navigation**: The auth state check in `index.tsx` only ran once on component mount. When users returned from the Azure AD redirect, the component didn't re-fetch the authentication state.

2. **Service Worker Caching**: The service worker was potentially caching the `/.auth/me` endpoint, serving stale authentication data.

3. **No Cache-Control Headers**: The fetch request didn't include cache-busting headers, allowing browsers to serve cached responses.

## Solutions Implemented

### 1. Added Visibility Change Listener (`frontend/src/pages/index.tsx`)
- Added a `visibilitychange` event listener that re-checks auth state when the page becomes visible
- This handles cases where users navigate back after login/logout
- Includes proper cache-busting headers in fetch requests

### 2. Updated Service Worker (`frontend/public/sw.js`)
- Added explicit bypass for all `/.auth/*` endpoints
- These endpoints now always fetch fresh from the network, never from cache
- Bumped cache version from v1 to v2 to force cache refresh

### 3. Cache-Control Headers
- Added `cache: 'no-store'` to fetch options
- Added explicit `Cache-Control` and `Pragma` headers to prevent any caching

## Testing
After deploying these changes:
1. Log in - the UI should immediately show the logged-in state
2. Log out - the UI should immediately show the login button
3. No hard refresh should be required

## Technical Details

```typescript
// Before: Only checked auth on mount
useEffect(() => {
  fetch('/.auth/me')
    .then(...)
}, []);

// After: Checks on mount AND when page becomes visible
useEffect(() => {
  fetch('/.auth/me', {
    cache: 'no-store',
    headers: { 'Cache-Control': 'no-cache, no-store, must-revalidate' }
  })
    .then(...)
}, []);

useEffect(() => {
  const handleVisibilityChange = () => {
    if (document.visibilityState === 'visible') {
      // Re-fetch auth state
    }
  };
  document.addEventListener('visibilitychange', handleVisibilityChange);
  return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
}, []);
```

```javascript
// Service Worker: Never cache auth endpoints
if (url.pathname.startsWith('/.auth/')) {
  event.respondWith(fetch(request));
  return;
}
```
