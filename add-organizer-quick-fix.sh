#!/bin/bash
# Quick fix: Add cywong@vtc.edu.hk to ExternalOrganizers table

set -e

EMAIL="cywong@vtc.edu.hk"

echo "🔧 Adding $EMAIL to ExternalOrganizers table"
echo "=============================================="
echo ""

# Get storage account from deployment info
if [ -f "deployment-info.json" ]; then
  STORAGE_ACCOUNT=$(jq -r '.storageAccountName' deployment-info.json 2>/dev/null)
  
  if [ "$STORAGE_ACCOUNT" != "null" ] && [ -n "$STORAGE_ACCOUNT" ]; then
    echo "📋 Storage Account: $STORAGE_ACCOUNT"
    echo ""
    
    # Get storage key
    echo "🔑 Getting storage account key..."
    STORAGE_KEY=$(az storage account keys list \
      --account-name "$STORAGE_ACCOUNT" \
      --query "[0].value" \
      --output tsv 2>/dev/null)
    
    if [ -n "$STORAGE_KEY" ]; then
      echo "✅ Got storage key"
      echo ""
      
      # Add to table
      echo "➕ Adding $EMAIL to ExternalOrganizers table..."
      az storage entity insert \
        --account-name "$STORAGE_ACCOUNT" \
        --account-key "$STORAGE_KEY" \
        --table-name ExternalOrganizers \
        --entity PartitionKey=ORGANIZER RowKey="$EMAIL" \
          email="$EMAIL" \
          addedBy=admin \
          addedAt="$(date -u +"%Y-%m-%dT%H:%M:%SZ")" \
        --if-exists replace
      
      echo ""
      echo "✅ SUCCESS!"
      echo ""
      echo "$EMAIL is now an organizer."
      echo "The user can log in and access organizer features immediately."
      echo ""
      echo "Note: This is a temporary fix. For permanent solution, redeploy:"
      echo "  ./deploy-full-production.sh"
      echo ""
    else
      echo "❌ Failed to get storage key"
      echo "Make sure you're logged in: az login"
      exit 1
    fi
  else
    echo "❌ Storage account not found in deployment-info.json"
    exit 1
  fi
else
  echo "❌ deployment-info.json not found"
  echo ""
  echo "Manual command:"
  echo "  az storage entity insert \\"
  echo "    --account-name <your-storage-account> \\"
  echo "    --table-name ExternalOrganizers \\"
  echo "    --entity PartitionKey=ORGANIZER RowKey=$EMAIL \\"
  echo "      email=$EMAIL \\"
  echo "      addedBy=admin \\"
  echo "      addedAt=\$(date -u +\"%Y-%m-%dT%H:%M:%SZ\")"
  exit 1
fi
