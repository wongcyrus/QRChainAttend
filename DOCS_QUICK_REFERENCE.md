# Documentation Quick Reference

**Last Updated**: February 11, 2026  
**Total Files**: 18 (consolidated from 40)

---

## Core Documentation (5)

- **README.md** - Project overview and quick start
- **GETTING_STARTED.md** - Complete setup and testing guide
- **DOCS_QUICK_REFERENCE.md** - This file
- **PROJECT_STATUS.md** - Current project status
- **SYSTEM_ARCHITECTURE.md** - System design and architecture

---

## Features (2)

- **LIVE_QUIZ.md** - AI-powered live quiz system (setup, usage, API)
- **ENTRY_EXIT_METHODS.md** - Entry/exit method tracking system

---

## Development (3)

- **LOCAL_DEVELOPMENT.md** - All local development scenarios (pure local, local+prod backend, local+prod Azure)
- **ENVIRONMENTS.md** - Environment scripts and production access
- **DEV_TOOLS.md** - Development commands and tools

---

## Deployment (1)

- **DEPLOYMENT.md** - Complete deployment guide (automated script, manual steps, troubleshooting)

---

## Database (2)

- **DATABASE_TABLES.md** - Table schemas and structure (11 tables)
- **DATABASE_MANAGEMENT.md** - Database operations and queries

---

## Configuration (4)

- **AZURE_ENVIRONMENT.md** - Azure resources and configuration
- **TABLES_CONFIG_REFERENCE.md** - Table configuration reference
- **ROLE_ASSIGNMENT.md** - User role management
- **STATIC_WEB_APP_SETUP.md** - Static Web App configuration

---

## Security (1)

- **SECURITY.md** - Complete security guide (Git security, Azure security, authentication, best practices)

---

## Quick Navigation

### "How do I...?"

**Setup locally**
→ LOCAL_DEVELOPMENT.md

**Deploy to production**
→ DEPLOYMENT.md

**Use live quiz feature**
→ LIVE_QUIZ.md

**Access production**
→ ENVIRONMENTS.md

**Manage database**
→ DATABASE_TABLES.md → DATABASE_MANAGEMENT.md

**Understand security**
→ SECURITY.md

**Assign user roles**
→ ROLE_ASSIGNMENT.md

**Use dev tools**
→ DEV_TOOLS.md

---

## Production URLs

### Application
- **Frontend**: https://ashy-desert-0fc9a700f.6.azurestaticapps.net
- **Backend**: https://func-qrattendance-prod.azurewebsites.net/api

### Azure Portal
- **Resource Group**: rg-qr-attendance-prod

---

## Quick Commands

```bash
# Local development
./scripts/start-local-dev.sh          # Pure local (port 3000)
./start-local-with-prod.sh            # Local FE + Prod BE (port 3002)
./start-local-prod.sh                 # Local + Prod Azure (port 3001)

# Production
./start-production.sh                 # Open production URLs
./deploy-full-production.sh           # Deploy to production

# Database
./scripts/tables-config.sh list prod  # List tables
./scripts/tables-config.sh create prod # Create tables

# Monitoring
az functionapp log tail --name func-qrattendance-prod --resource-group rg-qr-attendance-prod
```

---

## Documentation Changes

### Consolidated (40 → 18 files)

**Removed**:
- Temporary status files (deployment success, cleanup summaries)
- Redundant security files (combined into SECURITY.md)
- Old fix notes (auth headers, session persistence, token fixes)

**Combined**:
- LOCAL_DEVELOPMENT.md (3 files → 1)
- LIVE_QUIZ.md (3 files → 1)
- DEPLOYMENT.md (3 files → 1)
- ENVIRONMENTS.md (2 files → 1)
- SECURITY.md (3 files → 1)

---

## File Structure

```
Root Documentation (18 files):
├── Core (5)
│   ├── README.md
│   ├── GETTING_STARTED.md
│   ├── DOCS_QUICK_REFERENCE.md
│   ├── PROJECT_STATUS.md
│   └── SYSTEM_ARCHITECTURE.md
├── Features (2)
│   ├── LIVE_QUIZ.md
│   └── ENTRY_EXIT_METHODS.md
├── Development (3)
│   ├── LOCAL_DEVELOPMENT.md
│   ├── ENVIRONMENTS.md
│   └── DEV_TOOLS.md
├── Deployment (1)
│   └── DEPLOYMENT.md
├── Database (2)
│   ├── DATABASE_TABLES.md
│   └── DATABASE_MANAGEMENT.md
├── Configuration (4)
│   ├── AZURE_ENVIRONMENT.md
│   ├── TABLES_CONFIG_REFERENCE.md
│   ├── ROLE_ASSIGNMENT.md
│   └── STATIC_WEB_APP_SETUP.md
└── Security (1)
    └── SECURITY.md

Archived:
└── .archive/old-docs/ (historical documentation)
```

---

## Top 5 Documents

### For Developers
1. **LOCAL_DEVELOPMENT.md** - Start developing
2. **DEPLOYMENT.md** - Deploy to production
3. **DATABASE_TABLES.md** - Database schema
4. **LIVE_QUIZ.md** - Live quiz feature
5. **SECURITY.md** - Security guidelines

### For Users
1. **README.md** - System overview
2. **GETTING_STARTED.md** - How to use
3. **LIVE_QUIZ.md** - How to use live quiz

---

**Need help?** Check the relevant document above or use the quick commands.
