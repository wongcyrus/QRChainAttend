/**
 * QR Display Component
 * Feature: qr-chain-attendance
 * Requirements: 13.2, 13.3
 * 
 * Displays a holder's QR code with countdown timer for:
 * - Chain tokens (entry/exit verification)
 * - Rotating tokens (late entry/early leave)
 * 
 * Automatically hides QR code when token expires.
 */

import { useState, useEffect, useRef } from 'react';
import QRCode from 'qrcode';
import Image from 'next/image';
import type { ChainQRData, RotatingQRData } from '../types/shared';

export interface QRDisplayProps {
  /**
   * QR code data to display (chain or rotating token)
   */
  qrData: ChainQRData | RotatingQRData | null;

  /**
   * Callback when token expires
   */
  onExpire?: () => void;

  /**
   * Custom styling
   */
  className?: string;

  /**
   * Size of the QR code in pixels
   */
  size?: number;

  /**
   * Show holder information (for chain tokens)
   */
  showHolderInfo?: boolean;
}

/**
 * Format seconds into MM:SS
 */
function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

/**
 * Get token type label
 */
function getTokenTypeLabel(type: string): string {
  switch (type) {
    case 'CHAIN_ENTRY':
      return 'Entry Chain Token';
    case 'CHAIN_EXIT':
      return 'Exit Chain Token';
    case 'LATE_ENTRY':
      return 'Late Entry Token';
    case 'EARLY_LEAVE':
      return 'Early Leave Token';
    default:
      return 'Token';
  }
}

/**
 * QR Display Component
 */
