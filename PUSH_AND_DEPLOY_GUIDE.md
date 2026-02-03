# Push and Deploy Guide

## Current Situation

✅ **Your CI/CD is correctly configured**  
✅ **Remote repository exists**: `wongcyrus/QRChainAttend-cicd`  
⚠️ **You have 1 unpushed commit** with the auth fix

## Your Repository Setup

```
origin  → https://github.com/wongcyrus/QRChainAttend-cicd.git (CI/CD repo)
backup  → https://github.com/wongcyrus/QRChainAttend (Main repo)
```

## What You Need to Do

### Step 1: Push Your Changes

```bash
# Push to origin (QRChainAttend-cicd)
git push origin main
```

This will trigger the **Frontend Deploy** workflow automatically.

### Step 2: Monitor the Deployment

After pushing, check the GitHub Actions:

**Option A: Using GitHub CLI (if installed)**
```bash
# Watch the workflow in real-time
gh run watch

# Or list recent runs
gh run list --repo wongcyrus/QRChainAttend-cicd
```

**Option B: Using Web Browser**
```
https://github.com/wongcyrus/QRChainAttend-cicd/actions
```

### Step 3: Verify Required Secrets

The frontend deployment needs this secret:
- `AZURE_STATIC_WEB_APPS_API_TOKEN`

**Check if it's set:**
```
https://github.com/wongcyrus/QRChainAttend-cicd/settings/secrets/actions
```

**If missing, get it from Azure Portal:**
1. Go to your Static Web App in Azure Portal
2. Settings → Configuration → Deployment token
3. Copy the token
4. Add to GitHub Secrets as `AZURE_STATIC_WEB_APPS_API_TOKEN`

## What Will Happen

### Workflow Execution Order

1. **Test Workflow** (`test.yml`) - Runs on every push
   - Backend tests
   - Frontend tests
   - Coverage reports

2. **Frontend Deploy** (`frontend-deploy.yml`) - Triggered by frontend changes
   - ✅ Checkout code
   - ✅ Setup Node.js
   - ✅ Install dependencies
   - ✅ Build shared package
   - ✅ Run linter
   - ✅ Run unit tests
   - ✅ Run property tests
   - ✅ Build frontend (static export)
   - ⚠️ Deploy to Azure Static Web Apps (needs token)

### Expected Timeline

- **Tests**: ~2-3 minutes
- **Build**: ~3-5 minutes
- **Deploy**: ~2-3 minutes
- **Total**: ~7-11 minutes

## Your Changes Being Deployed

```
Commit: 4821827
Message: docs: add authentication setup guides and fix auth state management

Files changed:
- frontend/src/pages/index.tsx       (Auth state fix)
- frontend/public/sw.js               (Service worker update)
- AUTH_STATE_FIX.md                   (Documentation)
- AUTHENTICATION_SETUP_COMPLETE.md    (Documentation)
- LOGIN_GUIDE.md                      (Documentation)
```

**Key fixes:**
- ✅ Visibility change listener for auth state
- ✅ Cache-busting headers for `/.auth/me`
- ✅ Service worker bypass for auth endpoints
- ✅ Cache version bump (v1 → v2)

## Troubleshooting

### If Push Fails

```bash
# Check if you're on the right branch
git branch

# Check remote configuration
git remote -v

# Try force push (if safe)
git push origin main --force
```

### If Deployment Fails

**Check the workflow logs:**
1. Go to Actions tab
2. Click on the failed workflow
3. Expand the failed step
4. Read the error message

**Common issues:**

1. **Missing secret**: Add `AZURE_STATIC_WEB_APPS_API_TOKEN`
2. **Build failure**: Check test/lint errors
3. **Deploy failure**: Verify Static Web App exists

### If Tests Fail

```bash
# Run tests locally first
npm run test:unit --workspace=frontend
npm run test:property --workspace=frontend
npm run lint --workspace=frontend
```

## After Successful Deployment

### Verify the Fix

1. **Visit your site** (without hard refresh)
2. **Click Login** → Should redirect to Azure AD
3. **After login** → Should show logged-in state immediately
4. **Click Logout** → Should show login button immediately
5. **No hard refresh needed** ✅

### Check Service Worker Update

1. Open browser DevTools (F12)
2. Go to Application → Service Workers
3. Should see version `v2` (updated from `v1`)
4. Auth endpoints should not be cached

### Monitor in Azure

1. **Azure Portal** → Your Static Web App
2. **Deployments** → Should show new deployment
3. **Environment** → Check if it's live
4. **Logs** → Check for any errors

## Quick Commands Reference

```bash
# Push to origin
git push origin main

# Check workflow status (with gh CLI)
gh run list --repo wongcyrus/QRChainAttend-cicd --limit 5

# Watch latest workflow
gh run watch --repo wongcyrus/QRChainAttend-cicd

# View workflow logs
gh run view --log --repo wongcyrus/QRChainAttend-cicd

# Check remote status
git fetch origin
git status

# See what will be pushed
git log origin/main..HEAD

# See file changes
git diff origin/main..HEAD
```

## If You Want to Push to Both Remotes

```bash
# Push to origin (CI/CD repo)
git push origin main

# Push to backup (main repo)
git push backup main
```

## Repository Strategy

You seem to have two repositories:

1. **QRChainAttend-cicd** (origin) - For CI/CD testing
2. **QRChainAttend** (backup) - Main repository

**Recommendation:**
- Use `origin` for testing CI/CD workflows
- Once stable, push to `backup` for production
- Or merge them into one repository

## Next Steps

1. ✅ **Push your changes**: `git push origin main`
2. ⏱️ **Wait for deployment**: ~7-11 minutes
3. 🔍 **Monitor in GitHub Actions**
4. ✅ **Test the live site**
5. 📝 **Verify the auth fix works**

## Success Criteria

✅ Workflow completes without errors  
✅ Frontend deploys to Azure Static Web Apps  
✅ Login/logout works without hard refresh  
✅ Service worker updated to v2  
✅ Auth endpoints not cached  

---

**Ready to deploy?** Run: `git push origin main`
