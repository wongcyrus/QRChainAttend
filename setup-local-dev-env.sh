#!/bin/bash
# Local Development Configuration for Dev Environment
# Configures local development to work with deployed dev environment

set -e

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}=========================================="
echo "QR Chain Attendance - Local Dev Configuration"
echo -e "==========================================${NC}"
echo ""

# Function to check if deployment info exists
check_deployment_info() {
    if [ ! -f "deployment-info.json" ]; then
        echo -e "${RED}✗ deployment-info.json not found${NC}"
        echo "Please run ./deploy-full-development.sh first to deploy the dev environment"
        exit 1
    fi
}

# Function to extract values from deployment info
extract_deployment_info() {
    DEV_BACKEND_URL=$(jq -r '.urls.backend // ""' deployment-info.json)
    DEV_FRONTEND_URL=$(jq -r '.urls.frontend // ""' deployment-info.json)
    RESOURCE_GROUP=$(jq -r '.azure.resourceGroup // "rg-qr-attendance-dev"' deployment-info.json)
    FUNCTION_APP_NAME=$(jq -r '.azure.functionApp // ""' deployment-info.json)
    STORAGE_NAME=$(jq -r '.azure.storageAccount // ""' deployment-info.json)
    
    echo "Development environment info:"
    echo "  Backend URL: $DEV_BACKEND_URL"
    echo "  Frontend URL: $DEV_FRONTEND_URL"
    echo "  Function App: $FUNCTION_APP_NAME"
    echo ""
}

# Function to configure backend for local development
configure_backend() {
    echo -e "${BLUE}Configuring backend for local development...${NC}"
    
    cd backend
    
    # Get connection strings from Azure
    echo "Retrieving connection strings from Azure..."
    STORAGE_CONNECTION_STRING=$(az storage account show-connection-string \
        --name "$STORAGE_NAME" \
        --resource-group "$RESOURCE_GROUP" \
        --query connectionString -o tsv)
    
    # Get Application Insights connection string
    APPINSIGHTS_CONNECTION_STRING=$(az monitor app-insights component show \
        --app "appinsights-qrattendance-dev" \
        --resource-group "$RESOURCE_GROUP" \
        --query connectionString -o tsv 2>/dev/null || echo "")
    
    # Get SignalR connection string if exists
    SIGNALR_CONNECTION_STRING=$(az signalr key list \
        --name "signalr-qrattendance-dev" \
        --resource-group "$RESOURCE_GROUP" \
        --query primaryConnectionString -o tsv 2>/dev/null || echo "")
    
    # Get Azure OpenAI credentials if exists
    OPENAI_ENDPOINT=$(az cognitiveservices account show \
        --name "openai-qrattendance-dev" \
        --resource-group "$RESOURCE_GROUP" \
        --query properties.endpoint -o tsv 2>/dev/null || echo "")
    
    OPENAI_KEY=""
    if [ -n "$OPENAI_ENDPOINT" ]; then
        OPENAI_KEY=$(az cognitiveservices account keys list \
            --name "openai-qrattendance-dev" \
            --resource-group "$RESOURCE_GROUP" \
            --query key1 -o tsv 2>/dev/null || echo "")
    fi
    
    # Create local.settings.json for local development
    cat > local.settings.json << EOF
{
  "IsEncrypted": false,
  "Values": {
    "AzureWebJobsStorage": "$STORAGE_CONNECTION_STRING",
    "FUNCTIONS_EXTENSION_VERSION": "~4",
    "FUNCTIONS_WORKER_RUNTIME": "node",
    "WEBSITE_NODE_DEFAULT_VERSION": "~20",
    "FUNCTIONS_CORE_TOOLS_TELEMETRY_OPTOUT": "1",
    "StorageConnectionString": "$STORAGE_CONNECTION_STRING",
    "APPINSIGHTS_INSTRUMENTATIONKEY": "",
    "APPLICATIONINSIGHTS_CONNECTION_STRING": "$APPINSIGHTS_CONNECTION_STRING",
    "Azure__SignalR__ConnectionString": "$SIGNALR_CONNECTION_STRING",
    "AzureOpenAI__Endpoint": "$OPENAI_ENDPOINT",
    "AzureOpenAI__ApiKey": "$OPENAI_KEY",
    "Environment": "local-dev",
    "DEBUG": "*",
    "CORS_ORIGINS": "http://localhost:3000,https://localhost:3000"
  },
  "Host": {
    "LocalHttpPort": 7071,
    "CORS": "*",
    "CORSCredentials": true
  }
}
EOF
    
    echo -e "${GREEN}✓ Backend local.settings.json configured${NC}"
    cd ..
}

