#!/bin/bash

# QR Chain Attendance - Development Tools
# Consolidated script for all local development tasks

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Show usage
show_usage() {
    echo ""
    echo -e "${BLUE}🛠️  QR Chain Attendance - Development Tools${NC}"
    echo "=============================================="
    echo ""
    echo "Usage: ./dev-tools.sh [command] [options]"
    echo ""
    echo "Commands:"
    echo "  start       - Start backend and frontend servers"
    echo "  stop        - Stop all running servers"
    echo "  restart     - Restart all servers"
    echo "  reset-db    - Clear local database (Azurite)"
    echo "  status      - Check server status"
    echo "  logs        - Show recent logs"
    echo "  help        - Show this help message"
    echo ""
    echo "Start Options:"
    echo "  --open, -o  - Auto-open browser to dev-config page"
    echo "  --logs, -l  - Auto-open log viewers in new terminals"
    echo ""
    echo "Examples:"
    echo "  ./dev-tools.sh start"
    echo "  ./dev-tools.sh start --open"
    echo "  ./dev-tools.sh start --open --logs"
    echo "  ./dev-tools.sh reset-db"
    echo "  ./dev-tools.sh status"
    echo ""
}

# Check server status
check_status() {
    echo ""
    echo -e "${BLUE}📊 Server Status${NC}"
    echo "================"
    echo ""
    
    # Check backend
    if lsof -Pi :7071 -sTCP:LISTEN -t >/dev/null 2>&1; then
        echo -e "${GREEN}✅ Backend:  Running on port 7071${NC}"
        echo "   URL: http://localhost:7071/api"
    else
        echo -e "${RED}❌ Backend:  Not running${NC}"
    fi
    
    # Check frontend
    if lsof -Pi :3002 -sTCP:LISTEN -t >/dev/null 2>&1; then
        echo -e "${GREEN}✅ Frontend: Running on port 3002${NC}"
        echo "   URL: http://localhost:3002"
    elif lsof -Pi :3001 -sTCP:LISTEN -t >/dev/null 2>&1; then
        echo -e "${GREEN}✅ Frontend: Running on port 3001${NC}"
        echo "   URL: http://localhost:3001"
    elif lsof -Pi :3000 -sTCP:LISTEN -t >/dev/null 2>&1; then
        echo -e "${GREEN}✅ Frontend: Running on port 3000${NC}"
        echo "   URL: http://localhost:3000"
    else
        echo -e "${RED}❌ Frontend: Not running${NC}"
    fi
    
    # Check Azurite
    if pgrep -f azurite > /dev/null 2>&1; then
        echo -e "${GREEN}✅ Azurite:  Running${NC}"
        echo "   Tables: http://127.0.0.1:10002"
    else
        echo -e "${YELLOW}⚠️  Azurite:  Not running (may be using Azure Storage)${NC}"
    fi
    
    echo ""
}

