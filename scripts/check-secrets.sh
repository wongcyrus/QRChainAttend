#!/bin/bash

# ============================================================================
# Secret Scanner - Prevent Secret Leaks
# Run before committing or deploying
# ============================================================================

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}Secret Scanner${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

ISSUES=0

# ============================================================================
# Check 1: OpenAI API Keys
# ============================================================================

echo -n "Checking for OpenAI API keys... "
if grep -r "sk-[a-zA-Z0-9]\{20,\}" . \
  --include="*.ts" --include="*.js" --include="*.bicep" --include="*.sh" --include="*.md" \
  --exclude-dir=node_modules --exclude-dir=.git --exclude-dir=dist --exclude-dir=.archive \
  --exclude-dir=.next 2>/dev/null | grep -v "sk-\[" | grep -v "# " > /dev/null; then
    echo -e "${RED}✗ FOUND${NC}"
    echo "OpenAI API keys detected in code!"
    grep -r "sk-[a-zA-Z0-9]\{20,\}" . \
      --include="*.ts" --include="*.js" --include="*.bicep" --include="*.sh" --include="*.md" \
      --exclude-dir=node_modules --exclude-dir=.git --exclude-dir=dist --exclude-dir=.archive \
      --exclude-dir=.next 2>/dev/null | grep -v "sk-\[" | grep -v "# " | head -5
    ISSUES=$((ISSUES + 1))
else
    echo -e "${GREEN}✓${NC}"
fi

# ============================================================================
# Check 2: Azure Storage Keys
# ============================================================================

echo -n "Checking for Azure Storage keys... "
if grep -r "AccountKey=[a-zA-Z0-9+/=]\{20,\}" . \
  --include="*.ts" --include="*.js" --include="*.bicep" --include="*.sh" \
  --exclude-dir=node_modules --exclude-dir=.git --exclude-dir=dist --exclude-dir=.archive \
  2>/dev/null | grep -v "AccountKey=\${" | grep -v "Eby8vdM02x" | grep -v "# " > /dev/null; then
    echo -e "${RED}✗ FOUND${NC}"
    echo "Azure Storage keys detected in code!"
    ISSUES=$((ISSUES + 1))
else
    echo -e "${GREEN}✓${NC}"
fi

# ============================================================================
# Check 3: Hardcoded Passwords
# ============================================================================

echo -n "Checking for hardcoded passwords... "
if grep -r "password\s*=\s*['\"][^'\"]\+" . \
  --include="*.ts" --include="*.js" --include="*.bicep" --include="*.sh" \
  --exclude-dir=node_modules --exclude-dir=.git --exclude-dir=dist --exclude-dir=.archive \
  2>/dev/null | grep -v "password\s*=\s*['\"]['\"]" | grep -v "# " | grep -v "param " > /dev/null; then
    echo -e "${RED}✗ FOUND${NC}"
    echo "Hardcoded passwords detected in code!"
    ISSUES=$((ISSUES + 1))
else
    echo -e "${GREEN}✓${NC}"
fi

# ============================================================================
# Check 4: GitHub Tokens
# ============================================================================

echo -n "Checking for GitHub tokens... "
if grep -r "ghp_[a-zA-Z0-9]\{36\}\|github_pat_[a-zA-Z0-9]\{22\}" . \
  --include="*.ts" --include="*.js" --include="*.bicep" --include="*.sh" --include="*.md" \
  --exclude-dir=node_modules --exclude-dir=.git --exclude-dir=dist --exclude-dir=.archive \
  2>/dev/null | grep -v "# " > /dev/null; then
    echo -e "${RED}✗ FOUND${NC}"
    echo "GitHub tokens detected in code!"
    ISSUES=$((ISSUES + 1))
else
    echo -e "${GREEN}✓${NC}"
fi

# ============================================================================
# Check 5: .env Files in Git
# ============================================================================

echo -n "Checking for .env files in git... "
if git ls-files | grep -E "\.env$|\.env\.local$|\.env\.production$" > /dev/null 2>&1; then
    echo -e "${RED}✗ FOUND${NC}"
    echo ".env files are tracked in git!"
    git ls-files | grep -E "\.env$|\.env\.local$|\.env\.production$"
    ISSUES=$((ISSUES + 1))
else
    echo -e "${GREEN}✓${NC}"
fi

# ============================================================================
# Check 6: Connection Strings with Secrets
# ============================================================================

echo -n "Checking for connection strings with secrets... "
if grep -r "DefaultEndpointsProtocol.*AccountKey=[a-zA-Z0-9+/=]\{20,\}" . \
  --include="*.ts" --include="*.js" \
  --exclude-dir=node_modules --exclude-dir=.git --exclude-dir=dist --exclude-dir=.archive \
  2>/dev/null | grep -v "process.env" | grep -v "Eby8vdM02x" > /dev/null; then
    echo -e "${RED}✗ FOUND${NC}"
    echo "Connection strings with secrets detected in code!"
    ISSUES=$((ISSUES + 1))
else
    echo -e "${GREEN}✓${NC}"
fi

# ============================================================================
# Check 7: Azure AD Secrets
# ============================================================================

echo -n "Checking for Azure AD secrets... "
if grep -r "[a-zA-Z0-9~_-]\{34\}\.[a-zA-Z0-9~_-]\{34\}" . \
  --include="*.ts" --include="*.js" --include="*.bicep" --include="*.sh" \
  --exclude-dir=node_modules --exclude-dir=.git --exclude-dir=dist --exclude-dir=.archive \
  2>/dev/null | grep -v "# " | grep -v "param " > /dev/null; then
    echo -e "${YELLOW}⚠️  POSSIBLE${NC}"
    echo "Possible Azure AD secrets detected (manual review needed)"
else
    echo -e "${GREEN}✓${NC}"
fi

echo ""

# ============================================================================
# Summary
# ============================================================================

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}Summary${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

if [ $ISSUES -eq 0 ]; then
    echo -e "${GREEN}✓ No secrets detected!${NC}"
    echo ""
    echo "Safe to commit and deploy."
    exit 0
else
    echo -e "${RED}✗ $ISSUES issue(s) found!${NC}"
    echo ""
    echo "DO NOT commit or deploy until secrets are removed!"
    echo ""
    echo "How to fix:"
    echo "  1. Remove hardcoded secrets from code"
    echo "  2. Use environment variables instead"
    echo "  3. Add secrets to .gitignore"
    echo "  4. Use Azure Key Vault for production"
    echo ""
    exit 1
fi
