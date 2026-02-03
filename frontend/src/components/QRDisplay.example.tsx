/**
 * QR Display Component Examples
 * Feature: qr-chain-attendance
 * Requirements: 13.2, 13.3
 * 
 * This file demonstrates various usage patterns for the QRDisplay component.
 */

import { useState } from 'react';
import { QRDisplay } from './QRDisplay';
import type { ChainQRData, RotatingQRData } from '@qr-attendance/shared';

/**
 * Example 1: Basic Chain Token Display
 * Shows a student as the holder of an entry chain token
 */
export function BasicChainTokenExample() {
  const [token] = useState<ChainQRData>({
    type: 'CHAIN',
    sessionId: 'session-123',
    tokenId: 'token-abc-123',
    etag: 'etag-xyz-789',
    holderId: 'student-456',
    exp: Math.floor(Date.now() / 1000) + 20, // 20 seconds from now
  });

  return (
    <div>
      <h2>Entry Chain Token</h2>
      <p>You are the current holder. Show this QR code to another student.</p>
      <QRDisplay qrData={token} />
    </div>
  );
}

/**
 * Example 2: Exit Chain Token Display
 * Shows a student as the holder of an exit chain token
 */
export function ExitChainTokenExample() {
  const [token] = useState<ChainQRData>({
    type: 'EXIT_CHAIN',
    sessionId: 'session-123',
    tokenId: 'token-exit-456',
    etag: 'etag-exit-123',
    holderId: 'student-789',
    exp: Math.floor(Date.now() / 1000) + 20,
  });

  return (
    <div>
      <h2>Exit Chain Token</h2>
      <p>Verify your attendance at the end of class.</p>
      <QRDisplay qrData={token} />
    </div>
  );
}

/**
 * Example 3: Late Entry Token Display
 * Shows a rotating QR code for late arrivals (teacher view)
 */
export function LateEntryTokenExample() {
  const [token] = useState<RotatingQRData>({
    type: 'LATE_ENTRY',
    sessionId: 'session-123',
    tokenId: 'token-late-789',
    etag: 'etag-late-456',
    exp: Math.floor(Date.now() / 1000) + 60, // 60 seconds from now
  });

  return (
    <div>
      <h2>Late Entry QR Code</h2>
      <p>Students arriving late should scan this code.</p>
      <QRDisplay 
        qrData={token} 
        showHolderInfo={false}
      />
    </div>
  );
}

/**
 * Example 4: Early Leave Token Display
 * Shows a rotating QR code for early departures (teacher view)
 */
export function EarlyLeaveTokenExample() {
  const [token] = useState<RotatingQRData>({
    type: 'EARLY_LEAVE',
    sessionId: 'session-123',
    tokenId: 'token-early-321',
    etag: 'etag-early-654',
    exp: Math.floor(Date.now() / 1000) + 60,
  });

  return (
    <div>
      <h2>Early Leave QR Code</h2>
      <p>Students leaving early should scan this code.</p>
      <QRDisplay 
        qrData={token} 
        showHolderInfo={false}
      />
    </div>
  );
}

/**
 * Example 5: With Expiration Callback
 * Demonstrates handling token expiration
 */
export function WithExpirationCallbackExample() {
  const [token, setToken] = useState<ChainQRData | null>({
    type: 'CHAIN',
    sessionId: 'session-123',
    tokenId: 'token-callback-999',
    etag: 'etag-callback-888',
    holderId: 'student-111',
    exp: Math.floor(Date.now() / 1000) + 10, // Short expiration for demo
  });
  const [message, setMessage] = useState<string>('');

  const handleExpire = () => {
    setMessage('Your token has expired. Waiting for new token...');
    setToken(null);
    
    // In a real app, you might fetch a new token here
    // or notify the user to wait for the next holder
  };

  return (
    <div>
      <h2>Token with Expiration Handler</h2>
      {message && (
        <div style={{ 
          padding: '1rem', 
          background: '#fff3cd', 
          border: '1px solid #ffc107',
          borderRadius: '4px',
          marginBottom: '1rem'
        }}>
          {message}
        </div>
      )}
      <QRDisplay 
        qrData={token} 
        onExpire={handleExpire}
      />
    </div>
  );
}

