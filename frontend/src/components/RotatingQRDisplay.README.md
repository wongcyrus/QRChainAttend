# Rotating QR Display Component

## Overview

The `RotatingQRDisplay` component displays rotating QR codes for late entry and early leave with automatic refresh functionality. Teachers use this component to display QR codes that students scan when arriving late or leaving early.

**Feature**: qr-chain-attendance  
**Requirements**: 4.1, 4.2, 5.1, 5.2

## Features

- ✅ Auto-refresh tokens every 55 seconds (before 60s expiration)
- ✅ Start/stop controls for early-leave window
- ✅ Countdown timer for current token
- ✅ Automatic token rotation
- ✅ Real-time status indicators
- ✅ Error handling with retry capability
- ✅ Loading states and user feedback
- ✅ Responsive design

## Usage

### Basic Usage - Late Entry

```tsx
import { RotatingQRDisplay } from '@/components/RotatingQRDisplay';

function TeacherDashboard() {
  const [lateEntryActive, setLateEntryActive] = useState(true);

  return (
    <RotatingQRDisplay
      sessionId="session-123"
      type="LATE_ENTRY"
      isActive={lateEntryActive}
      onError={(error) => console.error(error)}
    />
  );
}
```

### Basic Usage - Early Leave

```tsx
import { RotatingQRDisplay } from '@/components/RotatingQRDisplay';

function TeacherDashboard() {
  const [earlyLeaveActive, setEarlyLeaveActive] = useState(false);

  const handleStart = () => {
    console.log('Early-leave window started');
    setEarlyLeaveActive(true);
  };

  const handleStop = () => {
    console.log('Early-leave window stopped');
    setEarlyLeaveActive(false);
  };

  return (
    <RotatingQRDisplay
      sessionId="session-123"
      type="EARLY_LEAVE"
      isActive={earlyLeaveActive}
      showControls={true}
      onStart={handleStart}
      onStop={handleStop}
      onError={(error) => console.error(error)}
    />
  );
}
```

### Complete Teacher Dashboard Integration

```tsx
import { useState, useEffect } from 'react';
import { RotatingQRDisplay } from '@/components/RotatingQRDisplay';

function TeacherDashboard({ sessionId }: { sessionId: string }) {
  const [session, setSession] = useState<Session | null>(null);

  useEffect(() => {
    // Fetch session data
    fetchSession(sessionId).then(setSession);
  }, [sessionId]);

  if (!session) return <div>Loading...</div>;

  return (
    <div className="teacher-dashboard">
      <h1>Teacher Dashboard</h1>

      {/* Late Entry Section */}
      <section className="late-entry-section">
        <h2>Late Arrivals</h2>
        <RotatingQRDisplay
          sessionId={sessionId}
          type="LATE_ENTRY"
          isActive={session.lateEntryActive}
        />
      </section>

      {/* Early Leave Section */}
      <section className="early-leave-section">
        <h2>Early Departures</h2>
        <RotatingQRDisplay
          sessionId={sessionId}
          type="EARLY_LEAVE"
          isActive={session.earlyLeaveActive}
          showControls={true}
          onStart={() => console.log('Started early-leave window')}
          onStop={() => console.log('Stopped early-leave window')}
        />
      </section>
    </div>
  );
}
```

## Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `sessionId` | `string` | - | **Required.** Session ID for fetching tokens |
| `type` | `'LATE_ENTRY' \| 'EARLY_LEAVE'` | - | **Required.** Type of rotating QR to display |
| `isActive` | `boolean` | `false` | Whether the window is currently active |
| `onStart` | `() => void` | - | Callback when window is started (early leave only) |
| `onStop` | `() => void` | - | Callback when window is stopped (early leave only) |
| `onError` | `(error: string) => void` | - | Callback for errors |
| `className` | `string` | `''` | Additional CSS class names |
| `showControls` | `boolean` | `true` | Show controls for starting/stopping window (early leave only) |

## Token Types

### Late Entry (`LATE_ENTRY`)
- **Purpose**: Students arriving after the late cutoff time scan this code
- **TTL**: 60 seconds
- **Auto-refresh**: Every 55 seconds
- **Controls**: No start/stop controls (managed by session timing)
- **Active State**: Typically always active after late cutoff time

