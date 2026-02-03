# QR Chain Attendance System - Deployment Guide

## Overview

This guide provides step-by-step instructions to deploy the QR Chain Attendance System to Azure using Bicep Infrastructure as Code.

---

## Prerequisites

### Required Tools
- **Azure CLI** (version 2.50.0 or later)
- **Node.js** 18.x or later
- **Git**
- **Bicep CLI** (included with Azure CLI)

### Required Accounts
- **Azure Subscription** with Owner or Contributor role
- **GitHub Account** with repository access
- **Azure AD** (Microsoft Entra ID) access

### Install Azure CLI
```bash
# Linux
curl -sL https://aka.ms/InstallAzureCLIDeb | sudo bash

# macOS
brew install azure-cli

# Windows
# Download from https://aka.ms/installazurecliwindows
```

---

## Step 1: Azure AD App Registration

### 1.1 Create App Registration

```bash
# Login to Azure
az login

# Create app registration
az ad app create \
  --display-name "QR Chain Attendance System" \
  --sign-in-audience AzureADMyOrg \
  --web-redirect-uris "http://localhost:3000/.auth/login/aad/callback" \
  --enable-id-token-issuance true
```

**Save the output values:**
- `appId` → This is your **Client ID**
- `id` → This is your **Object ID**

### 1.2 Get Tenant ID

```bash
az account show --query tenantId --output tsv
```

**Save this as your Tenant ID**

### 1.3 Create Client Secret

```bash
# Replace <app-id> with your Client ID from step 1.1
az ad app credential reset \
  --id <app-id> \
  --append \
  --display-name "QR Attendance Secret" \
  --years 2
```

**⚠️ IMPORTANT**: Copy the `password` value immediately - it won't be shown again!  
**Save this as your Client Secret**

### 1.4 Configure API Permissions

```bash
# Add Microsoft Graph User.Read permission
az ad app permission add \
  --id <app-id> \
  --api 00000003-0000-0000-c000-000000000000 \
  --api-permissions e1fe6dd8-ba31-4d61-89e7-88639da4683d=Scope

# Grant admin consent
az ad app permission admin-consent --id <app-id>
```

### 1.5 Configure App Roles

```bash
# Create roles configuration
cat > roles.json << EOF
{
  "appRoles": [
    {
      "allowedMemberTypes": ["User"],
      "description": "Teachers can create sessions and view attendance",
      "displayName": "Teacher",
      "id": "$(uuidgen)",
      "isEnabled": true,
      "value": "Teacher"
    },
    {
      "allowedMemberTypes": ["User"],
      "description": "Students can join sessions and scan QR codes",
      "displayName": "Student",
      "id": "$(uuidgen)",
      "isEnabled": true,
      "value": "Student"
    }
  ]
}
EOF

# Update app registration with roles
az ad app update --id <app-id> --app-roles @roles.json

# Clean up
rm roles.json
```

---

## Step 2: GitHub Setup

### 2.1 Create GitHub Repository

1. Go to https://github.com/new
2. Create a new repository (public or private)
3. Note the repository URL: `https://github.com/YOUR-USERNAME/YOUR-REPO`

### 2.2 Create GitHub Personal Access Token

1. Go to https://github.com/settings/tokens?type=beta
2. Click **"Generate new token"**
3. Configure:
   - **Token name**: `QR Attendance Deployment`
   - **Expiration**: 90 days (or custom)
   - **Repository access**: Select your repository
   - **Repository permissions**:
     - ✅ Contents: Read and write
     - ✅ Metadata: Read-only
     - ✅ Workflows: Read and write
     - ✅ Administration: Read and write
4. Click **"Generate token"**
5. **⚠️ IMPORTANT**: Copy the token immediately!

### 2.3 Push Code to Repository

```bash
# Initialize git (if not already done)
git init
git branch -M main

# Add remote
git remote add origin https://github.com/YOUR-USERNAME/YOUR-REPO.git

# Commit and push
git add .
git commit -m "Initial commit"
git push -u origin main
```

---

## Step 3: Prepare Deployment Configuration

### 3.1 Create Secure Configuration File

**⚠️ NEVER commit this file to Git!**

```bash
# Create a secure configuration file
cat > .deployment-config << 'EOF'
# Azure AD Configuration
export AAD_CLIENT_ID="your-client-id-here"
export AAD_CLIENT_SECRET="your-client-secret-here"
export AAD_TENANT_ID="your-tenant-id-here"

# GitHub Configuration
export GITHUB_REPO_URL="https://github.com/YOUR-USERNAME/YOUR-REPO"
export GITHUB_TOKEN="your-github-token-here"

# Azure Configuration
export AZURE_SUBSCRIPTION_ID="your-subscription-id"
export RESOURCE_GROUP="rg-qr-attendance-dev"
export LOCATION="eastus2"
EOF

# Secure the file
chmod 600 .deployment-config
```

