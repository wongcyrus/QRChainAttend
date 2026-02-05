# Quick Reference Card

## 🚀 Start/Stop

```bash
./dev-tools.sh start      # Start everything
./dev-tools.sh stop       # Stop everything
./dev-tools.sh restart    # Restart everything
```

## 🗑️ Reset Database

```bash
./dev-tools.sh reset-db   # Clear all data
```

## 📊 Check Status

```bash
./dev-tools.sh status     # What's running?
./dev-tools.sh logs       # Recent logs
```

## 🌐 URLs

- **Frontend**: http://localhost:3002
- **Backend**: http://localhost:7071/api
- **Login**: http://localhost:3002/dev-config

## 👤 Test Users

### Teacher
- Email: `teacher@vtc.edu.hk`
- Role: Create sessions, seed chains, monitor

### Students
- Email: `student1@stu.vtc.edu.hk`
- Email: `student2@stu.vtc.edu.hk`
- Email: `student3@stu.vtc.edu.hk`
- Role: Join sessions, scan QR codes

## 📝 Complete Test Flow

```bash
# 1. Start
./dev-tools.sh start

# 2. Teacher (Tab 1)
# → http://localhost:3002/dev-config
# → Login: teacher@vtc.edu.hk
# → Teacher Dashboard
# → Create Session
# → Note session ID

# 3. Students (Tabs 2-4)
# → http://localhost:3002/dev-config
# → Login: student1@stu.vtc.edu.hk (etc.)
# → Student View
# → Enter session ID
# → Join Session

# 4. Teacher (Tab 1)
# → Scroll to "Chain Management"
# → Click "Seed Entry Chains"

# 5. Students (Tabs 2-4)
# → Wait 5 seconds
# → Holders see QR codes!

# 6. Reset when done
./dev-tools.sh reset-db
```

## 🐛 Troubleshooting

```bash
# Servers won't start?
./dev-tools.sh stop && ./dev-tools.sh start

# Port conflicts?
lsof -i :7071  # Backend
lsof -i :3002  # Frontend

# Database issues?
./dev-tools.sh reset-db && ./dev-tools.sh restart

# View live logs
tail -f backend.log
tail -f frontend.log
```

## 📚 Documentation

- [README.md](README.md) - Overview
- [GETTING_STARTED.md](GETTING_STARTED.md) - Detailed setup
- [DEV_TOOLS.md](DEV_TOOLS.md) - All commands
- [QR_CHAIN_FLOW.md](QR_CHAIN_FLOW.md) - How it works

## 🔑 Key Concepts

### Session
- Created by teacher
- Has class ID, start/end times
- Students join using session ID or QR code

### Chain Seeding
- Teacher clicks "Seed Entry Chains"
- Randomly selects 2-3 students as initial holders
- Creates tokens with 20-second expiration

### Chain Holder
- Student with active token
- Sees QR code on their screen
- Other students scan this QR code
- Holder status transfers to scanner

### Attendance Flow
1. Teacher seeds chains
2. Initial holders get QR codes
3. Non-holders scan holder QR codes
4. Scanner becomes new holder
5. Previous holder marked present
6. Repeat until all marked

## 💡 Tips

- Use multiple browser tabs to simulate multiple students
- Reset database between tests for clean state
- Check logs if something doesn't work
- QR codes refresh every 5 seconds
- Tokens expire after 20 seconds
