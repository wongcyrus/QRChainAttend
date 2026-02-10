# Deployment Guide

Complete guide for deploying the QR Chain Attendance System to Azure.

## Prerequisites

- Azure subscription
- Azure CLI installed and logged in
- Deployment tokens/credentials

## Production URLs

- **Frontend**: https://red-grass-0f8bc910f.4.azurestaticapps.net
- **Backend API**: https://func-qrattendance-dev.azurewebsites.net/api

## Backend Deployment

### Important: Workspace Fix

The backend must have its own `node_modules` folder. See [BACKEND_DEPLOYMENT_FIX.md](BACKEND_DEPLOYMENT_FIX.md) for details.

### Deploy Backend

```bash
cd backend

# Ensure dependencies are installed
npm install

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

### Verify Backend Deployment

Check that all 29 functions are deployed:
```bash
az functionapp function list \
  --name func-qrattendance-dev \
  --resource-group rg-qr-attendance-dev \
  --query "[].name" \
  --output table
```

**Expected**: 29 functions  
**Package size**: ~27 MB

## Frontend Deployment

### Build Frontend

```bash
cd frontend

# Set production environment variables
export NEXT_PUBLIC_ENVIRONMENT=production
export NEXT_PUBLIC_API_URL=https://func-qrattendance-dev.azurewebsites.net/api
export NEXT_PUBLIC_FRONTEND_URL=https://red-grass-0f8bc910f.4.azurestaticapps.net

# Build
npm run build
```

### Deploy to Azure Static Web Apps

```bash
# Get deployment token
DEPLOYMENT_TOKEN=$(az staticwebapp secrets list \
  --name swa-qrattendance-dev2 \
  --resource-group rg-qr-attendance-dev \
  --query "properties.apiKey" -o tsv)

# Deploy
npx @azure/static-web-apps-cli deploy ./out \
  --deployment-token "$DEPLOYMENT_TOKEN" \
  --env production
```

## Configuration

### CORS Configuration (Required for credentials: 'include')

**Important**: When using `credentials: 'include'` in fetch requests, CORS must be configured properly:

```bash
# Run the CORS configuration script
./scripts/configure-cors.sh
```

Or manually configure:

```bash
# Remove wildcard origin
az functionapp cors remove \
  --name func-qrattendance-dev \
  --resource-group rg-qr-attendance-dev \
  --allowed-origins "*"

# Add specific origins
az functionapp cors add \
  --name func-qrattendance-dev \
  --resource-group rg-qr-attendance-dev \
  --allowed-origins \
    "https://red-grass-0f8bc910f.4.azurestaticapps.net" \
    "http://localhost:3000" \
    "http://localhost:3001" \
    "http://localhost:3002"

# Enable credentials support
az functionapp cors credentials \
  --name func-qrattendance-dev \
  --resource-group rg-qr-attendance-dev \
  --enable true
```

**Why this is needed:**
- Frontend uses `credentials: 'include'` to pass authentication cookies
- Azure Static Web Apps authentication requires credentials
- CORS with credentials cannot use wildcard `*` origin
- Must specify exact allowed origins

### Backend Environment Variables

Set in Azure Function App:
```bash
az functionapp config appsettings set \
  --name func-qrattendance-dev \
  --resource-group rg-qr-attendance-dev \
  --settings \
    FUNCTIONS_WORKER_RUNTIME=node \
    FUNCTIONS_EXTENSION_VERSION=~4 \
    WEBSITE_NODE_DEFAULT_VERSION=~20
```

### Frontend Environment Variables

Set in Azure Static Web App:
```bash
az staticwebapp appsettings set \
  --name swa-qrattendance-dev2 \
  --resource-group rg-qr-attendance-dev \
  --setting-names \
    NEXT_PUBLIC_ENVIRONMENT=production \
    NEXT_PUBLIC_API_URL=https://func-qrattendance-dev.azurewebsites.net/api \
    NEXT_PUBLIC_FRONTEND_URL=https://red-grass-0f8bc910f.4.azurestaticapps.net \
    AAD_CLIENT_ID=dc482c34-ebaa-4239-aca3-2810a4f51728 \
    AAD_CLIENT_SECRET=<secret> \
    TENANT_ID=8ff7db19-435d-4c3c-83d3-ca0a46234f51
```

## Authentication Setup

### Azure AD App Registration

1. **Multi-tenant**: Supports any Azure AD organization
2. **Client ID**: `dc482c34-ebaa-4239-aca3-2810a4f51728`
3. **Redirect URI**: `https://red-grass-0f8bc910f.4.azurestaticapps.net/.auth/login/aad/callback`

### Role Assignment

Roles are automatically assigned based on email domain:
- `@vtc.edu.hk` → Teacher
- `@stu.vtc.edu.hk` → Student
- `cyruswong@outlook.com` → Teacher (testing)

## Database Management

### Reset Production Database

```bash
./scripts/reset-production-db.sh
```

⚠️ **Warning**: This deletes all production data!

### View Production Data

```bash
# List tables
az storage table list \
  --account-name stqrattendancedev \
  --query "[].name" \
  --output table

# Query sessions
az storage entity query \
  --account-name stqrattendancedev \
  --table-name Sessions \
  --filter "PartitionKey eq 'SESSION'" \
  --output table
```

## Troubleshooting

### Backend: Only 6 functions deployed

**Cause**: Missing `node_modules` in backend folder

**Solution**:
```bash
cd backend
rm -rf node_modules
npm install
npm run build
func azure functionapp publish func-qrattendance-dev --javascript
```

See [BACKEND_DEPLOYMENT_FIX.md](BACKEND_DEPLOYMENT_FIX.md) for details.

### Frontend: 403 Forbidden

**Cause**: Static Web App configuration issue

**Solution**: Redeploy with minimal configuration

### Authentication: Can't login with VTC account

**Cause**: VTC ADFS server not accessible

**Solution**:
- Connect to VTC VPN
- Or test with personal Microsoft account
- See archived docs in `docs/archive/VTC_ADFS_LOGIN_GUIDE.md`

### Storage: "Login not supported for provider azureStaticWebApps"

**Cause**: Azure Table Storage authentication conflict

**Status**: Known issue under investigation

**Workaround**: Use local development

## Monitoring

### View Logs

```bash
# Function App logs
az monitor app-insights query \
  --app appi-qrattendance-dev \
  --resource-group rg-qr-attendance-dev \
  --analytics-query "traces | where timestamp > ago(1h) | order by timestamp desc | take 50"
```

### Check Function App Status

```bash
az functionapp show \
  --name func-qrattendance-dev \
  --resource-group rg-qr-attendance-dev \
  --query "{name:name, state:state, defaultHostName:defaultHostName}"
```

## Deployment Checklist

- [ ] Backend dependencies installed (`backend/node_modules` exists)
- [ ] Backend built (`backend/dist` exists)
- [ ] Backend deployed (29 functions, ~27 MB)
- [ ] Frontend built with production env vars
- [ ] Frontend deployed to Static Web App
- [ ] Environment variables configured
- [ ] Authentication working
- [ ] Database tables exist
- [ ] Test login and basic functionality

## Resources

- **Azure Portal**: https://portal.azure.com
- **Resource Group**: `rg-qr-attendance-dev`
- **Function App**: `func-qrattendance-dev`
- **Static Web App**: `swa-qrattendance-dev2`
- **Storage Account**: `stqrattendancedev`
- **Application Insights**: `appi-qrattendance-dev`

---

**Last Updated**: February 6, 2026
