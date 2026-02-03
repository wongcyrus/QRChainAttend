# QR Chain Attendance System - Alert Response Procedures

This document provides step-by-step procedures for responding to monitoring alerts in the QR Chain Attendance System.

## Overview

When an alert fires, follow the procedures in this document to investigate, diagnose, and resolve the issue. Each alert has specific response steps and escalation criteria.

## General Response Workflow

```
Alert Received
     │
     ▼
Acknowledge Alert
     │
     ▼
Initial Assessment (5 min)
     │
     ├─> Simple Fix? ──> Apply Fix ──> Verify ──> Close
     │
     ▼
Deep Investigation (15 min)
     │
     ├─> Root Cause Found? ──> Implement Solution ──> Verify ──> Close
     │
     ▼
Escalate to Engineering
     │
     ▼
Incident Management
```

## Alert Response Matrix

| Alert | Severity | Response Time | Escalation Time |
|-------|----------|---------------|-----------------|
| Function App Availability | Critical (1) | Immediate | 15 minutes |
| High Latency | Warning (2) | 15 minutes | 30 minutes |
| High Error Rate | Warning (2) | 15 minutes | 30 minutes |
| Storage Throttling | Info (3) | 30 minutes | 1 hour |
| SignalR Failures | Info (3) | 30 minutes | 1 hour |

## Alert 1: Function App Availability (Critical)

### Alert Details
- **Trigger**: More than 5 HTTP 5xx errors in 5 minutes
- **Severity**: 1 (Critical)
- **Impact**: Backend API is unavailable or severely degraded
- **SLA Impact**: Yes - system is down

### Immediate Actions (0-5 minutes)

1. **Acknowledge the alert** in Azure Portal or email

2. **Check Function App status**:
   ```bash
   az functionapp show \
     --name func-qrattendance-prod \
     --resource-group rg-qr-attendance-prod \
     --query state -o tsv
   ```

3. **Verify Azure service health**:
   - Navigate to Azure Portal > Service Health
   - Check for any ongoing incidents affecting Azure Functions

4. **Check recent deployments**:
   ```bash
   az functionapp deployment list \
     --name func-qrattendance-prod \
     --resource-group rg-qr-attendance-prod \
     --query "[0].{id:id, status:status, time:startTime}" -o table
   ```

### Investigation (5-15 minutes)

5. **Review Application Insights exceptions**:
   - Navigate to Application Insights > Failures
   - Filter by last 15 minutes
   - Group by exception type
   - Identify most common error

6. **Check dependency health**:
   ```kusto
   dependencies
   | where timestamp > ago(15m)
   | where success == false
   | summarize count() by name, resultCode
   | order by count_ desc
   ```

7. **Review function logs**:
   ```kusto
   traces
   | where timestamp > ago(15m)
   | where severityLevel >= 3
   | project timestamp, message, severityLevel
   | order by timestamp desc
   ```

### Common Causes and Solutions

#### Cause 1: Storage Connection Failure

**Symptoms**: Errors mentioning "storage", "table", or "connection"

**Solution**:
```bash
# Verify storage account is accessible
az storage account show \
  --name stqrattendanceprod \
  --resource-group rg-qr-attendance-prod \
  --query provisioningState -o tsv

# Check managed identity role assignment
az role assignment list \
  --assignee <function-app-principal-id> \
  --scope <storage-account-id> \
  --query "[?roleDefinitionName=='Storage Table Data Contributor']"
```

**Fix**: Re-assign Storage Table Data Contributor role if missing

#### Cause 2: SignalR Connection Failure

**Symptoms**: Errors mentioning "signalr" or "connection string"

**Solution**:
```bash
# Verify SignalR service is running
az signalr show \
  --name signalr-qrattendance-prod \
  --resource-group rg-qr-attendance-prod \
  --query provisioningState -o tsv

# Check connection string configuration
az functionapp config appsettings list \
  --name func-qrattendance-prod \
  --resource-group rg-qr-attendance-prod \
  --query "[?name=='SIGNALR_CONNECTION_STRING'].value" -o tsv
```

