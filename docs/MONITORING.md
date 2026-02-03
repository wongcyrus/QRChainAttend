# QR Chain Attendance System - Monitoring and Alerting

This document describes the monitoring and alerting configuration for the QR Chain Attendance System, including Application Insights setup, custom metrics, alert rules, and operational procedures.

## Overview

The system uses Azure Application Insights and Log Analytics for comprehensive monitoring, with custom metrics for scan operations and automated alerts for critical issues.

### Requirements Satisfied

- **Requirement 15.6**: Scan logs retained for 90 days
- **Requirement 16.1**: Scan operations complete in <400ms p95 latency

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Monitoring Stack                         │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌──────────────────┐         ┌──────────────────┐        │
│  │ Function App     │────────>│ App Insights     │        │
│  │ (Telemetry)      │         │ (Metrics/Logs)   │        │
│  └──────────────────┘         └────────┬─────────┘        │
│                                         │                   │
│  ┌──────────────────┐                  │                   │
│  │ Storage Account  │──────────────────┤                   │
│  │ (Diagnostics)    │                  │                   │
│  └──────────────────┘                  │                   │
│                                         │                   │
│  ┌──────────────────┐                  │                   │
│  │ SignalR Service  │──────────────────┤                   │
│  │ (Diagnostics)    │                  │                   │
│  └──────────────────┘                  │                   │
│                                         ▼                   │
│                              ┌──────────────────┐          │
│                              │ Log Analytics    │          │
│                              │ Workspace        │          │
│                              │ (90-day retain)  │          │
│                              └────────┬─────────┘          │
│                                       │                     │
│                                       ▼                     │
│                              ┌──────────────────┐          │
│                              │ Alert Rules      │          │
│                              │ (Metric-based)   │          │
│                              └────────┬─────────┘          │
│                                       │                     │
│                                       ▼                     │
│                              ┌──────────────────┐          │
│                              │ Action Group     │          │
│                              │ (Email/SMS)      │          │
│                              └──────────────────┘          │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

## Setup

### Prerequisites

- Azure CLI installed and logged in
- Owner or Contributor role on the resource group
- Email address for alert notifications

### Configuration Script

Run the monitoring configuration script to set up all monitoring components:

#### Bash (Linux/macOS)

```bash
chmod +x scripts/configure-monitoring.sh

./scripts/configure-monitoring.sh \
  --resource-group rg-qr-attendance-prod \
  --function-app func-qrattendance-prod \
  --app-insights appi-qrattendance-prod \
  --storage-account stqrattendanceprod \
  --signalr signalr-qrattendance-prod \
  --environment prod \
  --email ops-team@example.com
```

#### PowerShell (Windows)

```powershell
.\scripts\configure-monitoring.ps1 `
  -ResourceGroup rg-qr-attendance-prod `
  -FunctionAppName func-qrattendance-prod `
  -AppInsightsName appi-qrattendance-prod `
  -StorageAccountName stqrattendanceprod `
  -SignalRName signalr-qrattendance-prod `
  -Environment prod `
  -ActionGroupEmail ops-team@example.com
```

### What the Script Configures

1. **Log Retention**: 90 days for all logs (Requirement 15.6)
2. **Action Group**: Email notifications for alerts
3. **Metric Alerts**: 5 critical alerts (see below)
4. **Diagnostic Settings**: Logs and metrics for all resources
5. **Application Insights**: Custom metrics configuration

## Custom Metrics

The system tracks custom metrics for scan operations to enable detailed monitoring and alerting.

### Scan Operation Metrics

#### 1. Scan Latency (p50, p95, p99)

Tracks the time taken for scan operations from request to response.

**Implementation**:
```typescript
// In scan processing functions
const startTime = Date.now();
try {
  // Process scan
  const result = await processChainScan(params);
  
  // Track success latency
  const duration = Date.now() - startTime;
  telemetryClient.trackMetric({
    name: 'ScanLatency',
    value: duration,
    properties: {
      flow: 'ENTRY_CHAIN',
      result: 'SUCCESS'
    }
  });
} catch (error) {
  // Track failure latency
  const duration = Date.now() - startTime;
  telemetryClient.trackMetric({
    name: 'ScanLatency',
    value: duration,
    properties: {
      flow: 'ENTRY_CHAIN',
      result: 'FAILURE'
    }
  });
}
```

**Query** (Log Analytics):
```kusto
customMetrics
| where name == "ScanLatency"
| summarize 
    p50 = percentile(value, 50),
    p95 = percentile(value, 95),
    p99 = percentile(value, 99)
    by bin(timestamp, 5m)
