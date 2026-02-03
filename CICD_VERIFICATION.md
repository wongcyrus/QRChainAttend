# CI/CD Verification Checklist

## Current Status
✅ You pushed changes to remote  
📋 Verifying CI/CD configuration

## Your CI/CD Workflows

### 1. ✅ Test Workflow (`test.yml`)
- **Status**: Active and working
- **Triggers**: Every push and PR
- **Required Secrets**: None
- **Action**: Runs automatically ✅

### 2. ✅ Frontend Deploy (`frontend-deploy.yml`)
- **Status**: Active
- **Triggers**: Push to main (frontend changes), PRs
- **Required Secrets**:
  - `AZURE_STATIC_WEB_APPS_API_TOKEN` ⚠️ **VERIFY THIS IS SET**

**Your recent changes include:**
- `frontend/src/pages/index.tsx` - Auth state fix
- `frontend/public/sw.js` - Service worker update

**This WILL trigger the frontend deployment** when you push to `origin/main`.

### 3. ⚠️ Backend Deploy (`backend-deploy.yml`)
- **Status**: Active but won't trigger (no backend changes)
- **Required Secrets**:
  - `AZURE_CREDENTIALS_STAGING`
  - `AZURE_FUNCTIONAPP_NAME_STAGING`

### 4. ℹ️ Infrastructure Deploy (`infrastructure-deploy.yml`)
- **Status**: Manual only
- **Won't trigger automatically**

## What Will Happen When You Push

Since you modified frontend files, the **Frontend Deploy** workflow will trigger:

```yaml
on:
  push:
    branches:
      - main
    paths:
      - 'frontend/**'        # ✅ You changed this
      - 'shared/**'
      - 'staticwebapp.config.json'
```

## Required Actions

### ✅ Immediate: Verify Frontend Deployment Secret

Check if this secret is set in GitHub:
```
https://github.com/<your-username>/<your-repo>/settings/secrets/actions
```

**Required Secret:**
- `AZURE_STATIC_WEB_APPS_API_TOKEN`

**How to get it:**
1. Go to Azure Portal
2. Navigate to your Static Web App
3. Settings → Configuration → Deployment token
4. Copy the token
5. Add to GitHub Secrets

### ⚠️ If Secret is Missing

The deployment will fail with an error like:
```
Error: Input required and not supplied: azure_static_web_apps_api_token
```

**Fix:**
1. Get the token from Azure Portal (see above)
2. Add it to GitHub Secrets
3. Re-run the failed workflow

## Verify Your Push

### Check Git Status
```bash
# See what you're about to push
git status

# See commits ahead of origin
git log origin/main..HEAD

# Push to remote
git push origin main
```

### Monitor Deployment

After pushing, check:
1. **GitHub Actions**: https://github.com/<your-repo>/actions
2. Look for "Frontend - Build and Deploy" workflow
3. Monitor the build and deploy steps

## Expected Workflow Steps

When the frontend workflow runs:

1. ✅ **Checkout code**
2. ✅ **Setup Node.js**
3. ✅ **Install dependencies**
4. ✅ **Build shared package**
5. ✅ **Run linter**
6. ✅ **Run unit tests**
7. ✅ **Run property tests**
8. ✅ **Build frontend**
9. ⚠️ **Deploy to Azure Static Web Apps** (needs token)

## Troubleshooting

### If Deployment Fails

**Check the workflow logs:**
```
GitHub → Actions → Failed workflow → View logs
```

**Common issues:**

1. **Missing secret**: Add `AZURE_STATIC_WEB_APPS_API_TOKEN`
2. **Build failure**: Check test/lint errors in logs
3. **Deploy failure**: Verify Static Web App exists in Azure

### If You Want to Skip CI/CD

Add `[skip ci]` to your commit message:
```bash
git commit --amend -m "fix: auth state management [skip ci]"
git push origin main --force
```

## Summary

✅ **Your CI/CD is correctly configured** for remote deployment  
⚠️ **Verify** `AZURE_STATIC_WEB_APPS_API_TOKEN` secret is set  
✅ **Frontend changes will auto-deploy** when pushed to main  
✅ **Backend won't deploy** (no changes)  
✅ **Tests will run** automatically  

## Next Steps

1. **Verify the secret is set** in GitHub
2. **Push your changes**: `git push origin main`
3. **Monitor the workflow** in GitHub Actions
4. **Check deployment** in Azure Portal after success
5. **Test the live site** to verify auth fix works

## Quick Commands

```bash
# Push to remote
git push origin main

# Check workflow status (if you have gh CLI)
gh run list --limit 5

# Watch latest workflow
gh run watch

# View workflow logs
gh run view --log
```

## Your Changes Being Deployed

- ✅ Auth state fix with visibility change listener
- ✅ Cache-busting headers for auth endpoint
- ✅ Service worker bypass for `/.auth/*` endpoints
- ✅ Updated cache version (v1 → v2)

These changes will fix the login/logout panel bug without requiring hard refresh.
