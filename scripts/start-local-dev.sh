#!/bin/bash

# Quick start script for local development
# Opens 3 terminal tabs/windows for backend, frontend, and optional Azurite

echo "🚀 Starting QR Chain Attendance - Local Development"
echo ""

# Check if configuration exists
if [ ! -f "backend/local.settings.json" ]; then
    echo "❌ backend/local.settings.json not found"
    echo "Run: ./scripts/setup-local-dev.sh first"
    exit 1
fi

if [ ! -f "frontend/.env.local" ]; then
    echo "❌ frontend/.env.local not found"
    echo "Run: ./scripts/setup-local-dev.sh first"
    exit 1
fi

# Check if using Azurite
USE_AZURITE=$(grep -q "UseDevelopmentStorage=true" backend/local.settings.json && echo "yes" || echo "no")

echo "Starting services..."
echo ""

# Function to open new terminal based on OS
open_terminal() {
    local title=$1
    local command=$2
    
    if command -v gnome-terminal &> /dev/null; then
        # Linux with GNOME
        gnome-terminal --tab --title="$title" -- bash -c "$command; exec bash"
    elif command -v xterm &> /dev/null; then
        # Linux with xterm
        xterm -T "$title" -e "$command; bash" &
    elif [[ "$OSTYPE" == "darwin"* ]]; then
        # macOS
        osascript -e "tell application \"Terminal\" to do script \"cd $(pwd) && $command\""
    else
        echo "⚠️  Could not detect terminal. Please run manually:"
        echo "   $command"
    fi
}

# Start Azurite if needed
if [ "$USE_AZURITE" = "yes" ]; then
    if ! command -v azurite &> /dev/null; then
        echo "⚠️  Azurite not found. Install with: npm install -g azurite"
        echo "Or run manually: azurite --silent --location ./azurite"
    else
        echo "Starting Azurite..."
        open_terminal "Azurite" "azurite --silent --location ./azurite"
        sleep 2
    fi
fi

# Start backend
echo "Starting Backend (Azure Functions)..."
open_terminal "Backend" "cd backend && npm start"
sleep 3

# Start frontend
echo "Starting Frontend (Next.js)..."
open_terminal "Frontend" "cd frontend && npm run dev"

echo ""
echo "✅ Services starting..."
echo ""
echo "📍 URLs:"
echo "   Frontend: http://localhost:3000"
echo "   Backend:  http://localhost:7071/api"
if [ "$USE_AZURITE" = "yes" ]; then
    echo "   Azurite:  http://127.0.0.1:10002"
fi
echo ""
echo "Press Ctrl+C in each terminal to stop services"
echo ""
