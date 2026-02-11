# Deployment Guide

Complete guide for deploying to Azure production.

---

## Quick Deploy

```bash
./deploy-full-production.sh
```

This fully automated script deploys everything to production in one command.

---

## Production Environment

### URLs
- **Frontend**: https://ashy-desert-0fc9a700f.6.azurestaticapps.net
- **Backend**: https://func-qrattendance-prod.azurewebsites.net/api

### Resources
- **Resource Group**: rg-qr-attendance-prod
- **Function App**: func-qrattendance-prod (44 functions)
- **Static Web App**: stapp-qrattendance-prod
- **Storage**: stqrattendanceprod (11 tables)
- **SignalR**: signalr-qrattendance-prod
- **Azure OpenAI**: oai-qrattendance-prod

---

## Prerequisites

### Required Tools
```bash
# Azure CLI
az --version

# Node.js 20+
node --version

# Azure Functions Core Tools
func --version

# Azure Static Web Apps CLI
swa --version
```

### Azure Login
```bash
az login
az account show
```

---

## Deployment Script

### What It Does

The `deploy-full-production.sh` script:

1. **Pre-flight Checks**
   - Verifies Azure CLI logged in
   - Checks required commands installed
   - Validates subscription access

2. **Infrastructure Deployment**
   - Deploys Bicep templates
   - Creates/updates all Azure resources
   - Configures Function App settings

3. **Backend Deployment**
   - Installs dependencies
   - Builds TypeScript
   - Deploys 44 Azure Functions
   - Verifies deployment

4. **Database Setup**
   - Creates 11 database tables
   - Configures table permissions

5. **Frontend Deployment**
   - Builds Next.js app
   - Deploys to Static Web App
   - Configures CORS

6. **Verification**
   - Checks all resources running
   - Verifies function count
   - Tests endpoints

### Usage

```bash
# Full deployment
./deploy-full-production.sh

# View logs
tail -f deployment-*.log
```

**Time**: ~10-15 minutes

---

## Manual Deployment

### Step 1: Deploy Infrastructure

```bash
cd infrastructure

# Deploy to production
az deployment group create \
  --resource-group rg-qr-attendance-prod \
  --template-file main.bicep \
  --parameters parameters/prod.bicepparam
```

### Step 2: Deploy Backend

```bash
cd backend

# Install and build
npm install
npm run build

# Deploy to Azure
func azure functionapp publish func-qrattendance-prod
```

### Step 3: Create Database Tables

```bash
./scripts/tables-config.sh create prod
```

### Step 4: Deploy Frontend

```bash
cd frontend

# Build
npm install
npm run build

# Deploy
swa deploy ./out \
  --deployment-token "$SWA_TOKEN" \
  --env production
```

---

## Pre-Deployment Checklist

### Backend
- [ ] All TypeScript compiles without errors
- [ ] All 44 functions build successfully
- [ ] Environment variables configured
- [ ] No secrets in code

### Frontend
- [ ] `.env.production` has correct URLs
- [ ] Build completes successfully
- [ ] No TypeScript errors
- [ ] Static export generates

### Infrastructure
- [ ] Bicep templates validate
- [ ] Parameters file updated
- [ ] Resource names available

### Database
- [ ] Table schemas defined
- [ ] Migration scripts ready (if needed)

---

## Post-Deployment Verification

### Check Function App

```bash
# Verify status
az functionapp show \
  --name func-qrattendance-prod \
  --resource-group rg-qr-attendance-prod \
  --query state -o tsv

# List functions
az functionapp function list \
  --name func-qrattendance-prod \
  --resource-group rg-qr-attendance-prod \
  --query "[].name" -o table

# Expected: 44 functions
```

### Check Static Web App

```bash
# Verify status
az staticwebapp show \
  --name stapp-qrattendance-prod \
  --resource-group rg-qr-attendance-prod \
  --query defaultHostname -o tsv
```

### Check Database Tables

```bash
# List tables
az storage table list \
  --account-name stqrattendanceprod \
  --query "[].name" -o table

# Expected: 11 tables
```

### Test Endpoints

```bash
# Test backend
curl https://func-qrattendance-prod.azurewebsites.net/api/health

# Test frontend
curl https://ashy-desert-0fc9a700f.6.azurestaticapps.net
```

---

## Environment Variables

### Frontend (.env.production)

```env
NEXT_PUBLIC_API_URL=https://func-qrattendance-prod.azurewebsites.net/api
NEXT_PUBLIC_AAD_CLIENT_ID=dc482c34-ebaa-4239-aca3-2810a4f51728
NEXT_PUBLIC_AAD_TENANT_ID=8ff7db19-435d-4c3c-83d3-ca0a46234f51
NEXT_PUBLIC_AAD_REDIRECT_URI=https://ashy-desert-0fc9a700f.6.azurestaticapps.net/.auth/login/aad/callback
NEXT_PUBLIC_SIGNALR_URL=https://func-qrattendance-prod.azurewebsites.net/api
```