**Fix**: Update connection string if invalid

#### Cause 3: Recent Deployment Issue

**Symptoms**: Errors started immediately after deployment

**Solution**:
```bash
# Rollback to previous deployment
az functionapp deployment source show \
  --name func-qrattendance-prod \
  --resource-group rg-qr-attendance-prod

# Trigger rollback via GitHub Actions or manual deployment
```

**Fix**: Rollback to last known good deployment

### Escalation Criteria

Escalate to engineering team if:
- Issue persists after 15 minutes
- Root cause is not identified
- Multiple dependencies are failing
- Azure service health incident is confirmed

### Post-Incident Actions

1. Document root cause in incident log
2. Update monitoring thresholds if needed
3. Create follow-up tasks for prevention
4. Update runbooks with new learnings

---

## Alert 2: High Latency (Warning)

### Alert Details
- **Trigger**: p95 latency exceeds 400ms (Requirement 16.1)
- **Severity**: 2 (Warning)
- **Impact**: Degraded user experience, SLA violation
- **SLA Impact**: Yes - performance requirement not met

### Immediate Actions (0-5 minutes)

1. **Acknowledge the alert**

2. **Check current load**:
   ```kusto
   requests
   | where timestamp > ago(5m)
   | summarize count() by bin(timestamp, 1m)
   | render timechart
   ```

3. **Verify latency spike**:
   ```kusto
   requests
   | where timestamp > ago(15m)
   | summarize 
       p50 = percentile(duration, 50),
       p95 = percentile(duration, 95),
       p99 = percentile(duration, 99)
       by bin(timestamp, 1m)
   | render timechart
   ```

### Investigation (5-15 minutes)

4. **Identify slow operations**:
   ```kusto
   requests
   | where timestamp > ago(15m)
   | where duration > 400
   | summarize count(), avg(duration) by name
   | order by count_ desc
   ```

5. **Check dependency latency**:
   ```kusto
   dependencies
   | where timestamp > ago(15m)
   | summarize avg(duration), max(duration) by name
   | order by avg_duration desc
   ```

6. **Check for storage throttling**:
   ```bash
   az monitor metrics list \
     --resource <storage-account-id> \
     --metric SuccessServerLatency \
     --start-time $(date -u -d '15 minutes ago' +%Y-%m-%dT%H:%M:%SZ) \
     --interval PT1M \
     --aggregation Average
   ```

### Common Causes and Solutions

#### Cause 1: Storage Throttling

**Symptoms**: Storage dependency latency >1000ms

**Solution**:
- Check partition key usage in queries
- Verify all hot-path queries use PartitionKey=sessionId
- Review transaction rate limits

**Fix**: Optimize queries or upgrade storage tier

#### Cause 2: High Concurrent Load

**Symptoms**: High request rate, all operations slow

**Solution**:
- Check active session count
- Review concurrent user count
- Verify Function App scaling

**Fix**: Function App should auto-scale, but verify scaling is working

#### Cause 3: Cold Start Delays

**Symptoms**: First request after idle period is slow

**Solution**:
- Check if Function App is on Consumption plan
- Review cold start frequency

**Fix**: Consider Premium plan for production if cold starts are frequent

### Escalation Criteria

Escalate if:
- Latency remains >400ms for >30 minutes
- Storage throttling is confirmed and persistent
- No obvious cause is identified
- Multiple sessions are affected

### Mitigation Actions

If issue cannot be resolved immediately:
1. Notify users of degraded performance
2. Consider temporarily limiting new session creation
3. Monitor closely for further degradation

---

## Alert 3: High Error Rate (Warning)

### Alert Details
- **Trigger**: Error rate exceeds 5% in 5 minutes
- **Severity**: 2 (Warning)
- **Impact**: Users experiencing scan failures
- **SLA Impact**: Partial - some operations failing

