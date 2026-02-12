#!/bin/bash
# Clean up all production resources

set -e

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m'

RESOURCE_GROUP="rg-qr-attendance-prod"

echo -e "${BLUE}=========================================="
echo "QR Chain Attendance - Production Cleanup"
echo -e "==========================================${NC}"
echo ""

# Check if resource group exists
if ! az group exists --name $RESOURCE_GROUP --output tsv | grep -q "true"; then
    echo -e "${YELLOW}Resource group '$RESOURCE_GROUP' does not exist${NC}"
    echo "Nothing to clean up."
    exit 0
fi

# Show what will be deleted
echo -e "${YELLOW}⚠ WARNING: This will delete ALL production resources!${NC}"
echo ""
echo "Resource Group: $RESOURCE_GROUP"
echo ""
echo "Resources to be deleted:"
az resource list --resource-group $RESOURCE_GROUP --query "[].{Name:name, Type:type}" --output table
echo ""

# Confirm deletion
read -p "Are you sure you want to delete all resources? (yes/no): " CONFIRM

if [ "$CONFIRM" != "yes" ]; then
    echo -e "${YELLOW}Cleanup cancelled${NC}"
    exit 0
fi

echo ""
echo -e "${BLUE}Deleting resource group and all resources...${NC}"
echo "This may take 5-10 minutes..."

az group delete \
    --name $RESOURCE_GROUP \
    --yes \
    --no-wait

echo -e "${GREEN}✓ Deletion initiated${NC}"
echo ""
echo "The resource group and all resources are being deleted in the background."
echo "You can check the status with:"
echo "  az group show --name $RESOURCE_GROUP"
echo ""
echo "Or wait for completion with:"
echo "  az group wait --name $RESOURCE_GROUP --deleted"
echo ""

# Clean up local files
if [ -f "deployment-output.json" ]; then
    rm deployment-output.json
    echo -e "${GREEN}✓ Removed deployment-output.json${NC}"
fi

if [ -f "deployment-info.json" ]; then
    rm deployment-info.json
    echo -e "${GREEN}✓ Removed deployment-info.json${NC}"
fi

if [ -f "frontend/.env.production" ]; then
    rm frontend/.env.production
    echo -e "${GREEN}✓ Removed frontend/.env.production${NC}"
fi

echo ""
echo -e "${GREEN}Resource cleanup complete!${NC}"
echo ""
echo "To verify deletion is complete:"
echo "  az group show --name $RESOURCE_GROUP"
echo ""
echo -e "${YELLOW}Note: Azure AD app registration is NOT deleted${NC}"
echo "To also delete the Azure AD app:"
echo "  ./cleanup-azure-ad-app.sh"
echo ""
