/**
 * QR Scanner Component Usage Example
 * Feature: qr-chain-attendance
 * 
 * This file demonstrates how to use the QRScanner component
 */

import { useState } from 'react';
import { QRScanner } from './QRScanner';
import type { SessionQRData, ChainScanResponse } from '@qr-attendance/shared';

export function QRScannerExample() {
  const [isScanning, setIsScanning] = useState(false);
  const [scanResult, setScanResult] = useState<string | null>(null);
  const [scanError, setScanError] = useState<string | null>(null);
  const [currentSession, setCurrentSession] = useState<string | null>(null);

  const handleSessionScanned = (data: SessionQRData) => {
    setCurrentSession(data.sessionId);
    setScanResult(`Joined session: ${data.classId}`);
    setScanError(null);
    setIsScanning(false);
  };

  const handleScanSuccess = (result: ChainScanResponse) => {
    if (result.holderMarked) {
      setScanResult(`Successfully marked ${result.holderMarked} as present`);
    }
    if (result.newHolder) {
      setScanResult(`You are now the holder! Token: ${result.newToken}`);
    }
    setScanError(null);
    setIsScanning(false);
  };

  const handleScanError = (error: string) => {
    setScanError(error);
    setScanResult(null);
  };

  return (
    <div style={{ padding: '2rem', maxWidth: '600px', margin: '0 auto' }}>
      <h1>QR Scanner Example</h1>

      <div style={{ marginBottom: '2rem' }}>
        <button
          onClick={() => setIsScanning(!isScanning)}
          style={{
            padding: '0.75rem 1.5rem',
            fontSize: '1rem',
            backgroundColor: isScanning ? '#d32f2f' : '#0078d4',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
          }}
        >
          {isScanning ? 'Stop Scanning' : 'Start Scanning'}
        </button>
      </div>

      {currentSession && (
        <div
          style={{
            padding: '1rem',
            backgroundColor: '#e3f2fd',
            border: '1px solid #2196f3',
            borderRadius: '4px',
            marginBottom: '1rem',
          }}
        >
          <strong>Current Session:</strong> {currentSession}
        </div>
      )}

      {scanResult && (
        <div
          style={{
            padding: '1rem',
            backgroundColor: '#e8f5e9',
            border: '1px solid #4caf50',
            borderRadius: '4px',
            marginBottom: '1rem',
          }}
        >
          <strong>✓ Success:</strong> {scanResult}
        </div>
      )}

      {scanError && (
        <div
          style={{
            padding: '1rem',
            backgroundColor: '#ffebee',
            border: '1px solid #f44336',
            borderRadius: '4px',
            marginBottom: '1rem',
          }}
        >
          <strong>✗ Error:</strong> {scanError}
        </div>
      )}

      <QRScanner
        isActive={isScanning}
        sessionId={currentSession || undefined}
        onSessionScanned={handleSessionScanned}
        onScanSuccess={handleScanSuccess}
        onScanError={handleScanError}
      />

      <div style={{ marginTop: '2rem', fontSize: '0.875rem', color: '#666' }}>
        <h3>How to use:</h3>
        <ol>
          <li>Click "Start Scanning" to activate the camera</li>
          <li>Point your camera at a QR code</li>
          <li>The scanner will automatically detect and process the QR code</li>
          <li>Results will appear above the scanner</li>
        </ol>

        <h3>Supported QR Code Types:</h3>
        <ul>
          <li><strong>Session QR:</strong> Join a class session</li>
          <li><strong>Chain QR:</strong> Entry chain verification</li>
          <li><strong>Exit Chain QR:</strong> Exit chain verification</li>
          <li><strong>Late Entry QR:</strong> Mark late arrival</li>
          <li><strong>Early Leave QR:</strong> Mark early departure</li>
        </ul>
      </div>
    </div>
  );
}

export default QRScannerExample;
