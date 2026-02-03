/**
 * Offline Handling Examples
 * Feature: qr-chain-attendance
 * Requirement: 20.5 - Offline message display and handling
 * 
 * This file demonstrates various ways to use the offline handling features.
 */

import React, { useState } from 'react';
import { useOnlineStatus, useOnlineStatusCallback } from '../hooks/useOnlineStatus';
import OfflineIndicator from './OfflineIndicator';
import { OfflineMessage } from './OfflineMessage';
import { fetchWithOfflineQueue, globalOfflineQueue } from '../utils/offlineQueue';

/**
 * Example 1: Basic Online Status Detection
 * 
 * Shows how to use the useOnlineStatus hook to detect connectivity
 * and conditionally render content.
 */
export function Example1_BasicOnlineStatus() {
  const { isOnline, wasOffline } = useOnlineStatus();

  return (
    <div style={{ padding: '20px' }}>
      <h2>Example 1: Basic Online Status</h2>
      
      <div style={{ marginTop: '16px' }}>
        <p>
          <strong>Status:</strong>{' '}
          <span style={{ color: isOnline ? 'green' : 'red' }}>
            {isOnline ? '🟢 Online' : '🔴 Offline'}
          </span>
        </p>
        
        {wasOffline && isOnline && (
          <p style={{ color: 'green' }}>
            ✅ Connection was restored!
          </p>
        )}
      </div>

      {!isOnline && (
        <div style={{ marginTop: '16px', padding: '12px', backgroundColor: '#ffebee', borderRadius: '4px' }}>
          <p>⚠️ You are currently offline. Some features may not be available.</p>
        </div>
      )}
    </div>
  );
}

/**
 * Example 2: Offline Message Component
 * 
 * Shows how to use the OfflineMessage component to display
 * user-friendly messages when features require network.
 */
export function Example2_OfflineMessage() {
  const { isOnline } = useOnlineStatus();
  const [retryCount, setRetryCount] = useState(0);

  const handleRetry = () => {
    setRetryCount(prev => prev + 1);
    console.log('Retry clicked, count:', retryCount + 1);
  };

  return (
    <div style={{ padding: '20px' }}>
      <h2>Example 2: Offline Message</h2>
      
      {!isOnline ? (
        <>
          <h3>Card Variant (default)</h3>
          <OfflineMessage
            title="Cannot Scan QR Code"
            message="Scanning QR codes requires an active internet connection to verify attendance."
            showRetry
            onRetry={handleRetry}
          />

          <h3 style={{ marginTop: '24px' }}>Banner Variant</h3>
          <OfflineMessage
            variant="banner"
            title="Session Creation Unavailable"
            message="You need to be online to create new sessions."
          />

          <h3 style={{ marginTop: '24px' }}>Inline Variant</h3>
          <OfflineMessage
            variant="inline"
            title="Real-time Updates Paused"
            message="Dashboard updates will resume when connection is restored."
          />
        </>
      ) : (
        <p style={{ color: 'green' }}>✅ You are online. All features available.</p>
      )}
    </div>
  );
}

/**
 * Example 3: QR Scanner with Offline Handling
 * 
 * Shows how to integrate offline handling into a QR scanner component.
 */