| render timechart
```

#### 2. Scan Success/Failure Rates

Tracks the ratio of successful to failed scan attempts.

**Implementation**:
```typescript
telemetryClient.trackMetric({
  name: 'ScanResult',
  value: result.success ? 1 : 0,
  properties: {
    flow: scanFlow,
    errorCode: result.error || 'NONE'
  }
});
```

**Query**:
```kusto
customMetrics
| where name == "ScanResult"
| summarize 
    total = count(),
    successes = countif(value == 1),
    failures = countif(value == 0)
    by bin(timestamp, 5m)
| extend successRate = (successes * 100.0) / total
| render timechart
```

#### 3. Token Consumption Rate

Tracks how quickly tokens are being consumed.

**Implementation**:
```typescript
telemetryClient.trackMetric({
  name: 'TokenConsumption',
  value: 1,
  properties: {
    tokenType: token.type,
    sessionId: token.sessionId
  }
});
```

**Query**:
```kusto
customMetrics
| where name == "TokenConsumption"
| summarize count() by bin(timestamp, 1m), tostring(customDimensions.tokenType)
| render timechart
```

#### 4. Chain Stall Detection

Tracks when chains become stalled (idle > 90s).

**Implementation**:
```typescript
telemetryClient.trackEvent({
  name: 'ChainStalled',
  properties: {
    sessionId: chain.sessionId,
    chainId: chain.chainId,
    phase: chain.phase,
    idleSeconds: idleTime
  }
});
```

**Query**:
```kusto
customEvents
| where name == "ChainStalled"
| summarize count() by bin(timestamp, 5m), tostring(customDimensions.phase)
| render timechart
```

#### 5. Rate Limit Violations

Tracks when rate limits are triggered.

**Implementation**:
```typescript
telemetryClient.trackEvent({
  name: 'RateLimitViolation',
  properties: {
    limitType: 'DEVICE', // or 'IP'
    deviceFingerprint: fingerprint,
    ip: ipAddress
  }
});
```

**Query**:
```kusto
customEvents
| where name == "RateLimitViolation"
| summarize count() by bin(timestamp, 5m), tostring(customDimensions.limitType)
| render timechart
```

## Alert Rules

### 1. High Error Rate Alert

**Trigger**: Error rate exceeds 5% in 5 minutes
**Severity**: 2 (Warning)
**Action**: Email notification

**Purpose**: Detect when scan operations are failing at an elevated rate.

**Response Procedure**:
1. Check Application Insights for error details
2. Review recent deployments or configuration changes
3. Check Azure service health status
4. Investigate specific error patterns in logs
5. Escalate if issue persists > 15 minutes

### 2. High Latency Alert (Requirement 16.1)

**Trigger**: p95 latency exceeds 400ms
**Severity**: 2 (Warning)
**Action**: Email notification

**Purpose**: Ensure scan operations meet performance requirements.

**Response Procedure**:
1. Check current system load and concurrent sessions
2. Review Storage Account metrics for throttling
3. Check SignalR Service performance
4. Investigate slow queries in Application Insights
5. Consider scaling if load is high
6. Review recent code changes for performance regressions

### 3. Storage Throttling Alert

**Trigger**: Storage latency exceeds 1000ms
**Severity**: 3 (Informational)
**Action**: Email notification

**Purpose**: Detect when Azure Table Storage is throttling requests.

**Response Procedure**:
1. Check Storage Account metrics in Azure Portal
2. Review partition key distribution (should be sessionId)
3. Check for hot partitions
4. Consider implementing exponential backoff
5. Review query patterns for optimization opportunities

### 4. SignalR Connection Failures Alert

**Trigger**: More than 10 connection closures in 5 minutes
**Severity**: 3 (Informational)
**Action**: Email notification

**Purpose**: Detect issues with real-time dashboard updates.

**Response Procedure**:
1. Check SignalR Service health in Azure Portal
2. Review connection logs for error patterns
3. Check client-side connection handling
4. Verify SignalR connection string configuration
5. Test dashboard connectivity manually

### 5. Function App Availability Alert

**Trigger**: More than 5 HTTP 5xx errors in 5 minutes
**Severity**: 1 (Critical)
**Action**: Email notification

**Purpose**: Detect when the backend API is experiencing critical failures.

**Response Procedure**:
1. Check Function App health in Azure Portal
2. Review Application Insights for exception details
3. Check Azure service health status
4. Verify all dependencies are accessible (Storage, SignalR)
5. Check for recent deployments
6. Consider rollback if issue is deployment-related
7. Escalate immediately if issue persists

## Log Retention

### Configuration

All logs are retained for **90 days** to satisfy Requirement 15.6.

**Configured Resources**:
- Log Analytics Workspace: 90 days
- Application Insights: 90 days
- Function App diagnostic logs: 90 days
- Storage Account diagnostic logs: 90 days
- SignalR Service diagnostic logs: 90 days

### Log Categories

#### Function App Logs
- **FunctionAppLogs**: All function execution logs
- **FunctionExecutionLogs**: Detailed execution traces
- **AllMetrics**: Performance metrics

#### Storage Account Logs
- **Transaction**: All table operations
- **StorageRead**: Read operations
- **StorageWrite**: Write operations

#### SignalR Service Logs
- **AllLogs**: Connection and message logs
- **AllMetrics**: Connection and throughput metrics

### Querying Logs

#### Recent Scan Attempts
```kusto
traces
| where message contains "Scan attempt"
| where timestamp > ago(1h)
| project timestamp, message, severityLevel, customDimensions
| order by timestamp desc
```

#### Failed Scans by Error Type
```kusto
traces
| where message contains "Scan failed"
| where timestamp > ago(24h)
| extend errorCode = tostring(customDimensions.errorCode)
| summarize count() by errorCode
| order by count_ desc
```

#### Scan Latency Over Time
```kusto
customMetrics
| where name == "ScanLatency"
| where timestamp > ago(24h)
| summarize 
    avg(value), 
    percentile(value, 95), 
    percentile(value, 99) 
    by bin(timestamp, 5m)
