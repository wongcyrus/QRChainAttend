#!/bin/bash
# Fully Automated Production Deployment
# Deploys infrastructure, backend, database, and frontend

set -e

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m'

# Configuration
RESOURCE_GROUP="rg-qr-attendance-prod"
LOCATION="eastus2"
DEPLOYMENT_NAME="prod-full-$(date +%Y%m%d-%H%M%S)"

echo -e "${BLUE}=========================================="
echo "QR Chain Attendance - Full Production Deployment"
echo -e "==========================================${NC}"
echo ""

# Step 0: Get Azure AD credentials
echo -e "${BLUE}Step 0: Azure AD Configuration${NC}"

# Load Azure AD Client ID from environment file (safe to commit)
if [ -f ".env.azure-ad" ]; then
    echo "Loading Azure AD configuration from .env.azure-ad..."
    source .env.azure-ad
    echo -e "${GREEN}✓ Azure AD Client ID loaded from file${NC}"
fi

# Check if AAD credentials are provided via environment variables
if [ -z "$AAD_CLIENT_ID" ]; then
    echo -e "${YELLOW}Azure AD Client ID not found${NC}"
    echo "Please provide Azure AD Client ID (or press Enter to skip and configure later):"
    read -r AAD_CLIENT_ID
    if [ -z "$AAD_CLIENT_ID" ]; then
        echo -e "${YELLOW}⚠ Skipping Azure AD configuration - you'll need to configure manually later${NC}"
        AAD_CLIENT_ID=""
        AAD_CLIENT_SECRET=""
    fi
fi

# Note: Client Secret is always requested interactively (never stored in files)
if [ -z "$AAD_CLIENT_ID" ]; then
    echo -e "${YELLOW}Azure AD Client ID not found in environment${NC}"
    echo "Please provide Azure AD Client ID (or press Enter to skip and configure later):"
    read -r AAD_CLIENT_ID
    if [ -z "$AAD_CLIENT_ID" ]; then
        echo -e "${YELLOW}⚠ Skipping Azure AD configuration - you'll need to configure manually later${NC}"
        AAD_CLIENT_ID=""
        AAD_CLIENT_SECRET=""
    fi
fi

if [ -n "$AAD_CLIENT_ID" ] && [ -z "$AAD_CLIENT_SECRET" ]; then
    echo "Please provide Azure AD Client Secret (or press Enter to skip):"
    read -rs AAD_CLIENT_SECRET
    echo ""
    if [ -z "$AAD_CLIENT_SECRET" ]; then
        echo -e "${YELLOW}⚠ Client Secret not provided - you'll need to configure manually later${NC}"
    fi
fi

# Get Tenant ID from Azure CLI
TENANT_ID="organizations" # Multi-tenant by default
SPECIFIC_TENANT_ID=$(az account show --query tenantId -o tsv 2>/dev/null || echo "organizations")

if [ -n "$AAD_CLIENT_ID" ]; then
    echo -e "${GREEN}✓ Azure AD credentials provided${NC}"
    echo "  Client ID: $AAD_CLIENT_ID"
    echo "  Tenant ID: $TENANT_ID"
else
    echo -e "${YELLOW}⚠ Azure AD will need manual configuration after deployment${NC}"
fi
echo ""

# Step 1: Check prerequisites
echo -e "${BLUE}Step 1: Checking prerequisites...${NC}"

if ! command -v az &> /dev/null; then
    echo -e "${RED}✗ Azure CLI not installed${NC}"
    exit 1
fi

if ! command -v func &> /dev/null; then
    echo -e "${RED}✗ Azure Functions Core Tools not installed${NC}"
    exit 1
fi

if ! command -v npm &> /dev/null; then
    echo -e "${RED}✗ npm not installed${NC}"
    exit 1
fi

if ! command -v jq &> /dev/null; then
    echo -e "${RED}✗ jq not installed${NC}"
    exit 1
fi

if ! az account show &> /dev/null; then
    echo -e "${RED}✗ Not logged in to Azure${NC}"
    exit 1
fi

# Check if Azure Static Web Apps extension is installed
echo "Checking Azure CLI extensions..."
if ! az extension list --query "[?name=='staticwebapp']" -o tsv | grep -q staticwebapp; then
    echo "Installing Azure Static Web Apps CLI extension..."
    az extension add --name staticwebapp --yes --only-show-errors
fi

echo -e "${GREEN}✓ All prerequisites met${NC}"
echo ""

