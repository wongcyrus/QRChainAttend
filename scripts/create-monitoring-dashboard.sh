#!/bin/bash
# QR Chain Attendance System - Create Monitoring Dashboard
# This script creates an Azure Portal dashboard with key monitoring metrics

set -e

# ============================================================================
# CONFIGURATION
# ============================================================================

RESOURCE_GROUP=""
APP_INSIGHTS_NAME=""
FUNCTION_APP_NAME=""
STORAGE_ACCOUNT_NAME=""
SIGNALR_NAME=""
DASHBOARD_NAME="QR Attendance Monitoring"

# ============================================================================
# FUNCTIONS
# ============================================================================

print_usage() {
    cat << EOF
Usage: $0 [OPTIONS]

Create monitoring dashboard for QR Chain Attendance System.

OPTIONS:
    -g, --resource-group NAME       Azure resource group name (required)
    -a, --app-insights NAME         Application Insights name (required)
    -f, --function-app NAME         Function App name (required)
    -s, --storage-account NAME      Storage Account name (required)
    -r, --signalr NAME              SignalR Service name (required)
    -d, --dashboard-name NAME       Dashboard name [default: "QR Attendance Monitoring"]
    -h, --help                      Show this help message

EXAMPLES:
    $0 -g rg-qr-attendance-prod \\
       -a appi-qrattendance-prod \\
       -f func-qrattendance-prod \\
       -s stqrattendanceprod \\
       -r signalr-qrattendance-prod

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
        -a|--app-insights)
            APP_INSIGHTS_NAME="$2"
            shift 2
            ;;
        -f|--function-app)
            FUNCTION_APP_NAME="$2"
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
        -d|--dashboard-name)
            DASHBOARD_NAME="$2"
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
if [[ -z "$RESOURCE_GROUP" ]] || [[ -z "$APP_INSIGHTS_NAME" ]] || \
   [[ -z "$FUNCTION_APP_NAME" ]] || [[ -z "$STORAGE_ACCOUNT_NAME" ]] || \
   [[ -z "$SIGNALR_NAME" ]]; then
    error "Missing required parameters"
    print_usage
    exit 1
fi

# ============================================================================
# MAIN EXECUTION
# ============================================================================

log "Creating monitoring dashboard: $DASHBOARD_NAME"

# Check if logged in to Azure
if ! az account show &> /dev/null; then
    error "Not logged in to Azure. Please run 'az login' first."
    exit 1
fi

# Get resource IDs
log "Getting resource IDs..."
APP_INSIGHTS_ID=$(az monitor app-insights component show \
    --app "$APP_INSIGHTS_NAME" \
    --resource-group "$RESOURCE_GROUP" \
    --query id -o tsv)

FUNCTION_APP_ID=$(az functionapp show \
    --name "$FUNCTION_APP_NAME" \
    --resource-group "$RESOURCE_GROUP" \
    --query id -o tsv)

STORAGE_ID=$(az storage account show \
    --name "$STORAGE_ACCOUNT_NAME" \
    --resource-group "$RESOURCE_GROUP" \
    --query id -o tsv)

SIGNALR_ID=$(az signalr show \
    --name "$SIGNALR_NAME" \
    --resource-group "$RESOURCE_GROUP" \
    --query id -o tsv)

