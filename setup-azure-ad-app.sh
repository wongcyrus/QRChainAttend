#!/bin/bash
# Create or update Azure AD App Registration for QR Chain Attendance

set -e

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m'

APP_NAME="QR Chain Attendance"

# Redirect URIs for all environments
REDIRECT_URIS=(
    "https://ashy-desert-0fc9a700f.6.azurestaticapps.net/.auth/login/aad/callback"  # Production
    "http://localhost:3000/.auth/login/aad/callback"  # Local dev
    "http://localhost:4280/.auth/login/aad/callback"  # SWA CLI
)

echo -e "${BLUE}=========================================="
echo "Azure AD App Registration Setup"
echo -e "==========================================${NC}"
echo ""

# Get Tenant ID
TENANT_ID=$(az account show --query tenantId -o tsv)
echo "Tenant ID: $TENANT_ID"
echo ""

# Check if app already exists
echo -e "${BLUE}Checking for existing app registration...${NC}"
EXISTING_APP=$(az ad app list --display-name "$APP_NAME" --query "[0].appId" -o tsv 2>/dev/null || echo "")

if [ -n "$EXISTING_APP" ]; then
    echo -e "${YELLOW}Found existing app: $EXISTING_APP${NC}"
    read -p "Do you want to reuse this app? (yes/no): " REUSE
    
    if [ "$REUSE" = "yes" ]; then
        APP_ID="$EXISTING_APP"
        echo -e "${GREEN}✓ Reusing existing app${NC}"
    else
        echo -e "${YELLOW}Creating new app (old one will remain)${NC}"
        EXISTING_APP=""
    fi
fi

# Create new app if needed
if [ -z "$EXISTING_APP" ]; then
    echo -e "${BLUE}Creating new Azure AD app registration...${NC}"
    
    # Create the app with all redirect URIs
    APP_ID=$(az ad app create \
        --display-name "$APP_NAME" \
        --sign-in-audience AzureADMyOrg \
        --web-redirect-uris "${REDIRECT_URIS[@]}" \
        --enable-id-token-issuance true \
        --query appId -o tsv)
    
    echo -e "${GREEN}✓ App created: $APP_ID${NC}"
else
    # Update redirect URIs for existing app
    echo -e "${BLUE}Updating redirect URIs...${NC}"
    az ad app update \
        --id "$APP_ID" \
        --web-redirect-uris "${REDIRECT_URIS[@]}" \
        --enable-id-token-issuance true
    
    echo -e "${GREEN}✓ App updated${NC}"
fi

echo ""
echo -e "${BLUE}Configured redirect URIs:${NC}"
for uri in "${REDIRECT_URIS[@]}"; do
    echo "  - $uri"
done
echo ""

# Create client secret
echo -e "${BLUE}Creating client secret...${NC}"
SECRET_NAME="StaticWebApp-$(date +%Y%m%d)"
CLIENT_SECRET=$(az ad app credential reset \
    --id "$APP_ID" \
    --append \
    --display-name "$SECRET_NAME" \
    --years 2 \
    --query password -o tsv)

echo -e "${GREEN}✓ Client secret created${NC}"
echo ""

# Configure API permissions (optional - for reading user profile)
echo -e "${BLUE}Configuring API permissions...${NC}"
az ad app permission add \
    --id "$APP_ID" \
    --api 00000003-0000-0000-c000-000000000000 \
    --api-permissions e1fe6dd8-ba31-4d61-89e7-88639da4683d=Scope \
    2>/dev/null || echo -e "${YELLOW}⚠ Permissions already configured${NC}"

echo -e "${GREEN}✓ API permissions configured${NC}"
echo ""

# Save credentials to file
cat > .azure-ad-credentials << EOF
# Azure AD App Registration Credentials
# Created: $(date)
# DO NOT COMMIT THIS FILE TO GIT!

export AAD_CLIENT_ID="$APP_ID"
export AAD_CLIENT_SECRET="$CLIENT_SECRET"
export AAD_TENANT_ID="$TENANT_ID"
EOF

chmod 600 .azure-ad-credentials

echo -e "${GREEN}=========================================="
echo "Azure AD App Registration Complete!"
echo -e "==========================================${NC}"
echo ""
echo -e "${BLUE}Credentials:${NC}"
echo "  App Name:      $APP_NAME"
echo "  Client ID:     $APP_ID"
echo "  Tenant ID:     $TENANT_ID"
echo "  Client Secret: ${CLIENT_SECRET:0:10}... (saved to .azure-ad-credentials)"
echo ""
echo -e "${BLUE}Redirect URIs (works for all environments):${NC}"
for uri in "${REDIRECT_URIS[@]}"; do
    echo "  - $uri"
done
echo ""
echo -e "${YELLOW}⚠ IMPORTANT: Credentials saved to .azure-ad-credentials${NC}"
echo "  This file is in .gitignore and should NOT be committed"
echo ""
echo -e "${BLUE}Next steps:${NC}"
echo "  1. Deploy infrastructure:"
echo "     source .azure-ad-credentials"
echo "     ./deploy-full-production.sh"
echo ""
echo "  2. Or configure existing deployment:"
echo "     source .azure-ad-credentials"
echo "     ./configure-azure-ad.sh \$AAD_CLIENT_ID \$AAD_CLIENT_SECRET"
echo ""