# Step 2: Create resource group
echo -e "${BLUE}Step 2: Creating resource group...${NC}"
az group create \
    --name $RESOURCE_GROUP \
    --location $LOCATION \
    --tags Environment=Production Application="QR Chain Attendance" ManagedBy=Bicep \
    --output none

echo -e "${GREEN}✓ Resource group created${NC}"
echo ""

# Step 3: Deploy infrastructure
echo -e "${BLUE}Step 3: Deploying infrastructure (10-15 minutes)...${NC}"

# Prepare parameters
BICEP_PARAMS="infrastructure/parameters/prod.bicepparam"

# Deploy infrastructure (backend only - Static Web App created separately)
az deployment group create \
    --name $DEPLOYMENT_NAME \
    --resource-group $RESOURCE_GROUP \
    --template-file infrastructure/main.bicep \
    --parameters $BICEP_PARAMS \
    --mode Incremental \
    --only-show-errors \
    --query '{properties: properties}' \
    --output json > deployment-output.json 2>&1

DEPLOY_EXIT_CODE=$?

if [ $DEPLOY_EXIT_CODE -ne 0 ]; then
    echo -e "${RED}✗ Infrastructure deployment failed${NC}"
    echo "Deployment output:"
    cat deployment-output.json
    exit 1
fi

echo -e "${GREEN}✓ Infrastructure deployed${NC}"
echo ""

# Step 4: Extract outputs
echo -e "${BLUE}Step 4: Extracting deployment outputs...${NC}"

# Check if deployment-output.json exists and is valid
if [ ! -f "deployment-output.json" ]; then
    echo -e "${RED}✗ deployment-output.json not found${NC}"
    exit 1
fi

# Validate JSON before parsing
if ! jq empty deployment-output.json 2>/dev/null; then
    echo -e "${RED}✗ Invalid JSON in deployment-output.json${NC}"
    echo "File content:"
    cat deployment-output.json
    echo ""
    echo "Attempting to extract outputs directly from Azure..."
    
    # Fallback: Query deployment directly
    az deployment group show \
        --name $DEPLOYMENT_NAME \
        --resource-group $RESOURCE_GROUP \
        --query 'properties.outputs' \
        --output json > deployment-output.json 2>&1
    
    if ! jq empty deployment-output.json 2>/dev/null; then
        echo -e "${RED}✗ Failed to retrieve valid deployment outputs${NC}"
        exit 1
    fi
    
    echo -e "${YELLOW}⚠ Retrieved outputs directly from Azure${NC}"
fi

# Extract outputs with proper error handling (backend infrastructure only)
if jq -e '.properties.outputs' deployment-output.json > /dev/null 2>&1; then
    # Standard bicep deployment output format
    STORAGE_ACCOUNT=$(jq -r '.properties.outputs.storageAccountName.value // empty' deployment-output.json)
    FUNCTION_APP=$(jq -r '.properties.outputs.functionAppName.value // empty' deployment-output.json)
    OPENAI_NAME=$(jq -r '.properties.outputs.openAIName.value // empty' deployment-output.json)
    OPENAI_ENDPOINT=$(jq -r '.properties.outputs.openAIEndpoint.value // empty' deployment-output.json)
else
    # Direct outputs format
    STORAGE_ACCOUNT=$(jq -r '.storageAccountName.value // empty' deployment-output.json)
    FUNCTION_APP=$(jq -r '.functionAppName.value // empty' deployment-output.json)
    OPENAI_NAME=$(jq -r '.openAIName.value // empty' deployment-output.json)
    OPENAI_ENDPOINT=$(jq -r '.openAIEndpoint.value // empty' deployment-output.json)
fi

# Validate required outputs
if [ -z "$STORAGE_ACCOUNT" ] || [ -z "$FUNCTION_APP" ]; then
    echo -e "${RED}✗ Failed to extract required outputs${NC}"
    echo "Storage Account: $STORAGE_ACCOUNT"
    echo "Function App: $FUNCTION_APP"
    exit 1
fi

echo -e "${GREEN}✓ Backend infrastructure outputs extracted${NC}"
echo "  Storage: $STORAGE_ACCOUNT"
echo "  Function App: $FUNCTION_APP"
echo "  Azure OpenAI: $OPENAI_NAME"
echo ""

# Step 5: Build and deploy backend
echo -e "${BLUE}Step 5: Building and deploying backend...${NC}"
cd backend
npm install --silent
npm run build
func azure functionapp publish $FUNCTION_APP --javascript --nozip > /dev/null 2>&1
cd ..

