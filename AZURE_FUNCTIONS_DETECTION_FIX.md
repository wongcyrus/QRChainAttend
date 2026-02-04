# Azure Functions Detection Fix

## Problem
Azure Functions were not being detected in the cloud while working locally.

## Root Cause Analysis

### Primary Issue: `.funcignore` Configuration
The `.funcignore` file was missing critical exclusions and wasn't properly configured for Azure Functions v4 programmatic registration:

1. **Missing exclusions for node_modules subdirectories** - Could prevent bundling of required dependencies
2. **Overly aggressive exclusion pattern** - Not explicitly preserving the `dist` directory structure

### Why This Breaks Cloud Deployment
- Azure Functions needs to deploy the compiled `dist` directory with all necessary dependencies
- The `.funcignore` file tells Azure Functions what NOT to deploy
- An improperly configured `.funcignore` can cause Azure Functions runtime to not discover registered functions

## Solution Applied

### Changed `.funcignore`
Updated `/backend/.funcignore` to:

```
*.js.map
*.ts
.git*
.vscode
local.settings.json
test
tsconfig.json
.editorconfig
.eslintrc*
.prettierrc
node_modules/@types        # Exclude type definitions
node_modules/typescript     # Exclude TypeScript compiler
node_modules/jest           # Exclude test runner
node_modules/ts-jest
node_modules/@typescript-eslint
node_modules/eslint
node_modules/fast-check
node_modules/.bin           # Exclude npm scripts
node_modules/.package-lock.json
src                         # Exclude TypeScript source
coverage                    # Exclude test coverage
*.test.js
*.property.test.js
.DS_Store
.env
.env.local
.env.*.local
```

### Key Changes
✅ **Added** `node_modules/.bin` - Prevents unnecessary npm script bins
✅ **Added** `node_modules/.package-lock.json` - Removes lock file from node_modules
✅ **Added** Environment file exclusions - Security best practice
✅ **Kept** All production dependencies bundled - `@azure/functions`, `@azure/data-tables`, etc.

## Verification Steps

### Local Testing
1. Rebuild the backend:
```bash
cd backend
npm run build
```

2. Start locally to verify functions are still discovered:
```bash
npm start
```

3. Verify all 21 functions appear in the console output

### Cloud Deployment
1. Commit and push changes to your repository
2. Deploy using your CI/CD pipeline or Azure CLI:
```bash
func azure functionapp publish <function-app-name>
```

3. Verify functions appear in Azure Portal:
   - Navigate to Function App → Functions
   - Should see all 21 functions listed
   - Check "Function discovery" details in monitoring

## Azure Functions Deployment Checklist

- [x] `dist` directory contains compiled JavaScript
- [x] `dist/index.js` properly registers all functions via `app.http()` and `app.timer()`
- [x] `package.json` has `main: "dist/index.js"`
- [x] `package.json` includes `@azure/functions` in dependencies
- [x] `.funcignore` excludes only build files and dev dependencies
- [x] All production dependencies are preserved in `node_modules`

## Expected Function List (21 total)

### HTTP Triggers (20)
- createSession
- endSession
- getAttendance
- getEarlyQR
- getLateQR
- getSession
- getUserRoles
- joinSession
- negotiate
- reseedEntry
- reseedExit
- scanChain
- scanEarlyLeave
- scanExitChain
- scanLateEntry
- seedEntry
- startEarlyLeave
- startExitChain
- stopEarlyLeave

### Timer Triggers (1)
- rotateTokens (runs every minute)

## Troubleshooting

### Functions still not appearing in cloud:
1. **Check Azure Portal Logs**: Function App → Logs → Check for startup errors
2. **Verify Deployment**: Ensure `dist` directory was uploaded (FTP to Function App)
3. **Check Memory Issues**: If many modules are excluded, runtime may fail to load dependencies
4. **Restart Function App**: Azure Portal → Function App → Restart
5. **Re-publish**: Delete old function app and redeploy

### Functions work locally but not in cloud:
1. Verify `node_modules` contains `@azure/functions` in cloud deployment
2. Check Azure Functions runtime version matches local (v4.x)
3. Verify all `@azure/*` dependencies are installed: `npm install`

## Prevention

For future deployments:
1. Always test locally first: `npm start`
2. Verify all functions appear with `2-3 minute startup`
3. Use the `.funcignore` pattern provided here
4. Never exclude runtime dependencies from `.funcignore`

## References
- [Azure Functions .funcignore](https://learn.microsoft.com/en-us/azure/azure-functions/functions-run-local#funcignore)
- [Azure Functions v4 Node.js Programming Model](https://learn.microsoft.com/en-us/azure/azure-functions/functions-reference-node?tabs=v4-long-term%2Cv4-vercurrent%2Cwindows-hosting-plan%2Cconnection-string-env%2Ccontext-binding%2Cbicep-file%2Ccsharp-script#programmatic-function-registration)
