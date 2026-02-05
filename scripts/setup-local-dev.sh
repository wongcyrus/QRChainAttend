#!/bin/bash

# Setup Local Development Environment
# This script helps configure your local development environment with Azure resources

set -e

echo "🚀 QR Chain Attendance - Local Development Setup"
echo "================================================"
echo ""

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check prerequisites
echo "📋 Checking prerequisites..."

if ! command -v az &> /dev/null; then
    echo -e "${RED}❌ Azure CLI not found. Please install: https://docs.microsoft.com/cli/azure/install-azure-cli${NC}"
    exit 1
fi

if ! command -v node &> /dev/null; then
    echo -e "${RED}❌ Node.js not found. Please install Node.js 18+${NC}"
    exit 1
fi

if ! command -v func &> /dev/null; then
    echo -e "${RED}❌ Azure Functions Core Tools not found. Please install: npm install -g azure-functions-core-tools@4${NC}"
    exit 1
fi

echo -e "${GREEN}✅ All prerequisites installed${NC}"
echo ""

# Get Azure AD details
echo "🔐 Azure AD Configuration"
echo "========================="
echo ""

read -p "Enter your Azure AD Client ID: " CLIENT_ID
read -p "Enter your Azure AD Tenant ID: " TENANT_ID
read -p "Enter your Resource Group name: " RESOURCE_GROUP

echo ""
echo "📦 Fetching Azure resource details..."
echo ""

# Get Storage Account
STORAGE_ACCOUNTS=$(az storage account list --resource-group "$RESOURCE_GROUP" --query "[].name" -o tsv)
if [ -z "$STORAGE_ACCOUNTS" ]; then
    echo -e "${YELLOW}⚠️  No storage accounts found in resource group${NC}"
    USE_AZURITE="yes"
else
    STORAGE_ACCOUNT=$(echo "$STORAGE_ACCOUNTS" | head -n 1)
    echo "Found storage account: $STORAGE_ACCOUNT"
    
    read -p "Use Azure Storage ($STORAGE_ACCOUNT) or Azurite emulator? [azure/azurite]: " STORAGE_CHOICE
    if [ "$STORAGE_CHOICE" = "azurite" ]; then
        USE_AZURITE="yes"
    else
        USE_AZURITE="no"
        STORAGE_CONNECTION=$(az storage account show-connection-string \
            --name "$STORAGE_ACCOUNT" \
            --resource-group "$RESOURCE_GROUP" \
            --query connectionString \
            --output tsv)
    fi
fi

# Get SignalR
SIGNALR_SERVICES=$(az signalr list --resource-group "$RESOURCE_GROUP" --query "[].name" -o tsv)
if [ -z "$SIGNALR_SERVICES" ]; then
    echo -e "${YELLOW}⚠️  No SignalR services found in resource group${NC}"
    SIGNALR_CONNECTION="Endpoint=https://dummy.service.signalr.net;AccessKey=dummy;Version=1.0;"
else
    SIGNALR_NAME=$(echo "$SIGNALR_SERVICES" | head -n 1)
    echo "Found SignalR service: $SIGNALR_NAME"
    
    SIGNALR_CONNECTION=$(az signalr key list \
        --name "$SIGNALR_NAME" \
        --resource-group "$RESOURCE_GROUP" \
        --query primaryConnectionString \
        --output tsv)
fi

# Get OpenAI (optional)
OPENAI_ACCOUNTS=$(az cognitiveservices account list \
    --resource-group "$RESOURCE_GROUP" \
    --query "[?kind=='OpenAI'].name" -o tsv)

if [ -z "$OPENAI_ACCOUNTS" ]; then
    echo -e "${YELLOW}⚠️  No OpenAI accounts found (optional)${NC}"
    OPENAI_ENDPOINT=""
    OPENAI_KEY=""
    OPENAI_DEPLOYMENT=""
else
    OPENAI_NAME=$(echo "$OPENAI_ACCOUNTS" | head -n 1)
    echo "Found OpenAI account: $OPENAI_NAME"
    
    OPENAI_ENDPOINT=$(az cognitiveservices account show \
        --name "$OPENAI_NAME" \
        --resource-group "$RESOURCE_GROUP" \
        --query properties.endpoint \
        --output tsv)
    
    OPENAI_KEY=$(az cognitiveservices account keys list \
        --name "$OPENAI_NAME" \
        --resource-group "$RESOURCE_GROUP" \
        --query key1 \
        --output tsv)
    
    read -p "Enter OpenAI deployment name (e.g., gpt-4): " OPENAI_DEPLOYMENT
