# Fix: Production Authentication Issue

## Problem
The app is trying to access `/api/auth/me` in production instead of `/.auth/me`, resulting in 404 errors.

## Root Cause
Environment variables prefixed with `NEXT_PUBLIC_` must be set **at build time**, not just in Azure Static Web App settings. The current build was done before setting the environment variables.

## Solution

### Understanding Next.js Environment Variables

Next.js has two types of environment variables:

1. **Server-side only** - Available only in API routes and server-side code
2. **Client-side** (`NEXT_PUBLIC_*`) - Embedded into the JavaScript bundle at **build time**

Since `NEXT_PUBLIC_ENVIRONMENT` is used in client-side code (browser), it must be available when running `npm run build`.

### How Azure Static Web Apps Handles This

Azure Static Web Apps **does** inject environment variables during the build process when deploying via GitHub Actions. However, when deploying manually with `swa deploy`, the build happens locally first, so the environment variables aren't available.

## Fix Options

### Option 1: Use GitHub Actions (Recommended)

Set up GitHub Actions to deploy automatically. This way, Azure Static Web Apps will inject the environment variables during the build.

1. **Create GitHub workflow file** (`.github/workflows/azure-static-web-apps.yml`):

```yaml
name: Azure Static Web Apps CI/CD

on:
  push:
    branches:
      - main
  pull_request:
    types: [opened, synchronize, reopened, closed]
    branches:
      - main

jobs:
  build_and_deploy_job:
    if: github.event_name == 'push' || (github.event_name == 'pull_request' && github.event.action != 'closed')
    runs-on: ubuntu-latest
    name: Build and Deploy Job
    steps:
      - uses: actions/checkout@v3
        with:
          submodules: true

      - name: Build And Deploy
        id: builddeploy
        uses: Azure/static-web-apps-deploy@v1
        with:
          azure_static_web_apps_api_token: ${{ secrets.AZURE_STATIC_WEB_APPS_API_TOKEN }}
          repo_token: ${{ secrets.GITHUB_TOKEN }}
          action: "upload"
          app_location: "/frontend"
          api_location: ""
          output_location: "out"
        env:
          NEXT_PUBLIC_ENVIRONMENT: production
          NEXT_PUBLIC_API_URL: https://func-qrattendance-dev.azurewebsites.net/api
          NEXT_PUBLIC_FRONTEND_URL: https://red-grass-0f8bc910f.4.azurestaticapps.net

  close_pull_request_job:
    if: github.event_name == 'pull_request' && github.event.action == 'closed'
    runs-on: ubuntu-latest
    name: Close Pull Request Job
    steps:
      - name: Close Pull Request
        id: closepullrequest
        uses: Azure/static-web-apps-deploy@v1
        with:
          azure_static_web_apps_api_token: ${{ secrets.AZURE_STATIC_WEB_APPS_API_TOKEN }}
          action: "close"
```

2. **Add GitHub secret**:
```bash
# Get the deployment token
az staticwebapp secrets list \
  --name swa-qrattendance-dev2 \
  --resource-group rg-qr-attendance-dev \
  --query "properties.apiKey" -o tsv

# Add to GitHub: Settings > Secrets > Actions > New repository secret
# Name: AZURE_STATIC_WEB_APPS_API_TOKEN
# Value: <paste the token>
```

3. **Push to GitHub**:
```bash
git add .
git commit -m "Add GitHub Actions workflow"
git push origin main
```

### Option 2: Build with Environment Variables Locally

Build locally with the environment variables set:

```bash
cd frontend

# Set environment variables for the build
export NEXT_PUBLIC_ENVIRONMENT=production
export NEXT_PUBLIC_API_URL=https://func-qrattendance-dev.azurewebsites.net/api
export NEXT_PUBLIC_FRONTEND_URL=https://red-grass-0f8bc910f.4.azurestaticapps.net

# Build
npm run build

# Deploy
DEPLOYMENT_TOKEN=$(az staticwebapp secrets list \
  --name swa-qrattendance-dev2 \
  --resource-group rg-qr-attendance-dev \
  --query 'properties.apiKey' -o tsv)

swa deploy ./out --deployment-token "$DEPLOYMENT_TOKEN" --env production
```

### Option 3: Use .env.production File

Create a `.env.production` file that Next.js will automatically use during production builds:

```bash
# frontend/.env.production
NEXT_PUBLIC_ENVIRONMENT=production
NEXT_PUBLIC_API_URL=https://func-qrattendance-dev.azurewebsites.net/api
NEXT_PUBLIC_FRONTEND_URL=https://red-grass-0f8bc910f.4.azurestaticapps.net
```

Then rebuild and redeploy:
```bash
cd frontend
npm run build
swa deploy ./out --deployment-token <token> --env production
```

## Verification

After redeploying, check the browser console:

```javascript
// In browser console
console.log(process.env.NEXT_PUBLIC_ENVIRONMENT)
// Should output: "production"
```

Or check the built JavaScript files:
```bash
# Search for the environment variable in the build
grep -r "NEXT_PUBLIC_ENVIRONMENT" frontend/out/_next/static/chunks/
```

## How /.auth/me Works

In production, Azure Static Web Apps provides the `/.auth/me` endpoint:

**Request:**
```javascript
fetch('/.auth/me')
```

**Response (authenticated):**
```json
{
  "clientPrincipal": {
    "identityProvider": "aad",
    "userId": "abc123...",
    "userDetails": "user@domain.com",
    "userRoles": ["authenticated", "teacher"]
  }
}
```

**Response (not authenticated):**
```json
{
  "clientPrincipal": null
}
```

## Current Code Logic

```typescript
// frontend/src/pages/index.tsx
useEffect(() => {
  const isLocal = process.env.NEXT_PUBLIC_ENVIRONMENT === 'local';
  const authEndpoint = isLocal ? '/api/auth/me' : '/.auth/me';
  
  fetch(authEndpoint)
    .then(res => res.json())
    .then(data => {
      if (data.clientPrincipal) {
        setUser(data.clientPrincipal);
      }
    });
}, []);
```

This code is correct, but `process.env.NEXT_PUBLIC_ENVIRONMENT` is `undefined` in the built bundle because it wasn't set during build time.

## Recommended Solution

Use **Option 1 (GitHub Actions)** for the best experience:
- Automatic deployments on push
- Environment variables injected during build
- Preview deployments for pull requests
- No manual deployment steps

## Quick Fix (Option 2)

For immediate fix, run:

```bash
cd frontend
export NEXT_PUBLIC_ENVIRONMENT=production
export NEXT_PUBLIC_API_URL=https://func-qrattendance-dev.azurewebsites.net/api
npm run build
swa deploy ./out --deployment-token $(az staticwebapp secrets list --name swa-qrattendance-dev2 --resource-group rg-qr-attendance-dev --query 'properties.apiKey' -o tsv) --env production
```

This will rebuild with the correct environment variables and redeploy.
