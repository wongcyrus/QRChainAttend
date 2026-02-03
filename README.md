# QR Chain Attendance System

An Azure-based classroom attendance solution that uses peer-to-peer QR code chains and rotating QR codes to verify student presence while resisting common cheating methods (screenshots, remote scans, proxy attendance).

## Architecture

- **Frontend**: React/Next.js Progressive Web App (Azure Static Web Apps)
- **Backend**: Azure Functions (TypeScript, serverless)
- **Storage**: Azure Table Storage
- **Real-time**: Azure SignalR Service
- **Authentication**: Microsoft Entra ID
- **AI Insights**: Azure OpenAI (optional)

## Project Structure

```
qr-chain-attendance/
├── frontend/              # Next.js PWA frontend
│   ├── src/
│   │   ├── components/   # React components
│   │   ├── pages/        # Next.js pages
│   │   ├── hooks/        # Custom React hooks
│   │   └── utils/        # Utility functions
│   ├── public/           # Static assets
│   └── package.json
├── backend/              # Azure Functions backend
│   ├── src/
│   │   ├── functions/   # HTTP and Timer triggered functions
│   │   ├── services/    # Business logic services
│   │   ├── storage/     # Azure Table Storage clients
│   │   ├── config/      # Configuration management
│   │   └── test/        # Test utilities
│   ├── host.json
│   ├── local.settings.json
│   └── package.json
├── shared/               # Shared TypeScript types
│   ├── src/
│   │   └── types/       # Data models and interfaces
│   └── package.json
├── staticwebapp.config.json  # Azure SWA configuration
└── package.json          # Root workspace configuration
```

## Prerequisites

- Node.js 18.x or later
- Azure Functions Core Tools v4
- Azurite (for local Azure Storage emulation)
- Azure CLI (for deployment)

## Getting Started

### 1. Install Dependencies

```bash
npm run install:all
```

### 2. Deploy to Azure

**📚 See [DEPLOYMENT_GUIDE.md](DEPLOYMENT_GUIDE.md) for complete deployment instructions.**

Quick summary:
1. Create Azure AD app registration
2. Create GitHub repository and token
3. Deploy infrastructure with Bicep
4. Deploy application code

### 3. Local Development

**Terminal 1 - Start Azurite (Azure Storage Emulator):**
```bash
azurite --silent --location ./azurite --debug ./azurite/debug.log
```

**Terminal 2 - Start Backend (Azure Functions):**
```bash
npm run dev:backend
```

**Terminal 3 - Start Frontend (Next.js):**
```bash
npm run dev:frontend
```

### 4. Access the Application

- Frontend: http://localhost:3000
- Backend API: http://localhost:7071/api

## Configuration

### Environment Variables

Backend configuration is managed through `backend/local.settings.json` for local development and Azure App Settings for production.

**Required:**
- `STORAGE_ACCOUNT_NAME`: Azure Storage account name
- `STORAGE_ACCOUNT_URI`: Azure Storage account URI
- `SIGNALR_CONNECTION_STRING`: Azure SignalR connection string

**Optional (with defaults):**
- `LATE_ROTATION_SECONDS`: Late entry QR rotation interval (default: 60)
- `EARLY_LEAVE_ROTATION_SECONDS`: Early leave QR rotation interval (default: 60)
- `CHAIN_TOKEN_TTL_SECONDS`: Chain token time-to-live (default: 20)
- `OWNER_TRANSFER`: Enable baton transfer in chains (default: true)
- `WIFI_SSID_ALLOWLIST`: Comma-separated list of allowed Wi-Fi SSIDs
- `AOAI_ENDPOINT`: Azure OpenAI endpoint (optional)
- `AOAI_KEY`: Azure OpenAI API key (optional)
- `AOAI_DEPLOYMENT`: Azure OpenAI deployment name (optional)

## Testing

### Run All Tests
```bash
npm test
```

### Run Unit Tests Only
```bash
npm run test:unit
```

### Run Property-Based Tests Only
```bash
npm run test:property
```

### Test Coverage
```bash
npm test -- --coverage
```

## Building for Production

### Build Frontend
```bash
npm run build:frontend
```

### Build Backend
```bash
npm run build:backend
```

## Documentation

- **[Development Guide](docs/DEVELOPMENT.md)** - Local setup, testing, and development workflow
- **[Backend Architecture](docs/BACKEND_ARCHITECTURE.md)** - Backend services, caching, and error handling
- **[Frontend Architecture](docs/FRONTEND_ARCHITECTURE.md)** - Components, PWA features, and offline support
- **[Deployment Guide](docs/DEPLOYMENT.md)** - Infrastructure deployment and CI/CD pipeline
- **[Monitoring Guide](docs/MONITORING.md)** - Metrics, alerts, and troubleshooting
- **[Implementation History](docs/IMPLEMENTATION_HISTORY.md)** - Feature development timeline

## Deployment

See [Deployment Guide](docs/DEPLOYMENT.md) for detailed instructions.

### Quick Deploy to Azure

1. Deploy infrastructure: `cd infrastructure && ./deploy.sh dev`
2. Configure managed identity: `cd scripts && ./configure-managed-identity.sh`
3. Deploy via GitHub Actions or manually with Azure CLI

## Key Features

- **Anti-Cheat Mechanisms**:
  - Short-lived tokens (20s for chains, 60s for rotating QR)
  - Single-use enforcement via ETag concurrency control
  - Optional GPS geofencing and Wi-Fi validation
  - Rate limiting (10 scans/60s per device, 50 scans/60s per IP)

- **Peer-to-Peer Verification**:
  - Entry chains for on-time arrival verification
  - Exit chains for end-of-class presence verification
  - Baton transfer mechanism distributes trust

- **Real-Time Dashboard**:
  - Live attendance status updates via SignalR
  - Chain progress monitoring
  - Stall detection and recovery

- **Progressive Web App**:
  - Install on mobile devices
  - Offline-capable with service worker
  - Fast loading with cached assets

## License

MIT

## Support

For issues and questions, see the specification documents in `.kiro/specs/qr-chain-attendance/`.
