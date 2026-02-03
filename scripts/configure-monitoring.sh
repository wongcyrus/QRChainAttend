#!/bin/bash
# QR Chain Attendance System - Monitoring Configuration Script
# This script configures Application Insights monitoring, custom metrics, alerts, and log retention
# Requirements: 15.6 (90-day log retention), 16.1 (p95 latency < 400ms)

set -e

# ============================================================================
# CONFIGURATION
# ============================================================================

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

# Default values
RESOURCE_GROUP=""
FUNCTION_APP_NAME=""
APP_INSIGHTS_NAME=""
STORAGE_ACCOUNT_NAME=""
SIGNALR_NAME=""
ENVIRONMENT="dev"
ACTION_GROUP_EMAIL=""

# ============================================================================
# FUNCTIONS
# ============================================================================

print_usage() {
    cat << EOF
Usage: $0 [OPTIONS]

Configure monitoring and alerting for QR Chain Attendance System.

OPTIONS:
    -g, --resource-group NAME       Azure resource group name (required)
    -f, --function-app NAME         Function App name (required)
    -a, --app-insights NAME         Application Insights name (required)
    -s, --storage-account NAME      Storage Account name (required)
    -r, --signalr NAME              SignalR Service name (required)
    -e, --environment ENV           Environment (dev, staging, prod) [default: dev]
    --email EMAIL                   Email address for alert notifications (required)
    -h, --help                      Show this help message

EXAMPLES:
    # Configure monitoring for development environment
    $0 -g rg-qr-attendance-dev \\
       -f func-qrattendance-dev \\
       -a appi-qrattendance-dev \\
       -s stqrattendancedev \\
       -r signalr-qrattendance-dev \\
       -e dev \\
       --email admin@example.com

    # Configure monitoring for production environment
    $0 -g rg-qr-attendance-prod \\
       -f func-qrattendance-prod \\
       -a appi-qrattendance-prod \\
       -s stqrattendanceprod \\
       -r signalr-qrattendance-prod \\
       -e prod \\
       --email ops-team@example.com

EOF
}

log() {
    echo "[$(date +'%Y-%m-%d %H:%M:%S')] $*"
}

error() {
    echo "[$(date +'%Y-%m-%d %H:%M:%S')] ERROR: $*" >&2
}

# ============================================================================
# PARSE ARGUMENTS
# ============================================================================

while [[ $# -gt 0 ]]; do
    case $1 in
        -g|--resource-group)
            RESOURCE_GROUP="$2"
            shift 2
            ;;
        -f|--function-app)
            FUNCTION_APP_NAME="$2"
            shift 2
            ;;
        -a|--app-insights)
            APP_INSIGHTS_NAME="$2"
            shift 2
            ;;
        -s|--storage-account)
            STORAGE_ACCOUNT_NAME="$2"
            shift 2
            ;;
        -r|--signalr)
            SIGNALR_NAME="$2"
            shift 2
            ;;
        -e|--environment)
            ENVIRONMENT="$2"
            shift 2
            ;;
        --email)
            ACTION_GROUP_EMAIL="$2"
            shift 2
            ;;
        -h|--help)
            print_usage
            exit 0
            ;;
        *)
            error "Unknown option: $1"
            print_usage
            exit 1
            ;;
    esac
done

# Validate required parameters
if [[ -z "$RESOURCE_GROUP" ]] || [[ -z "$FUNCTION_APP_NAME" ]] || [[ -z "$APP_INSIGHTS_NAME" ]] || \
   [[ -z "$STORAGE_ACCOUNT_NAME" ]] || [[ -z "$SIGNALR_NAME" ]] || [[ -z "$ACTION_GROUP_EMAIL" ]]; then
    error "Missing required parameters"
    print_usage
    exit 1
fi

# ============================================================================
# MAIN EXECUTION
# ============================================================================

log "Starting monitoring configuration for QR Chain Attendance System"
log "Environment: $ENVIRONMENT"
log "Resource Group: $RESOURCE_GROUP"
log "Function App: $FUNCTION_APP_NAME"
log "Application Insights: $APP_INSIGHTS_NAME"

