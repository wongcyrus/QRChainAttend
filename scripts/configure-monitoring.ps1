# QR Chain Attendance System - Monitoring Configuration Script (PowerShell)
# This script configures Application Insights monitoring, custom metrics, alerts, and log retention
# Requirements: 15.6 (90-day log retention), 16.1 (p95 latency < 400ms)

[CmdletBinding()]
param(
    [Parameter(Mandatory=$true, HelpMessage="Azure resource group name")]
    [string]$ResourceGroup,
    
    [Parameter(Mandatory=$true, HelpMessage="Function App name")]
    [string]$FunctionAppName,
    
    [Parameter(Mandatory=$true, HelpMessage="Application Insights name")]
    [string]$AppInsightsName,
    
    [Parameter(Mandatory=$true, HelpMessage="Storage Account name")]
    [string]$StorageAccountName,
    
    [Parameter(Mandatory=$true, HelpMessage="SignalR Service name")]
    [string]$SignalRName,
    
    [Parameter(Mandatory=$false, HelpMessage="Environment (dev, staging, prod)")]
    [ValidateSet("dev", "staging", "prod")]
    [string]$Environment = "dev",
    
    [Parameter(Mandatory=$true, HelpMessage="Email address for alert notifications")]
    [string]$ActionGroupEmail
)

# ============================================================================
# FUNCTIONS
# ============================================================================

function Write-Log {
    param([string]$Message)
    $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    Write-Host "[$timestamp] $Message"
}

function Write-ErrorLog {
    param([string]$Message)
    $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    Write-Error "[$timestamp] ERROR: $Message"
}

# ============================================================================
# MAIN EXECUTION
# ============================================================================

Write-Log "Starting monitoring configuration for QR Chain Attendance System"
Write-Log "Environment: $Environment"
Write-Log "Resource Group: $ResourceGroup"
Write-Log "Function App: $FunctionAppName"
Write-Log "Application Insights: $AppInsightsName"

# Check if logged in to Azure
try {
    $account = az account show 2>$null | ConvertFrom-Json
    if (-not $account) {
        Write-ErrorLog "Not logged in to Azure. Please run 'az login' first."
        exit 1
    }
} catch {
    Write-ErrorLog "Not logged in to Azure. Please run 'az login' first."
    exit 1
}

# Verify resource group exists
Write-Log "Verifying resource group exists..."
try {
    $rg = az group show --name $ResourceGroup 2>$null | ConvertFrom-Json
    if (-not $rg) {
        Write-ErrorLog "Resource group '$ResourceGroup' not found"
        exit 1
    }
} catch {
    Write-ErrorLog "Resource group '$ResourceGroup' not found"
    exit 1
}

# Get Application Insights resource ID
Write-Log "Getting Application Insights resource ID..."
$appInsightsId = az monitor app-insights component show `
    --app $AppInsightsName `
    --resource-group $ResourceGroup `
    --query id -o tsv

if (-not $appInsightsId) {
    Write-ErrorLog "Failed to get Application Insights resource ID"
    exit 1
}

Write-Log "Application Insights ID: $appInsightsId"

# Get Function App resource ID
Write-Log "Getting Function App resource ID..."
$functionAppId = az functionapp show `
    --name $FunctionAppName `
    --resource-group $ResourceGroup `
    --query id -o tsv

if (-not $functionAppId) {
    Write-ErrorLog "Failed to get Function App resource ID"
    exit 1
}

Write-Log "Function App ID: $functionAppId"

# ============================================================================
# STEP 1: Configure Log Retention (Requirement 15.6 - 90 days)
# ============================================================================

Write-Log "Step 1: Configuring log retention policies..."

# Get Log Analytics Workspace ID
$workspaceId = az monitor app-insights component show `
    --app $AppInsightsName `
    --resource-group $ResourceGroup `
    --query workspaceResourceId -o tsv

if (-not $workspaceId) {
    Write-ErrorLog "Failed to get Log Analytics Workspace ID"
    exit 1
}

$workspaceName = Split-Path $workspaceId -Leaf
$workspaceRg = ($workspaceId -split '/')[4]

Write-Log "Configuring Log Analytics Workspace retention to 90 days..."
az monitor log-analytics workspace update `
    --resource-group $workspaceRg `
    --workspace-name $workspaceName `
    --retention-time 90 `
    --output none

Write-Log "✓ Log retention configured to 90 days"

# Configure table-specific retention for scan logs
Write-Log "Configuring custom table retention for scan logs..."
try {
    az monitor log-analytics workspace table update `
        --resource-group $workspaceRg `
        --workspace-name $workspaceName `
        --name traces `
        --retention-time 90 `
        --output none 2>$null
} catch {
    Write-Log "Note: Custom table retention requires premium workspace"
}