export function Example3_QRScannerWithOffline() {
  const { isOnline } = useOnlineStatus();
  const [scanning, setScanning] = useState(false);
  const [result, setResult] = useState<string>('');

  const handleScan = async (qrData: string) => {
    if (!isOnline) {
      setResult('Cannot scan while offline');
      return;
    }

    setScanning(true);
    setResult('');

    try {
      const response = await fetchWithOfflineQueue('/api/scan/chain', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ qrData }),
      }, {
        description: 'Scan QR code',
      });

      if (response.ok) {
        setResult('✅ Scan successful!');
      } else {
        setResult('❌ Scan failed');
      }
    } catch (error) {
      if (!isOnline) {
        setResult('⏳ Scan queued. Will retry when online.');
      } else {
        setResult('❌ Error: ' + (error as Error).message);
      }
    } finally {
      setScanning(false);
    }
  };

  if (!isOnline) {
    return (
      <div style={{ padding: '20px' }}>
        <h2>Example 3: QR Scanner</h2>
        <OfflineMessage
          title="Cannot Scan QR Code"
          message="Scanning requires network connection to verify attendance."
        />
      </div>
    );
  }

  return (
    <div style={{ padding: '20px' }}>
      <h2>Example 3: QR Scanner</h2>
      
      <button
        onClick={() => handleScan('mock-qr-data-' + Date.now())}
        disabled={scanning || !isOnline}
        style={{
          padding: '12px 24px',
          backgroundColor: isOnline ? '#0078d4' : '#ccc',
          color: 'white',
          border: 'none',
          borderRadius: '4px',
          cursor: isOnline ? 'pointer' : 'not-allowed',
        }}
      >
        {scanning ? 'Scanning...' : 'Scan QR Code'}
      </button>

      {result && (
        <div style={{ marginTop: '16px', padding: '12px', backgroundColor: '#f5f5f5', borderRadius: '4px' }}>
          {result}
        </div>
      )}
    </div>
  );
}

/**
 * Example 4: Session Creation with Offline Handling
 * 
 * Shows how to handle form submission when offline.
 */
export function Example4_SessionCreationWithOffline() {
  const { isOnline } = useOnlineStatus();
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setMessage('');

    const formData = {
      classId: 'CS101',
      startAt: new Date().toISOString(),
      endAt: new Date(Date.now() + 3600000).toISOString(),
      lateCutoffMinutes: 15,
    };

    try {
      const response = await fetchWithOfflineQueue('/api/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      }, {
        description: 'Create session',
      });

      if (response.ok) {
        setMessage('✅ Session created successfully!');
      } else {
        setMessage('❌ Failed to create session');
      }
    } catch (error) {
      if (!isOnline) {
        setMessage('⏳ Session creation queued. Will create when online.');
      } else {
        setMessage('❌ Error: ' + (error as Error).message);
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={{ padding: '20px' }}>
      <h2>Example 4: Session Creation</h2>

      {!isOnline && (
        <OfflineMessage
          variant="banner"
          message="You are offline. Session will be created when connection is restored."
        />
      )}

      <form onSubmit={handleSubmit} style={{ marginTop: '16px' }}>
        <div style={{ marginBottom: '12px' }}>
          <label>Class ID: CS101</label>
        </div>
        
        <button
          type="submit"
          disabled={submitting}
          style={{
            padding: '12px 24px',
            backgroundColor: '#0078d4',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: submitting ? 'not-allowed' : 'pointer',
          }}
        >
          {submitting ? 'Creating...' : 'Create Session'}
        </button>
      </form>

      {message && (
        <div style={{ marginTop: '16px', padding: '12px', backgroundColor: '#f5f5f5', borderRadius: '4px' }}>
          {message}
        </div>
      )}
    </div>
  );
}

/**
 * Example 5: Status Callback Hook
 * 
 * Shows how to use the callback variant to react to connectivity changes.
 */
