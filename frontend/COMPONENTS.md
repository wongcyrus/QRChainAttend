# Frontend Components Guide

This document provides an overview of all React components in the QR Chain Attendance system.

## Teacher Components

### TeacherDashboard
**Location:** `src/components/TeacherDashboard.tsx`

Main dashboard for teachers to manage attendance sessions.

**Features:**
- Create new sessions
- View real-time attendance
- Manage entry/exit chains
- End sessions and export data

**Props:**
```typescript
interface TeacherDashboardProps {
  teacherId: string;
  teacherName: string;
}
```

**Example:**
```tsx
<TeacherDashboard 
  teacherId="teacher123" 
  teacherName="John Doe" 
/>
```

See `TeacherDashboard.example.tsx` for complete usage examples.

### SessionCreationForm
**Location:** `src/components/SessionCreationForm.tsx`

Form for creating new attendance sessions with validation.

**Features:**
- Session name and description input
- Date and time selection
- Duration configuration
- Validation and error handling

**Props:**
```typescript
interface SessionCreationFormProps {
  onSessionCreated: (session: Session) => void;
  teacherId: string;
}
```

**Example:**
```tsx
<SessionCreationForm
  teacherId="teacher123"
  onSessionCreated={(session) => console.log('Created:', session)}
/>
```

See `SessionCreationForm.example.tsx` for complete usage examples.

### SessionEndAndExportControls
**Location:** `src/components/SessionEndAndExportControls.tsx`

Controls for ending sessions and exporting attendance data.

**Features:**
- End session button with confirmation
- Export to CSV
- Export to JSON
- Download functionality

**Props:**
```typescript
interface SessionEndAndExportControlsProps {
  sessionId: string;
  onSessionEnded: () => void;
}
```

**Example:**
```tsx
<SessionEndAndExportControls
  sessionId="session123"
  onSessionEnded={() => console.log('Session ended')}
/>
```

See `SessionEndAndExportControls.example.tsx` for complete usage examples.

### ChainManagementControls
**Location:** `src/components/ChainManagementControls.tsx`

Controls for managing entry/exit chains.

**Features:**
- Start/stop entry chains
- Start/stop exit chains
- Reseed chains
- Real-time chain status

**Props:**
```typescript
interface ChainManagementControlsProps {
  sessionId: string;
  onChainStateChange: (state: ChainState) => void;
}
```

**Example:**
```tsx
<ChainManagementControls
  sessionId="session123"
  onChainStateChange={(state) => console.log('Chain state:', state)}
/>
```

See `ChainManagementControls.example.tsx` for complete usage examples.

## Student Components

### StudentSessionView
**Location:** `src/components/StudentSessionView.tsx`

Main interface for students to join sessions and scan QR codes.

**Features:**
- Session enrollment
- QR code scanning
- Real-time status updates
- Offline support
- Error handling

**Props:**
```typescript
interface StudentSessionViewProps {
  studentId: string;
  studentName: string;
}
```

**Example:**
```tsx
<StudentSessionView
  studentId="student123"
  studentName="Jane Smith"
/>
```

See `StudentSessionView.example.tsx` for complete usage examples.

### SessionEnrollment
**Location:** `src/components/SessionEnrollment.tsx`

Component for students to enroll in available sessions.

**Features:**
- List available sessions
- Join session functionality
- Session details display
- Loading and error states

**Props:**
```typescript
interface SessionEnrollmentProps {
  studentId: string;
  onSessionJoined: (sessionId: string) => void;
}
```

## QR Code Components

### QRDisplay
**Location:** `src/components/QRDisplay.tsx`

Displays static QR codes with customization options.

**Features:**
- Configurable size
- Error correction levels
- Custom colors
- Logo embedding (optional)

**Props:**
```typescript
interface QRDisplayProps {
  value: string;
  size?: number;
  errorCorrectionLevel?: 'L' | 'M' | 'Q' | 'H';
  fgColor?: string;
  bgColor?: string;
}
```

**Example:**
```tsx
<QRDisplay
  value="token123"
  size={256}
  errorCorrectionLevel="H"
/>
```

See `QRDisplay.example.tsx` for complete usage examples.

