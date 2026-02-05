# QR Chain Attendance System

Anti-cheat classroom attendance system using peer-to-peer QR code verification.

## 🚀 Quick Start

### Local Development
```bash
# Start everything
./dev-tools.sh start

# Open browser
# Frontend: http://localhost:3002
# Login: http://localhost:3002/dev-config
```

**New to the project?** See [GETTING_STARTED.md](GETTING_STARTED.md)

### Deploy to Azure
```bash
# See complete deployment guide
cat DEPLOYMENT_GUIDE.md
```

## 🛠️ Development Tools

One script for all development tasks:

```bash
./dev-tools.sh start      # Start backend + frontend
./dev-tools.sh stop       # Stop all servers
./dev-tools.sh restart    # Restart everything
./dev-tools.sh reset-db   # Clear local database
./dev-tools.sh status     # Check what's running
./dev-tools.sh logs       # View recent logs
./dev-tools.sh help       # Show all commands
```

📖 **Full guide**: [DEV_TOOLS.md](DEV_TOOLS.md)

## 📚 Documentation

### Getting Started
- [Getting Started](GETTING_STARTED.md) - First time setup
- [Development Tools](DEV_TOOLS.md) - Using dev-tools.sh
- [Local Development](LOCAL_DEVELOPMENT_SETUP.md) - Full dev environment

### User Guides
- [Login Guide](LOGIN_GUIDE.md) - How to login (teacher/student)
- [QR Chain Flow](QR_CHAIN_FLOW.md) - How attendance works
- [Seed Entry](SEED_ENTRY_IMPLEMENTATION.md) - Starting attendance chains

### Technical
- [Deployment Guide](DEPLOYMENT_GUIDE.md) - Azure deployment
- [Authentication](AUTHENTICATION_SETUP_COMPLETE.md) - Azure AD config
- [Backend Architecture](docs/BACKEND_ARCHITECTURE.md) - API design
- [Frontend Architecture](docs/FRONTEND_ARCHITECTURE.md) - UI components
- [Security](SECURITY.md) - Security features

### Reference
- [Documentation Index](DOCS_INDEX.md) - All documentation
- [Project Status](PROJECT_STATUS.md) - Implementation status

## 🏗️ Architecture

```
Frontend (Next.js PWA) → Backend (Azure Functions) → Azure Storage
                      ↓
                  SignalR (Real-time)
                      ↓
              Azure AD (Authentication)
```

## ✨ Features

- 🔐 Azure AD authentication with role-based access
- 📱 Progressive Web App (offline support)
- 🔄 Real-time updates via SignalR
- 🎯 Anti-cheat QR chain verification
- 📊 Teacher dashboard with live attendance
- 👥 Student session enrollment
- 📱 Phone camera QR scanning (external app)

## 🎯 How It Works

### Teacher Flow
1. Login at `/dev-config` (local) or Azure AD (production)
2. Create session with class ID and times
3. Click "Seed Entry Chains" to start attendance
4. Monitor real-time attendance in dashboard

### Student Flow
1. Scan teacher's session QR code with phone camera
2. Browser opens, redirects to login if needed
3. Auto-joins session after login
4. When becoming chain holder, QR code appears
5. Other students scan holder's QR code
6. Chain continues until all students marked

📖 **Full flow**: [QR_CHAIN_FLOW.md](QR_CHAIN_FLOW.md)

## 🧪 Testing Locally

```bash
# 1. Start servers
./dev-tools.sh start

# 2. Login as teacher
# Go to: http://localhost:3002/dev-config
# Email: teacher@vtc.edu.hk

# 3. Create session
# Click "Teacher Dashboard" → "Create Session"

# 4. Login as students (in new tabs)
# Go to: http://localhost:3002/dev-config
# Email: student1@stu.vtc.edu.hk

# 5. Join session
# Copy session ID from teacher's QR code

# 6. Seed entry chains
# In teacher dashboard, click "Seed Entry Chains"

# 7. Watch QR codes appear
# Holders will see their QR codes after ~5 seconds
```

## 🗑️ Reset Database

```bash
# Clear all local data and start fresh
./dev-tools.sh reset-db
./dev-tools.sh restart
```

## 📖 Common Tasks

### View Logs
```bash
./dev-tools.sh logs           # Recent logs
tail -f backend.log           # Live backend logs
tail -f frontend.log          # Live frontend logs
```

### Check Status
```bash
./dev-tools.sh status         # See what's running
```

### Troubleshooting
```bash
# Servers won't start?
./dev-tools.sh stop
./dev-tools.sh start

# Database issues?
./dev-tools.sh reset-db
./dev-tools.sh restart

# Port conflicts?
lsof -i :7071                 # Check backend port
lsof -i :3002                 # Check frontend port
```

## 🛠️ Tech Stack

- **Frontend**: React, Next.js 14, TypeScript
- **Backend**: Azure Functions, Node.js, TypeScript
- **Storage**: Azure Table Storage (Azurite for local)
- **Real-time**: Azure SignalR Service
- **Auth**: Microsoft Entra ID (Azure AD)
- **Hosting**: Azure Static Web Apps

## 🤝 Contributing

1. Read [SECURITY.md](SECURITY.md) first
2. Follow [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md) guidelines
3. Run tests before committing
4. Never commit secrets

## 📝 License

MIT
