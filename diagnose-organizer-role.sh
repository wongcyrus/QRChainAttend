#!/bin/bash
# Diagnose why cywong@vtc.edu.hk is not recognized as organizer

echo "🔍 Diagnosing Organizer Role Issue"
echo "Email: cywong@vtc.edu.hk"
echo "=================================="
echo ""

# Check if deployment info exists
if [ -f "deployment-info.json" ]; then
  FUNCTION_APP=$(jq -r '.functionAppName' deployment-info.json 2>/dev/null)
  RG=$(jq -r '.resourceGroup' deployment-info.json 2>/dev/null)
  
  if [ "$FUNCTION_APP" != "null" ] && [ "$RG" != "null" ]; then
    echo "📋 Found deployment info:"
    echo "  Function App: $FUNCTION_APP"
    echo "  Resource Group: $RG"
    echo ""
    
    echo "🔧 Checking environment variables..."
    az functionapp config appsettings list \
      --name "$FUNCTION_APP" \
      --resource-group "$RG" \
      --query "[?name=='ORGANIZER_DOMAIN' || name=='ATTENDEE_DOMAIN'].{Name:name, Value:value}" \
      --output table 2>/dev/null || echo "❌ Failed to query (not logged in or app not found)"
    
    echo ""
    echo "📊 Current settings should be:"
    echo "  ORGANIZER_DOMAIN = vtc.edu.hk"
    echo "  ATTENDEE_DOMAIN = (empty or not set)"
    echo ""
  fi
fi

echo "✅ SOLUTION:"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "The domain-based role assignment was added recently."
echo "You need to REDEPLOY to apply the new environment variables:"
echo ""
echo "  ./deploy-full-production.sh"
echo ""
echo "This will:"
echo "  1. Deploy updated Bicep with ORGANIZER_DOMAIN=vtc.edu.hk"
echo "  2. Set environment variables in Function App"
echo "  3. Enable automatic organizer role for @vtc.edu.hk emails"
echo ""
echo "After deployment, cywong@vtc.edu.hk will automatically be recognized as organizer."
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "⚡ QUICK FIX (Manual):"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "If you can't redeploy right now, add to ExternalOrganizers table:"
echo ""
echo "  az storage entity insert \\"
echo "    --account-name <storage-account> \\"
echo "    --table-name ExternalOrganizers \\"
echo "    --entity PartitionKey=ORGANIZER RowKey=cywong@vtc.edu.hk \\"
echo "      email=cywong@vtc.edu.hk \\"
echo "      addedBy=admin \\"
echo "      addedAt=\$(date -u +\"%Y-%m-%dT%H:%M:%SZ\")"
echo ""
