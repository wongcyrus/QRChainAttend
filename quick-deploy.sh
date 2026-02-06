#!/bin/bash

# ============================================================================
# Quick Production Deployment - No Checks, Just Deploy
# ============================================================================
# Use this when you just want to deploy quickly without verification
# ============================================================================

set -e

# Hardcoded values
FUNCTION_APP="func-qrattendance-dev"
SWA_TOKEN="61c2f660e3ea5834155969e116766737bdc24fcc10f6ab6b96ebab39f20390ef04-5186aca9-76f1-482d-bf64-7298c1c482ad00f10150f8bc910f"

echo "🚀 Quick Deploy Starting..."
echo ""

# Backend
echo "📦 Building backend..."
cd backend
npm run build > /dev/null 2>&1
echo "☁️  Deploying backend..."
func azure functionapp publish "$FUNCTION_APP" > /dev/null 2>&1
echo "✅ Backend deployed"
cd ..

# Frontend
echo "📦 Building frontend..."
cd frontend
[ -f .env.local ] && mv .env.local .env.local.backup
NODE_ENV=production npm run build > /dev/null 2>&1
[ -f .env.local.backup ] && mv .env.local.backup .env.local
echo "☁️  Deploying frontend..."
swa deploy ./out --deployment-token "$SWA_TOKEN" --env production > /dev/null 2>&1
echo "✅ Frontend deployed"
cd ..

echo ""
echo "🎉 Deployment Complete!"
echo "🌐 https://red-grass-0f8bc910f.4.azurestaticapps.net"
echo ""
