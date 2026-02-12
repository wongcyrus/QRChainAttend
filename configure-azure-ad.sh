#!/bin/bash
# Configure Azure AD Authentication for Static Web App

set -e

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m'

RESOURCE_GROUP="rg-qr-attendance-prod"

# Try to get the Static Web App name from deployment-info.json, fallback to hardcoded name
if [ -f "deployment-info.json" ]; then
    STATIC_WEB_APP=$(jq -r '.staticWebApp // "swa-qrattendance-prod2"' deployment-info.json)
else
    STATIC_WEB_APP="swa-qrattendance-prod2"
fi

echo -e "${BLUE}=========================================="
echo "Azure AD Configuration for Static Web App"
echo -e "==========================================${NC}"
echo ""

# Check arguments
if [ -z "$1" ] || [ -z "$2" ]; then
    echo -e "${YELLOW}Usage: $0 <AAD_CLIENT_ID> <AAD_CLIENT_SECRET>${NC}"
    echo ""
    echo "To get these values:"
    echo "  1. Go to Azure Portal"
    echo "  2. Navigate to Azure Active Directory > App registrations"
    echo "  3. Find or create your app registration"
    echo "  4. Copy the 'Application (client) ID'"
    echo "  5. Go to 'Certificates & secrets'"
    echo "  6. Create a new client secret and copy the value"
    echo ""
    echo "Then run:"
    echo "  $0 <client-id> <client-secret>"
    echo ""
    exit 1
fi

AAD_CLIENT_ID="$1"
AAD_CLIENT_SECRET="$2"

# Get Tenant ID from Azure CLI
TENANT_ID=$(az account show --query tenantId -o tsv 2>/dev/null)

if [ -z "$TENANT_ID" ]; then
    echo -e "${RED}✗ Failed to get Tenant ID. Please login to Azure CLI${NC}"
    exit 1
fi

echo -e "${BLUE}Configuring Azure AD settings...${NC}"
echo "  Client ID: $AAD_CLIENT_ID"
echo "  Tenant ID: $TENANT_ID"
echo "  Static Web App: $STATIC_WEB_APP"
echo ""

# Configure Static Web App settings
az staticwebapp appsettings set \
    --name $STATIC_WEB_APP \
    --resource-group $RESOURCE_GROUP \
    --setting-names \
        AAD_CLIENT_ID="$AAD_CLIENT_ID" \
        AAD_CLIENT_SECRET="$AAD_CLIENT_SECRET" \
        TENANT_ID="$TENANT_ID" \
    --output none

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ Azure AD configuration complete${NC}"
    echo ""
    echo "Next steps:"
    echo "  1. Wait 2-3 minutes for settings to propagate"
    echo "  2. Visit: https://ashy-desert-0fc9a700f.6.azurestaticapps.net"
    echo "  3. You should be redirected to Azure AD login"
    echo ""
else
    echo -e "${RED}✗ Failed to configure Azure AD${NC}"
    exit 1
fi

# Verify configuration
echo -e "${BLUE}Verifying configuration...${NC}"
SETTINGS=$(az staticwebapp appsettings list \
    --name $STATIC_WEB_APP \
    --resource-group $RESOURCE_GROUP \
    --query "properties" \
    -o json)

echo "$SETTINGS" | jq '{AAD_CLIENT_ID, TENANT_ID}'

if echo "$SETTINGS" | jq -e '.AAD_CLIENT_SECRET' > /dev/null; then
    echo -e "${GREEN}✓ AAD_CLIENT_SECRET is set${NC}"
else
    echo -e "${RED}✗ AAD_CLIENT_SECRET is not set${NC}"
fi

echo ""
echo -e "${GREEN}Configuration complete!${NC}"