fi

echo ""
echo "📝 Creating configuration files..."
echo ""

# Create backend local.settings.json
if [ "$USE_AZURITE" = "yes" ]; then
    cat > backend/local.settings.json << EOF
{
  "IsEncrypted": false,
  "Values": {
    "AzureWebJobsStorage": "UseDevelopmentStorage=true",
    "FUNCTIONS_WORKER_RUNTIME": "node",
    "STORAGE_ACCOUNT_NAME": "devstorageaccount1",
    "STORAGE_ACCOUNT_URI": "http://127.0.0.1:10002/devstorageaccount1",
    "SIGNALR_CONNECTION_STRING": "$SIGNALR_CONNECTION",
    "LATE_ROTATION_SECONDS": "60",
    "EARLY_LEAVE_ROTATION_SECONDS": "60",
    "CHAIN_TOKEN_TTL_SECONDS": "20",
    "OWNER_TRANSFER": "true",
    "WIFI_SSID_ALLOWLIST": "",
    "AOAI_ENDPOINT": "$OPENAI_ENDPOINT",
    "AOAI_KEY": "$OPENAI_KEY",
    "AOAI_DEPLOYMENT": "$OPENAI_DEPLOYMENT"
  }
}
EOF
    echo -e "${GREEN}✅ Created backend/local.settings.json (using Azurite)${NC}"
    echo -e "${YELLOW}⚠️  Remember to start Azurite: azurite --silent --location ./azurite${NC}"
else
    cat > backend/local.settings.json << EOF
{
  "IsEncrypted": false,
  "Values": {
    "AzureWebJobsStorage": "$STORAGE_CONNECTION",
    "FUNCTIONS_WORKER_RUNTIME": "node",
    "STORAGE_ACCOUNT_NAME": "$STORAGE_ACCOUNT",
    "STORAGE_ACCOUNT_URI": "https://$STORAGE_ACCOUNT.table.core.windows.net",
    "SIGNALR_CONNECTION_STRING": "$SIGNALR_CONNECTION",
    "LATE_ROTATION_SECONDS": "60",
    "EARLY_LEAVE_ROTATION_SECONDS": "60",
    "CHAIN_TOKEN_TTL_SECONDS": "20",
    "OWNER_TRANSFER": "true",
    "WIFI_SSID_ALLOWLIST": "",
    "AOAI_ENDPOINT": "$OPENAI_ENDPOINT",
    "AOAI_KEY": "$OPENAI_KEY",
    "AOAI_DEPLOYMENT": "$OPENAI_DEPLOYMENT"
  }
}
EOF
    echo -e "${GREEN}✅ Created backend/local.settings.json (using Azure Storage)${NC}"
fi

# Create frontend .env.local
cat > frontend/.env.local << EOF
# API Configuration
NEXT_PUBLIC_API_URL=http://localhost:7071/api

# Azure AD Configuration
NEXT_PUBLIC_AAD_CLIENT_ID=$CLIENT_ID
NEXT_PUBLIC_AAD_TENANT_ID=$TENANT_ID
NEXT_PUBLIC_AAD_REDIRECT_URI=http://localhost:3000/.auth/login/aad/callback

# Environment
NEXT_PUBLIC_ENVIRONMENT=local

# Optional: SignalR Configuration
NEXT_PUBLIC_SIGNALR_URL=http://localhost:7071/api
EOF

echo -e "${GREEN}✅ Created frontend/.env.local${NC}"

# Update Azure AD redirect URI
echo ""
echo "🔧 Updating Azure AD redirect URI..."

az ad app update \
    --id "$CLIENT_ID" \
    --web-redirect-uris \
        "http://localhost:3000/.auth/login/aad/callback" \
        > /dev/null 2>&1 || true

echo -e "${GREEN}✅ Added localhost redirect URI to Azure AD app${NC}"

echo ""
echo "✨ Setup complete!"
echo ""
echo "📚 Next steps:"
echo "1. Install dependencies: npm install"
echo "2. Start backend: cd backend && npm start"
echo "3. Start frontend: cd frontend && npm run dev"
if [ "$USE_AZURITE" = "yes" ]; then
    echo "4. Start Azurite (separate terminal): azurite --silent --location ./azurite"
fi
echo ""
echo "📖 Full guide: LOCAL_DEVELOPMENT_SETUP.md"
echo ""
