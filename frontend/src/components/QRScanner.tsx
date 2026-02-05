/**
 * QR Scanner Component
 * Feature: qr-chain-attendance
 * Requirements: 13.1, 13.5
 * 
 * Implements camera access and QR code scanning for students to:
 * - Scan session QR codes to join sessions
 * - Scan peer chain QR codes for entry/exit verification
 * - Scan teacher rotating QR codes for late entry/early leave
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { QrReader } from 'react-qr-reader';
import type {
  QRData,
  SessionQRData,
  ChainQRData,
  RotatingQRData,
  ChainScanRequest,
  ChainScanResponse,
  LateEntryScanRequest,
  EarlyLeaveScanRequest,
  ExitChainScanRequest,
  ScanMetadata,
  ErrorResponse,
} from '@qr-attendance/shared';

export interface QRScannerProps {
  /**
   * Callback when a session QR is scanned
   */
  onSessionScanned?: (data: SessionQRData) => void;

  /**
   * Callback when a scan is successful
   */
  onScanSuccess?: (result: ChainScanResponse) => void;

  /**
   * Callback when a scan fails
   */
  onScanError?: (error: string) => void;

  /**
   * Optional session ID for context (used for chain/late/early scans)
   */
  sessionId?: string;

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
 * Generate a device fingerprint for rate limiting
 */
function generateDeviceFingerprint(): string {
  // Use a combination of browser properties to create a fingerprint
  const nav = navigator;
  const screen = window.screen;
  
  const fingerprint = [
    nav.userAgent,
    nav.language,
    screen.colorDepth,
    screen.width,
    screen.height,
    new Date().getTimezoneOffset(),
  ].join('|');

  // Simple hash function
  let hash = 0;
  for (let i = 0; i < fingerprint.length; i++) {
    const char = fingerprint.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }

  return `fp_${Math.abs(hash).toString(36)}`;
}

/**
 * Get current GPS coordinates
 */
async function getGPSCoordinates(): Promise<{ latitude: number; longitude: number } | undefined> {
  if (!navigator.geolocation) {
    return undefined;
  }

  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        });
      },
      () => {
        // If GPS fails, return undefined (optional constraint)
        resolve(undefined);
      },
      { timeout: 5000, enableHighAccuracy: true }
    );
  });
}

/**
 * Get Wi-Fi BSSID (not directly available in browsers, placeholder)
 * Note: Browsers don't expose BSSID for privacy reasons
 * This would need to be implemented via a native app wrapper or server-side detection
 */
function getBSSID(): string | undefined {
  // Placeholder - in a real implementation, this would come from:
  // 1. A native mobile app wrapper (React Native, Capacitor, etc.)
  // 2. Server-side detection based on IP/network
  // 3. Manual user input in some cases
  return undefined;
}

/**
 * Create scan metadata for API requests
 */
async function createScanMetadata(): Promise<ScanMetadata> {
  const gps = await getGPSCoordinates();
  const bssid = getBSSID();

  return {
    deviceFingerprint: generateDeviceFingerprint(),
    gps,
    bssid,
    userAgent: navigator.userAgent,
  };
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
        if (parsed.sessionId && parsed.classId) {
          return parsed as SessionQRData;
        }
        break;
      
      case 'CHAIN':
      case 'EXIT_CHAIN':
        if (parsed.sessionId && parsed.tokenId && parsed.etag && parsed.holderId && parsed.exp) {
          return parsed as ChainQRData;
        }
        break;
      
      case 'LATE_ENTRY':
      case 'EARLY_LEAVE':
        if (parsed.sessionId && parsed.tokenId && parsed.etag && parsed.exp) {
          return parsed as RotatingQRData;
        }
        break;
    }

    return null;
  } catch (error) {
    return null;
  }
}

/**
 * Call the appropriate scan API endpoint
 */
async function callScanAPI(
  qrData: QRData,
  metadata: ScanMetadata
): Promise<ChainScanResponse> {
  let endpoint: string;
  let body: ChainScanRequest | LateEntryScanRequest | EarlyLeaveScanRequest | ExitChainScanRequest;

  switch (qrData.type) {
    case 'CHAIN':
      endpoint = '/api/scan/chain';
      body = {
        tokenId: qrData.tokenId,
        etag: qrData.etag,
        metadata,
      };
      break;

    case 'EXIT_CHAIN':
      endpoint = '/api/scan/exit-chain';
      body = {
        tokenId: qrData.tokenId,
        etag: qrData.etag,
        metadata,
      };
      break;

    case 'LATE_ENTRY':
      endpoint = '/api/scan/late-entry';
      body = {
        tokenId: qrData.tokenId,
        etag: qrData.etag,
        metadata,
      };
      break;

    case 'EARLY_LEAVE':
      endpoint = '/api/scan/early-leave';
      body = {
        tokenId: qrData.tokenId,
        etag: qrData.etag,
        metadata,
      };
      break;

    case 'SESSION':
      // Session scans don't go through scan API
      throw new Error('Session QR should be handled separately');
  }

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorData: ErrorResponse = await response.json();
    throw new Error(errorData.error.code || errorData.error.message || 'Scan failed');
  }

  return await response.json();
}

