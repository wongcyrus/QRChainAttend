/**
 * QR Scanner Component
 * Feature: prove-present
 * Requirements: 13.1, 13.5
 * 
 * Implements camera access and QR code scanning for students to:
 * - Scan session QR codes to join sessions
 * - Scan peer chain QR codes for entry verification
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { QrReader } from 'react-qr-reader';
import type {
  SessionQRData,
  ChainQRData,
} from '../types/shared';

// Additional types needed for QRScanner
type QRData = SessionQRData | ChainQRData;


export interface QRScannerProps {
  /**
   * Callback when a session QR is scanned
   */
  onSessionScanned?: (data: SessionQRData) => void;

  /**
   * Callback when a scan fails
   */
  onScanError?: (error: string) => void;

  /**
   * Whether the scanner is active
   */
  isActive?: boolean;

  /**
   * Custom styling
   */
  className?: string;
}

/**
 * Parse QR code data
 */
function parseQRData(data: string): QRData | null {
  try {
    const parsed = JSON.parse(data);
    
    // Validate type field exists
    if (!parsed.type) {
      return null;
    }

    // Validate based on type
    switch (parsed.type) {
      case 'SESSION':
        if (parsed.sessionId && parsed.eventId) {
          return parsed as SessionQRData;
        }
        break;
      
      case 'CHAIN':
      case 'CHAIN_ENTRY':
        if (parsed.sessionId && parsed.tokenId && parsed.etag && parsed.holderId && parsed.exp) {
          return parsed as ChainQRData;
        }
        break;
    }

    return null;
  } catch (error) {
    return null;
  }
}

/**
 * QR Scanner Component
 */
export function QRScanner({
  onSessionScanned,
  onScanError,
  isActive = true,
  className = '',
}: QRScannerProps) {
  const [lastScannedData, setLastScannedData] = useState<string | null>(null);
  const [scanCooldown, setScanCooldown] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const isScanningRef = useRef(false);
  const lastScannedDataRef = useRef<string | null>(null);
  // Reset cooldown after 2 seconds
  useEffect(() => {
    if (scanCooldown) {
      const timer = setTimeout(() => {
        setScanCooldown(false);
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [scanCooldown]);

  /**
   * Handle QR code scan - opens the scanned URL
   */
  const handleScan = useCallback(
    async (result: any, error: any) => {
      // Handle camera errors
      if (error) {
        if (error.name === 'NotAllowedError') {
          setCameraError('Camera access denied. Please allow camera access to scan QR codes.');
        } else if (error.name === 'NotFoundError') {
          setCameraError('No camera found. Please ensure your device has a camera.');
        } else {
          setCameraError('Camera error. Please try again.');
        }
        return;
      }

      if (cameraError) {
        setCameraError(null);
      }

      if (!result?.text) {
        return;
      }

      const data = result.text;

      // Prevent duplicate scans
      if (isScanningRef.current || scanCooldown || data === lastScannedDataRef.current) {
        return;
      }

      isScanningRef.current = true;
      lastScannedDataRef.current = data;
      setLastScannedData(data);
      setScanCooldown(true);

      try {
        // QR codes should contain URLs - just open them
        if (data.startsWith('http://') || data.startsWith('https://') || data.startsWith('/')) {
          window.location.href = data;
          return;
        }

        // Legacy support: try to parse as JSON (shouldn't happen with new QR codes)
        try {
          const qrData = parseQRData(data);
          if (qrData) {
            if (qrData.type === 'SESSION') {
              onSessionScanned?.(qrData);
              return;
            }
            if (qrData.type === 'CHAIN' || qrData.type === 'CHAIN_ENTRY') {
              const url = `/student/sessions/${qrData.sessionId}/scan?chainId=${qrData.chainId}&tokenId=${qrData.tokenId}&etag=${qrData.etag}`;
              window.location.href = url;
              return;
            }
          }
        } catch {
          // Not JSON, that's fine
        }

        onScanError?.('Invalid QR code');
      } catch (err) {
        onScanError?.('Invalid QR code');
      } finally {
        isScanningRef.current = false;
      }
    },
    [scanCooldown, cameraError, onSessionScanned, onScanError]
  );

  if (!isActive) {
    return null;
  }

  return (
    <div className={`qr-scanner ${className}`}>
      <div className="qr-scanner-container">
        {cameraError ? (
          <div className="qr-scanner-error">
            <p>{cameraError}</p>
            <button
              onClick={() => {
                setCameraError(null);
                window.location.reload();
              }}
              className="retry-button"
            >
              Retry
            </button>
          </div>
        ) : (
          <>
            <QrReader
              onResult={handleScan}
              constraints={{
                facingMode: 'environment', // Use back camera on mobile
              }}
              containerStyle={{
                width: '100%',
                maxWidth: '500px',
              }}
              videoStyle={{
                width: '100%',
                height: 'auto',
              }}
            />
          </>
        )}
      </div>

      <style jsx>{`
        .qr-scanner {
          width: 100%;
          display: flex;
          flex-direction: column;
          align-items: center;
        }

        .qr-scanner-container {
          width: 100%;
          max-width: 500px;
          position: relative;
          border-radius: 8px;
          overflow: hidden;
          background: #000;
        }

        .qr-scanner-error {
          padding: 2rem;
          text-align: center;
          background: #fff;
          color: #333;
        }

        .qr-scanner-error p {
          margin-bottom: 1rem;
          color: #d32f2f;
        }

        .retry-button {
          padding: 0.5rem 1rem;
          background: #0078d4;
          color: white;
          border: none;
          border-radius: 4px;
          cursor: pointer;
          font-size: 1rem;
        }

        .retry-button:hover {
          background: #005a9e;
        }
      `}</style>
    </div>
  );
}

export default QRScanner;

