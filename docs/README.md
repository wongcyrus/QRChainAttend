# Documentation Index

Welcome to the ProvePresent documentation.

## 🚀 Getting Started

**New to the project?** Start here:

1. **[Getting Started Guide](../GETTING_STARTED.md)** - Quick start and overview
2. **[Deployment Guide](../DEPLOYMENT_GUIDE.md)** - Step-by-step deployment
3. **[Security Guidelines](../SECURITY.md)** - Important security practices
4. **[Project Status](../PROJECT_STATUS.md)** - Current project status

**For developers:**

1. **[Development Guide](DEVELOPMENT.md)** - Local development setup
2. **[Backend Architecture](BACKEND_ARCHITECTURE.md)** - Backend design
3. **[Frontend Architecture](FRONTEND_ARCHITECTURE.md)** - Frontend design

## 🚀 Getting Started

**New to the project?** Start here:

1. **[Getting Started Guide](../GETTING_STARTED.md)** - Quick start and overview
2. **[Deployment Guide](../DEPLOYMENT_GUIDE.md)** - Step-by-step deployment
3. **[Security Guidelines](../SECURITY.md)** - Important security practices
4. **[Project Status](../PROJECT_STATUS.md)** - Current project status

**For developers:**

1. **[Development Guide](DEVELOPMENT.md)** - Local development setup
2. **[Backend Architecture](BACKEND_ARCHITECTURE.md)** - Backend design
3. **[Frontend Architecture](FRONTEND_ARCHITECTURE.md)** - Frontend design

---

## 📚 Documentation Structure

### Root Level Documentation
Located in the project root for quick access:

- **[README.md](../README.md)** - Project overview and quick start
- **[GETTING_STARTED.md](../GETTING_STARTED.md)** - Getting started guide
- **[DEPLOYMENT_GUIDE.md](../DEPLOYMENT_GUIDE.md)** - Complete deployment instructions
- **[SECURITY.md](../SECURITY.md)** - Security guidelines and best practices
- **[PROJECT_STATUS.md](../PROJECT_STATUS.md)** - Current project status and metrics

---

---

## 📖 Technical Documentation

### Core Guides
### Core Guides
- **[Development Guide](DEVELOPMENT.md)** - Local setup, testing, debugging, and best practices
- **[Backend Architecture](BACKEND_ARCHITECTURE.md)** - Services, caching, error handling, and security
- **[Frontend Architecture](FRONTEND_ARCHITECTURE.md)** - Components, PWA features, and offline support

### Deployment & Operations
- **[Deployment Overview](DEPLOYMENT.md)** - Infrastructure deployment and CI/CD pipeline
- **[Azure AD Setup](AZURE_AD_SETUP.md)** - Detailed Azure AD configuration
- **[CI/CD Setup](CICD_SETUP.md)** - GitHub Actions and automated deployments
- **[Monitoring Guide](MONITORING.md)** - Metrics, alerts, dashboards, and troubleshooting
- **[Alert Response Playbook](ALERT_RESPONSE.md)** - How to respond to production alerts

### Reference
- **[Implementation History](IMPLEMENTATION_HISTORY.md)** - Feature development timeline and milestones
- **[Frontend Components](../frontend/COMPONENTS.md)** - Detailed component documentation

---

## 🔧 Component Documentation

Individual component READMEs in `frontend/src/components/`:
- **[TeacherDashboard.README.md](../frontend/src/components/TeacherDashboard.README.md)**
- **[StudentSessionView.README.md](../frontend/src/components/StudentSessionView.README.md)**
- **[QRDisplay.README.md](../frontend/src/components/QRDisplay.README.md)**
- **[QRScanner.README.md](../frontend/src/components/QRScanner.README.md)**
- **[RotatingQRDisplay.README.md](../frontend/src/components/RotatingQRDisplay.README.md)**
- **[SessionCreationForm.README.md](../frontend/src/components/SessionCreationForm.README.md)**
- **[SessionEndAndExportControls.README.md](../frontend/src/components/SessionEndAndExportControls.README.md)**
- **[ChainManagementControls.README.md](../frontend/src/components/ChainManagementControls.README.md)**
- **[OfflineHandling.README.md](../frontend/src/components/OfflineHandling.README.md)**

---

---

## ⚡ Quick Reference

### Common Commands

### Common Commands

**Local Development:**
```bash
# Install dependencies
npm ci

# Start backend
npm run dev:backend

# Start frontend
npm run dev:frontend
```