# Start servers
start_servers() {
    echo ""
    echo -e "${BLUE}🚀 Starting Development Servers${NC}"
    echo "================================"
    echo ""
    
    # Get the script directory
    SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
    
    # Check if already running
    if lsof -Pi :7071 -sTCP:LISTEN -t >/dev/null 2>&1; then
        echo -e "${YELLOW}⚠️  Backend already running on port 7071${NC}"
    else
        echo "Starting Backend (Azure Functions)..."
        (cd "$SCRIPT_DIR/backend" && npm start > "$SCRIPT_DIR/backend.log" 2>&1 &)
        BACKEND_PID=$!
        echo -e "${GREEN}✅ Backend starting (PID: $BACKEND_PID)${NC}"
    fi
    
    sleep 2
    
    # Kill any existing Next.js processes before starting
    echo "Checking for existing Next.js processes..."
    if pgrep -f "next dev" > /dev/null 2>&1 || pgrep -f "next-server" > /dev/null 2>&1; then
        echo -e "${YELLOW}⚠️  Found existing Next.js processes - killing them${NC}"
        pkill -9 -f "next dev" 2>/dev/null || true
        pkill -9 -f "next-server" 2>/dev/null || true
        sleep 2
    fi
    
    # Double-check ports are free
    for port in 3000 3001 3002 3003 3004 3005 3006 3007 3008; do
        if lsof -Pi :$port -sTCP:LISTEN -t >/dev/null 2>&1; then
            echo "Freeing port $port..."
            lsof -ti:$port | xargs kill -9 2>/dev/null || true
        fi
    done
    
    if lsof -Pi :3002 -sTCP:LISTEN -t >/dev/null 2>&1 || \
       lsof -Pi :3001 -sTCP:LISTEN -t >/dev/null 2>&1 || \
       lsof -Pi :3000 -sTCP:LISTEN -t >/dev/null 2>&1; then
        echo -e "${YELLOW}⚠️  Frontend already running - killing old processes${NC}"
        pkill -f "next dev" 2>/dev/null || true
        pkill -f "next-server" 2>/dev/null || true
        sleep 2
    fi
    
    echo "Starting Frontend (Next.js) on port 3000..."
    (cd "$SCRIPT_DIR/frontend" && PORT=3000 npm run dev > "$SCRIPT_DIR/frontend.log" 2>&1 &)
    FRONTEND_PID=$!
    echo -e "${GREEN}✅ Frontend starting (PID: $FRONTEND_PID)${NC}"
    
    # Wait and verify only one Next.js is running
    sleep 3
    NEXT_COUNT=$(pgrep -f "next-server" | wc -l)
    if [ "$NEXT_COUNT" -gt 1 ]; then
        echo -e "${RED}⚠️  Warning: Multiple Next.js processes detected ($NEXT_COUNT)${NC}"
        echo "   Killing duplicates..."
        # Keep only the most recent process
        pgrep -f "next-server" | head -n -1 | xargs kill -9 2>/dev/null || true
    fi
    
    echo ""
    echo -e "${GREEN}✅ Servers starting...${NC}"
    echo ""
    
    # Wait a bit for servers to start
    sleep 3
    
    # Always use port 3000
    FRONTEND_PORT=3000
    
    echo "📍 URLs:"
    echo "   Frontend: http://localhost:$FRONTEND_PORT"
    echo "   Backend:  http://localhost:7071/api"
    echo "   Dev Login: http://localhost:$FRONTEND_PORT/dev-config"
    echo ""
    
    # Open browser if requested
    if [ "$1" = "--open" ] || [ "$1" = "-o" ]; then
        echo "🌐 Opening browser..."
        if command -v xdg-open > /dev/null; then
            xdg-open "http://localhost:$FRONTEND_PORT/dev-config" 2>/dev/null &
        elif command -v open > /dev/null; then
            open "http://localhost:$FRONTEND_PORT/dev-config"
        else
            echo "   Could not detect browser opener. Please open manually."
        fi
        echo ""
    fi
    
    # Open logs if requested
    if [ "$1" = "--logs" ] || [ "$1" = "-l" ] || [ "$2" = "--logs" ] || [ "$2" = "-l" ]; then
        echo "📋 Opening logs in new terminals..."
        
        # Try to open logs in new terminal windows
        if command -v gnome-terminal > /dev/null; then
            gnome-terminal --tab --title="Backend Log" -- bash -c "tail -f $SCRIPT_DIR/backend.log; exec bash" 2>/dev/null &
            gnome-terminal --tab --title="Frontend Log" -- bash -c "tail -f $SCRIPT_DIR/frontend.log; exec bash" 2>/dev/null &
        elif command -v xterm > /dev/null; then
            xterm -T "Backend Log" -e "tail -f $SCRIPT_DIR/backend.log" &
            xterm -T "Frontend Log" -e "tail -f $SCRIPT_DIR/frontend.log" &
        else
            echo "   Could not open terminal windows. Use these commands:"
            echo "   tail -f $SCRIPT_DIR/backend.log"
            echo "   tail -f $SCRIPT_DIR/frontend.log"
        fi
        echo ""
    else
        echo "📝 View logs:"
        echo "   Backend:  tail -f $SCRIPT_DIR/backend.log"
        echo "   Frontend: tail -f $SCRIPT_DIR/frontend.log"
        echo ""
        echo "💡 Tip: Use './dev-tools.sh start --open --logs' to auto-open browser and logs"
        echo ""
    fi
    
    echo "🛑 To stop: ./dev-tools.sh stop"
    echo ""
}

