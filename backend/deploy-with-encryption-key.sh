#!/bin/bash

# Deploy backend functions to production with QR_ENCRYPTION_KEY

set -e

FUNCTION_APP_NAME="func-qrattendance-dev"
RESOURCE_GROUP="rg-qr-attendance-dev"

echo "=== Deploying Backend Functions to Production ==="
echo "Target: $FUNCTION_APP_NAME"
echo ""

# Count functions
FUNCTION_COUNT=$(ls -1 src/functions/*.ts 2>/dev/null | wc -l)
echo "Functions to deploy: $FUNCTION_COUNT"

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
CURRENT_KEY=$(az functionapp config appsettings list \
  --name "$FUNCTION_APP_NAME" \
  --resource-group "$RESOURCE_GROUP" \
  --query "[?name=='QR_ENCRYPTION_KEY'].value" -o tsv 2>/dev/null || echo "")

if [ -z "$CURRENT_KEY" ]; then
  echo "QR_ENCRYPTION_KEY not found. Generating new key..."
  
  # Generate a secure random key
  NEW_KEY=$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")
  
  echo "Setting QR_ENCRYPTION_KEY..."
  az functionapp config appsettings set \
    --name "$FUNCTION_APP_NAME" \
    --resource-group "$RESOURCE_GROUP" \
    --settings QR_ENCRYPTION_KEY="$NEW_KEY" \
    --output none
  
  echo "✓ QR_ENCRYPTION_KEY set successfully"
else
  echo "✓ QR_ENCRYPTION_KEY already exists"
fi

# Deploy to production
echo ""
echo "Deploying to $FUNCTION_APP_NAME..."
func azure functionapp publish "$FUNCTION_APP_NAME"

echo ""
echo "=== Deployment Complete ==="
echo ""
echo "Deployed functions:"
func azure functionapp list-functions "$FUNCTION_APP_NAME" --show-keys false
echo ""
echo "Function App URL: https://$FUNCTION_APP_NAME.azurewebsites.net"
echo ""