| render timechart
```

#### Chain Stalls by Session
```kusto
customEvents
| where name == "ChainStalled"
| where timestamp > ago(24h)
| extend sessionId = tostring(customDimensions.sessionId)
| summarize count() by sessionId
| order by count_ desc
```

## Monitoring Dashboard

### Creating a Dashboard

Use the Azure Portal to create a monitoring dashboard:

1. Navigate to Azure Portal > Dashboards
2. Create new dashboard: "QR Attendance Monitoring"
3. Add tiles:
   - **Function App Overview**: Key metrics
   - **Scan Latency Chart**: p95 latency over time
   - **Error Rate Chart**: Success/failure rates
   - **Active Alerts**: Current alert status
   - **Storage Metrics**: Transaction rate and latency
   - **SignalR Metrics**: Connection count and throughput

### Key Metrics to Monitor

| Metric | Target | Alert Threshold |
|--------|--------|-----------------|
| Scan p95 Latency | <300ms | >400ms |
| Error Rate | <1% | >5% |
| Storage Latency | <100ms | >1000ms |
| SignalR Connections | Stable | >10 closures/5min |
| Function Availability | 99.9% | >5 5xx errors/5min |

## Application Insights Integration

### Telemetry Client Setup

```typescript
import { TelemetryClient } from 'applicationinsights';

const telemetryClient = new TelemetryClient(
  process.env.APPLICATIONINSIGHTS_CONNECTION_STRING
);

// Enable auto-collection
telemetryClient.trackNodeHttpDependency = true;
telemetryClient.trackNodeHttpRequestDuration = true;
```

### Custom Event Tracking

```typescript
// Track scan attempt
telemetryClient.trackEvent({
  name: 'ScanAttempt',
  properties: {
    flow: 'ENTRY_CHAIN',
    sessionId: sessionId,
    scannerId: scannerId
  }
});

