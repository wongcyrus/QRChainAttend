# Offline Handling Components

## Overview

This directory contains components and utilities for handling offline scenarios in the QR Chain Attendance system.

**Requirement:** 20.5 - Offline message display and handling

## Components

### OfflineIndicator

A global banner that displays at the top or bottom of the screen when offline.

**Location:** `frontend/src/components/OfflineIndicator.tsx`

**Usage:**
```tsx
import OfflineIndicator from '../components/OfflineIndicator';

// In your app layout (_app.tsx)
<OfflineIndicator position="top" />
```

**Props:**
- `position?: 'top' | 'bottom'` - Position of the indicator (default: 'top')
- `showReconnectionMessage?: boolean` - Show success message when reconnected (default: true)
- `reconnectionMessageDuration?: number` - Duration to show reconnection message in ms (default: 3000)

**Features:**
- Prominent red banner when offline
- Green success banner when connection restored
- Auto-dismissing reconnection message
- Accessible (ARIA live regions)
- Smooth animations

### OfflineMessage

A contextual message component for features that require network connectivity.

**Location:** `frontend/src/components/OfflineMessage.tsx`

**Usage:**
```tsx
import { OfflineMessage } from '../components/OfflineMessage';
import { useOnlineStatus } from '../hooks/useOnlineStatus';

function MyComponent() {
  const { isOnline } = useOnlineStatus();
  
  if (!isOnline) {
    return (
      <OfflineMessage
        title="Cannot Scan QR Code"
        message="Scanning requires an active internet connection."
        showRetry
        onRetry={handleRetry}
      />
    );
  }
  
  return <div>Online content</div>;
}
```

**Props:**
- `title?: string` - Title of the message (default: 'Network Connection Required')
- `message?: string` - Description text (default: 'This feature requires an active internet connection.')
- `showRetry?: boolean` - Show retry button (default: false)
- `onRetry?: () => void` - Callback when retry button clicked
- `variant?: 'card' | 'inline' | 'banner'` - Visual style (default: 'card')
- `className?: string` - Additional CSS class

**Variants:**
- **card**: Full card with border and shadow (best for standalone messages)
- **inline**: Minimal padding, no border (best for inline messages)
- **banner**: Colored background banner (best for alerts)

## Hooks

### useOnlineStatus

Monitors network connectivity and provides real-time status updates.

**Location:** `frontend/src/hooks/useOnlineStatus.ts`

**Usage:**
```tsx
import { useOnlineStatus } from '../hooks/useOnlineStatus';

function MyComponent() {
  const { isOnline, wasOffline } = useOnlineStatus();
  
  if (!isOnline) {
    return <div>You are offline</div>;
  }
  
  if (wasOffline) {
    // Show reconnection message
  }
  
  return <div>Online content</div>;
}
```

**Returns:**
- `isOnline: boolean` - Current online status
- `wasOffline: boolean` - Whether user was offline (for showing reconnection messages)

**Features:**
- Real-time connectivity monitoring
- Browser online/offline event listeners
- SSR-safe (checks for browser environment)
- Automatic cleanup

### useOnlineStatusCallback

Variant that provides a callback when connectivity status changes.

**Usage:**
```tsx
import { useOnlineStatusCallback } from '../hooks/useOnlineStatus';

function MyComponent() {
  useOnlineStatusCallback((isOnline) => {
    if (isOnline) {
      retryFailedOperations();
    } else {
      showOfflineNotification();
    }
  });
  
  return <div>Content</div>;
}
```

## Utilities

### OfflineQueue

A queue manager for failed network operations with automatic retry.

**Location:** `frontend/src/utils/offlineQueue.ts`

**Usage:**
```tsx
import { OfflineQueue } from '../utils/offlineQueue';

const queue = new OfflineQueue({
  maxRetries: 3,
  retryDelay: 2000,
  onSuccess: (id, result) => console.log('Success:', id),
  onError: (id, error) => console.error('Failed:', id, error),
});

// Add operation
queue.add(
  () => fetch('/api/endpoint', options),
  'Operation description'
);

// Retry all (called when connection restored)
queue.retryAll();
```

**Options:**
- `maxRetries?: number` - Maximum retry attempts (default: 3)
- `retryDelay?: number` - Delay between retries in ms (default: 1000)
- `onSuccess?: (id, result) => void` - Success callback
- `onError?: (id, error) => void` - Error callback (after max retries)
- `onRetry?: (id, attempt) => void` - Retry attempt callback

**Methods:**
- `add(operation, description?)` - Add operation to queue
- `remove(id)` - Remove operation
- `retry(id)` - Retry specific operation
- `retryAll()` - Retry all queued operations
- `getAll()` - Get all queued operations
- `size()` - Get queue size
- `clear()` - Clear all operations

### globalOfflineQueue

A singleton queue instance for application-wide use.

**Usage:**
```tsx
import { globalOfflineQueue } from '../utils/offlineQueue';

// Add operation
globalOfflineQueue.add(
  () => fetch('/api/endpoint', options),
  'My operation'
);

// Queue automatically retries when connection restored
```

### fetchWithOfflineQueue

A wrapper around `fetch` that automatically queues failed requests.

**Usage:**
```tsx
import { fetchWithOfflineQueue } from '../utils/offlineQueue';

try {
  const response = await fetchWithOfflineQueue('/api/scan', {
    method: 'POST',
    body: JSON.stringify(data),
  }, {
    description: 'Scan QR code',
    autoQueue: true,
  });
} catch (error) {
  // Request failed and was queued
  console.log('Request queued for retry');
}
```

