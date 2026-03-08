#!/bin/bash
# Check frontend API calls match backend routes

echo "🔍 Checking Frontend API Calls vs Backend Routes"
echo "================================================"
echo ""

# Extract all backend routes
echo "📋 Extracting backend routes..."
cd backend/src/functions
ROUTES=$(grep -h "route:" *.ts | sed "s/.*route: '\([^']*\)'.*/\1/" | sort -u)

echo "Found $(echo "$ROUTES" | wc -l) unique routes"
echo ""

# Check frontend for API calls
echo "🔍 Checking frontend API calls..."
cd ../../../frontend/src

# Find all fetch/API calls
echo ""
echo "API calls found in frontend:"
grep -r "fetch.*api\|fetch.*\${apiUrl}" . --include="*.ts" --include="*.tsx" | \
  grep -v node_modules | \
  sed 's/.*fetch[^`]*`[^/]*\(\/[^`]*\)`.*/\1/' | \
  sed 's/\${[^}]*}/\{id\}/g' | \
  sort -u | head -50

echo ""
echo "✅ Check complete. Review output above."
