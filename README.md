# QR Chain Attendance System

A secure, real-time attendance tracking system using QR code chains and Azure services.

## 🚀 Quick Start

**Production URL**: https://red-grass-0f8bc910f.4.azurestaticapps.net

**Login**:
- Teachers: `@vtc.edu.hk` email addresses
- Students: `@stu.vtc.edu.hk` email addresses

## 📚 Documentation

- **[Getting Started](GETTING_STARTED.md)** - Setup and first steps
- **[Deployment Guide](DEPLOYMENT_GUIDE.md)** - How to deploy to Azure
- **[Deployment History](DEPLOYMENT_HISTORY.md)** - All fixes and features
- **[Quick Reference](QUICK_REFERENCE.md)** - Common commands and tasks
- **[Full Documentation](DOCS_INDEX.md)** - Complete documentation index

## 🎯 Key Features

- **QR Chain Technology**: Secure token passing prevents cheating
- **Real-time Updates**: SignalR for live attendance monitoring
- **Role-Based Access**: Email domain-based authentication
- **CSV Export**: Download attendance records for analysis
- **Offline Support**: PWA with offline capabilities
- **Mobile-First**: Optimized for smartphones

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
./dev.sh

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
- **Roles**: Determined by email domain
  - `@vtc.edu.hk` → Teacher
  - `@stu.vtc.edu.hk` → Student

## 📊 Features by Role

### Teachers
- Create and manage sessions
- Monitor real-time attendance
- Control QR chain flow
- Export attendance (CSV/JSON)
- View student online status

### Students
- Join sessions via QR code
- Scan QR chains for entry/exit
- View personal attendance status
- Offline support for scanning

## 🐛 Troubleshooting

See [Deployment History](DEPLOYMENT_HISTORY.md) for common issues and solutions.

**Quick Fixes**:
- 401 Errors → Check authentication headers
- 403 Errors → Verify email domain
- 404 Errors → Check API URL configuration

## 📝 License

MIT License - See LICENSE file for details

## 👥 Support

For issues or questions, check the documentation or contact the development team.

---

**Last Updated**: February 6, 2026
