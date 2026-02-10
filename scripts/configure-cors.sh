#!/bin/bash

# Configure CORS for Azure Function App
# This script sets up CORS to allow credentials from specific origins

set -e

FUNCTION_APP="func-qrattendance-dev"
RESOURCE_GROUP="rg-qr-attendance-dev"
STATIC_WEB_APP_URL="https://red-grass-0f8bc910f.4.azurestaticapps.net"

echo "🔧 Configuring CORS for Function App"
echo "======================================"
echo ""

# Remove wildcard if it exists
echo "Removing wildcard origin..."
az functionapp cors remove \
  --name "$FUNCTION_APP" \
  --resource-group "$RESOURCE_GROUP" \
  --allowed-origins "*" \
  --output none 2>/dev/null || true

echo "✅ Wildcard removed"

# Add specific origins
echo ""
echo "Adding allowed origins..."
az functionapp cors add \
  --name "$FUNCTION_APP" \
  --resource-group "$RESOURCE_GROUP" \
  --allowed-origins \
    "$STATIC_WEB_APP_URL" \
    "http://localhost:3000" \
    "http://localhost:3001" \
    "http://localhost:3002" \
  --output none

echo "✅ Origins added"

# Enable credentials support
echo ""
echo "Enabling credentials support..."
az functionapp cors credentials \
  --name "$FUNCTION_APP" \
  --resource-group "$RESOURCE_GROUP" \
  --enable true \
  --output none

echo "✅ Credentials enabled"

# Show final configuration
echo ""
echo "📋 Final CORS Configuration:"
az functionapp cors show \
  --name "$FUNCTION_APP" \
  --resource-group "$RESOURCE_GROUP"

echo ""
echo "✅ CORS configuration complete!"
echo ""
echo "Allowed Origins:"
echo "  - $STATIC_WEB_APP_URL (production)"
echo "  - http://localhost:3000 (local dev)"
echo "  - http://localhost:3001 (local dev)"
echo "  - http://localhost:3002 (local dev)"
echo ""
echo "Credentials: Enabled"
echo ""
