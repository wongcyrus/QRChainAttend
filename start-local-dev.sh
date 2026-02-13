#!/bin/bash
# Start Local Development Environment
# Quick script to start both frontend and backend for local development

set -e

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}=========================================="
echo "QR Chain Attendance - Start Local Development"
echo -e "==========================================${NC}"
echo ""

# Check if local development is configured
if [ ! -f "backend/local.settings.json" ] || [ ! -f "frontend/.env.local" ]; then
    echo -e "${YELLOW}Local development not configured${NC}"
    echo "Please run: ./setup-local-dev-env.sh first"
    echo ""
    exit 1
fi

# Function to check if port is in use
check_port() {
    local port=$1
    if lsof -Pi :$port -sTCP:LISTEN -t >/dev/null; then
        return 0  # Port is in use
    else
        return 1  # Port is free
    fi
}

# Check if ports are available
echo -e "${BLUE}Checking ports...${NC}"

if check_port 3000; then
    echo -e "${YELLOW}⚠ Port 3000 is already in use (frontend)${NC}"
    echo "Please stop the process using port 3000 or use: npm run dev -- --port 3001"
fi

if check_port 7071; then
    echo -e "${YELLOW}⚠ Port 7071 is already in use (backend)${NC}"
    echo "Please stop the process using port 7071"
fi

echo ""

# Check dependencies
echo -e "${BLUE}Checking dependencies...${NC}"

cd backend
if [ ! -d "node_modules" ]; then
    echo "Installing backend dependencies..."
    npm install
fi
cd ..

cd frontend  
if [ ! -d "node_modules" ]; then
    echo "Installing frontend dependencies..."
    npm install
fi
cd ..

echo -e "${GREEN}✓ Dependencies ready${NC}"
echo ""

# Start servers
echo -e "${BLUE}Starting development servers...${NC}"
echo ""
echo -e "${GREEN}Backend will start at: http://localhost:7071${NC}"
echo -e "${GREEN}Frontend will start at: http://localhost:3000${NC}"
echo ""
echo -e "${YELLOW}Press Ctrl+C to stop both servers${NC}"
echo ""

# Create a cleanup function
cleanup() {
    echo ""
    echo -e "${YELLOW}Stopping development servers...${NC}"
    jobs -p | xargs -r kill
    exit 0
}

# Set up signal handlers
trap cleanup SIGINT SIGTERM

# Start backend in background
echo -e "${BLUE}Starting backend...${NC}"
cd backend
npm run start &
BACKEND_PID=$!
cd ..

# Wait a moment for backend to start
sleep 3

# Start frontend in background  
echo -e "${BLUE}Starting frontend...${NC}"
cd frontend
npm run dev &
FRONTEND_PID=$!
cd ..

# Wait for both processes
echo -e "${GREEN}✓ Both servers started!${NC}"
echo ""
echo -e "${YELLOW}Development servers running:${NC}"
echo "  Backend:  http://localhost:7071"
echo "  Frontend: http://localhost:3000"
echo ""
echo -e "${YELLOW}Press Ctrl+C to stop both servers${NC}"

# Wait for either process to finish
wait