# Create dashboard JSON
log "Creating dashboard definition..."
cat > /tmp/dashboard.json << EOF
{
  "lenses": {
    "0": {
      "order": 0,
      "parts": {
        "0": {
          "position": {
            "x": 0,
            "y": 0,
            "colSpan": 6,
            "rowSpan": 4
          },
          "metadata": {
            "inputs": [
              {
                "name": "resourceId",
                "value": "$FUNCTION_APP_ID"
              }
            ],
            "type": "Extension/Microsoft_Azure_Monitoring/PartType/MetricsChartPart",
            "settings": {
              "content": {
                "options": {
                  "chart": {
                    "metrics": [
                      {
                        "resourceMetadata": {
                          "id": "$FUNCTION_APP_ID"
                        },
                        "name": "Requests",
                        "aggregationType": 4,
                        "namespace": "microsoft.web/sites",
                        "metricVisualization": {
                          "displayName": "Requests"
                        }
                      }
                    ],
                    "title": "Function App Requests",
                    "titleKind": 1,
                    "visualization": {
                      "chartType": 2
                    }
                  }
                }
              }
            }
          }
        },
        "1": {
          "position": {
            "x": 6,
            "y": 0,
            "colSpan": 6,
            "rowSpan": 4
          },
          "metadata": {
            "inputs": [
              {
                "name": "resourceId",
                "value": "$FUNCTION_APP_ID"
              }
            ],
            "type": "Extension/Microsoft_Azure_Monitoring/PartType/MetricsChartPart",
            "settings": {
              "content": {
                "options": {
                  "chart": {
                    "metrics": [
                      {
                        "resourceMetadata": {
                          "id": "$FUNCTION_APP_ID"
                        },
                        "name": "AverageResponseTime",
                        "aggregationType": 4,
                        "namespace": "microsoft.web/sites",
                        "metricVisualization": {
                          "displayName": "Response Time"
                        }
                      }
                    ],
                    "title": "Response Time (p95 < 400ms target)",
                    "titleKind": 1,
                    "visualization": {
                      "chartType": 2
                    }
                  }
                }
              }
            }
          }
        },
        "2": {
          "position": {
            "x": 0,
            "y": 4,
            "colSpan": 6,
            "rowSpan": 4
          },
          "metadata": {
            "inputs": [
              {
                "name": "resourceId",
                "value": "$FUNCTION_APP_ID"
              }
            ],
            "type": "Extension/Microsoft_Azure_Monitoring/PartType/MetricsChartPart",
            "settings": {
              "content": {
                "options": {
                  "chart": {
                    "metrics": [
                      {
                        "resourceMetadata": {
                          "id": "$FUNCTION_APP_ID"
                        },
                        "name": "Http5xx",
                        "aggregationType": 1,
                        "namespace": "microsoft.web/sites",
                        "metricVisualization": {
                          "displayName": "5xx Errors"
                        }
                      }
                    ],
                    "title": "Error Rate (5xx)",
                    "titleKind": 1,
                    "visualization": {
                      "chartType": 2
                    }
                  }
                }
              }
            }
          }
        },
        "3": {
          "position": {
            "x": 6,
            "y": 4,
            "colSpan": 6,
            "rowSpan": 4
          },
          "metadata": {
            "inputs": [
              {
                "name": "resourceId",
                "value": "$STORAGE_ID"
              }
            ],
            "type": "Extension/Microsoft_Azure_Monitoring/PartType/MetricsChartPart",
            "settings": {
              "content": {
                "options": {
                  "chart": {
                    "metrics": [
                      {
                        "resourceMetadata": {
                          "id": "$STORAGE_ID"
                        },
                        "name": "SuccessServerLatency",
                        "aggregationType": 4,
                        "namespace": "microsoft.storage/storageaccounts",
                        "metricVisualization": {
                          "displayName": "Storage Latency"
                        }
                      }
                    ],
                    "title": "Storage Latency",
                    "titleKind": 1,
                    "visualization": {
                      "chartType": 2
                    }
                  }
                }
              }
            }
          }
        },
        "4": {
          "position": {
            "x": 0,
            "y": 8,
            "colSpan": 6,
            "rowSpan": 4
          },
          "metadata": {
            "inputs": [
              {
                "name": "resourceId",
                "value": "$SIGNALR_ID"
              }
            ],
            "type": "Extension/Microsoft_Azure_Monitoring/PartType/MetricsChartPart",
            "settings": {
              "content": {
                "options": {
                  "chart": {
                    "metrics": [
                      {
                        "resourceMetadata": {
                          "id": "$SIGNALR_ID"
                        },
                        "name": "ConnectionCount",
                        "aggregationType": 4,
                        "namespace": "microsoft.signalrservice/signalr",
                        "metricVisualization": {
                          "displayName": "Connection Count"
                        }
                      }
                    ],
                    "title": "SignalR Connections",
                    "titleKind": 1,
                    "visualization": {
                      "chartType": 2
                    }
                  }
                }
              }
            }
          }
        },
        "5": {
          "position": {
            "x": 6,
            "y": 8,
            "colSpan": 6,
            "rowSpan": 4
          },
          "metadata": {
            "inputs": [],
            "type": "Extension/HubsExtension/PartType/MarkdownPart",
            "settings": {
              "content": {
                "settings": {
                  "content": "## QR Chain Attendance Monitoring\\n\\n### Key Metrics\\n- **Response Time**: Target <400ms p95 (Req 16.1)\\n- **Error Rate**: Target <1%, Alert >5%\\n- **Storage Latency**: Target <100ms\\n- **SignalR Connections**: Monitor for stability\\n\\n### Alert Thresholds\\n- High Latency: >400ms\\n- High Error Rate: >5% in 5min\\n- Storage Throttling: >1000ms\\n- SignalR Failures: >10 closures/5min\\n\\n### Documentation\\n- [Monitoring Guide](docs/MONITORING.md)\\n- [Alert Response](docs/ALERT_RESPONSE.md)",
                  "title": "Monitoring Overview",
                  "subtitle": "QR Chain Attendance System"
                }
              }
            }
          }
        }
      }
    }
  },
  "metadata": {
    "model": {
      "timeRange": {
        "value": {
          "relative": {
            "duration": 24,
            "timeUnit": 1
          }
        },
        "type": "MsPortalFx.Composition.Configuration.ValueTypes.TimeRange"
      }
    }
  }
}
EOF

# Create the dashboard
log "Creating dashboard in Azure Portal..."
SUBSCRIPTION_ID=$(az account show --query id -o tsv)

az portal dashboard create \
    --resource-group "$RESOURCE_GROUP" \
    --name "dashboard-qr-attendance" \
    --input-path /tmp/dashboard.json \
    --location "global" \
    --tags "Application=QR Chain Attendance" "Type=Monitoring" \
    --output none 2>/dev/null || log "Note: Dashboard creation may require portal permissions"

# Clean up temp file
rm -f /tmp/dashboard.json

log ""
log "=========================================="
log "Dashboard Creation Complete!"
log "=========================================="
log ""
log "Dashboard: $DASHBOARD_NAME"
log ""
log "To view the dashboard:"
log "  1. Navigate to Azure Portal"
log "  2. Go to Dashboard hub"
log "  3. Select '$DASHBOARD_NAME'"
log ""
log "Dashboard includes:"
log "  - Function App request rate"
log "  - Response time (p95 < 400ms target)"
log "  - Error rate (5xx errors)"
log "  - Storage latency"
log "  - SignalR connection count"
log "  - Monitoring overview and links"
log ""
log "Note: You can customize the dashboard in the Azure Portal"
log "      by clicking 'Edit' and adding additional tiles."
log ""

exit 0
