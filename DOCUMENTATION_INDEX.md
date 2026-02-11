# Documentation Index

Quick reference to all documentation files in the QR Chain Attendance System.

---

## 🚀 Quick Start

**New to the project?** Start here:
1. `README.md` - Project overview
2. `GETTING_STARTED.md` - Setup and first steps
3. `PROJECT_STATUS.md` - Current deployment status

---

## 📦 Deployment

### Production Deployment
- `DEPLOYMENT_GUIDE.md` - Complete deployment guide ⭐
- `deploy-full-production.sh` - Automated deployment script
- `verify-production.sh` - Verify production deployment
- `SIGNALR_CONFIGURATION.md` - SignalR Standard S1 setup
- `AZURE_ENVIRONMENT.md` - Azure environment setup

---

## 🎯 Features

### Live Quiz System
- `LIVE_QUIZ.md` - Feature overview and user guide ⭐
- `LIVE_QUIZ_IMPLEMENTATION.md` - Technical implementation
- `LIVE_QUIZ_TESTING.md` - Testing procedures

### Attendance Methods
- `ENTRY_EXIT_METHODS.md` - QR chain and snapshot methods

---

## 🗄️ Database

- `DATABASE_TABLES.md` - Complete schema (12 tables) ⭐
- `DATABASE_MANAGEMENT.md` - Operations and maintenance
- `TABLES_CONFIG_REFERENCE.md` - Table configuration reference

---

## 🏗️ System Architecture

- `SYSTEM_ARCHITECTURE.md` - System design and components ⭐
- `SECURITY.md` - Security guidelines and best practices
- `ROLE_ASSIGNMENT.md` - User roles and permissions

---

## 💻 Development

### Local Development
- `LOCAL_DEVELOPMENT.md` - Local setup guide ⭐
- `start-local-prod.sh` - Start with production data
- `start-local-with-openai.sh` - Start with Azure OpenAI
- `start-production.sh` - Production startup script

---

## 📊 By Category

### For Developers
1. `LOCAL_DEVELOPMENT.md` - Set up local environment
2. `SYSTEM_ARCHITECTURE.md` - Understand the system
3. `DATABASE_TABLES.md` - Database schema
4. `LIVE_QUIZ_IMPLEMENTATION.md` - Quiz implementation

### For DevOps/Deployment
1. `DEPLOYMENT_GUIDE.md` - Complete deployment guide
2. `deploy-full-production.sh` - Deploy to production
3. `SIGNALR_CONFIGURATION.md` - SignalR setup
4. `verify-production.sh` - Verify deployment

### For Teachers/Users
1. `README.md` - What is this system?
2. `LIVE_QUIZ.md` - How to use Live Quiz
3. `ENTRY_EXIT_METHODS.md` - Attendance methods

### For System Administrators
1. `SECURITY.md` - Security guidelines
2. `ROLE_ASSIGNMENT.md` - Manage user roles
3. `DATABASE_MANAGEMENT.md` - Database operations
4. `AZURE_ENVIRONMENT.md` - Azure configuration

---

## 🔍 Quick Reference

### Production URLs
- **Frontend**: https://ashy-desert-0fc9a700f.6.azurestaticapps.net
- **Backend**: https://func-qrattendance-prod.azurewebsites.net

### Key Resources
- **Resource Group**: rg-qr-attendance-prod
- **SignalR**: Standard S1 (1000 connections)
- **Azure OpenAI**: GPT-4o + Vision
- **Database**: 12 tables in Azure Table Storage

### Quick Commands
```bash
# Deploy to production
./deploy-full-production.sh

# Verify production
./verify-production.sh

# Start local development
./start-local-with-openai.sh

# Start with production data
./start-local-prod.sh
```

---

## 📝 Document Status

| Document | Status | Last Updated |
|----------|--------|--------------|
| DEPLOYMENT_SUCCESS_SUMMARY.md | ✅ Current | Feb 11, 2026 |
| PROJECT_STATUS.md | ✅ Current | Feb 11, 2026 |
| SIGNALR_CONFIGURATION.md | ✅ Current | Feb 11, 2026 |
| PRODUCTION_CONFIGURATION_SUMMARY.md | ✅ Current | Feb 11, 2026 |
| All other docs | ✅ Current | Feb 2026 |

---

## 🎯 Common Tasks

### I want to...

**Deploy to production**
→ `deploy-full-production.sh` + `DEPLOYMENT_GUIDE.md`

**Verify production is working**
→ `verify-production.sh` + `DEPLOYMENT_GUIDE.md`

**Set up local development**
→ `LOCAL_DEVELOPMENT.md` + `start-local-with-openai.sh`

**Understand the Live Quiz feature**
→ `LIVE_QUIZ.md` + `LIVE_QUIZ_IMPLEMENTATION.md`

**Check database schema**
→ `DATABASE_TABLES.md`

**Configure SignalR**
→ `SIGNALR_CONFIGURATION.md`

**Troubleshoot deployment issues**
→ `DEPLOYMENT_GUIDE.md` (Troubleshooting section)

**Understand system architecture**
→ `SYSTEM_ARCHITECTURE.md`

**Manage user roles**
→ `ROLE_ASSIGNMENT.md` + `SECURITY.md`

---

## 📚 Additional Resources

### Scripts Directory
- `scripts/init-tables.sh` - Initialize database tables
- `scripts/check-secrets.sh` - Verify no secrets in code

### Infrastructure
- `infrastructure/` - Bicep templates for Azure resources
- `infrastructure/parameters/prod.bicepparam` - Production parameters

### Backend
- `backend/` - Azure Functions (44 endpoints)
- `backend/src/functions/` - Function implementations

### Frontend
- `frontend/` - Next.js Static Web App
- `frontend/src/components/` - React components

---

**Need help?** Check `PROJECT_STATUS.md` for current system status or `GETTING_STARTED.md` for setup instructions.