# Stop servers
stop_servers() {
    echo ""
    echo -e "${BLUE}🛑 Stopping Development Servers${NC}"
    echo "================================"
    echo ""
    
    # Stop backend
    if lsof -Pi :7071 -sTCP:LISTEN -t >/dev/null 2>&1; then
        echo "Stopping Backend (port 7071)..."
        lsof -ti:7071 | xargs kill -9 2>/dev/null || true
        echo -e "${GREEN}✅ Backend stopped${NC}"
    else
        echo "ℹ️  Backend not running"
    fi
    
    # Kill ALL Next.js processes (not just by port)
    echo "Stopping all Next.js processes..."
    pkill -f "next dev" 2>/dev/null || true
    pkill -f "next-server" 2>/dev/null || true
    
    # Also kill by port just to be sure
    for port in 3000 3001 3002 3003 3004 3005 3006 3007 3008; do
        if lsof -Pi :$port -sTCP:LISTEN -t >/dev/null 2>&1; then
            lsof -ti:$port | xargs kill -9 2>/dev/null || true
        fi
    done
    
    echo -e "${GREEN}✅ Frontend stopped${NC}"
    
    echo ""
    echo -e "${GREEN}✅ All servers stopped${NC}"
    echo ""
}

# Reset database
reset_database() {
    echo ""
    echo -e "${BLUE}🗑️  Resetting Local Database${NC}"
    echo "============================"
    echo ""
    
    # Azurite stores data in /workspace
    AZURITE_DATA_DIR="/workspace"
    
    # Create directory if it doesn't exist
    if [ ! -d "$AZURITE_DATA_DIR" ]; then
        echo "📁 Creating Azurite data directory: $AZURITE_DATA_DIR"
        sudo mkdir -p "$AZURITE_DATA_DIR" 2>/dev/null || mkdir -p "$AZURITE_DATA_DIR" 2>/dev/null
        sudo chmod 777 "$AZURITE_DATA_DIR" 2>/dev/null || chmod 777 "$AZURITE_DATA_DIR" 2>/dev/null
    fi
    
    # Check if we can access the directory
    if [ ! -d "$AZURITE_DATA_DIR" ]; then
        echo -e "${YELLOW}⚠️  Cannot create $AZURITE_DATA_DIR${NC}"
        echo "   Azurite data directory not accessible."
        echo ""
        echo "   Alternative: Use Azure Storage Explorer to clear tables:"
        echo "   1. Connect to: http://127.0.0.1:10002"
        echo "   2. Delete tables: Sessions, Attendance, Chains, Tokens, UserSessions"
        echo ""
        return
    fi
    
    # Check if Azurite is running
    if pgrep -f azurite > /dev/null 2>&1; then
        echo -e "${YELLOW}⚠️  Azurite is running${NC}"
        echo "   Stopping Azurite to clear data..."
        sudo pkill -f azurite 2>/dev/null || pkill -f azurite 2>/dev/null
        sleep 2
        RESTART_AZURITE=true
    else
        RESTART_AZURITE=false
    fi
    
    # Remove Azurite data files
    echo "📁 Clearing Azurite data from: $AZURITE_DATA_DIR"
    
    CLEARED=0
    
    # Try with sudo first, then without
    if sudo rm -f "$AZURITE_DATA_DIR/__azurite_db_table__.json" 2>/dev/null || \
       rm -f "$AZURITE_DATA_DIR/__azurite_db_table__.json" 2>/dev/null; then
        echo -e "${GREEN}   ✓ Removed table storage data${NC}"
        CLEARED=1
    fi
    
    if sudo rm -rf "$AZURITE_DATA_DIR/__blobstorage__" 2>/dev/null || \
       rm -rf "$AZURITE_DATA_DIR/__blobstorage__" 2>/dev/null; then
        echo -e "${GREEN}   ✓ Removed blob storage data${NC}"
        CLEARED=1
    fi
    
    if sudo rm -rf "$AZURITE_DATA_DIR/__queuestorage__" 2>/dev/null || \
       rm -rf "$AZURITE_DATA_DIR/__queuestorage__" 2>/dev/null; then
        echo -e "${GREEN}   ✓ Removed queue storage data${NC}"
        CLEARED=1
    fi
    
    if sudo rm -rf "$AZURITE_DATA_DIR/__tablestorage__" 2>/dev/null || \
       rm -rf "$AZURITE_DATA_DIR/__tablestorage__" 2>/dev/null; then
        echo -e "${GREEN}   ✓ Removed table storage directory${NC}"
        CLEARED=1
    fi
    
    if [ $CLEARED -eq 0 ]; then
        echo -e "${YELLOW}   ℹ️  No data found to clear${NC}"
    fi
    
    # Restart Azurite if it was running
    if [ "$RESTART_AZURITE" = true ]; then
        echo ""
        echo "Restarting Azurite..."
        sudo azurite --blobHost 0.0.0.0 --queueHost 0.0.0.0 --tableHost 0.0.0.0 --location /workspace --debug /workspace/debug.log > /dev/null 2>&1 &
        sleep 3
        echo -e "${GREEN}✅ Azurite restarted${NC}"
        
        # Recreate tables automatically
        echo ""
        echo "📋 Recreating tables..."
        if [ -f "$SCRIPT_DIR/scripts/init-tables.sh" ]; then
            bash "$SCRIPT_DIR/scripts/init-tables.sh"
            echo -e "${GREEN}✅ Tables recreated${NC}"
        else
            echo -e "${YELLOW}⚠️  init-tables.sh not found, skipping table creation${NC}"
        fi
    fi
    
    echo ""
    echo -e "${GREEN}✅ Database reset complete!${NC}"
    echo ""
}

