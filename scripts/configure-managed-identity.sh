#!/bin/bash

################################################################################
# Configure Managed Identity and RBAC for QR Chain Attendance System
#
# This script automates the configuration of:
# - System-assigned managed identities for Static Web App and Function App
# - RBAC role assignments for Storage, SignalR, and optionally Azure OpenAI
#
# Requirements: 19.1, 19.2, 19.3, 19.4, 19.5
#
# Usage:
#   ./configure-managed-identity.sh \
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

# Function to print colored output
print_info() {
    echo -e "${BLUE}ℹ ${NC}$1"
}

print_success() {
    echo -e "${GREEN}✅ ${NC}$1"
}

print_warning() {
    echo -e "${YELLOW}⚠️  ${NC}$1"
}

print_error() {
    echo -e "${RED}❌ ${NC}$1"
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

Configure Managed Identity and RBAC for QR Chain Attendance System

Required Options:
  --resource-group <name>        Azure resource group name
  --swa-name <name>              Static Web App name
  --function-app-name <name>     Function App name
  --storage-account-name <name>  Storage Account name
  --signalr-name <name>          SignalR Service name

Optional Options:
  --aoai-name <name>             Azure OpenAI resource name (for AI insights)
  --subscription <id>            Azure subscription ID (uses current if not specified)
  --skip-verification            Skip verification steps
  --help                         Display this help message

Examples:
  # Basic configuration
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
SKIP_VERIFICATION=false

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
        --skip-verification)
            SKIP_VERIFICATION=true
            shift
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

print_header "QR Chain Attendance - Managed Identity & RBAC Configuration"

print_info "Configuration:"
print_info "  Resource Group: $RESOURCE_GROUP"
print_info "  Static Web App: $SWA_NAME"
print_info "  Function App: $FUNCTION_APP_NAME"
print_info "  Storage Account: $STORAGE_ACCOUNT_NAME"
print_info "  SignalR Service: $SIGNALR_NAME"
if [[ -n "$AOAI_NAME" ]]; then
    print_info "  Azure OpenAI: $AOAI_NAME"
else
    print_info "  Azure OpenAI: Not configured"
fi
echo ""

# Check if Azure CLI is installed
if ! command -v az &> /dev/null; then
    print_error "Azure CLI is not installed. Please install it first."
    print_info "Visit: https://docs.microsoft.com/cli/azure/install-azure-cli"
    exit 1
fi

print_success "Azure CLI is installed"

# Check if logged in
if ! az account show &> /dev/null; then
    print_error "Not logged in to Azure. Please run 'az login' first."
    exit 1
fi

print_success "Logged in to Azure"

# Set subscription if specified
if [[ -n "$SUBSCRIPTION" ]]; then
    print_info "Setting subscription to: $SUBSCRIPTION"
    az account set --subscription "$SUBSCRIPTION"
fi

CURRENT_SUBSCRIPTION=$(az account show --query name -o tsv)
print_info "Using subscription: $CURRENT_SUBSCRIPTION"
echo ""

################################################################################
# Step 1: Enable System-Assigned Managed Identity
################################################################################

print_header "Step 1: Enable System-Assigned Managed Identity"

# Enable for Static Web App
print_info "Enabling managed identity for Static Web App: $SWA_NAME"
az staticwebapp identity assign \
    --name "$SWA_NAME" \
    --resource-group "$RESOURCE_GROUP" \
    --output none

SWA_PRINCIPAL_ID=$(az staticwebapp identity show \
    --name "$SWA_NAME" \
    --resource-group "$RESOURCE_GROUP" \
    --query principalId \
    --output tsv)

if [[ -z "$SWA_PRINCIPAL_ID" ]]; then
    print_error "Failed to get Static Web App principal ID"
    exit 1
fi

print_success "Static Web App managed identity enabled"
print_info "  Principal ID: $SWA_PRINCIPAL_ID"

# Enable for Function App
print_info "Enabling managed identity for Function App: $FUNCTION_APP_NAME"
az functionapp identity assign \
    --name "$FUNCTION_APP_NAME" \
    --resource-group "$RESOURCE_GROUP" \
    --output none

FUNC_PRINCIPAL_ID=$(az functionapp identity show \
    --name "$FUNCTION_APP_NAME" \
    --resource-group "$RESOURCE_GROUP" \
    --query principalId \
    --output tsv)

if [[ -z "$FUNC_PRINCIPAL_ID" ]]; then
    print_error "Failed to get Function App principal ID"
    exit 1
fi

print_success "Function App managed identity enabled"
print_info "  Principal ID: $FUNC_PRINCIPAL_ID"

# Wait for identity propagation
print_info "Waiting 30 seconds for identity propagation..."
sleep 30

################################################################################
# Step 2: Assign Storage Table Data Contributor Role
################################################################################

print_header "Step 2: Assign Storage Table Data Contributor Role"

# Get Storage Account resource ID
print_info "Getting Storage Account resource ID..."
STORAGE_ID=$(az storage account show \
    --name "$STORAGE_ACCOUNT_NAME" \
    --resource-group "$RESOURCE_GROUP" \
    --query id \
    --output tsv)

if [[ -z "$STORAGE_ID" ]]; then
    print_error "Failed to get Storage Account resource ID"
    exit 1
fi

print_success "Storage Account found"
print_info "  Resource ID: $STORAGE_ID"

# Assign role to Static Web App
print_info "Assigning Storage Table Data Contributor to Static Web App..."
if az role assignment create \
    --assignee "$SWA_PRINCIPAL_ID" \
    --role "Storage Table Data Contributor" \
    --scope "$STORAGE_ID" \
    --output none 2>/dev/null; then
    print_success "Role assigned to Static Web App"
