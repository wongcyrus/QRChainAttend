# QR Chain Attendance System

A comprehensive, real-time attendance tracking system using QR code chains, geolocation, and Azure services with AI-powered Live Quiz feature.

## 🚀 Quick Start

**Production URL**: https://ashy-desert-0fc9a700f.6.azurestaticapps.net

**Status**: ✅ Live with SignalR Standard S1 (1000 connections)

**Login**:
- Teachers: `@vtc.edu.hk` email addresses (excluding `@stu.vtc.edu.hk`)
- Students: `@stu.vtc.edu.hk` email addresses

## 📚 Documentation

**Complete Documentation Index**: See [DOCUMENTATION_INDEX.md](DOCUMENTATION_INDEX.md) for all documentation files.

### Essential Guides
- **[Getting Started](GETTING_STARTED.md)** - Setup and first steps
- **[Project Status](PROJECT_STATUS.md)** - Current deployment status
- **[Deployment Guide](DEPLOYMENT_GUIDE.md)** - Complete deployment guide
- **[Live Quiz Guide](LIVE_QUIZ.md)** - AI-powered quiz feature

### Quick Links
- **[System Architecture](SYSTEM_ARCHITECTURE.md)** - System design
- **[Database Schema](DATABASE_TABLES.md)** - 12 tables
- **[SignalR Configuration](SIGNALR_CONFIGURATION.md)** - Real-time updates
- **[Local Development](LOCAL_DEVELOPMENT.md)** - Development setup

### Complete Documentation
- **[Full Documentation Index](DOCS_INDEX.md)** - All documentation

## 🎯 Key Features

### Core Features
- **QR Chain Technology**: Secure token passing prevents cheating
- **Entry/Exit QR Codes**: Separate QR codes for entry and exit verification
- **Real-time Updates**: SignalR for live attendance monitoring
- **Role-Based Access**: Automatic email domain-based authentication

### Advanced Features
- **Recurring Sessions**: Create daily, weekly, or monthly recurring sessions
- **Geolocation Tracking**: Location-based attendance with warning/enforce modes (default 1000m radius)
- **Attendance Snapshots**: On-demand snapshots via chains to record instant attendance
- **Entry/Exit Methods**: Track how attendance was verified (Chain vs Direct QR)
- **Export Functionality**: Download attendance as CSV or JSON with method tracking

### User Experience
- **Progressive Web App**: Installable on mobile devices
- **Offline Support**: Works offline with service worker caching
- **Mobile-First Design**: Optimized for smartphones
- **Account Switching**: Easy switching between multiple accounts

## 🛠️ Tech Stack

- **Frontend**: Next.js, React, TypeScript
- **Backend**: Azure Functions (Node.js 20)
- **Database**: Azure Table Storage
- **Real-time**: Azure SignalR Service
- **Auth**: Azure AD (Static Web Apps)
- **Hosting**: Azure Static Web Apps

## 📦 Project Structure

```
├── backend/          # Azure Functions API
├── frontend/         # Next.js web application
├── infrastructure/   # Bicep IaC templates
├── docs/            # Detailed documentation
└── scripts/         # Utility scripts
```

## 🔧 Local Development

```bash
# Install dependencies
npm install

# Start local development
./dev-tools.sh start

# Frontend: http://localhost:3000
# Backend: http://localhost:7071
```

See [Getting Started](GETTING_STARTED.md) for detailed setup instructions.

## 🚢 Deployment

```bash
# Deploy to Azure (both backend and frontend)
./deploy-to-azure.sh
```

See [Deployment Guide](DEPLOYMENT_GUIDE.md) for details.

## 🔐 Authentication

- **Production**: Azure AD authentication via Static Web Apps
- **Local Dev**: Mock authentication for testing
- **Roles**: Automatically assigned based on email domain
  - `@vtc.edu.hk` (excluding `@stu.vtc.edu.hk`) → Teacher
  - `@stu.vtc.edu.hk` → Student

## 📊 Features by Role

### Teachers
- **Session Management**
  - Create single or recurring sessions (daily, weekly, monthly)
  - Edit sessions with scope control (this, future, all)
  - Delete sessions with cascade cleanup
  - Configure geofence and constraints
  
- **Attendance Monitoring**
  - Real-time attendance dashboard
  - View student online/offline status
  - Track entry/exit verification
  - Monitor location warnings
  - See active chain holders
  
