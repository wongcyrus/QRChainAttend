#!/bin/bash

# ============================================================================
# QR Chain Attendance - Production Deployment Script
# ============================================================================
# This script deploys both backend and frontend to Azure production
# All values are hardcoded for reliability
# ============================================================================

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

# ============================================================================
# HARDCODED CONFIGURATION (Update these values as needed)
# ============================================================================

# Azure Resources
RESOURCE_GROUP="rg-qr-attendance-dev"
FUNCTION_APP_NAME="func-qrattendance-dev"
STATIC_WEB_APP_NAME="swa-qrattendance-dev2"
STORAGE_ACCOUNT_NAME="stqrattendancedev"

# Static Web App Deployment Token (Get from: az staticwebapp secrets list)
SWA_DEPLOYMENT_TOKEN="61c2f660e3ea5834155969e116766737bdc24fcc10f6ab6b96ebab39f20390ef04-5186aca9-76f1-482d-bf64-7298c1c482ad00f10150f8bc910f"

# URLs
FUNCTION_APP_URL="https://func-qrattendance-dev.azurewebsites.net"
STATIC_WEB_APP_URL="https://red-grass-0f8bc910f.4.azurestaticapps.net"

# ============================================================================
# FUNCTIONS
# ============================================================================

print_header() {
    echo ""
    echo -e "${CYAN}========================================${NC}"
    echo -e "${CYAN}$1${NC}"
    echo -e "${CYAN}========================================${NC}"
    echo ""
}

print_success() {
    echo -e "${GREEN}✓ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠ $1${NC}"
}

print_error() {
    echo -e "${RED}✗ $1${NC}"
}

check_command() {
    if ! command -v $1 &> /dev/null; then
        print_error "$1 is not installed"
        exit 1
    fi
}

# ============================================================================
# PRE-FLIGHT CHECKS
# ============================================================================

print_header "Pre-Flight Checks"

# Check required commands
check_command "az"
check_command "node"
check_command "npm"
check_command "func"
check_command "swa"

print_success "All required commands are available"

# Check Azure login
if ! az account show &> /dev/null; then
    print_error "Not logged in to Azure"
    echo "Please run: az login"
    exit 1
fi

ACCOUNT_NAME=$(az account show --query 'user.name' -o tsv)
SUBSCRIPTION_NAME=$(az account show --query 'name' -o tsv)
print_success "Logged in as: $ACCOUNT_NAME"
print_success "Subscription: $SUBSCRIPTION_NAME"

# ============================================================================
# STEP 1: DEPLOY BACKEND
# ============================================================================

print_header "Step 1: Deploy Backend Functions"

cd backend

# Check if QR_ENCRYPTION_KEY is set
echo "Checking QR_ENCRYPTION_KEY..."
CURRENT_KEY=$(az functionapp config appsettings list \
  --name "$FUNCTION_APP_NAME" \
  --resource-group "$RESOURCE_GROUP" \
  --query "[?name=='QR_ENCRYPTION_KEY'].value" -o tsv 2>/dev/null || echo "")

if [ -z "$CURRENT_KEY" ]; then
    print_warning "QR_ENCRYPTION_KEY not set. Generating..."
    NEW_KEY=$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")
    
    az functionapp config appsettings set \
      --name "$FUNCTION_APP_NAME" \
      --resource-group "$RESOURCE_GROUP" \
      --settings QR_ENCRYPTION_KEY="$NEW_KEY" \
      --output none
    
    print_success "QR_ENCRYPTION_KEY set"
else
    print_success "QR_ENCRYPTION_KEY already exists"
fi

# Build backend
echo ""
echo "Building backend..."
npm run build

if [ $? -ne 0 ]; then
    print_error "Backend build failed"
    exit 1
fi

