#!/bin/bash

# ============================================================================
# Deploy Frontend Only
# ============================================================================
# Deploys only the frontend to Azure Static Web Apps
# Useful for quick frontend updates without backend changes
# ============================================================================

set -e

# Hardcoded values
STATIC_WEB_APP_NAME="swa-qrattendance-dev2"
RESOURCE_GROUP="rg-qr-attendance-dev"

# Static Web App Deployment Token
# Fetch automatically from Azure (no need to set environment variable)
echo "🔑 Fetching SWA deployment token from Azure..."
SWA_DEPLOYMENT_TOKEN=$(az staticwebapp secrets list \
    --name "$STATIC_WEB_APP_NAME" \
    --resource-group "$RESOURCE_GROUP" \
    --query 'properties.apiKey' \
    --output tsv)

if [ -z "$SWA_DEPLOYMENT_TOKEN" ]; then
    echo "❌ Error: Failed to fetch SWA deployment token"
    echo "Make sure you're logged in: az login"
    exit 1
fi
echo "✅ Token fetched successfully"
STATIC_WEB_APP_URL="https://red-grass-0f8bc910f.4.azurestaticapps.net"

echo "🚀 Deploying Frontend Only"
echo "=========================="
echo ""

cd frontend

# Backup .env.local if it exists (prevents local environment detection in production)
if [ -f ".env.local" ]; then
    echo "⚠️  Backing up .env.local for production build"
    mv .env.local .env.local.backup
fi

# Build frontend for production
echo ""
echo "📦 Building frontend for production..."
NODE_ENV=production npm run build

if [ $? -ne 0 ]; then
    echo "❌ Frontend build failed"
    
    # Restore .env.local
    if [ -f ".env.local.backup" ]; then
        mv .env.local.backup .env.local
    fi
    
    exit 1
fi

echo "✅ Frontend built successfully"

# Restore .env.local
if [ -f ".env.local.backup" ]; then
    mv .env.local.backup .env.local
    echo "✅ Restored .env.local"
fi

# Deploy to Static Web App
echo ""
echo "☁️  Deploying to Azure Static Web Apps..."
swa deploy ./out \
    --deployment-token "$SWA_DEPLOYMENT_TOKEN" \
    --env production

if [ $? -ne 0 ]; then
    echo "❌ Frontend deployment failed"
    exit 1
fi

echo ""
echo "✅ Frontend Deployed Successfully!"
echo "🌐 $STATIC_WEB_APP_URL"
echo ""

# Check Static Web App status
echo "🔍 Checking deployment status..."
SWA_STATUS=$(az staticwebapp show \
    --name "$STATIC_WEB_APP_NAME" \
    --resource-group "$RESOURCE_GROUP" \
    --query "status" -o tsv 2>/dev/null || echo "Unknown")

if [ "$SWA_STATUS" = "Ready" ]; then
    echo "✅ Static Web App is ready"
else
    echo "⚠️  Static Web App status: $SWA_STATUS"
fi

echo ""
echo "📝 Deployment Summary:"
echo "   URL: $STATIC_WEB_APP_URL"
echo "   Status: $SWA_STATUS"
echo "   Time: $(date)"
echo ""

cd ..