### Early Leave (`EARLY_LEAVE`)
- **Purpose**: Students leaving before the exit chain period scan this code
- **TTL**: 60 seconds
- **Auto-refresh**: Every 55 seconds
- **Controls**: Start/Stop buttons for teacher control
- **Active State**: Controlled by teacher via start/stop buttons

## Behavior

### Auto-Refresh Mechanism
The component automatically refreshes tokens to prevent expiration:

1. **Initial Fetch**: Fetches token immediately when window becomes active
2. **Periodic Refresh**: Fetches new token every 55 seconds
3. **Expiration Handling**: Fetches new token when current token expires
4. **Cleanup**: Stops refresh interval when window becomes inactive or component unmounts

**Why 55 seconds?**
- Tokens expire after 60 seconds
- Refreshing at 55s provides a 5-second buffer
- Ensures students always see a valid QR code
- Prevents race conditions during token rotation

### Start/Stop Controls (Early Leave Only)

**Starting the Window:**
1. Teacher clicks "Start Early-Leave Window"
2. Component calls `/api/sessions/{sessionId}/start-early-leave`
3. Backend creates initial token and sets `earlyLeaveActive=true`
4. Component fetches the token and begins auto-refresh
5. `onStart` callback is called

**Stopping the Window:**
1. Teacher clicks "Stop Early-Leave Window"
2. Component calls `/api/sessions/{sessionId}/stop-early-leave`
3. Backend sets `earlyLeaveActive=false`
4. Component clears the token and stops auto-refresh
5. `onStop` callback is called

### Status Indicators

**Active State:**
- Green background with pulsing dot
- "Window Active" text
- QR code displayed with countdown timer
- Auto-refresh info message

**Inactive State:**
- Gray background with static dot
- "Window Inactive" text
- No QR code displayed
- Appropriate message based on type

## API Endpoints

### Get Late Entry Token
```
GET /api/sessions/{sessionId}/late-qr
```

**Response:**
```json
{
  "token": {
    "type": "LATE_ENTRY",
    "sessionId": "session-123",
    "tokenId": "token-abc",
    "etag": "etag-xyz",
    "exp": 1234567890
  },
  "active": true
}
```

### Get Early Leave Token
```
GET /api/sessions/{sessionId}/early-qr
```

**Response:**
```json
{
  "token": {
    "type": "EARLY_LEAVE",
    "sessionId": "session-123",
    "tokenId": "token-def",
    "etag": "etag-uvw",
    "exp": 1234567890
  },
  "active": true
}
```

### Start Early-Leave Window
```
POST /api/sessions/{sessionId}/start-early-leave
```

**Response:**
```json
{
  "success": true
}
```

### Stop Early-Leave Window
```
POST /api/sessions/{sessionId}/stop-early-leave
```

**Response:**
```json
{
  "success": true
}
```

## Error Handling

### Fetch Errors
- Displays error message with retry button
- Calls `onError` callback if provided
- Clears token display
- Allows manual retry

### Start/Stop Errors
- Displays error message
- Calls `onError` callback if provided
- Re-enables control buttons
- Does not change window state

### Network Errors
- Gracefully handles network failures
- Provides user-friendly error messages
- Allows retry without page reload

## Visual States

### Loading State
- Spinner animation
- "Loading QR code..." message
- Displayed during initial fetch

### Active State with Token
- QR code display with countdown timer
- Green status indicator
- Auto-refresh info message
- Stop button (early leave only)

### Active State without Token
- "Waiting for token..." message
- Green status indicator
- No QR code displayed

### Inactive State
- Gray status indicator
- Appropriate inactive message
- Start button (early leave only)

### Error State
- Red error message banner
- Retry button
- Error details displayed

## Styling

The component uses CSS-in-JS (styled-jsx) for styling with:
- Responsive design for mobile and desktop
- Smooth transitions and animations
- Color-coded status indicators
- Accessible button states
- Professional card-based layout

### Customization

```tsx
<RotatingQRDisplay
  sessionId={sessionId}
  type="LATE_ENTRY"
  isActive={true}
  className="my-custom-class"
/>

<style jsx global>{`
  .my-custom-class .rotating-qr-container {
    background: #f5f5f5;
    border: 2px solid #0078d4;
  }
`}</style>
```

## Examples

### Late Entry with Error Handling