export function QRDisplay({
  qrData,
  onExpire,
  className = '',
  size = 300,
  showHolderInfo = true,
}: QRDisplayProps) {
  const [qrCodeDataURL, setQrCodeDataURL] = useState<string | null>(null);
  const [timeRemaining, setTimeRemaining] = useState<number>(0);
  const [isExpired, setIsExpired] = useState(false);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const hasCalledOnExpire = useRef(false);

  // Generate QR code when qrData changes
  useEffect(() => {
    if (!qrData) {
      setQrCodeDataURL(null);
      setIsExpired(false);
      hasCalledOnExpire.current = false;
      return;
    }

    // Check if already expired
    const now = Date.now();
    const expiresAt = 'expiresAt' in qrData ? qrData.expiresAt : undefined;
    if (expiresAt && expiresAt <= now) {
      setIsExpired(true);
      setQrCodeDataURL(null);
      if (!hasCalledOnExpire.current) {
        hasCalledOnExpire.current = true;
        onExpire?.();
      }
      return;
    }

    // Generate QR code
    const qrDataString = JSON.stringify(qrData);
    QRCode.toDataURL(qrDataString, {
      width: size,
      margin: 2,
      errorCorrectionLevel: 'M',
    })
      .then((dataURL) => {
        setQrCodeDataURL(dataURL);
        setIsExpired(false);
        hasCalledOnExpire.current = false;
      })
      .catch((error) => {
        console.error('Failed to generate QR code:', error);
        setQrCodeDataURL(null);
      });
  }, [qrData, size, onExpire]);

  // Update countdown timer
  useEffect(() => {
    if (!qrData || isExpired) {
      setTimeRemaining(0);
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      return;
    }

    // Calculate initial time remaining
    const updateTimeRemaining = () => {
      const now = Date.now();
      const expiresAt = 'expiresAt' in qrData ? qrData.expiresAt : undefined;
      
      if (!expiresAt) {
        setTimeRemaining(0);
        return;
      }
      
      const remaining = Math.floor((expiresAt - now) / 1000);

      if (remaining <= 0) {
        setTimeRemaining(0);
        setIsExpired(true);
        setQrCodeDataURL(null);
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
          intervalRef.current = null;
        }
        if (!hasCalledOnExpire.current) {
          hasCalledOnExpire.current = true;
          onExpire?.();
        }
      } else {
        setTimeRemaining(remaining);
      }
    };

    // Update immediately
    updateTimeRemaining();

    // Update every second
    intervalRef.current = setInterval(updateTimeRemaining, 1000);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [qrData, isExpired, onExpire]);

  // No data or expired
  if (!qrData || isExpired) {
    return null;
  }

  // Calculate progress percentage for visual indicator
  const totalTTL = qrData.type === 'CHAIN_ENTRY' || qrData.type === 'CHAIN_EXIT' ? 20 : 60;
  const progressPercentage = (timeRemaining / totalTTL) * 100;

  // Determine urgency level for styling
  const urgencyLevel =
    timeRemaining <= 5 ? 'critical' : timeRemaining <= 10 ? 'warning' : 'normal';

  return (
    <div className={`qr-display ${className}`}>
      <div className="qr-display-container">
        {/* Token Type Label */}
        <div className="token-type-label">
          <h3>{getTokenTypeLabel(qrData.type)}</h3>
        </div>

        {/* Holder Info (for chain tokens) */}
        {showHolderInfo && 'holderId' in qrData && (
          <div className="holder-info">
            <p className="holder-label">You are the current holder</p>
            <p className="holder-instruction">Show this QR code to another student to scan</p>
          </div>
        )}

        {/* QR Code */}
        {qrCodeDataURL && (
          <div className="qr-code-wrapper">
            <Image src={qrCodeDataURL} alt="QR Code" className="qr-code-image" width={size} height={size} />
          </div>
        )}

        {/* Countdown Timer */}
        <div className={`countdown-timer ${urgencyLevel}`}>
          <div className="timer-label">Time Remaining</div>
          <div className="timer-value">{formatTime(timeRemaining)}</div>
          <div className="timer-progress-bar">
            <div
              className="timer-progress-fill"
              style={{ width: `${progressPercentage}%` }}
            />
          </div>
        </div>

        {/* Warning for low time */}
        {urgencyLevel === 'critical' && (
          <div className="expiry-warning">
            <p>⚠️ QR code expiring soon!</p>
          </div>
        )}
      </div>

      <style jsx>{`
        .qr-display {
          width: 100%;
          display: flex;
          flex-direction: column;
          align-items: center;
          padding: 1rem;
        }

        .qr-display-container {
          width: 100%;
          max-width: 400px;
          background: white;
          border-radius: 12px;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
          padding: 1.5rem;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 1rem;
        }

        .token-type-label {
          text-align: center;
          width: 100%;
        }

        .token-type-label h3 {
          margin: 0;
          font-size: 1.25rem;
          font-weight: 600;
          color: #0078d4;
        }

        .holder-info {
          text-align: center;
          padding: 0.75rem;
          background: #f0f8ff;
          border-radius: 8px;
          width: 100%;
        }

        .holder-label {
          margin: 0 0 0.25rem 0;
          font-weight: 600;
          color: #0078d4;
          font-size: 0.95rem;
        }

        .holder-instruction {
          margin: 0;
          font-size: 0.85rem;
          color: #666;
        }

        .qr-code-wrapper {
          width: 100%;
          display: flex;
          justify-content: center;
          padding: 1rem;
          background: white;
          border: 2px solid #e0e0e0;
          border-radius: 8px;
        }

        .qr-code-image {
          width: 100%;
          max-width: ${size}px;
          height: auto;
          display: block;
        }

        .countdown-timer {
          width: 100%;
          text-align: center;
          padding: 1rem;
          border-radius: 8px;
          transition: all 0.3s ease;
        }

        .countdown-timer.normal {
          background: #e8f5e9;
          border: 2px solid #4caf50;
        }

        .countdown-timer.warning {
          background: #fff3e0;
          border: 2px solid #ff9800;
        }

        .countdown-timer.critical {
          background: #ffebee;
          border: 2px solid #f44336;
          animation: pulse 1s infinite;
        }

        @keyframes pulse {
          0%, 100% {
            transform: scale(1);
          }
          50% {
            transform: scale(1.02);
          }
        }

        .timer-label {
          font-size: 0.85rem;
          font-weight: 500;
          color: #666;
          margin-bottom: 0.25rem;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        .timer-value {
          font-size: 2rem;
          font-weight: 700;
          margin-bottom: 0.5rem;
        }

        .countdown-timer.normal .timer-value {
          color: #4caf50;
        }

        .countdown-timer.warning .timer-value {
          color: #ff9800;
        }

        .countdown-timer.critical .timer-value {
          color: #f44336;
        }

        .timer-progress-bar {
          width: 100%;
          height: 8px;
          background: rgba(0, 0, 0, 0.1);
          border-radius: 4px;
          overflow: hidden;
        }

        .timer-progress-fill {
          height: 100%;
          transition: width 1s linear;
          border-radius: 4px;
        }

        .countdown-timer.normal .timer-progress-fill {
          background: #4caf50;
        }

        .countdown-timer.warning .timer-progress-fill {
          background: #ff9800;
        }

        .countdown-timer.critical .timer-progress-fill {
          background: #f44336;
        }

        .expiry-warning {
          width: 100%;
          padding: 0.75rem;
          background: #ffebee;
          border: 1px solid #f44336;
          border-radius: 6px;
          text-align: center;
        }

        .expiry-warning p {
          margin: 0;
          color: #c62828;
          font-weight: 600;
          font-size: 0.9rem;
        }

        @media (max-width: 480px) {
          .qr-display-container {
            padding: 1rem;
          }

          .token-type-label h3 {
            font-size: 1.1rem;
          }

          .timer-value {
            font-size: 1.75rem;
          }
        }
      `}</style>
    </div>
  );
}

export default QRDisplay;
