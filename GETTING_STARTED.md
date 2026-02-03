# Getting Started with QR Chain Attendance System

## 📚 Documentation Overview

This project includes comprehensive documentation to help you deploy and use the system:

### 🚀 Deployment

- **[DEPLOYMENT_GUIDE.md](DEPLOYMENT_GUIDE.md)** - Complete step-by-step deployment instructions
  - Azure AD setup
  - GitHub configuration
  - Infrastructure deployment
  - Post-deployment configuration

### 🔐 Security

- **[SECURITY.md](SECURITY.md)** - Security guidelines and best practices
  - Secrets management
  - What NOT to commit to Git
  - Incident response procedures
  - Compliance guidelines

### 📖 Additional Documentation

- **[docs/AZURE_AD_SETUP.md](docs/AZURE_AD_SETUP.md)** - Detailed Azure AD configuration
- **[docs/DEPLOYMENT.md](docs/DEPLOYMENT.md)** - Deployment overview
- **[docs/DEVELOPMENT.md](docs/DEVELOPMENT.md)** - Local development guide
- **[docs/MONITORING.md](docs/MONITORING.md)** - Monitoring and troubleshooting

---

## ⚡ Quick Start

### For First-Time Deployment

1. **Read the deployment guide**: [DEPLOYMENT_GUIDE.md](DEPLOYMENT_GUIDE.md)
2. **Follow Step 1**: Create Azure AD app registration
3. **Follow Step 2**: Set up GitHub repository and token
4. **Follow Step 3**: Create secure configuration file
5. **Follow Step 4**: Deploy infrastructure
6. **Follow Steps 5-7**: Configure and verify

### For Local Development

```bash
# Install dependencies
npm run install:all

# Start Azurite (Azure Storage Emulator)
azurite --silent --location ./azurite

# Start backend (in another terminal)
npm run dev:backend

# Start frontend (in another terminal)
npm run dev:frontend

# Access application
open http://localhost:3000
```

---

## 🔒 Security First

**⚠️ CRITICAL**: Before committing any code, read [SECURITY.md](SECURITY.md)

### Files That Must NEVER Be Committed

```
.deployment-config       # Your deployment credentials
credential.json          # Azure credentials
github-token.txt         # GitHub token
*.secret                 # Any secret files
local.settings.json      # Local settings
.env                     # Environment variables
```

### Verify Before Committing

```bash
# Check what will be committed
git status

# Verify sensitive files are ignored
git check-ignore .deployment-config credential.json github-token.txt

# Check for secrets in staged files
git diff --cached | grep -i "secret\|password\|token"
```

---

## 📋 Deployment Checklist

Use this checklist when deploying:

### Pre-Deployment
- [ ] Read [DEPLOYMENT_GUIDE.md](DEPLOYMENT_GUIDE.md)
- [ ] Read [SECURITY.md](SECURITY.md)
- [ ] Azure CLI installed and logged in
- [ ] Node.js 18+ installed
- [ ] Git configured

### Azure AD Setup
- [ ] App registration created
- [ ] Client ID saved securely
- [ ] Client Secret created and saved
- [ ] Tenant ID noted
- [ ] API permissions configured
- [ ] App roles created (Teacher, Student)

### GitHub Setup
- [ ] Repository created
- [ ] Code pushed to repository
- [ ] Personal access token created
- [ ] Token has Administration permission

### Configuration
- [ ] `.deployment-config` file created
- [ ] File permissions set to 600
- [ ] All secrets stored securely
- [ ] `.gitignore` verified

### Deployment
- [ ] Backend infrastructure deployed
- [ ] Static Web App deployed
- [ ] Redirect URI updated
- [ ] Users assigned to roles
- [ ] Backend code deployed
- [ ] Frontend code deployed

### Verification
- [ ] Backend API responding
- [ ] Frontend loading
- [ ] Authentication working
- [ ] Monitoring enabled
- [ ] No secrets in Git

---

## 🎯 Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    Azure Resources                          │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌──────────────────┐         ┌──────────────────┐        │
│  │ Static Web App   │         │ Function App     │        │
│  │ (Frontend)       │         │ (Backend API)    │        │
│  │ [Managed ID]     │         │ [Managed ID]     │        │
│  └────────┬─────────┘         └────────┬─────────┘        │
│           │                            │                   │
│           │                            │                   │
│           ▼                            ▼                   │
│  ┌──────────────────────────────────────────────┐         │
│  │      Azure Table Storage                     │         │
│  │  - Sessions, Attendance, Tokens, Chains      │         │
│  └──────────────────────────────────────────────┘         │
│                                                             │
│                                  ▼                         │
│                         ┌──────────────────┐              │
│                         │ SignalR Service  │              │
│                         │ (Real-time)      │              │
│                         └──────────────────┘              │
│                                                             │
│                                  ▼                         │
│                         ┌──────────────────┐              │
│                         │ App Insights     │              │
│                         │ (Monitoring)     │              │
│                         └──────────────────┘              │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## 💰 Cost Estimate

### Development Environment
- Static Web App (Standard): ~$9/month
- Function App (Consumption): ~$5-10/month
- Storage Account: ~$1-2/month
- SignalR (Free tier): $0/month
- Application Insights: ~$2-5/month
- **Total: ~$17-26/month**

### Production Environment
- Static Web App (Standard): ~$9/month
- Function App (Consumption): ~$20-50/month
- Storage Account: ~$5-10/month
- SignalR (Standard): ~$50/month
- Application Insights: ~$10-20/month
- **Total: ~$94-139/month**

---

## 🆘 Getting Help

### Documentation
1. Check [DEPLOYMENT_GUIDE.md](DEPLOYMENT_GUIDE.md) for deployment issues
2. Check [SECURITY.md](SECURITY.md) for security questions
3. Check [docs/](docs/) folder for detailed documentation

### Troubleshooting
1. Check Application Insights logs
2. Review Azure deployment logs
3. Check GitHub Actions logs (for frontend)
4. Review Function App logs (for backend)

### Common Issues

**"RepositoryUrl is invalid"**
- Deploy Static Web App module directly (see DEPLOYMENT_GUIDE.md Step 4.3)

**"Principal not found"**
- Wait 30-60 seconds for managed identity propagation

**Authentication not working**
- Verify redirect URI is correct
- Check users are assigned to roles

---

## 📞 Quick Links

### Azure Portal
- [Resource Groups](https://portal.azure.com/#blade/HubsExtension/BrowseResourceGroups)
- [Azure AD](https://portal.azure.com/#blade/Microsoft_AAD_IAM/ActiveDirectoryMenuBlade/Overview)
- [Cost Management](https://portal.azure.com/#blade/Microsoft_Azure_CostManagement/Menu/overview)

### GitHub
- [Personal Access Tokens](https://github.com/settings/tokens)
- [Repository Settings](https://github.com/settings/repositories)

### Documentation
- [Azure Functions](https://docs.microsoft.com/azure/azure-functions/)
- [Azure Static Web Apps](https://docs.microsoft.com/azure/static-web-apps/)
- [Azure AD](https://docs.microsoft.com/azure/active-directory/)

---

## 🎉 Success Criteria

Your deployment is successful when:

- ✅ All Azure resources are deployed
- ✅ Static Web App is live and accessible
- ✅ Function App is responding to API calls
- ✅ Users can authenticate with Azure AD
- ✅ Users are assigned to appropriate roles
- ✅ Frontend and backend are communicating
- ✅ Monitoring is enabled
- ✅ No secrets are committed to Git

---

**Ready to deploy? Start with [DEPLOYMENT_GUIDE.md](DEPLOYMENT_GUIDE.md)!**
