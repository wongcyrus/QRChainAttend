#!/bin/bash
# Redeploy Development Environment
# Undeploys existing development environment and deploys a fresh one

set -e

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}=========================================="
echo "QR Chain Attendance - Development Environment Redeploy"
echo -e "==========================================${NC}"
echo ""

echo -e "${YELLOW}This will:${NC}"
echo "  1. Completely remove existing development environment"
echo "  2. Deploy a fresh development environment"
echo "  3. Initialize all resources from scratch"
echo ""

# Step 1: Undeploy existing environment
echo -e "${BLUE}Step 1: Undeploying existing development environment...${NC}"
echo ""

# Run undeploy script with auto-confirmation
echo "DELETE" | ./undeploy-development.sh

echo ""
echo -e "${GREEN}✓ Development environment cleanup complete${NC}"
echo ""

# Wait a moment for Azure to process deletions
echo -e "${YELLOW}Waiting 10 seconds for Azure cleanup to complete...${NC}"
sleep 10

# Step 2: Deploy fresh environment  
echo -e "${BLUE}Step 2: Deploying fresh development environment...${NC}"
echo ""

# Run the full development deployment
./deploy-full-development.sh

echo ""
echo -e "${BLUE}=========================================="
echo "Development Environment Redeploy Complete!"
echo -e "==========================================${NC}"
echo ""

# Show final deployment info
if [ -f "deployment-info.json" ]; then
    FRONTEND_URL=$(jq -r '.urls.frontend // ""' deployment-info.json)
    BACKEND_URL=$(jq -r '.urls.backend // ""' deployment-info.json)
    
    echo -e "${GREEN}Fresh Development Environment Ready:${NC}"
    echo "  Frontend: $FRONTEND_URL"
    echo "  Backend:  $BACKEND_URL"
    echo ""
    echo -e "${YELLOW}Next steps:${NC}"
    echo "  1. ./setup-local-dev-env.sh  # Configure local development"
    echo "  2. ./start-local-dev.sh      # Start local servers"
    echo "  3. Visit: $FRONTEND_URL      # Test deployment"
    echo ""
else
    echo -e "${YELLOW}⚠ deployment-info.json not found - check deployment status${NC}"
fi

echo -e "${GREEN}✓ Development environment redeploy successful!${NC}"
echo ""