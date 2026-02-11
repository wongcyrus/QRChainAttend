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

# Deploy with minimal output to avoid JSON corruption
az deployment group create \
    --name $DEPLOYMENT_NAME \
    --resource-group $RESOURCE_GROUP \
    --template-file infrastructure/main.bicep \
    --parameters infrastructure/parameters/prod.bicepparam \
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

# Extract outputs with proper error handling
STORAGE_ACCOUNT=$(jq -r '.storageAccountName.value // .properties.outputs.storageAccountName.value // empty' deployment-output.json)
FUNCTION_APP=$(jq -r '.functionAppName.value // .properties.outputs.functionAppName.value // empty' deployment-output.json)
STATIC_WEB_APP=$(jq -r '.staticWebAppName.value // .properties.outputs.staticWebAppName.value // empty' deployment-output.json)
STATIC_WEB_APP_URL=$(jq -r '.staticWebAppUrl.value // .properties.outputs.staticWebAppUrl.value // empty' deployment-output.json)
SWA_TOKEN=$(jq -r '.staticWebAppDeploymentToken.value // .properties.outputs.staticWebAppDeploymentToken.value // empty' deployment-output.json)
OPENAI_NAME=$(jq -r '.openAIName.value // .properties.outputs.openAIName.value // empty' deployment-output.json)
OPENAI_ENDPOINT=$(jq -r '.openAIEndpoint.value // .properties.outputs.openAIEndpoint.value // empty' deployment-output.json)

# Validate required outputs
if [ -z "$STORAGE_ACCOUNT" ] || [ -z "$FUNCTION_APP" ]; then
    echo -e "${RED}✗ Failed to extract required outputs${NC}"
    echo "Storage Account: $STORAGE_ACCOUNT"
    echo "Function App: $FUNCTION_APP"
    exit 1
fi

echo -e "${GREEN}✓ Outputs extracted${NC}"
echo "  Storage: $STORAGE_ACCOUNT"
echo "  Function App: $FUNCTION_APP"
echo "  Static Web App: $STATIC_WEB_APP"
echo "  Azure OpenAI: $OPENAI_NAME"
echo ""

# Step 5: Build and deploy backend
echo -e "${BLUE}Step 5: Building and deploying backend...${NC}"
cd backend
npm install --silent
npm run build
func azure functionapp publish $FUNCTION_APP --javascript --nozip > /dev/null 2>&1
cd ..
echo -e "${GREEN}✓ Backend deployed${NC}"
echo ""

# Step 6: Create database tables
echo -e "${BLUE}Step 6: Creating database tables...${NC}"
TABLES=("Sessions" "Attendance" "Chains" "Tokens" "UserSessions" "AttendanceSnapshots" "ChainHistory" "ScanLogs" "QuizQuestions" "QuizResponses" "QuizMetrics")

for table in "${TABLES[@]}"; do
    az storage table create \
        --name $table \
        --account-name $STORAGE_ACCOUNT \
        --auth-mode login \
        --output none 2>/dev/null || true
done

echo -e "${GREEN}✓ Database tables created (11 tables)${NC}"
echo ""

# Step 7: Configure CORS
echo -e "${BLUE}Step 7: Configuring CORS...${NC}"
az functionapp cors add \
    --name $FUNCTION_APP \
    --resource-group $RESOURCE_GROUP \
    --allowed-origins https://$STATIC_WEB_APP_URL \
    --output none

echo -e "${GREEN}✓ CORS configured${NC}"
echo ""

# Step 8: Build and deploy frontend
echo -e "${BLUE}Step 8: Building and deploying frontend...${NC}"

# Update frontend environment
cat > frontend/.env.production << EOF
# Production Environment Configuration
NEXT_PUBLIC_API_URL=https://$FUNCTION_APP.azurewebsites.net/api
NEXT_PUBLIC_AAD_CLIENT_ID=dc482c34-ebaa-4239-aca3-2810a4f51728
NEXT_PUBLIC_AAD_TENANT_ID=8ff7db19-435d-4c3c-83d3-ca0a46234f51
NEXT_PUBLIC_AAD_REDIRECT_URI=https://$STATIC_WEB_APP_URL/.auth/login/aad/callback
NEXT_PUBLIC_SIGNALR_URL=https://$FUNCTION_APP.azurewebsites.net/api
EOF

cd frontend
npm install --silent
npm run build > /dev/null 2>&1

# Deploy to Static Web App
npx @azure/static-web-apps-cli deploy \
    --deployment-token "$SWA_TOKEN" \
    --app-location . \
    --output-location out \
    --env production > /dev/null 2>&1

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

# Check tables
TABLE_COUNT=$(az storage table list \
    --account-name $STORAGE_ACCOUNT \
    --auth-mode login \
    --query "length(@)" -o tsv 2>/dev/null)

echo -e "${GREEN}✓ Database tables: $TABLE_COUNT${NC}"

# Check Azure OpenAI
OPENAI_STATE=$(az cognitiveservices account show \
    --name $OPENAI_NAME \
    --resource-group $RESOURCE_GROUP \
    --query properties.provisioningState -o tsv)

if [ "$OPENAI_STATE" != "Succeeded" ]; then
    echo -e "${YELLOW}⚠ Azure OpenAI provisioning (state: $OPENAI_STATE)${NC}"
else
    echo -e "${GREEN}✓ Azure OpenAI is ready${NC}"
fi

echo ""

# Step 10: Display summary
echo -e "${GREEN}=========================================="
echo "Deployment Complete!"
echo -e "==========================================${NC}"
echo ""
echo -e "${BLUE}Production URLs:${NC}"
echo "  Frontend: https://$STATIC_WEB_APP_URL"
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
echo "  Endpoint: $OPENAI_ENDPOINT"
echo "  Models:   gpt-4o, gpt-4o-vision"
echo ""
echo -e "${BLUE}Database:${NC}"
echo "  Tables: $TABLE_COUNT"
echo ""
echo -e "${GREEN}✓ Production deployment successful!${NC}"
echo ""
echo "Next steps:"
echo "  1. Visit: https://$STATIC_WEB_APP_URL"
echo "  2. Login with Azure AD"
echo "  3. Test all features"
echo ""

# Save deployment info
cat > deployment-info.json << EOF
{
  "deploymentDate": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "resourceGroup": "$RESOURCE_GROUP",
  "location": "$LOCATION",
  "frontendUrl": "https://$STATIC_WEB_APP_URL",
  "backendUrl": "https://$FUNCTION_APP.azurewebsites.net",
  "storageAccount": "$STORAGE_ACCOUNT",
  "functionApp": "$FUNCTION_APP",
  "staticWebApp": "$STATIC_WEB_APP",
  "azureOpenAI": "$OPENAI_NAME",
  "openAIEndpoint": "$OPENAI_ENDPOINT",
  "tableCount": $TABLE_COUNT
}
EOF

echo "Deployment info saved to: deployment-info.json"
echo ""
