# QR Chain Attendance System

An Azure-based classroom attendance solution that uses peer-to-peer QR code chains and rotating QR codes to verify student presence while resisting common cheating methods (screenshots, remote scans, proxy attendance).

## 🚀 Quick Start

**New to the project?** Start here:

1. **[Getting Started Guide](GETTING_STARTED.md)** - Overview and quick start
2. **[Deployment Guide](DEPLOYMENT_GUIDE.md)** - Step-by-step deployment instructions
3. **[Security Guidelines](SECURITY.md)** - Important security practices

**For developers:**
- **[Development Guide](docs/DEVELOPMENT.md)** - Local setup and development workflow
- **[Documentation Index](docs/README.md)** - Complete documentation reference

## 📋 Documentation

### Essential Guides
- **[GETTING_STARTED.md](GETTING_STARTED.md)** - Quick start and overview
- **[DEPLOYMENT_GUIDE.md](DEPLOYMENT_GUIDE.md)** - Complete deployment instructions
- **[SECURITY.md](SECURITY.md)** - Security best practices and guidelines
- **[docs/CICD_SETUP.md](docs/CICD_SETUP.md)** - CI/CD pipeline setup (optional)

### Technical Documentation
- **[docs/DEVELOPMENT.md](docs/DEVELOPMENT.md)** - Local development setup
- **[docs/BACKEND_ARCHITECTURE.md](docs/BACKEND_ARCHITECTURE.md)** - Backend design
- **[docs/FRONTEND_ARCHITECTURE.md](docs/FRONTEND_ARCHITECTURE.md)** - Frontend design
- **[docs/MONITORING.md](docs/MONITORING.md)** - Monitoring and alerts
- **[docs/README.md](docs/README.md)** - Complete documentation index

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Azure Resources                          │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌──────────────────┐         ┌──────────────────┐        │
│  │ Static Web App   │         │ Function App     │        │
│  │ (Frontend)       │◄────────┤ (Backend API)    │        │
│  │ Next.js PWA      │         │ Node.js 18       │        │
│  └────────┬─────────┘         └────────┬─────────┘        │
│           │                            │                   │
│           │                            ▼                   │
│           │                   ┌──────────────────┐        │
│           │                   │ Table Storage    │        │
│           │                   │ Sessions, Tokens │        │
│           │                   └──────────────────┘        │
│           │                            │                   │
│           ▼                            ▼                   │
│  ┌──────────────────────────────────────────────┐         │
│  │      SignalR Service (Real-time Updates)     │         │
│  └──────────────────────────────────────────────┘         │
│                                                             │
│                         ▼                                  │
│                ┌──────────────────┐                        │
│                │ App Insights     │                        │
│                │ (Monitoring)     │                        │
│                └──────────────────┘                        │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

**Key Technologies:**
- **Frontend**: React/Next.js Progressive Web App (Azure Static Web Apps)
- **Backend**: Azure Functions (TypeScript, serverless)
- **Storage**: Azure Table Storage
- **Real-time**: Azure SignalR Service
- **Authentication**: Microsoft Entra ID (Azure AD)
- **Monitoring**: Application Insights
- **AI Insights**: Azure OpenAI (optional)

## 📁 Project Structure

```
qr-chain-attendance/
├── frontend/              # Next.js PWA frontend
│   ├── src/
│   │   ├── components/   # React components
│   │   ├── pages/        # Next.js pages
│   │   ├── hooks/        # Custom React hooks
│   │   └── utils/        # Utility functions
│   └── public/           # Static assets & PWA files
├── backend/              # Azure Functions backend
│   ├── src/
│   │   ├── functions/   # HTTP & Timer functions
│   │   ├── services/    # Business logic
│   │   ├── storage/     # Storage clients
│   │   └── middleware/  # Error handling
│   └── host.json
├── shared/               # Shared TypeScript types
│   └── src/types/       # Data models
├── infrastructure/       # Bicep IaC templates
│   ├── modules/         # Bicep modules
│   └── parameters/      # Environment configs
├── scripts/             # Deployment scripts
├── docs/                # Technical documentation
└── .github/workflows/   # CI/CD pipelines
```

