#!/bin/bash

################################################################################
# Verify Managed Identity and RBAC Configuration
#
# This script verifies that managed identities and RBAC roles are correctly
# configured for the QR Chain Attendance System.
#
# Requirements: 19.1, 19.2, 19.3, 19.4, 19.5
#
# Usage:
#   ./verify-managed-identity.sh \
#     --resource-group <rg-name> \
#     --swa-name <swa-name> \
#     --function-app-name <func-name> \
#     --storage-account-name <storage-name> \
#     --signalr-name <signalr-name> \
#     [--aoai-name <aoai-name>]
#
################################################################################

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Counters
CHECKS_PASSED=0
CHECKS_FAILED=0
CHECKS_WARNING=0

# Function to print colored output
print_info() {
    echo -e "${BLUE}ℹ ${NC}$1"
}

print_success() {
    echo -e "${GREEN}✅ ${NC}$1"
    ((CHECKS_PASSED++))
}

print_warning() {
    echo -e "${YELLOW}⚠️  ${NC}$1"
    ((CHECKS_WARNING++))
}

print_error() {
    echo -e "${RED}❌ ${NC}$1"
    ((CHECKS_FAILED++))
}

print_header() {
    echo ""
    echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"
    echo -e "${BLUE}  $1${NC}"
    echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"
    echo ""
}

# Function to display usage
usage() {
    cat << EOF
Usage: $0 [OPTIONS]

Verify Managed Identity and RBAC configuration for QR Chain Attendance System

Required Options:
  --resource-group <name>        Azure resource group name
  --swa-name <name>              Static Web App name
  --function-app-name <name>     Function App name
  --storage-account-name <name>  Storage Account name
  --signalr-name <name>          SignalR Service name

Optional Options:
  --aoai-name <name>             Azure OpenAI resource name (for AI insights)
  --subscription <id>            Azure subscription ID (uses current if not specified)
  --help                         Display this help message

Examples:
  # Basic verification
  $0 --resource-group rg-qr-attendance \\
     --swa-name swa-qr-attendance \\
     --function-app-name func-qr-attendance \\
     --storage-account-name stqrattendance \\
     --signalr-name signalr-qr-attendance

  # With Azure OpenAI
  $0 --resource-group rg-qr-attendance \\
     --swa-name swa-qr-attendance \\
     --function-app-name func-qr-attendance \\
     --storage-account-name stqrattendance \\
     --signalr-name signalr-qr-attendance \\
     --aoai-name openai-qr-attendance

EOF
    exit 1
}

# Parse command line arguments
RESOURCE_GROUP=""
SWA_NAME=""
FUNCTION_APP_NAME=""
STORAGE_ACCOUNT_NAME=""
SIGNALR_NAME=""
AOAI_NAME=""
SUBSCRIPTION=""

while [[ $# -gt 0 ]]; do
    case $1 in
        --resource-group)
            RESOURCE_GROUP="$2"
            shift 2
            ;;
        --swa-name)
            SWA_NAME="$2"
            shift 2
            ;;
        --function-app-name)
            FUNCTION_APP_NAME="$2"
            shift 2
            ;;
        --storage-account-name)
            STORAGE_ACCOUNT_NAME="$2"
            shift 2
            ;;
        --signalr-name)
            SIGNALR_NAME="$2"
            shift 2
            ;;
        --aoai-name)
            AOAI_NAME="$2"
            shift 2
            ;;
        --subscription)
            SUBSCRIPTION="$2"
            shift 2
            ;;
        --help)
            usage
            ;;
        *)
            print_error "Unknown option: $1"
            usage
            ;;
    esac
done

# Validate required arguments
if [[ -z "$RESOURCE_GROUP" ]] || [[ -z "$SWA_NAME" ]] || [[ -z "$FUNCTION_APP_NAME" ]] || \
   [[ -z "$STORAGE_ACCOUNT_NAME" ]] || [[ -z "$SIGNALR_NAME" ]]; then
    print_error "Missing required arguments"
    usage
fi

print_header "QR Chain Attendance - Managed Identity & RBAC Verification"

print_info "Verifying configuration for:"
print_info "  Resource Group: $RESOURCE_GROUP"
print_info "  Static Web App: $SWA_NAME"
print_info "  Function App: $FUNCTION_APP_NAME"
print_info "  Storage Account: $STORAGE_ACCOUNT_NAME"
print_info "  SignalR Service: $SIGNALR_NAME"
if [[ -n "$AOAI_NAME" ]]; then
    print_info "  Azure OpenAI: $AOAI_NAME"
fi
echo ""

# Check if Azure CLI is installed
if ! command -v az &> /dev/null; then
    print_error "Azure CLI is not installed"
    exit 1
fi

# Check if logged in
if ! az account show &> /dev/null; then
    print_error "Not logged in to Azure"
    exit 1
fi

# Set subscription if specified
if [[ -n "$SUBSCRIPTION" ]]; then
    az account set --subscription "$SUBSCRIPTION"
fi

