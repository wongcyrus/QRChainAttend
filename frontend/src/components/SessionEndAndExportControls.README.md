# SessionEndAndExportControls Component

## Overview

The `SessionEndAndExportControls` component provides teachers with controls to end a session, view final attendance summary, and export attendance data as JSON. This component is part of the QR Chain Attendance System and implements Requirements 2.3, 14.1, 14.2, and 14.3.

## Features

- **End Session**: Button to end an active session and compute final attendance status for all students
- **Export Attendance**: Download attendance data as a JSON file at any time
- **Final Attendance Summary**: Display comprehensive statistics and detailed records after ending a session
- **Session Status Indicator**: Visual indicator showing whether the session is active or ended
- **Error Handling**: Graceful error handling with callback support
- **Responsive Design**: Mobile-friendly layout with adaptive grid

## Requirements Validation

- **Requirement 2.3**: Session ending transitions to ENDED status ✓
- **Requirement 14.1**: Export includes all attendance records ✓
- **Requirement 14.2**: Export includes student identifiers and timestamps ✓
- **Requirement 14.3**: Export format is JSON ✓

## Props

```typescript
interface SessionEndAndExportControlsProps {
  /**
   * Session ID for API calls
   * Required
   */
  sessionId: string;

  /**
   * Current session status
   * Required
   */
  sessionStatus: 'ACTIVE' | 'ENDED';

  /**
   * Callback when session is successfully ended
   * Receives final attendance records
   * Optional
   */
  onSessionEnded?: (finalAttendance: AttendanceRecord[]) => void;

  /**
   * Callback for error handling
   * Optional
   */
  onError?: (error: string) => void;
}
```

## Usage

### Basic Usage

```tsx
import { SessionEndAndExportControls } from './SessionEndAndExportControls';

function TeacherDashboard() {
  const [sessionStatus, setSessionStatus] = useState<'ACTIVE' | 'ENDED'>('ACTIVE');

  const handleSessionEnded = (finalAttendance) => {
    console.log('Session ended:', finalAttendance);
    setSessionStatus('ENDED');
  };

  return (
    <SessionEndAndExportControls
      sessionId="session-123"
      sessionStatus={sessionStatus}
      onSessionEnded={handleSessionEnded}
      onError={(error) => console.error(error)}
    />
  );
}
```

### With Custom Error Handling

```tsx
function TeacherDashboard() {
  const [errors, setErrors] = useState<string[]>([]);

  const handleError = (errorMessage: string) => {
    setErrors(prev => [...prev, errorMessage]);
    // Show toast notification, etc.
  };

  return (
    <SessionEndAndExportControls
      sessionId="session-123"
      sessionStatus="ACTIVE"
      onError={handleError}
    />
  );
}
```

### Ended Session (Export Only)

```tsx
// When session is already ended, the end button is hidden
<SessionEndAndExportControls
  sessionId="session-123"
  sessionStatus="ENDED"
  onError={(error) => console.error(error)}
/>
```

## API Integration

### End Session

**Endpoint**: `POST /api/sessions/{sessionId}/end`

**Response**:
```json
{
  "finalAttendance": [
    {
      "sessionId": "session-123",
      "studentId": "student-1",
      "entryStatus": "PRESENT_ENTRY",
      "entryAt": 1700000000,
      "exitVerified": true,
      "exitVerifiedAt": 1700003600,
      "finalStatus": "PRESENT"
    }
  ]
}
```

### Export Attendance

**Endpoint**: `GET /api/sessions/{sessionId}/attendance`

**Response**:
```json
{
  "attendance": [
    {
      "sessionId": "session-123",
      "studentId": "student-1",
      "entryStatus": "PRESENT_ENTRY",
      "entryAt": 1700000000,
      "exitVerified": true,
      "exitVerifiedAt": 1700003600,
      "earlyLeaveAt": null,
      "finalStatus": "PRESENT"
    }
  ]
}
```

## Final Attendance Summary

After ending a session, the component displays:

### Summary Statistics
- Total Students
- Present (full attendance)
- Late (arrived after cutoff)
- Left Early (left before exit verification)
- Early Leave (scanned early-leave QR)
- Absent (no entry recorded)

