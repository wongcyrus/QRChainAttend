#!/bin/bash

# Stop Local Development Servers

echo "🛑 Stopping development servers..."

# Stop backend (port 7071)
if lsof -Pi :7071 -sTCP:LISTEN -t >/dev/null ; then
    echo "Stopping Backend (port 7071)..."
    lsof -ti:7071 | xargs kill -9 2>/dev/null
    echo "✅ Backend stopped"
else
    echo "ℹ️  Backend not running"
fi

# Stop frontend (port 3001 or 3000)
if lsof -Pi :3001 -sTCP:LISTEN -t >/dev/null ; then
    echo "Stopping Frontend (port 3001)..."
    lsof -ti:3001 | xargs kill -9 2>/dev/null
    echo "✅ Frontend stopped"
elif lsof -Pi :3000 -sTCP:LISTEN -t >/dev/null ; then
    echo "Stopping Frontend (port 3000)..."
    lsof -ti:3000 | xargs kill -9 2>/dev/null
    echo "✅ Frontend stopped"
else
    echo "ℹ️  Frontend not running"
fi

echo ""
echo "✅ All development servers stopped"