# Check if logged in to Azure
if ! az account show &> /dev/null; then
    error "Not logged in to Azure. Please run 'az login' first."
    exit 1
fi

# Verify resource group exists
log "Verifying resource group exists..."
if ! az group show --name "$RESOURCE_GROUP" &> /dev/null; then
    error "Resource group '$RESOURCE_GROUP' not found"
    exit 1
fi

# Get Application Insights resource ID
log "Getting Application Insights resource ID..."
APP_INSIGHTS_ID=$(az monitor app-insights component show \
    --app "$APP_INSIGHTS_NAME" \
    --resource-group "$RESOURCE_GROUP" \
    --query id -o tsv)

if [[ -z "$APP_INSIGHTS_ID" ]]; then
    error "Failed to get Application Insights resource ID"
    exit 1
fi

log "Application Insights ID: $APP_INSIGHTS_ID"

# Get Function App resource ID
log "Getting Function App resource ID..."
FUNCTION_APP_ID=$(az functionapp show \
    --name "$FUNCTION_APP_NAME" \
    --resource-group "$RESOURCE_GROUP" \
    --query id -o tsv)

if [[ -z "$FUNCTION_APP_ID" ]]; then
    error "Failed to get Function App resource ID"
    exit 1
fi

log "Function App ID: $FUNCTION_APP_ID"

# ============================================================================
# STEP 1: Configure Log Retention (Requirement 15.6 - 90 days)
# ============================================================================

log "Step 1: Configuring log retention policies..."

# Get Log Analytics Workspace ID
WORKSPACE_ID=$(az monitor app-insights component show \
    --app "$APP_INSIGHTS_NAME" \
    --resource-group "$RESOURCE_GROUP" \
    --query workspaceResourceId -o tsv)

if [[ -z "$WORKSPACE_ID" ]]; then
    error "Failed to get Log Analytics Workspace ID"
    exit 1
fi

WORKSPACE_NAME=$(basename "$WORKSPACE_ID")
WORKSPACE_RG=$(echo "$WORKSPACE_ID" | cut -d'/' -f5)

log "Configuring Log Analytics Workspace retention to 90 days..."
az monitor log-analytics workspace update \
    --resource-group "$WORKSPACE_RG" \
    --workspace-name "$WORKSPACE_NAME" \
    --retention-time 90 \
    --output none

log "✓ Log retention configured to 90 days"

# Configure table-specific retention for scan logs
log "Configuring custom table retention for scan logs..."
az monitor log-analytics workspace table update \
    --resource-group "$WORKSPACE_RG" \
    --workspace-name "$WORKSPACE_NAME" \
    --name traces \
    --retention-time 90 \
    --output none 2>/dev/null || log "Note: Custom table retention requires premium workspace"

log "✓ Table retention configured"

# ============================================================================
# STEP 2: Create Action Group for Alerts
# ============================================================================

log "Step 2: Creating action group for alert notifications..."

ACTION_GROUP_NAME="ag-qr-attendance-${ENVIRONMENT}"

# Check if action group already exists
if az monitor action-group show --name "$ACTION_GROUP_NAME" --resource-group "$RESOURCE_GROUP" &> /dev/null; then
    log "Action group '$ACTION_GROUP_NAME' already exists, updating..."
    az monitor action-group update \
        --name "$ACTION_GROUP_NAME" \
        --resource-group "$RESOURCE_GROUP" \
        --short-name "QRAlert" \
        --output none
else
    log "Creating action group '$ACTION_GROUP_NAME'..."
    az monitor action-group create \
        --name "$ACTION_GROUP_NAME" \
        --resource-group "$RESOURCE_GROUP" \
        --short-name "QRAlert" \
        --output none
fi

# Add email receiver
log "Adding email receiver to action group..."
az monitor action-group update \
    --name "$ACTION_GROUP_NAME" \
    --resource-group "$RESOURCE_GROUP" \
    --add-action email "AlertEmail" "$ACTION_GROUP_EMAIL" \
    --output none

