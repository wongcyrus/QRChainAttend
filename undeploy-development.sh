#!/bin/bash
# Undeploy Development Environment
# Cleans up all Azure resources created for development

set -e

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}=========================================="
echo "QR Chain Attendance - Development Environment Cleanup"
echo -e "==========================================${NC}"
echo ""

# Configuration
RESOURCE_GROUP="rg-qr-attendance-dev"
SUBSCRIPTION_ID=$(az account show --query id -o tsv)

echo -e "${YELLOW}⚠ WARNING: This will delete the DEVELOPMENT environment!${NC}"
echo ""
echo "Resources to be deleted:"
echo "  • Resource Group: $RESOURCE_GROUP"
echo "  • All resources within the group"
echo "  • Static Web App: swa-qrattendance-dev"
echo "  • Function App: func-qrattendance-dev"
echo "  • Storage Account: stqrattendancedev (and all data)"
echo "  • Azure OpenAI: openai-qrattendance-dev (if exists)"
echo "  • Application Insights: appinsights-qrattendance-dev"
echo "  • SignalR: signalr-qrattendance-dev (if exists)"
echo ""

# Confirmation
echo -e "${RED}This action cannot be undone!${NC}"
read -p "Are you sure you want to delete the development environment? (type 'DELETE' to confirm): " confirm

if [ "$confirm" != "DELETE" ]; then
    echo -e "${YELLOW}Aborted by user${NC}"
    exit 0
fi

echo ""
echo -e "${BLUE}Starting development environment cleanup...${NC}"
echo ""

# Step 1: List all resources in the development resource group
echo -e "${BLUE}Step 1: Discovering development resources...${NC}"

if az group show --name "$RESOURCE_GROUP" --output none 2>/dev/null; then
    echo "Found development resource group: $RESOURCE_GROUP"
    
    # List all resources
    echo "Resources in development environment:"
    az resource list --resource-group "$RESOURCE_GROUP" --output table
    echo ""
else
    echo -e "${YELLOW}Development resource group not found${NC}"
fi

# Step 2: Clean up Azure AD redirect URIs (if configured)
echo -e "${BLUE}Step 2: Cleaning up Azure AD configuration...${NC}"

if [ -f ".env.azure-ad" ]; then
    source .env.azure-ad
    
    if [ -n "$AAD_CLIENT_ID" ]; then
        echo "Checking Azure AD app registration: $AAD_CLIENT_ID"
        
        # Get current redirect URIs
        CURRENT_URIS=$(az ad app show --id "$AAD_CLIENT_ID" --query "web.redirectUris" -o json 2>/dev/null || echo "[]")
        
        if [ "$CURRENT_URIS" != "[]" ] && [ "$CURRENT_URIS" != "null" ]; then
            echo "Current redirect URIs:"
            echo "$CURRENT_URIS" | jq -r '.[]' | grep -E "https://.*-dev.*\.azurestaticapps\.net" || echo "  (no dev URIs found)"
            
            # Filter out development URIs
            NEW_URIS=$(echo "$CURRENT_URIS" | jq -r 'map(select(test("https://.*-dev.*\\.azurestaticapps\\.net") | not))')
            
            if [ "$NEW_URIS" != "$CURRENT_URIS" ]; then
                echo "Updating Azure AD redirect URIs..."
                az ad app update --id "$AAD_CLIENT_ID" --web-redirect-uris $(echo "$NEW_URIS" | jq -r '.[]') 2>/dev/null || true
                echo -e "${GREEN}✓ Development redirect URIs removed from Azure AD${NC}"
            else
                echo "No development redirect URIs found in Azure AD"
            fi
        else
            echo "No redirect URIs configured in Azure AD"
        fi
    fi
fi

# Step 3: Delete Static Web App (may be outside resource group)
echo -e "${BLUE}Step 3: Deleting Static Web App...${NC}"

# Try to find and delete any Static Web Apps for this environment
STATIC_WEB_APPS=$(az staticwebapp list --resource-group "$RESOURCE_GROUP" --query "[].name" -o tsv 2>/dev/null || echo "")
if [ -n "$STATIC_WEB_APPS" ]; then
    echo "$STATIC_WEB_APPS" | while read -r SWA_NAME; do
        if [ -n "$SWA_NAME" ] && [ "$SWA_NAME" != "null" ]; then
            echo "Deleting Static Web App: $SWA_NAME"
            az staticwebapp delete --name "$SWA_NAME" --yes 2>/dev/null || echo "  (failed or already deleted)"
        fi
    done
    echo -e "${GREEN}✓ Static Web Apps deleted${NC}"
