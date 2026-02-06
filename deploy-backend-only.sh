#!/bin/bash

# ============================================================================
# Deploy Backend Only
# ============================================================================

set -e

FUNCTION_APP="func-qrattendance-dev"
RESOURCE_GROUP="rg-qr-attendance-dev"

echo "🚀 Deploying Backend Only"
echo "=========================="
echo ""

cd backend

# Check encryption key
echo "🔑 Checking QR_ENCRYPTION_KEY..."
KEY=$(az functionapp config appsettings list \
  --name "$FUNCTION_APP" \
  --resource-group "$RESOURCE_GROUP" \
  --query "[?name=='QR_ENCRYPTION_KEY'].value" -o tsv 2>/dev/null || echo "")

if [ -z "$KEY" ]; then
    echo "⚠️  Setting QR_ENCRYPTION_KEY..."
    NEW_KEY=$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")
    az functionapp config appsettings set \
      --name "$FUNCTION_APP" \
      --resource-group "$RESOURCE_GROUP" \
      --settings QR_ENCRYPTION_KEY="$NEW_KEY" \
      --output none
    echo "✅ Key set"
else
    echo "✅ Key exists"
fi

# Build
echo ""
echo "📦 Building..."
npm run build

if [ $? -ne 0 ]; then
    echo "❌ Build failed"
    exit 1
fi

COMPILED=$(ls -1 dist/src/functions/*.js 2>/dev/null | wc -l)
echo "✅ Compiled $COMPILED functions"

# Deploy
echo ""
echo "☁️  Deploying to Azure..."
func azure functionapp publish "$FUNCTION_APP" --force

if [ $? -ne 0 ]; then
    echo "❌ Deployment failed"
    exit 1
fi

echo ""
echo "✅ Backend Deployed Successfully!"
echo "🌐 https://func-qrattendance-dev.azurewebsites.net"
echo ""

cd ..
