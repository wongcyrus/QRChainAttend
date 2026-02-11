# Environment Scripts & Access

Quick reference for all environment scripts and production access.

---

## Local Development Scripts

### 1. Pure Local (Port 3000)
```bash
./scripts/start-local-dev.sh
```
- Local backend + frontend
- Azurite (local Azure)
- Safe testing

### 2. Local + Production OpenAI (Port 3000)
```bash
./start-local-with-openai.sh
```
- Local backend + frontend
- Azurite (local database)
- Production OpenAI (Live Quiz)
- Safe testing with AI

### 3. Local Frontend + Prod Backend (Port 3002)
```bash
./start-local-with-prod.sh
```
- Local frontend only
- Production backend/database
- Frontend development

### 4. Local + Prod Azure (Port 3001)
```bash
./start-local-prod.sh
```
- Local backend + frontend
- Production Azure resources
- Backend development

---

## Production Access

### Open Production
```bash
./start-production.sh
```

Interactive menu to:
- Open frontend app
- Open backend API
- Open Azure Portal
- View monitoring commands

### Production URLs
- **Frontend**: https://ashy-desert-0fc9a700f.6.azurestaticapps.net
- **Backend**: https://func-qrattendance-prod.azurewebsites.net/api

---

## Monitoring Commands

### Function App Status
```bash
az functionapp show \
  --name func-qrattendance-prod \
  --resource-group rg-qr-attendance-prod \
  --query state -o tsv
```

### Stream Logs
```bash
az functionapp log tail \
  --name func-qrattendance-prod \
  --resource-group rg-qr-attendance-prod
```

### List Functions
```bash
az functionapp function list \
  --name func-qrattendance-prod \
  --resource-group rg-qr-attendance-prod \
  --query "[].name" -o table
```

### Check Tables
```bash
az storage table list \
  --account-name stqrattendanceprod \
  --query "[].name" -o table
```

### Restart Function App
```bash
az functionapp restart \
  --name func-qrattendance-prod \
  --resource-group rg-qr-attendance-prod
```

---

## Environment Comparison

| Feature | Pure Local | Local + OpenAI | Local + Prod BE | Local + Prod Azure |
|---------|------------|----------------|-----------------|-------------------|
| Frontend | Local (3000) | Local (3000) | Local (3002) | Local (3001) |
| Backend | Local (7071) | Local (7071) | Production | Local (7071) |
| Database | Azurite | Azurite | Production | Production |
| OpenAI | N/A | Production | Production | Production |
| Safe | ✅ Yes | ✅ Yes | ⚠️ Careful | ⚠️ Careful |

---

## Quick Reference

```bash
# Pure local development
./scripts/start-local-dev.sh

# Local with production OpenAI (test Live Quiz)
./start-local-with-openai.sh

# Frontend dev with prod backend
./start-local-with-prod.sh

# Backend dev with prod Azure
./start-local-prod.sh

# Access production
./start-production.sh

# Deploy to production
./deploy-full-production.sh
```
