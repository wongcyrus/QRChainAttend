#!/bin/bash

# Deploy backend functions to production

set -e

usage() {
  echo "Usage: $0 [-e <environment>] [-f <function-app-name>] [-g <resource-group>]"
  echo ""
  echo "Options:"
  echo "  -e, --environment     Environment (dev|staging|prod). Default: dev"
  echo "  -f, --function-app    Function App name. Default: func-qrattendance-<environment>"
  echo "  -g, --resource-group  Resource group name. Default: rg-qr-attendance-<environment>"
  echo "  -h, --help            Show this help"
  exit 1
}

ENVIRONMENT="dev"
FUNCTION_APP_NAME=""
RESOURCE_GROUP=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    -e|--environment)
      ENVIRONMENT="$2"
      shift 2
      ;;
    -f|--function-app)
      FUNCTION_APP_NAME="$2"
      shift 2
      ;;
    -g|--resource-group)
      RESOURCE_GROUP="$2"
      shift 2
      ;;
    -h|--help)
      usage
      ;;
    *)
      echo "Unknown option: $1"
      usage
      ;;
  esac
done

if [[ ! "$ENVIRONMENT" =~ ^(dev|staging|prod)$ ]]; then
  echo "Error: environment must be one of: dev, staging, prod"
  exit 1
fi

FUNCTION_APP_NAME="${FUNCTION_APP_NAME:-func-qrattendance-${ENVIRONMENT}}"
RESOURCE_GROUP="${RESOURCE_GROUP:-rg-qr-attendance-${ENVIRONMENT}}"

echo "=== Deploying Backend Functions to Production ==="
echo "Environment: $ENVIRONMENT"
echo "Target: $FUNCTION_APP_NAME"
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

# Check if QR_ENCRYPTION_KEY is set
echo ""
echo "Checking QR_ENCRYPTION_KEY..."
if command -v az &> /dev/null && az account show &> /dev/null; then
  CURRENT_KEY=$(az functionapp config appsettings list \
    --name "$FUNCTION_APP_NAME" \
    --resource-group "$RESOURCE_GROUP" \
    --query "[?name=='QR_ENCRYPTION_KEY'].value" -o tsv 2>/dev/null || echo "")
  
  if [ -z "$CURRENT_KEY" ]; then
    echo "⚠️  WARNING: QR_ENCRYPTION_KEY not set!"
    echo "Run: ../scripts/set-encryption-key.sh"
    echo ""
    read -p "Continue deployment anyway? (y/N) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
      echo "Deployment cancelled."
      exit 1
    fi
  else
    echo "✓ QR_ENCRYPTION_KEY is set"
  fi
else
  echo "⚠️  Cannot verify QR_ENCRYPTION_KEY (Azure CLI not available)"
fi

# Deploy to production
echo ""
echo "Deploying to $FUNCTION_APP_NAME..."
func azure functionapp publish "$FUNCTION_APP_NAME"

echo ""
echo "=== Deployment Complete ==="
echo "Check Azure portal or run: func azure functionapp list-functions $FUNCTION_APP_NAME"
echo ""
