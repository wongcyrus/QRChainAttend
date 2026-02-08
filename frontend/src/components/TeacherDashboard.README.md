# Teacher Dashboard Component

## Overview

The Teacher Dashboard component provides a real-time interface for teachers to monitor attendance status and chain progress during a session. It connects to Azure SignalR Service to receive live updates as students mark their attendance.

## Requirements

- **12.1**: Real-time attendance status updates via SignalR
- **12.2**: Real-time chain scan updates
- **12.3**: Chain stall detection and indicators
- **12.4**: Display attendance counts and student list

## Features

### Real-Time Updates

The dashboard establishes a SignalR connection to receive push notifications for:
- **Attendance Updates**: When a student's attendance status changes (entry, exit)
- **Chain Updates**: When a chain scan occurs and the baton is transferred
- **Stall Alerts**: When chains become stalled (idle > 90 seconds)

### Statistics Display

The dashboard shows real-time counts for:
- Total students enrolled
- Present entry count
- Late entry count
- Exit verified count
- Not yet verified count
 - GPS missing count (students who scanned/joined without location)

### Chain Status

For each active chain, the dashboard displays:
- Chain phase (ENTRY or EXIT)
- Chain state (ACTIVE, STALLED, COMPLETED)
- Last holder student ID
- Sequence number
- Last activity timestamp
- Stall indicator (⚠️) for stalled chains

### Student List

A comprehensive table showing all enrolled students with:
- Student ID
- Current status (Present Entry, Late Entry, etc.)
- Entry timestamp
- Exit verification status
- Exit timestamp
- Location warning badge for missing GPS

## Usage

```tsx
import { TeacherDashboard } from './components/TeacherDashboard';

function TeacherView() {
  const sessionId = 'your-session-id';
  
  const handleError = (error: string) => {
    console.error('Dashboard error:', error);
  };
  
  return (
    <TeacherDashboard 
      sessionId={sessionId}
      onError={handleError}
    />
  );
}
```

## Props

### `sessionId` (required)
- Type: `string`
- Description: The ID of the session to monitor

### `onError` (optional)
- Type: `(error: string) => void`
- Description: Callback function called when errors occur

## Connection Status

The dashboard displays a connection status indicator:
- 🟢 **Live**: Connected to SignalR and receiving updates
- 🟡 **Connecting...**: Attempting to establish connection
- 🔴 **Disconnected**: Not connected to SignalR

## Automatic Reconnection

The component implements automatic reconnection with exponential backoff:
- First retry: Immediate
- Second retry: 2 seconds
- Third retry: 10 seconds
- Subsequent retries: 30 seconds

When reconnected, the dashboard automatically refreshes all data to ensure consistency.

## Error Handling

The component handles various error scenarios:
- **Session not found**: Displays error message with retry button
- **SignalR connection failure**: Shows error banner and attempts reconnection
- **Network errors**: Displays connection status and retries automatically

## Styling

The component uses CSS classes for styling. Key classes include:

- `.teacher-dashboard`: Main container
- `.stats-grid`: Statistics cards container
- `.stat-card`: Individual statistic card
- `.chains-section`: Chain status section
- `.chain-card`: Individual chain card
- `.stalled`: Applied to stalled chains
- `.students-table`: Student list table
- `.status-badge`: Student status indicator
- `.connection-status`: Connection indicator

## Performance Considerations

- **Efficient Updates**: Only updates affected records when receiving SignalR messages
- **Optimistic UI**: Updates statistics immediately upon receiving updates
- **Automatic Cleanup**: Stops SignalR connection when component unmounts

## Security

- **Authentication**: Requires teacher role to access dashboard
- **Session Ownership**: Only the teacher who created the session can view its dashboard
- **Secure Connection**: SignalR connection uses access tokens from negotiate endpoint

## Testing

The component includes comprehensive tests covering:
- Initial data loading
- SignalR connection establishment
- Real-time update handling
- Error scenarios
- Reconnection logic

Run tests with:
```bash
npm test TeacherDashboard.test.tsx
```

## Related Components

- **SessionCreationForm**: Creates sessions that can be monitored
- **QRDisplay**: Used to display QR codes for late entry and early leave
- **ChainManagementControls**: Controls for seeding and reseeding chains

## API Endpoints Used

- `GET /api/sessions/{sessionId}`: Fetch session data
- `POST /api/sessions/{sessionId}/dashboard/negotiate`: Negotiate SignalR connection

## SignalR Events

The component listens for these SignalR events:

### `attendanceUpdate`
Payload:
```typescript
{
  studentId: string;
  entryStatus?: 'PRESENT_ENTRY' | 'LATE_ENTRY';
  exitVerified?: boolean;
  earlyLeaveAt?: number;
}
```

### `chainUpdate`
Payload:
```typescript
{
  chainId: string;
  phase: 'ENTRY' | 'EXIT';
  lastHolder: string;
  lastSeq: number;
  state: 'ACTIVE' | 'STALLED' | 'COMPLETED';
}
```

### `stallAlert`
Payload:
```typescript
string[] // Array of stalled chain IDs
```

## Browser Compatibility

The component requires:
- Modern browser with WebSocket support
- JavaScript enabled
- Fetch API support

Tested on:
- Chrome 90+
- Firefox 88+
- Safari 14+
- Edge 90+

## Accessibility

The component includes:
- ARIA labels for status indicators
- Semantic HTML structure
- Keyboard navigation support
- Screen reader friendly error messages

## Future Enhancements

Potential improvements:
- Export attendance data to CSV
- Filter and search student list
- Customizable refresh intervals
- Audio/visual alerts for stalled chains
- Historical attendance trends
