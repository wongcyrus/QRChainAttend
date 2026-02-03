# Getting Started with QR Chain Attendance System

Welcome! This guide will help you understand the project and get started quickly.

## 📚 Documentation Map

### 🚀 For Deployment
1. **[DEPLOYMENT_GUIDE.md](DEPLOYMENT_GUIDE.md)** - Complete step-by-step deployment
   - Azure AD app registration
   - Infrastructure deployment with Bicep
   - Post-deployment configuration
   - User role assignment

2. **[docs/CICD_SETUP.md](docs/CICD_SETUP.md)** - Optional CI/CD automation
   - GitHub Actions workflows
   - Azure credentials setup
   - Automated deployments

### 🔐 For Security
- **[SECURITY.md](SECURITY.md)** - **READ THIS FIRST!**
  - What NOT to commit to Git
  - Secrets management
  - Security best practices
  - Incident response

### 💻 For Development
- **[docs/DEVELOPMENT.md](docs/DEVELOPMENT.md)** - Local development setup
- **[docs/BACKEND_ARCHITECTURE.md](docs/BACKEND_ARCHITECTURE.md)** - Backend design
- **[docs/FRONTEND_ARCHITECTURE.md](docs/FRONTEND_ARCHITECTURE.md)** - Frontend design
- **[docs/README.md](docs/README.md)** - Complete documentation index

### 📊 For Operations
- **[docs/MONITORING.md](docs/MONITORING.md)** - Monitoring and alerts
- **[docs/ALERT_RESPONSE.md](docs/ALERT_RESPONSE.md)** - Alert response playbook

---

## ⚡ Quick Start Paths

### Path 1: Deploy to Azure (First Time)

```bash
# 1. Read the guides
cat DEPLOYMENT_GUIDE.md
cat SECURITY.md

# 2. Create Azure AD app registration (see DEPLOYMENT_GUIDE.md Step 1)
az ad app create --display-name "QR Chain Attendance System" ...

# 3. Deploy infrastructure (see DEPLOYMENT_GUIDE.md Step 4)
cd infrastructure
./deploy.sh --environment dev ...

# 4. Deploy application code (see DEPLOYMENT_GUIDE.md Step 6)
cd backend && func azure functionapp publish <app-name>
git push origin main  # Frontend auto-deploys via GitHub Actions
```

**Full instructions**: [DEPLOYMENT_GUIDE.md](DEPLOYMENT_GUIDE.md)

### Path 2: Local Development

```bash
# 1. Install dependencies
npm ci

# 2. Start services (3 terminals)
# Terminal 1: Storage emulator
azurite --silent --location ./azurite

# Terminal 2: Backend
npm run dev:backend

# Terminal 3: Frontend
npm run dev:frontend

# 3. Access application
open http://localhost:3000
```

**Full instructions**: [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md)

### Path 3: Set Up CI/CD (Optional)

```bash
# 1. Create Azure service principal
./scripts/setup-cicd-credentials.sh \
  <subscription-id> \
  <resource-group> \
  <github-repo>

# 2. Verify GitHub secrets are set
# 3. Push to trigger workflows
```

**Full instructions**: [docs/CICD_SETUP.md](docs/CICD_SETUP.md)

---

## 🏗️ Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    Azure Resources                          │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌──────────────────┐         ┌──────────────────┐        │
│  │ Static Web App   │◄────────┤ Function App     │        │
│  │ (Next.js PWA)    │         │ (Node.js API)    │        │
│  └────────┬─────────┘         └────────┬─────────┘        │
│           │                            │                   │
│           │                            ▼                   │
│           │                   ┌──────────────────┐        │
│           │                   │ Table Storage    │        │
│           │                   │ (Data)           │        │
│           │                   └──────────────────┘        │
│           │                            │                   │
│           ▼                            ▼                   │
│  ┌──────────────────────────────────────────────┐         │
│  │      SignalR Service (Real-time Updates)     │         │
│  └──────────────────────────────────────────────┘         │
│                         ▼                                  │
│                ┌──────────────────┐                        │
│                │ App Insights     │                        │
│                │ (Monitoring)     │                        │
│                └──────────────────┘                        │
└─────────────────────────────────────────────────────────────┘
```

**Key Components:**
- **Frontend**: React/Next.js PWA with offline support
- **Backend**: Serverless Azure Functions (TypeScript)
- **Storage**: Azure Table Storage for sessions and attendance
- **Real-time**: SignalR for live dashboard updates
- **Auth**: Microsoft Entra ID (Azure AD) with role-based access

---

## 🔒 Security First

**⚠️ CRITICAL**: Read [SECURITY.md](SECURITY.md) before committing!

### Never Commit These Files

```
.deployment-config       # Deployment credentials
credential.json          # Azure credentials
github-token.txt         # GitHub token
*.secret                 # Any secret files
local.settings.json      # Local settings
.env*                    # Environment variables
```

### Verify Before Committing

```bash
# Run verification script
./verify-no-secrets.sh

