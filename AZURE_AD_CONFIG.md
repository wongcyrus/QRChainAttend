# Azure AD Configuration

This document explains the Azure AD configuration for the QR Chain Attendance System.

## Overview

The system uses Azure AD authentication with the following configuration:

- **App Name**: QR Chain Attendance System  
- **Client ID**: `dc482c34-ebaa-4239-aca3-2810a4f51728`
- **Multi-tenant**: Yes (`organizations`)

## Security Model

### ✅ Safe to Store in Git (Public Information)
- `AAD_CLIENT_ID` - This is meant to be public and is included in frontend code
- `TENANT_ID` - Multi-tenant identifier (`organizations`)
- App Name and other metadata

### ❌ Never Store in Git (Sensitive Information)
- `AAD_CLIENT_SECRET` - This must be kept secure at all times
- User tokens and session data
- Deployment tokens for Azure services

## Configuration Files

### `.env.azure-ad` ✅ Committed to Git
Contains only the public Client ID and metadata. Safe to commit.

```bash
AAD_CLIENT_ID="dc482c34-ebaa-4239-aca3-2810a4f51728"
TENANT_ID="organizations"
```

### Client Secret ❌ Not Stored
The Client Secret is never stored in files and must be provided during deployment:
- Via environment variable: `export AAD_CLIENT_SECRET="your-secret"`
- Interactive prompt during deployment
- CI/CD secrets (GitHub Secrets, Azure DevOps Variables, etc.)

## Deployment Usage

The deployment scripts automatically:
1. Load Client ID from `.env.azure-ad` if present
2. Prompt for Client Secret interactively (never stored)
3. Configure Azure resources with proper authentication

```bash
# Client ID is loaded automatically
./deploy-full-production.sh  

# Or set Client Secret via environment
export AAD_CLIENT_SECRET="your-secret"
./deploy-full-production.sh
```

## Current Redirect URIs

The Azure AD app is configured with these redirect URIs:
- **Dev Environment**: `https://red-grass-0f8bc910f.4.azurestaticapps.net/.auth/login/aad/callback`
- **Local Development**: `http://localhost:3000/.auth/login/aad/callback`
- **Production**: Added automatically during deployment

## Maintenance

Use the cleanup scripts to manage redirect URIs:
- `./list-resources.sh` - View current configuration
- `./undeploy-production.sh` - Clean up production URLs from AD app

The undeploy script preserves dev and localhost URLs while removing production URLs.