################################################################################
# Check 1: Verify Resources Exist
################################################################################

print_header "Check 1: Verify Resources Exist"

# Check Static Web App
print_info "Checking Static Web App..."
if az staticwebapp show --name "$SWA_NAME" --resource-group "$RESOURCE_GROUP" &> /dev/null; then
    print_success "Static Web App exists"
else
    print_error "Static Web App not found"
fi

# Check Function App
print_info "Checking Function App..."
if az functionapp show --name "$FUNCTION_APP_NAME" --resource-group "$RESOURCE_GROUP" &> /dev/null; then
    print_success "Function App exists"
else
    print_error "Function App not found"
fi

# Check Storage Account
print_info "Checking Storage Account..."
if az storage account show --name "$STORAGE_ACCOUNT_NAME" --resource-group "$RESOURCE_GROUP" &> /dev/null; then
    print_success "Storage Account exists"
else
    print_error "Storage Account not found"
fi

# Check SignalR Service
print_info "Checking SignalR Service..."
if az signalr show --name "$SIGNALR_NAME" --resource-group "$RESOURCE_GROUP" &> /dev/null; then
    print_success "SignalR Service exists"
else
    print_error "SignalR Service not found"
fi

# Check Azure OpenAI (optional)
if [[ -n "$AOAI_NAME" ]]; then
    print_info "Checking Azure OpenAI..."
    if az cognitiveservices account show --name "$AOAI_NAME" --resource-group "$RESOURCE_GROUP" &> /dev/null; then
        print_success "Azure OpenAI exists"
    else
        print_warning "Azure OpenAI not found (optional)"
    fi
fi

################################################################################
# Check 2: Verify Managed Identities are Enabled
################################################################################

print_header "Check 2: Verify Managed Identities are Enabled"

# Check Static Web App managed identity
print_info "Checking Static Web App managed identity..."
SWA_IDENTITY=$(az staticwebapp identity show \
    --name "$SWA_NAME" \
    --resource-group "$RESOURCE_GROUP" \
    --query "type" \
    --output tsv 2>/dev/null)

if [[ "$SWA_IDENTITY" == "SystemAssigned" ]]; then
    SWA_PRINCIPAL_ID=$(az staticwebapp identity show \
        --name "$SWA_NAME" \
        --resource-group "$RESOURCE_GROUP" \
        --query principalId \
        --output tsv)
    print_success "Static Web App managed identity enabled (Principal ID: $SWA_PRINCIPAL_ID)"
else
    print_error "Static Web App managed identity not enabled"
    SWA_PRINCIPAL_ID=""
fi

# Check Function App managed identity
print_info "Checking Function App managed identity..."
FUNC_IDENTITY=$(az functionapp identity show \
    --name "$FUNCTION_APP_NAME" \
    --resource-group "$RESOURCE_GROUP" \
    --query "type" \
    --output tsv 2>/dev/null)

if [[ "$FUNC_IDENTITY" == "SystemAssigned" ]]; then
    FUNC_PRINCIPAL_ID=$(az functionapp identity show \
        --name "$FUNCTION_APP_NAME" \
        --resource-group "$RESOURCE_GROUP" \
        --query principalId \
        --output tsv)
    print_success "Function App managed identity enabled (Principal ID: $FUNC_PRINCIPAL_ID)"
else
    print_error "Function App managed identity not enabled"
    FUNC_PRINCIPAL_ID=""
fi

################################################################################
# Check 3: Verify Storage Table Data Contributor Role
################################################################################

print_header "Check 3: Verify Storage Table Data Contributor Role"

if [[ -n "$SWA_PRINCIPAL_ID" ]] && [[ -n "$FUNC_PRINCIPAL_ID" ]]; then
    STORAGE_ID=$(az storage account show \
        --name "$STORAGE_ACCOUNT_NAME" \
        --resource-group "$RESOURCE_GROUP" \
        --query id \
        --output tsv)

    # Check Static Web App role
    print_info "Checking Storage role for Static Web App..."
    SWA_STORAGE_ROLE=$(az role assignment list \
        --assignee "$SWA_PRINCIPAL_ID" \
        --scope "$STORAGE_ID" \
        --query "[?roleDefinitionName=='Storage Table Data Contributor'].roleDefinitionName" \
        --output tsv)

    if [[ -n "$SWA_STORAGE_ROLE" ]]; then
        print_success "Storage Table Data Contributor assigned to Static Web App"
    else
        print_error "Storage Table Data Contributor NOT assigned to Static Web App"
    fi

    # Check Function App role
    print_info "Checking Storage role for Function App..."
    FUNC_STORAGE_ROLE=$(az role assignment list \
        --assignee "$FUNC_PRINCIPAL_ID" \
        --scope "$STORAGE_ID" \
        --query "[?roleDefinitionName=='Storage Table Data Contributor'].roleDefinitionName" \
        --output tsv)

    if [[ -n "$FUNC_STORAGE_ROLE" ]]; then
        print_success "Storage Table Data Contributor assigned to Function App"
    else
        print_error "Storage Table Data Contributor NOT assigned to Function App"
    fi