# Check .gitignore
git check-ignore .deployment-config credential.json github-token.txt

# Review staged changes
git diff --cached
```

---

## 📋 Deployment Checklist

### Pre-Deployment
- [ ] Read [DEPLOYMENT_GUIDE.md](DEPLOYMENT_GUIDE.md)
- [ ] Read [SECURITY.md](SECURITY.md)
- [ ] Azure CLI installed (`az --version`)
- [ ] Node.js 18+ installed (`node --version`)
- [ ] Logged in to Azure (`az login`)

### Azure AD Setup (Step 1)
- [ ] App registration created
- [ ] Client ID saved securely
- [ ] Client Secret created and saved
- [ ] Tenant ID noted
- [ ] API permissions granted
- [ ] App roles created (Teacher, Student)

### Infrastructure Deployment (Steps 2-4)
- [ ] GitHub repository created
- [ ] GitHub token created
- [ ] `.deployment-config` file created (chmod 600)
- [ ] Backend infrastructure deployed
- [ ] Static Web App deployed
- [ ] All resources verified in Azure Portal

### Post-Deployment (Steps 5-7)
- [ ] Redirect URI updated in Azure AD
- [ ] Users assigned to roles
- [ ] Backend code deployed
- [ ] Frontend code deployed (auto via GitHub Actions)
- [ ] Application tested end-to-end

### Verification
- [ ] Backend API health check passes
- [ ] Frontend loads successfully
- [ ] Authentication works
- [ ] Role-based access works
- [ ] Monitoring enabled
- [ ] No secrets in Git repository

---

## 💰 Cost Estimate

### Development (~$17-26/month)
- Static Web App (Standard): $9
- Function App (Consumption): $5-10
- Storage Account: $1-2
- SignalR (Free tier): $0
- Application Insights: $2-5

### Production (~$94-139/month)
- Static Web App (Standard): $9
- Function App (Consumption): $20-50
- Storage Account: $5-10
- SignalR (Standard): $50
- Application Insights: $10-20

**Tip**: Use Azure Cost Management to set budget alerts.

---

## 🧪 Testing

```bash
# Run all tests
npm test

# Run specific workspace tests
npm run test:unit --workspace=backend
npm run test:unit --workspace=frontend

# Generate coverage report
npm test -- --coverage
```

**Current Status:**
- ✅ Backend: 28 suites, 563 tests passing
- ✅ Frontend: 14 suites, 321 tests passing
- ✅ CI/CD: All workflows passing

---

## 🆘 Common Issues

### "RepositoryUrl is invalid" during deployment
**Solution**: Deploy Static Web App module directly  
**See**: DEPLOYMENT_GUIDE.md Step 4.3

### "Principal not found" error
**Solution**: Wait 30-60 seconds for managed identity propagation  
**Then**: Retry the operation

### Authentication not working
**Solutions**:
- Verify redirect URI matches exactly
- Check users are assigned to roles in Azure AD
- Verify Client ID and Tenant ID are correct

### Frontend build fails
**Solutions**:
- Clear `.next` directory: `rm -rf frontend/.next`
- Reinstall dependencies: `npm ci`
- Check for TypeScript errors: `npm run type-check --workspace=frontend`

---

## 📞 Quick Links

### Azure Portal
- [Resource Groups](https://portal.azure.com/#blade/HubsExtension/BrowseResourceGroups)
- [Azure AD](https://portal.azure.com/#blade/Microsoft_AAD_IAM/ActiveDirectoryMenuBlade/Overview)
- [Cost Management](https://portal.azure.com/#blade/Microsoft_Azure_CostManagement/Menu/overview)

### Documentation
- [Azure Functions Docs](https://docs.microsoft.com/azure/azure-functions/)
- [Azure Static Web Apps Docs](https://docs.microsoft.com/azure/static-web-apps/)
- [Microsoft Entra ID Docs](https://learn.microsoft.com/entra/identity/)

---

## 🎯 Success Criteria

Your deployment is successful when:

✅ All Azure resources deployed  
✅ Static Web App accessible  
✅ Function App responding  
✅ Authentication working  
✅ Users assigned to roles  
✅ Real-time updates working  
✅ Monitoring enabled  
✅ No secrets in Git  

---

## 🚀 Next Steps

1. **New to the project?** → Read [DEPLOYMENT_GUIDE.md](DEPLOYMENT_GUIDE.md)
2. **Ready to develop?** → Read [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md)
3. **Need to monitor?** → Read [docs/MONITORING.md](docs/MONITORING.md)
4. **Want CI/CD?** → Read [docs/CICD_SETUP.md](docs/CICD_SETUP.md)

---

**Questions?** Check the [docs/](docs/) folder for detailed documentation.
