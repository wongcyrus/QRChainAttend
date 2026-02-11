# Production Deployment Guide

**Last Deployment**: February 11, 2026 at 12:33 UTC  
**Status**: ✅ Live and Running

---

## Quick Start

### Deploy to Production
```bash
./deploy-full-production.sh
```

### Verify Deployment
```bash
./verify-production.sh
```

### Access Production
- **Frontend**: https://ashy-desert-0fc9a700f.6.azurestaticapps.net
- **Backend**: https://func-qrattendance-prod.azurewebsites.net

---

## Current Production Configuration

### Azure Resources
| Resource | Name | Tier/SKU | Status |
|----------|------|----------|--------|
| SignalR | signalr-qrattendance-prod | Standard S1 (1000 connections) | ✅ Active |
| Azure OpenAI | openai-qrattendance-prod | S0 (AIServices, API 2024-10-01) | ✅ Active |
| Function App | func-qrattendance-prod | Consumption (44 functions) | ✅ Running |
| Static Web App | swa-qrattendance-prod2 | Free | ✅ Running |
| Storage | stqrattendanceprod | Standard LRS (12 tables) | ✅ Active |

### Cost
**Estimated**: ~$55-70/month
- SignalR Standard S1: ~$50/month
- Azure OpenAI: ~$5-20/month (usage-based)
- Other services: Minimal

---

## Deployment Process

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

### Step-by-Step Deployment

**1. Run Deployment Script**
```bash
./deploy-full-production.sh
```

**Duration**: 10-15 minutes

**What it does**:
- Creates resource group
- Deploys infrastructure (Storage, SignalR S1, Functions, OpenAI, Static Web App)
- Builds and deploys backend (44 functions)
- Creates database tables (12 tables)
- Configures CORS
- Builds and deploys frontend
- Verifies deployment

**2. Verify Deployment**
```bash
./verify-production.sh
```

**Checks**:
- ✅ SignalR Standard S1 tier
- ✅ Function App running
- ✅ Azure OpenAI (AIServices kind)
- ✅ Static Web App deployed
- ✅ All 12 tables created
- ✅ SignalR connection configured

**3. Test Production**
1. Open: https://ashy-desert-0fc9a700f.6.azurestaticapps.net
2. Login with Azure AD
3. Check browser console for "SignalR connected"
4. Create a session and test quiz feature

---

## Recent Fixes & Improvements

### February 11, 2026 Deployment

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
- API calls: ~12/student/hour

### Fallback Mode (If SignalR Unavailable)
- Quiz delivery: 0-5 seconds (avg 2.5s)
- Status updates: 0-15 seconds (avg 7.5s)
- Concurrent students: Unlimited
- API calls: ~360/student/hour

---

## Database Schema

**12 Tables** in Azure Table Storage:
1. Sessions - Class sessions
2. Attendance - Student attendance records
3. Chains - QR chain state
4. Tokens - QR tokens for chain passing
5. UserSessions - User session tracking
6. AttendanceSnapshots - Instant attendance captures
7. ChainHistory - Chain scan history
8. ScanLogs - Detailed scan logs
9. QuizQuestions - Generated quiz questions
10. QuizResponses - Student answers
11. QuizMetrics - Quiz performance metrics
12. DeletionLog - Deletion audit trail

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

- **System Architecture**: `SYSTEM_ARCHITECTURE.md`
- **Database Details**: `DATABASE_TABLES.md`
- **Live Quiz Feature**: `LIVE_QUIZ.md`
- **Security Guidelines**: `SECURITY.md`
- **Local Development**: `LOCAL_DEVELOPMENT.md`
- **All Documentation**: `DOCUMENTATION_INDEX.md`

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
