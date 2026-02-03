#!/bin/bash
# Test deployment fixes for PWA icons and authentication

APP_URL="https://red-grass-0f8bc910f.4.azurestaticapps.net"

echo "=== Testing PWA Icon Fixes ==="
echo ""

echo "1. Testing icon-192.png..."
ICON_192_SIZE=$(curl -sI "$APP_URL/icon-192.png" | grep -i content-length | awk '{print $2}' | tr -d '\r')
if [ "$ICON_192_SIZE" -gt 1000 ]; then
    echo "✓ icon-192.png: $ICON_192_SIZE bytes (valid size)"
else
    echo "✗ icon-192.png: $ICON_192_SIZE bytes (too small)"
fi

echo ""
echo "2. Testing icon-512.png..."
ICON_512_SIZE=$(curl -sI "$APP_URL/icon-512.png" | grep -i content-length | awk '{print $2}' | tr -d '\r')
if [ "$ICON_512_SIZE" -gt 5000 ]; then
    echo "✓ icon-512.png: $ICON_512_SIZE bytes (valid size)"
else
    echo "✗ icon-512.png: $ICON_512_SIZE bytes (too small)"
fi

echo ""
echo "3. Testing meta tags..."
PAGE_CONTENT=$(curl -s "$APP_URL/")
if echo "$PAGE_CONTENT" | grep -q 'mobile-web-app-capable'; then
    echo "✓ mobile-web-app-capable meta tag present"
else
    echo "✗ mobile-web-app-capable meta tag missing"
fi

if echo "$PAGE_CONTENT" | grep -q 'apple-mobile-web-app-capable'; then
    echo "✓ apple-mobile-web-app-capable meta tag present"
else
    echo "✗ apple-mobile-web-app-capable meta tag missing"
fi

echo ""
echo "4. Testing manifest.json..."
MANIFEST=$(curl -s "$APP_URL/manifest.json")
if echo "$MANIFEST" | jq -e '.icons | length == 2' > /dev/null 2>&1; then
    echo "✓ Manifest has 2 icons configured"
else
    echo "✗ Manifest icon configuration issue"
fi

echo ""
echo "=== Testing Azure AD Configuration ==="
echo ""

echo "5. Checking Azure AD app registration..."
AD_APP=$(az ad app show --id dc482c34-ebaa-4239-aca3-2810a4f51728 --query "{redirectUris:web.redirectUris}" -o json 2>&1)
if echo "$AD_APP" | grep -q "red-grass-0f8bc910f.4.azurestaticapps.net"; then
    echo "✓ Azure AD redirect URI correctly configured"
else
    echo "✗ Azure AD redirect URI mismatch"
    echo "$AD_APP"
fi

echo ""
echo "6. Checking Static Web App settings..."
SWA_SETTINGS=$(az staticwebapp appsettings list --name swa-qrattendance-dev2 -o json 2>&1)
if echo "$SWA_SETTINGS" | jq -e '.properties.AAD_CLIENT_ID' > /dev/null 2>&1; then
    echo "✓ AAD_CLIENT_ID configured"
else
    echo "✗ AAD_CLIENT_ID missing"
fi

if echo "$SWA_SETTINGS" | jq -e '.properties.TENANT_ID' > /dev/null 2>&1; then
    echo "✓ TENANT_ID configured"
else
    echo "✗ TENANT_ID missing"
fi

echo ""
echo "=== Summary ==="
echo "All automated checks complete. Manual verification needed:"
echo "1. Open $APP_URL in browser"
echo "2. Check browser console for icon errors (should be none)"
echo "3. Check for meta tag deprecation warnings (should be none)"
echo "4. Try accessing a protected route to test authentication redirect"