### Backend (Function App Settings)

Set via Azure Portal or CLI:
- `AzureWebJobsStorage` - Storage connection string
- `STORAGE_ACCOUNT_NAME` - stqrattendanceprod
- `STORAGE_ACCOUNT_URI` - Table storage URI
- `SIGNALR_CONNECTION_STRING` - SignalR connection
- `AZURE_OPENAI_ENDPOINT` - OpenAI endpoint
- `AZURE_OPENAI_KEY` - OpenAI API key
- `AZURE_OPENAI_DEPLOYMENT` - gpt-4o
- `AZURE_OPENAI_VISION_DEPLOYMENT` - gpt-4o-vision

---

## Troubleshooting

### Deployment Fails

**Check Azure CLI**:
```bash
az login
az account show
```

**Check Permissions**:
```bash
az group show --name rg-qr-attendance-prod
```

**View Logs**:
```bash
# Function App logs
az functionapp log tail \
  --name func-qrattendance-prod \
  --resource-group rg-qr-attendance-prod

# Deployment logs
cat deployment-*.log
```

### Functions Not Working

**Restart Function App**:
```bash
az functionapp restart \
  --name func-qrattendance-prod \
  --resource-group rg-qr-attendance-prod
```

**Check Settings**:
```bash
az functionapp config appsettings list \
  --name func-qrattendance-prod \
  --resource-group rg-qr-attendance-prod
```

### Frontend Not Loading

**Check Static Web App**:
```bash
az staticwebapp show \
  --name stapp-qrattendance-prod \
  --resource-group rg-qr-attendance-prod
```

**Check CORS**:
- Verify Function App CORS includes Static Web App URL
- Check browser console for CORS errors

### Database Issues

**Verify Tables**:
```bash
./scripts/tables-config.sh list prod
```

**Recreate Tables** (if needed):
```bash
./scripts/tables-config.sh delete prod
./scripts/tables-config.sh create prod
```

---

## Rollback

### Rollback Backend

```bash
# List deployments
az functionapp deployment list \
  --name func-qrattendance-prod \
  --resource-group rg-qr-attendance-prod

# Rollback to previous
az functionapp deployment source config-zip \
  --name func-qrattendance-prod \
  --resource-group rg-qr-attendance-prod \
  --src previous-deployment.zip
```

### Rollback Frontend

```bash
# Redeploy previous version
cd frontend
git checkout <previous-commit>
npm run build
swa deploy ./out --deployment-token "$SWA_TOKEN" --env production
```

---

## Monitoring

### View Logs

```bash
# Stream Function App logs
az functionapp log tail \
  --name func-qrattendance-prod \
  --resource-group rg-qr-attendance-prod

# View deployment history
az deployment group list \
  --resource-group rg-qr-attendance-prod \
  --query "[0:5].{Name:name,State:properties.provisioningState,Time:properties.timestamp}" \
  --output table
```

### Check Metrics

```bash
# Function App metrics
az monitor metrics list \
  --resource /subscriptions/.../func-qrattendance-prod \
  --metric FunctionExecutionCount

# Storage metrics
az monitor metrics list \
  --resource /subscriptions/.../stqrattendanceprod \
  --metric Transactions
```

---

## CI/CD (Optional)

### GitHub Actions

Create `.github/workflows/deploy-production.yml`:

```yaml
name: Deploy to Production

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: azure/login@v1
        with:
          creds: ${{ secrets.AZURE_CREDENTIALS }}
      - name: Deploy
        run: ./deploy-full-production.sh
```

---

## Related Documentation

- **AZURE_ENVIRONMENT.md** - Azure resources overview
- **DATABASE_TABLES.md** - Database schema
- **ENVIRONMENTS.md** - Environment scripts
- **SECURITY.md** - Security best practices

---

## Quick Reference

```bash
# Full deployment
./deploy-full-production.sh

# Check status
az functionapp show --name func-qrattendance-prod --resource-group rg-qr-attendance-prod --query state

# View logs
az functionapp log tail --name func-qrattendance-prod --resource-group rg-qr-attendance-prod

# Restart
az functionapp restart --name func-qrattendance-prod --resource-group rg-qr-attendance-prod

# List functions
az functionapp function list --name func-qrattendance-prod --resource-group rg-qr-attendance-prod

# List tables
az storage table list --account-name stqrattendanceprod
```

---

**Production is deployed and running!** 🚀
