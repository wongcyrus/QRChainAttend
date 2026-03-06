# Documentation Index

**Last Updated**: March 5, 2026  
**Status**: ✅ Organized and Current

---

## 📚 Quick Navigation

### Essential (Root Directory)
- **[README.md](README.md)** - Project overview and quick start
- **[GETTING_STARTED.md](GETTING_STARTED.md)** - Setup and first steps
- **[PROJECT_STATUS.md](PROJECT_STATUS.md)** - Current deployment status
- **[SECURITY.md](SECURITY.md)** - Security guidelines
- **[SCRIPTS_README.md](SCRIPTS_README.md)** - Script documentation
- **[AGENT_SERVICE_GUIDE.md](AGENT_SERVICE_GUIDE.md)** - Azure AI Foundry Agent Service guide

---

## 🏗️ Architecture Documentation

**Location**: `docs/architecture/`

- **[SYSTEM_ARCHITECTURE.md](docs/architecture/SYSTEM_ARCHITECTURE.md)** - Complete system design
- **[INFRASTRUCTURE_BICEP.md](docs/architecture/INFRASTRUCTURE_BICEP.md)** - Bicep IaC module details
- **[DEPLOYMENT_SCRIPTS.md](docs/architecture/DEPLOYMENT_SCRIPTS.md)** - Deployment script architecture
- **[DATABASE_TABLES.md](docs/architecture/DATABASE_TABLES.md)** - Database schema (16 tables)
- **[DATABASE_MANAGEMENT.md](docs/architecture/DATABASE_MANAGEMENT.md)** - Database operations
- **[LIVE_QUIZ.md](docs/architecture/LIVE_QUIZ.md)** - AI-powered quiz feature
- **[ENTRY_CHAIN_DUPLICATE_PREVENTION.md](docs/architecture/ENTRY_CHAIN_DUPLICATE_PREVENTION.md)** - Chain holder prevention

---

## 🚀 Deployment Documentation

**Location**: `docs/deployment/`

- **[DEPLOYMENT_GUIDE.md](docs/deployment/DEPLOYMENT_GUIDE.md)** - Complete deployment guide
- **[AZURE_AD_CONFIG.md](docs/deployment/AZURE_AD_CONFIG.md)** - Azure AD configuration

**Location**: `infrastructure/`

- **[infrastructure/README.md](infrastructure/README.md)** - Infrastructure as Code overview

---

## 🔧 Development Documentation

**Location**: `docs/development/`

- **[LOCAL_DEVELOPMENT.md](docs/development/LOCAL_DEVELOPMENT.md)** - Local development setup
- **[DEVELOPMENT_ENVIRONMENT.md](docs/development/DEVELOPMENT_ENVIRONMENT.md)** - Environment configuration
- **[REFACTORING_GUIDE.md](docs/development/REFACTORING_GUIDE.md)** - Code refactoring guide
- **[REFACTORING_FINAL_REPORT.md](docs/development/REFACTORING_FINAL_REPORT.md)** - Refactoring completion report

---

## 📦 Archive (Historical)

**Location**: `docs/archive/`

- **[CODE_REVIEW_ANALYSIS.md](docs/archive/CODE_REVIEW_ANALYSIS.md)** - Code review findings
- **[DOCUMENTATION_UPDATES.md](docs/archive/DOCUMENTATION_UPDATES.md)** - Documentation change log
- **[REFACTORING_COMPLETE.md](docs/archive/REFACTORING_COMPLETE.md)** - Refactoring phase 1
- **[UTILITY_EXTRACTION_SUMMARY.md](docs/archive/UTILITY_EXTRACTION_SUMMARY.md)** - Utility extraction summary
- **[EXTERNAL_ID_MIGRATION.md](docs/archive/EXTERNAL_ID_MIGRATION.md)** - External ID migration notes
- **[SECURITY_AUDIT.md](docs/archive/SECURITY_AUDIT.md)** - Security audit report

---

## 🔍 Find Documentation By Task

### I want to...

**...understand the project**
- Start with [README.md](README.md)
- Then read [docs/architecture/SYSTEM_ARCHITECTURE.md](docs/architecture/SYSTEM_ARCHITECTURE.md)

**...set up local development**
- Follow [GETTING_STARTED.md](GETTING_STARTED.md)
- Then [docs/development/LOCAL_DEVELOPMENT.md](docs/development/LOCAL_DEVELOPMENT.md)