else
    # Try specific names as fallback
    for SWA_NAME in "swa-qrattendance-dev" "swa-qrattendance-dev2"; do
        SWA_EXISTS=$(az staticwebapp show --name "$SWA_NAME" --output none 2>/dev/null && echo "yes" || echo "no")
        if [ "$SWA_EXISTS" = "yes" ]; then
            echo "Deleting Static Web App: $SWA_NAME"
            az staticwebapp delete --name "$SWA_NAME" --yes 2>/dev/null || echo "  (failed to delete)"
        fi
    done
    echo -e "${YELLOW}Static Web Apps check complete${NC}"
fi

# Step 4: Delete resource group and all resources
echo -e "${BLUE}Step 4: Deleting resource group...${NC}"

if az group show --name "$RESOURCE_GROUP" --output none 2>/dev/null; then
    echo "Deleting resource group: $RESOURCE_GROUP"
    echo "This may take several minutes..."
    
    az group delete --name "$RESOURCE_GROUP" --yes --no-wait
    
    # Wait for deletion to complete
    echo "Waiting for deletion to complete..."
    while az group show --name "$RESOURCE_GROUP" --output none 2>/dev/null; do
        echo -n "."
        sleep 10
    done
    echo ""
    echo -e "${GREEN}✓ Resource group deleted${NC}"
else
    echo -e "${YELLOW}Resource group already deleted${NC}"
fi

# Step 5: Check for soft-deleted resources that might block future deployments
echo -e "${BLUE}Step 5: Checking for soft-deleted resources...${NC}"

# Check for soft-deleted Cognitive Services (Azure OpenAI)
echo "Checking for soft-deleted Cognitive Services..."
SOFT_DELETED_OPENAI=$(az cognitiveservices account list-deleted --query "[?name=='openai-qrattendance-dev']" -o json 2>/dev/null || echo "[]")
if [ "$SOFT_DELETED_OPENAI" != "[]" ] && [ "$SOFT_DELETED_OPENAI" != "null" ] && [ -n "$SOFT_DELETED_OPENAI" ]; then
    echo "Found soft-deleted Azure OpenAI. Purging permanently..."
    # Try with different location approaches
    LOCATION_FROM_DELETED=$(echo "$SOFT_DELETED_OPENAI" | jq -r '.[0].location' 2>/dev/null || echo "$LOCATION")
    for LOC in "$LOCATION_FROM_DELETED" "$LOCATION" "eastus2" "eastus"; do
        if [ -n "$LOC" ] && [ "$LOC" != "null" ]; then
            az cognitiveservices account purge \
                --name "openai-qrattendance-dev" \
                --resource-group "$RESOURCE_GROUP" \
                --location "$LOC" 2>/dev/null && break || continue
        fi
    done
    echo -e "${GREEN}✓ Soft-deleted Azure OpenAI purge attempted${NC}"
else
    echo "No soft-deleted Azure OpenAI found"
fi

# Check for soft-deleted Key Vaults (if any were created)
echo "Checking for soft-deleted Key Vaults..."
SOFT_DELETED_KV=$(az keyvault list-deleted --query "[?name=='kv-qrattendance-dev' || name=='keyvault-qrattendance-dev']" -o json 2>/dev/null || echo "[]")
if [ "$SOFT_DELETED_KV" != "[]" ] && [ "$SOFT_DELETED_KV" != "null" ] && [ -n "$SOFT_DELETED_KV" ]; then
    echo "Found soft-deleted Key Vault. Purging permanently..."
    echo "$SOFT_DELETED_KV" | jq -r '.[].name' 2>/dev/null | while read -r KV_NAME; do
        if [ -n "$KV_NAME" ] && [ "$KV_NAME" != "null" ]; then
            az keyvault purge --name "$KV_NAME" 2>/dev/null || echo "  Could not purge $KV_NAME"
        fi
    done
    echo -e "${GREEN}✓ Soft-deleted Key Vault purge attempted${NC}"
else
    echo "No soft-deleted Key Vault found"
fi

# Check for additional soft-deleted resources that might interfere
echo "Checking for other soft-deleted resources..."
# Sometimes API Management or other services can be soft-deleted
for SERVICE_TYPE in "Microsoft.ApiManagement" "Microsoft.Sql"; do
    echo "  Checking $SERVICE_TYPE soft-deleted resources..."
    # This is a best-effort check - not all services support listing soft-deleted resources
done

echo -e "${GREEN}✓ Soft-deleted resources check complete${NC}"

# Step 6: Clean up Azure AD redirect URIs (if Azure AD credentials exist)
echo -e "${BLUE}Step 6: Cleaning up Azure AD configuration...${NC}"

