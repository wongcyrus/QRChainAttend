# Production Deployment Guide

**Last Updated**: March 6, 2026  
**Status**: ✅ Live and Running

> **Note**: Azure resources use the naming convention `qrattendance-*` for historical reasons. The project has been renamed to ProvePresent but existing Azure deployments retain the original resource names.

---

## Quick Start

### First Time Setup

**1. Set up Azure AD External ID** (Manual - Azure Portal)

Azure AD External ID requires manual configuration through the Azure Portal:
- Create External ID tenant
- Create app registration  
- Configure user flows
- See **[Azure AD Config Guide](AZURE_AD_CONFIG.md)** for detailed steps

**2. Create credentials file**
```bash
cp .external-id-credentials.template .external-id-credentials
# Edit with your Azure AD app credentials
```

**3. (Optional) Configure OTP Email**
```bash
cp .otp-email-credentials.example .otp-email-credentials
# Edit with your SMTP settings
```

**4. Deploy to Production**
```bash
./deploy-full-production.sh
```

### Subsequent Deployments

```bash
./deploy-full-production.sh
```

### Clean Up Everything

**Delete Azure resources:**
```bash
./cleanup-production.sh
```

**Delete Azure AD app:**
```bash
./cleanup-azure-ad-app.sh
```

Or delete both at once:
```bash
./cleanup-production.sh && ./cleanup-azure-ad-app.sh
```

### Verify Deployment
```bash
./verify-production.sh
```

---

## Current Production Configuration

### Azure Resources
| Resource | Name | Tier/SKU | Status |
|----------|------|----------|--------|
| Resource Group | rg-qr-attendance-prod | - | ✅ Active |
| Storage Account | stqrattendanceprod | Standard LRS | ✅ Active |
| SignalR | signalr-qrattendance-prod | Standard S1 (1000 connections) | ✅ Active |
| Azure OpenAI | openai-qrattendance-prod | S0 (AIServices) | ✅ Active |
| Foundry Project | openai-qrattendance-prod-project | - | ✅ Active |
| Function App | func-qrattendance-prod | Consumption (Node.js 22) | ✅ Running |
| Static Web App | swa-qrattendance-prod | Standard | ✅ Running |
| App Insights | appi-qrattendance-prod | Pay-as-you-go | ✅ Active |

### Cost Estimation
**Estimated**: ~$144-239/month
- SignalR Standard S1: ~$50/month
- Azure OpenAI: ~$50-100/month (usage-based)
- Static Web App Standard: ~$9/month
- Function App: ~$20-50/month
- Other services: ~$15-30/month

---

## Deployment Process

### Infrastructure as Code (Bicep)

The deployment uses Azure Bicep templates located in `infrastructure/`:

```
infrastructure/
├── main.bicep              # Main orchestrator
├── modules/
│   ├── storage.bicep       # Storage Account + Tables + Blobs
│   ├── signalr.bicep       # SignalR Service
│   ├── functions.bicep     # Function App
│   ├── appinsights.bicep   # Application Insights
│   ├── openai.bicep        # Azure OpenAI + Foundry Project
│   └── rbac.bicep          # RBAC role assignments
└── parameters/
    ├── dev.bicepparam      # Development parameters
    └── prod.bicepparam     # Production parameters
```

See [INFRASTRUCTURE_BICEP.md](../architecture/INFRASTRUCTURE_BICEP.md) for detailed module documentation.

### Authentication SKU Requirement

For Microsoft Entra External ID / Azure AD B2C custom authentication in Static Web Apps, **Standard SKU is required**. Free SKU can fall back to default auth behavior and ignore custom provider registration settings.

- Official reference: https://learn.microsoft.com/azure/static-web-apps/authentication-custom
- Deployment scripts automatically upgrade to Standard when External ID is configured.

### Prerequisites
```bash
# Check required tools
az --version          # Azure CLI
func --version        # Azure Functions Core Tools
npm --version         # Node.js
jq --version          # JSON processor

# Login to Azure
az login
```

### Complete Deployment Workflow

**Step 1: Create Azure AD App (First Time Only)**
```bash
./setup-azure-ad-app.sh
```

This script will:
- Check for existing "ProvePresent" app
- Create new app or reuse existing one
- Configure redirect URIs for Static Web App
- Create client secret (2-year expiry)
- Save credentials to `.external-id-credentials` (preferred)

**Step 2: Deploy Infrastructure and Application**
```bash
./deploy-full-production.sh
```

**Duration**: 10-15 minutes

**What it does**:
1. Validates credentials and prerequisites
2. Creates resource group (rg-qr-attendance-prod)
3. Deploys Bicep infrastructure:
   - Storage Account with 16 tables and 2 blob containers
   - SignalR Service (Standard S1)
   - Azure OpenAI with Foundry Project
   - Function App with managed identity
   - Application Insights
   - RBAC role assignments
4. Sets up Foundry project:
   - Ensures RBAC access for user and project MI
   - Creates tracing connection to App Insights
   - Creates AI agents (quiz generator, position analyzer)
5. Deploys backend functions (44+ functions)
6. Builds and deploys frontend:
   - Upgrades SWA to Standard SKU
   - Links Function App backend
   - Configures Azure AD settings
