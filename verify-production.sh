#!/bin/bash
# Quick Production Verification Script

set -e

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m'

RESOURCE_GROUP="rg-qr-attendance-prod"

echo -e "${BLUE}=========================================="
echo "Production Deployment Verification"
echo -e "==========================================${NC}"
echo ""

# 1. Check SignalR
echo -e "${BLUE}1. Checking SignalR Service...${NC}"
SIGNALR_INFO=$(az signalr show \
  --name signalr-qrattendance-prod \
  --resource-group $RESOURCE_GROUP \
  --query "{name:name, tier:sku.tier, capacity:sku.capacity, state:provisioningState}" \
  -o json 2>/dev/null)

if [ $? -eq 0 ]; then
  echo "$SIGNALR_INFO" | jq .
  TIER=$(echo "$SIGNALR_INFO" | jq -r '.tier')
  if [ "$TIER" = "Standard" ]; then
    echo -e "${GREEN}✓ SignalR Standard S1 tier confirmed${NC}"
  else
    echo -e "${YELLOW}⚠ SignalR tier is $TIER (expected Standard)${NC}"
  fi
else
  echo -e "${RED}✗ Failed to check SignalR${NC}"
fi
echo ""

# 2. Check Function App
echo -e "${BLUE}2. Checking Function App...${NC}"
FUNC_STATE=$(az functionapp show \
  --name func-qrattendance-prod \
  --resource-group $RESOURCE_GROUP \
  --query "{name:name, state:state, defaultHostName:defaultHostName}" \
  -o json 2>/dev/null)

if [ $? -eq 0 ]; then
  echo "$FUNC_STATE" | jq .
  STATE=$(echo "$FUNC_STATE" | jq -r '.state')
  if [ "$STATE" = "Running" ]; then
    echo -e "${GREEN}✓ Function App is running${NC}"
  else
    echo -e "${YELLOW}⚠ Function App state: $STATE${NC}"
  fi
else
  echo -e "${RED}✗ Failed to check Function App${NC}"
fi
echo ""

# 3. Check Azure OpenAI
echo -e "${BLUE}3. Checking Azure OpenAI...${NC}"
OPENAI_INFO=$(az cognitiveservices account show \
  --name openai-qrattendance-prod \
  --resource-group $RESOURCE_GROUP \
  --query "{name:name, kind:kind, provisioningState:properties.provisioningState, endpoint:properties.endpoint}" \
  -o json 2>/dev/null)

if [ $? -eq 0 ]; then
  echo "$OPENAI_INFO" | jq .
  KIND=$(echo "$OPENAI_INFO" | jq -r '.kind')
  if [ "$KIND" = "AIServices" ]; then
    echo -e "${GREEN}✓ Azure OpenAI using AIServices kind (updated API)${NC}"
  else
    echo -e "${YELLOW}⚠ Azure OpenAI kind: $KIND${NC}"
  fi
else
  echo -e "${RED}✗ Failed to check Azure OpenAI${NC}"
fi
echo ""

# 4. Check Static Web App
echo -e "${BLUE}4. Checking Static Web App...${NC}"
SWA_INFO=$(az staticwebapp show \
  --name swa-qrattendance-prod2 \
  --resource-group $RESOURCE_GROUP \
  --query "{name:name, defaultHostname:defaultHostname}" \
  -o json 2>/dev/null)

if [ $? -eq 0 ]; then
  echo "$SWA_INFO" | jq .
  echo -e "${GREEN}✓ Static Web App is deployed${NC}"
else
  echo -e "${RED}✗ Failed to check Static Web App${NC}"
fi
echo ""

# 5. Check Storage Tables
echo -e "${BLUE}5. Checking Storage Tables...${NC}"
TABLE_COUNT=$(az storage table list \
  --account-name stqrattendanceprod \
  --auth-mode login \
  --query "length(@)" \
  -o tsv 2>/dev/null)

if [ $? -eq 0 ]; then
  echo -e "Table count: ${GREEN}$TABLE_COUNT${NC}"
  if [ "$TABLE_COUNT" -ge 11 ]; then
    echo -e "${GREEN}✓ All tables created${NC}"
  else
    echo -e "${YELLOW}⚠ Expected at least 11 tables, found $TABLE_COUNT${NC}"
  fi
else
  echo -e "${YELLOW}⚠ Could not check tables (may need login)${NC}"
fi
echo ""

# 6. Check SignalR Connection String in Function App
echo -e "${BLUE}6. Checking SignalR Configuration...${NC}"
SIGNALR_CONN=$(az functionapp config appsettings list \
  --name func-qrattendance-prod \
  --resource-group $RESOURCE_GROUP \
  --query "[?name=='SIGNALR_CONNECTION_STRING'].value" \
  -o tsv 2>/dev/null)

if [ $? -eq 0 ]; then
  if [[ "$SIGNALR_CONN" == *"dummy"* ]]; then
    echo -e "${RED}✗ SignalR connection string is dummy (not configured)${NC}"
  elif [[ "$SIGNALR_CONN" == *"signalr-qrattendance-prod"* ]]; then
    echo -e "${GREEN}✓ SignalR connection string configured correctly${NC}"
  else
    echo -e "${YELLOW}⚠ SignalR connection string present but unexpected format${NC}"
  fi
else
  echo -e "${RED}✗ Failed to check SignalR connection string${NC}"
fi
echo ""

# Summary
echo -e "${BLUE}=========================================="
echo "Verification Complete"
echo -e "==========================================${NC}"
echo ""
echo -e "${GREEN}Production URL:${NC} https://ashy-desert-0fc9a700f.6.azurestaticapps.net"
echo -e "${GREEN}Backend API:${NC} https://func-qrattendance-prod.azurewebsites.net"
echo ""
echo "Next steps:"
echo "  1. Open production URL in browser"
echo "  2. Login with Azure AD"
echo "  3. Check browser console for 'SignalR connected'"
echo "  4. Test quiz feature"
echo ""