# Show logs
show_logs() {
    echo ""
    echo -e "${BLUE}📋 Recent Logs${NC}"
    echo "=============="
    echo ""
    
    # Get the script directory
    SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
    
    if [ -f "$SCRIPT_DIR/backend.log" ]; then
        echo -e "${YELLOW}Backend (last 20 lines):${NC}"
        tail -20 "$SCRIPT_DIR/backend.log"
        echo ""
    else
        echo "No backend.log found"
    fi
    
    if [ -f "$SCRIPT_DIR/frontend.log" ]; then
        echo -e "${YELLOW}Frontend (last 20 lines):${NC}"
        tail -20 "$SCRIPT_DIR/frontend.log"
        echo ""
    else
        echo "No frontend.log found"
    fi
    
    echo "💡 Tip: Use 'tail -f backend.log' or 'tail -f frontend.log' for live logs"
    echo ""
}

# Main command handler
case "${1:-help}" in
    start)
        start_servers "$2" "$3"
        ;;
    stop)
        stop_servers
        ;;
    restart)
        echo ""
        echo -e "${BLUE}🔄 Cleaning frontend build cache...${NC}"
        SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
        rm -rf "$SCRIPT_DIR/frontend/.next" "$SCRIPT_DIR/frontend/tsconfig.tsbuildinfo" 2>/dev/null
        echo -e "${GREEN}✅ Cache cleaned${NC}"
        stop_servers
        sleep 2
        start_servers "$2" "$3"
        ;;
    reset-db)
        reset_database
        ;;
    status)
        check_status
        ;;
    logs)
        show_logs
        ;;
    help|--help|-h)
        show_usage
        ;;
    *)
        echo -e "${RED}❌ Unknown command: $1${NC}"
        show_usage
        exit 1
        ;;
esac
