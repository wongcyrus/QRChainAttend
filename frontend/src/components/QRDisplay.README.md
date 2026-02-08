# QR Display Component

## Overview

The `QRDisplay` component displays a holder's QR code with a countdown timer for the QR Chain Attendance System. It supports chain tokens for holder verification.

**Feature**: qr-chain-attendance  
**Requirements**: 13.2, 13.3

## Features

- ✅ Displays QR code generated from token data
- ✅ Shows countdown timer with visual progress bar
- ✅ Automatically hides QR code when token expires
- ✅ Visual urgency indicators (normal, warning, critical)
- ✅ Holder information display for chain tokens
- ✅ Responsive design for mobile and desktop
- ✅ Smooth animations and transitions

## Usage

### Basic Usage

```tsx
import { QRDisplay } from '@/components/QRDisplay';
import type { ChainQRData } from '@qr-attendance/shared';

function StudentView() {
  const [holderToken, setHolderToken] = useState<ChainQRData | null>(null);

  const handleTokenExpire = () => {
    console.log('Token expired');
    setHolderToken(null);
  };

  return (
    <QRDisplay 
      qrData={holderToken} 
      onExpire={handleTokenExpire}
    />
  );
}
```

### Chain Token (Entry/Exit)

```tsx
const chainToken: ChainQRData = {
  type: 'CHAIN',
  sessionId: 'session-123',
  tokenId: 'token-abc',
  etag: 'etag-xyz',
  holderId: 'student-456',
  exp: Math.floor(Date.now() / 1000) + 20, // 20 seconds from now
};

<QRDisplay qrData={chainToken} />
```

### Custom Size and Styling

```tsx
<QRDisplay 
  qrData={token}
  size={400}
  className="my-custom-class"
  showHolderInfo={false}
/>
```

## Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `qrData` | `ChainQRData \| null` | - | **Required.** The token data to display as QR code |
| `onExpire` | `() => void` | - | Callback function called when token expires |
| `className` | `string` | `''` | Additional CSS class names |
| `size` | `number` | `300` | Size of the QR code in pixels |
| `showHolderInfo` | `boolean` | `true` | Whether to show holder information (for chain tokens) |

## Token Types

### Chain Tokens (20s TTL)
- `CHAIN`: Chain verification
- Shows holder information by default
- Critical warning at ≤5 seconds
- Warning state at ≤10 seconds

## Visual States

### Normal State (>10s remaining)
- Green color scheme
- Full progress bar
- No warnings

### Warning State (≤10s remaining)
- Orange color scheme
- Decreasing progress bar
- No additional warnings

### Critical State (≤5s remaining)
- Red color scheme
- Pulsing animation
- "⚠️ QR code expiring soon!" warning message

## Behavior

### Automatic Expiration
The component automatically:
1. Monitors the token's expiration time
2. Updates the countdown timer every second
3. Hides the QR code when expired
4. Calls the `onExpire` callback (if provided)
5. Cleans up timers on unmount

### QR Code Generation
- Uses the `qrcode` library to generate QR codes
- Error correction level: M (Medium)
- Margin: 2 modules
- Encodes the complete token data as JSON

### Countdown Timer
- Displays time in MM:SS format
- Updates every second
- Shows visual progress bar
- Changes color based on urgency

## Examples

### Student Holder View

```tsx
import { useState, useEffect } from 'react';
import { QRDisplay } from '@/components/QRDisplay';

function HolderView({ sessionId }: { sessionId: string }) {
  const [token, setToken] = useState<ChainQRData | null>(null);

  // Fetch holder token from API
  useEffect(() => {
    fetchHolderToken(sessionId).then(setToken);
  }, [sessionId]);

  const handleExpire = () => {
    // Token expired, fetch new one or update UI
    setToken(null);
    // Optionally notify user or fetch new token
  };

  if (!token) {
    return <div>Waiting for token...</div>;
  }

  return (
    <div>
      <h2>You are the holder!</h2>
      <QRDisplay 
        qrData={token} 
        onExpire={handleExpire}
      />
      <p>Show this QR code to another student</p>
    </div>
  );
}
```

### Teacher Rotating QR Display

## Styling

The component uses CSS-in-JS (styled-jsx) for styling. You can customize the appearance by:

1. **Using className prop**: Add custom classes for additional styling
2. **CSS variables**: Override default colors and sizes
3. **Wrapper styling**: Style the parent container

Example custom styling:

```tsx
<div className="custom-qr-wrapper">
  <QRDisplay qrData={token} className="custom-qr" />
</div>

<style jsx>{`
  .custom-qr-wrapper {
    background: #f5f5f5;
    padding: 2rem;
    border-radius: 16px;
  }
  
  :global(.custom-qr) {
    /* Custom styles */
  }
`}</style>
```

## Accessibility

- Uses semantic HTML elements
- Provides alt text for QR code image
- Clear visual indicators for urgency
- Readable font sizes and contrast ratios
- Responsive design for various screen sizes

## Performance

- Efficient timer management with cleanup
- Prevents memory leaks on unmount
- Optimized re-renders with proper dependencies
- Lazy QR code generation only when needed

## Testing

The component includes comprehensive unit tests covering:
- Rendering with different token types
- Countdown timer functionality
- Expiration handling
- QR code generation
- Visual state changes
- Cleanup and memory management

Run tests:
```bash
npm test QRDisplay.test.tsx
```

## Related Components

- **QRScanner**: Scans QR codes from other students or teachers
- **StudentSessionView**: Main student interface using QRDisplay
- **TeacherDashboard**: Teacher interface for managing sessions

## Requirements Validation

✅ **Requirement 13.2**: Display holder's QR code with countdown timer  
✅ **Requirement 13.3**: Hide QR when token expires

## Browser Support

- Chrome/Edge: ✅ Full support
- Firefox: ✅ Full support
- Safari: ✅ Full support
- Mobile browsers: ✅ Full support

## Dependencies

- `react`: ^18.2.0
- `qrcode`: ^1.5.3
- `@qr-attendance/shared`: ^1.0.0 (for type definitions)
