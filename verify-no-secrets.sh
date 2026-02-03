#!/bin/bash

echo "🔍 Verifying no secrets in Git repository..."
echo ""

# Check for untracked sensitive files
echo "1. Checking for sensitive files in .gitignore..."
SENSITIVE_FILES=".deployment-config credential.json github-token.txt ad-apps.json azure-ad-summary.md deploy-now.sh roles.json"
for file in $SENSITIVE_FILES; do
    if git check-ignore "$file" > /dev/null 2>&1; then
        echo "   ✅ $file is gitignored"
    else
        echo "   ⚠️  $file is NOT gitignored!"
    fi
done
echo ""

# Check for tracked sensitive files
echo "2. Checking for tracked sensitive files..."
TRACKED_SENSITIVE=$(git ls-files | grep -E "(credential|github-token|ad-apps|\.secret|deploy-now|azure-ad-summary)" || true)
if [ -z "$TRACKED_SENSITIVE" ]; then
    echo "   ✅ No sensitive files tracked by git"
else
    echo "   ⚠️  Found tracked sensitive files:"
    echo "$TRACKED_SENSITIVE"
fi
echo ""

# Check for secrets in tracked files
echo "3. Checking for potential secrets in tracked files..."
SECRETS_FOUND=$(git ls-files | xargs grep -l "github_pat_\|ghp_\|i9Z8Q~" 2>/dev/null || true)
if [ -z "$SECRETS_FOUND" ]; then
    echo "   ✅ No secrets found in tracked files"
else
    echo "   ⚠️  Potential secrets found in:"
    echo "$SECRETS_FOUND"
fi
echo ""

# Check git status
echo "4. Checking git status..."
git status --short
echo ""

echo "✅ Verification complete!"