7. Configures SignalR CORS
8. Verifies deployment health

**Step 3: Verify Deployment**
```bash
./verify-production.sh
```

**Checks**:
- ✅ SignalR Standard S1 tier
- ✅ Function App running (44+ functions)
- ✅ Azure OpenAI (AIServices kind)
- ✅ Foundry Project created
- ✅ AI Agents deployed
- ✅ Static Web App deployed (Standard SKU)
- ✅ Backend linked to SWA
- ✅ All 16 tables created
- ✅ Azure AD External ID configured
- ✅ Login redirect validation

**Step 4: Test Production**
1. Wait 2-3 minutes for Azure AD settings to propagate
2. Open the Static Web App URL from deployment output
3. You should be redirected to Azure AD External ID login
4. Login with VTC credentials
5. Check browser console for "SignalR connected"
6. Create a session and test quiz feature

### Clean Up Production

**Delete all Azure resources:**
```bash
./cleanup-production.sh
```

**Delete Azure AD app registration:**
```bash
./cleanup-azure-ad-app.sh
```

**Delete everything:**
```bash
./cleanup-production.sh && ./cleanup-azure-ad-app.sh
```

This ensures complete cleanup with no lingering resources or AD apps.

---

## Credential Files

### .external-id-credentials (Required)

```bash
AAD_CLIENT_ID=<app-registration-client-id>
AAD_CLIENT_SECRET=<client-secret>
TENANT_ID=<azure-ad-tenant-id>
EXTERNAL_ID_ISSUER=https://<tenant>.ciamlogin.com/<tenant-id>/v2.0
```

### .otp-email-credentials (Optional)

```bash
OTP_SMTP_HOST=smtp.gmail.com
OTP_SMTP_PORT=465
OTP_SMTP_SECURE=true
OTP_SMTP_USERNAME=<email>
OTP_SMTP_PASSWORD=<app-password>
OTP_FROM_EMAIL=<sender-email>
OTP_FROM_NAME=VTC Attendance
```

### .agent-config.env (Auto-generated)

Created by deployment script with agent references:
```bash
AZURE_AI_PROJECT_ENDPOINT=https://openai-qrattendance-prod.cognitiveservices.azure.com/api/projects/openai-qrattendance-prod-project
AZURE_AI_AGENT_NAME=quiz-question-generator
AZURE_AI_AGENT_VERSION=1
```

---

## Recent Fixes & Improvements

### March 2026 Updates

**Infrastructure**:
- ✅ Updated to Node.js 22 runtime
- ✅ Added Foundry Project for Agent Service
- ✅ Keyless authentication for OpenAI (managed identity)
- ✅ Added 4 new tables for capture feature
- ✅ Added 2 blob containers for images
- ✅ Token TTL increased to 25 seconds

**Deployment Scripts**:
- ✅ Automatic Foundry RBAC setup
- ✅ Tracing connection to App Insights
- ✅ Agent creation via TypeScript SDK
- ✅ External ID login verification
- ✅ Improved error handling and recovery

### February 2026 Deployment

**Infrastructure Updates**:
- ✅ Updated Azure OpenAI to API 2024-10-01 with AIServices kind
- ✅ Enabled SignalR Standard S1 tier (1000 connections)
- ✅ Fixed deployment JSON parsing with better error handling
- ✅ Made SignalR optional (can disable to save costs)

**Backend Improvements**:
- ✅ Cleaned up quiz broadcasting code
- ✅ Removed unused fair selection algorithm
- ✅ Improved logging for SignalR broadcasts
- ✅ Fixed quiz question expiry filtering

**Frontend Optimizations**:
- ✅ Reduced API polling (5s quiz, 15s status)
- ✅ Proper SignalR connection detection
- ✅ Auth header caching (30 minutes)
- ✅ Automatic fallback to polling if SignalR unavailable

---

## SignalR Configuration

### Current Setup: Standard S1 (Enabled)

**Capacity**:
- 1,000 concurrent connections
- 1,000,000 messages per day
- Cost: ~$50/month

**Benefits**:
- Real-time quiz delivery (<1 second)
- Instant session updates
- Supports large classes

**Fallback**:
- System automatically falls back to polling if SignalR unavailable
- Quiz polling: 5 seconds
- Status polling: 15 seconds

### To Disable SignalR (Save $50/month)

Edit `infrastructure/parameters/prod.bicepparam`:
```bicep
param deploySignalR = false
```

Then redeploy:
```bash
./deploy-full-production.sh
```

**Trade-off**: 5-second average latency vs instant delivery

---

## Troubleshooting

### 403 Forbidden Error

**Problem**: Getting "403: Forbidden - You don't have permissions for this page"

**Cause**: Azure AD authentication not configured properly

**Solution**:
```bash
# Check if AAD_CLIENT_SECRET is set
az staticwebapp appsettings list \
  --name swa-qrattendance-prod2 \
  --resource-group rg-qr-attendance-prod \
  --query "properties.{AAD_CLIENT_ID:AAD_CLIENT_ID, TENANT_ID:TENANT_ID}"

# If AAD_CLIENT_SECRET is empty, configure it:
./configure-azure-ad.sh <your-client-secret>
```

