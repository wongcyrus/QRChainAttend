#!/bin/bash
# Start/Open Production Environment

set -e

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

echo -e "${BLUE}=========================================="
echo "QR Chain Attendance - Production"
echo -e "==========================================${NC}"
echo ""

# Production URLs
PROD_FRONTEND="https://ashy-desert-0fc9a700f.6.azurestaticapps.net"
PROD_BACKEND="https://func-qrattendance-prod.azurewebsites.net"
PROD_BACKEND_API="https://func-qrattendance-prod.azurewebsites.net/api"

# Azure Portal URLs
RESOURCE_GROUP="rg-qr-attendance-prod"
FUNCTION_APP="func-qrattendance-prod"
STATIC_WEB_APP="stapp-qrattendance-prod"
STORAGE_ACCOUNT="stqrattendanceprod"
SIGNALR_SERVICE="signalr-qrattendance-prod"
OPENAI_SERVICE="oai-qrattendance-prod"

PORTAL_BASE="https://portal.azure.com/#@8ff7db19-435d-4c3c-83d3-ca0a46234f51/resource"
RG_URL="https://portal.azure.com/#@8ff7db19-435d-4c3c-83d3-ca0a46234f51/resource/subscriptions/d1c39885-10e6-4db0-b06f-f0d8e9c2e5e0/resourceGroups/$RESOURCE_GROUP/overview"

echo -e "${CYAN}Production Environment URLs:${NC}"
echo ""
echo -e "${GREEN}Application:${NC}"
echo "  Frontend:     $PROD_FRONTEND"
echo "  Backend API:  $PROD_BACKEND_API"
echo "  Backend:      $PROD_BACKEND"
echo ""
echo -e "${GREEN}Azure Portal:${NC}"
echo "  Resource Group: $RG_URL"
echo ""

# Function to open URL based on OS
open_url() {
    local url=$1
    if command -v xdg-open &> /dev/null; then
        # Linux
        xdg-open "$url" 2>/dev/null
    elif command -v open &> /dev/null; then
        # macOS
        open "$url"
    elif command -v start &> /dev/null; then
        # Windows (Git Bash)
        start "$url"
    else
        echo "  Could not open browser automatically. Please open manually:"
        echo "  $url"
    fi
}

# Ask what to open
echo -e "${YELLOW}What would you like to open?${NC}"
echo ""
echo "  1) Frontend Application (User Interface)"
echo "  2) Backend API (Function App)"
echo "  3) Azure Portal - Resource Group"
echo "  4) All of the above"
echo "  5) Show monitoring/logs commands"
echo "  6) Exit"
echo ""
read -p "Enter choice [1-6]: " choice

case $choice in
    1)
        echo ""
        echo -e "${BLUE}Opening Frontend...${NC}"
        open_url "$PROD_FRONTEND"
        echo -e "${GREEN}✓ Frontend opened in browser${NC}"
        ;;
    2)
        echo ""
        echo -e "${BLUE}Opening Backend API...${NC}"
        open_url "$PROD_BACKEND"
        echo -e "${GREEN}✓ Backend opened in browser${NC}"
        ;;
    3)
        echo ""
        echo -e "${BLUE}Opening Azure Portal...${NC}"
        open_url "$RG_URL"
        echo -e "${GREEN}✓ Azure Portal opened in browser${NC}"
        ;;
    4)
        echo ""
        echo -e "${BLUE}Opening all URLs...${NC}"
        open_url "$PROD_FRONTEND"
        sleep 1
        open_url "$PROD_BACKEND"
        sleep 1
        open_url "$RG_URL"
        echo -e "${GREEN}✓ All URLs opened in browser${NC}"
        ;;
    5)
        echo ""
        echo -e "${CYAN}Monitoring & Logs Commands:${NC}"
        echo ""
        echo -e "${GREEN}Check Function App Status:${NC}"
        echo "  az functionapp show --name $FUNCTION_APP --resource-group $RESOURCE_GROUP --query state -o tsv"
        echo ""
        echo -e "${GREEN}Stream Function Logs:${NC}"
        echo "  az functionapp log tail --name $FUNCTION_APP --resource-group $RESOURCE_GROUP"
        echo ""
        echo -e "${GREEN}Check Static Web App Status:${NC}"
        echo "  az staticwebapp show --name $STATIC_WEB_APP --resource-group $RESOURCE_GROUP --query '{name:name,status:defaultHostname}' -o table"
        echo ""
        echo -e "${GREEN}List All Functions:${NC}"
        echo "  az functionapp function list --name $FUNCTION_APP --resource-group $RESOURCE_GROUP --query '[].{Name:name,Status:config.disabled}' -o table"
        echo ""
        echo -e "${GREEN}Check Database Tables:${NC}"
        echo "  az storage table list --account-name $STORAGE_ACCOUNT --query '[].name' -o table"
        echo ""
        echo -e "${GREEN}View Recent Deployments:${NC}"
        echo "  az deployment group list --resource-group $RESOURCE_GROUP --query '[0:5].{Name:name,State:properties.provisioningState,Timestamp:properties.timestamp}' -o table"
        echo ""
        echo -e "${GREEN}Check OpenAI Deployment:${NC}"
        echo "  az cognitiveservices account deployment list --name $OPENAI_SERVICE --resource-group $RESOURCE_GROUP -o table"
        echo ""
        ;;
    6)
        echo ""
        echo -e "${GREEN}Goodbye!${NC}"
        exit 0
        ;;
    *)
        echo ""
        echo -e "${YELLOW}Invalid choice. Exiting.${NC}"
        exit 1
        ;;
esac

echo ""
echo -e "${CYAN}Quick Access Commands:${NC}"
echo ""
echo -e "${GREEN}Redeploy Backend:${NC}"
echo "  ./deploy-full-production.sh"
echo ""
echo -e "${GREEN}View Logs:${NC}"
echo "  az functionapp log tail --name $FUNCTION_APP --resource-group $RESOURCE_GROUP"
echo ""
echo -e "${GREEN}Restart Function App:${NC}"
echo "  az functionapp restart --name $FUNCTION_APP --resource-group $RESOURCE_GROUP"
echo ""
echo -e "${GREEN}Check Health:${NC}"
echo "  curl $PROD_BACKEND_API/health"
echo ""

