#!/bin/bash
# Deploy QR Chain Attendance System to Azure
# This script deploys both backend and frontend to existing Azure infrastructure

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Configuration
RESOURCE_GROUP="rg-qr-attendance-dev"
FUNCTION_APP_NAME="func-qrattendance-dev"
STATIC_WEB_APP_NAME="swa-qrattendance-dev2"

echo -e "${CYAN}========================================${NC}"
echo -e "${CYAN}QR Chain Attendance - Azure Deployment${NC}"
echo -e "${CYAN}========================================${NC}"
echo ""

# Check if logged in to Azure
if ! az account show &> /dev/null; then
    echo -e "${RED}Error: Not logged in to Azure${NC}"
    echo "Please run 'az login' first"
    exit 1
fi

ACCOUNT_NAME=$(az account show --query 'user.name' -o tsv)
SUBSCRIPTION_NAME=$(az account show --query 'name' -o tsv)
echo -e "${GREEN}✓ Logged in as: $ACCOUNT_NAME${NC}"
echo -e "${GREEN}✓ Subscription: $SUBSCRIPTION_NAME${NC}"
echo ""

# Step 1: Deploy Backend Functions
echo -e "${CYAN}========================================${NC}"
echo -e "${CYAN}Step 1: Deploy Backend Functions${NC}"
echo -e "${CYAN}========================================${NC}"
echo ""

cd backend

echo -e "${YELLOW}Installing dependencies...${NC}"
npm install

echo -e "${YELLOW}Building backend...${NC}"
npm run build

# Count functions
FUNCTION_COUNT=$(ls -1 src/functions/*.ts 2>/dev/null | wc -l)
COMPILED_COUNT=$(ls -1 dist/src/functions/*.js 2>/dev/null | wc -l)
echo -e "${GREEN}✓ Functions to deploy: $FUNCTION_COUNT${NC}"
echo -e "${GREEN}✓ Compiled functions: $COMPILED_COUNT${NC}"
echo ""

echo -e "${YELLOW}Deploying to Azure Functions: $FUNCTION_APP_NAME${NC}"
func azure functionapp publish "$FUNCTION_APP_NAME" --javascript

echo -e "${GREEN}✓ Backend deployed successfully!${NC}"
echo ""

cd ..

# Step 2: Deploy Frontend to Static Web App
echo -e "${CYAN}========================================${NC}"
echo -e "${CYAN}Step 2: Deploy Frontend${NC}"
echo -e "${CYAN}========================================${NC}"
echo ""

cd frontend

echo -e "${YELLOW}Installing dependencies...${NC}"
npm install

echo -e "${YELLOW}Building frontend...${NC}"
npm run build

echo -e "${GREEN}✓ Frontend built successfully!${NC}"
echo ""

# Get Static Web App deployment token
echo -e "${YELLOW}Getting Static Web App deployment token...${NC}"
DEPLOYMENT_TOKEN=$(az staticwebapp secrets list \
    --name "$STATIC_WEB_APP_NAME" \
    --resource-group "$RESOURCE_GROUP" \
    --query "properties.apiKey" -o tsv)

if [ -z "$DEPLOYMENT_TOKEN" ]; then
    echo -e "${RED}Error: Could not get deployment token${NC}"
    exit 1
fi

echo -e "${GREEN}✓ Got deployment token${NC}"
echo ""

# Deploy to Static Web App using the CLI
echo -e "${YELLOW}Deploying to Static Web App: $STATIC_WEB_APP_NAME${NC}"

# Install SWA CLI if not already installed
if ! command -v swa &> /dev/null; then
    echo -e "${YELLOW}Installing Azure Static Web Apps CLI...${NC}"
    npm install -g @azure/static-web-apps-cli
fi

# Deploy using SWA CLI
swa deploy ./out \
    --deployment-token "$DEPLOYMENT_TOKEN" \
    --env production

echo -e "${GREEN}✓ Frontend deployed successfully!${NC}"
echo ""

cd ..

# Step 3: Verify Deployment
echo -e "${CYAN}========================================${NC}"
echo -e "${CYAN}Step 3: Verify Deployment${NC}"
echo -e "${CYAN}========================================${NC}"
echo ""

# Get Function App URL
FUNCTION_APP_URL=$(az functionapp show \
    --name "$FUNCTION_APP_NAME" \
    --resource-group "$RESOURCE_GROUP" \
    --query "defaultHostName" -o tsv)

echo -e "${GREEN}Function App URL: https://$FUNCTION_APP_URL${NC}"

# Get Static Web App URL
STATIC_WEB_APP_URL=$(az staticwebapp show \
    --name "$STATIC_WEB_APP_NAME" \
    --resource-group "$RESOURCE_GROUP" \
    --query "defaultHostname" -o tsv)

echo -e "${GREEN}Static Web App URL: https://$STATIC_WEB_APP_URL${NC}"
echo ""

# List deployed functions
echo -e "${YELLOW}Deployed Functions:${NC}"
az functionapp function list \
    --name "$FUNCTION_APP_NAME" \
    --resource-group "$RESOURCE_GROUP" \
    --query "[].{Name:name, TriggerType:config.bindings[0].type}" -o table

echo ""
echo -e "${CYAN}========================================${NC}"
echo -e "${GREEN}✓ Deployment Complete!${NC}"
echo -e "${CYAN}========================================${NC}"
echo ""
echo -e "${YELLOW}Next Steps:${NC}"
echo -e "1. Visit: https://$STATIC_WEB_APP_URL"
echo -e "2. Test the application"
echo -e "3. Check logs in Azure Portal if needed"
echo ""
