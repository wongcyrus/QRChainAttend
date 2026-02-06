# Deployment History & Fixes

This document tracks all deployment issues, fixes, and feature additions to the QR Chain Attendance system.

## Current Production Status

**Backend**: `https://func-qrattendance-dev.azurewebsites.net`
- 29 Azure Functions deployed
- Node.js 20 runtime
- Status: Running

**Frontend**: `https://red-grass-0f8bc910f.4.azurestaticapps.net`
- Next.js Static Web App
- Status: Running

---

## Issue 1: Backend Workspace Problem (Fixed)

**Date**: February 6, 2026

**Problem**: Backend was part of npm workspace, causing dependencies to install at root level. Only 6 functions were deploying instead of 29, with package size of 293KB instead of expected 27+ MB.

**Solution**: 
- Removed backend from workspace configuration in root `package.json`
- Backend now has independent `node_modules` folder (154 MB)
- All 29 functions now deploy correctly

**Files Modified**: `package.json`, `backend/package.json`

---

## Issue 2: Static Web App Backend Linking Conflict (Fixed)

**Date**: February 6, 2026

**Problem**: Function App was linked to Static Web App, causing authentication conflicts with Table Storage. Error: "Login not supported for provider azureStaticWebApps"

**Solution**: 
- Unlinked Function App from Static Web App using `az staticwebapp backends unlink`
- Backend and frontend now operate independently

**Command Used**:
```bash
az staticwebapp backends unlink \
  --name swa-qrattendance-dev2 \
  --resource-group rg-qrattendance-dev
```

---

## Issue 3: Route Conflict - sessions/teacher (Fixed)

**Date**: February 6, 2026

**Problem**: Route `/api/sessions/teacher` conflicted with `/api/sessions/{sessionId}` where "teacher" was treated as sessionId, causing 404 errors.

**Solution**: 
- Changed route from `/api/sessions/teacher` to `/api/teacher/sessions`
- Updated backend function and all frontend API calls

**Files Modified**: 
- `backend/src/functions/getTeacherSessions.ts`
- `frontend/src/pages/teacher.tsx`

---

## Issue 4: Email-Based Role Assignment (Implemented)

**Date**: February 6, 2026

**Problem**: Azure AD role assignment was complex and not working reliably. No roles were being assigned to users.

**Solution**: 
- Implemented email domain-based role assignment
- `@vtc.edu.hk` (not `@stu.vtc.edu.hk`) → Teacher role
- `@stu.vtc.edu.hk` → Student role
- Removed dependency on Azure AD roles

**Implementation**:
- Backend: Updated `hasRole()` function in all 11 functions to check email domains
- Frontend: Updated role computation in `index.tsx`, `teacher.tsx`, `student.tsx`

**Files Modified**: All functions with authorization + 3 frontend pages

---

## Issue 5: Authentication Headers Missing in Production (Fixed)

**Date**: February 6, 2026

**Problem**: Frontend only sent `x-ms-client-principal` header in local mode, causing 401/403 errors in production.

**Solution**: 
- Updated all API calls to fetch auth from `/.auth/me` in production
- Created helper utility: `frontend/src/utils/authHeaders.ts`
- Fixed in 7 files with multiple API call locations

**Pattern Used**:
```typescript
const isLocal = process.env.NEXT_PUBLIC_ENVIRONMENT === 'local';
const authEndpoint = isLocal ? '/api/auth/me' : '/.auth/me';
const authResponse = await fetch(authEndpoint, { credentials: 'include' });
const authData = await authResponse.json();

const headers: HeadersInit = {
  'Content-Type': 'application/json',
  'x-ms-client-principal': Buffer.from(JSON.stringify(authData.clientPrincipal)).toString('base64')
};
```

**Files Modified**:
- `SessionCreationForm.tsx`
- `TeacherDashboard.tsx`
- `SimpleStudentView.tsx`
- `teacher.tsx`
- `student.tsx`
- `SessionEndAndExportControls.tsx`

---

## Issue 6: Backend Role Checking (Fixed)

**Date**: February 6, 2026

**Problem**: Backend functions had old `hasRole()` implementation that only checked `userRoles` array from Azure AD, which was always `["anonymous", "authenticated"]`.

**Solution**: 
- Updated `hasRole()` in all 11 backend functions to check email domains
- Functions now recognize `@vtc.edu.hk` as teacher and `@stu.vtc.edu.hk` as student

**Functions Updated**:
- createSession
- endSession
- getAttendance
- getSession
- getStudentToken
- getTeacherSessions
- joinSession
- negotiateStudent
- scanChain
- seedEntry
- stopEarlyLeave

---

## Issue 7: Frontend Role Computation Loop (Fixed)

**Date**: February 6, 2026

