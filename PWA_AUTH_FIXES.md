# PWA and Authentication Fixes

## Issues Resolved

### 1. PWA Icon Loading Error ✅
**Problem:** Console error showing icon-192.png download error or invalid image

**Root Cause:** The PNG icons were only 853 bytes each (placeholder-sized), not proper PWA icons

**Solution:**
- Created `frontend/scripts/generate-icons.js` to generate proper PNG icons from SVG
- Installed `sharp` package for high-quality image conversion
- Generated new icons:
  - `icon-192.png`: 3.5KB (192x192 pixels)
  - `icon-512.png`: 13KB (512x512 pixels)
- Added `npm run generate-icons` script for easy regeneration

### 2. Deprecated Meta Tag Warning ✅
**Problem:** Console warning about deprecated `apple-mobile-web-app-capable` meta tag

**Solution:**
- Added `<meta name="mobile-web-app-capable" content="yes" />` to `_app.tsx`
- Kept the Apple-specific tag for iOS compatibility
- Both tags now work together for cross-platform PWA support

### 3. Azure AD Login Redirect Failure ✅
**Problem:** No login redirect happening when accessing protected routes

**Root Cause:** Azure AD app registration had placeholder redirect URI instead of actual Static Web App URL

**Mismatch:**
- Configured: `https://your-static-web-app.azurestaticapps.net/.auth/login/aad/callback`
- Actual: `https://red-grass-0f8bc910f.4.azurestaticapps.net/.auth/login/aad/callback`

**Solution:**
- Updated Azure AD app registration (App ID: `dc482c34-ebaa-4239-aca3-2810a4f51728`) with correct redirect URI
- Fixed `staticwebapp.config.json` with actual tenant ID: `8ff7db19-435d-4c3c-83d3-ca0a46234f51`
- Verified Static Web App settings contain correct AAD_CLIENT_ID and AAD_CLIENT_SECRET

## Deployment Status ✅

**Deployed successfully at:** 2026-02-03 08:49 UTC

All automated tests passed:
- ✓ icon-192.png: 3,547 bytes (valid size)
- ✓ icon-512.png: 13,161 bytes (valid size)  
- ✓ mobile-web-app-capable meta tag present
- ✓ apple-mobile-web-app-capable meta tag present
- ✓ Manifest has 2 icons configured
- ✓ Azure AD redirect URI correctly configured
- ✓ AAD_CLIENT_ID configured
- ✓ TENANT_ID configured

## Verification Steps

After deployment completes:

1. **Check PWA Icons:**
   - Open browser DevTools → Application → Manifest
   - Verify both 192x192 and 512x512 icons load successfully
   - Check for no console errors about icon loading

2. **Check Meta Tags:**
   - View page source
   - Confirm both `mobile-web-app-capable` and `apple-mobile-web-app-capable` are present
   - No deprecation warnings in console

3. **Test Authentication:**
   - Navigate to `https://red-grass-0f8bc910f.4.azurestaticapps.net`
   - Should automatically redirect to Azure AD login
   - After login, should redirect back to app with user authenticated
   - Check `/.auth/me` endpoint to verify user claims

## Configuration Details

### Azure AD App Registration
- **App ID:** `dc482c34-ebaa-4239-aca3-2810a4f51728`
- **Tenant ID:** `8ff7db19-435d-4c3c-83d3-ca0a46234f51`
- **Redirect URI:** `https://red-grass-0f8bc910f.4.azurestaticapps.net/.auth/login/aad/callback`

### Static Web App
- **Name:** `swa-qrattendance-dev2`
- **URL:** `https://red-grass-0f8bc910f.4.azurestaticapps.net`
- **Resource Group:** `rg-qr-attendance-dev`

## Files Modified

1. `frontend/src/pages/_app.tsx` - Added mobile-web-app-capable meta tag
2. `frontend/public/icon-192.png` - Regenerated with proper size
3. `frontend/public/icon-512.png` - Regenerated with proper size
4. `frontend/scripts/generate-icons.js` - Created icon generation script
5. `frontend/package.json` - Added generate-icons script and sharp dependency
6. `staticwebapp.config.json` - Fixed tenant ID in auth configuration

## Next Steps

If issues persist after deployment:

1. **Clear browser cache** - PWA assets are heavily cached
2. **Check Azure AD app roles** - Ensure users have "teacher" or "student" roles assigned
3. **Verify app settings** - Run: `az staticwebapp appsettings list --name swa-qrattendance-dev2`
4. **Check deployment logs** - Verify the new config was deployed successfully
