# Documentation Quick Reference

**Last Updated**: February 9, 2026

---

## 🚀 Getting Started

### For New Developers
1. **README.md** - Project overview and quick start
2. **GETTING_STARTED.md** - Detailed setup instructions
3. **LOCAL_DEVELOPMENT_SETUP.md** - Local environment setup

### For Teachers/Users
1. **LOGIN_GUIDE.md** - How to login and use the system
2. **TEST_FLOW.md** - How attendance flow works

---

## 🔐 Security & Challenge Code System

### Current Implementation
- **CHALLENGE_CODE_SYSTEM.md** ⭐ **NEW** - Complete guide to one-time challenge codes
  - How it works
  - Deployment status
  - Testing guide
  - Security analysis
  - Troubleshooting

### Historical Analysis
- **QR_CHAIN_SECURITY_ANALYSIS.md** - Original vulnerability analysis (issues now fixed)

---

## 📊 Database & Infrastructure

### Database
- **DATABASE_TABLES.md** - Table schemas and structure
- **DATABASE_MANAGEMENT.md** - Database operations and queries

### Deployment
- **DEPLOYMENT_GUIDE.md** - Full deployment instructions
- **DEPLOYMENT_CHECKLIST.md** - Pre-deployment checklist
- **DEPLOYMENT_SCRIPTS_GUIDE.md** - Script usage guide
- **SNAPSHOT_DEPLOYMENT.md** - Snapshot feature deployment

---

## 🔧 Development & Operations

### Development
- **DEV_TOOLS.md** - Development tools and commands
- **LOCAL_DEVELOPMENT_SETUP.md** - Local setup guide
- **QR_CHAIN_FLOW.md** - QR chain flow documentation

### Azure & Infrastructure
- **AZURE_ENVIRONMENT.md** - Azure resources and configuration
- **ROLE_ASSIGNMENT.md** - User role management
- **SECURITY.md** - Security best practices

---

## 📝 Feature Documentation

### Core Features
- **QR_CHAIN_FLOW.md** - How QR chain attendance works
- **GEOLOCATION_FEATURE.md** - GPS-based attendance verification
- **TEST_FLOW.md** - Complete testing flow

---

## 🗂️ Project Organization

### Main Documentation (Root)
```
README.md                          - Project overview
GETTING_STARTED.md                 - Quick start guide
CHALLENGE_CODE_SYSTEM.md          ⭐ Challenge code implementation
QR_CHAIN_SECURITY_ANALYSIS.md     - Security analysis (historical)
DATABASE_TABLES.md                 - Database schema
DEPLOYMENT_GUIDE.md                - Deployment instructions
```

### Archived Documentation
```
.archive/old-docs/                 - Historical documentation
```

---

## 🔍 Finding Information

### "How do I...?"

**Setup the project locally**
→ GETTING_STARTED.md → LOCAL_DEVELOPMENT_SETUP.md

**Deploy to Azure**
→ DEPLOYMENT_GUIDE.md → DEPLOYMENT_CHECKLIST.md

**Understand the challenge code system**
→ CHALLENGE_CODE_SYSTEM.md

**Test the system**
→ TEST_FLOW.md → CHALLENGE_CODE_SYSTEM.md (Testing Guide section)

**Manage the database**
→ DATABASE_TABLES.md → DATABASE_MANAGEMENT.md

**Troubleshoot issues**
→ CHALLENGE_CODE_SYSTEM.md (Troubleshooting section)
→ DEV_TOOLS.md

**Understand security**
→ CHALLENGE_CODE_SYSTEM.md (Security Analysis section)
→ SECURITY.md

**Assign user roles**
→ ROLE_ASSIGNMENT.md

**Use development tools**
→ DEV_TOOLS.md

---

## 📌 Most Important Documents

### Top 5 for Developers
1. **CHALLENGE_CODE_SYSTEM.md** - Current security implementation
2. **DATABASE_TABLES.md** - Database schema
3. **DEPLOYMENT_GUIDE.md** - How to deploy
4. **DEV_TOOLS.md** - Development commands
5. **QR_CHAIN_FLOW.md** - How the system works

### Top 3 for Users
1. **LOGIN_GUIDE.md** - How to login
2. **TEST_FLOW.md** - How to use the system
3. **CHALLENGE_CODE_SYSTEM.md** - How challenge codes work

---

## 🗑️ Removed/Consolidated Documents

The following documents were consolidated into **CHALLENGE_CODE_SYSTEM.md**:
- ~~DEPLOYMENT_FIX_SUMMARY.md~~
- ~~DEPLOYMENT_SUCCESS_TEST_GUIDE.md~~
- ~~ONE_TIME_CHALLENGE_IMPLEMENTATION_SUMMARY.md~~
- ~~CHALLENGE_CODE_IMPLEMENTATION.md~~
- ~~CHAIN_ATTACK_DIAGRAM.md~~

---

## 📞 Quick Links

### Production URLs
- **Frontend**: https://red-grass-0f8bc910f.4.azurestaticapps.net
- **Backend**: https://func-qrattendance-dev.azurewebsites.net

### Development
- **Local Frontend**: http://localhost:3002
- **Local Backend**: http://localhost:7071
- **Azurite**: http://127.0.0.1:10002

### Azure Portal
- **Resource Group**: rg-qr-attendance-dev
- **Function App**: func-qrattendance-dev
- **Static Web App**: red-grass-0f8bc910f
- **Storage Account**: stqrattendancedev

---

## 🔄 Document Maintenance

### When to Update

**CHALLENGE_CODE_SYSTEM.md**:
- When challenge code logic changes
- When security improvements are made
- When troubleshooting steps are added

**DATABASE_TABLES.md**:
- When table schemas change
- When new tables are added
- When fields are modified

**DEPLOYMENT_GUIDE.md**:
- When deployment process changes
- When new Azure resources are added
- When configuration changes

### Document Owners

- **Security/Challenge Codes**: Development Team
- **Database**: Development Team
- **Deployment**: DevOps Team
- **User Guides**: Product Team

---

## 📚 Additional Resources

### External Documentation
- [Azure Functions Docs](https://docs.microsoft.com/en-us/azure/azure-functions/)
- [Next.js Docs](https://nextjs.org/docs)
- [Azure Table Storage](https://docs.microsoft.com/en-us/azure/storage/tables/)

### Internal Resources
- Project Status: PROJECT_STATUS.md
- Quick Reference: QUICK_REFERENCE.md

### Complete Documentation Index
For a comprehensive list of all documentation including the docs/ folder, see DOCS_INDEX.md

---

**Need help?** Check the relevant document above or contact the development team.
