#!/bin/bash

###############################################################################
# Setup CI/CD Credentials for GitHub Actions
# 
# This script creates an Azure Service Principal with minimal permissions
# required for deploying infrastructure and applications via GitHub Actions.
#
# Prerequisites:
# - Azure CLI installed and logged in (az login)
# - Owner or User Access Administrator role on the subscription
# - GitHub CLI installed (gh) - optional, for automatic secret setup
#
# Usage:
#   ./setup-cicd-credentials.sh <subscription-id> <resource-group-name> [github-repo]
#
# Example:
#   ./setup-cicd-credentials.sh "12345678-1234-1234-1234-123456789012" "rg-qr-attendance" "wongcyrus/QRChainAttend"
###############################################################################

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_info() {
    echo -e "${BLUE}ℹ ${1}${NC}"
}

print_success() {
    echo -e "${GREEN}✓ ${1}${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠ ${1}${NC}"
}

print_error() {
    echo -e "${RED}✗ ${1}${NC}"
}

# Check arguments
if [ $# -lt 2 ]; then
    print_error "Usage: $0 <subscription-id> <resource-group-name> [github-repo]"
    echo ""
    echo "Arguments:"
    echo "  subscription-id     : Azure subscription ID"
    echo "  resource-group-name : Resource group name for the application"
    echo "  github-repo         : GitHub repository (owner/repo) - optional"
    echo ""
    echo "Example:"
    echo "  $0 12345678-1234-1234-1234-123456789012 rg-qr-attendance wongcyrus/QRChainAttend"
    exit 1
fi

SUBSCRIPTION_ID="$1"
RESOURCE_GROUP="$2"
GITHUB_REPO="${3:-}"
APP_NAME="qr-attendance-cicd"
SP_NAME="sp-${APP_NAME}"

print_info "Starting CI/CD credentials setup..."
echo ""

# Verify Azure CLI is installed
if ! command -v az &> /dev/null; then
    print_error "Azure CLI is not installed. Please install it first."
    echo "Visit: https://docs.microsoft.com/en-us/cli/azure/install-azure-cli"
    exit 1
fi

# Verify logged in to Azure
print_info "Checking Azure login status..."
if ! az account show &> /dev/null; then
    print_error "Not logged in to Azure. Please run 'az login' first."
    exit 1
fi

# Set subscription
print_info "Setting subscription to: ${SUBSCRIPTION_ID}"
az account set --subscription "${SUBSCRIPTION_ID}"
print_success "Subscription set"

# Get subscription details
SUBSCRIPTION_NAME=$(az account show --query name -o tsv)
TENANT_ID=$(az account show --query tenantId -o tsv)

echo ""
print_info "Subscription: ${SUBSCRIPTION_NAME}"
print_info "Subscription ID: ${SUBSCRIPTION_ID}"
print_info "Tenant ID: ${TENANT_ID}"
print_info "Resource Group: ${RESOURCE_GROUP}"
echo ""

# Check if resource group exists
print_info "Checking if resource group exists..."
if ! az group show --name "${RESOURCE_GROUP}" &> /dev/null; then
    print_warning "Resource group '${RESOURCE_GROUP}' does not exist."
    read -p "Do you want to create it? (y/n) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        read -p "Enter location (e.g., eastus, westeurope): " LOCATION
        az group create --name "${RESOURCE_GROUP}" --location "${LOCATION}"
        print_success "Resource group created"
    else
        print_error "Resource group is required. Exiting."
        exit 1
    fi
else
    print_success "Resource group exists"
fi

# Get resource group ID
RG_ID=$(az group show --name "${RESOURCE_GROUP}" --query id -o tsv)

# Check if service principal already exists
print_info "Checking if service principal '${SP_NAME}' already exists..."
EXISTING_SP=$(az ad sp list --display-name "${SP_NAME}" --query "[0].appId" -o tsv)

if [ -n "${EXISTING_SP}" ]; then
    print_warning "Service principal '${SP_NAME}' already exists (App ID: ${EXISTING_SP})"
    read -p "Do you want to delete and recreate it? (y/n) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        print_info "Deleting existing service principal..."
        az ad sp delete --id "${EXISTING_SP}"
        print_success "Deleted existing service principal"
        sleep 5  # Wait for deletion to propagate
    else
        print_info "Using existing service principal"
        CLIENT_ID="${EXISTING_SP}"
        
        # Reset credentials
        print_info "Resetting credentials for existing service principal..."
        CREDENTIALS=$(az ad sp credential reset --id "${CLIENT_ID}" --query "{clientId:appId, clientSecret:password, tenantId:tenant}" -o json)
    fi
fi

# Create service principal if it doesn't exist or was deleted
if [ -z "${CREDENTIALS}" ]; then
    print_info "Creating service principal '${SP_NAME}'..."
    
    # Create service principal with Contributor role scoped to resource group
    CREDENTIALS=$(az ad sp create-for-rbac \
        --name "${SP_NAME}" \
        --role Contributor \
        --scopes "${RG_ID}" \
        --query "{clientId:appId, clientSecret:password, tenantId:tenant, subscriptionId:'${SUBSCRIPTION_ID}'}" \
        -o json)
    
    print_success "Service principal created"
fi

# Extract credentials
CLIENT_ID=$(echo "${CREDENTIALS}" | jq -r '.clientId')
CLIENT_SECRET=$(echo "${CREDENTIALS}" | jq -r '.clientSecret')
TENANT_ID=$(echo "${CREDENTIALS}" | jq -r '.tenantId')

print_success "Service principal configured with Contributor role on resource group"
echo ""

# Wait for service principal to propagate
print_info "Waiting for service principal to propagate (30 seconds)..."
sleep 30

# Assign additional required roles
print_info "Assigning additional required roles..."

# User Access Administrator role (for managed identity assignments)
print_info "Assigning 'User Access Administrator' role..."
az role assignment create \
    --assignee "${CLIENT_ID}" \
    --role "User Access Administrator" \
    --scope "${RG_ID}" \
    --output none || print_warning "Role may already be assigned"

print_success "Additional roles assigned"
echo ""

# Create credentials JSON for GitHub Actions
AZURE_CREDENTIALS=$(jq -n \
    --arg clientId "${CLIENT_ID}" \
    --arg clientSecret "${CLIENT_SECRET}" \
    --arg subscriptionId "${SUBSCRIPTION_ID}" \
    --arg tenantId "${TENANT_ID}" \
    '{
        clientId: $clientId,
        clientSecret: $clientSecret,
        subscriptionId: $subscriptionId,
        tenantId: $tenantId
    }')

# Save credentials to file
CREDENTIALS_FILE="azure-cicd-credentials.json"
echo "${AZURE_CREDENTIALS}" > "${CREDENTIALS_FILE}"
chmod 600 "${CREDENTIALS_FILE}"

print_success "Credentials saved to: ${CREDENTIALS_FILE}"
echo ""

# Display credentials
print_info "=== GitHub Secrets Configuration ==="
echo ""
echo "Add these secrets to your GitHub repository:"
echo ""
echo "Secret Name: AZURE_CREDENTIALS"
echo "Secret Value:"
echo "${AZURE_CREDENTIALS}"
echo ""
echo "Secret Name: AZURE_CLIENT_ID"
echo "Secret Value: ${CLIENT_ID}"
echo ""
echo "Secret Name: AZURE_TENANT_ID"
echo "Secret Value: ${TENANT_ID}"
echo ""
echo "Secret Name: AZURE_SUBSCRIPTION_ID"
echo "Secret Value: ${SUBSCRIPTION_ID}"
echo ""

# Optionally set GitHub secrets automatically
if [ -n "${GITHUB_REPO}" ]; then
    if command -v gh &> /dev/null; then
        print_info "GitHub CLI detected. Do you want to automatically set the secrets?"
        read -p "Set secrets automatically? (y/n) " -n 1 -r
        echo
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            print_info "Setting GitHub secrets..."
            
            echo "${AZURE_CREDENTIALS}" | gh secret set AZURE_CREDENTIALS --repo "${GITHUB_REPO}"
            echo "${CLIENT_ID}" | gh secret set AZURE_CLIENT_ID --repo "${GITHUB_REPO}"
            echo "${TENANT_ID}" | gh secret set AZURE_TENANT_ID --repo "${GITHUB_REPO}"
            echo "${SUBSCRIPTION_ID}" | gh secret set AZURE_SUBSCRIPTION_ID --repo "${GITHUB_REPO}"
            
            print_success "GitHub secrets set successfully"
        fi
    else
        print_warning "GitHub CLI not installed. Please set secrets manually."
        echo "Install GitHub CLI: https://cli.github.com/"
    fi
fi

echo ""
print_info "=== Manual Setup Instructions ==="
echo ""
echo "1. Go to your GitHub repository: https://github.com/${GITHUB_REPO:-YOUR_REPO}/settings/secrets/actions"
echo "2. Click 'New repository secret'"
echo "3. Add each secret listed above"
echo ""

print_info "=== Service Principal Details ==="
echo ""
echo "Service Principal Name: ${SP_NAME}"
echo "Application (Client) ID: ${CLIENT_ID}"
echo "Tenant ID: ${TENANT_ID}"
echo "Subscription ID: ${SUBSCRIPTION_ID}"
echo "Resource Group: ${RESOURCE_GROUP}"
echo ""
echo "Assigned Roles:"
echo "  - Contributor (scope: ${RESOURCE_GROUP})"
echo "  - User Access Administrator (scope: ${RESOURCE_GROUP})"
echo ""

print_info "=== Security Notes ==="
echo ""
echo "1. The service principal has minimal permissions scoped to the resource group"
echo "2. Store the credentials file (${CREDENTIALS_FILE}) securely"
echo "3. Delete the credentials file after setting up GitHub secrets"
echo "4. The client secret cannot be retrieved again - save it now"
echo "5. You can reset the secret using: az ad sp credential reset --id ${CLIENT_ID}"
echo ""

print_success "CI/CD credentials setup complete!"
echo ""
print_warning "IMPORTANT: Delete ${CREDENTIALS_FILE} after setting up GitHub secrets"
echo "Run: rm ${CREDENTIALS_FILE}"