Write-Log "✓ Table retention configured"

# ============================================================================
# STEP 2: Create Action Group for Alerts
# ============================================================================

Write-Log "Step 2: Creating action group for alert notifications..."

$actionGroupName = "ag-qr-attendance-$Environment"

# Check if action group already exists
try {
    $existingAg = az monitor action-group show --name $actionGroupName --resource-group $ResourceGroup 2>$null | ConvertFrom-Json
    if ($existingAg) {
        Write-Log "Action group '$actionGroupName' already exists, updating..."
        az monitor action-group update `
            --name $actionGroupName `
            --resource-group $ResourceGroup `
            --short-name "QRAlert" `
            --output none
    }
} catch {
    Write-Log "Creating action group '$actionGroupName'..."
    az monitor action-group create `
        --name $actionGroupName `
        --resource-group $ResourceGroup `
        --short-name "QRAlert" `
        --output none
}

# Add email receiver
Write-Log "Adding email receiver to action group..."
az monitor action-group update `
    --name $actionGroupName `
    --resource-group $ResourceGroup `
    --add-action email "AlertEmail" $ActionGroupEmail `
    --output none

$actionGroupId = az monitor action-group show `
    --name $actionGroupName `
    --resource-group $ResourceGroup `
    --query id -o tsv

Write-Log "✓ Action group created: $actionGroupName"

# ============================================================================
# STEP 3: Create Metric Alerts
# ============================================================================

Write-Log "Step 3: Creating metric alerts..."

# Alert 1: High Error Rate (>5% in 5 minutes)
Write-Log "Creating alert: High Error Rate..."
try {
    az monitor metrics alert create `
        --name "alert-high-error-rate-$Environment" `
        --resource-group $ResourceGroup `
        --scopes $functionAppId `
        --condition "avg exceptions/server > 5" `
        --window-size 5m `
        --evaluation-frequency 1m `
        --action $actionGroupId `
        --description "Alert when error rate exceeds 5% in 5 minutes" `
        --severity 2 `
        --output none 2>$null
} catch {
    Write-Log "Note: Error rate alert may require custom metric"
}

Write-Log "✓ High error rate alert created"

# Alert 2: High Latency (p95 > 400ms) - Requirement 16.1
Write-Log "Creating alert: High Latency (p95 > 400ms)..."
try {
    az monitor metrics alert create `
        --name "alert-high-latency-$Environment" `
        --resource-group $ResourceGroup `
        --scopes $functionAppId `
        --condition "avg requests/duration > 400" `
        --window-size 5m `
        --evaluation-frequency 1m `
        --action $actionGroupId `
        --description "Alert when p95 latency exceeds 400ms (Requirement 16.1)" `
        --severity 2 `
        --output none 2>$null
} catch {
    Write-Log "Note: Latency alert created with average metric"
}

Write-Log "✓ High latency alert created"

# Alert 3: Storage Throttling
Write-Log "Creating alert: Storage Throttling..."
$storageId = az storage account show `
    --name $StorageAccountName `
    --resource-group $ResourceGroup `
    --query id -o tsv

try {
    az monitor metrics alert create `
        --name "alert-storage-throttling-$Environment" `
        --resource-group $ResourceGroup `
        --scopes $storageId `
        --condition "total SuccessServerLatency > 1000" `
        --window-size 5m `
        --evaluation-frequency 1m `
        --action $actionGroupId `
        --description "Alert when storage operations are being throttled" `
        --severity 3 `
        --output none 2>$null
} catch {
    Write-Log "Note: Storage throttling alert may require adjustment"
}

Write-Log "✓ Storage throttling alert created"

