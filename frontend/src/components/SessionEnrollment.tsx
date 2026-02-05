/**
 * Session Enrollment Component
 * Feature: qr-chain-attendance
 * Requirements: 13.1
 * 
 * Landing page for students to scan Session_QR codes and join sessions.
 * After successful enrollment, navigates to the session view.
 */

import { useState, useCallback } from 'react';
import { QRScanner } from './QRScanner';
import type { SessionQRData, JoinSessionResponse } from '../types/shared';

export interface SessionEnrollmentProps {
  /**
   * Callback when student successfully joins a session
   * @param sessionId - The session ID that was joined
   */
  onSessionJoined?: (sessionId: string) => void;

  /**
   * Custom styling
   */
  className?: string;
}

/**
 * Session Enrollment Component
 * 
 * Provides a QR scanner for students to scan Session_QR codes.
 * When a valid Session_QR is scanned, calls the join session API
 * and navigates to the session view.
 */
export function SessionEnrollment({
  onSessionJoined,
  className = '',
}: SessionEnrollmentProps) {
  const [isScanning, setIsScanning] = useState(false);
  const [isJoining, setIsJoining] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  /**
   * Handle Session QR scan
   */
  const handleSessionScanned = useCallback(
    async (sessionQRData: SessionQRData) => {
      setIsScanning(false);
      setIsJoining(true);
      setError(null);
      setSuccessMessage(null);

      try {
        // Call join session API
        const response = await fetch(`/api/sessions/${sessionQRData.sessionId}/join`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error?.message || 'Failed to join session');
        }

        const data: JoinSessionResponse = await response.json();

        // Store session ID in local storage
        localStorage.setItem('currentSessionId', sessionQRData.sessionId);

        // Show success message
        setSuccessMessage(data.message || 'Successfully joined session!');

        // Navigate to session view after a short delay
        setTimeout(() => {
          onSessionJoined?.(sessionQRData.sessionId);
        }, 1500);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Failed to join session';
        setError(errorMessage);
        setIsJoining(false);

        // Clear error after 5 seconds
        setTimeout(() => setError(null), 5000);
      }
    },
    [onSessionJoined]
  );

  /**
   * Handle scan error
   */
  const handleScanError = useCallback((errorMessage: string) => {
    setError(errorMessage);
    setIsScanning(false);

    // Clear error after 5 seconds
    setTimeout(() => setError(null), 5000);
  }, []);

  /**
   * Toggle scanning mode
   */
  const toggleScanning = useCallback(() => {
    setIsScanning((prev) => !prev);
    setError(null);
    setSuccessMessage(null);
  }, []);

  return (
    <div className={`session-enrollment ${className}`}>
      {/* Header */}
      <div className="header">
        <div className="header-content">
          <h1>QR Chain Attendance</h1>
          <p className="subtitle">Scan your class session QR code to get started</p>
        </div>
      </div>

      {/* Main Content */}
      <div className="content">
        {/* Messages */}
        {successMessage && (
          <div className="message success">
            <p>✓ {successMessage}</p>
          </div>
        )}

        {error && (
          <div className="message error">
            <p>✗ {error}</p>
          </div>
        )}

        {/* Joining Indicator */}
        {isJoining && (
          <div className="joining-indicator">
            <div className="spinner"></div>
            <p>Joining session...</p>
          </div>
        )}

        {/* Scanner Section */}
        {!isJoining && (
          <div className="scanner-section">
            {!isScanning ? (
              <div className="scan-prompt">
                <div className="icon">📱</div>
                <h2>Ready to Join</h2>
                <p className="instruction">
                  Your teacher will display a QR code at the start of class.
                  Tap the button below to scan it and join the session.
                </p>
                <button onClick={toggleScanning} className="button-primary">
                  📷 Scan Session QR Code
                </button>
              </div>
            ) : (
              <div className="scanner-container">
                <div className="scanner-header">
                  <h2>Scan Session QR Code</h2>
                  <button onClick={toggleScanning} className="button-secondary">
                    Cancel
                  </button>
                </div>
                <QRScanner
                  isActive={isScanning}
                  onSessionScanned={handleSessionScanned}
                  onScanError={handleScanError}
                />
                <p className="scanner-hint">
                  Point your camera at the QR code displayed by your teacher
                </p>
              </div>
            )}
          </div>
        )}

        {/* Instructions */}
        {!isScanning && !isJoining && (
          <div className="instructions">
            <h3>How It Works</h3>
            <ol>
              <li>Your teacher will display a Session QR code at the start of class</li>
              <li>Scan the QR code using the button above</li>
              <li>You'll be enrolled in the session automatically</li>
              <li>Follow the on-screen instructions to mark your attendance</li>
            </ol>
          </div>
        )}
      </div>

      <style jsx>{`
        .session-enrollment {
          width: 100%;
          min-height: 100vh;
          display: flex;
          flex-direction: column;
          background: #f5f5f5;
        }

        .header {
          width: 100%;
          background: linear-gradient(135deg, #0078d4 0%, #005a9e 100%);
          color: white;
          padding: 2rem 1.5rem;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
        }

        .header-content {
          max-width: 800px;
          margin: 0 auto;
          text-align: center;
        }

        .header h1 {
          margin: 0 0 0.5rem 0;
          font-size: 2rem;
          font-weight: 600;
        }

        .subtitle {
          margin: 0;
          font-size: 1.1rem;
          opacity: 0.9;
        }

        .content {
          flex: 1;
          width: 100%;
          max-width: 800px;
          margin: 0 auto;
          padding: 2rem 1rem;
          display: flex;
          flex-direction: column;
          gap: 1.5rem;
        }

        .message {
          padding: 1rem 1.5rem;
          border-radius: 8px;
          font-weight: 500;
        }

        .message.success {
          background: #e8f5e9;
          border-left: 4px solid #4caf50;
          color: #1b5e20;
        }

        .message.error {
          background: #ffebee;
          border-left: 4px solid #f44336;
          color: #b71c1c;
        }

        .message p {
          margin: 0;
        }

        .joining-indicator {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 3rem;
          background: white;
          border-radius: 12px;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
        }

        .spinner {
          width: 50px;
          height: 50px;
          border: 4px solid rgba(0, 120, 212, 0.3);
          border-top-color: #0078d4;
          border-radius: 50%;
          animation: spin 1s linear infinite;
        }

        @keyframes spin {
          to {
            transform: rotate(360deg);
          }
        }

        .joining-indicator p {
          margin-top: 1rem;
          color: #666;
          font-size: 1.1rem;
        }

        .scanner-section {
          background: white;
          border-radius: 12px;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
          overflow: hidden;
        }

        .scan-prompt {
          padding: 3rem 2rem;
          text-align: center;
        }

        .icon {
          font-size: 4rem;
          margin-bottom: 1rem;
        }

        .scan-prompt h2 {
          margin: 0 0 1rem 0;
          font-size: 1.75rem;
          font-weight: 600;
          color: #333;
        }

        .instruction {
          color: #666;
          line-height: 1.6;
          margin-bottom: 2rem;
          font-size: 1.05rem;
        }

        .button-primary {
          padding: 1rem 2rem;
          background: #0078d4;
          color: white;
          border: none;
          border-radius: 8px;
          cursor: pointer;
          font-size: 1.1rem;
          font-weight: 600;
          transition: background 0.2s;
          box-shadow: 0 2px 8px rgba(0, 120, 212, 0.3);
        }

        .button-primary:hover {
          background: #005a9e;
        }

        .button-primary:active {
          transform: translateY(1px);
        }

        .scanner-container {
          padding: 1.5rem;
        }

        .scanner-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 1rem;
        }

        .scanner-header h2 {
          margin: 0;
          font-size: 1.25rem;
          font-weight: 600;
          color: #333;
        }

        .button-secondary {
          padding: 0.5rem 1rem;
          background: #666;
          color: white;
          border: none;
          border-radius: 6px;
          cursor: pointer;
          font-size: 0.9rem;
          font-weight: 500;
          transition: background 0.2s;
        }

        .button-secondary:hover {
          background: #555;
        }

        .scanner-hint {
          text-align: center;
          color: #666;
          margin-top: 1rem;
          font-size: 0.95rem;
        }

        .instructions {
          background: white;
          border-radius: 12px;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
          padding: 2rem;
        }

        .instructions h3 {
          margin: 0 0 1rem 0;
          font-size: 1.25rem;
          font-weight: 600;
          color: #333;
        }

        .instructions ol {
          margin: 0;
          padding-left: 1.5rem;
          color: #666;
          line-height: 1.8;
        }

        .instructions li {
          margin-bottom: 0.75rem;
        }

        @media (max-width: 768px) {
          .header {
            padding: 1.5rem 1rem;
          }

          .header h1 {
            font-size: 1.5rem;
          }

          .subtitle {
            font-size: 1rem;
          }

          .content {
            padding: 1rem;
          }

          .scan-prompt {
            padding: 2rem 1rem;
          }

          .icon {
            font-size: 3rem;
          }

          .scan-prompt h2 {
            font-size: 1.5rem;
          }

          .scanner-header {
            flex-direction: column;
            align-items: flex-start;
            gap: 1rem;
          }
        }
      `}</style>
    </div>
  );
}

export default SessionEnrollment;