### RotatingQRDisplay
**Location:** `src/components/RotatingQRDisplay.tsx`

Displays QR codes that automatically rotate based on token updates.

**Features:**
- Automatic token rotation
- SignalR integration for real-time updates
- Countdown timer
- Smooth transitions
- Error handling

**Props:**
```typescript
interface RotatingQRDisplayProps {
  sessionId: string;
  tokenType: 'entry' | 'exit' | 'late' | 'early';
  size?: number;
}
```

**Example:**
```tsx
<RotatingQRDisplay
  sessionId="session123"
  tokenType="entry"
  size={300}
/>
```

See `RotatingQRDisplay.example.tsx` for complete usage examples.

### QRScanner
**Location:** `src/components/QRScanner.tsx`

Camera-based QR code scanner with validation.

**Features:**
- Camera access and selection
- Real-time scanning
- Validation feedback
- Error handling
- Offline support

**Props:**
```typescript
interface QRScannerProps {
  onScan: (data: string) => void;
  onError?: (error: Error) => void;
  enabled?: boolean;
}
```

**Example:**
```tsx
<QRScanner
  onScan={(data) => console.log('Scanned:', data)}
  onError={(error) => console.error('Scan error:', error)}
  enabled={true}
/>
```

See `QRScanner.example.tsx` for complete usage examples.

## Utility Components

### ErrorDisplay
**Location:** `src/components/ErrorDisplay.tsx`

Displays user-friendly error messages with retry options.

**Features:**
- Error type detection
- User-friendly messages
- Retry functionality
- Dismissible alerts
- Accessibility support

**Props:**
```typescript
interface ErrorDisplayProps {
  error: Error | null;
  onRetry?: () => void;
  onDismiss?: () => void;
}
```

**Example:**
```tsx
<ErrorDisplay
  error={error}
  onRetry={() => refetch()}
  onDismiss={() => setError(null)}
/>
```

### OfflineIndicator
**Location:** `src/components/OfflineIndicator.tsx`

Visual indicator for network connectivity status.

**Features:**
- Real-time network status
- Smooth animations
- Minimal UI footprint
- Accessibility support

**Props:**
```typescript
interface OfflineIndicatorProps {
  position?: 'top' | 'bottom';
}
```

**Example:**
```tsx
<OfflineIndicator position="top" />
```

### OfflineMessage
**Location:** `src/components/OfflineMessage.tsx`

Full-screen message displayed when offline.

**Features:**
- Offline state messaging
- Queued operations display
- Retry functionality
- Dismissible

**Props:**
```typescript
interface OfflineMessageProps {
  queuedOperations?: number;
  onRetry?: () => void;
}
```

**Example:**
```tsx
<OfflineMessage
  queuedOperations={3}
  onRetry={() => syncQueue()}
/>
```

See `OfflineHandling.example.tsx` for complete offline handling examples.

## Component Testing

All components include comprehensive tests using React Testing Library.

**Test files:**
- `*.test.tsx` - Component tests
- `*.example.tsx` - Usage examples
- `*.README.md` - Component documentation

**Running tests:**
```bash
cd frontend
npm test
```

**Test coverage:**
```bash
npm test -- --coverage
```

## Best Practices

### Component Structure
- Keep components focused and single-purpose
- Use TypeScript for type safety
- Implement proper error boundaries
- Handle loading and error states
- Support offline functionality

### Props
- Use TypeScript interfaces for props
- Provide sensible defaults
- Document all props in README files
- Use optional props for customization

### Accessibility
- Use semantic HTML
- Include ARIA labels
- Support keyboard navigation
- Provide screen reader text
- Test with accessibility tools

### Performance
- Use React.memo for expensive components
- Implement proper cleanup in useEffect
- Avoid unnecessary re-renders
- Lazy load heavy components
- Optimize images and assets

### Testing
- Test user interactions
- Test error states
- Test loading states
- Test accessibility
- Mock external dependencies

## Related Documentation

- [Frontend Architecture](../docs/FRONTEND_ARCHITECTURE.md)
- [Development Guide](../docs/DEVELOPMENT.md)
- [PWA Implementation](public/PWA_README.md)
- [Offline Handling](src/components/OfflineHandling.README.md)