FUNCTION_COUNT=$(ls -1 src/functions/*.ts 2>/dev/null | wc -l)
COMPILED_COUNT=$(ls -1 dist/src/functions/*.js 2>/dev/null | wc -l)
print_success "Functions: $FUNCTION_COUNT source, $COMPILED_COUNT compiled"

# Deploy backend
echo ""
echo "Deploying to Azure Functions..."
func azure functionapp publish "$FUNCTION_APP_NAME" --force

if [ $? -ne 0 ]; then
    print_error "Backend deployment failed"
    exit 1
fi

print_success "Backend deployed successfully"
echo ""
echo "Backend URL: $FUNCTION_APP_URL"

cd ..

# ============================================================================
# STEP 2: DEPLOY FRONTEND
# ============================================================================

print_header "Step 2: Deploy Frontend"

cd frontend

# Backup .env.local if it exists
if [ -f ".env.local" ]; then
    print_warning "Backing up .env.local for production build"
    mv .env.local .env.local.backup
fi

# Build frontend for production
echo ""
echo "Building frontend for production..."
NODE_ENV=production npm run build

if [ $? -ne 0 ]; then
    print_error "Frontend build failed"
    
    # Restore .env.local
    if [ -f ".env.local.backup" ]; then
        mv .env.local.backup .env.local
    fi
    
    exit 1
fi

print_success "Frontend built successfully"

# Restore .env.local
if [ -f ".env.local.backup" ]; then
    mv .env.local.backup .env.local
    print_success "Restored .env.local"
fi

# Deploy to Static Web App
echo ""
echo "Deploying to Azure Static Web Apps..."
swa deploy ./out \
    --deployment-token "$SWA_DEPLOYMENT_TOKEN" \
    --env production

if [ $? -ne 0 ]; then
    print_error "Frontend deployment failed"
    exit 1
fi

print_success "Frontend deployed successfully"
echo ""
echo "Frontend URL: $STATIC_WEB_APP_URL"

cd ..

# ============================================================================
# STEP 3: VERIFY DEPLOYMENT
# ============================================================================

print_header "Step 3: Verify Deployment"

# Check Function App status
echo "Checking Function App status..."
FUNC_STATE=$(az functionapp show \
    --name "$FUNCTION_APP_NAME" \
    --resource-group "$RESOURCE_GROUP" \
    --query "state" -o tsv 2>/dev/null || echo "Unknown")

if [ "$FUNC_STATE" = "Running" ]; then
    print_success "Function App is running"
else
    print_warning "Function App state: $FUNC_STATE"
fi

# Check Static Web App status
echo "Checking Static Web App status..."
SWA_STATUS=$(az staticwebapp show \
    --name "$STATIC_WEB_APP_NAME" \
    --resource-group "$RESOURCE_GROUP" \
    --query "status" -o tsv 2>/dev/null || echo "Unknown")

if [ "$SWA_STATUS" = "Ready" ]; then
    print_success "Static Web App is ready"
else
    print_warning "Static Web App status: $SWA_STATUS"
fi

# List deployed functions
echo ""
echo "Deployed Functions:"
func azure functionapp list-functions "$FUNCTION_APP_NAME" 2>/dev/null | grep -E "^\s+\w+" | head -10
TOTAL_FUNCTIONS=$(func azure functionapp list-functions "$FUNCTION_APP_NAME" 2>/dev/null | grep -E "^\s+\w+" | wc -l)
echo "... and $((TOTAL_FUNCTIONS - 10)) more functions"

# ============================================================================
# DEPLOYMENT SUMMARY
# ============================================================================

print_header "Deployment Complete!"

echo -e "${GREEN}Backend:${NC}"
echo "  URL: $FUNCTION_APP_URL"
echo "  Status: $FUNC_STATE"
echo "  Functions: $TOTAL_FUNCTIONS"
echo ""

echo -e "${GREEN}Frontend:${NC}"
echo "  URL: $STATIC_WEB_APP_URL"
echo "  Status: $SWA_STATUS"
echo ""

echo -e "${YELLOW}Next Steps:${NC}"
echo "  1. Visit: $STATIC_WEB_APP_URL"
echo "  2. Login with Azure AD"
echo "  3. Test Entry/Exit QR codes"
echo "  4. Monitor Application Insights"
echo ""

echo -e "${CYAN}Deployment completed at: $(date)${NC}"
echo ""

# ============================================================================
# DEPLOYMENT LOG
# ============================================================================

# Save deployment info
DEPLOY_LOG="deployment-$(date +%Y%m%d-%H%M%S).log"
cat > "$DEPLOY_LOG" << EOF
Deployment Log
==============
Date: $(date)
User: $ACCOUNT_NAME
Subscription: $SUBSCRIPTION_NAME

Backend:
  Function App: $FUNCTION_APP_NAME
  URL: $FUNCTION_APP_URL
  Status: $FUNC_STATE
  Functions: $TOTAL_FUNCTIONS

Frontend:
  Static Web App: $STATIC_WEB_APP_NAME
  URL: $STATIC_WEB_APP_URL
  Status: $SWA_STATUS

Configuration:
  Resource Group: $RESOURCE_GROUP
  Storage Account: $STORAGE_ACCOUNT_NAME
  QR Encryption Key: Set
EOF

print_success "Deployment log saved to: $DEPLOY_LOG"
echo ""
