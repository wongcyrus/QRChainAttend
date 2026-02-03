# GitHub Actions Workflows

This directory contains CI/CD workflows for the QR Chain Attendance System.

## Workflows Overview

### ✅ Required Workflows (Active)

#### 1. Test Workflow (`test.yml`)
**Status**: ✅ Active  
**Triggers**: All pushes and pull requests  
**Purpose**: Run backend and frontend tests  
**Required Secrets**: None  

**What it does:**
- Runs backend unit and property tests
- Runs frontend unit and property tests
- Generates coverage reports
- Validates code quality

**No configuration needed** - works out of the box.

---

#### 2. Backend Deploy (`backend-deploy.yml`)
**Status**: ✅ Active  
**Triggers**: Push to main (backend changes), manual dispatch  
**Purpose**: Deploy backend to Azure Functions  

**Required Secrets:**
- `AZURE_CREDENTIALS_STAGING` - Azure service principal credentials (JSON)
- `AZURE_FUNCTIONAPP_NAME_STAGING` - Function App name
- `AZURE_CREDENTIALS_PRODUCTION` - For production deployments
- `AZURE_FUNCTIONAPP_NAME_PRODUCTION` - For production deployments

**Setup Instructions:**
1. Run `./scripts/setup-cicd-credentials.sh` (see [docs/CICD_SETUP.md](../../docs/CICD_SETUP.md))
2. Set the generated secrets in GitHub repository settings
3. Push to main or manually trigger the workflow

---

#### 3. Frontend Deploy (`frontend-deploy.yml`)
**Status**: ✅ Active  
**Triggers**: Push to main (frontend changes), pull requests  
**Purpose**: Deploy frontend to Azure Static Web Apps  

**Required Secrets:**
- `AZURE_STATIC_WEB_APPS_API_TOKEN` - Static Web App deployment token

**Setup Instructions:**
1. Get deployment token from Azure Portal:
   - Go to your Static Web App
   - Settings → Configuration → Deployment token
   - Copy the token
2. Add as `AZURE_STATIC_WEB_APPS_API_TOKEN` secret in GitHub
3. Push to main to trigger deployment

**Note**: This workflow auto-deploys on every push to main.

---

### ⚠️ Optional Workflows (Manual Only)

#### 4. Infrastructure Deploy (`infrastructure-deploy.yml`)
**Status**: ⚠️ Optional - Manual dispatch only  
**Triggers**: Manual dispatch only  
**Purpose**: Deploy Azure infrastructure with Bicep  

**When to use:**
- Automating infrastructure deployments
- Managing multiple environments (dev/staging/prod)
- Infrastructure as Code workflows

**When NOT needed:**
- Infrastructure already deployed manually
- Using Azure Portal for infrastructure management
- One-time deployments

**Required Secrets (if using):**
- `AZURE_CREDENTIALS_STAGING` - Azure service principal credentials
- `AZURE_RESOURCE_GROUP_STAGING` - Resource group name
- `AZURE_LOCATION` - Azure region (optional, defaults to eastus)
- `GH_PAT` - GitHub Personal Access Token
- `AAD_CLIENT_ID_STAGING` - Azure AD client ID
- `AAD_CLIENT_SECRET_STAGING` - Azure AD client secret
- Similar secrets for production environment

**Setup Instructions:**
See [docs/CICD_SETUP.md](../../docs/CICD_SETUP.md) for complete setup guide.

---

## Quick Setup Guide

### Minimal Setup (Frontend + Backend Deployment)

If infrastructure is already deployed manually, you only need:

**1. Backend Deployment Secrets:**
```bash
# Run the setup script
./scripts/setup-cicd-credentials.sh \
  <subscription-id> \
  <resource-group> \
  <github-repo>

# This creates and sets:
# - AZURE_CREDENTIALS_STAGING
# - AZURE_CLIENT_ID
# - AZURE_TENANT_ID
# - AZURE_SUBSCRIPTION_ID
```

**2. Frontend Deployment Secret:**
```bash
# Get from Azure Portal
# Static Web App → Configuration → Deployment token
# Add as: AZURE_STATIC_WEB_APPS_API_TOKEN
```