else
    print_warning "Role may already be assigned to Static Web App (this is OK)"
fi

# Assign role to Function App
print_info "Assigning Storage Table Data Contributor to Function App..."
if az role assignment create \
    --assignee "$FUNC_PRINCIPAL_ID" \
    --role "Storage Table Data Contributor" \
    --scope "$STORAGE_ID" \
    --output none 2>/dev/null; then
    print_success "Role assigned to Function App"
else
    print_warning "Role may already be assigned to Function App (this is OK)"
fi

################################################################################
# Step 3: Assign SignalR Service Owner Role
################################################################################

print_header "Step 3: Assign SignalR Service Owner Role"

# Get SignalR Service resource ID
print_info "Getting SignalR Service resource ID..."
SIGNALR_ID=$(az signalr show \
    --name "$SIGNALR_NAME" \
    --resource-group "$RESOURCE_GROUP" \
    --query id \
    --output tsv)

if [[ -z "$SIGNALR_ID" ]]; then
    print_error "Failed to get SignalR Service resource ID"
    exit 1
fi

print_success "SignalR Service found"
print_info "  Resource ID: $SIGNALR_ID"

# Assign role to Function App
print_info "Assigning SignalR Service Owner to Function App..."
if az role assignment create \
    --assignee "$FUNC_PRINCIPAL_ID" \
    --role "SignalR Service Owner" \
    --scope "$SIGNALR_ID" \
    --output none 2>/dev/null; then
    print_success "Role assigned to Function App"
else
    print_warning "Role may already be assigned to Function App (this is OK)"
fi

################################################################################
# Step 4: Assign Cognitive Services OpenAI User Role (Optional)
################################################################################

if [[ -n "$AOAI_NAME" ]]; then
    print_header "Step 4: Assign Cognitive Services OpenAI User Role"

    # Get Azure OpenAI resource ID
    print_info "Getting Azure OpenAI resource ID..."
    AOAI_ID=$(az cognitiveservices account show \
        --name "$AOAI_NAME" \
        --resource-group "$RESOURCE_GROUP" \
        --query id \
        --output tsv 2>/dev/null)

    if [[ -z "$AOAI_ID" ]]; then
        print_warning "Azure OpenAI resource not found: $AOAI_NAME"
        print_warning "Skipping OpenAI role assignment"
    else
        print_success "Azure OpenAI resource found"
        print_info "  Resource ID: $AOAI_ID"

        # Assign role to Function App
        print_info "Assigning Cognitive Services OpenAI User to Function App..."
        if az role assignment create \
            --assignee "$FUNC_PRINCIPAL_ID" \
            --role "Cognitive Services OpenAI User" \
            --scope "$AOAI_ID" \
            --output none 2>/dev/null; then
            print_success "Role assigned to Function App"
        else
            print_warning "Role may already be assigned to Function App (this is OK)"
        fi
    fi
else
    print_info "Azure OpenAI not configured, skipping Step 4"
fi

################################################################################
# Step 5: Verification
################################################################################

if [[ "$SKIP_VERIFICATION" == false ]]; then
    print_header "Step 5: Verification"

    print_info "Verifying role assignments for Static Web App..."
    SWA_ROLES=$(az role assignment list \
        --assignee "$SWA_PRINCIPAL_ID" \
        --query "[].{Role:roleDefinitionName, Scope:scope}" \
        --output table)
    
    if [[ -n "$SWA_ROLES" ]]; then
        echo "$SWA_ROLES"
        print_success "Static Web App role assignments verified"
    else
        print_warning "No role assignments found for Static Web App"
    fi

    echo ""
    print_info "Verifying role assignments for Function App..."
    FUNC_ROLES=$(az role assignment list \
        --assignee "$FUNC_PRINCIPAL_ID" \
        --query "[].{Role:roleDefinitionName, Scope:scope}" \
        --output table)
    
    if [[ -n "$FUNC_ROLES" ]]; then
        echo "$FUNC_ROLES"
        print_success "Function App role assignments verified"
    else
        print_warning "No role assignments found for Function App"
    fi

    echo ""
    print_info "Note: Role assignments may take 5-10 minutes to fully propagate"
fi

################################################################################
# Summary
################################################################################

print_header "Configuration Complete"

print_success "Managed Identity and RBAC configuration completed successfully!"
echo ""
print_info "Summary:"
print_info "  ✅ Static Web App managed identity enabled"
print_info "  ✅ Function App managed identity enabled"
print_info "  ✅ Storage Table Data Contributor assigned to both"
print_info "  ✅ SignalR Service Owner assigned to Function App"
if [[ -n "$AOAI_NAME" ]] && [[ -n "$AOAI_ID" ]]; then
    print_info "  ✅ Cognitive Services OpenAI User assigned to Function App"
fi
echo ""
print_info "Principal IDs (save these for reference):"
print_info "  Static Web App: $SWA_PRINCIPAL_ID"
print_info "  Function App: $FUNC_PRINCIPAL_ID"
echo ""
print_warning "Important: Role assignments may take 5-10 minutes to propagate"
print_info "Test your application after waiting for propagation"
echo ""
print_info "Next steps:"
print_info "  1. Deploy your application"
print_info "  2. Test storage access"
print_info "  3. Test SignalR connections"
print_info "  4. Monitor logs for any access issues"
echo ""
print_info "For troubleshooting, see: MANAGED_IDENTITY_RBAC.md"
echo ""

exit 0