else
    print_warning "Skipping storage role check (managed identities not enabled)"
fi

################################################################################
# Check 4: Verify SignalR Service Owner Role
################################################################################

print_header "Check 4: Verify SignalR Service Owner Role"

if [[ -n "$FUNC_PRINCIPAL_ID" ]]; then
    SIGNALR_ID=$(az signalr show \
        --name "$SIGNALR_NAME" \
        --resource-group "$RESOURCE_GROUP" \
        --query id \
        --output tsv)

    print_info "Checking SignalR role for Function App..."
    FUNC_SIGNALR_ROLE=$(az role assignment list \
        --assignee "$FUNC_PRINCIPAL_ID" \
        --scope "$SIGNALR_ID" \
        --query "[?roleDefinitionName=='SignalR Service Owner'].roleDefinitionName" \
        --output tsv)

    if [[ -n "$FUNC_SIGNALR_ROLE" ]]; then
        print_success "SignalR Service Owner assigned to Function App"
    else
        print_error "SignalR Service Owner NOT assigned to Function App"
    fi
else
    print_warning "Skipping SignalR role check (Function App managed identity not enabled)"
fi

################################################################################
# Check 5: Verify Cognitive Services OpenAI User Role (Optional)
################################################################################

if [[ -n "$AOAI_NAME" ]]; then
    print_header "Check 5: Verify Cognitive Services OpenAI User Role"

    if [[ -n "$FUNC_PRINCIPAL_ID" ]]; then
        AOAI_ID=$(az cognitiveservices account show \
            --name "$AOAI_NAME" \
            --resource-group "$RESOURCE_GROUP" \
            --query id \
            --output tsv 2>/dev/null)

        if [[ -n "$AOAI_ID" ]]; then
            print_info "Checking OpenAI role for Function App..."
            FUNC_AOAI_ROLE=$(az role assignment list \
                --assignee "$FUNC_PRINCIPAL_ID" \
                --scope "$AOAI_ID" \
                --query "[?roleDefinitionName=='Cognitive Services OpenAI User'].roleDefinitionName" \
                --output tsv)

            if [[ -n "$FUNC_AOAI_ROLE" ]]; then
                print_success "Cognitive Services OpenAI User assigned to Function App"
            else
                print_warning "Cognitive Services OpenAI User NOT assigned to Function App"
            fi
        else
            print_warning "Azure OpenAI resource not found, skipping role check"
        fi
    else
        print_warning "Skipping OpenAI role check (Function App managed identity not enabled)"
    fi
fi

################################################################################
# Check 6: List All Role Assignments
################################################################################

print_header "Check 6: All Role Assignments"

if [[ -n "$SWA_PRINCIPAL_ID" ]]; then
    echo ""
    print_info "Static Web App Role Assignments:"
    az role assignment list \
        --assignee "$SWA_PRINCIPAL_ID" \
        --query "[].{Role:roleDefinitionName, Scope:scope}" \
        --output table
fi

if [[ -n "$FUNC_PRINCIPAL_ID" ]]; then
    echo ""
    print_info "Function App Role Assignments:"
    az role assignment list \
        --assignee "$FUNC_PRINCIPAL_ID" \
        --query "[].{Role:roleDefinitionName, Scope:scope}" \
        --output table
fi

################################################################################
# Summary
################################################################################

print_header "Verification Summary"

TOTAL_CHECKS=$((CHECKS_PASSED + CHECKS_FAILED + CHECKS_WARNING))

echo ""
print_info "Results:"
echo -e "  ${GREEN}✅ Passed: $CHECKS_PASSED${NC}"
echo -e "  ${RED}❌ Failed: $CHECKS_FAILED${NC}"
echo -e "  ${YELLOW}⚠️  Warnings: $CHECKS_WARNING${NC}"
echo -e "  ${BLUE}📊 Total: $TOTAL_CHECKS${NC}"
echo ""

if [[ $CHECKS_FAILED -eq 0 ]]; then
    print_success "All critical checks passed!"
    echo ""
    print_info "Your managed identity and RBAC configuration is correct."
    print_info "You can proceed with deploying your application."
    echo ""
    exit 0
else
    print_error "Some checks failed!"
    echo ""
    print_info "Please review the errors above and run the configuration script:"
    print_info "  ./scripts/configure-managed-identity.sh \\"
    print_info "    --resource-group $RESOURCE_GROUP \\"
    print_info "    --swa-name $SWA_NAME \\"
    print_info "    --function-app-name $FUNCTION_APP_NAME \\"
    print_info "    --storage-account-name $STORAGE_ACCOUNT_NAME \\"
    print_info "    --signalr-name $SIGNALR_NAME"
    if [[ -n "$AOAI_NAME" ]]; then
        print_info "    --aoai-name $AOAI_NAME"
    fi
    echo ""
    print_info "For troubleshooting, see: MANAGED_IDENTITY_RBAC.md"
    echo ""
    exit 1
fi
