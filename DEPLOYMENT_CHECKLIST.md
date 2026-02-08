# Deployment Checklist

Complete checklist for deploying the QR Chain Attendance System to Azure.

> **Note**: For detailed deployment history and all fixes, see [DEPLOYMENT_HISTORY.md](DEPLOYMENT_HISTORY.md)

## Pre-Deployment Checks

### 1. Backend Verification

- [ ] Backend is NOT in workspace (check root `package.json`)
- [ ] Backend has independent `node_modules` folder
- [ ] All 29 functions compile successfully
- [ ] Package size is approximately 27 MB
- [ ] No TypeScript errors in backend code

**Verify**:
```bash
cd backend
npm install
npm run build
ls -lh dist/
```

### 2. Frontend Verification

- [ ] `.env.production` has correct API URL
- [ ] All API calls include authentication headers
- [ ] No TypeScript errors in frontend code
- [ ] Build completes successfully
- [ ] Static export generates correctly

**Verify**:
```bash
cd frontend
npm install
npm run build
ls -lh out/
```

### 3. Authentication Configuration

- [ ] All API calls fetch auth from `/.auth/me` in production
- [ ] All API calls include `x-ms-client-principal` header
- [ ] Role checking uses email domains (not Azure AD app roles)
- [ ] Email domain logic is correct:
  - `@vtc.edu.hk` (excluding `@stu.vtc.edu.hk`) → Teacher
  - `@stu.vtc.edu.hk` → Student
- [ ] Frontend uses `getRolesFromEmail()` function
- [ ] Backend uses `hasRole()` function with email domain checks

**Files to Check**:
- `SessionCreationForm.tsx`
- `TeacherDashboard.tsx`
- `SimpleStudentView.tsx`
- `SessionEndAndExportControls.tsx`
- `teacher.tsx`
- `student.tsx`
- All backend functions with `hasRole()`

### 4. Environment Variables

**Frontend** (`.env.production`):
- [ ] `NEXT_PUBLIC_API_URL` points to Function App
- [ ] `NEXT_PUBLIC_AAD_CLIENT_ID` is correct
- [ ] `NEXT_PUBLIC_AAD_TENANT_ID` is correct
- [ ] `NEXT_PUBLIC_AAD_REDIRECT_URI` is correct
- [ ] `NEXT_PUBLIC_ENVIRONMENT` is NOT set (for production)

**Backend** (Azure Function App Settings):
- [ ] `AzureWebJobsStorage` connection string
- [ ] `AzureSignalRConnectionString` connection string
- [ ] `STORAGE_CONNECTION_STRING` for Table Storage
- [ ] All other required settings

## Deployment Steps

### 1. Run Deployment Script

```bash
./deploy-to-azure.sh
```

### 2. Verify Backend Deployment

- [ ] All 29 functions are listed
- [ ] Function App status is "Running"
- [ ] Test a simple endpoint (e.g., `/api/auth/roles`)

**Check**:
```bash
az functionapp list-functions \
  --name func-qrattendance-dev \
  --resource-group rg-qrattendance-dev
```

### 3. Verify Frontend Deployment

- [ ] Static Web App deployed successfully
- [ ] Home page loads correctly
- [ ] Login redirects to Azure AD
- [ ] Static assets load properly

**Test**: Visit https://red-grass-0f8bc910f.4.azurestaticapps.net

## Post-Deployment Testing

### 1. Authentication Flow

- [ ] Login with teacher account (`@vtc.edu.hk`, not `@stu.vtc.edu.hk`)
- [ ] Verify teacher role is assigned automatically
- [ ] Verify redirected to teacher dashboard
- [ ] Login with student account (`@stu.vtc.edu.hk`)
- [ ] Verify student role is assigned automatically
- [ ] Verify redirected to student view
- [ ] Test "Switch Account" functionality
- [ ] Verify roles display correctly on home page

### 2. Teacher Functionality

- [ ] Create new session
- [ ] View session dashboard
- [ ] See real-time updates
- [ ] Export attendance as CSV
- [ ] Export attendance as JSON
- [ ] End session

### 3. Student Functionality

- [ ] Join session via QR code
- [ ] Scan QR chain for entry
- [ ] View attendance status
- [ ] Scan QR chain for exit

### 4. API Endpoints

Test key endpoints:

- [ ] `GET /api/auth/me` - Returns user info
- [ ] `GET /api/teacher/sessions?teacherId={email}` - Returns sessions
- [ ] `POST /api/sessions` - Creates session
- [ ] `GET /api/sessions/{sessionId}` - Returns session details
- [ ] `GET /api/sessions/{sessionId}/attendance` - Returns attendance

### 5. Error Handling

- [ ] 401 errors are handled gracefully
- [ ] 403 errors show appropriate message
- [ ] 404 errors don't crash the app
- [ ] Network errors are caught and displayed

## Common Issues & Solutions

See [DEPLOYMENT_HISTORY.md](DEPLOYMENT_HISTORY.md) for detailed solutions.

**Quick Fixes**:

1. **401 Unauthorized**
   - Check authentication headers are included
   - Verify `/.auth/me` is being called in production

2. **403 Forbidden**
   - Verify email domain matches role requirements
   - Check `hasRole()` function uses email domains

3. **404 Not Found**
   - Check API URL in `.env.production`
   - Verify route paths are correct

4. **Only 6 functions deployed**
   - Backend is in workspace - remove from root `package.json`
   - Redeploy backend

5. **Infinite redirect loop**
   - Check if `.env.local` was included in production build
   - Redeploy frontend using `./deploy-frontend-only.sh`

6. **Wrong role assigned**
   - Verify email domain matches expected pattern
   - Teachers: `@vtc.edu.hk` (excluding `@stu.vtc.edu.hk`)
   - Students: `@stu.vtc.edu.hk`
   - Clear browser cache and re-login

## Rollback Procedure

If deployment fails:

1. **Backend Rollback**:
   ```bash
   # Redeploy previous version
   cd backend
   git checkout <previous-commit>
   npm install
   npm run build
   func azure functionapp publish func-qrattendance-dev
   ```

2. **Frontend Rollback**:
   ```bash
   # Redeploy previous version
   cd frontend
   git checkout <previous-commit>
   npm install
   npm run build
   swa deploy ./out --deployment-token $DEPLOYMENT_TOKEN
   ```

## Monitoring

After deployment, monitor:

- [ ] Azure Function App logs
- [ ] Static Web App logs
- [ ] Application Insights metrics
- [ ] SignalR connection status

**Access Logs**:
- Azure Portal → Function App → Log Stream
- Azure Portal → Static Web App → Logs
- Application Insights → Live Metrics

## Sign-Off

- [ ] All pre-deployment checks passed
- [ ] Deployment completed successfully
- [ ] Post-deployment testing passed
- [ ] No critical errors in logs
- [ ] Monitoring is active

**Deployed By**: _________________

**Date**: _________________

**Version/Commit**: _________________

---

For detailed deployment history and all fixes, see [DEPLOYMENT_HISTORY.md](DEPLOYMENT_HISTORY.md)