**Options:**
- `queue?: OfflineQueue` - Custom queue instance (default: globalOfflineQueue)
- `description?: string` - Operation description for debugging
- `autoQueue?: boolean` - Automatically queue on failure (default: true)

## Integration Guide

### 1. Add Global Offline Indicator

In your `_app.tsx`:

```tsx
import OfflineIndicator from '../components/OfflineIndicator';
import { useOnlineStatusCallback } from '../hooks/useOnlineStatus';
import { globalOfflineQueue } from '../utils/offlineQueue';

export default function App({ Component, pageProps }: AppProps) {
  // Auto-retry queued operations when connection restored
  useOnlineStatusCallback((isOnline) => {
    if (isOnline) {
      globalOfflineQueue.retryAll();
    }
  });

  return (
    <>
      <OfflineIndicator position="top" />
      <Component {...pageProps} />
    </>
  );
}
```

### 2. Add Offline Handling to Components

For components that make network requests:

```tsx
import { useOnlineStatus } from '../hooks/useOnlineStatus';
import { OfflineMessage } from '../components/OfflineMessage';
import { fetchWithOfflineQueue } from '../utils/offlineQueue';

function QRScanner() {
  const { isOnline } = useOnlineStatus();
  
  const handleScan = async (qrData: string) => {
    try {
      const response = await fetchWithOfflineQueue('/api/scan', {
        method: 'POST',
        body: JSON.stringify({ qrData }),
      }, {
        description: 'Scan QR code',
      });
      
      // Handle success
    } catch (error) {
      if (!isOnline) {
        showToast('Request queued. Will retry when online.');
      }
    }
  };
  
  if (!isOnline) {
    return (
      <OfflineMessage
        title="Cannot Scan QR Code"
        message="Scanning requires network connection."
      />
    );
  }
  
  return <QRScannerUI onScan={handleScan} />;
}
```

### 3. Disable Features When Offline

```tsx
const { isOnline } = useOnlineStatus();

<button disabled={!isOnline}>
  Scan QR Code
</button>
```

### 4. Show Contextual Messages

```tsx
const { isOnline } = useOnlineStatus();

{!isOnline && (
  <OfflineMessage
    variant="banner"
    message="Real-time updates paused. Will resume when online."
  />
)}
```

## Testing

Tests are located in `frontend/src/tests/offline.test.ts`.

**Run tests:**
```bash
npm test offline.test.ts
```

**Test coverage:**
- ✅ Hook initialization and status detection
- ✅ Online/offline event handling
- ✅ Queue operations (add, remove, retry)
- ✅ Fetch wrapper with auto-queuing
- ✅ Complete offline-to-online flow

## Examples

See `OfflineHandling.example.tsx` for comprehensive examples:

1. **Basic Online Status** - Simple connectivity detection
2. **Offline Message** - All three variants (card, inline, banner)
3. **QR Scanner** - Complete integration with offline handling
4. **Session Creation** - Form submission with offline queuing
5. **Status Callback** - Logging connectivity changes
6. **Queue Management** - Monitoring and managing the queue
7. **App Layout** - Complete app integration

## Best Practices

### 1. Always Check Online Status Before Network Operations

```tsx
const { isOnline } = useOnlineStatus();

if (!isOnline) {
  showOfflineMessage();
  return;
}

// Proceed with network operation
```

### 2. Use fetchWithOfflineQueue for API Calls

```tsx
// Instead of:
fetch('/api/endpoint', options);

// Use:
fetchWithOfflineQueue('/api/endpoint', options, {
  description: 'Operation name',
});
```

### 3. Provide Clear User Feedback

```tsx
if (!isOnline) {
  return (
    <OfflineMessage
      title="Feature Unavailable"
      message="This feature requires network connection."
    />
  );
}
```

### 4. Handle Queued Operations Gracefully

```tsx
try {
  await fetchWithOfflineQueue('/api/endpoint', options);
} catch (error) {
  if (!isOnline) {
    showToast('Operation queued. Will retry when online.');
  } else {
    showError('Operation failed: ' + error.message);
  }
}
```

### 5. Disable Features That Require Network

```tsx
<button disabled={!isOnline}>
  Network-dependent Action
</button>
```

## Browser Support

**Full Support:**
- ✅ Chrome 67+
- ✅ Edge 79+
- ✅ Safari 11.1+
- ✅ Firefox 79+
- ✅ Samsung Internet 8.2+

**APIs Used:**
- `navigator.onLine` - All modern browsers
- `online`/`offline` events - All modern browsers
- Service Worker offline detection - PWA-capable browsers

## Troubleshooting

### Offline indicator not showing

**Check:**
- OfflineIndicator component added to app layout
- Browser supports navigator.onLine
- No CSS conflicts

### Operations not queuing

**Check:**
- Using fetchWithOfflineQueue wrapper
- autoQueue option enabled
- Network error actually occurring

### Operations not retrying

**Check:**
- useOnlineStatusCallback hook in app
- globalOfflineQueue.retryAll() called on reconnection
- Operations not exceeding max retries

## Resources

- [MDN: Navigator.onLine](https://developer.mozilla.org/en-US/docs/Web/API/Navigator/onLine)
- [MDN: Online and offline events](https://developer.mozilla.org/en-US/docs/Web/API/Navigator/Online_and_offline_events)
- [Service Worker Cookbook](https://serviceworke.rs/)
- [Offline First](https://offlinefirst.org/)