### 3.2 Update .gitignore

Ensure these files are in `.gitignore`:

```bash
# Check if already in .gitignore
grep -q ".deployment-config" .gitignore || echo ".deployment-config" >> .gitignore
grep -q "*.secret" .gitignore || echo "*.secret" >> .gitignore
grep -q "credential.json" .gitignore || echo "credential.json" >> .gitignore
grep -q "github-token.txt" .gitignore || echo "github-token.txt" >> .gitignore
```

---

## Step 4: Deploy Infrastructure

### 4.1 Load Configuration

```bash
# Load your secure configuration
source .deployment-config

# Verify variables are set
echo "Client ID: ${AAD_CLIENT_ID:0:8}..."
echo "Repo URL: $GITHUB_REPO_URL"
```

### 4.2 Deploy Backend Infrastructure

```bash
# Navigate to infrastructure directory
cd infrastructure

# Deploy backend (without Static Web App first)
./deploy.sh \
  --environment dev \
  --resource-group "$RESOURCE_GROUP" \
  --location "$LOCATION" \
  --client-id "$AAD_CLIENT_ID" \
  --client-secret "$AAD_CLIENT_SECRET"
```

**Expected time**: 5-10 minutes

### 4.3 Deploy Static Web App

The Static Web App must be deployed separately due to Azure API limitations:

```bash
# Deploy Static Web App module directly
az deployment group create \
  --resource-group "$RESOURCE_GROUP" \
  --name "staticwebapp-$(date +%H%M%S)" \
  --template-file modules/staticwebapp.bicep \
  --parameters \
    staticWebAppName="swa-qrattendance-dev" \
    location="$LOCATION" \
    repositoryUrl="$GITHUB_REPO_URL" \
    repositoryBranch="main" \
    repositoryToken="$GITHUB_TOKEN" \
    tenantId="$AAD_TENANT_ID" \
    aadClientId="$AAD_CLIENT_ID" \
    aadClientSecret="$AAD_CLIENT_SECRET" \
    tags='{"Environment":"dev"}'
```

**Expected time**: 2-3 minutes

### 4.4 Get Deployment Outputs

```bash
# Get Static Web App URL
SWA_URL=$(az staticwebapp show \
  --name swa-qrattendance-dev \
  --resource-group "$RESOURCE_GROUP" \
  --query defaultHostname \
  --output tsv)

echo "Static Web App URL: https://$SWA_URL"

# Get Function App URL
FUNC_URL=$(az functionapp show \
  --name func-qrattendance-dev \
  --resource-group "$RESOURCE_GROUP" \
  --query defaultHostName \
  --output tsv)

echo "Function App URL: https://$FUNC_URL"
```

---

## Step 5: Post-Deployment Configuration

### 5.1 Update Azure AD Redirect URI

```bash
# Update redirect URI with actual Static Web App URL
az ad app update \
  --id "$AAD_CLIENT_ID" \
  --web-redirect-uris \
    "https://$SWA_URL/.auth/login/aad/callback" \
    "http://localhost:3000/.auth/login/aad/callback"
```

### 5.2 Assign Users to Roles

```bash
# Create service principal (if not exists)
az ad sp create --id "$AAD_CLIENT_ID"

# Assign yourself as Teacher
./scripts/assign-user-roles.sh your-email@domain.com Teacher

# Assign students
./scripts/assign-user-roles.sh student@domain.com Student
```

### 5.3 Configure Static Web App Settings

```bash
az staticwebapp appsettings set \
  --name swa-qrattendance-dev \
  --resource-group "$RESOURCE_GROUP" \
  --setting-names \
    AAD_CLIENT_ID="$AAD_CLIENT_ID" \
    TENANT_ID="$AAD_TENANT_ID" \
    NEXT_PUBLIC_API_URL="https://$FUNC_URL"
```

---

## Step 6: Deploy Application Code

### 6.1 Deploy Backend Code

```bash
cd ../backend

# Install dependencies
npm install

# Build
npm run build

# Deploy to Azure Functions
func azure functionapp publish func-qrattendance-dev
```

### 6.2 Deploy Frontend Code

Frontend deploys automatically via GitHub Actions:

```bash
cd ..

# Commit and push
git add .
git commit -m "Deploy application"
git push origin main
```

