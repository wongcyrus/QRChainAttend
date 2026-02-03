# Manual Deployment Guide

## Quick Deploy (2-3 minutes)

### Step 1: Get Your Deployment Token

You need the Azure Static Web Apps deployment token. Here's how to get it:

#### Option A: From Azure Portal (Recommended)

1. Go to [Azure Portal](https://portal.azure.com)
2. Navigate to your Static Web App resource
3. In the left menu: **Settings** → **Configuration**
4. Find **Deployment token** section
5. Click **Manage deployment token**
6. Copy the token (it's a long string starting with something like `0123456789...`)

#### Option B: Using Azure CLI

```bash
# List your static web apps
az staticwebapp list --output table

# Get the deployment token
az staticwebapp secrets list \
    --name <your-static-web-app-name> \
    --resource-group <your-resource-group> \
    --query "properties.apiKey" -o tsv
```

### Step 2: Set the Token as Environment Variable

```bash
# Set the token (replace with your actual token)
export AZURE_STATIC_WEB_APPS_API_TOKEN='your-deployment-token-here'
```

**Important**: Keep this token secret! Don't commit it to git.

### Step 3: Run the Deployment Script

```bash
# Deploy
./manual-deploy.sh
```

That's it! The script will:
1. ✅ Check if build exists (builds if needed)
2. ✅ Deploy to Azure Static Web Apps
3. ✅ Show deployment status

**Timeline**: ~2-3 minutes

## Alternative: Manual Commands

If you prefer to run commands manually:

```bash
# 1. Build (if not already done)
npm run build --workspace=frontend

# 2. Set token
export AZURE_STATIC_WEB_APPS_API_TOKEN='your-token-here'

# 3. Deploy
cd frontend
swa deploy ./out \
    --deployment-token "$AZURE_STATIC_WEB_APPS_API_TOKEN" \
    --env production
```

## What Gets Deployed

Your auth fix changes:
- ✅ `frontend/src/pages/index.tsx` - Visibility change listener
- ✅ `frontend/public/sw.js` - Service worker v2 with auth bypass
- ✅ All static assets from `frontend/out/`

## After Deployment

### Test the Fix

1. **Clear browser cache** (Ctrl+Shift+Delete)
2. **Visit your site**
3. **Test login**:
   - Click "Login with Azure AD"
   - Authenticate
   - Should show logged-in state **immediately** ✅
   - **No hard refresh needed** ✅

4. **Test logout**:
   - Click "Logout"
   - Should show login button **immediately** ✅
   - **No hard refresh needed** ✅

5. **Test back navigation**:
   - Log in
   - Navigate away (if possible)
   - Click browser back
   - Should preserve auth state ✅

### Verify Service Worker

1. Open DevTools (F12)
2. Go to **Application** → **Service Workers**
3. Should see version `v2` (updated from `v1`)
4. Go to **Application** → **Cache Storage**
5. Verify `/.auth/me` is NOT cached

## Troubleshooting

### Error: "Deployment token is invalid"

**Solution**: Get a fresh token from Azure Portal

### Error: "Static Web App not found"

**Solution**: Verify the token is for the correct Static Web App

### Error: "Build not found"

**Solution**: Run `npm run build --workspace=frontend` first

### Deployment succeeds but changes not visible

**Solution**:
1. Clear browser cache completely
2. Unregister old service worker:
   - DevTools → Application → Service Workers
   - Click "Unregister"
3. Hard refresh once (Ctrl+Shift+R)
4. After that, no more hard refresh needed!

## Security Note

⚠️ **Never commit the deployment token to git!**

The token is already in `.gitignore` if you save it to a file, but it's safer to use it as an environment variable.

## Comparison: Manual vs CI/CD

| Method | Time | When to Use |
|--------|------|-------------|
| Manual Deploy | 2-3 min | Quick fixes, testing |
| CI/CD | 7-11 min | Production, automated testing |

For this auth fix, manual deploy is perfect since:
- ✅ Tests already passed locally
- ✅ Build is successful
- ✅ Simple frontend-only change
- ✅ Want to see results quickly

## Next Steps

After successful manual deployment:

1. ✅ Test the auth fix works
2. ✅ Verify service worker updated
3. ✅ Commit and push to git (for backup)
4. ✅ Let CI/CD run in background (optional)

## Quick Reference

```bash
# Get token from Azure CLI
az staticwebapp secrets list \
    --name <app-name> \
    --resource-group <rg-name> \
    --query "properties.apiKey" -o tsv

# Set token
export AZURE_STATIC_WEB_APPS_API_TOKEN='token-here'

# Deploy
./manual-deploy.sh
```

## Success!

Once deployed, your users can:
- ✅ Login without hard refresh
- ✅ Logout without hard refresh  
- ✅ Navigate without losing auth state
- ✅ Experience faster loads (service worker v2)

The auth bug is fixed! 🎉
