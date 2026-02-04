# Backend Deployment Status

## Current Status: ⚠️ Functions Load Locally, Azure Deployment Issue

### What Works ✅

1. **All 20 functions load successfully locally**
   - 19 HTTP triggers
   - 1 timer trigger (rotateTokens)
   - Verified with `func start` - all functions register correctly

2. **Code Structure**
   - Using glob pattern approach: `"main": "dist/functions/*.js"`
   - Each function file has its own `app.http()` or `app.timer()` registration
   - Follows Azure Functions v4 Node.js programming model
   - All async handlers properly structured
   - Services use lazy initialization pattern

3. **Dependencies**
   - `@azure/functions` upgraded to v4.11.1 (latest)
   - All required packages installed
   - TypeScript compilation successful

### What Doesn't Work ❌

**Azure Deployment shows 0 functions** despite:
- Correct code structure (verified locally)
- Multiple deployment attempts (Linux and Windows Function Apps)
- Various deployment methods tried (func publish, zip deploy)
- All Azure app settings configured correctly
- Function Apps are running and healthy

### Troubleshooting Completed

1. ✅ Fixed duplicate function registrations
2. ✅ Tried single-file entry point approach
3. ✅ Tried glob pattern approach (official template method)
4. ✅ Upgraded @azure/functions package
5. ✅ Set all required app settings:
   - `FUNCTIONS_NODE_BLOCK_ON_ENTRY_POINT_ERROR=true`
   - `AzureWebJobsFeatureFlags=EnableWorkerIndexing`
   - `WEBSITE_RUN_FROM_PACKAGE=0`
6. ✅ Verified Node.js version (20)
7. ✅ Verified Functions runtime version (~4)
8. ✅ Tested on both Linux and Windows Function Apps
9. ✅ Created minimal test function - still fails

### Root Cause Analysis

The issue appears to be with the Azure Function App resources themselves, not the code:
- Same code works perfectly locally
- Both Linux (`func-qrattendance-dev`) and Windows (`func-qrattendance-dev-win`) Function Apps show identical behavior
- No logs appear in Application Insights
- Function Apps respond but show 0 functions
- Even minimal single-function test fails to deploy

### Recommended Next Steps

1. **Create a brand new Function App resource**
   - Use Azure Portal or CLI to create fresh Function App
   - Ensure Node.js 20, Linux, Functions v4
   - Deploy to new resource

2. **Alternative: Use Azure Static Web Apps Managed Functions**
   - Static Web Apps have built-in API support
   - May have better v4 Node.js support
   - Already have Static Web App deployed

3. **Contact Azure Support**
   - Provide Function App names and resource group
   - Reference this troubleshooting document
   - Request investigation of why v4 functions won't load

### Function App Details

**Linux Function App:**
- Name: `func-qrattendance-dev`
- Resource Group: `rg-qr-attendance-dev`
- Runtime: Node.js 20, Functions v4
- Status: Running, but 0 functions detected

**Windows Function App:**
- Name: `func-qrattendance-dev-win`
- Resource Group: `rg-qr-attendance-dev`
- Runtime: Node.js 20, Functions v4
- Status: Running, but 0 functions detected

### Code Repository

All code is committed and pushed to: `main` branch
- Commit: `8ec0249` - "fix: Azure Functions v4 registration - use glob pattern approach"
- All 20 functions properly structured
- Ready for deployment to new Function App resource

---

**Last Updated:** 2026-02-04
**Status:** Awaiting new Function App resource or Azure support investigation