/**
 * Example 6: Custom Size
 * Shows QR code with custom dimensions
 */
export function CustomSizeExample() {
  const [token] = useState<ChainQRData>({
    type: 'CHAIN',
    sessionId: 'session-123',
    tokenId: 'token-size-555',
    etag: 'etag-size-444',
    holderId: 'student-222',
    exp: Math.floor(Date.now() / 1000) + 20,
  });

  return (
    <div>
      <h2>Large QR Code</h2>
      <p>Useful for displaying on projectors or large screens.</p>
      <QRDisplay 
        qrData={token} 
        size={500}
      />
    </div>
  );
}

/**
 * Example 7: Without Holder Info
 * Shows QR code without holder information
 */
export function WithoutHolderInfoExample() {
  const [token] = useState<ChainQRData>({
    type: 'CHAIN',
    sessionId: 'session-123',
    tokenId: 'token-noinfo-777',
    etag: 'etag-noinfo-666',
    holderId: 'student-333',
    exp: Math.floor(Date.now() / 1000) + 20,
  });

  return (
    <div>
      <h2>QR Code Without Holder Info</h2>
      <QRDisplay 
        qrData={token} 
        showHolderInfo={false}
      />
    </div>
  );
}

/**
 * Example 8: Rotating Token with Auto-Refresh
 * Simulates teacher's rotating QR code that refreshes automatically
 */
export function RotatingTokenWithRefreshExample() {
  const [token, setToken] = useState<RotatingQRData>({
    type: 'LATE_ENTRY',
    sessionId: 'session-123',
    tokenId: 'token-rotate-1',
    etag: 'etag-rotate-1',
    exp: Math.floor(Date.now() / 1000) + 60,
  });
  const [refreshCount, setRefreshCount] = useState(0);

  const handleExpire = () => {
    // Simulate fetching new token from API
    const newToken: RotatingQRData = {
      type: 'LATE_ENTRY',
      sessionId: 'session-123',
      tokenId: `token-rotate-${refreshCount + 2}`,
      etag: `etag-rotate-${refreshCount + 2}`,
      exp: Math.floor(Date.now() / 1000) + 60,
    };
    
    setToken(newToken);
    setRefreshCount(prev => prev + 1);
  };

  return (
    <div>
      <h2>Auto-Refreshing Rotating QR Code</h2>
      <p>This QR code automatically refreshes when it expires.</p>
      <p>Refresh count: {refreshCount}</p>
      <QRDisplay 
        qrData={token} 
        onExpire={handleExpire}
        showHolderInfo={false}
      />
    </div>
  );
}

/**
 * Example 9: Conditional Display
 * Shows QR code only when student is a holder
 */
export function ConditionalDisplayExample() {
  const [isHolder, setIsHolder] = useState(false);
  const [token] = useState<ChainQRData>({
    type: 'CHAIN',
    sessionId: 'session-123',
    tokenId: 'token-cond-888',
    etag: 'etag-cond-777',
    holderId: 'student-444',
    exp: Math.floor(Date.now() / 1000) + 20,
  });

  return (
    <div>
      <h2>Conditional QR Display</h2>
      <button 
        onClick={() => setIsHolder(!isHolder)}
        style={{
          padding: '0.5rem 1rem',
          background: '#0078d4',
          color: 'white',
          border: 'none',
          borderRadius: '4px',
          cursor: 'pointer',
          marginBottom: '1rem'
        }}
      >
        {isHolder ? 'Release Token' : 'Become Holder'}
      </button>
      
      {isHolder ? (
        <QRDisplay qrData={token} />
      ) : (
        <div style={{
          padding: '2rem',
          background: '#f5f5f5',
          borderRadius: '8px',
          textAlign: 'center'
        }}>
          <p>You are not currently a holder.</p>
          <p>Scan another student's QR code to become the holder.</p>
        </div>
      )}
    </div>
  );
}

