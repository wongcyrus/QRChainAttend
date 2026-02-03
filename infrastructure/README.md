# QR Chain Attendance System - Infrastructure as Code

This directory contains Bicep templates and deployment scripts for provisioning all Azure resources required by the QR Chain Attendance System.

## Overview

The infrastructure is defined using Azure Bicep (Infrastructure as Code) and includes:

- **Azure Static Web Apps** - Frontend hosting with built-in authentication
- **Azure Functions** - Serverless backend API (Consumption plan)
- **Azure Table Storage** - Data persistence for sessions, attendance, tokens, chains, and scan logs
- **Azure SignalR Service** - Real-time updates for teacher dashboard
- **Azure OpenAI** (Optional) - AI-powered insights for session analysis
- **Application Insights** - Monitoring and logging
- **Managed Identity** - Secure authentication between Azure services
- **RBAC Role Assignments** - Least-privilege access control

## Requirements Mapping

This infrastructure satisfies the following requirements:

- **Requirement 19.1**: Managed Identity for Table Storage authentication
- **Requirement 19.2**: Managed Identity for SignalR Service authentication
- **Requirement 19.3**: Managed Identity for Azure OpenAI authentication (optional)
- **Requirement 19.4**: Storage Table Data Contributor role for Static Web App and Function App
- **Requirement 19.5**: SignalR Service Owner role for Function App

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Azure Resources                          │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌──────────────────┐         ┌──────────────────┐        │
│  │ Static Web App   │         │ Function App     │        │
│  │ (Frontend)       │         │ (Backend API)    │        │
│  │ [Managed ID]     │         │ [Managed ID]     │        │
│  └────────┬─────────┘         └────────┬─────────┘        │
│           │                            │                   │
│           │ Storage Table              │ Storage Table     │
│           │ Data Contributor           │ Data Contributor  │
│           │                            │                   │
│           │                            │ SignalR Service   │
│           │                            │ Owner             │
│           │                            │                   │
│           ▼                            ▼                   │
│  ┌──────────────────────────────────────────────┐         │
│  │      Azure Table Storage                     │         │
│  │  - Sessions, Attendance, Tokens, Chains      │         │
│  └──────────────────────────────────────────────┘         │
│                                                             │
│                                  ▼                         │
│                         ┌──────────────────┐              │
│                         │ SignalR Service  │              │
│                         │ (Real-time)      │              │
│                         └──────────────────┘              │
│                                                             │
│                                  ▼                         │
│                         ┌──────────────────┐              │
│                         │ Azure OpenAI     │              │
│                         │ (Optional)       │              │
│                         └──────────────────┘              │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

## Directory Structure

```
infrastructure/
├── main.bicep                  # Main orchestration template
├── modules/                    # Modular Bicep templates
│   ├── storage.bicep          # Azure Storage Account with Table Storage
│   ├── signalr.bicep          # Azure SignalR Service
│   ├── functions.bicep        # Azure Functions (Backend)
│   ├── staticwebapp.bicep     # Azure Static Web App (Frontend)
│   ├── appinsights.bicep      # Application Insights
│   ├── openai.bicep           # Azure OpenAI (Optional)
│   └── rbac.bicep             # RBAC role assignments
├── parameters/                 # Environment-specific parameters
│   ├── dev.bicepparam         # Development environment
│   ├── staging.bicepparam     # Staging environment
│   └── prod.bicepparam        # Production environment
├── deploy.sh                   # Bash deployment script
├── deploy.ps1                  # PowerShell deployment script
└── README.md                   # This file
```

## Prerequisites

Before deploying, ensure you have:

1. **Azure CLI** installed (version 2.50.0 or later)
   ```bash
   az --version
   ```

2. **Azure subscription** with appropriate permissions
   - Owner or Contributor role on the subscription
   - User Access Administrator role (for RBAC assignments)

3. **Azure AD application** registered for authentication
   - Client ID
   - Client Secret
   - Redirect URIs configured