**Problem**: Frontend checked `clientPrincipal.userRoles` which only had `["anonymous", "authenticated"]`, causing infinite redirect loops on student page.

**Solution**: 
- Changed to always call `getRolesFromEmail()` instead of using Azure AD roles
- Fixed infinite refresh loop on student page

**Files Modified**: `frontend/src/pages/student.tsx`

---

## Issue 8: Production Build Environment (Fixed)

**Date**: February 6, 2026

**Problem**: `.env.local` was overriding production settings during build, causing wrong redirects to mock-login.

**Solution**: 
- Updated deployment script to temporarily remove `.env.local` during production build
- Created `.env.production` with correct production settings
- Script restores `.env.local` after build

**Files Modified**: 
- `frontend/.env.production`
- `deploy-to-azure.sh`

---

## Feature 1: Account Switching (Implemented)

**Date**: February 6, 2026

**Feature**: Added ability to switch between different Azure AD accounts without browser cache issues.

**Implementation**:
- Added "Switch Account" button that logs out then redirects to login
- Uses `/.auth/logout?post_logout_redirect_uri=/.auth/login/aad` to force account selection
- Both "Logout" and "Switch Account" buttons available on home page

**Files Modified**: `frontend/src/pages/index.tsx`

---

## Feature 2: CSV Export for Attendance (Implemented)

**Date**: February 6, 2026

**Feature**: Added CSV export functionality for student attendance records.

**Implementation**:
- Added `handleExportCSV()` function to `SessionEndAndExportControls.tsx`
- Exports attendance data with columns: Student ID, Entry Status, Entry Time, Exit Verified, Exit Time, Early Leave Time, Final Status
- Formats timestamps as human-readable dates
- Downloads file as `attendance-{sessionId}-{date}.csv`

**UI Updates**:
- Added **📊 Export CSV** button (green)
- Kept existing **📄 Export JSON** button (blue)
- Integrated into TeacherDashboard component

**Files Modified**:
- `frontend/src/components/SessionEndAndExportControls.tsx`
- `frontend/src/components/TeacherDashboard.tsx`

**Authentication Fix**: Added proper authentication headers to all export functions (handleEndSession, handleExportAttendance, handleExportCSV) to prevent 401 errors.

---

## Deployment Checklist

Before deploying to production:

1. ✅ Backend has independent `node_modules` (not in workspace)
2. ✅ Verify 29 functions compile and package size is ~27 MB
3. ✅ Frontend `.env.production` has correct API URL
4. ✅ All API calls include authentication headers
5. ✅ Role checking uses email domains, not Azure AD roles
6. ✅ Test with both teacher and student accounts
7. ✅ Verify CSV export works with authentication

---

## Environment Configuration

### Production Environment Variables

**Frontend** (`.env.production`):
```bash
NEXT_PUBLIC_API_URL=https://func-qrattendance-dev.azurewebsites.net/api
NEXT_PUBLIC_AAD_CLIENT_ID=dc482c34-ebaa-4239-aca3-2810a4f51728
NEXT_PUBLIC_AAD_TENANT_ID=8ff7db19-435d-4c3c-83d3-ca0a46234f51
NEXT_PUBLIC_AAD_REDIRECT_URI=https://red-grass-0f8bc910f.4.azurestaticapps.net/.auth/login/aad/callback
NEXT_PUBLIC_SIGNALR_URL=https://func-qrattendance-dev.azurewebsites.net/api
```

**Backend** (`local.settings.json` - for local dev only):
- Azure Storage connection strings
- SignalR connection string
- Other service configurations

---

## Known Issues

None currently. All major issues have been resolved.

---

## Future Improvements

1. Add more export formats (Excel, PDF)
2. Add filtering options for attendance export
3. Implement attendance analytics dashboard
4. Add email notifications for session events
5. Implement session templates for recurring classes

---

## Deployment Commands

**Full Deployment**:
```bash
./deploy-to-azure.sh
```

**Backend Only**:
```bash
cd backend
npm install
npm run build
func azure functionapp publish func-qrattendance-dev
```

**Frontend Only**:
```bash
cd frontend
npm install
npm run build
swa deploy ./out --deployment-token $DEPLOYMENT_TOKEN
```

---

## Support & Troubleshooting

**Common Issues**:

1. **401 Unauthorized**: Check authentication headers are included in API calls
2. **403 Forbidden**: Verify email domain matches role requirements
3. **404 Not Found**: Check API URL is correct in environment variables
4. **Infinite Redirect**: Ensure role computation uses email, not Azure AD roles

**Logs**:
- Backend: Azure Portal → Function App → Log Stream
- Frontend: Browser DevTools → Console
- SignalR: Check connection status in TeacherDashboard

---

Last Updated: February 6, 2026