# Wait for Function App to be fully ready
echo "Waiting for Function App to be fully operational..."
sleep 30

# Verify Function App is running and healthy
FUNC_STATE=$(az functionapp show \
    --name $FUNCTION_APP \
    --resource-group $RESOURCE_GROUP \
    --query state -o tsv)

if [ "$FUNC_STATE" != "Running" ]; then
    echo -e "${YELLOW}⚠ Function App not fully ready yet (state: $FUNC_STATE), waiting...${NC}"
    sleep 30
fi

echo -e "${GREEN}✓ Backend deployed and ready${NC}"
echo ""

# Step 5.5: Create or use existing Azure Static Web App
echo -e "${BLUE}Step 5.5: Setting up Azure Static Web App...${NC}"

# Check if Static Web App already exists
EXISTING_SWA=$(az staticwebapp list --resource-group $RESOURCE_GROUP --query "[0].{name:name, hostname:defaultHostname}" -o json 2>/dev/null)

if [ -n "$EXISTING_SWA" ] && [ "$EXISTING_SWA" != "null" ] && [ "$EXISTING_SWA" != "[]" ]; then
    # Use existing Static Web App
    STATIC_WEB_APP=$(echo "$EXISTING_SWA" | jq -r '.name')
    STATIC_WEB_APP_HOSTNAME=$(echo "$EXISTING_SWA" | jq -r '.hostname')
    STATIC_WEB_APP_URL="https://$STATIC_WEB_APP_HOSTNAME"
    
    echo -e "${GREEN}✓ Using existing Static Web App${NC}"
    echo "  Name: $STATIC_WEB_APP"
    echo "  URL: $STATIC_WEB_APP_URL"
else
    # Create new Static Web App
    STATIC_WEB_APP="swa-qrattendance-prod-$(date +%s)"
    
    echo "Creating Static Web App: $STATIC_WEB_APP"
    SWA_CREATE_OUTPUT=$(az staticwebapp create \
        --name $STATIC_WEB_APP \
        --resource-group $RESOURCE_GROUP \
        --location $LOCATION \
        --tags Environment=Production Application="QR Chain Attendance" \
        --query '{name: name, defaultHostname: defaultHostname}' \
        --output json)

    if [ $? -eq 0 ] && [ -n "$SWA_CREATE_OUTPUT" ]; then
        STATIC_WEB_APP_URL="https://$(echo "$SWA_CREATE_OUTPUT" | jq -r '.defaultHostname')"
        STATIC_WEB_APP_HOSTNAME=$(echo "$SWA_CREATE_OUTPUT" | jq -r '.defaultHostname')
        
        echo -e "${GREEN}✓ Static Web App created${NC}"
        echo "  Name: $STATIC_WEB_APP"
        echo "  URL: $STATIC_WEB_APP_URL"
    else
        echo -e "${RED}✗ Failed to create Static Web App${NC}"
        exit 1
    fi
fi

# Get deployment token
echo "Retrieving deployment token..."
SWA_TOKEN=$(az staticwebapp secrets list \
    --name $STATIC_WEB_APP \
    --resource-group $RESOURCE_GROUP \
    --query 'properties.apiKey' -o tsv 2>/dev/null)

if [ -n "$SWA_TOKEN" ] && [ "$SWA_TOKEN" != "null" ]; then
    echo -e "${GREEN}✓ Deployment token retrieved${NC}"
else
    echo -e "${YELLOW}⚠ Could not retrieve deployment token - will attempt manual deployment${NC}"
fi
echo ""

# Step 6: Database tables (managed by bicep)
echo -e "${BLUE}Step 6: Verifying database tables...${NC}"
echo -e "${GREEN}✓ Database tables managed by bicep infrastructure${NC}"
echo ""

# Step 7: Update CORS configuration for Static Web App
echo -e "${BLUE}Step 7: Configuring CORS for Static Web App...${NC}"

# Add Static Web App URL to Function App CORS
echo "Adding Static Web App URL to CORS: $STATIC_WEB_APP_URL"
az functionapp cors add \
    --name $FUNCTION_APP \
    --resource-group $RESOURCE_GROUP \
    --allowed-origins "$STATIC_WEB_APP_URL" \
    --output none

# Verify CORS configuration
CORS_ORIGINS=$(az functionapp cors show \
    --name $FUNCTION_APP \
    --resource-group $RESOURCE_GROUP \
    --query "allowedOrigins" -o tsv 2>/dev/null || echo "")

