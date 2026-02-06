#!/bin/bash

# Set QR_ENCRYPTION_KEY for Azure Function App

set -e

# Default values
FUNCTION_APP_NAME="func-qrattendance-dev"
RESOURCE_GROUP="rg-qr-attendance-dev"
FORCE_REGENERATE=false

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

# Usage
usage() {
    echo "Usage: $0 [options]"
    echo ""
    echo "Options:"
    echo "  -f, --function-app    Function App name (default: func-qrattendance-dev)"
    echo "  -g, --resource-group  Resource Group name (default: rg-qr-attendance-dev)"
    echo "  -r, --regenerate      Force regenerate key even if exists"
    echo "  -h, --help            Show this help message"
    echo ""
    echo "Example:"
    echo "  $0"
    echo "  $0 -f func-qrattendance-prod -g rg-qrattendance-prod"
    echo "  $0 --regenerate"
    exit 1
}

# Parse arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        -f|--function-app)
            FUNCTION_APP_NAME="$2"
            shift 2
            ;;
        -g|--resource-group)
            RESOURCE_GROUP="$2"
            shift 2
            ;;
        -r|--regenerate)
            FORCE_REGENERATE=true
            shift
            ;;
        -h|--help)
            usage
            ;;
        *)
            echo -e "${RED}Unknown option: $1${NC}"
            usage
            ;;
    esac
done

echo -e "${GREEN}=== Setting QR_ENCRYPTION_KEY ===${NC}"
echo ""
echo "Function App: $FUNCTION_APP_NAME"
echo "Resource Group: $RESOURCE_GROUP"
echo ""

# Check if Azure CLI is installed
if ! command -v az &> /dev/null; then
    echo -e "${RED}Error: Azure CLI is not installed${NC}"
    exit 1
fi

# Check if logged in
if ! az account show &> /dev/null; then
    echo -e "${RED}Error: Not logged in to Azure${NC}"
    echo "Please run 'az login' first"
    exit 1
fi

# Check if Node.js is installed (for key generation)
if ! command -v node &> /dev/null; then
    echo -e "${RED}Error: Node.js is not installed${NC}"
    exit 1
fi

# Check current key
echo "Checking current QR_ENCRYPTION_KEY..."
CURRENT_KEY=$(az functionapp config appsettings list \
  --name "$FUNCTION_APP_NAME" \
  --resource-group "$RESOURCE_GROUP" \
  --query "[?name=='QR_ENCRYPTION_KEY'].value" -o tsv 2>/dev/null || echo "")

if [ -n "$CURRENT_KEY" ] && [ "$FORCE_REGENERATE" = false ]; then
  echo -e "${GREEN}✓ QR_ENCRYPTION_KEY already exists${NC}"
  echo ""
  echo "Key (first 16 chars): ${CURRENT_KEY:0:16}..."
  echo ""
  echo "To regenerate the key, run with --regenerate flag"
  echo "WARNING: Regenerating will invalidate all existing QR codes!"
  exit 0
fi

if [ "$FORCE_REGENERATE" = true ]; then
  echo -e "${YELLOW}Regenerating QR_ENCRYPTION_KEY...${NC}"
else
  echo "QR_ENCRYPTION_KEY not found. Generating new key..."
fi

# Generate a secure random key (32 bytes = 64 hex chars)
NEW_KEY=$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")

echo ""
echo "Generated key (first 16 chars): ${NEW_KEY:0:16}..."
echo ""

# Set the key
echo "Setting QR_ENCRYPTION_KEY in Azure..."
az functionapp config appsettings set \
  --name "$FUNCTION_APP_NAME" \
  --resource-group "$RESOURCE_GROUP" \
  --settings QR_ENCRYPTION_KEY="$NEW_KEY" \
  --output none

echo ""
echo -e "${GREEN}✓ QR_ENCRYPTION_KEY set successfully${NC}"
echo ""
echo "The key has been set in Azure Function App settings."
echo "It will be used for encrypting/decrypting QR code tokens."
echo ""

if [ "$FORCE_REGENERATE" = true ]; then
  echo -e "${YELLOW}WARNING: All existing QR codes are now invalid!${NC}"
  echo "Teachers will need to generate new QR codes."
  echo ""
fi
