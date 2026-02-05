/**
 * Rotating QR Display Component
 * Feature: qr-chain-attendance
 * Requirements: 4.1, 4.2, 5.1, 5.2
 * 
 * Displays rotating QR codes for late entry and early leave with auto-refresh.
 * Teachers use this component to display QR codes that students scan for:
 * - Late arrivals (after cutoff time)
 * - Early departures (before exit chain period)
 * 
 * Features:
 * - Auto-refresh tokens every 55 seconds (before 60s expiration)
 * - Start/stop early-leave window controls
 * - Countdown timer for current token
 * - Automatic token rotation
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { QRDisplay } from './QRDisplay';
import type { RotatingQRData } from '../types/shared';

export interface RotatingQRDisplayProps {
  /**
   * Session ID for fetching tokens
   */
  sessionId: string;

  /**
   * Type of rotating QR to display
   */
  type: 'LATE_ENTRY' | 'EARLY_LEAVE';

  /**
   * Whether the window is currently active
   * For late entry, this is typically always true after cutoff
   * For early leave, this is controlled by teacher
   */
  isActive?: boolean;

  /**
   * Callback when window is started (early leave only)
   */
  onStart?: () => void;

  /**
   * Callback when window is stopped (early leave only)
   */
  onStop?: () => void;

  /**
   * Callback for errors
   */
  onError?: (error: string) => void;

  /**
   * Custom styling
   */
  className?: string;

  /**
   * Show controls for starting/stopping window (early leave only)
   */
  showControls?: boolean;
}

interface TokenResponse {
  token: RotatingQRData | null;
  active: boolean;
}

/**
 * Rotating QR Display Component
 */