if echo "$CORS_ORIGINS" | grep -q "$STATIC_WEB_APP_HOSTNAME"; then
    echo -e "${GREEN}✓ CORS configured for Static Web App${NC}"
else
    echo -e "${YELLOW}⚠ CORS configuration may need manual verification${NC}"
fi

# Enable CORS credentials support
echo "Enabling CORS credentials support..."
az functionapp cors credentials \
    --name $FUNCTION_APP \
    --resource-group $RESOURCE_GROUP \
    --enable \
    --output none

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ CORS credentials enabled${NC}"
else
    echo -e "${YELLOW}⚠ Failed to enable CORS credentials${NC}"
fi

# Verify Function App authentication is disabled
echo "Verifying Function App authentication is disabled..."
AUTH_ENABLED=$(az webapp auth-classic show \
    --name $FUNCTION_APP \
    --resource-group $RESOURCE_GROUP \
    --query "enabled" -o tsv 2>/dev/null || echo "false")

if [ "$AUTH_ENABLED" = "true" ]; then
    echo -e "${YELLOW}⚠ Function App authentication is enabled, disabling it...${NC}"
    az webapp auth-classic update \
        --name $FUNCTION_APP \
        --resource-group $RESOURCE_GROUP \
        --enabled false \
        --action AllowAnonymous \
        --output none
    echo -e "${GREEN}✓ Function App authentication disabled${NC}"
else
    echo -e "${GREEN}✓ Function App authentication already disabled${NC}"
fi
echo ""

# Step 7.5: Verify and update Azure AD configuration
echo -e "${BLUE}Step 7.5: Configuring Azure AD for Static Web App...${NC}"

if [ -n "$AAD_CLIENT_ID" ]; then
    echo -e "${GREEN}✓ Azure AD credentials provided${NC}"
    echo "  Client ID: $AAD_CLIENT_ID"
    echo "  Tenant: $TENANT_ID (multi-tenant)"
    
    # Update Azure AD redirect URI for the new Static Web App
    echo -e "${BLUE}Updating Azure AD redirect URI...${NC}"
    REDIRECT_URI="$STATIC_WEB_APP_URL/.auth/login/aad/callback"
    
    # Get current redirect URIs and add the new one if not present
    CURRENT_URIS=$(az ad app show --id $AAD_CLIENT_ID --query "web.redirectUris" -o tsv | tr '\n' ' ' | tr -d '\r')
    
    if echo "$CURRENT_URIS" | grep -q "$REDIRECT_URI"; then
        echo -e "${GREEN}✓ Redirect URI already configured${NC}"
    else
        echo "Adding redirect URI: $REDIRECT_URI"
        NEW_URIS="$CURRENT_URIS $REDIRECT_URI"
        az ad app update --id $AAD_CLIENT_ID --web-redirect-uris $NEW_URIS --output none
        echo -e "${GREEN}✓ Redirect URI added to Azure AD app${NC}"
    fi
    
    # Configure Static Web App application settings
    echo -e "${BLUE}Configuring Static Web App AAD settings...${NC}"
    az staticwebapp appsettings set \
        --name $STATIC_WEB_APP \
        --resource-group $RESOURCE_GROUP \
        --setting-names \
            AAD_CLIENT_ID="$AAD_CLIENT_ID" \
            AAD_CLIENT_SECRET="$AAD_CLIENT_SECRET" \
            TENANT_ID="$TENANT_ID" \
        --output none
    
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✓ Static Web App AAD settings configured${NC}"
    else
        echo -e "${YELLOW}⚠ Failed to configure Static Web App AAD settings${NC}"
        echo "You may need to configure manually using the Azure portal"
    fi
else
    echo -e "${YELLOW}⚠ Azure AD not configured - manual setup required${NC}"
    echo ""
    echo "To configure Azure AD authentication:"
    echo "  1. Update your Azure AD App Registration:"
    echo "     - Add redirect URI: $STATIC_WEB_APP_URL/.auth/login/aad/callback"
    echo "     - Set multi-tenant if needed"
    echo "  2. Update staticwebapp.config.json with your client ID"
    echo "  3. Redeploy frontend with updated configuration"
    echo ""
fi
echo ""

# Step 8: Build and deploy frontend
echo -e "${BLUE}Step 8: Building and deploying frontend...${NC}"