# Function to configure frontend for local development
configure_frontend() {
    echo -e "${BLUE}Configuring frontend for local development...${NC}"
    
    cd frontend
    
    # Load Azure AD config
    source ../.env.azure-ad 2>/dev/null || true
    
    # Create .env.local for local frontend development
    cat > .env.local << EOF
# Local Development Configuration
NEXT_PUBLIC_API_URL=http://localhost:7071
NEXT_PUBLIC_ENVIRONMENT=local-dev
NEXT_PUBLIC_AAD_CLIENT_ID=$AAD_CLIENT_ID
NEXT_PUBLIC_AAD_TENANT_ID=organizations
NEXT_PUBLIC_AAD_REDIRECT_URI=http://localhost:3000/api/auth/callback

# Development URLs for reference
# DEV_BACKEND_URL=$DEV_BACKEND_URL
# DEV_FRONTEND_URL=$DEV_FRONTEND_URL
EOF
    
    echo -e "${GREEN}✓ Frontend .env.local configured${NC}"
    cd ..
}

# Function to install dependencies
install_dependencies() {
    echo -e "${BLUE}Installing dependencies...${NC}"
    
    # Backend dependencies
    echo "Installing backend dependencies..."
    cd backend
    npm install
    cd ..
    
    # Frontend dependencies
    echo "Installing frontend dependencies..."
    cd frontend
    npm install
    cd ..
    
    echo -e "${GREEN}✓ Dependencies installed${NC}"
}

# Function to start local development servers
start_local_servers() {
    echo -e "${BLUE}Local Development Setup Complete!${NC}"
    echo ""
    echo -e "${GREEN}To start local development:${NC}"
    echo ""
    echo -e "${YELLOW}1. Start the backend (in one terminal):${NC}"
    echo "   cd backend && npm run start"
    echo "   Backend will run at: http://localhost:7071"
    echo ""
    echo -e "${YELLOW}2. Start the frontend (in another terminal):${NC}"
    echo "   cd frontend && npm run dev"
    echo "   Frontend will run at: http://localhost:3000"
    echo ""
    echo -e "${YELLOW}3. Local development URLs:${NC}"
    echo "   Frontend: http://localhost:3000"
    echo "   Backend:  http://localhost:7071"
    echo ""
    echo -e "${YELLOW}4. Connected to dev environment:${NC}"
    echo "   Database: $STORAGE_NAME (dev tables)"
    echo "   Azure OpenAI: $([ -n "$OPENAI_ENDPOINT" ] && echo "Enabled" || echo "Disabled")"
    echo ""
    echo -e "${GREEN}✓ Local development configured!${NC}"
}

# Main execution
echo -e "${BLUE}Step 1: Checking deployment info...${NC}"
check_deployment_info
extract_deployment_info

echo -e "${BLUE}Step 2: Configuring backend...${NC}"
configure_backend

echo -e "${BLUE}Step 3: Configuring frontend...${NC}"
configure_frontend

echo -e "${BLUE}Step 4: Installing dependencies...${NC}"
install_dependencies

echo -e "${BLUE}Step 5: Setup complete!${NC}"
start_local_servers