/**
 * Example 10: Multiple Token Types Side by Side
 * Demonstrates different token types for comparison
 */
export function MultipleTokenTypesExample() {
  const chainToken: ChainQRData = {
    type: 'CHAIN',
    sessionId: 'session-123',
    tokenId: 'token-multi-1',
    etag: 'etag-multi-1',
    holderId: 'student-555',
    exp: Math.floor(Date.now() / 1000) + 20,
  };

  const exitToken: ChainQRData = {
    type: 'EXIT_CHAIN',
    sessionId: 'session-123',
    tokenId: 'token-multi-2',
    etag: 'etag-multi-2',
    holderId: 'student-666',
    exp: Math.floor(Date.now() / 1000) + 20,
  };

  const lateToken: RotatingQRData = {
    type: 'LATE_ENTRY',
    sessionId: 'session-123',
    tokenId: 'token-multi-3',
    etag: 'etag-multi-3',
    exp: Math.floor(Date.now() / 1000) + 60,
  };

  return (
    <div>
      <h2>Different Token Types</h2>
      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
        gap: '2rem',
        marginTop: '1rem'
      }}>
        <div>
          <h3>Entry Chain</h3>
          <QRDisplay qrData={chainToken} size={250} />
        </div>
        <div>
          <h3>Exit Chain</h3>
          <QRDisplay qrData={exitToken} size={250} />
        </div>
        <div>
          <h3>Late Entry</h3>
          <QRDisplay qrData={lateToken} size={250} showHolderInfo={false} />
        </div>
      </div>
    </div>
  );
}

/**
 * Example Gallery Component
 * Renders all examples for demonstration
 */
export function QRDisplayExamples() {
  const [activeExample, setActiveExample] = useState<string>('basic');

  const examples = [
    { id: 'basic', name: 'Basic Chain Token', component: BasicChainTokenExample },
    { id: 'exit', name: 'Exit Chain Token', component: ExitChainTokenExample },
    { id: 'late', name: 'Late Entry Token', component: LateEntryTokenExample },
    { id: 'early', name: 'Early Leave Token', component: EarlyLeaveTokenExample },
    { id: 'callback', name: 'With Expiration Callback', component: WithExpirationCallbackExample },
    { id: 'size', name: 'Custom Size', component: CustomSizeExample },
    { id: 'noinfo', name: 'Without Holder Info', component: WithoutHolderInfoExample },
    { id: 'rotating', name: 'Auto-Refresh', component: RotatingTokenWithRefreshExample },
    { id: 'conditional', name: 'Conditional Display', component: ConditionalDisplayExample },
    { id: 'multiple', name: 'Multiple Types', component: MultipleTokenTypesExample },
  ];

  const ActiveComponent = examples.find(ex => ex.id === activeExample)?.component || BasicChainTokenExample;

  return (
    <div style={{ padding: '2rem' }}>
      <h1>QR Display Component Examples</h1>
      
      <div style={{ marginBottom: '2rem' }}>
        <label htmlFor="example-select" style={{ marginRight: '1rem', fontWeight: 600 }}>
          Select Example:
        </label>
        <select 
          id="example-select"
          value={activeExample}
          onChange={(e) => setActiveExample(e.target.value)}
          style={{
            padding: '0.5rem',
            fontSize: '1rem',
            borderRadius: '4px',
            border: '1px solid #ccc'
          }}
        >
          {examples.map(ex => (
            <option key={ex.id} value={ex.id}>
              {ex.name}
            </option>
          ))}
        </select>
      </div>

      <div style={{
        padding: '2rem',
        background: '#f9f9f9',
        borderRadius: '8px',
        minHeight: '500px'
      }}>
        <ActiveComponent />
      </div>
    </div>
  );
}

export default QRDisplayExamples;
