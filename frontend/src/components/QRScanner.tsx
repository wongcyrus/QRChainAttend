/**
 * QR Scanner Component
 * Feature: prove-present
 * Requirements: 13.1, 13.5
 *
 * Guides students to use their phone's native camera to scan QR codes.
 * iOS and Android cameras natively detect QR codes and open the encoded URL.
 */

export interface QRScannerProps {
  /** Whether the scanner prompt is visible */
  isActive?: boolean;
  /** Custom styling */
  className?: string;
}

/**
 * QR Scanner Component
 *
 * Instead of an in-app camera scanner, this prompts the user to open
 * their phone's native camera which handles QR scanning natively on
 * both iOS and Android.
 */
export function QRScanner({ isActive = true, className = '' }: QRScannerProps) {
  if (!isActive) return null;

  return (
    <div className={`qr-scanner ${className}`}>
      <div style={{
        padding: '2rem',
        textAlign: 'center',
        background: '#f0f8ff',
        borderRadius: '12px',
        border: '1px solid #b3d7f2',
      }}>
        <div style={{ fontSize: '3rem', marginBottom: '0.75rem' }}>📷</div>
        <p style={{ margin: '0 0 0.5rem', fontWeight: 600, color: '#333' }}>
          Use your phone's camera
        </p>
        <p style={{ margin: 0, color: '#666', fontSize: '0.95rem', lineHeight: 1.6 }}>
          Open your Camera app and point it at the QR code.
          Tap the link that appears to join the session.
        </p>
      </div>
    </div>
  );
}

export default QRScanner;
