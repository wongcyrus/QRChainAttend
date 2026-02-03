#!/bin/bash

# Manual deployment script for Azure Static Web Apps
# This deploys the frontend directly without CI/CD

set -e

echo "🚀 Manual Deployment Script for QR Chain Attendance"
echo "=================================================="
echo ""

# Check if build exists
if [ ! -d "frontend/out" ]; then
    echo "❌ Build not found. Running build first..."
    npm run build --workspace=frontend
    echo "✅ Build complete"
    echo ""
fi

# Check for deployment token
if [ -z "$AZURE_STATIC_WEB_APPS_API_TOKEN" ]; then
    echo "⚠️  AZURE_STATIC_WEB_APPS_API_TOKEN not set"
    echo ""
    echo "To get your deployment token:"
    echo "1. Go to Azure Portal"
    echo "2. Navigate to your Static Web App"
    echo "3. Settings → Configuration → Deployment token"
    echo "4. Copy the token"
    echo ""
    echo "Then run:"
    echo "  export AZURE_STATIC_WEB_APPS_API_TOKEN='your-token-here'"
    echo "  ./manual-deploy.sh"
    echo ""
    exit 1
fi

echo "📦 Deploying frontend to Azure Static Web Apps..."
echo ""

# Deploy using SWA CLI
cd frontend
swa deploy ./out \
    --deployment-token "$AZURE_STATIC_WEB_APPS_API_TOKEN" \
    --env production

echo ""
echo "✅ Deployment complete!"
echo ""
echo "🧪 Test your deployment:"
echo "1. Visit your site"
echo "2. Try login/logout"
echo "3. Verify no hard refresh needed"
echo ""
