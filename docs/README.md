# Documentation Index

Welcome to the QR Chain Attendance System documentation.

## Getting Started

Start here if you're new to the project:

1. **[Main README](../README.md)** - Project overview and quick start
2. **[Development Guide](DEVELOPMENT.md)** - Set up your local environment
3. **[Frontend Architecture](FRONTEND_ARCHITECTURE.md)** - Understand the frontend
4. **[Backend Architecture](BACKEND_ARCHITECTURE.md)** - Understand the backend

## Core Documentation

### Architecture & Design
- **[Backend Architecture](BACKEND_ARCHITECTURE.md)** - Services, caching, error handling, and security
- **[Frontend Architecture](FRONTEND_ARCHITECTURE.md)** - Components, PWA features, and offline support
- **[Frontend Components](../frontend/COMPONENTS.md)** - Detailed component documentation

### Development
- **[Development Guide](DEVELOPMENT.md)** - Local setup, testing, debugging, and best practices
- **[Implementation History](IMPLEMENTATION_HISTORY.md)** - Feature development timeline and milestones

### Operations
- **[Deployment Guide](DEPLOYMENT.md)** - Infrastructure deployment and CI/CD pipeline
- **[Monitoring Guide](MONITORING.md)** - Metrics, alerts, dashboards, and troubleshooting
- **[Alert Response Playbook](ALERT_RESPONSE.md)** - How to respond to production alerts

## Specialized Topics

### Infrastructure
- **[Infrastructure README](../infrastructure/README.md)** - Bicep templates and deployment scripts
- **[Deployment Guide](DEPLOYMENT.md)** - Full deployment procedures

### Frontend
- **[Components Guide](../frontend/COMPONENTS.md)** - All React components
- **[PWA Implementation](../frontend/public/PWA_README.md)** - Progressive Web App features
- **[Offline Handling](../frontend/src/components/OfflineHandling.README.md)** - Offline functionality

### Component READMEs
Individual component documentation in `frontend/src/components/`:
- `TeacherDashboard.README.md`
- `StudentSessionView.README.md`
- `QRDisplay.README.md`
- `QRScanner.README.md`
- `RotatingQRDisplay.README.md`
- `SessionCreationForm.README.md`
- `SessionEndAndExportControls.README.md`
- `ChainManagementControls.README.md`
- `OfflineHandling.README.md`

## Quick Reference

### Common Tasks

**Local Development:**
```bash
# Start backend
cd backend && npm start

# Start frontend
cd frontend && npm run dev
```

**Testing:**
```bash
# Run all tests
npm test

# Run with coverage
npm test -- --coverage
```

**Deployment:**
```bash
# Deploy infrastructure
cd infrastructure && ./deploy.sh dev

# Configure managed identity
cd scripts && ./configure-managed-identity.sh
```

**Monitoring:**
```bash
# Set up monitoring
cd scripts && ./configure-monitoring.sh <resource-group>

# Create dashboard
./create-monitoring-dashboard.sh <resource-group>
```

### Key Concepts

**QR Chain Attendance:**
- Students scan QR codes in sequence to verify presence
- Tokens rotate every 30 seconds to prevent screenshots
- Blockchain-inspired chain validation ensures authenticity

**Architecture:**
- Frontend: Next.js PWA on Azure Static Web Apps
- Backend: Azure Functions (serverless)
- Storage: Azure Table Storage
- Real-time: Azure SignalR Service

**Security:**
- Managed Identity for Azure service authentication
- RBAC for fine-grained access control
- Token-based API authentication
- Input validation and sanitization

## Documentation Structure

```
docs/
├── README.md                    # This file
├── BACKEND_ARCHITECTURE.md      # Backend design and services
├── FRONTEND_ARCHITECTURE.md     # Frontend design and components
├── DEVELOPMENT.md               # Development workflow
├── DEPLOYMENT.md                # Deployment procedures
├── MONITORING.md                # Monitoring and alerts
├── ALERT_RESPONSE.md            # Alert response playbook
└── IMPLEMENTATION_HISTORY.md    # Development timeline

frontend/
├── COMPONENTS.md                # Component documentation
├── public/
│   ├── PWA_README.md           # PWA features
│   └── ICONS_README.md         # Icon generation
└── src/components/
    ├── TeacherDashboard.README.md
    ├── StudentSessionView.README.md
    ├── QRDisplay.README.md
    ├── QRScanner.README.md
    ├── RotatingQRDisplay.README.md
    ├── SessionCreationForm.README.md
    ├── SessionEndAndExportControls.README.md
    ├── ChainManagementControls.README.md
    └── OfflineHandling.README.md

infrastructure/
└── README.md                    # Infrastructure deployment

.kiro/specs/qr-chain-attendance/
├── requirements.md              # Project requirements
├── design.md                    # System design
└── tasks.md                     # Implementation tasks
```

## Contributing

When adding new features:

1. Update relevant architecture documentation
2. Add component README for new components
3. Include usage examples (*.example.tsx)
4. Write comprehensive tests
5. Update this index if adding new docs

## Support

For questions or issues:

1. Check the relevant documentation section
2. Review [Implementation History](IMPLEMENTATION_HISTORY.md) for context
3. Check component examples in `frontend/src/components/*.example.tsx`
4. Review test files for usage patterns

## External Resources

- [Azure Functions Documentation](https://docs.microsoft.com/azure/azure-functions/)
- [Next.js Documentation](https://nextjs.org/docs)
- [Azure Static Web Apps](https://docs.microsoft.com/azure/static-web-apps/)
- [Azure SignalR Service](https://docs.microsoft.com/azure/azure-signalr/)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/)