## 🔑 Key Features

### Anti-Cheat Mechanisms
- **Short-lived tokens**: 20s for chains, 60s for rotating QR codes
- **Single-use enforcement**: ETag-based concurrency control
- **Optional geofencing**: GPS and Wi-Fi validation
- **Rate limiting**: 10 scans/60s per device, 50 scans/60s per IP

### Peer-to-Peer Verification
- **Entry chains**: Verify on-time arrival
- **Exit chains**: Verify end-of-class presence
- **Baton transfer**: Distributed trust mechanism

### Real-Time Dashboard
- **Live updates**: SignalR-powered real-time attendance
- **Chain monitoring**: Track chain progress
- **Stall detection**: Automatic recovery mechanisms

### Progressive Web App
- **Installable**: Add to home screen on mobile
- **Offline-capable**: Service worker caching
- **Fast loading**: Optimized assets and code splitting

## 🛠️ Prerequisites

- **Node.js** 18.x or later (see `.nvmrc`)
- **Azure CLI** (for deployment)
- **Azure Functions Core Tools** v4 (for local development)
- **Azurite** (for local Azure Storage emulation)
- **Azure Subscription** (for deployment)

## 💻 Local Development

### Quick Start

```bash
# Install dependencies
npm ci

# Terminal 1 - Start Azurite (Storage Emulator)
azurite --silent --location ./azurite

# Terminal 2 - Start Backend
npm run dev:backend

# Terminal 3 - Start Frontend
npm run dev:frontend
```

**Access:**
- Frontend: http://localhost:3000
- Backend API: http://localhost:7071/api

See **[docs/DEVELOPMENT.md](docs/DEVELOPMENT.md)** for detailed development guide.

## 🚢 Deployment

### Option 1: Manual Deployment (Recommended for First Time)

Follow the complete step-by-step guide:
**[DEPLOYMENT_GUIDE.md](DEPLOYMENT_GUIDE.md)**

### Option 2: CI/CD Pipeline (Optional)

Set up automated deployments with GitHub Actions:
**[docs/CICD_SETUP.md](docs/CICD_SETUP.md)**

**Quick deployment summary:**
1. Create Azure AD app registration
2. Deploy infrastructure with Bicep
3. Configure managed identities
4. Deploy application code
5. Assign users to roles

## 🧪 Testing

```bash
# Run all tests
npm test

# Run unit tests only
npm run test:unit

# Run property-based tests
npm run test:property

# Generate coverage report
npm test -- --coverage
```

**Test Status:**
- ✅ Backend: 28 suites, 563 tests passing
- ✅ Frontend: 14 suites, 321 tests passing
- ✅ CI/CD: All workflows passing

## 🔒 Security

**⚠️ CRITICAL**: Read **[SECURITY.md](SECURITY.md)** before committing any code!

### Files That Must NEVER Be Committed
- `.deployment-config` - Deployment credentials
- `credential.json` - Azure credentials
- `github-token.txt` - GitHub token
- `*.secret` - Any secret files
- `local.settings.json` - Local settings

### Verify Before Committing
```bash
# Check for secrets
./verify-no-secrets.sh

# Verify .gitignore
git check-ignore .deployment-config credential.json
```

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

## 📊 Monitoring

Application Insights provides:
- Real-time metrics and dashboards
- Error tracking and alerts
- Performance monitoring
- User analytics

See **[docs/MONITORING.md](docs/MONITORING.md)** for setup and configuration.

## 🤝 Contributing

1. Read **[docs/DEVELOPMENT.md](docs/DEVELOPMENT.md)**
2. Follow security guidelines in **[SECURITY.md](SECURITY.md)**
3. Write tests for new features
4. Update documentation
5. Submit pull request

## 📞 Support

- **Documentation**: See `docs/` folder
- **Issues**: Check Application Insights logs
- **Deployment**: See **[DEPLOYMENT_GUIDE.md](DEPLOYMENT_GUIDE.md)**
- **Security**: See **[SECURITY.md](SECURITY.md)**

## 📄 License

MIT

---

**Ready to get started?** → **[GETTING_STARTED.md](GETTING_STARTED.md)**
