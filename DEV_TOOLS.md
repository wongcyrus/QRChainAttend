# Development Tools

One consolidated script for all local development tasks.

## Quick Start

```bash
# Start everything
./dev-tools.sh start

# Check status
./dev-tools.sh status

# Reset database
./dev-tools.sh reset-db

# Stop everything
./dev-tools.sh stop
```

## All Commands

### `./dev-tools.sh start`
Starts backend and frontend servers in the background.
- Backend: http://localhost:7071/api
- Frontend: http://localhost:3002
- Logs: `backend.log` and `frontend.log`

### `./dev-tools.sh stop`
Stops all running development servers.

### `./dev-tools.sh restart`
Stops and restarts all servers.

### `./dev-tools.sh reset-db`
Clears all local Azurite database data:
- Sessions
- Attendance records
- Chains
- Tokens

Use this when you want a fresh start.

### `./dev-tools.sh status`
Shows which servers are running and their URLs.

### `./dev-tools.sh logs`
Shows recent logs from backend and frontend.

### `./dev-tools.sh help`
Shows usage information.

## Common Workflows

### Fresh Start
```bash
./dev-tools.sh stop
./dev-tools.sh reset-db
./dev-tools.sh start
```

### Check Everything
```bash
./dev-tools.sh status
./dev-tools.sh logs
```

### Watch Logs Live
```bash
# In separate terminals
tail -f backend.log
tail -f frontend.log
```

## Troubleshooting

### Servers won't start
```bash
# Check what's using the ports
lsof -i :7071  # Backend
lsof -i :3002  # Frontend

# Force stop everything
./dev-tools.sh stop
```

### Database issues
```bash
# Reset and restart
./dev-tools.sh reset-db
./dev-tools.sh restart
```

### See detailed errors
```bash
# Check logs
./dev-tools.sh logs

# Or watch live
tail -f backend.log
```

## Old Scripts (Deprecated)

The following scripts are replaced by `dev-tools.sh`:
- `dev.sh` → Use `./dev-tools.sh start`
- `stop-dev.sh` → Use `./dev-tools.sh stop`
- `scripts/reset-local-db.sh` → Use `./dev-tools.sh reset-db`
- `scripts/start-local-dev.sh` → Use `./dev-tools.sh start` (or keep for separate terminals)

Keep `scripts/setup-local-dev.sh` for initial Azure configuration.
