#!/bin/bash
# Start local backend and frontend with PRODUCTION configuration
# This runs everything locally but connected to production Azure resources

set -e

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${BLUE}=========================================="
echo "Local Environment with Production Config"
echo -e "==========================================${NC}"
echo ""

# Production Azure resources
RESOURCE_GROUP="rg-qr-attendance-prod"
STORAGE_ACCOUNT="stqrattendanceprod"
SIGNALR_SERVICE="signalr-qrattendance-prod"
OPENAI_SERVICE="oai-qrattendance-prod"

echo -e "${YELLOW}⚠️  WARNING: This will connect to PRODUCTION Azure resources!${NC}"
echo ""
echo "This script will:"
echo "  1. Configure local backend with production Azure resources"
echo "  2. Configure local frontend to use local backend"
echo "  3. Start both services locally"
echo ""
echo "You will be using:"
echo "  - Production Storage Account (stqrattendanceprod)"
echo "  - Production SignalR Service"
echo "  - Production Azure OpenAI"
echo "  - Production Database Tables"
echo ""
read -p "Continue? (y/n): " -n 1 -r
echo ""
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Aborted."
    exit 1
fi

echo ""
echo -e "${BLUE}Fetching production configuration from Azure...${NC}"

# Check Azure CLI
if ! command -v az &> /dev/null; then
    echo -e "${RED}❌ Azure CLI not found. Please install it first.${NC}"
    exit 1
fi

# Check if logged in
if ! az account show &> /dev/null; then
    echo -e "${YELLOW}Not logged in to Azure. Logging in...${NC}"
    az login
fi

# Get Storage Account connection details
echo -e "${BLUE}Getting Storage Account configuration...${NC}"
STORAGE_CONNECTION=$(az storage account show-connection-string \
    --name $STORAGE_ACCOUNT \
    --resource-group $RESOURCE_GROUP \
    --query connectionString -o tsv)

if [ -z "$STORAGE_CONNECTION" ]; then
    echo -e "${RED}❌ Failed to get storage connection string${NC}"
    exit 1
fi

# Get SignalR connection string
echo -e "${BLUE}Getting SignalR configuration...${NC}"
SIGNALR_CONNECTION=$(az signalr key list \
    --name $SIGNALR_SERVICE \
    --resource-group $RESOURCE_GROUP \
    --query primaryConnectionString -o tsv)

if [ -z "$SIGNALR_CONNECTION" ]; then
    echo -e "${RED}❌ Failed to get SignalR connection string${NC}"
    exit 1
fi

# Get Azure OpenAI configuration
echo -e "${BLUE}Getting Azure OpenAI configuration...${NC}"
AOAI_ENDPOINT=$(az cognitiveservices account show \
    --name $OPENAI_SERVICE \
    --resource-group $RESOURCE_GROUP \
    --query properties.endpoint -o tsv)

AOAI_KEY=$(az cognitiveservices account keys list \
    --name $OPENAI_SERVICE \
    --resource-group $RESOURCE_GROUP \
    --query key1 -o tsv)

if [ -z "$AOAI_ENDPOINT" ] || [ -z "$AOAI_KEY" ]; then
    echo -e "${RED}❌ Failed to get Azure OpenAI configuration${NC}"
    exit 1
fi

echo -e "${GREEN}✓ Configuration fetched successfully${NC}"
echo ""

# Create backend local.settings.json
echo -e "${BLUE}Creating backend/local.settings.json...${NC}"
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
    "AZURE_OPENAI_ENDPOINT": "$AOAI_ENDPOINT",
    "AZURE_OPENAI_KEY": "$AOAI_KEY",
    "AZURE_OPENAI_DEPLOYMENT": "gpt-4o",
    "AZURE_OPENAI_VISION_DEPLOYMENT": "gpt-4o-vision"
  },
  "Host": {
    "CORS": "*",
    "CORSCredentials": false
  }
}
EOF

echo -e "${GREEN}✓ Backend configured${NC}"
echo ""

# Create frontend .env.local
echo -e "${BLUE}Creating frontend/.env.local...${NC}"
cat > frontend/.env.local << EOF
# Local Frontend with Local Backend (Production Config)
NEXT_PUBLIC_API_URL=http://localhost:7071/api
NEXT_PUBLIC_SIGNALR_URL=http://localhost:7071/api

# Azure AD Configuration (Production)
NEXT_PUBLIC_AAD_CLIENT_ID=dc482c34-ebaa-4239-aca3-2810a4f51728
NEXT_PUBLIC_AAD_TENANT_ID=8ff7db19-435d-4c3c-83d3-ca0a46234f51
NEXT_PUBLIC_AAD_REDIRECT_URI=http://localhost:3001/.auth/login/aad/callback

# Environment indicator
NEXT_PUBLIC_ENVIRONMENT=local-prod
EOF

echo -e "${GREEN}✓ Frontend configured${NC}"
echo ""

# Check if node_modules exists
if [ ! -d "backend/node_modules" ]; then
    echo -e "${BLUE}Installing backend dependencies...${NC}"
    cd backend
    npm install
    cd ..
    echo -e "${GREEN}✓ Backend dependencies installed${NC}"
    echo ""
fi

if [ ! -d "frontend/node_modules" ]; then
    echo -e "${BLUE}Installing frontend dependencies...${NC}"
    cd frontend
    npm install
    cd ..
    echo -e "${GREEN}✓ Frontend dependencies installed${NC}"
    echo ""
fi

# Function to open new terminal based on OS
open_terminal() {
    local title=$1
    local command=$2
    
    if command -v gnome-terminal &> /dev/null; then
        # Linux with GNOME
        gnome-terminal --tab --title="$title" -- bash -c "$command; exec bash"
    elif command -v xterm &> /dev/null; then
        # Linux with xterm
        xterm -T "$title" -e "$command; bash" &
    elif [[ "$OSTYPE" == "darwin"* ]]; then
        # macOS
        osascript -e "tell application \"Terminal\" to do script \"cd $(pwd) && $command\""
    else
        echo -e "${YELLOW}⚠️  Could not detect terminal. Please run manually:${NC}"
        echo ""
        echo "Terminal 1 (Backend):"
        echo "  cd backend && npm start"
        echo ""
        echo "Terminal 2 (Frontend):"
        echo "  cd frontend && npm run dev"
        echo ""
        exit 0
    fi
}

echo -e "${BLUE}Starting services...${NC}"
echo ""

# Start backend
echo -e "${BLUE}Starting Backend (Azure Functions)...${NC}"
open_terminal "Backend - Local Prod" "cd backend && npm start"
sleep 3

# Start frontend
echo -e "${BLUE}Starting Frontend (Next.js)...${NC}"
open_terminal "Frontend - Local Prod" "cd frontend && PORT=3001 npm run dev"
sleep 2

echo ""
echo -e "${GREEN}✅ Services starting...${NC}"
echo ""
echo -e "${BLUE}📍 URLs:${NC}"
echo "  Frontend: http://localhost:3001"
echo "  Backend:  http://localhost:7071/api"
echo ""
echo -e "${YELLOW}⚠️  Connected to PRODUCTION Azure resources:${NC}"
echo "  Storage:  $STORAGE_ACCOUNT"
echo "  SignalR:  $SIGNALR_SERVICE"
echo "  OpenAI:   $OPENAI_SERVICE"
echo ""
echo -e "${YELLOW}Press Ctrl+C in each terminal to stop services${NC}"
echo ""

