#!/bin/bash
# Configure Production Environment Variables for Static Web App

set -e

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

# Configuration
RESOURCE_GROUP="rg-qr-attendance-dev"
STATIC_WEB_APP_NAME="swa-qrattendance-dev2"
FUNCTION_APP_NAME="func-qrattendance-dev"

echo -e "${CYAN}========================================${NC}"
echo -e "${CYAN}Configure Production Environment${NC}"
echo -e "${CYAN}========================================${NC}"
echo ""

# Check if logged in
if ! az account show &> /dev/null; then
    echo -e "${RED}Error: Not logged in to Azure${NC}"
    echo "Please run 'az login' first"
    exit 1
fi

echo -e "${YELLOW}Getting Function App URL...${NC}"
FUNCTION_APP_URL=$(az functionapp show \
    --name "$FUNCTION_APP_NAME" \
    --resource-group "$RESOURCE_GROUP" \
    --query "defaultHostName" -o tsv)

echo -e "${GREEN}✓ Function App URL: https://$FUNCTION_APP_URL${NC}"
echo ""

echo -e "${YELLOW}Configuring Static Web App settings...${NC}"

# Set environment variables for production
az staticwebapp appsettings set \
    --name "$STATIC_WEB_APP_NAME" \
    --resource-group "$RESOURCE_GROUP" \
    --setting-names \
        NEXT_PUBLIC_API_URL="https://$FUNCTION_APP_URL/api" \
        NEXT_PUBLIC_ENVIRONMENT="production" \
        NEXT_PUBLIC_FRONTEND_URL="https://red-grass-0f8bc910f.4.azurestaticapps.net"

echo -e "${GREEN}✓ Environment variables configured${NC}"
echo ""

echo -e "${CYAN}Current Settings:${NC}"
az staticwebapp appsettings list \
    --name "$STATIC_WEB_APP_NAME" \
    --resource-group "$RESOURCE_GROUP" \
    --query "properties" -o json

echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}✓ Configuration Complete!${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo -e "${YELLOW}Next Steps:${NC}"
echo -e "1. Redeploy the frontend to apply the new settings"
echo -e "2. Test the login flow at: https://red-grass-0f8bc910f.4.azurestaticapps.net"
echo ""
echo -e "${CYAN}To redeploy frontend:${NC}"
echo -e "  cd frontend"
echo -e "  npm run build"
echo -e "  swa deploy ./out --deployment-token \$(az staticwebapp secrets list --name $STATIC_WEB_APP_NAME --resource-group $RESOURCE_GROUP --query 'properties.apiKey' -o tsv) --env production"
echo ""