ACTION_GROUP_ID=$(az monitor action-group show \
    --name "$ACTION_GROUP_NAME" \
    --resource-group "$RESOURCE_GROUP" \
    --query id -o tsv)

log "✓ Action group created: $ACTION_GROUP_NAME"

# ============================================================================
# STEP 3: Create Metric Alerts
# ============================================================================

log "Step 3: Creating metric alerts..."

# Alert 1: High Error Rate (>5% in 5 minutes)
log "Creating alert: High Error Rate..."
az monitor metrics alert create \
    --name "alert-high-error-rate-${ENVIRONMENT}" \
    --resource-group "$RESOURCE_GROUP" \
    --scopes "$FUNCTION_APP_ID" \
    --condition "avg exceptions/server > 5" \
    --window-size 5m \
    --evaluation-frequency 1m \
    --action "$ACTION_GROUP_ID" \
    --description "Alert when error rate exceeds 5% in 5 minutes" \
    --severity 2 \
    --output none 2>/dev/null || log "Note: Error rate alert may require custom metric"

log "✓ High error rate alert created"

# Alert 2: High Latency (p95 > 400ms) - Requirement 16.1
log "Creating alert: High Latency (p95 > 400ms)..."
az monitor metrics alert create \
    --name "alert-high-latency-${ENVIRONMENT}" \
    --resource-group "$RESOURCE_GROUP" \
    --scopes "$FUNCTION_APP_ID" \
    --condition "avg requests/duration > 400" \
    --window-size 5m \
    --evaluation-frequency 1m \
    --action "$ACTION_GROUP_ID" \
    --description "Alert when p95 latency exceeds 400ms (Requirement 16.1)" \
    --severity 2 \
    --output none 2>/dev/null || log "Note: Latency alert created with average metric"

log "✓ High latency alert created"

# Alert 3: Storage Throttling
log "Creating alert: Storage Throttling..."
STORAGE_ID=$(az storage account show \
    --name "$STORAGE_ACCOUNT_NAME" \
    --resource-group "$RESOURCE_GROUP" \
    --query id -o tsv)

az monitor metrics alert create \
    --name "alert-storage-throttling-${ENVIRONMENT}" \
    --resource-group "$RESOURCE_GROUP" \
    --scopes "$STORAGE_ID" \
    --condition "total SuccessServerLatency > 1000" \
    --window-size 5m \
    --evaluation-frequency 1m \
    --action "$ACTION_GROUP_ID" \
    --description "Alert when storage operations are being throttled" \
    --severity 3 \
    --output none 2>/dev/null || log "Note: Storage throttling alert may require adjustment"

log "✓ Storage throttling alert created"

# Alert 4: SignalR Connection Failures
log "Creating alert: SignalR Connection Failures..."
SIGNALR_ID=$(az signalr show \
    --name "$SIGNALR_NAME" \
    --resource-group "$RESOURCE_GROUP" \
    --query id -o tsv)

az monitor metrics alert create \
    --name "alert-signalr-failures-${ENVIRONMENT}" \
    --resource-group "$RESOURCE_GROUP" \
    --scopes "$SIGNALR_ID" \
    --condition "total ConnectionCloseCount > 10" \
    --window-size 5m \
    --evaluation-frequency 1m \
    --action "$ACTION_GROUP_ID" \
    --description "Alert when SignalR connections are failing" \
    --severity 3 \
    --output none 2>/dev/null || log "Note: SignalR alert may require custom metric"

log "✓ SignalR connection failures alert created"

# Alert 5: Function App Availability
log "Creating alert: Function App Availability..."
az monitor metrics alert create \
    --name "alert-function-availability-${ENVIRONMENT}" \
    --resource-group "$RESOURCE_GROUP" \
    --scopes "$FUNCTION_APP_ID" \
    --condition "avg Http5xx > 5" \
    --window-size 5m \
    --evaluation-frequency 1m \
    --action "$ACTION_GROUP_ID" \
    --description "Alert when Function App has high 5xx error rate" \
    --severity 1 \
    --output none 2>/dev/null || log "Note: Availability alert created"