4. **GitHub repository** (for Static Web App deployment)
   - Repository URL
   - Personal Access Token (PAT) with `repo` scope

5. **Logged in to Azure CLI**
   ```bash
   az login
   az account set --subscription "<your-subscription-id>"
   ```

## Quick Start

### 1. Register Azure AD Application

First, create an Azure AD application for authentication:

```bash
# Create app registration
az ad app create \
  --display-name "QR Chain Attendance System" \
  --sign-in-audience AzureADMyOrg

# Note the Application (client) ID from the output
```

See [DEPLOYMENT_GUIDE.md](../DEPLOYMENT_GUIDE.md) for detailed Azure AD setup instructions.

### 2. Deploy Infrastructure

#### Using Bash (Linux/macOS)

```bash
# Make the script executable
chmod +x infrastructure/deploy.sh

# Deploy to development environment
./infrastructure/deploy.sh \
  --environment dev \
  --resource-group rg-qr-attendance-dev \
  --repository-url "https://github.com/your-org/your-repo" \
  --token "ghp_your_github_token" \
  --client-id "your-aad-client-id" \
  --client-secret "your-aad-client-secret"

# Deploy to production with Azure OpenAI
./infrastructure/deploy.sh \
  --environment prod \
  --resource-group rg-qr-attendance-prod \
  --repository-url "https://github.com/your-org/your-repo" \
  --token "ghp_your_github_token" \
  --client-id "your-aad-client-id" \
  --client-secret "your-aad-client-secret" \
  --deploy-openai true
```

#### Using PowerShell (Windows)

```powershell
# Deploy to development environment
.\infrastructure\deploy.ps1 `
  -Environment dev `
  -ResourceGroup rg-qr-attendance-dev `
  -RepositoryUrl "https://github.com/your-org/your-repo" `
  -RepositoryToken "ghp_your_github_token" `
  -AadClientId "your-aad-client-id" `
  -AadClientSecret "your-aad-client-secret"

# Deploy to production with Azure OpenAI
.\infrastructure\deploy.ps1 `
  -Environment prod `
  -ResourceGroup rg-qr-attendance-prod `
  -RepositoryUrl "https://github.com/your-org/your-repo" `
  -RepositoryToken "ghp_your_github_token" `
  -AadClientId "your-aad-client-id" `
  -AadClientSecret "your-aad-client-secret" `
  -DeployOpenAI $true
```

### 3. Verify Deployment

After deployment completes, verify the resources:

```bash
# List all resources in the resource group
az resource list --resource-group rg-qr-attendance-dev --output table

# Verify managed identity role assignments
./scripts/verify-managed-identity.sh \
  --resource-group rg-qr-attendance-dev \
  --swa-name swa-qrattendance-dev \
  --function-app-name func-qrattendance-dev
```

## Deployment Options

### What-If Mode

Preview changes before deploying:

```bash
# Bash
./infrastructure/deploy.sh \
  --environment dev \
  --resource-group rg-qr-attendance-dev \
  --what-if

# PowerShell
.\infrastructure\deploy.ps1 `
  -Environment dev `
  -ResourceGroup rg-qr-attendance-dev `
  -WhatIf
```

### Environment-Specific Deployments

The infrastructure supports three environments:

#### Development (dev)
- Free tier SignalR Service (20 concurrent connections)
- No Azure OpenAI by default
- Minimal monitoring
- Cost-optimized for testing

#### Staging (staging)
- Standard tier SignalR Service
- Azure OpenAI enabled
- Full monitoring and logging
- Production-like configuration

#### Production (prod)
- Standard tier SignalR Service
- Azure OpenAI enabled
- Full monitoring and alerting
- High availability configuration

### Custom Parameters

Override default parameters:

```bash
./infrastructure/deploy.sh \
  --environment dev \
  --resource-group rg-qr-attendance-dev \
  --location westus2 \
  --branch develop \
  --deploy-openai true
```

