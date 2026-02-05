#!/bin/bash

# Deploy backend functions to production

set -e

echo "=== Deploying Backend Functions to Production ==="
echo "Target: func-qrattendance-dev"
echo ""

# Count functions
FUNCTION_COUNT=$(ls -1 src/functions/*.ts 2>/dev/null | wc -l)
echo "Functions to deploy: $FUNCTION_COUNT"
ls -la src/functions/

# Clean build
echo ""
echo "Cleaning and building..."
rm -rf dist
npm run build

# Check compiled output
COMPILED_COUNT=$(ls -1 dist/src/functions/*.js 2>/dev/null | wc -l)
echo ""
echo "Compiled functions: $COMPILED_COUNT"

# Deploy to production
echo ""
echo "Deploying to func-qrattendance-dev..."
func azure functionapp publish func-qrattendance-dev

echo ""
echo "=== Deployment Complete ==="
echo "Check Azure portal or run: func azure functionapp list-functions func-qrattendance-dev"
echo ""
