# Local Development Guide

Complete guide for running the QR Chain Attendance System locally with mock authentication.

---

## 🚀 Quick Start (Already Configured!)

Your environment is ready! Just start the servers:

```bash
# Quick start - one command
./dev-tools.sh start

# Or with browser auto-open
./dev-tools.sh start --open
```

**Manual start** (if you prefer separate terminals):
# Terminal 1: cd backend && func start
# Terminal 2: cd frontend && npm run dev
```

Then open: **http://localhost:3001**

---

## ✅ What's Configured

### Backend (`backend/local.settings.json`)
- ✅ Azure Storage: stqrattendancedev
- ✅ SignalR: signalr-qrattendance-dev
- ✅ All environment variables

### Frontend (`frontend/.env.local`)
- ✅ API URL: http://localhost:7071/api
- ✅ Azure AD Client ID & Tenant ID
- ✅ Mock authentication enabled

---

## 🔐 Authentication (Mock Mode)

### Default Login
Click "Login with Azure AD" → Auto-login as **Teacher** (teacher@vtc.edu.hk)

### Switch Roles
Visit: **http://localhost:3001/dev-config**
- 👨‍🏫 Teacher - Create sessions, view attendance
- 👨‍🎓 Student - Join sessions, scan QR codes

---

## 📍 URLs

| Service | URL | Purpose |
|---------|-----|---------|
| Frontend | http://localhost:3001 | Main app |
| Backend | http://localhost:7071/api | API endpoints |
| Dev Config | http://localhost:3001/dev-config | Switch user roles |
| Mock Auth | http://localhost:3001/api/auth/me | Check current user |

---

## 🧪 Testing

### Test as Teacher
1. Open http://localhost:3001
2. Click "Login with Azure AD"
3. Click "Teacher Dashboard"
4. Create a session

### Test as Student
1. Go to http://localhost:3001/dev-config
2. Select "Student" role
3. Click "Set User & Login"
4. Click "Student View"
5. Join a session

### Test API
```bash
# Get user info
curl http://localhost:3001/api/auth/me

# Backend health (if available)
curl http://localhost:7071/api/health
```

---

## 🛑 Stop Servers

**Stop servers**:

```bash
./dev-tools.sh stop
```

Or press `Ctrl+C` in terminal windows.

---

## 🔧 Manual Setup (If Needed)

### Prerequisites
- Node.js 18+
- Azure Functions Core Tools v4
- Azure CLI (logged in)

### Get Azure Resources
```bash
# Your configuration:
CLIENT_ID=dc482c34-ebaa-4239-aca3-2810a4f51728
TENANT_ID=8ff7db19-435d-4c3c-83d3-ca0a46234f51
RESOURCE_GROUP=rg-qr-attendance-dev

# Get connection strings
az storage account show-connection-string \
  --name stqrattendancedev \
  --resource-group rg-qr-attendance-dev

az signalr key list \
  --name signalr-qrattendance-dev \
  --resource-group rg-qr-attendance-dev
```

### Install Dependencies
```bash
npm install --legacy-peer-deps
cd backend && npm install
cd ../frontend && npm install --legacy-peer-deps
```

---

## 🐛 Troubleshooting

### Port Already in Use
```bash
# Kill frontend (3001)
lsof -ti:3001 | xargs kill -9

# Kill backend (7071)
lsof -ti:7071 | xargs kill -9
```

### Frontend Won't Start
```bash
rm -rf frontend/.next frontend/node_modules
cd frontend && npm install --legacy-peer-deps
```

### Backend Won't Start
```bash
rm -rf backend/dist backend/node_modules
cd backend && npm install
```

### Mock Auth Not Working
- Check `NEXT_PUBLIC_ENVIRONMENT=local` in `frontend/.env.local`
- Clear browser cookies
- Restart frontend server

### Can't Connect to Azure Storage
- Verify connection string in `backend/local.settings.json`
- Check Azure Storage firewall allows your IP
- Test with Azurite instead: `azurite --silent --location ./azurite`

---

## 📚 Key Files

```
backend/local.settings.json    # Backend config (Azure connections)
frontend/.env.local            # Frontend config (API URL, Azure AD)
frontend/src/pages/dev-config.tsx  # Role switcher page
frontend/src/pages/api/auth/   # Mock auth endpoints
dev-tools.sh                   # Development toolkit (start/stop/reset)
```

---

## 🎯 Available API Endpoints

All at http://localhost:7071/api:

**Session Management (Teacher)**
- `POST /sessions` - Create session
- `GET /sessions/{id}` - Get session
- `POST /sessions/{id}/end` - End session
- `GET /sessions/{id}/attendance` - Get attendance

**Student Actions**
- `POST /sessions/{id}/join` - Join session
- `POST /scanChain` - Scan entry QR

**Real-time**
- `POST /negotiate` - SignalR negotiation

---

## 💡 Development Tips

### Hot Reload
- **Frontend**: Auto-reloads on save
- **Backend**: Restart required for changes

### Debugging
- Frontend: Browser DevTools (F12)
- Backend: Check terminal logs
- Add `console.log()` as needed

### Testing Different Users
Use dev-config page to quickly test:
- Different email addresses
- Teacher vs Student roles
- Role-based access control

---

## 🔄 How Mock Auth Works

### Local Development Only
When `NEXT_PUBLIC_ENVIRONMENT=local`:
- `/.auth/login/aad` → `/api/auth/mock-login`
- `/.auth/me` → `/api/auth/me`
- `/.auth/logout` → `/api/auth/logout`

### Production
Real Azure Static Web Apps authentication is used.

### Mock User Storage
User info stored in HTTP-only cookie: `mock-auth`

---

## 📖 Related Documentation

- **DEPLOYMENT_GUIDE.md** - Deploy to Azure
- **docs/DEVELOPMENT.md** - Development best practices
- **docs/BACKEND_ARCHITECTURE.md** - Backend design
- **docs/FRONTEND_ARCHITECTURE.md** - Frontend design

---

## ✨ You're Ready!

Both servers are running. Open http://localhost:3001 and start testing! 🚀