## Resource Naming Convention

Resources are named using the pattern: `<resource-type>-<base-name>-<environment>`

Examples:
- Storage Account: `stqrattendancedev` (no hyphens, lowercase)
- SignalR Service: `signalr-qrattendance-dev`
- Static Web App: `swa-qrattendance-dev`
- Function App: `func-qrattendance-dev`
- App Service Plan: `asp-qrattendance-dev`
- Application Insights: `appi-qrattendance-dev`
- Azure OpenAI: `openai-qrattendance-dev`

## Managed Identity and RBAC

The deployment automatically configures:

### Static Web App Managed Identity
- **Storage Table Data Contributor** on Storage Account
  - Read, write, delete table entities
  - Required for direct table access (if needed)

### Function App Managed Identity
- **Storage Table Data Contributor** on Storage Account
  - Read, write, delete table entities
  - Primary backend data access
- **SignalR Service Owner** on SignalR Service
  - Full access to send messages
  - Manage connections and groups
- **Cognitive Services OpenAI User** on Azure OpenAI (if deployed)
  - Read access to OpenAI resources
  - Call OpenAI API endpoints

Role assignments may take 5-10 minutes to propagate after deployment.

## Post-Deployment Steps

After infrastructure deployment:

1. **Update GitHub Secrets**
   - Add `AZURE_STATIC_WEB_APPS_API_TOKEN` to repository secrets
   - Token is available in deployment outputs

2. **Configure Static Web App**
   - Update `staticwebapp.config.json` with tenant ID
   - Configure route rules and authentication

3. **Deploy Application Code**
   - Push code to GitHub to trigger deployment
   - Or manually deploy using Azure CLI

4. **Verify Managed Identity**
   - Run verification script: `./scripts/verify-managed-identity.sh`
   - Check role assignments in Azure Portal

5. **Test Authentication**
   - Navigate to Static Web App URL
   - Sign in with @vtc.edu.hk or @stu.edu.hk account
   - Verify role-based access

6. **Configure Monitoring**
   - Set up Application Insights alerts
   - Configure log retention policies
   - Enable diagnostic settings

## Updating Infrastructure

To update existing infrastructure:

```bash
# Deploy with same parameters - Bicep will update only changed resources
./infrastructure/deploy.sh \
  --environment dev \
  --resource-group rg-qr-attendance-dev \
  --repository-url "https://github.com/your-org/your-repo" \
  --token "ghp_your_github_token"
```

Bicep deployments are idempotent - running the same deployment multiple times produces the same result.

## Deleting Resources

To delete all resources:

```bash
# Delete entire resource group (WARNING: This deletes ALL resources)
az group delete --name rg-qr-attendance-dev --yes --no-wait

# Or delete specific resources
az staticwebapp delete --name swa-qrattendance-dev --resource-group rg-qr-attendance-dev
az functionapp delete --name func-qrattendance-dev --resource-group rg-qr-attendance-dev
```

## Troubleshooting

### Deployment Fails with "Principal not found"

**Cause**: Managed identity hasn't propagated through Azure AD yet.

**Solution**: Wait 30-60 seconds and retry the deployment.

### Role Assignment Fails

**Cause**: Insufficient permissions to assign roles.

**Solution**: Ensure you have Owner or User Access Administrator role on the subscription.

### Static Web App Deployment Fails

**Cause**: Invalid GitHub token or repository URL.

**Solution**: 
- Verify GitHub token has `repo` scope
- Ensure repository URL is correct
- Check repository is accessible

### SignalR Connection Issues

**Cause**: Role assignment not propagated or incorrect configuration.

**Solution**:
- Wait 5-10 minutes for role propagation
- Verify role assignment: `az role assignment list --assignee <principal-id>`
- Check SignalR connection string in Function App settings

### Storage Access Denied

**Cause**: Managed identity not enabled or role not assigned.

