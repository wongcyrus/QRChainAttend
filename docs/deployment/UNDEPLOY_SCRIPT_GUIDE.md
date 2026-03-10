# Undeploy Script Guide

## Purpose

The `undeploy-bicep-and-openai.sh` script allows you to test deployment by removing backend infrastructure while **preserving the Static Web App** (to keep the URL).

## What It Does

### Deletes:
- ✅ Function App
- ✅ Storage Account
- ✅ Application Insights
- ✅ SignalR Service
- ✅ OpenAI/Cognitive Services account
- ✅ AI Foundry projects
- ✅ All other backend resources

### Preserves:
- ✅ Static Web App (frontend)
- ✅ Static Web App URL
- ✅ Static Web App configuration

## Usage

### Basic Usage (Development)
```bash
./undeploy-bicep-and-openai.sh
```

### With Options
```bash
./undeploy-bicep-and-openai.sh -e dev -g rg-qr-attendance-dev -l eastus2
```

### Options
- `-e, --environment` - Environment (dev|staging|prod). Default: dev
- `-g, --resource-group` - Resource group. Default: rg-qr-attendance-<environment>
- `-l, --location` - Azure location. Default: eastus2
- `-h, --help` - Show help

## Safety Features

### Production Protection
If running against production:
- Requires typing `DELETE-PROD` exactly
- Extra confirmation step
- Clear warning messages

### Tenant Validation
- Validates Azure tenant context
- Checks for tenant mismatches
- Prevents accidental cross-tenant operations

### Graceful Deletion
- Deletes nested resources first (projects before OpenAI account)
- Waits for deletions to complete
- Purges soft-deleted Cognitive Services accounts
- Handles missing resources gracefully

## Workflow

### Step 1: Find Static Web App
```
Finding Static Web App...
Found Static Web App: swa-qr-attendance-dev
This will be preserved.
```

### Step 2: Delete Projects
```
Deleting project resource first...
Deleting additional project: openai-qrattendance-dev-project
```

### Step 3: Delete Resources (Except SWA)
```
Deleting resources (except Static Web App)...
  Deleting: func-qr-attendance-dev
  Deleting: stqrattendancedev
  Deleting: appi-qr-attendance-dev
  Deleting: signalr-qrattendance-dev
  Deleting: openai-qrattendance-dev
```

### Step 4: Purge Deleted Accounts
```
Purging deleted Cognitive Services accounts...
Purging deleted account (dev scope): openai-qrattendance-dev
```

### Step 5: Verify Cleanup
```
Verifying OpenAI cleanup...
✓ OpenAI account removed from dev resource group
✓ Foundry projects removed for openai-qrattendance-dev
```

## After Undeploy

### What Remains:
- Static Web App (frontend)
- Resource Group (empty except for SWA)

### To Redeploy:
```bash
./deploy-full-development.sh
```

This will:
1. Recreate all backend infrastructure
2. Link to existing Static Web App
3. Deploy backend functions
4. Configure all settings
5. System ready to use

## Use Cases

### 1. Test Clean Deployment
```bash
# Remove everything except SWA
./undeploy-bicep-and-openai.sh

# Deploy fresh
./deploy-full-development.sh
```

### 2. Fix Broken Infrastructure
```bash
# Remove corrupted resources
./undeploy-bicep-and-openai.sh

# Redeploy clean
./deploy-full-development.sh
```

### 3. Reset Development Environment
```bash
# Clean slate
./undeploy-bicep-and-openai.sh

# Fresh start
./deploy-full-development.sh
```

### 4. Test Bicep Changes
```bash
# Remove old infrastructure
./undeploy-bicep-and-openai.sh

# Deploy with new Bicep
./deploy-full-development.sh
```

## Important Notes

### Static Web App Preservation
- The Static Web App is **never deleted**
- This preserves your frontend URL
- Frontend code remains deployed
- Only backend is removed

### Resource Group
- Resource group is **not deleted**
- Only resources inside are removed
- Static Web App remains in the group

### Soft Delete
- Cognitive Services accounts are soft-deleted
- Script automatically purges them
- Allows immediate redeployment

### Timing
- Full undeploy takes ~2-3 minutes
- Includes wait times for deletions
- Purge operations are asynchronous

## Verification

After running the script, verify:

```bash
# List remaining resources
az resource list --resource-group rg-qr-attendance-dev --output table

# Should only show Static Web App
# Name                          Type
# ----------------------------  -------------------------
# swa-qr-attendance-dev         Microsoft.Web/staticSites
```

## Troubleshooting

### "OpenAI account still present"
- Wait a few more minutes
- Run the script again
- Check Azure Portal for deletion status

### "Remaining projects"
- Projects may take time to delete
- Run script again after 5 minutes
- Check if projects are actually blocking

### "Tenant mismatch"
```bash
az logout
az login --tenant 8ff7db19-435d-4c3c-83d3-ca0a46234f51
```

### "Resource not found"
- This is normal if resource was already deleted
- Script handles this gracefully
- Continue with deployment

## Summary

The undeploy script is safe to use for testing deployments. It:
- ✅ Preserves your Static Web App and URL
- ✅ Removes all backend infrastructure
- ✅ Allows clean redeployment
- ✅ Handles edge cases gracefully
- ✅ Includes safety checks for production

Perfect for testing deployment scripts and infrastructure changes!
