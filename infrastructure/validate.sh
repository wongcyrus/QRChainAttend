#!/bin/bash
# Validate Bicep templates before deployment

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo -e "${CYAN}========================================${NC}"
echo -e "${CYAN}Validating Bicep Templates${NC}"
echo -e "${CYAN}========================================${NC}"
echo ""

# Check if Azure CLI is installed
if ! command -v az &> /dev/null; then
    echo -e "${RED}Error: Azure CLI is not installed${NC}"
    echo "Please install it from https://aka.ms/azure-cli"
    exit 1
fi

echo -e "${GREEN}✓ Azure CLI is installed${NC}"

# Check Bicep version
BICEP_VERSION=$(az bicep version 2>&1 | grep -oP 'Bicep CLI version \K[0-9.]+' || echo "unknown")
echo -e "${GREEN}✓ Bicep CLI version: $BICEP_VERSION${NC}"
echo ""

# Validate main template
echo -e "${CYAN}Validating main.bicep...${NC}"
if az bicep build --file "$SCRIPT_DIR/main.bicep" --stdout > /dev/null 2>&1; then
    echo -e "${GREEN}✓ main.bicep is valid${NC}"
else
    echo -e "${RED}✗ main.bicep has errors${NC}"
    az bicep build --file "$SCRIPT_DIR/main.bicep"
    exit 1
fi

# Validate modules
echo ""
echo -e "${CYAN}Validating modules...${NC}"

MODULES=(
    "storage.bicep"
    "signalr.bicep"
    "functions.bicep"
    "staticwebapp.bicep"
    "appinsights.bicep"
    "openai.bicep"
    "rbac.bicep"
)

for module in "${MODULES[@]}"; do
    MODULE_PATH="$SCRIPT_DIR/modules/$module"
    if [ -f "$MODULE_PATH" ]; then
        if az bicep build --file "$MODULE_PATH" --stdout > /dev/null 2>&1; then
            echo -e "${GREEN}✓ $module is valid${NC}"
        else
            echo -e "${RED}✗ $module has errors${NC}"
            az bicep build --file "$MODULE_PATH"
            exit 1
        fi
    else
        echo -e "${RED}✗ $module not found${NC}"
        exit 1
    fi
done

# Validate parameter files
echo ""
echo -e "${CYAN}Validating parameter files...${NC}"

PARAM_FILES=(
    "dev.bicepparam"
    "staging.bicepparam"
    "prod.bicepparam"
)

for param_file in "${PARAM_FILES[@]}"; do
    PARAM_PATH="$SCRIPT_DIR/parameters/$param_file"
    if [ -f "$PARAM_PATH" ]; then
        echo -e "${GREEN}✓ $param_file exists${NC}"
    else
        echo -e "${RED}✗ $param_file not found${NC}"
        exit 1
    fi
done

# Check for common issues
echo ""
echo -e "${CYAN}Checking for common issues...${NC}"

# Check for hardcoded values
if grep -r "password\|secret\|key" "$SCRIPT_DIR"/*.bicep "$SCRIPT_DIR"/modules/*.bicep | grep -v "@secure" | grep -v "// " | grep -v "description" | grep -v "param" | grep -v "output"; then
    echo -e "${YELLOW}⚠ Warning: Found potential hardcoded secrets${NC}"
else
    echo -e "${GREEN}✓ No hardcoded secrets found${NC}"
fi

# Check for @secure decorator on sensitive parameters
if grep -r "param.*Secret\|param.*Password\|param.*Key" "$SCRIPT_DIR"/*.bicep "$SCRIPT_DIR"/modules/*.bicep | grep -v "@secure"; then
    echo -e "${YELLOW}⚠ Warning: Found sensitive parameters without @secure decorator${NC}"
else
    echo -e "${GREEN}✓ All sensitive parameters are marked @secure${NC}"
fi

# Summary
echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}Validation Successful!${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo -e "All Bicep templates are valid and ready for deployment."
echo -e "Run ${CYAN}./infrastructure/deploy.sh${NC} to deploy the infrastructure."
echo ""
