# QR Chain Attendance System

Anti-cheat classroom attendance system using peer-to-peer QR code verification.

## 🚀 Quick Start

### Local Development
```bash
# Install dependencies
npm run install:all

# Start development servers
npm run dev:frontend  # Frontend on http://localhost:3000
npm run dev:backend   # Backend on http://localhost:7071
```

### Production
- **Frontend**: https://red-grass-0f8bc910f.4.azurestaticapps.net
- **Backend**: https://func-qrattendance-dev.azurewebsites.net/api

## 📚 Documentation

- [Getting Started](GETTING_STARTED.md) - Setup and first steps
- [Deployment Guide](DEPLOYMENT_GUIDE.md) - Deploy to Azure
- [Database Management](DATABASE_MANAGEMENT.md) - Manage local and production databases
- [Backend Deployment Fix](BACKEND_DEPLOYMENT_FIX.md) - Fix deployment issues
- [Quick Reference](QUICK_REFERENCE.md) - Common commands and tasks

### Detailed Documentation
- [docs/](docs/) - Architecture, monitoring, and technical details
- [QR Chain Flow](QR_CHAIN_FLOW.md) - How the QR chain system works
- [Test Flow](TEST_FLOW.md) - Testing guide
- [Security](SECURITY.md) - Security considerations

## 🏗️ Architecture

### Frontend (Next.js)
- Static site hosted on Azure Static Web Apps
- Progressive Web App (PWA) with offline support
- Real-time updates via SignalR

### Backend (Azure Functions)
- 29 serverless functions
- Node.js 20 runtime
- Azure Table Storage for data
- SignalR for real-time communication

## 🔐 Authentication

- **Azure AD** with multi-tenant support
- **Role-based access**: Teacher / Student
- **Email-based roles**:
  - `@vtc.edu.hk` → Teacher
  - `@stu.vtc.edu.hk` → Student
  - `cyruswong@outlook.com` → Teacher (testing)

## 🛠️ Development

### Prerequisites
- Node.js 20+
- Azure Functions Core Tools
- Azurite (local storage emulator)

### Project Structure
```
├── frontend/          # Next.js frontend
├── backend/           # Azure Functions backend
├── docs/              # Documentation
└── scripts/           # Utility scripts
```

### Common Commands
```bash
# Development
npm run dev:frontend
npm run dev:backend

# Build
npm run build:frontend
npm run build:backend

# Deploy
cd backend && ./deploy.sh
cd frontend && npm run build && swa deploy

# Database
./scripts/reset-local-db.sh
./scripts/reset-production-db.sh
```

## 📊 Features

- ✅ QR chain attendance (entry/exit)
- ✅ Late entry tracking
- ✅ Early leave tracking
- ✅ Real-time student status
- ✅ Chain holder identification
- ✅ Session management
- ✅ Attendance export
- ✅ Offline support (PWA)

## 🔧 Configuration

### Local Development
- Frontend: `frontend/.env.local`
- Backend: `backend/local.settings.json`

### Production
- Azure Static Web App settings
- Azure Function App settings
- See [DEPLOYMENT_GUIDE.md](DEPLOYMENT_GUIDE.md)

## 📝 License

MIT

## 👥 Support

For issues and questions, see the documentation in the `docs/` folder.