**Get the client secret**:
1. Azure Portal > Azure Active Directory > App registrations
2. Find app: `dc482c34-ebaa-4239-aca3-2810a4f51728`
3. Certificates & secrets > New client secret
4. Copy the value and run the configure script

### Deployment Issues

**Problem**: jq parsing error during deployment

**Solution**: Script has automatic fallback to query Azure directly. If you see this error, the script will continue and retrieve outputs from Azure.

**Problem**: SignalR not connecting

**Check**:
```bash
# Verify SignalR tier
az signalr show \
  --name signalr-qrattendance-prod \
  --resource-group rg-qr-attendance-prod \
  --query "sku"
```

**Expected**: Standard S1

**Problem**: Quiz questions not appearing

**Check**:
1. Browser console - SignalR status
2. Network tab - API calls
3. Function logs - broadcast messages

**Solution**: System should fall back to polling automatically (5-second intervals)

### View Logs
```bash
# Function App logs
az functionapp log tail \
  --name func-qrattendance-prod \
  --resource-group rg-qr-attendance-prod

# SignalR metrics
az signalr show \
  --name signalr-qrattendance-prod \
  --resource-group rg-qr-attendance-prod
```

---

## Performance

### With SignalR Standard S1 (Current)
- Quiz delivery: <1 second
- Status updates: <1 second
- Concurrent students: Up to 1,000
- API calls: ~12/attendee/hour

### Fallback Mode (If SignalR Unavailable)
- Quiz delivery: 0-5 seconds (avg 2.5s)
- Status updates: 0-15 seconds (avg 7.5s)
- Concurrent students: Unlimited
- API calls: ~360/attendee/hour

---

## Database Schema

**16 Tables** in Azure Table Storage:
1. Sessions - Class sessions
2. Attendance - Student attendance records
3. Chains - QR chain state
4. Tokens - QR tokens for chain passing
5. UserSessions - User session tracking
6. AttendanceSnapshots - Instant attendance captures
7. ChainHistory - Chain scan history
8. ScanLogs - Detailed scan logs
9. DeletionLog - Deletion audit trail
10. QuizQuestions - Generated quiz questions
11. QuizResponses - Student answers
12. QuizMetrics - Quiz performance metrics
13. CaptureRequests - Image capture requests
14. CaptureUploads - Image uploads
15. CaptureResults - Capture analysis results

**2 Blob Containers**:
- quiz-slides - Slide images for quiz generation
- student-captures - Student image captures

---

## Monitoring

### Set Up Alerts
```bash
# SignalR connection failures
az monitor metrics alert create \
  --name "SignalR Connection Failures" \
  --resource-group rg-qr-attendance-prod \
  --scopes $(az signalr show --name signalr-qrattendance-prod --resource-group rg-qr-attendance-prod --query id -o tsv) \
  --condition "count ConnectionCloseCount > 10" \
  --window-size 5m

# Function App errors
az monitor metrics alert create \
  --name "Function App Errors" \
  --resource-group rg-qr-attendance-prod \
  --scopes $(az functionapp show --name func-qrattendance-prod --resource-group rg-qr-attendance-prod --query id -o tsv) \
  --condition "count Http5xx > 10" \
  --window-size 5m
```

### Cost Management
```bash
# Set budget alert
az consumption budget create \
  --budget-name "QR-Attendance-Monthly" \
  --amount 100 \
  --time-grain Monthly \
  --resource-group rg-qr-attendance-prod
```

---

## Additional Documentation

- **System Architecture**: [../architecture/SYSTEM_ARCHITECTURE.md](../architecture/SYSTEM_ARCHITECTURE.md)
- **Infrastructure Bicep**: [../architecture/INFRASTRUCTURE_BICEP.md](../architecture/INFRASTRUCTURE_BICEP.md)
- **Deployment Scripts**: [../architecture/DEPLOYMENT_SCRIPTS.md](../architecture/DEPLOYMENT_SCRIPTS.md)
- **Database Details**: [../architecture/DATABASE_TABLES.md](../architecture/DATABASE_TABLES.md)
- **Live Quiz Feature**: [../architecture/LIVE_QUIZ.md](../architecture/LIVE_QUIZ.md)
- **Security Guidelines**: [SECURITY.md](../../SECURITY.md)
- **Local Development**: [../development/](../development/)
- **All Documentation**: [DOCUMENTATION_INDEX.md](../../DOCUMENTATION_INDEX.md)

---

## Quick Commands

```bash
# Deploy production
./deploy-full-production.sh

# Verify deployment
./verify-production.sh

# Check SignalR status
az signalr show --name signalr-qrattendance-prod --resource-group rg-qr-attendance-prod

# Check Function App
az functionapp show --name func-qrattendance-prod --resource-group rg-qr-attendance-prod

# View logs
az functionapp log tail --name func-qrattendance-prod --resource-group rg-qr-attendance-prod

# List all resources
az resource list --resource-group rg-qr-attendance-prod --output table
```

---

**Production is live and ready to use!** 🚀