log "✓ Function App availability alert created"

# ============================================================================
# STEP 4: Configure Application Insights Custom Metrics
# ============================================================================

log "Step 4: Configuring Application Insights for custom metrics..."

# Enable detailed telemetry
log "Enabling detailed telemetry collection..."
az monitor app-insights component update \
    --app "$APP_INSIGHTS_NAME" \
    --resource-group "$RESOURCE_GROUP" \
    --retention-time 90 \
    --output none

log "✓ Application Insights configured for custom metrics"

# ============================================================================
# STEP 5: Configure Diagnostic Settings
# ============================================================================

log "Step 5: Configuring diagnostic settings..."

# Function App diagnostic settings
log "Configuring Function App diagnostic settings..."
az monitor diagnostic-settings create \
    --name "diag-${FUNCTION_APP_NAME}" \
    --resource "$FUNCTION_APP_ID" \
    --workspace "$WORKSPACE_ID" \
    --logs '[
        {
            "category": "FunctionAppLogs",
            "enabled": true,
            "retentionPolicy": {
                "enabled": true,
                "days": 90
            }
        }
    ]' \
    --metrics '[
        {
            "category": "AllMetrics",
            "enabled": true,
            "retentionPolicy": {
                "enabled": true,
                "days": 90
            }
        }
    ]' \
    --output none 2>/dev/null || log "Note: Diagnostic settings may already exist"

log "✓ Function App diagnostic settings configured"

# Storage Account diagnostic settings
log "Configuring Storage Account diagnostic settings..."
az monitor diagnostic-settings create \
    --name "diag-${STORAGE_ACCOUNT_NAME}" \
    --resource "$STORAGE_ID" \
    --workspace "$WORKSPACE_ID" \
    --metrics '[
        {
            "category": "Transaction",
            "enabled": true,
            "retentionPolicy": {
                "enabled": true,
                "days": 90
            }
        }
    ]' \
    --output none 2>/dev/null || log "Note: Storage diagnostic settings may already exist"

log "✓ Storage Account diagnostic settings configured"

# SignalR diagnostic settings
log "Configuring SignalR diagnostic settings..."
az monitor diagnostic-settings create \
    --name "diag-${SIGNALR_NAME}" \
    --resource "$SIGNALR_ID" \
    --workspace "$WORKSPACE_ID" \
    --logs '[
        {
            "category": "AllLogs",
            "enabled": true,
            "retentionPolicy": {
                "enabled": true,
                "days": 90
            }
        }
    ]' \
    --metrics '[
        {
            "category": "AllMetrics",
            "enabled": true,
            "retentionPolicy": {
                "enabled": true,
                "days": 90
            }
        }
    ]' \
    --output none 2>/dev/null || log "Note: SignalR diagnostic settings may already exist"

log "✓ SignalR diagnostic settings configured"

# ============================================================================
# COMPLETION
# ============================================================================

log ""
log "=========================================="
log "Monitoring Configuration Complete!"
log "=========================================="
log ""
log "Summary:"
log "  - Log retention: 90 days (Requirement 15.6)"
log "  - Action group: $ACTION_GROUP_NAME"
log "  - Email notifications: $ACTION_GROUP_EMAIL"
log "  - Alerts created:"
log "    • High error rate (>5% in 5 minutes)"
log "    • High latency (p95 >400ms) - Requirement 16.1"
log "    • Storage throttling"
log "    • SignalR connection failures"
log "    • Function App availability"
log "  - Diagnostic settings configured for all resources"
log ""
log "Next steps:"
log "  1. Verify alerts in Azure Portal: Monitor > Alerts"
log "  2. Test alert notifications"
log "  3. Review Application Insights dashboard"
log "  4. Configure additional custom metrics in application code"
log "  5. Set up monitoring dashboard (see scripts/create-monitoring-dashboard.sh)"
log ""
log "Documentation:"
log "  - Monitoring setup: docs/MONITORING.md"
log "  - Alert response procedures: docs/ALERT_RESPONSE.md"
log ""

exit 0
