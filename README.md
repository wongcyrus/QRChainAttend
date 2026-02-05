# QR Chain Attendance System

Anti-cheat classroom attendance system using peer-to-peer QR code verification.

## 🚀 Quick Start

### Local Development (Ready!)
```bash
./dev.sh
```
Open http://localhost:3001

📖 **Full guide**: [LOCAL_DEVELOPMENT_SETUP.md](LOCAL_DEVELOPMENT_SETUP.md)

### Deploy to Azure
```bash
# See complete deployment guide
cat DEPLOYMENT_GUIDE.md
```

## 📚 Documentation

| Document | Purpose |
|----------|---------|
| [LOCAL_DEVELOPMENT_SETUP.md](LOCAL_DEVELOPMENT_SETUP.md) | Run locally with mock auth |
| [DEPLOYMENT_GUIDE.md](DEPLOYMENT_GUIDE.md) | Deploy to Azure |
| [GETTING_STARTED.md](GETTING_STARTED.md) | Overview & quick paths |
| [SECURITY.md](SECURITY.md) | Security guidelines |
| [docs/](docs/) | Architecture & operations |

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

## 🛠️ Tech Stack

- **Frontend**: React, Next.js, TypeScript
- **Backend**: Azure Functions, Node.js, TypeScript
- **Storage**: Azure Table Storage
- **Real-time**: Azure SignalR Service
- **Auth**: Microsoft Entra ID (Azure AD)
- **Hosting**: Azure Static Web Apps

## 🧪 Testing

```bash
# Run all tests
npm test

# Backend tests
cd backend && npm test

# Frontend tests
cd frontend && npm test
```

## 🤝 Contributing

1. Read [SECURITY.md](SECURITY.md) first
2. Follow [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md) guidelines
3. Run tests before committing
4. Never commit secrets

## 📝 License

MIT
