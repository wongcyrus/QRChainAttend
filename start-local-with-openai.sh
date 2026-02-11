#!/bin/bash
# Start local backend and frontend with LOCAL database but PRODUCTION OpenAI
# Perfect for testing Live Quiz feature without affecting production data

set -e

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${BLUE}=========================================="
echo "Local Dev with Production OpenAI"
echo -e "==========================================${NC}"
echo ""

# Production Azure OpenAI only
RESOURCE_GROUP="rg-qr-attendance-prod"
OPENAI_SERVICE="openai-qrattendance-prod"

echo -e "${YELLOW}This setup uses:${NC}"
echo "  ✅ Local database (Azurite)"
echo "  ✅ Local SignalR (or dev SignalR)"
echo "  ✅ Production Azure OpenAI (for Live Quiz)"
echo ""
echo -e "${YELLOW}Perfect for testing Live Quiz without affecting production data!${NC}"
echo ""
read -p "Continue? (y/n): " -n 1 -r
echo ""
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Aborted."
    exit 1
fi

echo ""
echo -e "${BLUE}Fetching production OpenAI configuration...${NC}"

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

echo -e "${GREEN}✓ OpenAI configuration fetched${NC}"
echo ""

# Backup existing local.settings.json if it exists
if [ -f "backend/local.settings.json" ]; then
    echo -e "${BLUE}Backing up existing local.settings.json...${NC}"
    cp backend/local.settings.json backend/local.settings.json.backup
    echo -e "${GREEN}✓ Backup created${NC}"
    echo ""
fi

# Create backend local.settings.json with Azurite + Production OpenAI
echo -e "${BLUE}Creating backend/local.settings.json...${NC}"
cat > backend/local.settings.json << EOF
{
  "IsEncrypted": false,
  "Values": {
    "AzureWebJobsStorage": "AccountName=devstoreaccount1;AccountKey=Eby8vdM02xNOcqFlqUwJPLlmEtlCDXJ1OUzFT50uSRZ6IFsuFq2UVErCz4I6tq/K1SZFPTOtr/KBHBeksoGMGw==;DefaultEndpointsProtocol=http;BlobEndpoint=http://127.0.0.1:10000/devstoreaccount1;QueueEndpoint=http://127.0.0.1:10001/devstoreaccount1;TableEndpoint=http://127.0.0.1:10002/devstoreaccount1;",
    "FUNCTIONS_WORKER_RUNTIME": "node",
    "STORAGE_ACCOUNT_NAME": "devstoreaccount1",
    "STORAGE_ACCOUNT_URI": "http://127.0.0.1:10002/devstoreaccount1",
    "SIGNALR_CONNECTION_STRING": "Endpoint=http://localhost;Port=8888;AccessKey=ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789;Version=1.0;",
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
    "CORS": "http://localhost:3000,http://localhost:3001,http://localhost:3002",
    "CORSCredentials": true
  }
}
EOF

echo -e "${GREEN}✓ Backend configured${NC}"
echo ""

# Create frontend .env.local
echo -e "${BLUE}Creating frontend/.env.local...${NC}"
cat > frontend/.env.local << EOF
# Local Frontend with Local Backend (Local DB + Production OpenAI)
NEXT_PUBLIC_API_URL=http://localhost:7071/api
NEXT_PUBLIC_SIGNALR_URL=http://localhost:7071/api

# Azure AD Configuration (Production)
NEXT_PUBLIC_AAD_CLIENT_ID=dc482c34-ebaa-4239-aca3-2810a4f51728
NEXT_PUBLIC_AAD_TENANT_ID=8ff7db19-435d-4c3c-83d3-ca0a46234f51
NEXT_PUBLIC_AAD_REDIRECT_URI=http://localhost:3000/.auth/login/aad/callback

# Environment indicator
NEXT_PUBLIC_ENVIRONMENT=local
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

# Check if Azurite is installed
if ! command -v azurite &> /dev/null; then
    echo -e "${YELLOW}⚠️  Azurite not found. Installing...${NC}"
    npm install -g azurite
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
        echo "Terminal 1 (Azurite):"
        echo "  azurite --silent --location ./azurite --skipApiVersionCheck"
        echo ""
        echo "Terminal 2 (Backend):"
        echo "  cd backend && npm start"
        echo ""
        echo "Terminal 3 (Frontend):"
        echo "  cd frontend && npm run dev"
        echo ""
        exit 0
    fi
}

echo -e "${BLUE}Starting services...${NC}"
echo ""

# Start Azurite
echo -e "${BLUE}Starting Azurite (Local Database)...${NC}"
open_terminal "Azurite - Local DB" "azurite --silent --location ./azurite --skipApiVersionCheck"
sleep 2

# Start backend
echo -e "${BLUE}Starting Backend (Azure Functions)...${NC}"
open_terminal "Backend - Local + OpenAI" "cd backend && npm start"
sleep 3

# Start frontend
echo -e "${BLUE}Starting Frontend (Next.js)...${NC}"
open_terminal "Frontend - Local" "cd frontend && npm run dev"
sleep 2

echo ""
echo -e "${GREEN}✅ Services starting...${NC}"
echo ""
echo -e "${BLUE}📍 URLs:${NC}"
echo "  Frontend: http://localhost:3000"
echo "  Backend:  http://localhost:7071/api"
echo "  Azurite:  http://127.0.0.1:10002"
echo ""
echo -e "${BLUE}Configuration:${NC}"
echo "  Database: Local (Azurite)"
echo "  SignalR:  Local"
echo "  OpenAI:   Production ($OPENAI_SERVICE)"
echo ""
echo -e "${GREEN}✅ Perfect for testing Live Quiz feature!${NC}"
echo ""
echo -e "${YELLOW}To restore previous config:${NC}"
echo "  mv backend/local.settings.json.backup backend/local.settings.json"
echo ""
echo -e "${YELLOW}Press Ctrl+C in each terminal to stop services${NC}"
echo ""