Monitor deployment: https://github.com/YOUR-USERNAME/YOUR-REPO/actions

---

## Step 7: Verify Deployment

### 7.1 Test Backend API

```bash
# Health check
curl https://$FUNC_URL/api/health

# Should return: {"status":"healthy"}
```

### 7.2 Test Frontend

1. Open: `https://$SWA_URL`
2. Click "Sign In"
3. Authenticate with your Azure AD account
4. Verify you can access the application

### 7.3 Check Monitoring

```bash
# View Application Insights logs
az monitor app-insights query \
  --app appi-qrattendance-dev \
  --resource-group "$RESOURCE_GROUP" \
  --analytics-query "traces | take 10"
```

---

## Security Best Practices

### ✅ DO

- ✅ Store secrets in `.deployment-config` (not in Git)
- ✅ Use `chmod 600` on configuration files
- ✅ Rotate secrets every 6-12 months
- ✅ Use managed identities where possible
- ✅ Enable Application Insights monitoring
- ✅ Review Azure AD sign-in logs regularly
- ✅ Assign users to specific roles (Teacher/Student)
- ✅ Use HTTPS only

### ❌ DON'T

- ❌ Commit secrets to Git
- ❌ Share client secrets via email/chat
- ❌ Use the same secret across environments
- ❌ Disable authentication
- ❌ Grant admin rights to all users
- ❌ Ignore security updates

---

## Files That Must NOT Be Committed

Verify these are in `.gitignore`:

```
.deployment-config
*.secret
credential.json
github-token.txt
ad-apps.json
azure-ad-summary.md
deploy-now.sh
roles.json
local.settings.json
.env
.env.local
```

---

## Troubleshooting

### Issue: "RepositoryUrl is invalid"

**Solution**: Deploy Static Web App module directly (Step 4.3)

### Issue: "SkuCode 'Free' is invalid"

**Solution**: Already fixed - using "Standard" SKU

### Issue: "Principal not found"

**Solution**: Wait 30-60 seconds for managed identity propagation, then retry

### Issue: GitHub Actions failing

**Solution**: 
1. Check token has Administration permission
2. Verify repository URL is correct
3. Check GitHub Actions logs

### Issue: Authentication not working

**Solution**:
1. Verify redirect URI is correct
2. Check users are assigned to roles
3. Verify client ID and tenant ID

---

## Clean Up (Delete Everything)

**⚠️ WARNING**: This deletes ALL resources!

```bash
# Delete resource group
az group delete \
  --name "$RESOURCE_GROUP" \
  --yes \
  --no-wait

# Optionally delete Azure AD app registration
az ad app delete --id "$AAD_CLIENT_ID"
```

---

## Cost Monitoring

### View Current Costs

```bash
az consumption usage list \
  --start-date $(date -d '30 days ago' +%Y-%m-%d) \
  --end-date $(date +%Y-%m-%d) \
  --query "[?contains(instanceName, 'qrattendance')]"
```

### Set Budget Alert

```bash
az consumption budget create \
  --budget-name "qr-attendance-budget" \
  --amount 50 \
  --time-grain Monthly \
  --start-date $(date +%Y-%m-01) \
  --end-date $(date -d '+1 year' +%Y-%m-01)
```

---

## Next Steps

1. ✅ Deploy infrastructure (Steps 1-4)
2. ✅ Configure post-deployment (Step 5)
3. ✅ Deploy application code (Step 6)
4. ✅ Verify deployment (Step 7)
5. 📚 Read [Development Guide](docs/DEVELOPMENT.md)
6. 📊 Set up [Monitoring](docs/MONITORING.md)
7. 👥 Assign users to roles
8. 🧪 Test the application

---

## Support

- **Documentation**: See `docs/` folder
- **Issues**: Check Application Insights logs
- **Azure Portal**: https://portal.azure.com
- **GitHub Actions**: Check deployment logs

---

## Summary Checklist

- [ ] Azure AD app registration created
- [ ] Client ID, Client Secret, Tenant ID saved securely
- [ ] GitHub repository created
- [ ] GitHub token created with correct permissions
- [ ] Configuration file created (`.deployment-config`)
- [ ] Backend infrastructure deployed
- [ ] Static Web App deployed
- [ ] Redirect URI updated
- [ ] Users assigned to roles
- [ ] Backend code deployed
- [ ] Frontend code deployed
- [ ] Application tested and working
- [ ] Monitoring configured
- [ ] Secrets secured (not in Git)

---

**🎉 Deployment Complete!**

Your QR Chain Attendance System is now live and ready to use.