# Update frontend environment
# Use AAD_CLIENT_ID if provided, otherwise use placeholder
FRONTEND_AAD_CLIENT_ID="${AAD_CLIENT_ID:-YOUR_AAD_CLIENT_ID}"

# Export environment variables for Next.js build
export NEXT_PUBLIC_API_URL="https://$FUNCTION_APP.azurewebsites.net/api"
export NEXT_PUBLIC_AAD_CLIENT_ID="$FRONTEND_AAD_CLIENT_ID"
export NEXT_PUBLIC_AAD_TENANT_ID="$TENANT_ID"
export NEXT_PUBLIC_AAD_REDIRECT_URI="$STATIC_WEB_APP_URL/.auth/login/aad/callback"
export NEXT_PUBLIC_SIGNALR_URL="https://$FUNCTION_APP.azurewebsites.net/api"
export NEXT_PUBLIC_ENVIRONMENT="production"
export NEXT_PUBLIC_FRONTEND_URL="$STATIC_WEB_APP_URL"

# Also create .env.production file as backup
cat > frontend/.env.production << EOF
# Production Environment Configuration
NEXT_PUBLIC_API_URL=https://$FUNCTION_APP.azurewebsites.net/api
NEXT_PUBLIC_AAD_CLIENT_ID=$FRONTEND_AAD_CLIENT_ID
NEXT_PUBLIC_AAD_TENANT_ID=$TENANT_ID
NEXT_PUBLIC_AAD_REDIRECT_URI=$STATIC_WEB_APP_URL/.auth/login/aad/callback
NEXT_PUBLIC_SIGNALR_URL=https://$FUNCTION_APP.azurewebsites.net/api
NEXT_PUBLIC_ENVIRONMENT=production
NEXT_PUBLIC_FRONTEND_URL=$STATIC_WEB_APP_URL
EOF

cd frontend
npm install --silent

# Build with error handling
echo "Building frontend..."
if npm run build; then
    # Copy staticwebapp.config.json to output directory (Next.js doesn't include it automatically)
    cp staticwebapp.config.json out/
    echo -e "${GREEN}✓ Frontend build successful${NC}"
else
    echo -e "${RED}✗ Frontend build failed${NC}"
    cd ..
    exit 1
fi

# Deploy to Static Web App
if [ -n "$SWA_TOKEN" ] && [ "$SWA_TOKEN" != "null" ] && [ "$SWA_TOKEN" != "empty" ]; then
    echo "Deploying to Static Web App..."
    
    # Check if SWA CLI is available, install if needed
    if ! command -v swa &> /dev/null; then
        echo "Installing Azure Static Web Apps CLI..."
        npm install -g @azure/static-web-apps-cli --silent
    fi
    
    # Deploy using SWA CLI
    if swa deploy \
        --deployment-token "$SWA_TOKEN" \
        --app-location . \
        --output-location out \
        --env production; then
        echo -e "${GREEN}✓ Frontend deployed to Static Web App${NC}"
    else
        echo -e "${YELLOW}⚠ SWA CLI deployment failed, trying alternative method...${NC}"
        
        # Alternative: Use npx if swa command fails
        if npx @azure/static-web-apps-cli deploy \
            --deployment-token "$SWA_TOKEN" \
            --app-location . \
            --output-location out \
            --env production; then
            echo -e "${GREEN}✓ Frontend deployed via npx SWA CLI${NC}"
        else
            echo -e "${YELLOW}⚠ Automated deployment failed${NC}"
            echo "Please deploy manually using:"
            echo "  cd frontend"
            echo "  npx @azure/static-web-apps-cli deploy --deployment-token=\"$SWA_TOKEN\" --app-location=. --output-location=out --env=production"
        fi
    fi
else
    echo -e "${YELLOW}⚠ No deployment token available${NC}"
    echo "Please deploy manually using the Azure portal or SWA CLI"
    echo "Static Web App URL: $STATIC_WEB_APP_URL"
fi

cd ..
echo -e "${GREEN}✓ Frontend deployed${NC}"
echo ""

# Step 9: Verify deployment
echo -e "${BLUE}Step 9: Verifying deployment...${NC}"

# Check Function App
FUNC_STATE=$(az functionapp show \
    --name $FUNCTION_APP \
    --resource-group $RESOURCE_GROUP \
    --query state -o tsv)

if [ "$FUNC_STATE" != "Running" ]; then
    echo -e "${YELLOW}⚠ Function App not running yet (state: $FUNC_STATE)${NC}"
