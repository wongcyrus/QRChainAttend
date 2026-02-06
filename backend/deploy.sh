#!/bin/bash

# Deploy backend functions to production

set -e

FUNCTION_APP_NAME="func-qrattendance-dev"
RESOURCE_GROUP="rg-qr-attendance-dev"

echo "=== Deploying Backend Functions to Production ==="
echo "Target: $FUNCTION_APP_NAME"
echo ""

# Count functions
FUNCTION_COUNT=$(ls -1 src/functions/*.ts 2>/dev/null | wc -l)
echo "Functions to deploy: $FUNCTION_COUNT"
ls -la src/functions/

# Clean build
echo ""
echo "Cleaning and building..."
rm -rf dist
npm run build

# Check compiled output
COMPILED_COUNT=$(ls -1 dist/src/functions/*.js 2>/dev/null | wc -l)
echo ""
echo "Compiled functions: $COMPILED_COUNT"

# Check if QR_ENCRYPTION_KEY is set
echo ""
echo "Checking QR_ENCRYPTION_KEY..."
if command -v az &> /dev/null && az account show &> /dev/null; then
  CURRENT_KEY=$(az functionapp config appsettings list \
    --name "$FUNCTION_APP_NAME" \
    --resource-group "$RESOURCE_GROUP" \
    --query "[?name=='QR_ENCRYPTION_KEY'].value" -o tsv 2>/dev/null || echo "")
  
  if [ -z "$CURRENT_KEY" ]; then
    echo "⚠️  WARNING: QR_ENCRYPTION_KEY not set!"
    echo "Run: ../scripts/set-encryption-key.sh"
    echo ""
    read -p "Continue deployment anyway? (y/N) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
      echo "Deployment cancelled."
      exit 1
    fi
  else
    echo "✓ QR_ENCRYPTION_KEY is set"
  fi
else
  echo "⚠️  Cannot verify QR_ENCRYPTION_KEY (Azure CLI not available)"
fi

# Deploy to production
echo ""
echo "Deploying to $FUNCTION_APP_NAME..."
func azure functionapp publish "$FUNCTION_APP_NAME"

echo ""
echo "=== Deployment Complete ==="
echo "Check Azure portal or run: func azure functionapp list-functions $FUNCTION_APP_NAME"
echo ""
