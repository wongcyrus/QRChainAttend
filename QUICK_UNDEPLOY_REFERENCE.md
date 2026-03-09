# Quick Undeploy Reference

## One Command
```bash
./undeploy-bicep-and-openai.sh
```

## What Happens
```
✓ Static Web App preserved (keeps URL)
✗ Function App deleted
✗ Storage Account deleted
✗ Application Insights deleted
✗ SignalR Service deleted
✗ OpenAI account deleted
✗ AI projects deleted
```

## Then Redeploy
```bash
./deploy-full-development.sh
```

## Quick Check
```bash
# Should only show Static Web App
az resource list --resource-group rg-qr-attendance-dev --output table
```

## Use When
- Testing deployment scripts
- Fixing broken infrastructure
- Resetting development environment
- Testing Bicep changes

## Safety
- ✅ Preserves Static Web App
- ✅ Preserves frontend URL
- ✅ Tenant validation
- ✅ Production confirmation required
- ✅ Graceful error handling

That's it!
