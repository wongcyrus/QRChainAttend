# Getting Started

Quick guide to get the QR Chain Attendance System running locally.

## Prerequisites

- **Node.js 20+**: [Download](https://nodejs.org/)
- **Azure Functions Core Tools**: `npm install -g azure-functions-core-tools@4`
- **Azurite**: For local storage emulation

## Installation

### 1. Clone and Install

```bash
# Install all dependencies
npm run install:all
```

This installs dependencies for:
- Root workspace
- Frontend (Next.js)
- Backend (Azure Functions)

### 2. Start Azurite (Local Storage)

```bash
# In a separate terminal
npx azurite --silent --location azurite --debug azurite/debug.log
```

Or use the dev tools script:
```bash
./dev-tools.sh
# Select option 1: Start Azurite
```

### 3. Initialize Local Database

```bash
./scripts/init-tables.sh
```

This creates the required tables:
- Sessions
- Attendance
- Chains
- Tokens
- ScanLogs

### 4. Start Development Servers

**Terminal 1 - Backend:**
```bash
cd backend
npm start
```
Backend runs on: http://localhost:7071

**Terminal 2 - Frontend:**
```bash
cd frontend
npm run dev
```
Frontend runs on: http://localhost:3000

## First Use

1. Visit http://localhost:3000
2. Click "Login" (uses mock authentication in local dev)
3. Choose a role:
   - Teacher: Create and manage sessions
   - Student: Join sessions and scan QR codes

## Configuration

### Frontend (`frontend/.env.local`)
```bash
NEXT_PUBLIC_API_URL=http://localhost:7071/api
NEXT_PUBLIC_ENVIRONMENT=local
```

### Backend (`backend/local.settings.json`)
```json
{
  "Values": {
    "AzureWebJobsStorage": "UseDevelopmentStorage=true",
    "SIGNALR_CONNECTION_STRING": "dummy",
    "CHAIN_TOKEN_TTL_SECONDS": "20"
  }
}
```

## Testing the Flow

### As a Teacher

1. Login and go to Teacher Dashboard
2. Click "Create New Session"
3. Fill in session details
4. Click "Seed Entry Chains" to start
5. Students can now join

### As a Student

1. Login (use a different browser/incognito)
2. Go to Student View
3. Enter the session ID
4. Scan QR codes when you become the chain holder

## Common Issues

### Backend won't start
- **Check**: Is Azurite running?
- **Fix**: Start Azurite first

### Frontend can't connect to backend
- **Check**: Is backend running on port 7071?
- **Fix**: Restart backend with `npm start`

### Tables don't exist
- **Fix**: Run `./scripts/init-tables.sh`

### Port already in use
- **Frontend**: Change port in `package.json` dev script
- **Backend**: Change port in `backend/local.settings.json`

## Next Steps

- [QR Chain Flow](QR_CHAIN_FLOW.md) - Understand how the system works
- [Test Flow](TEST_FLOW.md) - Testing guide
- [Deployment Guide](DEPLOYMENT_GUIDE.md) - Deploy to Azure
- [Quick Reference](QUICK_REFERENCE.md) - Common commands

## Development Tools

Use the dev tools script for common tasks:
```bash
./dev-tools.sh
```

Options:
1. Start Azurite
2. Stop Azurite
3. Reset local database
4. View logs
5. Run tests

## Useful Commands

```bash
# Reset local database
./scripts/reset-local-db.sh

# View backend logs
cd backend && npm start

# Run tests
npm test

# Lint code
npm run lint
```

---

**Need help?** Check the [docs/](docs/) folder for detailed documentation.
