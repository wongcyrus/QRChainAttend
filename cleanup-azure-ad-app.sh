#!/bin/bash
# Delete Azure AD App Registration

set -e

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}=========================================="
echo "Azure AD App Registration Cleanup"
echo -e "==========================================${NC}"
echo ""

# Option 1: Delete by Client ID
if [ -n "$1" ]; then
    APP_ID="$1"
    echo "Using provided Client ID: $APP_ID"
else
    # Option 2: Search by name
    APP_NAME="QR Chain Attendance"
    echo -e "${BLUE}Searching for app: $APP_NAME${NC}"
    
    APPS=$(az ad app list --display-name "$APP_NAME" --query "[].{Name:displayName, AppId:appId}" -o table)
    
    if [ -z "$APPS" ] || [ "$APPS" = "[]" ]; then
        echo -e "${YELLOW}No apps found with name: $APP_NAME${NC}"
        echo ""
        echo "To delete a specific app, run:"
        echo "  $0 <client-id>"
        exit 0
    fi
    
    echo ""
    echo "Found apps:"
    echo "$APPS"
    echo ""
    
    read -p "Enter Client ID to delete (or press Enter to cancel): " APP_ID
    
    if [ -z "$APP_ID" ]; then
        echo -e "${YELLOW}Cleanup cancelled${NC}"
        exit 0
    fi
fi

# Get app details
echo -e "${BLUE}Fetching app details...${NC}"
APP_NAME=$(az ad app show --id "$APP_ID" --query displayName -o tsv 2>/dev/null || echo "")

if [ -z "$APP_NAME" ]; then
    echo -e "${RED}✗ App not found: $APP_ID${NC}"
    exit 1
fi

echo "App Name: $APP_NAME"
echo "Client ID: $APP_ID"
echo ""

# Confirm deletion
echo -e "${YELLOW}⚠ WARNING: This will permanently delete the Azure AD app registration!${NC}"
read -p "Are you sure? (yes/no): " CONFIRM

if [ "$CONFIRM" != "yes" ]; then
    echo -e "${YELLOW}Cleanup cancelled${NC}"
    exit 0
fi

# Delete the app
echo -e "${BLUE}Deleting app registration...${NC}"
az ad app delete --id "$APP_ID"

echo -e "${GREEN}✓ App deleted: $APP_ID${NC}"
echo ""

# Clean up credentials file
if [ -f ".azure-ad-credentials" ]; then
    if grep -q "$APP_ID" .azure-ad-credentials; then
        rm .azure-ad-credentials
        echo -e "${GREEN}✓ Removed .azure-ad-credentials${NC}"
    fi
fi

echo -e "${GREEN}Cleanup complete!${NC}"
echo ""
