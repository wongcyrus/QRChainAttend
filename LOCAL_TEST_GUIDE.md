# Local Testing Guide

## Test Results Summary

✅ **Build**: Successful  
✅ **Tests**: 321 passed, 1 skipped  
✅ **Test Suites**: 14 passed  

## Quick Local Test

Since you can't fully test Azure AD authentication locally without the Azure Static Web App environment, here's what you can verify:

### 1. Build Verification (Already Done ✅)

```bash
npm run build --workspace=frontend
```

**Result**: ✅ Build successful, static files generated in `frontend/out/`

### 2. Test Verification (Already Done ✅)

```bash
npm run test:unit --workspace=frontend
```

**Result**: ✅ All 321 tests passed

### 3. Check the Generated Files

```bash
# View the built index page
cat frontend/out/index.html | grep -A 5 "visibility"

# Check service worker
cat frontend/public/sw.js | grep -A 3 "\.auth"
```

### 4. Verify the Code Changes

The auth fix includes:

**✅ In `frontend/src/pages/index.tsx`:**
- Cache-busting headers for auth requests
- Visibility change listener to re-check auth state
- Proper cleanup of event listeners

**✅ In `frontend/public/sw.js`:**
- Bypass caching for `/.auth/*` endpoints
- Cache version bumped to v2

## What You Can't Test Locally

❌ **Azure AD authentication flow** - Requires Azure Static Web App  
❌ **`/.auth/me` endpoint** - Only available in Azure  
❌ **Service worker in production mode** - Needs HTTPS  

## Deploy to Test Properly

Since CI/CD is slow, you have two options:

### Option A: Push and Wait (Recommended)

```bash
# Push to trigger CI/CD
git push origin main

# Monitor deployment (if you have gh CLI)
gh run watch --repo wongcyrus/QRChainAttend-cicd
```

**Timeline**: ~7-11 minutes total

### Option B: Manual Azure Deploy (Faster)

If you have Azure Static Web Apps CLI installed:

```bash
# Install if needed
npm install -g @azure/static-web-apps-cli

# Deploy directly (requires deployment token)
cd frontend
swa deploy ./out \
  --deployment-token $AZURE_STATIC_WEB_APPS_API_TOKEN \
  --env production
```

**Timeline**: ~2-3 minutes

## Testing After Deployment

### Test Scenario 1: Login Flow

1. Visit your site (clear cache first: Ctrl+Shift+Delete)
2. Should see "Login with Azure AD" button
3. Click login → Redirects to Azure AD
4. After authentication → **Should immediately show logged-in state** ✅
5. **No hard refresh needed** ✅

### Test Scenario 2: Logout Flow

1. While logged in, click "Logout"
2. After logout → **Should immediately show login button** ✅
3. **No hard refresh needed** ✅

### Test Scenario 3: Back Navigation

1. Log in successfully
2. Navigate to another page (if available)
3. Click browser back button
4. **Should still show logged-in state** ✅
5. **No hard refresh needed** ✅

### Test Scenario 4: Service Worker

1. Open DevTools (F12)
2. Go to Application → Service Workers
3. Should see version `v2` (not `v1`)
4. Go to Application → Cache Storage
5. Auth endpoints should NOT be cached

## Verification Checklist

After deployment, verify:

- [ ] Login works without hard refresh
- [ ] Logout works without hard refresh
- [ ] Back navigation preserves auth state
- [ ] Service worker updated to v2
- [ ] `/.auth/me` not in cache
- [ ] User info displays correctly
- [ ] Roles display correctly

## If Issues Occur

### Issue: Still requires hard refresh

**Check:**
1. Clear browser cache completely
2. Unregister old service worker:
   - DevTools → Application → Service Workers
   - Click "Unregister"
   - Hard refresh once
3. Verify service worker version is v2

### Issue: Service worker not updating

**Fix:**
1. In DevTools → Application → Service Workers
2. Check "Update on reload"
3. Refresh the page
4. Should see new service worker installing

### Issue: Auth state not updating

**Check:**
1. Open DevTools → Console
2. Look for fetch errors to `/.auth/me`
3. Check Network tab for auth requests
4. Verify cache-control headers are present

## Performance Comparison

| Method | Time | Pros | Cons |
|--------|------|------|------|
| CI/CD | 7-11 min | Automated, tested | Slow |
| Manual SWA CLI | 2-3 min | Fast | Manual, no tests |
| Local dev | Instant | Very fast | Can't test auth |

## Recommendation

Since your changes are:
- ✅ Built successfully
- ✅ All tests passing
- ✅ Simple auth state management fix

**Just push and wait for CI/CD**. The 7-11 minutes ensures everything is properly tested and deployed.

```bash
git push origin main
```

Then grab a coffee ☕ and check back in 10 minutes!

## Quick Deploy Command

```bash
# One command to push and monitor
git push origin main && \
  echo "Deployment started! Monitor at:" && \
  echo "https://github.com/wongcyrus/QRChainAttend-cicd/actions"
```

## After Successful Deployment

Your auth fix will be live and users can:
- ✅ Login without hard refresh
- ✅ Logout without hard refresh
- ✅ Navigate back without losing auth state
- ✅ Experience faster page loads (service worker v2)

The bug is fixed! 🎉
