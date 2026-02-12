#!/bin/bash

# QR Chain Attendance - Resource Discovery Script (Safe - No Deletion)
# This script identifies all resources that would be cleaned up, without deleting anything

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

echo -e "${BLUE}=========================================="
echo "QR Chain Attendance - Resource Discovery"
echo "=========================================="
echo "This script identifies resources WITHOUT deleting them"
echo -e "${NC}"

echo -e "${BLUE}Resource Groups:${NC}"
RESOURCE_GROUPS=$(az group list --query "[?contains(name, '$BASE_NAME')].{Name:name, State:properties.provisioningState, Location:location}" -o table 2>/dev/null || echo "")
if [ -n "$RESOURCE_GROUPS" ] && [ "$RESOURCE_GROUPS" != "[]" ]; then
    echo "$RESOURCE_GROUPS"
    
    # List resources in each resource group
    az group list --query "[?contains(name, '$BASE_NAME')].name" -o tsv 2>/dev/null | while read -r rg; do
        echo -e "${YELLOW}Resources in $rg:${NC}"
        az resource list --resource-group "$rg" --query "[].{Name:name, Type:type, Location:location}" -o table 2>/dev/null || echo "  No resources found"
        echo ""
    done
else
    echo "  No matching resource groups found"
    echo ""
fi

echo -e "${BLUE}Static Web Apps (all resource groups):${NC}"
STATIC_WEB_APPS=$(az staticwebapp list --query "[?contains(name, '$BASE_NAME')].{Name:name, ResourceGroup:resourceGroup, URL:defaultHostname, Location:location}" -o table 2>/dev/null || echo "")
if [ -n "$STATIC_WEB_APPS" ] && [ "$STATIC_WEB_APPS" != "[]" ]; then
    echo "$STATIC_WEB_APPS"
else
    echo "  No matching Static Web Apps found"
fi
echo ""

echo -e "${BLUE}Soft-deleted Cognitive Services:${NC}"
DELETED_COGNITIVE=$(az cognitiveservices account list-deleted --query "[?contains(name, '$BASE_NAME')].{Name:name, Location:location, Kind:kind, DeletionDate:deletionDate}" -o table 2>/dev/null || echo "")
if [ -n "$DELETED_COGNITIVE" ] && [ "$DELETED_COGNITIVE" != "[]" ]; then
    echo "$DELETED_COGNITIVE"
else
    echo "  No soft-deleted Cognitive Services found"
fi
echo ""

echo -e "${BLUE}Soft-deleted Key Vaults:${NC}"
DELETED_KV=$(az keyvault list-deleted --query "[?contains(name, '$BASE_NAME')].{Name:name, Location:location, DeletionDate:deletionDate}" -o table 2>/dev/null || echo "")
if [ -n "$DELETED_KV" ] && [ "$DELETED_KV" != "[]" ]; then
    echo "$DELETED_KV"
else
    echo "  No soft-deleted Key Vaults found"
fi
echo ""

echo -e "${BLUE}Azure AD Apps:${NC}"
AZURE_AD_APPS=$(az ad app list --query "[?contains(displayName, 'QR') || contains(displayName, 'qr') || contains(displayName, 'attendance')].{Name:displayName, ClientId:appId}" -o table 2>/dev/null || echo "")
if [ -n "$AZURE_AD_APPS" ] && [ "$AZURE_AD_APPS" != "[]" ]; then
    echo "$AZURE_AD_APPS"
    echo -e "${GREEN}Note: Azure AD apps are NOT deleted by the cleanup script${NC}"
else
    echo "  No matching Azure AD apps found"
fi
echo ""

echo -e "${GREEN}=========================================="
echo "Discovery completed!"
echo "========================================"
echo ""
echo "To clean up these resources, run: ./undeploy-production.sh"
echo -e "${NC}"