**...deploy to production**
- Read [docs/deployment/DEPLOYMENT_GUIDE.md](docs/deployment/DEPLOYMENT_GUIDE.md)
- Understand [docs/architecture/INFRASTRUCTURE_BICEP.md](docs/architecture/INFRASTRUCTURE_BICEP.md)
- Review [docs/architecture/DEPLOYMENT_SCRIPTS.md](docs/architecture/DEPLOYMENT_SCRIPTS.md)
- Configure [docs/deployment/AZURE_AD_CONFIG.md](docs/deployment/AZURE_AD_CONFIG.md)

**...understand the database**
- See [docs/architecture/DATABASE_TABLES.md](docs/architecture/DATABASE_TABLES.md)
- Manage with [docs/architecture/DATABASE_MANAGEMENT.md](docs/architecture/DATABASE_MANAGEMENT.md)

**...work on the quiz feature**
- Read [docs/architecture/LIVE_QUIZ.md](docs/architecture/LIVE_QUIZ.md)
- See [AGENT_SERVICE_GUIDE.md](AGENT_SERVICE_GUIDE.md) for agent setup

**...understand authentication and security**
- Check [SECURITY.md](SECURITY.md)
- Review [API_KEY_REMOVAL_SUMMARY.md](API_KEY_REMOVAL_SUMMARY.md) for managed identity migration

**...contribute code**
- Follow [docs/development/REFACTORING_GUIDE.md](docs/development/REFACTORING_GUIDE.md)
- Check [SECURITY.md](SECURITY.md)

**...run scripts**
- See [SCRIPTS_README.md](SCRIPTS_README.md)

---

## 📁 Directory Structure

```
/
├── README.md                          # Project overview
├── GETTING_STARTED.md                 # Quick start guide
├── PROJECT_STATUS.md                  # Current status
├── SECURITY.md                        # Security guidelines
├── SCRIPTS_README.md                  # Script documentation
├── DOCUMENTATION_INDEX.md             # This file
├── deploy-full-production.sh          # Production deployment
├── deploy-full-development.sh         # Development deployment
│
├── docs/
│   ├── architecture/                  # System design docs
│   │   ├── SYSTEM_ARCHITECTURE.md     # Overall architecture
│   │   ├── INFRASTRUCTURE_BICEP.md    # Bicep IaC details
│   │   ├── DEPLOYMENT_SCRIPTS.md      # Script architecture
│   │   ├── DATABASE_TABLES.md         # Database schema
│   │   ├── DATABASE_MANAGEMENT.md     # DB operations
│   │   └── LIVE_QUIZ.md               # Quiz feature
│   │
│   ├── deployment/                    # Deployment guides
│   │   ├── DEPLOYMENT_GUIDE.md
│   │   └── AZURE_AD_CONFIG.md
│   │
│   ├── development/                   # Development guides
│   │   ├── LOCAL_DEVELOPMENT.md
│   │   ├── DEVELOPMENT_ENVIRONMENT.md
│   │   ├── REFACTORING_GUIDE.md
│   │   └── REFACTORING_FINAL_REPORT.md
│   │
│   └── archive/                       # Historical docs
│
├── infrastructure/                    # IaC templates
│   ├── main.bicep                     # Main orchestrator
│   ├── modules/                       # Bicep modules
│   │   ├── storage.bicep
│   │   ├── signalr.bicep
│   │   ├── functions.bicep
│   │   ├── appinsights.bicep
│   │   ├── openai.bicep
│   │   └── rbac.bicep
│   ├── parameters/                    # Environment params
│   │   ├── dev.bicepparam
│   │   └── prod.bicepparam
│   └── README.md
│
├── backend/                           # Backend code
├── frontend/                          # Frontend code
└── scripts/                          # Utility scripts
```

---

## 🔄 Recent Changes

### March 5, 2026 (Latest)
- ✅ Created INFRASTRUCTURE_BICEP.md - detailed Bicep module documentation
- ✅ Created DEPLOYMENT_SCRIPTS.md - deployment script architecture
- ✅ Updated SYSTEM_ARCHITECTURE.md with current infrastructure
- ✅ Updated DEPLOYMENT_GUIDE.md with current deployment process
- ✅ Updated infrastructure/README.md with current state
- ✅ Updated database table count to 16 (added capture tables)

### March 3, 2026
- ✅ Migrated position estimation to agent service (no API keys)
- ✅ Created position estimation agent creation script
- ✅ Updated deployment script to create both agents

### February 25, 2026
- ✅ Organized documentation into subdirectories
- ✅ Moved temporary files to archive
- ✅ Updated all documentation links
- ✅ Completed code refactoring (45/45 functions)
- ✅ Updated architecture documentation

---

**Last Updated**: March 5, 2026  
**Maintained By**: Development Team
