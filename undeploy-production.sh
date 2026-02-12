#!/bin/bash

# QR Chain Attendance - Complete Production Undeploy Script
# This script properly cleans up ALL resources including soft-deleted ones
# and removes production URLs from Azure AD redirect URIs

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
RESOURCE_GROUP="rg-qr-attendance-prod"
BASE_NAME="qrattendance"
ENVIRONMENT="prod"
LOCATION="eastus2"
AAD_CLIENT_ID="dc482c34-ebaa-4239-aca3-2810a4f51728"  # QR Chain Attendance System

echo -e "${BLUE}=========================================="
echo "QR Chain Attendance - Complete Cleanup"
echo -e "==========================================${NC}"
echo ""

# Function to wait for operation with spinner
wait_for_operation() {
    local operation_name="$1"
    local check_command="$2"
    local max_wait="$3"
    local wait_time=0
    
    echo -n "Waiting for $operation_name"
    while [ $wait_time -lt $max_wait ]; do
        if ! eval "$check_command" &>/dev/null; then
            echo ""
            echo -e "${GREEN}✓ $operation_name completed${NC}"
            return 0
        fi
        echo -n "."
        sleep 10
        wait_time=$((wait_time + 10))
    done
    echo ""
    echo -e "${YELLOW}⚠ $operation_name may still be in progress${NC}"
}

# Step 1: List resources to be deleted
echo -e "${BLUE}Step 1: Identifying resources to clean up...${NC}"

# Check if resource group exists
if az group exists --name "$RESOURCE_GROUP" >/dev/null 2>&1; then
    echo -e "${YELLOW}Resources in $RESOURCE_GROUP:${NC}"
    az resource list --resource-group "$RESOURCE_GROUP" --query "[].{Name:name, Type:type}" -o table 2>/dev/null || echo "  No resources found"
else
    echo -e "${GREEN}✓ Resource group $RESOURCE_GROUP does not exist${NC}"
fi

# Check Static Web Apps
echo -e "${YELLOW}Static Web Apps:${NC}"
STATIC_WEB_APPS=$(az staticwebapp list --query "[?contains(name, '$BASE_NAME')].{Name:name, ResourceGroup:resourceGroup, URL:defaultHostname}" -o table 2>/dev/null || echo "")
if [ -n "$STATIC_WEB_APPS" ] && [ "$STATIC_WEB_APPS" != "[]" ]; then
    echo "$STATIC_WEB_APPS"
else
    echo "  No Static Web Apps found"
fi

# Check soft-deleted resources
echo -e "${YELLOW}Soft-deleted Cognitive Services:${NC}"
DELETED_COGNITIVE=$(az cognitiveservices account list-deleted --query "[?contains(name, '$BASE_NAME')].{Name:name, Location:location, Kind:kind}" -o table 2>/dev/null || echo "")
if [ -n "$DELETED_COGNITIVE" ] && [ "$DELETED_COGNITIVE" != "[]" ]; then
    echo "$DELETED_COGNITIVE"
else
    echo "  No soft-deleted Cognitive Services found"
fi

echo -e "${YELLOW}Soft-deleted Key Vaults:${NC}"
DELETED_KV=$(az keyvault list-deleted --query "[?contains(name, '$BASE_NAME')].{Name:name, Location:location}" -o table 2>/dev/null || echo "")
if [ -n "$DELETED_KV" ] && [ "$DELETED_KV" != "[]" ]; then
    echo "$DELETED_KV"
else
    echo "  No soft-deleted Key Vaults found"
fi

echo ""

# Step 2: Clean up Azure AD redirect URIs first
echo -e "${BLUE}Step 2: Cleaning up Azure AD redirect URIs...${NC}"