### Immediate Actions (0-5 minutes)

1. **Acknowledge the alert**

2. **Check error rate**:
   ```kusto
   requests
   | where timestamp > ago(15m)
   | summarize 
       total = count(),
       failures = countif(success == false)
   | extend errorRate = (failures * 100.0) / total
   ```

3. **Identify error types**:
   ```kusto
   requests
   | where timestamp > ago(15m)
   | where success == false
   | summarize count() by resultCode
   | order by count_ desc
   ```

### Investigation (5-15 minutes)

4. **Review exception details**:
   ```kusto
   exceptions
   | where timestamp > ago(15m)
   | summarize count() by type, outerMessage
   | order by count_ desc
   ```

5. **Check for patterns**:
   - Are errors affecting specific operations?
   - Are errors affecting specific sessions?
   - Are errors related to specific users?

6. **Review recent changes**:
   - Configuration changes
   - Code deployments
   - Infrastructure changes

### Common Causes and Solutions

#### Cause 1: Token Expiration Issues

**Symptoms**: Errors mentioning "expired" or "invalid token"

**Investigation**:
```kusto
traces
| where timestamp > ago(15m)
| where message contains "token" and message contains "expired"
| summarize count() by bin(timestamp, 1m)
```

**Solution**: Check token rotation timer function is running

#### Cause 2: Rate Limiting Triggered

**Symptoms**: Errors mentioning "rate limit" or "too many requests"

**Investigation**:
```kusto
customEvents
| where timestamp > ago(15m)
| where name == "RateLimitViolation"
| summarize count() by tostring(customDimensions.limitType)
```

**Solution**: 
- Check if legitimate traffic spike
- Investigate potential abuse
- Adjust rate limits if needed

#### Cause 3: Location Validation Failures

**Symptoms**: Errors mentioning "geofence" or "wifi"

**Investigation**:
```kusto
traces
| where timestamp > ago(15m)
| where message contains "location" or message contains "geofence"
| summarize count()
```

**Solution**:
- Verify location constraints are correctly configured
- Check if classroom Wi-Fi is having issues
- Consider temporarily disabling location validation

### Escalation Criteria

Escalate if:
- Error rate remains >5% for >30 minutes
- Errors are affecting multiple sessions
- Root cause is not clear
- Errors indicate a security issue

---

## Alert 4: Storage Throttling (Informational)

### Alert Details
- **Trigger**: Storage latency exceeds 1000ms
- **Severity**: 3 (Informational)
- **Impact**: Potential performance degradation
- **SLA Impact**: Possible if sustained

### Immediate Actions (0-10 minutes)

1. **Acknowledge the alert**

2. **Check storage metrics**:
   ```bash
   az monitor metrics list \
     --resource <storage-account-id> \
     --metric "SuccessServerLatency,Transactions" \
     --start-time $(date -u -d '30 minutes ago' +%Y-%m-%dT%H:%M:%SZ) \
     --interval PT1M
   ```

3. **Check for hot partitions**:
   ```kusto
   traces
   | where timestamp > ago(30m)
   | where message contains "table" and message contains "operation"
   | extend partitionKey = tostring(customDimensions.partitionKey)
   | summarize count() by partitionKey
   | order by count_ desc
   ```

### Investigation (10-30 minutes)

4. **Review query patterns**:
   - Are all queries using partition key?
   - Are there any full table scans?
   - Are batch operations being used?

5. **Check transaction rate**:
   ```bash
   az monitor metrics list \
     --resource <storage-account-id> \
     --metric Transactions \
     --start-time $(date -u -d '1 hour ago' +%Y-%m-%dT%H:%M:%SZ) \
     --interval PT1M \
     --aggregation Total
   ```

### Common Causes and Solutions

#### Cause 1: Missing Partition Key in Queries

**Solution**: Review code for queries without partition key