### Detailed Records Table
Columns:
- Student ID
- Final Status (with color-coded badge)
- Entry Status
- Entry Time
- Exit Verified (✓/✗)
- Exit Time
- Early Leave Time

## Final Status Values

The component displays the following final status values:

- **PRESENT**: Student arrived on time and verified exit
- **LATE**: Student arrived late and verified exit
- **LEFT_EARLY**: Student arrived but left before exit verification
- **EARLY_LEAVE**: Student scanned early-leave QR code
- **ABSENT**: Student did not mark entry

## Export Format

The exported JSON file includes all attendance records with the following fields:

```json
[
  {
    "sessionId": "string",
    "studentId": "string",
    "entryStatus": "PRESENT_ENTRY | LATE_ENTRY | undefined",
    "entryAt": "number (Unix timestamp) | undefined",
    "exitVerified": "boolean",
    "exitVerifiedAt": "number (Unix timestamp) | undefined",
    "earlyLeaveAt": "number (Unix timestamp) | undefined",
    "finalStatus": "PRESENT | LATE | LEFT_EARLY | EARLY_LEAVE | ABSENT | undefined"
  }
]
```

**File naming**: `attendance-{sessionId}-{ISO-timestamp}.json`

Example: `attendance-session-123-2024-01-15T10:30:00.000Z.json`

## Styling

The component includes comprehensive inline styles with:

- Color-coded status badges
- Responsive grid layout for statistics
- Mobile-friendly table with horizontal scroll
- Hover effects on interactive elements
- Loading states for async operations
- Success/error message styling

### Status Colors

- **Present**: Green (#4caf50)
- **Late**: Orange (#ff9800)
- **Left Early**: Yellow (#fbc02d)
- **Early Leave**: Red (#f44336)
- **Absent**: Gray (#757575)

## Accessibility

- ARIA labels on all buttons
- `role="status"` for success messages
- Semantic HTML structure
- Keyboard navigation support
- Screen reader friendly table structure

## Error Handling

The component handles the following error scenarios:

1. **API Errors**: Network failures, server errors
2. **Authorization Errors**: Insufficient permissions
3. **Validation Errors**: Invalid session state
4. **JSON Parsing Errors**: Malformed responses

All errors are passed to the `onError` callback if provided.

## Testing

Comprehensive unit tests cover:

- Rendering with different session statuses
- End session functionality
- Export attendance functionality
- Final attendance summary display
- Error handling
- Accessibility features
- Edge cases (empty attendance, network errors)

Run tests:
```bash
npm test SessionEndAndExportControls.test.tsx
```

## Browser Compatibility

- Modern browsers (Chrome, Firefox, Safari, Edge)
- Requires support for:
  - Fetch API
  - Blob API
  - URL.createObjectURL
  - ES6+ features

## Performance Considerations

- Efficient rendering with React hooks
- Minimal re-renders using proper state management
- Cleanup of object URLs after download
- Optimized table rendering for large datasets

## Integration with Teacher Dashboard

This component is designed to be integrated into the Teacher Dashboard alongside:

- `ChainManagementControls`: For managing entry/exit chains
- `RotatingQRDisplay`: For late entry and early leave QR codes
- Real-time attendance updates via SignalR

Example integration:

```tsx
<TeacherDashboard sessionId={sessionId}>
  <ChainManagementControls ... />
  <RotatingQRDisplay ... />
  <SessionEndAndExportControls
    sessionId={sessionId}
    sessionStatus={session.status}
    onSessionEnded={handleSessionEnded}
    onError={handleError}
  />
</TeacherDashboard>
```

## Future Enhancements

Potential improvements:

- Export to CSV format
- Print-friendly view
- Email attendance report
- Batch export for multiple sessions
- Custom date range filtering
- Advanced statistics (attendance rate, trends)

## Related Components

- `TeacherDashboard`: Main dashboard container
- `ChainManagementControls`: Chain seeding and management
- `RotatingQRDisplay`: Late entry and early leave QR codes
- `SessionCreationForm`: Create new sessions

## Support

For issues or questions:
- Check the test file for usage examples
- Review the example file for common patterns
- Consult the design document for requirements details