// Track scan result
telemetryClient.trackEvent({
  name: 'ScanResult',
  properties: {
    flow: 'ENTRY_CHAIN',
    result: 'SUCCESS',
    latencyMs: duration
  },
  measurements: {
    latency: duration
  }
});
```

### Exception Tracking

```typescript
try {
  await processChainScan(params);
} catch (error) {
  telemetryClient.trackException({
    exception: error,
    properties: {
      flow: 'ENTRY_CHAIN',
      sessionId: sessionId,
      operation: 'processChainScan'
    }
  });
  throw error;
}
```

## Performance Monitoring

### Key Performance Indicators (KPIs)

1. **Scan Latency (p95)**: Must be <400ms (Requirement 16.1)
2. **Error Rate**: Target <1%, alert at >5%
3. **Availability**: Target 99.9%
4. **Throughput**: Support 500 concurrent students per session

### Performance Queries

#### Slowest Operations
```kusto
requests
| where timestamp > ago(1h)
| where duration > 400
| project timestamp, name, duration, resultCode
| order by duration desc
| take 20
```

#### Operations by Duration Bucket
```kusto
requests
| where timestamp > ago(24h)
| summarize count() by bin(duration, 100)
| render barchart
```

#### Dependency Performance
```kusto
dependencies
| where timestamp > ago(1h)
| summarize avg(duration), max(duration) by name
| order by avg_duration desc
```

## Troubleshooting

### High Latency

**Symptoms**: p95 latency >400ms

**Investigation Steps**:
1. Check Application Insights performance view
2. Identify slow dependencies (Storage, SignalR)
3. Review query patterns and partition keys
4. Check for hot partitions in Table Storage
5. Review recent code changes

**Common Causes**:
- Storage throttling due to hot partitions
- Inefficient queries (missing partition key)
- High concurrent load
- Network issues
- Cold start delays (Functions)

### High Error Rate

**Symptoms**: Error rate >5%

**Investigation Steps**:
1. Check Application Insights failures view
2. Group errors by type and operation
3. Review recent deployments
4. Check Azure service health
5. Verify configuration and secrets

**Common Causes**:
- Invalid tokens (expired or already used)
- Rate limiting triggered
- Location validation failures
- Storage connection issues
- SignalR connection failures

### Storage Throttling

**Symptoms**: Storage latency >1000ms, 503 errors

**Investigation Steps**:
1. Check Storage Account metrics
2. Review partition key distribution
3. Identify hot partitions
4. Check transaction rate

**Common Causes**:
- All operations on single partition
- Missing partition key in queries
- Excessive concurrent requests
- Inefficient query patterns

**Solutions**:
- Ensure all queries use PartitionKey=sessionId
- Implement exponential backoff
- Batch operations where possible
- Consider Premium Storage tier

## Operational Procedures

### Daily Monitoring Checklist

- [ ] Review overnight alerts
- [ ] Check error rate trends
- [ ] Verify latency is within SLA
- [ ] Review storage and SignalR metrics
- [ ] Check for any anomalies in usage patterns

### Weekly Monitoring Tasks

- [ ] Review alert thresholds and adjust if needed
- [ ] Analyze performance trends
- [ ] Review log retention and costs
- [ ] Check for any recurring issues
- [ ] Update monitoring documentation

### Monthly Monitoring Tasks

- [ ] Review and optimize alert rules
- [ ] Analyze long-term performance trends
- [ ] Review monitoring costs
- [ ] Update monitoring dashboard
- [ ] Conduct monitoring effectiveness review

## Cost Optimization

### Monitoring Costs

**Typical Monthly Costs**:
- Application Insights: $10-20
- Log Analytics: $5-15
- Alert rules: $0.10 per rule
- Action groups: Free (email)

**Cost Optimization Tips**:
1. Use sampling for high-volume telemetry
2. Set appropriate log retention (90 days required)
3. Use workspace-based Application Insights
4. Archive old logs to cheaper storage
5. Review and remove unused alert rules

### Sampling Configuration

```typescript
// Configure sampling to reduce costs
telemetryClient.config.samplingPercentage = 50; // 50% sampling

// Exclude certain operations from sampling
telemetryClient.addTelemetryProcessor((envelope) => {
  if (envelope.data.baseType === 'RequestData') {
    // Always track scan operations
    if (envelope.data.baseData.name.includes('scan')) {
      envelope.sampleRate = 100;
    }
  }
  return true;
});
```

## Related Documentation

- [Alert Response Procedures](ALERT_RESPONSE.md)
- [Deployment Guide](../DEPLOYMENT_GUIDE.md)
- [Design Document](../.kiro/specs/qr-chain-attendance/design.md)
- [Requirements](../.kiro/specs/qr-chain-attendance/requirements.md)

## Support

For monitoring issues or questions:

1. Check this documentation
2. Review Application Insights logs
3. Check Azure service health
4. Consult the troubleshooting section
5. Contact the operations team