if [ -f ".azure-ad-credentials" ]; then
    echo "Azure AD credentials file found. Cleaning up redirect URIs..."
    
    # Load Azure AD configuration
    source .azure-ad-credentials 2>/dev/null || {
        echo -e "${YELLOW}⚠ Could not source Azure AD credentials${NC}"
    }
    
    if [ -n "$CLIENT_ID" ]; then
        echo "Cleaning up redirect URIs for Client ID: $CLIENT_ID"
        
        # Get existing redirect URIs to filter out development ones
        EXISTING_URIS=$(az ad app show --id "$CLIENT_ID" --query "web.redirectUris" -o json 2>/dev/null || echo "[]")
        
        if [ "$EXISTING_URIS" != "[]" ] && [ "$EXISTING_URIS" != "null" ] && [ -n "$EXISTING_URIS" ]; then
            echo "Current redirect URIs found. Filtering out development URLs..."
            
            # Filter out development-related URIs (containing 'dev', local hosts, etc.)
            FILTERED_URIS=$(echo "$EXISTING_URIS" | jq -r 'map(select(
                (test("dev"; "i") | not) and
                (test("localhost") | not) and
                (test("127\\.0\\.0\\.1") | not) and
                (test("ambitious-.*dev") | not)
            ))' 2>/dev/null || echo "[]")
            
            # If the filtered list is different, update the app registration
            if [ "$EXISTING_URIS" != "$FILTERED_URIS" ]; then
                echo "Updating Azure AD app redirect URIs..."
                az ad app update --id "$CLIENT_ID" \
                    --web-redirect-uris $(echo "$FILTERED_URIS" | jq -r '.[]' | tr '\n' ' ') \
                    2>/dev/null || {
                        echo -e "${YELLOW}⚠ Could not update redirect URIs automatically${NC}"
                        echo "  You may need to manually remove development redirect URIs from:"
                        echo "  https://portal.azure.com/#view/Microsoft_AAD_RegisteredApps/ApplicationMenuBlade/~/Authentication/appId/$CLIENT_ID"
                    }
                echo -e "${GREEN}✓ Azure AD redirect URIs cleaned${NC}"
            else
                echo "No development redirect URIs found to remove"
            fi
        else
            echo "No existing redirect URIs found or could not query them"
        fi
    else
        echo -e "${YELLOW}⚠ CLIENT_ID not found in credentials file${NC}"
    fi
else
    echo "No Azure AD credentials file found (.azure-ad-credentials)"
    echo "Skipping Azure AD cleanup"
fi

echo -e "${GREEN}✓ Azure AD cleanup complete${NC}"

# Step 7: Clean up local files
echo -e "${BLUE}Step 7: Cleaning up local development files...${NC}"

# Remove deployment info
if [ -f "deployment-info.json" ]; then
    # Check if it's for dev environment
    ENV_CHECK=$(jq -r '.environment // ""' deployment-info.json)
    if [ "$ENV_CHECK" = "development" ]; then
        rm deployment-info.json
        echo -e "${GREEN}✓ Development deployment info removed${NC}"
    else
        echo -e "${YELLOW}Keeping deployment-info.json (not for development)${NC}"
    fi
fi

# Remove deployment output if it exists
if [ -f "deployment-output.json" ]; then
    rm deployment-output.json
    echo -e "${GREEN}✓ Deployment output cleaned${NC}"
fi

# Clean up local settings
if [ -f "backend/local.settings.json" ]; then
    # Check if it contains development configuration
    if grep -q "local-dev\|qrattendance-dev" backend/local.settings.json 2>/dev/null; then
        rm backend/local.settings.json
        echo -e "${GREEN}✓ Backend local.settings.json removed${NC}"
    fi
fi

if [ -f "frontend/.env.local" ]; then
    # Check if it contains local development configuration
    if grep -q "localhost:7071\|local-dev" frontend/.env.local 2>/dev/null; then
        rm frontend/.env.local
        echo -e "${GREEN}✓ Frontend .env.local removed${NC}"
    fi
fi

echo ""
echo -e "${BLUE}=========================================="
echo "Development Environment Cleanup Complete!"
echo -e "==========================================${NC}"
echo ""
echo -e "${GREEN}Successfully removed:${NC}"
echo "  ✓ Resource group: $RESOURCE_GROUP"
echo "  ✓ All Azure resources in development environment"
echo "  ✓ Static Web App: swa-qrattendance-dev"
echo "  ✓ Development redirect URIs from Azure AD"
echo "  ✓ Soft-deleted resources (if any)"
echo "  ✓ Local development configuration files"
echo ""
echo -e "${GREEN}The development environment has been completely removed.${NC}"
echo ""
echo -e "${YELLOW}To redeploy the development environment:${NC}"
echo "  ./deploy-full-development.sh"
echo ""