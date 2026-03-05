#!/bin/bash
# Migrate from Classic Agents to New Agents
# WARNING: This will delete the project and all agents!

set -e

ENVIRONMENT=""
RESOURCE_GROUP=""
OPENAI_NAME=""
PROJECT_NAME=""

usage() {
    echo "Usage: $0 -e <environment> [-g <resource-group>] [-o <openai-name>] [-p <project-name>]"
    echo ""
    echo "Required:"
    echo "  -e, --environment     Environment (dev|staging|prod)"
    echo ""
    echo "Optional:"
    echo "  -g, --resource-group  Resource group name (default: rg-qr-attendance-<environment>)"
    echo "  -o, --openai-name     OpenAI account name (default: openai-qrattendance-<environment>)"
    echo "  -p, --project-name    Foundry project name (default: <openai-name>-project)"
    echo "  -h, --help            Show this help"
    exit 1
}

while [[ $# -gt 0 ]]; do
    case "$1" in
        -e|--environment)
            ENVIRONMENT="$2"
            shift 2
            ;;
        -g|--resource-group)
            RESOURCE_GROUP="$2"
            shift 2
            ;;
        -o|--openai-name)
            OPENAI_NAME="$2"
            shift 2
            ;;
        -p|--project-name)
            PROJECT_NAME="$2"
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

if [ -z "$ENVIRONMENT" ]; then
    echo "Error: --environment is required"
    usage
fi

if [[ ! "$ENVIRONMENT" =~ ^(dev|staging|prod)$ ]]; then
    echo "Error: environment must be one of: dev, staging, prod"
    exit 1
fi

RESOURCE_GROUP="${RESOURCE_GROUP:-rg-qr-attendance-${ENVIRONMENT}}"
OPENAI_NAME="${OPENAI_NAME:-openai-qrattendance-${ENVIRONMENT}}"
PROJECT_NAME="${PROJECT_NAME:-${OPENAI_NAME}-project}"
PARAMS_FILE="infrastructure/parameters/${ENVIRONMENT}.bicepparam"

if [ ! -f "$PARAMS_FILE" ]; then
    echo "Error: parameters file not found: $PARAMS_FILE"
    exit 1
fi

echo "=========================================="
echo "Migrate to New Agents"
echo "=========================================="
echo ""
echo "Environment:    $ENVIRONMENT"
echo "Resource Group: $RESOURCE_GROUP"
echo "OpenAI:         $OPENAI_NAME"
echo "Project:        $PROJECT_NAME"
echo "Params File:    $PARAMS_FILE"
echo ""
echo "WARNING: This will:"
echo "  1. Delete the existing project (and all Classic Agents)"
echo "  2. Recreate the project"
echo "  3. Create New Agents via TypeScript SDK"
echo ""
echo "Press Ctrl+C to cancel, or wait 10 seconds to continue..."
sleep 10

# Step 1: Delete the project
echo ""
echo "Step 1: Deleting project..."
SUBSCRIPTION_ID=$(az account show --query id -o tsv)
PROJECT_ID="/subscriptions/${SUBSCRIPTION_ID}/resourceGroups/${RESOURCE_GROUP}/providers/Microsoft.CognitiveServices/accounts/${OPENAI_NAME}/projects/${PROJECT_NAME}"

az resource delete --ids "${PROJECT_ID}" --verbose

echo "Waiting 30 seconds for deletion to complete..."
sleep 30

# Step 2: Recreate the project via Bicep
echo ""
echo "Step 2: Redeploying infrastructure..."
az deployment group create \
    --resource-group "${RESOURCE_GROUP}" \
    --template-file "infrastructure/main.bicep" \
    --parameters "${PARAMS_FILE}" \
    --name "qr-attendance-${ENVIRONMENT}-deployment-$(date +%s)" \
    --output none

echo "Waiting 60 seconds for project to be fully provisioned..."
sleep 60

# Step 3: Create New Agents
echo ""
echo "Step 3: Creating New Agents..."
npx tsx create-agents.ts "${RESOURCE_GROUP}" "${OPENAI_NAME}" "${PROJECT_NAME}"

echo ""
echo "=========================================="
echo "Migration Complete!"
echo "=========================================="
echo ""
echo "Your agents are now New Agents (not Classic)."
echo "They will appear in the 'New Agents' view in the portal."