**Testing:**
```bash
# Run all tests
npm test

# Run with coverage
npm test -- --coverage

# Run specific workspace
npm run test:unit --workspace=backend
```

**Deployment:**
```bash
# Deploy infrastructure
cd infrastructure && ./deploy.sh dev

# Deploy backend
cd backend && func azure functionapp publish <app-name>

# Frontend auto-deploys via GitHub Actions
git push origin main
```

**Monitoring:**
```bash
# Set up monitoring
cd scripts && ./configure-monitoring.sh <resource-group>

# Create dashboard
./create-monitoring-dashboard.sh <resource-group>
```

---

## 🎯 Key Concepts

## 🎯 Key Concepts

**ProvePresent:**
- Students scan QR codes in sequence to verify presence
- Tokens rotate every 20-60 seconds to prevent screenshots
- Blockchain-inspired chain validation ensures authenticity

**Architecture:**
- **Frontend**: Next.js PWA on Azure Static Web Apps
- **Backend**: Azure Functions (serverless)
- **Storage**: Azure Table Storage
- **Real-time**: Azure SignalR Service
- **Auth**: Microsoft Entra ID with role-based access

**Security:**
- Managed Identity for Azure service authentication
- RBAC for fine-grained access control
- Token-based API authentication
- Input validation and sanitization

---

## 📂 File Structure

## 📂 File Structure

```
project-root/
├── README.md                    # Project overview
├── GETTING_STARTED.md          # Getting started guide
├── DEPLOYMENT_GUIDE.md         # Deployment instructions
├── SECURITY.md                 # Security guidelines
├── PROJECT_STATUS.md           # Project status
│
├── docs/                       # Technical documentation
│   ├── README.md              # This file
│   ├── DEVELOPMENT.md         # Development guide
│   ├── BACKEND_ARCHITECTURE.md
│   ├── FRONTEND_ARCHITECTURE.md
│   ├── DEPLOYMENT.md
│   ├── MONITORING.md
│   ├── ALERT_RESPONSE.md
│   ├── AZURE_AD_SETUP.md
│   ├── CICD_SETUP.md
│   └── IMPLEMENTATION_HISTORY.md
│
├── frontend/                   # Next.js frontend
│   ├── COMPONENTS.md
│   └── src/components/*.README.md
│
├── backend/                    # Azure Functions
├── shared/                     # Shared types
├── infrastructure/             # Bicep templates
├── scripts/                    # Deployment scripts
└── .github/workflows/          # CI/CD pipelines
```

---

## 🤝 Contributing

## 🤝 Contributing

When adding new features:

1. Read [DEVELOPMENT.md](DEVELOPMENT.md) for development workflow
2. Follow security guidelines in [SECURITY.md](../SECURITY.md)
3. Update relevant architecture documentation
4. Add component README for new components
5. Include usage examples (*.example.tsx)
6. Write comprehensive tests
7. Update this index if adding new docs

---

## 🆘 Getting Help

**For deployment issues:**
1. Check [DEPLOYMENT_GUIDE.md](../DEPLOYMENT_GUIDE.md)
2. Review [AZURE_AD_SETUP.md](AZURE_AD_SETUP.md)
3. Check Azure Portal logs

**For development issues:**
1. Check [DEVELOPMENT.md](DEVELOPMENT.md)
2. Review [IMPLEMENTATION_HISTORY.md](IMPLEMENTATION_HISTORY.md)
3. Check component examples (*.example.tsx)
4. Review test files for usage patterns

**For security questions:**
1. Read [SECURITY.md](../SECURITY.md)
2. Run `./verify-no-secrets.sh`
3. Check `.gitignore` configuration

**For operational issues:**
1. Check [MONITORING.md](MONITORING.md)
2. Review [ALERT_RESPONSE.md](ALERT_RESPONSE.md)
3. Check Application Insights logs

---

## 📚 External Resources

- [Azure Functions Documentation](https://docs.microsoft.com/azure/azure-functions/)
- [Next.js Documentation](https://nextjs.org/docs)
- [Azure Static Web Apps](https://docs.microsoft.com/azure/static-web-apps/)
- [Azure SignalR Service](https://docs.microsoft.com/azure/azure-signalr/)
- [Microsoft Entra ID](https://learn.microsoft.com/entra/identity/)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/)
- [Jest Documentation](https://jestjs.io/docs/getting-started)
- [React Testing Library](https://testing-library.com/react)

---

**Ready to start?** → [GETTING_STARTED.md](../GETTING_STARTED.md)
