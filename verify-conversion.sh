#!/bin/bash
# Verify conversion completeness

echo "🔍 Verifying conversion completeness..."
echo ""

ISSUES=0

# Check for old terminology in source files
echo "Checking for old terminology..."

if grep -r "Teacher" frontend/src backend/src --include="*.ts" --include="*.tsx" 2>/dev/null | grep -v "Organizer" | grep -v "CoOrganizer" | grep -v "comment" | grep -v "Requirements" | head -5; then
  echo "⚠️  Found 'Teacher' references (check if intentional)"
  ISSUES=$((ISSUES + 1))
fi

if grep -r "Student" frontend/src backend/src --include="*.ts" --include="*.tsx" 2>/dev/null | grep -v "Attendee" | grep -v "comment" | grep -v "Requirements" | head -5; then
  echo "⚠️  Found 'Student' references (check if intentional)"
  ISSUES=$((ISSUES + 1))
fi

if grep -r "@vtc.edu.hk\|@stu.vtc.edu.hk" frontend/src backend/src --include="*.ts" --include="*.tsx" 2>/dev/null | head -5; then
  echo "⚠️  Found VTC domain references"
  ISSUES=$((ISSUES + 1))
fi

echo ""
echo "Checking file names..."

if find frontend/src backend/src -name "*Teacher*" -o -name "*Student*" 2>/dev/null | grep -v node_modules | head -5; then
  echo "⚠️  Found files with old names"
  ISSUES=$((ISSUES + 1))
fi

echo ""
if [ $ISSUES -eq 0 ]; then
  echo "✅ Conversion verification passed!"
  echo "   No old terminology found in source code."
else
  echo "⚠️  Found $ISSUES potential issues"
  echo "   Review the output above and fix if needed."
fi

echo ""
echo "Build status:"
echo "  Frontend: $(cd frontend && npm run build > /dev/null 2>&1 && echo '✅ Pass' || echo '❌ Fail')"
echo "  Backend:  $(cd backend && npm run build > /dev/null 2>&1 && echo '✅ Pass' || echo '❌ Fail')"
