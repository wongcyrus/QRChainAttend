# Getting Started with QR Chain Attendance

Quick guide to get the system running locally.

## Prerequisites

- Node.js 18+ installed
- npm or yarn
- Git

## Quick Start (3 Steps)

### 1. Clone and Install
```bash
git clone <repository-url>
cd QRChainAttend
npm install
```

### 2. Start Development Servers
```bash
./dev-tools.sh start
```

This starts:
- Backend on http://localhost:7071/api
- Frontend on http://localhost:3002

### 3. Open Browser
Go to: http://localhost:3002/dev-config

## First Time Usage

### Login as Teacher
1. Go to http://localhost:3002/dev-config
2. Enter email: `teacher@vtc.edu.hk`
3. Click "Login"
4. Click "Teacher Dashboard"

### Create a Session
1. Fill in the form:
   - Class ID: `CS101`
   - Start time: (current time)
   - End time: (1 hour later)
   - Late cutoff: `15` minutes
2. Click "Create Session"
3. Note the session ID or QR code

### Login as Students
1. Open new browser tabs (2-3 tabs)
2. Go to http://localhost:3002/dev-config in each
3. Enter emails:
   - `student1@stu.vtc.edu.hk`
   - `student2@stu.vtc.edu.hk`
   - `student3@stu.vtc.edu.hk`
4. Click "Student View" in each

### Join Session
In each student tab:
1. Enter the session ID from teacher
2. Click "Join Session"
3. You should see session information

### Start Attendance
Back in teacher dashboard:
1. Scroll to "Chain Management"
2. Set "Number of chains" to 2 or 3
3. Click "Seed Entry Chains"
4. Success message shows which students are holders

### See QR Codes
In student tabs:
- Wait 5 seconds for automatic refresh
- Holders will see yellow box with QR code
- Message: "🎯 You are the Chain Holder!"
- Non-holders see instructions

## Development Tools

All commands use `./dev-tools.sh`:

```bash
./dev-tools.sh start      # Start servers
./dev-tools.sh stop       # Stop servers
./dev-tools.sh restart    # Restart servers
./dev-tools.sh reset-db   # Clear database
./dev-tools.sh status     # Check status
./dev-tools.sh logs       # View logs
```

See [DEV_TOOLS.md](DEV_TOOLS.md) for details.

## Common Issues

### Servers won't start
```bash
./dev-tools.sh stop
./dev-tools.sh start
```

### Port already in use
```bash
# Check what's using the ports
lsof -i :7071  # Backend
lsof -i :3002  # Frontend

# Kill processes
./dev-tools.sh stop
```

### Database has old data
```bash
./dev-tools.sh reset-db
./dev-tools.sh restart
```

### Student view keeps reloading
This was fixed. Make sure you have the latest code:
```bash
git pull
npm install
./dev-tools.sh restart
```

## Next Steps

- [QR Chain Flow](QR_CHAIN_FLOW.md) - Understand how attendance works
- [Login Guide](LOGIN_GUIDE.md) - Authentication details
- [Development Tools](DEV_TOOLS.md) - All dev-tools commands
- [Local Development](LOCAL_DEVELOPMENT_SETUP.md) - Full setup guide

## Project Structure

```
├── backend/              # Azure Functions API
│   ├── src/functions/    # API endpoints
│   └── local.settings.json
├── frontend/             # Next.js web app
│   ├── src/pages/        # Routes
│   ├── src/components/   # React components
│   └── .env.local
├── dev-tools.sh          # Main development tool
└── README.md
```

## URLs

- Frontend: http://localhost:3002
- Backend API: http://localhost:7071/api
- Dev Login: http://localhost:3002/dev-config
- Teacher Dashboard: http://localhost:3002/teacher
- Student View: http://localhost:3002/student

## Environment Files

### Backend: `backend/local.settings.json`
Already configured for local development with Azurite.

### Frontend: `frontend/.env.local`
```env
NEXT_PUBLIC_ENVIRONMENT=local
NEXT_PUBLIC_API_URL=http://localhost:7071/api
```

These files are already set up for local development.

## Testing the Complete Flow

1. **Start**: `./dev-tools.sh start`
2. **Teacher**: Login → Create session → Seed chains
3. **Students**: Login → Join session → Wait for QR codes
4. **Verify**: Holders see QR codes, teacher sees attendance
5. **Reset**: `./dev-tools.sh reset-db` when done

## Help

- Check status: `./dev-tools.sh status`
- View logs: `./dev-tools.sh logs`
- Live logs: `tail -f backend.log` or `tail -f frontend.log`
- Documentation: [DOCS_INDEX.md](DOCS_INDEX.md)
