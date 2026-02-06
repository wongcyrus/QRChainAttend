# Backend Deployment Fix

## Problem

The backend was part of an npm workspace, which caused `node_modules` to be installed at the root level instead of in the `backend/` folder. This resulted in incomplete deployments (only 293 KB instead of 27+ MB) because the Azure Functions deployment tool only packages files within the `backend/` folder.

## Solution

The backend has been **removed from the workspace** configuration to allow it to have its own independent `node_modules` folder.

## Changes Made

### 1. Root `package.json`
- Removed `backend` from the `workspaces` array
- Updated scripts to use `--prefix backend` instead of `--workspace=backend`

### 2. Backend Dependencies
The backend now has its own complete `node_modules` folder (154 MB) with all required Azure packages:
- `@azure/data-tables`
- `@azure/functions`
- `@azure/identity`
- `@azure/web-pubsub`

## Deployment Instructions

### First Time Setup (After Workspace Change)

```bash
# 1. Clean any existing backend node_modules
cd backend
rm -rf node_modules package-lock.json

# 2. Install dependencies independently
npm install

# 3. Verify dependencies are installed
ls node_modules/@azure/
# Should show: data-tables, functions, identity, web-pubsub, etc.

# 4. Build and deploy
npm run build
func azure functionapp publish func-qrattendance-dev --javascript
```

### Regular Deployment

```bash
cd backend

# Build TypeScript
npm run build

# Deploy to Azure
func azure functionapp publish func-qrattendance-dev --javascript
```

Or use the deploy script:

```bash
cd backend
./deploy.sh
```

## Verification

After deployment, you should see:
- **Package size**: ~27 MB (not 293 KB)
- **Function count**: 29 functions (not 6)
- All functions listed in the deployment output

### Check Deployed Functions

```bash
az functionapp function list \
  --name func-qrattendance-dev \
  --resource-group rg-qr-attendance-dev \
  --query "[].name" \
  --output table
```

Should show all 29 functions:
- checkSession
- clearSession
- createSession
- endSession
- getAttendance
- getEarlyQR
- getLateQR
- getRoles
- getSession
- getStudentToken
- getTeacherSessions ✅
- getUserRoles
- joinSession
- negotiate
- negotiateDashboard
- negotiateStudent
- registerSession
- reseedEntry
- reseedExit
- rotateTokens
- scanChain
- scanEarlyLeave
- scanExitChain
- scanLateEntry
- seedEntry
- startEarlyLeave
- startExitChain
- stopEarlyLeave
- studentOnline

## Troubleshooting

### Problem: Small package size (< 1 MB)

**Cause**: Dependencies not installed in `backend/node_modules`

**Solution**:
```bash
cd backend
rm -rf node_modules
npm install
```

### Problem: Missing @azure packages

**Cause**: Workspace configuration still active

**Solution**:
1. Verify root `package.json` doesn't include `backend` in `workspaces`
2. Delete `backend/node_modules`
3. Run `npm install` in the `backend` folder

### Problem: Functions not showing in Azure Portal

**Cause**: Incomplete deployment

**Solution**:
1. Ensure `backend/node_modules` exists and is ~154 MB
2. Redeploy with `func azure functionapp publish func-qrattendance-dev --javascript`
3. Wait 30 seconds and refresh Azure Portal

## Package Size Reference

| Status | Package Size | Function Count | Issue |
|--------|-------------|----------------|-------|
| ❌ Broken | 293 KB | 6 | Missing node_modules |
| ✅ Working | 27+ MB | 29 | Complete deployment |

## Important Notes

1. **Always install dependencies in the backend folder** before deploying
2. **Never use workspace commands** for backend (use `--prefix backend` instead)
3. **Verify package size** in deployment output (should be 20+ MB)
4. **Check function count** after deployment (should be 29)

## Related Files

- `backend/package.json` - Backend dependencies
- `backend/deploy.sh` - Deployment script
- `package.json` - Root workspace configuration (backend removed)

---

**Last Updated**: February 6, 2026  
**Status**: ✅ Fixed - Backend is now independent from workspace