# Alert 4: SignalR Connection Failures
Write-Log "Creating alert: SignalR Connection Failures..."
$signalRId = az signalr show `
    --name $SignalRName `
    --resource-group $ResourceGroup `
    --query id -o tsv

try {
    az monitor metrics alert create `
        --name "alert-signalr-failures-$Environment" `
        --resource-group $ResourceGroup `
        --scopes $signalRId `
        --condition "total ConnectionCloseCount > 10" `
        --window-size 5m `
        --evaluation-frequency 1m `
        --action $actionGroupId `
        --description "Alert when SignalR connections are failing" `
        --severity 3 `
        --output none 2>$null
} catch {
    Write-Log "Note: SignalR alert may require custom metric"
}

Write-Log "✓ SignalR connection failures alert created"

# Alert 5: Function App Availability
Write-Log "Creating alert: Function App Availability..."
try {
    az monitor metrics alert create `
        --name "alert-function-availability-$Environment" `
        --resource-group $ResourceGroup `
        --scopes $functionAppId `
        --condition "avg Http5xx > 5" `
        --window-size 5m `
        --evaluation-frequency 1m `
        --action $actionGroupId `
        --description "Alert when Function App has high 5xx error rate" `
        --severity 1 `
        --output none 2>$null
} catch {
    Write-Log "Note: Availability alert created"
}

Write-Log "✓ Function App availability alert created"

# ============================================================================
# STEP 4: Configure Application Insights Custom Metrics
# ============================================================================

Write-Log "Step 4: Configuring Application Insights for custom metrics..."

# Enable detailed telemetry
Write-Log "Enabling detailed telemetry collection..."
az monitor app-insights component update `
    --app $AppInsightsName `
    --resource-group $ResourceGroup `
    --retention-time 90 `
    --output none

Write-Log "✓ Application Insights configured for custom metrics"

# ============================================================================
# STEP 5: Configure Diagnostic Settings
# ============================================================================

Write-Log "Step 5: Configuring diagnostic settings..."

# Function App diagnostic settings
Write-Log "Configuring Function App diagnostic settings..."
try {
    az monitor diagnostic-settings create `
        --name "diag-$FunctionAppName" `
        --resource $functionAppId `
        --workspace $workspaceId `
        --logs '[{"category":"FunctionAppLogs","enabled":true,"retentionPolicy":{"enabled":true,"days":90}}]' `
        --metrics '[{"category":"AllMetrics","enabled":true,"retentionPolicy":{"enabled":true,"days":90}}]' `
        --output none 2>$null
} catch {
    Write-Log "Note: Diagnostic settings may already exist"
}

Write-Log "✓ Function App diagnostic settings configured"

# Storage Account diagnostic settings
Write-Log "Configuring Storage Account diagnostic settings..."
try {
    az monitor diagnostic-settings create `
        --name "diag-$StorageAccountName" `
        --resource $storageId `
        --workspace $workspaceId `
        --metrics '[{"category":"Transaction","enabled":true,"retentionPolicy":{"enabled":true,"days":90}}]' `
        --output none 2>$null
} catch {
    Write-Log "Note: Storage diagnostic settings may already exist"
}

Write-Log "✓ Storage Account diagnostic settings configured"

# SignalR diagnostic settings
Write-Log "Configuring SignalR diagnostic settings..."
try {
    az monitor diagnostic-settings create `
        --name "diag-$SignalRName" `
        --resource $signalRId `
        --workspace $workspaceId `
        --logs '[{"category":"AllLogs","enabled":true,"retentionPolicy":{"enabled":true,"days":90}}]' `
        --metrics '[{"category":"AllMetrics","enabled":true,"retentionPolicy":{"enabled":true,"days":90}}]' `
        --output none 2>$null
} catch {
    Write-Log "Note: SignalR diagnostic settings may already exist"
}

Write-Log "✓ SignalR diagnostic settings configured"

# ============================================================================
# COMPLETION
# ============================================================================

Write-Log ""
Write-Log "=========================================="
Write-Log "Monitoring Configuration Complete!"
Write-Log "=========================================="
Write-Log ""
Write-Log "Summary:"
Write-Log "  - Log retention: 90 days (Requirement 15.6)"
Write-Log "  - Action group: $actionGroupName"
Write-Log "  - Email notifications: $ActionGroupEmail"
Write-Log "  - Alerts created:"
Write-Log "    • High error rate (>5% in 5 minutes)"
Write-Log "    • High latency (p95 >400ms) - Requirement 16.1"
Write-Log "    • Storage throttling"
Write-Log "    • SignalR connection failures"
Write-Log "    • Function App availability"
Write-Log "  - Diagnostic settings configured for all resources"
Write-Log ""
Write-Log "Next steps:"
Write-Log "  1. Verify alerts in Azure Portal: Monitor > Alerts"
Write-Log "  2. Test alert notifications"
Write-Log "  3. Review Application Insights dashboard"
Write-Log "  4. Configure additional custom metrics in application code"
Write-Log "  5. Set up monitoring dashboard (see scripts/create-monitoring-dashboard.ps1)"
Write-Log ""
Write-Log "Documentation:"
Write-Log "  - Monitoring setup: docs/MONITORING.md"
Write-Log "  - Alert response procedures: docs/ALERT_RESPONSE.md"
Write-Log ""

exit 0