/**
 * Get user-friendly error message
 */
function getErrorMessage(error: string, errorCode?: string): string {
  // Check error code first (more reliable)
  if (errorCode === 'EXPIRED_TOKEN' || error.includes('EXPIRED_TOKEN') || error.includes('expired')) {
    return 'This QR code has expired. Please scan a new one.';
  }
  if (errorCode === 'TOKEN_ALREADY_USED' || error.includes('TOKEN_ALREADY_USED') || error.includes('already been used')) {
    return 'This QR code has already been scanned.';
  }
  if (errorCode === 'RATE_LIMITED' || error.includes('RATE_LIMITED') || error.includes('Rate limit')) {
    return 'Too many scan attempts. Please wait a moment and try again.';
  }
  if (errorCode === 'LOCATION_VIOLATION' || error.includes('LOCATION_VIOLATION')) {
    return 'Location verification failed. Please ensure you are in the classroom and connected to the correct Wi-Fi network.';
  }
  if (errorCode === 'GEOFENCE_VIOLATION' || error.includes('GEOFENCE_VIOLATION')) {
    return 'You must be physically present in the classroom to scan.';
  }
  if (errorCode === 'WIFI_VIOLATION' || error.includes('WIFI_VIOLATION')) {
    return 'Please connect to the classroom Wi-Fi network.';
  }
  if (errorCode === 'UNAUTHORIZED' || error.includes('UNAUTHORIZED')) {
    return 'You are not authorized to perform this action. Please sign in.';
  }
  if (errorCode === 'INVALID_STATE' || error.includes('INVALID_STATE')) {
    return 'This scan is not available at this time.';
  }
  if (errorCode === 'INELIGIBLE_STUDENT' || error.includes('INELIGIBLE_STUDENT')) {
    return 'You are not eligible for this scan.';
  }
  
  return error || 'An error occurred while scanning. Please try again.';
}

/**
 * QR Scanner Component
 */
export function QRScanner({
  onSessionScanned,
  onScanSuccess,
  onScanError,
  sessionId,
  isActive = true,
  className = '',
}: QRScannerProps) {
  const [isScanning, setIsScanning] = useState(false);
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
   * Handle QR code scan
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

      // Clear camera error if scan is successful
      if (cameraError) {
        setCameraError(null);
      }

      // No result yet
      if (!result) {
        return;
      }

      const data = result?.text;
      if (!data) {
        return;
      }

      // Prevent duplicate scans - check if already processing or in cooldown
      if (isScanningRef.current || scanCooldown) {
        return;
      }

      // Prevent scanning the same QR code twice in a row
      if (data === lastScannedDataRef.current) {
        return;
      }

      isScanningRef.current = true;
      lastScannedDataRef.current = data;
      setLastScannedData(data);
      setScanCooldown(true);
      setIsScanning(true);

      try {
        // Parse QR data
        const qrData = parseQRData(data);
        if (!qrData) {
          onScanError?.('Invalid QR code format');
          return;
        }

        // Handle session QR separately
        if (qrData.type === 'SESSION') {
          onSessionScanned?.(qrData);
          return;
        }

        // Check if token is expired
        const now = Math.floor(Date.now() / 1000);
        if ('exp' in qrData && qrData.exp < now) {
          onScanError?.('This QR code has expired');
          return;
        }

        // Create scan metadata
        const metadata = await createScanMetadata();

        // Call appropriate scan API
        const response = await callScanAPI(qrData, metadata);

        if (response.success) {
          onScanSuccess?.(response);
        } else {
          onScanError?.(getErrorMessage(response.error || 'Scan failed', response.error));
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        onScanError?.(getErrorMessage(errorMessage, errorMessage));
      } finally {
        isScanningRef.current = false;
        setIsScanning(false);
      }
    },
    [scanCooldown, cameraError, onSessionScanned, onScanSuccess, onScanError]
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
            {isScanning && (
              <div className="scanning-overlay">
                <div className="spinner"></div>
                <p>Processing scan...</p>
              </div>
            )}
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

        .scanning-overlay {
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.7);
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          color: white;
        }

        .spinner {
          width: 40px;
          height: 40px;
          border: 4px solid rgba(255, 255, 255, 0.3);
          border-top-color: white;
          border-radius: 50%;
          animation: spin 1s linear infinite;
        }

        @keyframes spin {
          to {
            transform: rotate(360deg);
          }
        }

        .scanning-overlay p {
          margin-top: 1rem;
          font-size: 1rem;
        }
      `}</style>
    </div>
  );
}

export default QRScanner;
