# QR Scanner Component

A React component for scanning QR codes in the QR Chain Attendance System. Supports camera access, QR code parsing, type discrimination, and automatic API endpoint routing.

## Features

- **Camera Access**: Automatically requests and manages camera permissions
- **QR Code Scanning**: Uses `react-qr-reader` for reliable QR code detection
- **Type Discrimination**: Parses and validates different QR code types (Session, Chain)
- **API Integration**: Automatically calls the appropriate scan API endpoint based on QR type
- **Error Handling**: Provides user-friendly error messages for common failure scenarios
- **Scan Cooldown**: Prevents duplicate scans and rapid retry attempts
- **Metadata Collection**: Automatically collects device fingerprint, GPS coordinates, and user agent for anti-cheat validation

## Requirements

Implements requirements:
- **13.1**: Student interface for joining sessions and scanning QR codes
- **13.5**: Camera interface for QR scanning with confirmation and error display

## Installation

The component is part of the frontend package and uses the following dependencies:

```json
{
  "react-qr-reader": "^3.0.0-beta-1",
  "@qr-attendance/shared": "^1.0.0"
}
```

## Usage

### Basic Example

```tsx
import { QRScanner } from './components/QRScanner';

function MyComponent() {
  const handleSessionScanned = (data) => {
    console.log('Joined session:', data.sessionId);
  };

  const handleScanSuccess = (result) => {
    console.log('Scan successful:', result);
  };

  const handleScanError = (error) => {
    console.error('Scan failed:', error);
  };

  return (
    <QRScanner
      isActive={true}
      onSessionScanned={handleSessionScanned}
      onScanSuccess={handleScanSuccess}
      onScanError={handleScanError}
    />
  );
}
```

### With Session Context

```tsx
import { QRScanner } from './components/QRScanner';

function StudentView({ sessionId }) {
  return (
    <QRScanner
      isActive={true}
      sessionId={sessionId}
      onScanSuccess={(result) => {
        if (result.newHolder) {
          // Student became the new holder
          showQRCode(result.newToken, result.newTokenEtag);
        }
      }}
      onScanError={(error) => {
        showErrorMessage(error);
      }}
    />
  );
}
```

## Props

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `isActive` | `boolean` | No | Whether the scanner is active (default: `true`) |
| `sessionId` | `string` | No | Current session ID for context |
| `onSessionScanned` | `(data: SessionQRData) => void` | No | Callback when a session QR is scanned |
| `onScanSuccess` | `(result: ChainScanResponse) => void` | No | Callback when a scan succeeds |
| `onScanError` | `(error: string) => void` | No | Callback when a scan fails |
| `className` | `string` | No | Custom CSS class name |

## QR Code Types

The scanner automatically detects and handles the following QR code types:

### 1. Session QR
Allows students to join a class session.

```json
{
  "type": "SESSION",
  "sessionId": "session-123",
  "classId": "class-456"
}
```

**Behavior**: Calls `onSessionScanned` callback directly (no API call)

### 2. Chain QR
Entry chain verification for on-time attendance.

```json
{
  "type": "CHAIN",
  "sessionId": "session-123",
  "tokenId": "token-123",
  "etag": "etag-123",
  "holderId": "student-1",
  "exp": 1234567890
}
```

**API Endpoint**: `POST /api/scan/chain`

## Error Handling

The component provides user-friendly error messages for common scenarios:

| Error Code | User Message |
|------------|--------------|
| `EXPIRED_TOKEN` | "This QR code has expired. Please scan a new one." |
| `TOKEN_ALREADY_USED` | "This QR code has already been scanned." |
| `RATE_LIMITED` | "Too many scan attempts. Please wait a moment and try again." |
| `LOCATION_VIOLATION` | "Location verification failed. Please ensure you are in the classroom..." |
| `GEOFENCE_VIOLATION` | "You must be physically present in the classroom to scan." |
| `WIFI_VIOLATION` | "Please connect to the classroom Wi-Fi network." |
| `UNAUTHORIZED` | "You are not authorized to perform this action. Please sign in." |
| `INVALID_STATE` | "This scan is not available at this time." |
| `INELIGIBLE_STUDENT` | "You are not eligible for this scan." |

## Anti-Cheat Features

The scanner automatically collects metadata for anti-cheat validation:

1. **Device Fingerprint**: Generated from browser properties (user agent, screen size, timezone, etc.)
2. **GPS Coordinates**: Requested from the browser's geolocation API (if available)
3. **BSSID**: Wi-Fi access point identifier (placeholder - requires native app wrapper)
4. **User Agent**: Browser and device information

This metadata is sent with every scan request for server-side validation.

## Scan Cooldown

The component implements a 2-second cooldown between scans to prevent:
- Accidental duplicate scans
- Rapid retry attempts
- Processing the same QR code multiple times

The cooldown is enforced using both React state and refs for immediate synchronous checks.

## Camera Permissions

The component handles camera permission scenarios:

- **Permission Granted**: Scanner activates and displays camera feed
- **Permission Denied**: Shows error message with retry button
- **No Camera Found**: Shows error message indicating no camera is available
- **Other Errors**: Shows generic camera error message

## Testing

The component includes comprehensive unit tests covering:

- Rendering and activation
- Session QR scanning
- Chain QR scanning
- Error handling (camera, API, validation)
- Scan cooldown behavior
- Metadata collection

Run tests with:

```bash
npm test -- QRScanner.test.tsx
```

## Browser Compatibility

The component requires:
- Modern browser with camera support
- WebRTC support for camera access
- Geolocation API support (optional, for GPS)

Tested on:
- Chrome/Edge 90+
- Firefox 88+
- Safari 14+
- Mobile browsers (iOS Safari, Chrome Mobile)

## Performance

- **Scan Detection**: < 500ms typical
- **API Call**: Depends on network and server response time
- **Memory**: Minimal overhead, camera stream is managed by react-qr-reader

## Accessibility

- Camera feed is labeled for screen readers
- Error messages are announced
- Keyboard navigation supported for retry button
- High contrast error states

## Future Enhancements

Potential improvements:
- Torch/flashlight control for low-light scanning
- Manual QR code input option
- Scan history display
- Offline queue for scans when network is unavailable
- Native BSSID detection via Capacitor/React Native wrapper

## License

Part of the QR Chain Attendance System.