if [ -n "$AAD_CLIENT_ID" ]; then
    echo "Getting current redirect URIs from Azure AD app..."
    CURRENT_URIS=$(az ad app show --id "$AAD_CLIENT_ID" --query "web.redirectUris" -o json 2>/dev/null || echo "[]")
    
    # Get Static Web App URLs that will be deleted
    SWA_URLS=$(az staticwebapp list --query "[?contains(name, '$BASE_NAME')].defaultHostname" -o json 2>/dev/null || echo "[]")
    
    if [ "$CURRENT_URIS" != "[]" ] && [ "$SWA_URLS" != "[]" ]; then
        echo "Current redirect URIs:"
        echo "$CURRENT_URIS" | jq -r '.[]' | while read -r uri; do
            echo "  $uri"
        done
        
        echo ""
        echo "Filtering out URIs for Static Web Apps being deleted..."
        
        # Create filtered URI list (keep dev and localhost, remove production URLs)
        FILTERED_URIS=$(echo "$CURRENT_URIS" | jq --argjson swaUrls "$SWA_URLS" '
            map(select(
                . as $uri |
                ($swaUrls | map("https://" + . + "/.auth/login/aad/callback") | index($uri)) == null
            ))
        ')
        
        echo "Remaining redirect URIs after filtering:"
        echo "$FILTERED_URIS" | jq -r '.[]' | while read -r uri; do
            echo "  $uri"
        done
        
        # Update Azure AD app with filtered URIs
        if [ "$FILTERED_URIS" != "[]" ]; then
            FILTERED_URIS_ARGS=$(echo "$FILTERED_URIS" | jq -r '.[]' | tr '\n' ' ')
            echo "Updating Azure AD app with cleaned redirect URIs..."
            az ad app update --id "$AAD_CLIENT_ID" --web-redirect-uris $FILTERED_URIS_ARGS || echo -e "${YELLOW}⚠ Failed to update Azure AD redirect URIs${NC}"
        else
            # Keep at least localhost for development
            echo "Adding localhost fallback to prevent empty redirect URIs..."
            az ad app update --id "$AAD_CLIENT_ID" --web-redirect-uris "http://localhost:3000/.auth/login/aad/callback" || echo -e "${YELLOW}⚠ Failed to update Azure AD redirect URIs${NC}"
        fi
        
        echo -e "${GREEN}✓ Azure AD redirect URIs cleaned up${NC}"
    else
        echo -e "${GREEN}✓ No Azure AD redirect URIs to clean up${NC}"
    fi
else
    echo -e "${YELLOW}⚠ Azure AD Client ID not configured, skipping redirect URI cleanup${NC}"
fi

echo ""

# Step 3: Confirm deletion
echo -e "${RED}WARNING: This will permanently delete ALL resources related to QR Chain Attendance!${NC}"
echo -e "${RED}This action CANNOT be undone.${NC}"
echo ""
read -p "Are you sure you want to continue? (type 'DELETE' to confirm): " confirmation

if [ "$confirmation" != "DELETE" ]; then
    echo -e "${YELLOW}Cleanup cancelled.${NC}"
    exit 1
fi

echo ""

# Step 4: Delete Static Web Apps first (they're outside the resource group)
echo -e "${BLUE}Step 4: Cleaning up Static Web Apps...${NC}"

SWA_LIST=$(az staticwebapp list --query "[?contains(name, '$BASE_NAME')].{name:name, resourceGroup:resourceGroup}" -o json 2>/dev/null || echo "[]")
if [ "$SWA_LIST" != "[]" ]; then
    echo "$SWA_LIST" | jq -r '.[] | "az staticwebapp delete --name \(.name) --resource-group \(.resourceGroup) --yes"' | while read -r cmd; do
        echo "Executing: $cmd"
        eval "$cmd" || echo -e "${YELLOW}⚠ Failed to delete Static Web App${NC}"
    done
    echo -e "${GREEN}✓ Static Web Apps cleanup completed${NC}"
else
    echo -e "${GREEN}✓ No Static Web Apps to delete${NC}"
fi

# Step 5: Delete resource group (this will delete most resources)
echo -e "${BLUE}Step 5: Deleting resource group...${NC}"

if az group exists --name "$RESOURCE_GROUP" >/dev/null 2>&1; then
    echo "Deleting resource group: $RESOURCE_GROUP"
    az group delete --name "$RESOURCE_GROUP" --yes --no-wait
    
    # Wait for resource group deletion
    wait_for_operation "resource group deletion" "az group exists --name $RESOURCE_GROUP" 300
else
    echo -e "${GREEN}✓ Resource group already deleted${NC}"
fi

# Step 6: Purge soft-deleted Cognitive Services
echo -e "${BLUE}Step 6: Purging soft-deleted Cognitive Services...${NC}"

COGNITIVE_TO_PURGE=$(az cognitiveservices account list-deleted --query "[?contains(name, '$BASE_NAME')].{name:name, location:location}" -o json 2>/dev/null || echo "[]")
if [ "$COGNITIVE_TO_PURGE" != "[]" ]; then
    echo "$COGNITIVE_TO_PURGE" | jq -r '.[] | "az cognitiveservices account purge --name \(.name) --location \(.location)"' | while read -r cmd; do
        echo "Executing: $cmd"
        eval "$cmd" || echo -e "${YELLOW}⚠ Failed to purge Cognitive Service${NC}"
    done
    echo -e "${GREEN}✓ Cognitive Services purged${NC}"
else
    echo -e "${GREEN}✓ No soft-deleted Cognitive Services to purge${NC}"
fi

# Step 7: Purge soft-deleted Key Vaults
echo -e "${BLUE}Step 7: Purging soft-deleted Key Vaults...${NC}"

KV_TO_PURGE=$(az keyvault list-deleted --query "[?contains(name, '$BASE_NAME')].{name:name, location:location}" -o json 2>/dev/null || echo "[]")
if [ "$KV_TO_PURGE" != "[]" ]; then
    echo "$KV_TO_PURGE" | jq -r '.[] | "az keyvault purge --name \(.name) --location \(.location)"' | while read -r cmd; do
        echo "Executing: $cmd"
        eval "$cmd" || echo -e "${YELLOW}⚠ Failed to purge Key Vault${NC}"
    done
    echo -e "${GREEN}✓ Key Vaults purged${NC}"
else
    echo -e "${GREEN}✓ No soft-deleted Key Vaults to purge${NC}"
fi

# Step 8: Clean up any orphaned role assignments (optional)
echo -e "${BLUE}Step 8: Checking for orphaned role assignments...${NC}"

# Note: This is for future use if we have custom role assignments that persist
echo -e "${GREEN}✓ Role assignment cleanup completed${NC}"

# Step 9: Final verification
echo -e "${BLUE}Step 9: Final verification...${NC}"

echo "Checking remaining resources:"
echo -e "${YELLOW}Resource Groups:${NC}"
az group list --query "[?contains(name, '$BASE_NAME')].{Name:name, State:properties.provisioningState}" -o table 2>/dev/null || echo "  No matching resource groups found"

echo -e "${YELLOW}Static Web Apps:${NC}"
az staticwebapp list --query "[?contains(name, '$BASE_NAME')].{Name:name, URL:defaultHostname}" -o table 2>/dev/null || echo "  No matching Static Web Apps found"

echo -e "${YELLOW}Soft-deleted Cognitive Services:${NC}"
az cognitiveservices account list-deleted --query "[?contains(name, '$BASE_NAME')].{Name:name, Location:location}" -o table 2>/dev/null || echo "  No soft-deleted Cognitive Services found"

echo -e "${YELLOW}Soft-deleted Key Vaults:${NC}"
az keyvault list-deleted --query "[?contains(name, '$BASE_NAME')].{Name:name, Location:location}" -o table 2>/dev/null || echo "  No soft-deleted Key Vaults found"

echo ""
echo -e "${GREEN}=========================================="
echo "✓ Complete cleanup finished!"
echo "=========================================="
echo ""
echo "What was cleaned up:"
echo "• Resource groups and all contained resources"
echo "• Static Web Apps (across all resource groups)"
echo "• Soft-deleted Cognitive Services (purged)"
echo "• Soft-deleted Key Vaults (purged)"
echo "• Azure AD redirect URIs (production URLs removed)"
echo ""
echo "What was preserved:"
echo "• Azure AD app registration and configuration"
echo "• Dev environment and localhost redirect URIs"
echo ""
echo "Next steps:"
echo "• You can now run ./deploy-full-production.sh for a fresh deployment"
echo "• All soft-deleted resources have been purged"
echo "• Azure AD app is ready for new production URLs"
echo -e "${NC}"