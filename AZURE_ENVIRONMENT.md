# Azure Environment - Current State

**Date**: February 6, 2026  
**Subscription**: MVP Azure subscription  
**Tenant**: ivecyrus.onmicrosoft.com

## Resource Group

**Name**: `rg-qr-attendance-dev`  
**Location**: `eastus2`

## Deployed Resources

### 1. Function App
- **Name**: `func-qrattendance-dev`
- **Type**: `functionapp,linux`
- **State**: `Running`
- **URL**: https://func-qrattendance-dev.azurewebsites.net
- **Runtime**: Node.js 20
- **Plan**: Consumption (Y1)

### 2. Static Web App
- **Name**: `swa-qrattendance-dev2`
- **URL**: https://red-grass-0f8bc910f.4.azurestaticapps.net
- **Repository**: Not connected (manual deployment)
- **Branch**: N/A

### 3. Storage Account
- **Name**: `stqrattendancedev`
- **Location**: `eastus2`
- **Type**: Standard LRS
- **Services**: Blob, Table, Queue, File

### 4. SignalR Service
- **Name**: `signalr-qrattendance-dev`
- **Location**: `eastus2`
- **Endpoint**: https://signalr-qrattendance-dev.service.signalr.net

### 5. Application Insights
- **Name**: `appi-qrattendance-dev`
- **Location**: `eastus2`
- **Workspace**: `appi-qrattendance-dev-workspace`

### 6. App Service Plan
- **Name**: `asp-qrattendance-dev`
- **Location**: `eastus2`
- **SKU**: Y1 (Consumption)
- **OS**: Linux

## Function App Settings (Current)

### Core Settings
```
FUNCTIONS_EXTENSION_VERSION=~4
FUNCTIONS_WORKER_RUNTIME=node
WEBSITE_NODE_DEFAULT_VERSION=~20
```

### Storage
```
AzureWebJobsStorage=<connection-string>
STORAGE_ACCOUNT_NAME=stqrattendancedev
STORAGE_ACCOUNT_URI=https://stqrattendancedev.table.core.windows.net/
```

### SignalR
```
SIGNALR_CONNECTION_STRING=<connection-string>
```

### Application Insights
```
APPLICATIONINSIGHTS_CONNECTION_STRING=<connection-string>
```

### Application Settings
```
LATE_ROTATION_SECONDS=60
EARLY_LEAVE_ROTATION_SECONDS=60
CHAIN_TOKEN_TTL_SECONDS=20
OWNER_TRANSFER=true
WIFI_SSID_ALLOWLIST=
AOAI_ENDPOINT=
AOAI_KEY=
AOAI_DEPLOYMENT=
```

### Missing Settings
```
QR_ENCRYPTION_KEY=<NOT SET - NEEDS TO BE ADDED>
```

## Bicep Updates Made

### 1. Node Version
- **Changed**: `NODE|22` → `NODE|20`
- **Reason**: Match current deployment

### 2. QR_ENCRYPTION_KEY
- **Added**: Auto-generation using `uniqueString()`
- **Status**: Will be set on next infrastructure deployment

### 3. Resource Group Name
- **Corrected**: `rg-qrattendance-dev` → `rg-qr-attendance-dev`
- **Updated in**: All deployment scripts

## Deployment Scripts Updated

### Files Updated
1. ✅ `infrastructure/modules/functions.bicep` - Node 20, QR_ENCRYPTION_KEY
2. ✅ `backend/deploy.sh` - Correct resource group name
3. ✅ `backend/deploy-with-encryption-key.sh` - Correct resource group name
4. ✅ `scripts/set-encryption-key.sh` - Correct resource group name

## Next Steps

### Option 1: Set Encryption Key Only (Quick)

```bash
./scripts/set-encryption-key.sh
```

This will:
- Generate a secure 32-byte key
- Set `QR_ENCRYPTION_KEY` in Function App settings
- No infrastructure changes

### Option 2: Full Infrastructure Update (Complete)

```bash
cd infrastructure
./deploy.sh -e dev -g rg-qr-attendance-dev
```

This will:
- Update all resources to match Bicep
- Set `QR_ENCRYPTION_KEY` automatically
- Ensure all settings are correct

## Verification Commands

### Check Resource Group
```bash
az group show --name rg-qr-attendance-dev
```

### Check Function App
```bash
az functionapp show \
  --name func-qrattendance-dev \
  --resource-group rg-qr-attendance-dev \
  --query "{name:name, state:state, defaultHostName:defaultHostName}"
```

### Check Settings
```bash
az functionapp config appsettings list \
  --name func-qrattendance-dev \
  --resource-group rg-qr-attendance-dev \
  --query "[].{name:name}" -o table
```

### Check for QR_ENCRYPTION_KEY
```bash
az functionapp config appsettings list \
  --name func-qrattendance-dev \
  --resource-group rg-qr-attendance-dev \
  --query "[?name=='QR_ENCRYPTION_KEY']"
```

## Current Status

| Component | Status | Notes |
|-----------|--------|-------|
| Resource Group | ✅ Exists | rg-qr-attendance-dev |
| Function App | ✅ Running | 32 functions deployed |
| Static Web App | ✅ Running | Manual deployment |
| Storage Account | ✅ Active | Tables configured |
| SignalR | ✅ Active | Connected to Function App |
| App Insights | ✅ Active | Monitoring enabled |
| QR_ENCRYPTION_KEY | ❌ Missing | **NEEDS TO BE SET** |

## Recommended Action

**Run this command to set the encryption key:**

```bash
./scripts/set-encryption-key.sh
```

Then deploy the backend:

```bash
cd backend
./deploy.sh
```

This will enable the encryption-based QR code feature without requiring a full infrastructure redeployment.

---

**Summary**: Environment is healthy. Only missing `QR_ENCRYPTION_KEY` setting. All Bicep files and scripts have been updated to match the actual deployment.