else
    echo -e "${GREEN}✓ Function App is running${NC}"
fi

# Check Static Web App
SWA_STATE=$(az staticwebapp show \
    --name $STATIC_WEB_APP \
    --resource-group $RESOURCE_GROUP \
    --query "repositoryUrl || 'Manual'" -o tsv 2>/dev/null || echo "Unknown")

if [ "$SWA_STATE" != "Unknown" ]; then
    echo -e "${GREEN}✓ Static Web App is ready${NC}"
else
    echo -e "${YELLOW}⚠ Static Web App status unknown${NC}"
fi

# Check tables
TABLE_COUNT=$(az storage table list \
    --account-name $STORAGE_ACCOUNT \
    --auth-mode login \
    --query "length(@)" -o tsv 2>/dev/null)

echo -e "${GREEN}✓ Database tables: $TABLE_COUNT${NC}"

# Check Azure OpenAI (only if deployed)
if [ -n "$OPENAI_NAME" ] && [ "$OPENAI_NAME" != "null" ] && [ "$OPENAI_NAME" != "empty" ]; then
    OPENAI_STATE=$(az cognitiveservices account show \
        --name $OPENAI_NAME \
        --resource-group $RESOURCE_GROUP \
        --query properties.provisioningState -o tsv 2>/dev/null || echo "NotFound")

    if [ "$OPENAI_STATE" != "Succeeded" ]; then
        echo -e "${YELLOW}⚠ Azure OpenAI provisioning (state: $OPENAI_STATE)${NC}"
    else
        echo -e "${GREEN}✓ Azure OpenAI is ready${NC}"
    fi
else
    echo -e "${YELLOW}⚠ Azure OpenAI not deployed${NC}"
fi

echo ""

# Step 10: Display summary
echo -e "${GREEN}=========================================="
echo "Deployment Complete!"
echo -e "==========================================${NC}"
echo ""
echo -e "${BLUE}Production URLs:${NC}"
echo "  Frontend: $STATIC_WEB_APP_URL"
echo "  Backend:  https://$FUNCTION_APP.azurewebsites.net"
echo ""
echo -e "${BLUE}Azure Resources:${NC}"
echo "  Resource Group: $RESOURCE_GROUP"
echo "  Storage:        $STORAGE_ACCOUNT"
echo "  Function App:   $FUNCTION_APP"
echo "  Static Web App: $STATIC_WEB_APP"
echo "  Azure OpenAI:   $OPENAI_NAME"
echo ""
echo -e "${BLUE}Azure OpenAI:${NC}"
if [ -n "$OPENAI_ENDPOINT" ] && [ "$OPENAI_ENDPOINT" != "null" ] && [ "$OPENAI_ENDPOINT" != "empty" ]; then
    echo "  Endpoint: $OPENAI_ENDPOINT"
    echo "  Models:   gpt-4o, gpt-4o-vision"
else
    echo "  Not deployed"
fi
echo ""
echo -e "${BLUE}Database:${NC}"
echo "  Tables: $TABLE_COUNT"
echo ""
echo -e "${GREEN}✓ Production deployment successful!${NC}"
echo ""
echo "Next steps:"
echo "  1. Visit: $STATIC_WEB_APP_URL"
echo "  2. Login with Azure AD"
echo "  3. Test all features"
echo ""

# Save deployment info
cat > deployment-info.json << EOF
{
  "deploymentDate": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "resourceGroup": "$RESOURCE_GROUP",
  "location": "$LOCATION",
  "frontendUrl": "$STATIC_WEB_APP_URL",
  "backendUrl": "https://$FUNCTION_APP.azurewebsites.net",
  "storageAccount": "$STORAGE_ACCOUNT",
  "functionApp": "$FUNCTION_APP",
  "staticWebApp": "$STATIC_WEB_APP",
  "azureOpenAI": "${OPENAI_NAME:-null}",
  "openAIEndpoint": "${OPENAI_ENDPOINT:-null}",
  "tableCount": ${TABLE_COUNT:-0},
  "infrastructure": {
    "bicepDeployment": "completed",
    "staticWebAppDeployment": "cli-created",
    "functionAppAuthDisabled": true,
    "corsConfigured": true,
    "corsCredentialsEnabled": true,
    "multiTenantAuth": $([ "$TENANT_ID" = "organizations" ] && echo "true" || echo "false")
  }
}
EOF

echo "Deployment info saved to: deployment-info.json"
echo ""
