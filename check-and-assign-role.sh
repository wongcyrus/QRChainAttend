#!/bin/bash
# Quick script to check current user and assign roles

set -e

echo "=== Checking Current Azure AD User ==="
CURRENT_USER=$(az ad signed-in-user show --query "{email:mail, upn:userPrincipalName, id:id}" -o json 2>&1)

if [ $? -eq 0 ]; then
    echo "$CURRENT_USER" | jq .
    
    USER_EMAIL=$(echo "$CURRENT_USER" | jq -r '.email // .upn')
    USER_ID=$(echo "$CURRENT_USER" | jq -r '.id')
    
    echo ""
    echo "=== Checking Role Assignments ==="
    
    APP_ID="dc482c34-ebaa-4239-aca3-2810a4f51728"
    SP_ID=$(az ad sp list --filter "appId eq '$APP_ID'" --query "[0].id" -o tsv)
    
    if [ -n "$SP_ID" ]; then
        echo "Service Principal ID: $SP_ID"
        echo ""
        
        ASSIGNMENTS=$(az rest --method GET \
          --uri "https://graph.microsoft.com/v1.0/servicePrincipals/$SP_ID/appRoleAssignedTo" \
          --query "value[?principalId=='$USER_ID']" -o json)
        
        if [ "$(echo "$ASSIGNMENTS" | jq 'length')" -gt 0 ]; then
            echo "✓ Current user has role assignments:"
            echo "$ASSIGNMENTS" | jq -r '.[] | "  - Role ID: \(.appRoleId)"'
            
            # Get role names
            APP_ROLES=$(az ad app show --id "$APP_ID" --query "appRoles" -o json)
            echo ""
            echo "Role details:"
            echo "$ASSIGNMENTS" | jq -r '.[].appRoleId' | while read ROLE_ID; do
                ROLE_NAME=$(echo "$APP_ROLES" | jq -r ".[] | select(.id==\"$ROLE_ID\") | .value")
                echo "  - $ROLE_NAME"
            done
        else
            echo "⚠ No roles assigned to current user"
            echo ""
            echo "To assign a role, run:"
            echo "  ./scripts/assign-user-roles.sh $USER_EMAIL Teacher"
            echo "  or"
            echo "  ./scripts/assign-user-roles.sh $USER_EMAIL Student"
        fi
    else
        echo "✗ Service principal not found"
    fi
else
    echo "✗ Could not get current user information"
    echo "$CURRENT_USER"
fi