**3. Function App Name:**
```bash
# Add these secrets manually:
# AZURE_FUNCTIONAPP_NAME_STAGING = your-function-app-name
# AZURE_FUNCTIONAPP_NAME_PRODUCTION = your-prod-function-app-name
```

### Full Setup (Including Infrastructure Automation)

For complete CI/CD automation including infrastructure:

See [docs/CICD_SETUP.md](../../docs/CICD_SETUP.md)

---

## Workflow Status

Check workflow runs:
- **Repository Actions**: https://github.com/YOUR-USERNAME/YOUR-REPO/actions
- **Test Workflow**: Should pass on every commit
- **Backend Deploy**: Runs on push to main (backend changes)
- **Frontend Deploy**: Runs on push to main (frontend changes)
- **Infrastructure Deploy**: Manual only (optional)

---

## Troubleshooting

### "Login failed" Error

**Problem**: Azure login fails with missing credentials

**Solution**:
1. Verify secrets are set in GitHub repository settings
2. Check secret names match exactly (case-sensitive)
3. Ensure service principal has correct permissions
4. Run `./scripts/setup-cicd-credentials.sh` to regenerate

### "Function App not found" Error

**Problem**: Backend deployment fails to find Function App

**Solution**:
1. Verify `AZURE_FUNCTIONAPP_NAME_STAGING` secret is set
2. Check Function App exists in Azure Portal
3. Ensure service principal has access to the Function App

### "Static Web App deployment failed" Error

**Problem**: Frontend deployment fails

**Solution**:
1. Verify `AZURE_STATIC_WEB_APPS_API_TOKEN` is correct
2. Get fresh token from Azure Portal
3. Check Static Web App exists and is accessible

### Infrastructure Workflow Triggering Unexpectedly

**Problem**: Infrastructure workflow runs when you don't want it to

**Solution**:
- Infrastructure workflow now only runs on manual dispatch
- It won't trigger automatically on pushes
- Manually trigger from Actions tab if needed

---

## Disabling Workflows

To disable a workflow:

**Option 1: GitHub UI**
1. Go to Actions tab
2. Select the workflow
3. Click "..." → Disable workflow

**Option 2: Rename File**
```bash
# Rename to .disabled extension
mv .github/workflows/infrastructure-deploy.yml \
   .github/workflows/infrastructure-deploy.yml.disabled
```

**Option 3: Delete File**
```bash
# Remove the workflow file
rm .github/workflows/infrastructure-deploy.yml
```

---

## Required Secrets Summary

### For Backend + Frontend (Minimal)
```
AZURE_CREDENTIALS_STAGING          # Azure service principal (JSON)
AZURE_FUNCTIONAPP_NAME_STAGING     # Function App name
AZURE_STATIC_WEB_APPS_API_TOKEN    # Static Web App token
```

### For Production Deployments
```
AZURE_CREDENTIALS_PRODUCTION       # Production service principal
AZURE_FUNCTIONAPP_NAME_PRODUCTION  # Production Function App name
```

### For Infrastructure Automation (Optional)
```
AZURE_RESOURCE_GROUP_STAGING       # Resource group name
AZURE_LOCATION                     # Azure region (optional)
GH_PAT                            # GitHub Personal Access Token
AAD_CLIENT_ID_STAGING             # Azure AD client ID
AAD_CLIENT_SECRET_STAGING         # Azure AD client secret
```

---

## Next Steps

1. **If infrastructure is already deployed:**
   - Set up backend deployment secrets
   - Set up frontend deployment token
   - Test by pushing a small change

2. **If you want infrastructure automation:**
   - Follow [docs/CICD_SETUP.md](../../docs/CICD_SETUP.md)
   - Set up all required secrets
   - Test with manual dispatch first

3. **For production deployments:**
   - Create separate service principal for production
   - Set up production secrets
   - Use manual dispatch for production deployments

---

## Support

- **CI/CD Setup Guide**: [docs/CICD_SETUP.md](../../docs/CICD_SETUP.md)
- **Deployment Guide**: [DEPLOYMENT_GUIDE.md](../../DEPLOYMENT_GUIDE.md)
- **Security Guidelines**: [SECURITY.md](../../SECURITY.md)
- **GitHub Actions Logs**: Check the Actions tab for detailed logs