- **QR Code Management**
  - Generate entry QR codes (auto-refresh every 10s)
  - Generate exit QR codes (auto-refresh every 10s)
  - Seed and reseed chains
  - Control chain flow
  
- **Snapshots & Analysis**
  - Take on-demand attendance snapshots via chains
  - View snapshot history with metadata
  - Track who was present at specific moments
  - Simple, focused snapshot interface
  
- **Export & Reporting**
  - Export attendance as CSV
  - Export attendance as JSON
  - Include location data
  - Include chain trace data

### Students
- **Session Participation**
  - Join sessions via QR code scan
  - Scan entry chain QR codes
  - Scan exit chain QR codes
  - View personal attendance status
  
- **Real-time Updates**
  - See current holder status
  - Display own QR code when holder
  - Receive attendance updates
  - View session information
  
- **Mobile Experience**
  - Offline support for scanning
  - PWA installation
  - Mobile-optimized interface
  - Camera-based QR scanning

## 🏗️ Architecture

### Backend (35 Functions)
- **Authentication**: Role assignment, user info
- **Session Management**: CRUD operations with recurring support
- **QR Code Generation**: Entry, exit, early leave QR codes
- **Chain Management**: Seed, reseed, scan, close operations
- **Attendance**: Tracking with entry/exit methods, verification, export
- **Snapshots**: Create on-demand snapshots via chains
- **SignalR**: Real-time connections for teacher and student
- **Utilities**: Session checks, geolocation validation, token encryption

**Note**: Token refresh is client-driven (on-demand) - `rotateTokens` function removed.

### Frontend (22+ Components)
- **Pages**: Home, teacher dashboard, student view
- **Session Management**: Creation, editing, listing
- **QR Components**: Display, scanner, modal
- **Dashboard**: Real-time attendance monitoring
- **Snapshots**: Manager, trace viewer, comparison
- **Utilities**: Offline indicator, error display

### Database (9 Tables)
- **Sessions**: Session metadata with recurring support
- **Attendance**: Student attendance records with entry/exit methods
- **Chains**: QR chain state and holders (ENTRY/EXIT/SNAPSHOT phases)
- **Tokens**: Chain tokens with 10-second expiration
- **UserSessions**: User session mapping
- **AttendanceSnapshots**: On-demand snapshot metadata
- **ChainHistory**: Chain transfer audit trail
- **ScanLogs**: QR scan audit log
- **DeletionLog**: Session deletion audit trail

## 🔒 Security

- **Authentication**: Azure AD with email domain-based roles
- **Authorization**: Role-based access control (RBAC)
- **Data Protection**: Encrypted QR tokens with expiration
- **Audit Trail**: Deletion logs, scan logs, location tracking
- **Secure Storage**: Azure Table Storage with managed identities
- **No Secrets in Code**: All credentials in Azure Key Vault

## 🐛 Troubleshooting

**Authentication Issues**:
- Wrong role assigned → Verify email domain matches expected pattern
- Can't login → Check Azure AD configuration
- 401 Errors → Check authentication headers

**Session Issues**:
- Can't create session → Verify teacher role
- Geofence not working → Check location permissions
- QR codes not refreshing → Check browser console for errors

**Attendance Issues**:
- Location warnings → Increase geofence radius or use warning mode
- Chain not passing → Check if student is holder
- Exit not verified → Ensure exit chain is started

See [Deployment Checklist](DEPLOYMENT_CHECKLIST.md) for complete troubleshooting guide.

## 📈 Project Status

**Current Version**: 2.0  
**Status**: ✅ Production Ready  
**Features**: 12 major features fully implemented  
**Backend Functions**: 35 functions operational (rotateTokens removed)  
**Frontend Components**: 22+ components working  
**Database Tables**: 9 tables with consistent timestamps (Unix seconds)  
**Documentation**: Updated to reflect current codebase  
**Testing**: Manual testing (automated tests planned)

See [Project Status](PROJECT_STATUS.md) for detailed information.

## 📝 License

MIT License - See LICENSE file for details

## 👥 Support

For issues or questions:
1. Check the [Documentation Index](DOCS_INDEX.md)
2. Review the [Deployment Checklist](DEPLOYMENT_CHECKLIST.md)
3. Contact the development team

## 🙏 Acknowledgments

Built with Azure services and modern web technologies.

---

**Last Updated**: February 10, 2026  
**Version**: 2.0