**Solution**:
- Verify managed identity is enabled: `az functionapp identity show`
- Check role assignment on storage account
- Ensure Storage Table Data Contributor role is assigned

## Cost Estimation

### Development Environment
- Static Web App: Free tier ($0/month)
- Function App: Consumption plan (~$5-10/month for light usage)
- Storage Account: ~$1-2/month
- SignalR Service: Free tier ($0/month, 20 connections)
- Application Insights: ~$2-5/month
- **Total: ~$8-17/month**

### Production Environment
- Static Web App: Free tier ($0/month)
- Function App: Consumption plan (~$20-50/month for moderate usage)
- Storage Account: ~$5-10/month
- SignalR Service: Standard tier (~$50/month, 1000 connections)
- Application Insights: ~$10-20/month
- Azure OpenAI: ~$50-100/month (if enabled)
- **Total: ~$85-230/month**

Costs vary based on actual usage. Monitor costs in Azure Cost Management.

## Security Best Practices

1. **Use Managed Identity** - Never store credentials in code or configuration
2. **Least Privilege** - Assign only required roles
3. **Resource Scope** - Scope role assignments to specific resources, not subscription
4. **Secure Secrets** - Store sensitive values in Azure Key Vault
5. **Network Security** - Configure network ACLs and firewall rules
6. **Monitoring** - Enable diagnostic logs and alerts
7. **Regular Audits** - Review role assignments and access logs monthly

## CI/CD Integration

### GitHub Actions

The deployment can be integrated into GitHub Actions:

```yaml
name: Deploy Infrastructure

on:
  push:
    branches: [main]
    paths:
      - 'infrastructure/**'

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Azure Login
        uses: azure/login@v1
        with:
          creds: ${{ secrets.AZURE_CREDENTIALS }}
      
      - name: Deploy Infrastructure
        run: |
          ./infrastructure/deploy.sh \
            --environment prod \
            --resource-group rg-qr-attendance-prod \
            --repository-url "${{ github.server_url }}/${{ github.repository }}" \
            --token "${{ secrets.GH_PAT }}" \
            --client-id "${{ secrets.AAD_CLIENT_ID }}" \
            --client-secret "${{ secrets.AAD_CLIENT_SECRET }}"
```

### Azure DevOps

```yaml
trigger:
  branches:
    include:
      - main
  paths:
    include:
      - infrastructure/*

pool:
  vmImage: 'ubuntu-latest'

steps:
  - task: AzureCLI@2
    displayName: 'Deploy Infrastructure'
    inputs:
      azureSubscription: 'Azure-Subscription'
      scriptType: 'bash'
      scriptLocation: 'scriptPath'
      scriptPath: 'infrastructure/deploy.sh'
      arguments: >
        --environment prod
        --resource-group rg-qr-attendance-prod
        --repository-url "$(Build.Repository.Uri)"
        --token "$(GH_PAT)"
        --client-id "$(AAD_CLIENT_ID)"
        --client-secret "$(AAD_CLIENT_SECRET)"
```

## Related Documentation

- [DEPLOYMENT_GUIDE.md](../DEPLOYMENT_GUIDE.md) - Complete deployment guide
- [MANAGED_IDENTITY_RBAC.md](../MANAGED_IDENTITY_RBAC.md) - Managed Identity configuration
- [AZURE_STATIC_WEB_APP_CONFIG.md](../AZURE_STATIC_WEB_APP_CONFIG.md) - Static Web App configuration
- [Design Document](.kiro/specs/qr-chain-attendance/design.md) - System architecture
- [Requirements](.kiro/specs/qr-chain-attendance/requirements.md) - System requirements

## Support

For issues or questions:

1. Check the troubleshooting section above
2. Review Azure deployment logs: `az deployment group show`
3. Check Application Insights for runtime errors
4. Consult the related documentation

## License

This infrastructure code is part of the QR Chain Attendance System project.