export function Example5_StatusCallback() {
  const [logs, setLogs] = useState<string[]>([]);

  useOnlineStatusCallback((isOnline) => {
    const timestamp = new Date().toLocaleTimeString();
    const status = isOnline ? 'ONLINE' : 'OFFLINE';
    const message = `[${timestamp}] Status changed: ${status}`;
    
    setLogs(prev => [...prev, message]);
    
    if (isOnline) {
      console.log('Connection restored, retrying queued operations...');
      globalOfflineQueue.retryAll();
    }
  });

  return (
    <div style={{ padding: '20px' }}>
      <h2>Example 5: Status Callback</h2>
      
      <p>This component logs connectivity changes and automatically retries queued operations.</p>
      
      <div style={{ marginTop: '16px', padding: '12px', backgroundColor: '#f5f5f5', borderRadius: '4px', maxHeight: '200px', overflow: 'auto' }}>
        <h4>Connection Log:</h4>
        {logs.length === 0 ? (
          <p>No changes yet. Try toggling your network connection.</p>
        ) : (
          <ul style={{ margin: 0, paddingLeft: '20px' }}>
            {logs.map((log, index) => (
              <li key={index}>{log}</li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

/**
 * Example 6: Queue Management
 * 
 * Shows how to monitor and manage the offline queue.
 */
export function Example6_QueueManagement() {
  const { isOnline } = useOnlineStatus();
  const [queueSize, setQueueSize] = useState(0);
  const [operations, setOperations] = useState<any[]>([]);

  const refreshQueue = () => {
    setQueueSize(globalOfflineQueue.size());
    setOperations(globalOfflineQueue.getAll());
  };

  const addMockOperation = () => {
    globalOfflineQueue.add(
      () => new Promise((resolve) => setTimeout(resolve, 1000)),
      `Mock operation ${Date.now()}`
    );
    refreshQueue();
  };

  const retryAll = async () => {
    await globalOfflineQueue.retryAll();
    refreshQueue();
  };

  const clearQueue = () => {
    globalOfflineQueue.clear();
    refreshQueue();
  };

  React.useEffect(() => {
    refreshQueue();
    const interval = setInterval(refreshQueue, 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div style={{ padding: '20px' }}>
      <h2>Example 6: Queue Management</h2>
      
      <div style={{ marginTop: '16px' }}>
        <p><strong>Queue Size:</strong> {queueSize}</p>
        <p><strong>Status:</strong> {isOnline ? '🟢 Online' : '🔴 Offline'}</p>
      </div>

      <div style={{ marginTop: '16px', display: 'flex', gap: '8px' }}>
        <button
          onClick={addMockOperation}
          style={{
            padding: '8px 16px',
            backgroundColor: '#0078d4',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
          }}
        >
          Add Mock Operation
        </button>
        
        <button
          onClick={retryAll}
          disabled={queueSize === 0}
          style={{
            padding: '8px 16px',
            backgroundColor: '#388e3c',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: queueSize === 0 ? 'not-allowed' : 'pointer',
            opacity: queueSize === 0 ? 0.5 : 1,
          }}
        >
          Retry All
        </button>
        
        <button
          onClick={clearQueue}
          disabled={queueSize === 0}
          style={{
            padding: '8px 16px',
            backgroundColor: '#d32f2f',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: queueSize === 0 ? 'not-allowed' : 'pointer',
            opacity: queueSize === 0 ? 0.5 : 1,
          }}
        >
          Clear Queue
        </button>
      </div>

      {operations.length > 0 && (
        <div style={{ marginTop: '16px', padding: '12px', backgroundColor: '#f5f5f5', borderRadius: '4px' }}>
          <h4>Queued Operations:</h4>
          <ul style={{ margin: 0, paddingLeft: '20px' }}>
            {operations.map((op) => (
              <li key={op.id}>
                {op.description || op.id} - Retry {op.retryCount}/{op.maxRetries}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

/**
 * Example 7: Complete App Layout
 * 
 * Shows how to integrate offline handling into the app layout.
 */
export function Example7_AppLayout() {
  return (
    <div>
      {/* Global offline indicator */}
      <OfflineIndicator position="top" />
      
      {/* App content */}
      <div style={{ padding: '20px', marginTop: '60px' }}>
        <h1>QR Chain Attendance</h1>
        <p>This is your app content. The offline indicator will appear at the top when you lose connection.</p>
        
        <div style={{ marginTop: '24px' }}>
          <h2>Try it:</h2>
          <ol>
            <li>Open DevTools → Network tab</li>
            <li>Check "Offline" checkbox</li>
            <li>See the offline banner appear</li>
            <li>Uncheck "Offline"</li>
            <li>See the "Connection restored!" message</li>
          </ol>
        </div>
      </div>
    </div>
  );
}

/**
 * All Examples Demo
 */
export default function OfflineHandlingExamples() {
  return (
    <div>
      <Example1_BasicOnlineStatus />
      <hr />
      <Example2_OfflineMessage />
      <hr />
      <Example3_QRScannerWithOffline />
      <hr />
      <Example4_SessionCreationWithOffline />
      <hr />
      <Example5_StatusCallback />
      <hr />
      <Example6_QueueManagement />
      <hr />
      <Example7_AppLayout />
    </div>
  );
}
