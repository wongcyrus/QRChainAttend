# Quick Deployment Guide

## Prerequisites Checklist

Before deploying, you need:

- ✅ Azure AD App Registration (Client ID: `dc482c34-ebaa-4239-aca3-2810a4f51728`)
- ✅ Azure AD Client Secret (from Step 3 of Azure AD setup)
- ⏳ GitHub Repository
- ⏳ GitHub Personal Access Token

## Step 1: Create/Use GitHub Repository

### Option A: Use Existing Repository
If this code is already in a GitHub repo, note the URL:
```
https://github.com/YOUR-USERNAME/YOUR-REPO-NAME
```

### Option B: Create New Repository
```bash
# Initialize git if not already done
git init

# Create a new repository on GitHub (via web interface)
# Then add it as remote:
git remote add origin https://github.com/YOUR-USERNAME/YOUR-REPO-NAME.git
git branch -M main
git add .
git commit -m "Initial commit"
git push -u origin main
```

## Step 2: Create GitHub Personal Access Token

### Option A: Fine-Grained Token (Recommended - More Secure)

1. Go to GitHub Settings: https://github.com/settings/tokens?type=beta
2. Click **"Generate new token"**
3. Configure the token:
   - **Token name**: `QR Attendance Deployment`
   - **Expiration**: 90 days (or custom)
   - **Repository access**: Select **"Only select repositories"**
     - Choose your QR attendance repository
   - **Permissions** → **Repository permissions**:
     - ✅ **Contents**: Read and write
     - ✅ **Metadata**: Read-only (automatically selected)
     - ✅ **Workflows**: Read and write
     - ✅ **Administration**: Read and write (needed for Static Web Apps)
4. Click **"Generate token"**
5. **COPY THE TOKEN IMMEDIATELY** (you won't see it again!)

### Option B: Classic Token (Also Works)

1. Go to GitHub Settings: https://github.com/settings/tokens
2. Click **"Generate new token"** → **"Generate new token (classic)"**
3. Give it a name: `QR Attendance Deployment`
4. Select scopes:
   - ✅ **repo** (Full control of private repositories)
   - ✅ **workflow** (Update GitHub Action workflows)
5. Click **"Generate token"**
6. **COPY THE TOKEN IMMEDIATELY** (you won't see it again!)

## Step 3: Deploy Infrastructure

### Full Deployment (with Static Web App)

```bash
cd infrastructure

./deploy.sh \
  --environment dev \
  --resource-group rg-qr-attendance-dev \
  --repository-url "https://github.com/YOUR-USERNAME/YOUR-REPO-NAME" \
  --token "ghp_YOUR_GITHUB_TOKEN" \
  --client-id "dc482c34-ebaa-4239-aca3-2810a4f51728" \
  --client-secret "YOUR_CLIENT_SECRET"
```

### Backend Only Deployment (Skip Static Web App for now)

If you want to deploy just the backend first:

```bash
# We'll need to modify the deployment to skip Static Web App
# See Option 3 below
```

## Step 4: After Deployment

Once deployment succeeds, you'll get output with:
- Static Web App URL
- Function App URL
- Storage Account name
- SignalR connection string

## Option 3: Deploy Backend Only (No GitHub Required)

If you don't want to set up GitHub yet, I can help you modify the deployment to skip the Static Web App and deploy only:
- Azure Functions (Backend API)
- Azure Storage (Database)
- Azure SignalR (Real-time updates)
- Application Insights (Monitoring)

Would you like me to create a backend-only deployment option?

## Troubleshooting

### "RepositoryUrl cannot be empty"
- You must provide both `--repository-url` and `--token` parameters
- Or use the backend-only deployment option

### "Invalid GitHub token"
- Ensure token has `repo` and `workflow` scopes
- Token must not be expired
- Token must have access to the repository

### "Location not available"
- Already fixed! Using `eastus2` instead of `eastus`

## Quick Reference

**Your Azure AD Details:**
- Client ID: `dc482c34-ebaa-4239-aca3-2810a4f51728`
- Tenant ID: `8ff7db19-435d-4c3c-83d3-ca0a46234f51`
- Service Principal ID: `fc431d20-c83a-4e48-a2bc-00802044b5a0`

**Deployment Command Template:**
```bash
./infrastructure/deploy.sh \
  --environment dev \
  --resource-group rg-qr-attendance-dev \
  --repository-url "YOUR_GITHUB_REPO_URL" \
  --token "YOUR_GITHUB_TOKEN" \
  --client-id "dc482c34-ebaa-4239-aca3-2810a4f51728" \
  --client-secret "YOUR_CLIENT_SECRET"
```