export function RotatingQRDisplay({
  sessionId,
  type,
  isActive = false,
  onStart,
  onStop,
  onError,
  className = '',
  showControls = true,
}: RotatingQRDisplayProps) {
  const [token, setToken] = useState<RotatingQRData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [windowActive, setWindowActive] = useState(isActive);
  const [isStarting, setIsStarting] = useState(false);
  const [isStopping, setIsStopping] = useState(false);

  // Refs for cleanup
  const refreshIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const isMountedRef = useRef(true);

  /**
   * Get the API endpoint for the token type
   */
  const getEndpoint = useCallback(() => {
    return type === 'LATE_ENTRY'
      ? `/api/sessions/${sessionId}/late-qr`
      : `/api/sessions/${sessionId}/early-qr`;
  }, [sessionId, type]);

  /**
   * Fetch current token from backend
   * Requirements: 4.1, 5.1
   */
  const fetchToken = useCallback(async () => {
    if (!isMountedRef.current) return;

    try {
      setLoading(true);
      setError(null);

      const response = await fetch(getEndpoint());

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          errorData.error?.message || `Failed to fetch token: ${response.statusText}`
        );
      }

      const data: TokenResponse = await response.json();

      if (!isMountedRef.current) return;

      // Update token and active state
      setToken(data.token);
      setWindowActive(data.active);

      setError(null);
    } catch (err) {
      if (!isMountedRef.current) return;

      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch token';
      setError(errorMessage);
      setToken(null);

      if (onError) {
        onError(errorMessage);
      }
    } finally {
      if (isMountedRef.current) {
        setLoading(false);
      }
    }
  }, [getEndpoint, onError]);

  /**
   * Start early-leave window
   * Requirements: 5.1
   */
  const handleStart = useCallback(async () => {
    if (type !== 'EARLY_LEAVE') return;

    try {
      setIsStarting(true);
      setError(null);

      const response = await fetch(`/api/sessions/${sessionId}/start-early-leave`, {
        method: 'POST',
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          errorData.error?.message || `Failed to start early-leave window: ${response.statusText}`
        );
      }

      // Fetch the initial token
      await fetchToken();

      if (onStart) {
        onStart();
      }

      setError(null);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to start early-leave window';
      setError(errorMessage);

      if (onError) {
        onError(errorMessage);
      }
    } finally {
      setIsStarting(false);
    }
  }, [type, sessionId, fetchToken, onStart, onError]);

  /**
   * Stop early-leave window
   * Requirements: 5.2
   */
  const handleStop = useCallback(async () => {
    if (type !== 'EARLY_LEAVE') return;

    try {
      setIsStopping(true);
      setError(null);

      const response = await fetch(`/api/sessions/${sessionId}/stop-early-leave`, {
        method: 'POST',
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          errorData.error?.message || `Failed to stop early-leave window: ${response.statusText}`
        );
      }

      // Clear the token
      setToken(null);
      setWindowActive(false);

      if (onStop) {
        onStop();
      }

      setError(null);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to stop early-leave window';
      setError(errorMessage);

      if (onError) {
        onError(errorMessage);
      }
    } finally {
      setIsStopping(false);
    }
  }, [type, sessionId, onStop, onError]);

  /**
   * Handle token expiration - fetch new token
   * Requirements: 4.2, 5.1
   */
  const handleTokenExpire = useCallback(() => {
    if (windowActive) {
      fetchToken();
    }
  }, [windowActive, fetchToken]);

  /**
   * Set up auto-refresh interval
   * Refresh every 55 seconds (before 60s token expiration)
   * Requirements: 4.2, 5.1
   */
  useEffect(() => {
    // Clear any existing interval
    if (refreshIntervalRef.current) {
      clearInterval(refreshIntervalRef.current);
      refreshIntervalRef.current = null;
    }

    // Only set up auto-refresh if window is active
    if (!windowActive) {
      return;
    }

    // Fetch initial token
    fetchToken();

    // Set up refresh interval (55 seconds)
    refreshIntervalRef.current = setInterval(() => {
      fetchToken();
    }, 55000);

    // Cleanup on unmount or when windowActive changes
    return () => {
      if (refreshIntervalRef.current) {
        clearInterval(refreshIntervalRef.current);
        refreshIntervalRef.current = null;
      }
    };
  }, [windowActive, fetchToken]);

  /**
   * Cleanup on unmount
   */
  useEffect(() => {
    isMountedRef.current = true;

    return () => {
      isMountedRef.current = false;
      if (refreshIntervalRef.current) {
        clearInterval(refreshIntervalRef.current);
        refreshIntervalRef.current = null;
      }
    };
  }, []);

  /**
   * Get display title based on type
   */
  const getTitle = () => {
    return type === 'LATE_ENTRY' ? 'Late Entry QR Code' : 'Early Leave QR Code';
  };

  /**
   * Get description based on type
   */
  const getDescription = () => {
    return type === 'LATE_ENTRY'
      ? 'Students arriving late should scan this code to mark their attendance.'
      : 'Students leaving early should scan this code before departing.';
  };

  return (
    <div className={`rotating-qr-display ${className}`}>
      <div className="rotating-qr-container">
        {/* Header */}
        <div className="rotating-qr-header">
          <h2>{getTitle()}</h2>
          <p className="description">{getDescription()}</p>
        </div>

        {/* Error Display */}
        {error && (
          <div className="error-message" role="alert">
            <strong>Error:</strong> {error}
            <button onClick={fetchToken} className="retry-button">
              Retry
            </button>
          </div>
        )}

        {/* Controls (Early Leave Only) */}
        {type === 'EARLY_LEAVE' && showControls && (
          <div className="window-controls">
            {!windowActive ? (
              <button
                onClick={handleStart}
                disabled={isStarting || loading}
                className="control-button start-button"
              >
                {isStarting ? 'Starting...' : 'Start Early-Leave Window'}
              </button>
            ) : (
              <button
                onClick={handleStop}
                disabled={isStopping || loading}
                className="control-button stop-button"
              >
                {isStopping ? 'Stopping...' : 'Stop Early-Leave Window'}
              </button>
            )}
          </div>
        )}

        {/* Status Indicator */}
        <div className={`status-indicator ${windowActive ? 'active' : 'inactive'}`}>
          <span className="status-dot"></span>
          <span className="status-text">
            {windowActive ? 'Window Active' : 'Window Inactive'}
          </span>
        </div>

        {/* QR Code Display */}
        {loading && !token && (
          <div className="loading-state">
            <div className="loading-spinner"></div>
            <p>Loading QR code...</p>
          </div>
        )}

        {!loading && windowActive && !token && !error && (
          <div className="no-token-state">
            <p>Waiting for token...</p>
          </div>
        )}

        {windowActive && token && (
          <div className="qr-display-wrapper">
            <QRDisplay
              qrData={token}
              onExpire={handleTokenExpire}
              showHolderInfo={false}
              size={350}
            />
            <div className="refresh-info">
              <p>🔄 QR code refreshes automatically every 55 seconds</p>
            </div>
          </div>
        )}

        {!windowActive && !loading && (
          <div className="inactive-state">
            <p>
              {type === 'LATE_ENTRY'
                ? 'Late entry window is not active yet.'
                : 'Early-leave window is not active. Click "Start" to begin.'}
            </p>
          </div>
        )}
      </div>

      <style jsx>{`
        .rotating-qr-display {
          width: 100%;
          display: flex;
          flex-direction: column;
          align-items: center;
          padding: 1rem;
        }

        .rotating-qr-container {
          width: 100%;
          max-width: 500px;
          background: white;
          border-radius: 16px;
          box-shadow: 0 4px 20px rgba(0, 0, 0, 0.1);
          padding: 2rem;
          display: flex;
          flex-direction: column;
          gap: 1.5rem;
        }

        .rotating-qr-header {
          text-align: center;
        }

        .rotating-qr-header h2 {
          margin: 0 0 0.5rem 0;
          font-size: 1.5rem;
          font-weight: 700;
          color: #0078d4;
        }

        .description {
          margin: 0;
          font-size: 0.95rem;
          color: #666;
          line-height: 1.5;
        }

        .error-message {
          padding: 1rem;
          background: #ffebee;
          border: 1px solid #f44336;
          border-radius: 8px;
          color: #c62828;
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
        }

        .error-message strong {
          font-weight: 600;
        }

        .retry-button {
          align-self: flex-start;
          padding: 0.5rem 1rem;
          background: #f44336;
          color: white;
          border: none;
          border-radius: 6px;
          font-size: 0.9rem;
          font-weight: 600;
          cursor: pointer;
          transition: background 0.2s;
        }

        .retry-button:hover {
          background: #d32f2f;
        }

        .window-controls {
          display: flex;
          justify-content: center;
          gap: 1rem;
        }

        .control-button {
          padding: 0.75rem 1.5rem;
          border: none;
          border-radius: 8px;
          font-size: 1rem;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
          min-width: 200px;
        }

        .control-button:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .start-button {
          background: #4caf50;
          color: white;
        }

        .start-button:hover:not(:disabled) {
          background: #45a049;
          transform: translateY(-1px);
          box-shadow: 0 4px 8px rgba(76, 175, 80, 0.3);
        }

        .stop-button {
          background: #f44336;
          color: white;
        }

        .stop-button:hover:not(:disabled) {
          background: #d32f2f;
          transform: translateY(-1px);
          box-shadow: 0 4px 8px rgba(244, 67, 54, 0.3);
        }

        .status-indicator {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 0.5rem;
          padding: 0.75rem;
          border-radius: 8px;
          font-weight: 600;
          transition: all 0.3s;
        }

        .status-indicator.active {
          background: #e8f5e9;
          color: #2e7d32;
          border: 2px solid #4caf50;
        }

        .status-indicator.inactive {
          background: #f5f5f5;
          color: #757575;
          border: 2px solid #bdbdbd;
        }

        .status-dot {
          width: 12px;
          height: 12px;
          border-radius: 50%;
          animation: pulse 2s infinite;
        }

        .status-indicator.active .status-dot {
          background: #4caf50;
        }

        .status-indicator.inactive .status-dot {
          background: #bdbdbd;
          animation: none;
        }

        @keyframes pulse {
          0%, 100% {
            opacity: 1;
          }
          50% {
            opacity: 0.5;
          }
        }

        .loading-state,
        .no-token-state,
        .inactive-state {
          text-align: center;
          padding: 3rem 1rem;
          color: #666;
        }

        .loading-spinner {
          width: 40px;
          height: 40px;
          border: 4px solid #f3f3f3;
          border-top: 4px solid #0078d4;
          border-radius: 50%;
          animation: spin 1s linear infinite;
          margin: 0 auto 1rem auto;
        }

        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }

        .qr-display-wrapper {
          display: flex;
          flex-direction: column;
          gap: 1rem;
        }

        .refresh-info {
          text-align: center;
          padding: 0.75rem;
          background: #e3f2fd;
          border-radius: 8px;
          border: 1px solid #2196f3;
        }

        .refresh-info p {
          margin: 0;
          font-size: 0.9rem;
          color: #1565c0;
          font-weight: 500;
        }

        @media (max-width: 600px) {
          .rotating-qr-container {
            padding: 1.5rem;
          }

          .rotating-qr-header h2 {
            font-size: 1.25rem;
          }

          .control-button {
            min-width: 150px;
            font-size: 0.9rem;
            padding: 0.65rem 1.25rem;
          }
        }
      `}</style>
    </div>
  );
}

export default RotatingQRDisplay;
