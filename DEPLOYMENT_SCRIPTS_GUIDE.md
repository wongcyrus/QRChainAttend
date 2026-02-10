# Deployment Scripts Guide

This guide explains all available deployment scripts and when to use each one.

## 📋 Available Scripts

### 1. `deploy-production.sh` - Full Production Deployment
**Use when:** You need to deploy both backend and frontend with full verification

**Features:**
- ✅ Pre-flight checks (Azure login, required commands)
- ✅ Sets QR_ENCRYPTION_KEY if not present
- ✅ Builds and deploys backend (32 functions)
- ✅ Builds and deploys frontend (with .env.local backup/restore)
- ✅ Verifies deployment status
- ✅ Creates deployment log file
- ✅ Comprehensive output with colors and status

**Usage:**
```bash
./deploy-production.sh
```

**Time:** ~5-10 minutes

---

### 2. `quick-deploy.sh` - Fast Deployment
**Use when:** You need to deploy quickly without verbose output

**Features:**
- ⚡ Minimal output (silent mode)
- ⚡ No pre-flight checks
- ⚡ Deploys both backend and frontend
- ⚡ Handles .env.local backup/restore
- ⚡ Fast execution

**Usage:**
```bash
./quick-deploy.sh
```

**Time:** ~3-5 minutes

---

### 3. `deploy-backend-only.sh` - Backend Only
**Use when:** You only changed backend functions

**Features:**
- 🔧 Checks QR_ENCRYPTION_KEY
- 🔧 Builds backend
- 🔧 Deploys to Azure Functions
- 🔧 Shows function count

**Usage:**
```bash
./deploy-backend-only.sh
```

**Time:** ~2-3 minutes

---

### 4. `deploy-frontend-only.sh` - Frontend Only
**Use when:** You only changed frontend code

**Features:**
- 🎨 Backs up .env.local
- 🎨 Builds for production
- 🎨 Deploys to Static Web Apps
- 🎨 Restores .env.local
- 🎨 Verifies deployment status

**Usage:**
```bash
./deploy-frontend-only.sh
```

**Time:** ~2-3 minutes

---

## 🔑 Hardcoded Configuration

All scripts use these hardcoded values for reliability:

```bash
# Azure Resources
RESOURCE_GROUP="rg-qr-attendance-dev"
FUNCTION_APP_NAME="func-qrattendance-dev"
STATIC_WEB_APP_NAME="swa-qrattendance-dev2"
STORAGE_ACCOUNT_NAME="stqrattendancedev"

# Static Web App Deployment Token (Automatically fetched from Azure)
# No need to set - scripts fetch it automatically using:
#   az staticwebapp secrets list --name swa-qrattendance-dev2 --resource-group rg-qr-attendance-dev --query 'properties.apiKey' -o tsv
# Just ensure you're logged in: az login

# URLs
FUNCTION_APP_URL="https://func-qrattendance-dev.azurewebsites.net"
STATIC_WEB_APP_URL="https://red-grass-0f8bc910f.4.azurestaticapps.net"
```

---

## 🚨 Important Notes

### .env.local Handling
All frontend deployment scripts automatically:
1. Backup `.env.local` before building
2. Build without `.env.local` (ensures production environment detection)
3. Restore `.env.local` after deployment

**Why?** The `.env.local` file contains `NEXT_PUBLIC_ENVIRONMENT=local` which would cause the production build to use local authentication endpoints instead of Azure AD.

### QR Encryption Key
The backend requires `QR_ENCRYPTION_KEY` to be set in Azure Function App settings. The deployment scripts will:
- Check if the key exists
- Generate a new 32-byte hex key if missing
- Set it in Azure Function App settings

You can also manually set it using:
```bash
./scripts/set-encryption-key.sh
```

---

## 📊 Deployment Checklist

Before deploying:
- [ ] Logged in to Azure CLI (`az login`)
- [ ] Correct subscription selected
- [ ] All changes committed to git
- [ ] Tests passing locally
- [ ] Backend builds successfully (`cd backend && npm run build`)
- [ ] Frontend builds successfully (`cd frontend && npm run build`)

After deploying:
- [ ] Visit frontend URL and test login
- [ ] Create a test session
- [ ] Test Entry QR code generation
- [ ] Test Exit QR code generation
- [ ] Verify QR codes auto-refresh every 30 seconds
- [ ] Test student scanning flow
- [ ] Check Application Insights for errors

---

## 🔧 Troubleshooting

### Build Failures

**Backend build fails:**
```bash
cd backend
npm install
npm run build
```

**Frontend build fails:**
```bash
cd frontend
npm install
rm -rf .next out
npm run build
```

### Deployment Failures

**Function App deployment fails:**
```bash
# Check Function App status
az functionapp show --name func-qrattendance-dev --resource-group rg-qr-attendance-dev

# Restart Function App
az functionapp restart --name func-qrattendance-dev --resource-group rg-qr-attendance-dev
```

**Static Web App deployment fails:**
```bash
# Check Static Web App status
az staticwebapp show --name swa-qrattendance-dev2 --resource-group rg-qr-attendance-dev

# Verify deployment token
az staticwebapp secrets list --name swa-qrattendance-dev2 --resource-group rg-qr-attendance-dev
```

### Login Issues

**Azure AD login redirects to mock-login:**
- This happens when `.env.local` is included in the production build
- Solution: Redeploy frontend using `./deploy-frontend-only.sh`
- The script will automatically handle .env.local backup/restore

**QR codes not refreshing:**
- Check browser console for errors
- Verify QR_ENCRYPTION_KEY is set in Function App
- Check Application Insights for backend errors

---

## 📝 Deployment Logs

The `deploy-production.sh` script creates a deployment log file:
```
deployment-YYYYMMDD-HHMMSS.log
```

This log contains:
- Deployment timestamp
- User and subscription info
- Backend and frontend URLs
- Deployment status
- Function count
- Configuration summary

---

## 🎯 Quick Reference

| Task | Script | Time |
|------|--------|------|
| Full deployment with verification | `./deploy-production.sh` | 5-10 min |
| Quick deployment | `./quick-deploy.sh` | 3-5 min |
| Backend only | `./deploy-backend-only.sh` | 2-3 min |
| Frontend only | `./deploy-frontend-only.sh` | 2-3 min |
| Set encryption key | `./scripts/set-encryption-key.sh` | 1 min |

---

## 🔗 Related Documentation

- [DEPLOYMENT_GUIDE.md](DEPLOYMENT_GUIDE.md) - Comprehensive deployment guide
- [QUICK_DEPLOY.md](QUICK_DEPLOY.md) - Quick deployment instructions
- [AZURE_ENVIRONMENT.md](AZURE_ENVIRONMENT.md) - Azure resource details
- [LOCAL_DEVELOPMENT_SETUP.md](LOCAL_DEVELOPMENT_SETUP.md) - Local development setup

---

## 📞 Support

If you encounter issues:
1. Check the deployment log file
2. Review Application Insights for errors
3. Verify Azure resource status
4. Check this guide's troubleshooting section