```tsx
function LateEntryDisplay({ sessionId }: { sessionId: string }) {
  const [error, setError] = useState<string | null>(null);

  return (
    <div>
      {error && (
        <div className="error-banner">
          <strong>Error:</strong> {error}
        </div>
      )}
      <RotatingQRDisplay
        sessionId={sessionId}
        type="LATE_ENTRY"
        isActive={true}
        onError={setError}
      />
    </div>
  );
}
```

### Early Leave with State Management

```tsx
function EarlyLeaveControl({ sessionId }: { sessionId: string }) {
  const [isActive, setIsActive] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);

  const handleStart = () => {
    setIsActive(true);
    setLogs(prev => [...prev, `Started at ${new Date().toLocaleTimeString()}`]);
  };

  const handleStop = () => {
    setIsActive(false);
    setLogs(prev => [...prev, `Stopped at ${new Date().toLocaleTimeString()}`]);
  };

  return (
    <div>
      <RotatingQRDisplay
        sessionId={sessionId}
        type="EARLY_LEAVE"
        isActive={isActive}
        showControls={true}
        onStart={handleStart}
        onStop={handleStop}
      />
      
      <div className="activity-log">
        <h3>Activity Log</h3>
        <ul>
          {logs.map((log, i) => (
            <li key={i}>{log}</li>
          ))}
        </ul>
      </div>
    </div>
  );
}
```

### Side-by-Side Display

```tsx
function DualQRDisplay({ sessionId }: { sessionId: string }) {
  return (
    <div className="dual-qr-container">
      <div className="qr-column">
        <RotatingQRDisplay
          sessionId={sessionId}
          type="LATE_ENTRY"
          isActive={true}
        />
      </div>
      
      <div className="qr-column">
        <RotatingQRDisplay
          sessionId={sessionId}
          type="EARLY_LEAVE"
          isActive={false}
          showControls={true}
        />
      </div>
    </div>
  );
}
```

## Testing

The component includes comprehensive unit tests covering:
- Rendering for both token types
- Auto-refresh functionality
- Start/stop controls
- Error handling
- Loading states
- Token expiration handling
- Cleanup on unmount

Run tests:
```bash
npm test RotatingQRDisplay.test.tsx
```

## Accessibility

- Semantic HTML elements
- ARIA roles for alerts and status
- Keyboard-accessible controls
- Clear visual indicators
- Readable font sizes and contrast
- Responsive design for all screen sizes

## Performance

- Efficient timer management with cleanup
- Prevents memory leaks on unmount
- Optimized re-renders with proper dependencies
- Lazy token fetching only when needed
- Automatic cleanup of intervals

## Requirements Validation

## Related Components

- **QRDisplay**: Displays QR codes with countdown timer
- **TeacherDashboard**: Main teacher interface using RotatingQRDisplay
- **QRScanner**: Student component for scanning rotating QR codes

## Browser Support

- Chrome/Edge: ✅ Full support
- Firefox: ✅ Full support
- Safari: ✅ Full support
- Mobile browsers: ✅ Full support

## Dependencies

- `react`: ^18.2.0
- `@qr-attendance/shared`: ^1.0.0 (for type definitions)
- `./QRDisplay`: Internal component for QR code rendering

## Best Practices

1. **Always provide error handling**: Use `onError` callback to handle errors gracefully
2. **Monitor window state**: Keep track of active state for proper UI updates
3. **Clean up on unmount**: Component handles cleanup automatically
4. **Use appropriate type**: Choose `LATE_ENTRY` or `EARLY_LEAVE` based on use case
5. **Show controls for early leave**: Enable `showControls` for teacher control
6. **Handle callbacks**: Implement `onStart` and `onStop` for state synchronization

## Troubleshooting

### QR code not displaying
- Check that `isActive` is `true`
- Verify session ID is correct
- Check network connectivity
- Look for error messages

### Auto-refresh not working
- Ensure window is active
- Check browser console for errors
- Verify backend endpoints are responding
- Check that component is still mounted

### Start/Stop buttons not working
- Verify `type` is `EARLY_LEAVE`
- Check `showControls` is `true`
- Look for error messages
- Verify teacher authorization

### Token expires too quickly
- This is expected behavior (60s TTL)
- Auto-refresh should fetch new token
- Check that auto-refresh is working
- Verify backend token rotation is functioning
