#!/bin/bash
# Start local frontend connected to production backend

set -e

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}=========================================="
echo "Local Dev with Production Backend"
echo -e "==========================================${NC}"
echo ""

# Production backend URLs
PROD_API="https://func-qrattendance-prod.azurewebsites.net/api"
PROD_SIGNALR="https://func-qrattendance-prod.azurewebsites.net/api"

# Create local environment file
echo -e "${BLUE}Creating local environment configuration...${NC}"
cat > frontend/.env.local << EOF
# Local Development with Production Backend
NEXT_PUBLIC_API_URL=$PROD_API
NEXT_PUBLIC_SIGNALR_URL=$PROD_SIGNALR

# Azure AD Configuration
NEXT_PUBLIC_AAD_CLIENT_ID=dc482c34-ebaa-4239-aca3-2810a4f51728
NEXT_PUBLIC_AAD_TENANT_ID=8ff7db19-435d-4c3c-83d3-ca0a46234f51
NEXT_PUBLIC_AAD_REDIRECT_URI=http://localhost:3002/.auth/login/aad/callback

# Environment indicator
NEXT_PUBLIC_ENVIRONMENT=local-with-prod
EOF

echo -e "${GREEN}✓ Environment configured${NC}"
echo ""

# Check if node_modules exists
if [ ! -d "frontend/node_modules" ]; then
    echo -e "${BLUE}Installing frontend dependencies...${NC}"
    cd frontend
    npm install
    cd ..
    echo -e "${GREEN}✓ Dependencies installed${NC}"
    echo ""
fi

# Start frontend
echo -e "${BLUE}Starting frontend on http://localhost:3002${NC}"
echo ""
echo -e "${YELLOW}Configuration:${NC}"
echo "  Frontend: http://localhost:3002"
echo "  Backend:  $PROD_API"
echo "  SignalR:  $PROD_SIGNALR"
echo ""
echo -e "${YELLOW}Note: Using PRODUCTION backend and database!${NC}"
echo ""
echo "Press Ctrl+C to stop"
echo ""

cd frontend
PORT=3002 npm run dev
