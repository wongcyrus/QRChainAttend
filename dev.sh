#!/bin/bash

# Quick Local Development Launcher
# Starts both frontend and backend servers

echo "🚀 QR Chain Attendance - Local Development"
echo "=========================================="
echo ""

# Check if servers are already running
if lsof -Pi :7071 -sTCP:LISTEN -t >/dev/null ; then
    echo "⚠️  Backend already running on port 7071"
else
    echo "Starting Backend (Azure Functions)..."
    cd backend && func start &
    BACKEND_PID=$!
    echo "✅ Backend starting (PID: $BACKEND_PID)"
fi

sleep 2

if lsof -Pi :3001 -sTCP:LISTEN -t >/dev/null ; then
    echo "⚠️  Frontend already running on port 3001"
elif lsof -Pi :3000 -sTCP:LISTEN -t >/dev/null ; then
    echo "⚠️  Frontend already running on port 3000"
else
    echo "Starting Frontend (Next.js)..."
    cd frontend && npm run dev &
    FRONTEND_PID=$!
    echo "✅ Frontend starting (PID: $FRONTEND_PID)"
fi

echo ""
echo "=========================================="
echo "✅ Development servers starting..."
echo ""
echo "📍 URLs:"
echo "   Frontend: http://localhost:3001"
echo "   Backend:  http://localhost:7071/api"
echo "   Dev Config: http://localhost:3001/dev-config"
echo ""
echo "📖 Documentation:"
echo "   Quick Start: LOCAL_DEV_READY.md"
echo "   Full Guide: LOCAL_DEVELOPMENT_SETUP.md"
echo ""
echo "🛑 To stop: Press Ctrl+C or run: ./stop-dev.sh"
echo "=========================================="
echo ""

# Wait for user interrupt
wait
