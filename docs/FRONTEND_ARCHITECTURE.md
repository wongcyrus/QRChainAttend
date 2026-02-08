# Frontend Architecture

## Overview

Next.js-based Progressive Web App (PWA) for QR Chain Attendance system.

## Key Features

### Progressive Web App (PWA)
- Offline support with service worker
- App manifest for installability
- Cached assets for offline access
- Background sync for queued operations

See `frontend/public/sw.js` and `frontend/public/manifest.json`.

### Offline Handling
- Network status detection
- Request queuing when offline
- Automatic retry when connection restored
- User feedback via OfflineIndicator component

Components:
- `OfflineIndicator.tsx` - Visual network status
- `OfflineMessage.tsx` - Offline state messaging
- `useOnlineStatus.ts` - Network detection hook
- `offlineQueue.ts` - Request queue management

### Error Handling
- Centralized error handling hook
- User-friendly error messages
- Error boundary components
- Retry mechanisms

Components:
- `ErrorDisplay.tsx` - Error UI component
- `useErrorHandling.ts` - Error handling hook
- `errorHandling.ts` - Error utilities

## Components

### Teacher Dashboard
Main interface for teachers to manage sessions and view attendance.

Features:
- Session creation
- Real-time attendance monitoring
- QR code display with rotation
- Chain management controls
- Session end and export

Component: `TeacherDashboard.tsx`

### Student Session View
Interface for students to join sessions and scan QR codes.

Features:
- Session enrollment
- QR code scanning
- Real-time status updates
- Offline support

Component: `StudentSessionView.tsx`

### QR Components

#### QRDisplay
Displays static QR codes with customization options.

#### RotatingQRDisplay
Displays QR codes that rotate automatically based on token updates.

#### QRScanner
Camera-based QR code scanner with validation.

### Session Management

#### SessionCreationForm
Form for creating new attendance sessions with validation.

#### SessionEndAndExportControls
Controls for ending sessions and exporting attendance data.

#### ChainManagementControls
Controls for managing entry/exit chains.

## Real-time Updates

SignalR integration for:
- Token rotation notifications
- Attendance updates
- Session state changes

Connection established via `/api/negotiate` endpoint.

## Routing

- `/` - Home page with role selection
- `/teacher` - Teacher dashboard
- `/student` - Student session view

## Static Web App Configuration

Custom routing and security rules in `staticwebapp.config.json`:
- API route proxying
- Authentication requirements
- Custom error pages (403, 404)
- Security headers

## Testing

- Jest for unit tests
- React Testing Library for component tests
- MSW for API mocking
- Coverage reporting

Run tests: `npm test`
