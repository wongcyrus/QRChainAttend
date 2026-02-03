# Student Session View Component

## Overview

The `StudentSessionView` component is the main student interface for participating in attendance verification in the QR Chain Attendance System. It integrates the `QRScanner` and `QRDisplay` components to provide a complete student experience.

**Feature**: qr-chain-attendance  
**Requirements**: 13.1, 13.2, 13.3, 13.5

## Features

- ✅ Display session information (class ID, start/end times, status)
- ✅ Show student's current attendance status (entry, exit, early leave)
- ✅ Display holder QR code when student is a chain holder
- ✅ Provide scan button to open QR scanner for peer codes
- ✅ Handle late entry flow (scan teacher's rotating QR)
- ✅ Handle early leave flow (scan teacher's rotating QR)
- ✅ Real-time status updates via polling
- ✅ User-friendly error and success messages
- ✅ Responsive design for mobile and desktop

## Usage

### Basic Usage

```tsx
import { StudentSessionView } from '@/components/StudentSessionView';

function StudentPage() {
  const sessionId = 'session-123';
  const studentId = 'student-456';

  return (
    <StudentSessionView
      sessionId={sessionId}
      studentId={studentId}
      onLeaveSession={() => {
        // Navigate back to session list
        router.push('/sessions');
      }}
    />
  );
}
```

### With Authentication

```tsx
import { StudentSessionView } from '@/components/StudentSessionView';
import { useAuth } from '@/hooks/useAuth';

function AuthenticatedStudentView({ sessionId }: { sessionId: string }) {
  const { user } = useAuth();

  if (!user) {
    return <div>Please sign in</div>;
  }

  return (
    <StudentSessionView
      sessionId={sessionId}
      studentId={user.userId}
    />
  );
}
```

### With Router Integration

```tsx
import { StudentSessionView } from '@/components/StudentSessionView';
import { useRouter } from 'next/router';

function SessionPage() {
  const router = useRouter();
  const { sessionId } = router.query;
  const studentId = 'student-123'; // From auth

  if (!sessionId) {
    return <div>Loading...</div>;
  }

  return (
    <StudentSessionView
      sessionId={sessionId as string}
      studentId={studentId}
      onLeaveSession={() => router.push('/sessions')}
    />
  );
}
```

## Props

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `sessionId` | `string` | Yes | The session ID to display |
| `studentId` | `string` | Yes | The student's user ID (from authentication) |
| `onLeaveSession` | `() => void` | No | Callback when student clicks "Leave Session" button |
| `className` | `string` | No | Additional CSS class names |

## Component Structure

### 1. Header Section
- Displays session title and class ID
- Shows "Leave Session" button (if callback provided)
- Gradient background for visual appeal

### 2. Session Info Card
- Start time and end time
- Session status (ACTIVE/ENDED)
- Formatted in readable time format

### 3. Status Messages
- Info messages (session not started, session ended)
- Success messages (scan successful, became holder)
- Error messages (scan failed, validation errors)

### 4. Student Status Card
- Entry status (Present/Late)
- Exit verification status
- Early leave status (if applicable)
- Color-coded badges for quick recognition

### 5. Holder QR Display
- Shows when student is a chain holder
- Displays QR code using `QRDisplay` component
- Includes countdown timer
- Automatically hides when token expires

### 6. Scan Section
- Toggle button to open/close scanner
- Instructions based on current session state
- Integrates `QRScanner` component
- Handles scan success and error callbacks

### 7. Instructions Card
- Step-by-step guide for new students
- Only shown when student hasn't marked entry yet
- Explains the chain verification process

## State Management

### Session State
```typescript
const [session, setSession] = useState<Session | null>(null);
```
Stores the current session data fetched from the API.

### Student Status State
```typescript
interface StudentStatus {
  isHolder: boolean;
  holderToken?: ChainQRData;
  entryStatus?: 'PRESENT_ENTRY' | 'LATE_ENTRY';
  exitVerified: boolean;
  earlyLeaveMarked: boolean;
}
```
Tracks the student's current status in the session.

### UI State
- `isScanning`: Whether the QR scanner is active
- `loading`: Initial data loading state
- `error`: Current error message (if any)
- `successMessage`: Current success message (if any)

## Data Fetching

### Initial Load
On component mount, fetches:
1. Session data (`/api/sessions/{sessionId}`)
2. Student attendance status (`/api/sessions/{sessionId}/attendance`)

### Polling
Automatically polls for updates every 10 seconds to:
- Refresh session data
- Update student status
- Detect changes in holder status

### Manual Refresh
Refreshes data after:
- Successful scan
- Token expiration
- Error recovery

## Scan Flow

### Entry Chain Scan
1. Student opens scanner
2. Scans peer's chain QR code
3. API validates and marks holder as present
4. If baton transfer occurs, student becomes new holder
5. UI updates to show holder QR code

### Late Entry Scan
1. Student arrives after late cutoff
2. Opens scanner
3. Scans teacher's rotating late entry QR
4. API marks student as LATE_ENTRY
5. UI updates to show late entry status

### Early Leave Scan
1. Student needs to leave early
2. Opens scanner
3. Scans teacher's rotating early leave QR
4. API records early leave timestamp
5. UI updates to show early leave status

### Exit Chain Scan
1. Teacher starts exit chains
2. Student scans peer's exit chain QR
3. API marks holder's exit as verified
4. If baton transfer occurs, student becomes exit holder
5. UI updates accordingly

## Error Handling

### Network Errors
- Displays user-friendly error message
- Automatically retries on next poll
- Doesn't block UI interaction

### Scan Errors
- Shows specific error message from API
- Clears error after 5 seconds
- Allows immediate retry

### Token Expiration
- Automatically hides expired QR codes
- Updates holder status
- Shows appropriate message

### Session Not Found
- Displays error message
- Provides "Back" button if callback available
- Prevents further API calls

## Visual States

### Before Session Starts
- Shows info message with start time
- Disables scanning
- Displays session information

### During Session
- Enables scanning
- Shows holder QR if applicable
- Displays current status
- Provides instructions

### After Session Ends
- Shows completion message
- Disables scanning
- Displays final status

## Responsive Design

### Desktop (>768px)
- Max width: 800px
- Centered layout
- Full-width cards with padding

### Mobile (≤768px)
- Full-width layout
- Adjusted padding
- Stacked status items
- Larger touch targets

## Accessibility

- Semantic HTML structure
- Clear visual hierarchy
- Readable font sizes and contrast
- Color-coded status indicators
- Descriptive button labels
- Error messages announced

## Performance

### Optimizations
- Memoized callbacks with `useCallback`
- Efficient polling with cleanup
- Conditional rendering
- Lazy component loading

### Resource Management
- Clears intervals on unmount
- Cancels pending requests
- Manages timer cleanup

## Integration with Other Components

### QRScanner
```tsx
<QRScanner
  isActive={isScanning}
  sessionId={sessionId}
  onScanSuccess={handleScanSuccess}
  onScanError={handleScanError}
/>
```

### QRDisplay
```tsx
<QRDisplay
  qrData={studentStatus.holderToken}
  onExpire={handleTokenExpire}
  showHolderInfo={true}
/>
```

## API Endpoints Used

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/sessions/{sessionId}` | GET | Fetch session data |
| `/api/sessions/{sessionId}/attendance` | GET | Fetch attendance records |
| `/api/scan/chain` | POST | Scan entry chain QR |
| `/api/scan/exit-chain` | POST | Scan exit chain QR |
| `/api/scan/late-entry` | POST | Scan late entry QR |
| `/api/scan/early-leave` | POST | Scan early leave QR |

## Example Scenarios

### Scenario 1: On-Time Entry
1. Student joins session before start time
2. Waits for teacher to seed entry chains
3. Peer becomes holder and shows QR
4. Student scans peer's QR
5. Peer is marked present, student becomes holder
6. Student shows QR to next peer

### Scenario 2: Late Arrival
1. Student joins session after late cutoff
2. Sees "late entry" instruction
3. Opens scanner
4. Scans teacher's rotating late entry QR
5. Marked as LATE_ENTRY
6. Can participate in exit chain later

### Scenario 3: Early Departure
1. Student needs to leave before exit chain
2. Opens scanner
3. Scans teacher's early leave QR
4. Marked with early leave timestamp
5. Final status will be EARLY_LEAVE

### Scenario 4: Full Attendance
1. Student marks entry via chain scan
2. Stays for entire session
3. Participates in exit chain
4. Exit verified
5. Final status: PRESENT

## Testing

The component should be tested for:
- Rendering with different session states
- Holder QR display and expiration
- Scanner toggle functionality
- Scan success and error handling
- Status updates after scans
- Polling behavior
- Responsive layout
- Error recovery

## Future Enhancements

Potential improvements:
- WebSocket integration for real-time updates (instead of polling)
- Offline support with request queuing
- Push notifications for holder status
- Scan history display
- Session statistics for student
- Peer finder (show nearby holders)
- Accessibility improvements (screen reader support)

## Related Components

- **QRScanner**: Camera-based QR code scanning
- **QRDisplay**: QR code display with countdown timer
- **TeacherDashboard**: Teacher interface for session management

## Requirements Validation

✅ **Requirement 13.1**: Display session information and provide scan interface  
✅ **Requirement 13.2**: Display holder's QR code when applicable  
✅ **Requirement 13.3**: Hide QR when token expires  
✅ **Requirement 13.5**: Handle late entry and early leave flows

## Browser Support

- Chrome/Edge: ✅ Full support
- Firefox: ✅ Full support
- Safari: ✅ Full support
- Mobile browsers: ✅ Full support

## Dependencies

- `react`: ^18.2.0
- `@qr-attendance/shared`: ^1.0.0 (for type definitions)
- `./QRScanner`: QR scanning component
- `./QRDisplay`: QR display component

## License

Part of the QR Chain Attendance System.
