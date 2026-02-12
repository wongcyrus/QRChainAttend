#!/bin/bash
# Add redirect URI to existing Azure AD app

set -e

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}=========================================="
echo "Add Redirect URI to Azure AD App"
echo -e "==========================================${NC}"
echo ""

# Get Client ID
if [ -n "$1" ]; then
    APP_ID="$1"
else
    if [ -f ".azure-ad-credentials" ]; then
        source .azure-ad-credentials
        APP_ID="$AAD_CLIENT_ID"
    fi
fi

if [ -z "$APP_ID" ]; then
    echo -e "${RED}Usage: $0 <client-id> [redirect-uri]${NC}"
    echo ""
    echo "Or source .azure-ad-credentials first:"
    echo "  source .azure-ad-credentials"
    echo "  $0"
    exit 1
fi

# Get new redirect URI
if [ -n "$2" ]; then
    NEW_URI="$2"
else
    echo "Enter new redirect URI (e.g., https://my-dev-app.azurestaticapps.net/.auth/login/aad/callback):"
    read -r NEW_URI
fi

if [ -z "$NEW_URI" ]; then
    echo -e "${RED}No redirect URI provided${NC}"
    exit 1
fi

# Get current redirect URIs
echo -e "${BLUE}Current redirect URIs:${NC}"
CURRENT_URIS=$(az ad app show --id "$APP_ID" --query "web.redirectUris" -o json)
echo "$CURRENT_URIS" | jq -r '.[]' | sed 's/^/  - /'
echo ""

# Check if URI already exists
if echo "$CURRENT_URIS" | jq -e --arg uri "$NEW_URI" 'index($uri)' > /dev/null; then
    echo -e "${YELLOW}⚠ URI already exists: $NEW_URI${NC}"
    exit 0
fi

# Add new URI
echo -e "${BLUE}Adding new redirect URI...${NC}"
ALL_URIS=$(echo "$CURRENT_URIS" | jq -r --arg uri "$NEW_URI" '. + [$uri] | .[]' | tr '\n' ' ')

az ad app update \
    --id "$APP_ID" \
    --web-redirect-uris $ALL_URIS

echo -e "${GREEN}✓ Redirect URI added${NC}"
echo ""

# Show updated list
echo -e "${BLUE}Updated redirect URIs:${NC}"
az ad app show --id "$APP_ID" --query "web.redirectUris" -o json | jq -r '.[]' | sed 's/^/  - /'
echo ""

echo -e "${GREEN}Done!${NC}"
echo ""
echo "The same Azure AD app can now be used with:"
echo "  - Production"
echo "  - Development"
echo "  - Local testing"
echo ""
