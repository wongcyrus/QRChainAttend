# SignalR Configuration Guide

## Overview

SignalR is **OPTIONAL** in this system. The application works perfectly with polling fallback, which is actually recommended for most use cases.

## Why Use SignalR Standard S1 in Production

### Benefits
- **Real-time delivery**: Quiz questions appear instantly (<1 second)
- **Better UX**: No waiting for polling intervals
- **Reduced API calls**: ~97% reduction in API calls vs polling
- **Scalable**: Supports up to 1,000 concurrent students
- **Reliable**: Automatic reconnection and fallback to polling

### Cost
- **Standard S1**: ~$50/month fixed cost
- **Worth it for**: Production deployments with real-time requirements
- **Alternative**: Polling works fine but has 5-second average latency

## Current Configuration

### Production (Standard S1 Tier - Enabled)
```bicep
// infrastructure/parameters/prod.bicepparam
param deploySignalR = true  // Enabled with Standard S1 tier
```

**Tier**: Standard S1
- **Concurrent connections**: 1,000
- **Messages per day**: 1,000,000
- **Cost**: ~$50/month
- **Supports**: Large classes (up to 1000 students)

**Behavior**:
- Students receive quiz questions instantly via SignalR
- Real-time session status updates
- Polling disabled when SignalR connected
- Console shows: "SignalR connected"
- Falls back to polling if SignalR unavailable

### Development (Free Tier)
```bicep
// Uses Free tier automatically for dev environment
param deploySignalR = true
```

**Tier**: Free F1
- **Concurrent connections**: 20
- **Messages per day**: 20,000
- **Cost**: Free
- **Supports**: Small test classes

**Behavior**:
- Same as production but with connection limits
- Good for local testing with <20 students

## When to Use SignalR

### Production (Current Configuration)
✅ **SignalR Standard S1 Enabled**
- Real-time quiz delivery
- Supports up to 1,000 students
- ~$50/month cost
- Best user experience

### Development
✅ **SignalR Free Tier**
- Good for testing with <20 students
- Free tier sufficient
- Same features as production

### When to Disable SignalR
⚠️ **Consider disabling if**:
- Budget constraints (saves $50/month)
- 5-second polling latency is acceptable
- Want to minimize Azure resources
- Testing polling fallback behavior

## How to Enable SignalR (Already Enabled in Production)

SignalR is already enabled in production with Standard S1 tier. To verify or modify:

### Current Configuration
```bicep
// infrastructure/parameters/prod.bicepparam
param deploySignalR = true  // ✅ Already enabled
```

### To Change Tier (if needed)
Edit `infrastructure/modules/signalr.bicep`:
```bicep
// Current: Auto-selects Free for dev, Standard S1 for prod
var sku = environment == 'dev' ? {
  name: 'Free_F1'
  tier: 'Free'
  capacity: 1
} : {
  name: 'Standard_S1'
  tier: 'Standard'
  capacity: 1  // Can increase to 100 if needed
}
```

### To Scale Up (for >1000 students)
```bicep
var sku = {
  name: 'Standard_S1'
  tier: 'Standard'
  capacity: 2  // 2000 connections, ~$100/month
}
```

## How to Disable SignalR

### Step 1: Update Parameters
Edit `infrastructure/parameters/prod.bicepparam`:
```bicep
param deploySignalR = false  // Disable SignalR
```

### Step 2: Redeploy
```bash
./deploy-full-production.sh
```

### Step 3: (Optional) Delete Existing SignalR Resource
```bash
az signalr delete \
  --name signalr-qrattendance-prod \
  --resource-group rg-qr-attendance-prod
```

## Performance Comparison

### With SignalR Standard S1 (Current Production)
| Metric | Value | Notes |
|--------|-------|-------|
| Quiz latency | <1 second | Real-time delivery |
| Status latency | <1 second | Real-time updates |
| API calls/student/hour | ~12 | Only negotiate + heartbeat |
| Connection limit | 1,000 students | Can scale to 100,000 |
| Cost | $50/month | Fixed cost |
| User experience | Excellent | Instant feedback |

### With Polling (Fallback)
| Metric | Value | Notes |
|--------|-------|-------|
| Quiz latency | 0-5 seconds | Average 2.5s |
| Status latency | 0-15 seconds | Average 7.5s |
| API calls/student/hour | ~360 | 240 status + 120 quiz |
| Connection limit | Unlimited | No restrictions |
| Cost impact | Minimal | ~$0.20/million calls |
| User experience | Good | Acceptable delay |

## Monitoring

### Check Current Configuration
```bash
# Check if SignalR is deployed
az signalr list --resource-group rg-qr-attendance-prod

# Check Function App SignalR connection string
az functionapp config appsettings list \
  --name func-qrattendance-prod \
  --resource-group rg-qr-attendance-prod \
  --query "[?name=='SIGNALR_CONNECTION_STRING'].value" -o tsv
```

### Check Student Connection Status
1. Open student view in browser
2. Open browser console (F12)
3. Look for messages:
   - `"SignalR connected"` - SignalR is working
   - `"SignalR not connected, enabling fallback polling"` - Using polling
   - `"[Quiz] SignalR connected, disabling polling"` - Real-time quiz delivery

### Check Backend Logs
```bash
# Stream Function App logs
az functionapp log tail \
  --name func-qrattendance-prod \
  --resource-group rg-qr-attendance-prod
```

Look for:
- `"SignalR not configured, skipping quiz question broadcast"` - Polling mode
- `"Broadcasting quiz question to: https://..."` - SignalR mode

## Troubleshooting

### Students Not Receiving Questions
**Symptom**: Questions don't appear on student screens

**Check**:
1. Browser console - is polling active?
2. Network tab - are API calls succeeding?
3. Backend logs - are questions being sent?

**Solution**: Polling should work automatically. Check for network issues or backend errors.

### SignalR Connection Failures
**Symptom**: Console shows "SignalR connection failed"

**Check**:
1. Is SignalR deployed? (`az signalr list`)
2. Is connection string valid? (Check Function App settings)
3. Are there >20 students? (Free tier limit)

**Solution**: Either upgrade to Standard tier or disable SignalR (use polling).

### High Azure Function Costs
**Symptom**: Unexpected Azure Functions charges

**Check**:
1. How many students are active?
2. What are the polling intervals?
3. Are there unnecessary API calls?

**Solution**: 
- Polling is efficient: ~360 calls/student/hour
- For 30 students: ~10,800 calls/hour = ~260K calls/day
- Cost: ~$0.05/day (well within free tier of 1M calls/month)

## Recommendations

### For Production (Current)
✅ **Use SignalR Standard S1** - Best user experience
- Real-time quiz delivery
- Supports up to 1,000 students
- Professional-grade reliability
- Worth the $50/month cost

### For Development
✅ **Use SignalR Free tier** - Good for testing
- Same features as production
- Free tier sufficient for <20 test users
- Tests real-time behavior

### For Budget-Conscious Deployments
⚠️ **Consider polling** - Disable SignalR to save $50/month
- 5-second quiz latency is acceptable
- Works with unlimited students
- Lower operational cost

## Summary

**Production is configured with SignalR Standard S1 for optimal performance.** This provides real-time quiz delivery, supports large classes (up to 1,000 students), and offers the best user experience. The system automatically falls back to polling if SignalR is unavailable, ensuring reliability.
