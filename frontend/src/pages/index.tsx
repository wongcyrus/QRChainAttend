/**
 * Home Page
 * Feature: qr-chain-attendance
 */

import { useEffect, useState } from 'react';

export default function Home() {
  const [isOnline, setIsOnline] = useState(true);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return (
    <div style={{ padding: '2rem', fontFamily: 'system-ui, sans-serif' }}>
      <h1>QR Chain Attendance System</h1>
      
      {!isOnline && (
        <div style={{ 
          padding: '1rem', 
          backgroundColor: '#fff3cd', 
          border: '1px solid #ffc107',
          borderRadius: '4px',
          marginBottom: '1rem'
        }}>
          ⚠️ You are currently offline. Some features may not be available.
        </div>
      )}

      <p>Welcome to the QR Chain Attendance System.</p>
      
      <div style={{ marginTop: '2rem' }}>
        <h2>Getting Started</h2>
        <ul>
          <li>
            <strong>Students:</strong> Scan the session QR code to join a class
          </li>
          <li>
            <strong>Teachers:</strong> Create and manage attendance sessions
          </li>
        </ul>
      </div>

      <div style={{ marginTop: '2rem', fontSize: '0.875rem', color: '#666' }}>
        <p>
          This is a Progressive Web App. You can install it on your device for quick access.
        </p>
      </div>
    </div>
  );
}