**Fix**: Ensure all hot-path queries include PartitionKey=sessionId

#### Cause 2: High Transaction Rate

**Solution**: Check if transaction rate is within limits

**Fix**: Implement batching or caching where appropriate

#### Cause 3: Hot Partition

**Solution**: Identify if single session is generating excessive traffic

**Fix**: May require session-level throttling or optimization

### Escalation Criteria

Escalate if:
- Throttling persists for >1 hour
- Latency is affecting user experience
- Transaction rate is unexpectedly high
- Optimization opportunities are not obvious

---

## Alert 5: SignalR Connection Failures (Informational)

### Alert Details
- **Trigger**: More than 10 connection closures in 5 minutes
- **Severity**: 3 (Informational)
- **Impact**: Teacher dashboard may not receive real-time updates
- **SLA Impact**: Minimal - dashboard can be refreshed manually

### Immediate Actions (0-10 minutes)

1. **Acknowledge the alert**

2. **Check SignalR service health**:
   ```bash
   az signalr show \
     --name signalr-qrattendance-prod \
     --resource-group rg-qr-attendance-prod \
     --query provisioningState -o tsv
   ```

3. **Review connection logs**:
   ```kusto
   traces
   | where timestamp > ago(15m)
   | where message contains "signalr" or message contains "connection"
   | project timestamp, message, severityLevel
   | order by timestamp desc
   ```

### Investigation (10-30 minutes)

4. **Check connection patterns**:
   - Are connections closing normally or abnormally?
   - Are reconnections successful?
   - Are specific users affected?

5. **Review SignalR metrics**:
   ```bash
   az monitor metrics list \
     --resource <signalr-id> \
     --metric "ConnectionCount,MessageCount" \
     --start-time $(date -u -d '30 minutes ago' +%Y-%m-%dT%H:%M:%SZ) \
     --interval PT1M
   ```

### Common Causes and Solutions

#### Cause 1: Client Network Issues

**Symptoms**: Connections closing and reconnecting frequently

**Solution**: Check if specific network or location is affected

**Fix**: May be client-side issue, no action needed

#### Cause 2: SignalR Service Scaling

**Symptoms**: Brief spike in connection closures

**Solution**: Check if SignalR service is scaling

**Fix**: No action needed if connections recover

#### Cause 3: Authentication Issues

**Symptoms**: Connections failing to establish

**Solution**: Check SignalR connection string and authentication

**Fix**: Verify managed identity and role assignments

### Escalation Criteria

Escalate if:
- Connection failures persist for >1 hour
- Teachers report dashboard not updating
- SignalR service health is degraded
- Authentication issues are suspected

---

## Escalation Contacts

### Level 1: Operations Team
- **Contact**: ops-team@example.com
- **Response Time**: 15 minutes
- **Escalate For**: All severity 1 and 2 alerts

### Level 2: Engineering Team
- **Contact**: engineering@example.com
- **Response Time**: 30 minutes
- **Escalate For**: Unresolved issues after 30 minutes

### Level 3: On-Call Engineer
- **Contact**: oncall@example.com
- **Response Time**: Immediate
- **Escalate For**: Critical issues affecting production

## Post-Alert Actions

After resolving an alert:

1. **Document the incident**:
   - Root cause
   - Actions taken
   - Resolution time
   - Lessons learned

2. **Update monitoring**:
   - Adjust alert thresholds if needed
   - Add new alerts for gaps identified
   - Update dashboard with new metrics

3. **Improve prevention**:
   - Create follow-up tasks
   - Update documentation
   - Implement additional monitoring

4. **Communicate**:
   - Notify stakeholders of resolution
   - Share incident report
   - Update status page

## Related Documentation

- [Monitoring Setup](MONITORING.md)
- [Deployment Guide](../DEPLOYMENT_GUIDE.md)
- [Troubleshooting Guide](TROUBLESHOOTING.md)

