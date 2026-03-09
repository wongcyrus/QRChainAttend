#!/bin/bash
# Verify Azure Functions after refactoring

echo "🔍 Verifying Azure Functions Configuration"
echo "==========================================="
echo ""

cd backend

# Check if dist exists
if [ ! -d "dist" ]; then
  echo "❌ dist folder not found. Run 'npm run build' first."
  exit 1
fi

# Count functions
TOTAL_FUNCTIONS=$(find src/functions -name "*.ts" -type f | wc -l)
COMPILED_FUNCTIONS=$(find dist/src/functions -name "*.js" -type f | wc -l)

echo "📊 Function Count:"
echo "  Source files:   $TOTAL_FUNCTIONS"
echo "  Compiled files: $COMPILED_FUNCTIONS"

if [ "$TOTAL_FUNCTIONS" -ne "$COMPILED_FUNCTIONS" ]; then
  echo "  ⚠️  Mismatch detected!"
else
  echo "  ✅ Match"
fi

echo ""
echo "🔍 Checking for old terminology in routes..."

OLD_ROUTES=$(grep -r "route:.*teacher\|route:.*student\|route:.*Teacher\|route:.*Student" src/functions/*.ts 2>/dev/null | grep -v "co-organizer" | wc -l)

if [ "$OLD_ROUTES" -gt 0 ]; then
  echo "  ⚠️  Found $OLD_ROUTES routes with old terminology:"
  grep -r "route:.*teacher\|route:.*student\|route:.*Teacher\|route:.*Student" src/functions/*.ts 2>/dev/null | grep -v "co-organizer"
else
  echo "  ✅ No old terminology in routes"
fi

echo ""
echo "🔍 Checking function registrations..."

# List all app.http registrations
echo "  Registered functions:"
grep -h "app\.http(" src/functions/*.ts | sed "s/.*app\.http('\([^']*\)'.*/    - \1/" | sort

echo ""
echo "🔍 Checking handler/export name consistency..."

MISMATCHES=0
for f in src/functions/*.ts; do
  HANDLER=$(grep "handler:" "$f" 2>/dev/null | sed "s/.*handler: \([^,}]*\).*/\1/" | tr -d ' ')
  EXPORT=$(grep "export async function" "$f" 2>/dev/null | sed "s/.*function \([^(]*\).*/\1/" | tr -d ' ')
  
  if [ -n "$HANDLER" ] && [ -n "$EXPORT" ] && [ "$HANDLER" != "$EXPORT" ]; then
    echo "  ⚠️  $(basename $f): handler=$HANDLER, export=$EXPORT"
    MISMATCHES=$((MISMATCHES + 1))
  fi
done

if [ "$MISMATCHES" -eq 0 ]; then
  echo "  ✅ All handlers match exports"
fi

echo ""
echo "✅ Verification complete!"
