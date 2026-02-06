#!/bin/bash

# Verify Local Development Configuration
# Checks that local dev is properly configured to use local services

echo "=========================================="
echo "Local Development Configuration Check"
echo "=========================================="
echo ""

# Check frontend .env.local
echo "📋 Checking frontend configuration..."
if [ -f "frontend/.env.local" ]; then
    API_URL=$(grep "NEXT_PUBLIC_API_URL" frontend/.env.local | cut -d'=' -f2)
    ENVIRONMENT=$(grep "NEXT_PUBLIC_ENVIRONMENT" frontend/.env.local | cut -d'=' -f2)
    
    if [ "$API_URL" = "http://localhost:7071/api" ]; then
        echo "  ✓ API URL: $API_URL (local)"
    else
        echo "  ⚠️  API URL: $API_URL (should be http://localhost:7071/api)"
    fi
    
    if [ "$ENVIRONMENT" = "local" ]; then
        echo "  ✓ Environment: $ENVIRONMENT"
    else
        echo "  ⚠️  Environment: $ENVIRONMENT (should be 'local')"
    fi
else
    echo "  ❌ frontend/.env.local not found"
fi

echo ""

# Check backend local.settings.json
echo "📋 Checking backend configuration..."
if [ -f "backend/local.settings.json" ]; then
    STORAGE=$(grep -o "127.0.0.1:10002" backend/local.settings.json)
    SIGNALR=$(grep "SIGNALR_CONNECTION_STRING" backend/local.settings.json | grep -o "dummy")
    
    if [ -n "$STORAGE" ]; then
        echo "  ✓ Storage: Using Azurite (127.0.0.1:10002)"
    else
        echo "  ⚠️  Storage: Not using local Azurite"
    fi
    
    if [ "$SIGNALR" = "dummy" ]; then
        echo "  ✓ SignalR: Disabled (using polling fallback)"
    else
        echo "  ⚠️  SignalR: May be using production service"
    fi
else
    echo "  ❌ backend/local.settings.json not found"
fi

echo ""

# Check if Azurite is running
echo "🔍 Checking if Azurite is running..."
if lsof -i :10002 > /dev/null 2>&1; then
    echo "  ✓ Azurite is running on port 10002"
else
    echo "  ⚠️  Azurite is NOT running"
    echo "     Start it with: npx azurite --silent --location azurite --debug azurite/debug.log"
fi

echo ""

# Check if backend is running
echo "🔍 Checking if backend is running..."
if lsof -i :7071 > /dev/null 2>&1; then
    echo "  ✓ Backend is running on port 7071"
else
    echo "  ⚠️  Backend is NOT running"
    echo "     Start it with: cd backend && npm start"
fi

echo ""

# Check if frontend is running
echo "🔍 Checking if frontend is running..."
if lsof -i :3000 > /dev/null 2>&1; then
    echo "  ✓ Frontend is running on port 3000"
else
    echo "  ⚠️  Frontend is NOT running"
    echo "     Start it with: cd frontend && npm run dev"
fi

echo ""
echo "=========================================="
echo "Summary"
echo "=========================================="
echo ""
echo "Local development should use:"
echo "  • Frontend: http://localhost:3000"
echo "  • Backend API: http://localhost:7071/api"
echo "  • Storage: Azurite (127.0.0.1:10002)"
echo "  • SignalR: Disabled (polling fallback)"
echo ""
echo "Production uses:"
echo "  • Frontend: https://red-grass-0f8bc910f.4.azurestaticapps.net"
echo "  • Backend API: https://func-qrattendance-dev.azurewebsites.net/api"
echo "  • Storage: stqrattendancedev (Azure)"
echo "  • SignalR: signalr-qrattendance-dev (Azure)"
echo ""
