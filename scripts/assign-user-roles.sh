#!/bin/bash

# Script to assign users to Teacher or Student roles in the QR Chain Attendance System
# Usage: ./assign-user-roles.sh <user-email> <role>
# Example: ./assign-user-roles.sh teacher@school.edu Teacher

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to print colored output
print_info() {
    echo -e "${GREEN}ℹ${NC} $1"
}

print_error() {
    echo -e "${RED}✗${NC} $1"
}

print_success() {
    echo -e "${GREEN}✓${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}⚠${NC} $1"
}

# Check arguments
if [ $# -lt 1 ]; then
    echo "Usage: $0 <user-email> [role]"
    echo ""
    echo "Arguments:"
    echo "  user-email    Email address of the user (e.g., teacher@school.edu)"
    echo "  role          Role to assign: Teacher or Student (default: Teacher)"
    echo ""
    echo "Examples:"
    echo "  $0 teacher@school.edu Teacher"
    echo "  $0 student@school.edu Student"
    exit 1
fi

USER_EMAIL="$1"
ROLE="${2:-Teacher}"

# Validate role
if [[ "$ROLE" != "Teacher" && "$ROLE" != "Student" ]]; then
    print_error "Invalid role: $ROLE. Must be 'Teacher' or 'Student'"
    exit 1
fi

print_info "Assigning $ROLE role to $USER_EMAIL..."
echo ""

# Get app registration details
print_info "Finding app registration..."
APP_ID=$(az ad app list --display-name "QR Chain Attendance System" --query "[0].appId" -o tsv)

if [ -z "$APP_ID" ]; then
    print_error "App registration 'QR Chain Attendance System' not found"
    print_info "Please create the app registration first"
    exit 1
fi

print_success "Found app registration: $APP_ID"

# Get or create service principal
print_info "Getting service principal..."
SP_ID=$(az ad sp list --filter "appId eq '$APP_ID'" --query "[0].id" -o tsv)

if [ -z "$SP_ID" ]; then
    print_warning "Service principal not found, creating..."
    az ad sp create --id "$APP_ID" > /dev/null
    SP_ID=$(az ad sp list --filter "appId eq '$APP_ID'" --query "[0].id" -o tsv)
    print_success "Created service principal: $SP_ID"
else
    print_success "Found service principal: $SP_ID"
fi

# Get role ID
print_info "Getting $ROLE role ID..."
ROLE_ID=$(az ad sp show --id "$SP_ID" --query "appRoles[?value=='$ROLE'].id" -o tsv)

if [ -z "$ROLE_ID" ]; then
    print_error "Role '$ROLE' not found in app registration"
    print_info "Please configure app roles first"
    exit 1
fi

print_success "Found $ROLE role: $ROLE_ID"

# Get user object ID
print_info "Finding user $USER_EMAIL..."
USER_ID=$(az ad user show --id "$USER_EMAIL" --query "id" -o tsv 2>/dev/null)

if [ -z "$USER_ID" ]; then
    print_error "User $USER_EMAIL not found in Azure AD"
    exit 1
fi

print_success "Found user: $USER_ID"

# Check if user already has this role
print_info "Checking existing role assignments..."
EXISTING=$(az rest --method GET \
  --uri "https://graph.microsoft.com/v1.0/servicePrincipals/$SP_ID/appRoleAssignedTo" \
  --query "value[?principalId=='$USER_ID' && appRoleId=='$ROLE_ID'].id" -o tsv)

if [ -n "$EXISTING" ]; then
    print_warning "User already has the $ROLE role assigned"
    exit 0
fi

# Assign role
print_info "Assigning $ROLE role..."
az rest --method POST \
  --uri "https://graph.microsoft.com/v1.0/servicePrincipals/$SP_ID/appRoleAssignedTo" \
  --headers "Content-Type=application/json" \
  --body "{
    \"principalId\": \"$USER_ID\",
    \"resourceId\": \"$SP_ID\",
    \"appRoleId\": \"$ROLE_ID\"
  }" > /dev/null

print_success "Successfully assigned $ROLE role to $USER_EMAIL"
echo ""
print_info "The user can now sign in with the $ROLE role"
