#!/bin/bash

# ============================================================================
# Quick Production Deployment - No Checks, Just Deploy
# ============================================================================
# Use this when you just want to deploy quickly without verification
# ============================================================================

set -e

# Configuration
FUNCTION_APP="func-qrattendance-dev"
STATIC_WEB_APP_NAME="swa-qrattendance-dev2"
RESOURCE_GROUP="rg-qr-attendance-dev"

# Static Web App Deployment Token
# Fetch automatically from Azure (no need to set environment variable)
echo "🔑 Fetching SWA deployment token from Azure..."
SWA_TOKEN=$(az staticwebapp secrets list \
    --name "$STATIC_WEB_APP_NAME" \
    --resource-group "$RESOURCE_GROUP" \
    --query 'properties.apiKey' \
    --output tsv)

if [ -z "$SWA_TOKEN" ]; then
    echo "❌ Error: Failed to fetch SWA deployment token"
    echo "Make sure you're logged in: az login"
    exit 1
fi
echo "✅ Token fetched successfully"

echo "🚀 Quick Deploy Starting..."
echo ""

# Backend
echo "📦 Building backend..."
cd backend
npm run build > /dev/null 2>&1
echo "☁️  Deploying backend..."
func azure functionapp publish "$FUNCTION_APP" > /dev/null 2>&1
echo "✅ Backend deployed"
cd ..

# Frontend
echo "📦 Building frontend..."
cd frontend
[ -f .env.local ] && mv .env.local .env.local.backup
NODE_ENV=production npm run build > /dev/null 2>&1
[ -f .env.local.backup ] && mv .env.local.backup .env.local
echo "☁️  Deploying frontend..."
swa deploy ./out --deployment-token "$SWA_TOKEN" --env production > /dev/null 2>&1
echo "✅ Frontend deployed"
cd ..

echo ""
echo "🎉 Deployment Complete!"
echo "🌐 https://red-grass-0f8bc910f.4.azurestaticapps.net"
echo ""
