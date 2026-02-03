/**
 * Error Display Component
 * Feature: qr-chain-attendance
 * Task: 20.2
 * Requirements: 3.5, 3.7, 9.3, 10.1, 10.2
 * 
 * Displays user-friendly error messages with:
 * - Appropriate styling based on error type
 * - Retry button for retryable errors
 * - Cooldown timer for rate limits
 * - Location guidance for location violations
 */

import { useEffect, useState } from 'react';
import type { FormattedError } from '../utils/errorHandling';

export interface ErrorDisplayProps {
  /**
   * Formatted error to display
   */
  error: FormattedError | null;

  /**
   * Whether currently in cooldown
   */
  isInCooldown?: boolean;

  /**
   * Remaining cooldown seconds
   */
  cooldownSeconds?: number;

  /**
   * Callback when retry button is clicked
   */
  onRetry?: () => void;

  /**
   * Callback when dismiss button is clicked
   */
  onDismiss?: () => void;

  /**
   * Custom className
   */
  className?: string;

  /**
   * Whether to show dismiss button
   */
  showDismiss?: boolean;
}

/**
 * Error Display Component
 * Requirements: 3.5, 3.7, 9.3, 10.1, 10.2
 */
export function ErrorDisplay({
  error,
  isInCooldown = false,
  cooldownSeconds = 0,
  onRetry,
  onDismiss,
  className = '',
  showDismiss = true,
}: ErrorDisplayProps) {
  const [isVisible, setIsVisible] = useState(false);

  // Animate in when error appears
  useEffect(() => {
    if (error) {
      setTimeout(() => setIsVisible(true), 10);
    } else {
      setIsVisible(false);
    }
  }, [error]);

  if (!error) {
    return null;
  }

  const handleDismiss = () => {
    setIsVisible(false);
    setTimeout(() => onDismiss?.(), 300); // Wait for animation
  };

  // Determine icon based on error type
  const getIcon = () => {
    switch (error.type) {
      case 'error':
        return '❌';
      case 'warning':
        return '⚠️';
      case 'info':
        return 'ℹ️';
      default:
        return '❌';
    }
  };

  return (
    <div className={`error-display ${error.type} ${isVisible ? 'visible' : ''} ${className}`}>
      <div className="error-content">
        <div className="error-header">
          <span className="error-icon">{getIcon()}</span>
          <h3 className="error-title">{error.title}</h3>
          {showDismiss && (
            <button
              className="dismiss-button"
              onClick={handleDismiss}
              aria-label="Dismiss error"
            >
              ✕
            </button>
          )}
        </div>

        <p className="error-message">{error.message}</p>

        {error.guidance && (
          <div className="error-guidance">
            <strong>What to do:</strong>
            <p>{error.guidance}</p>
          </div>
        )}

        {isInCooldown && cooldownSeconds > 0 && (
          <div className="cooldown-timer">
            <div className="cooldown-progress">
              <div
                className="cooldown-bar"
                style={{
                  width: `${(cooldownSeconds / 60) * 100}%`,
                }}
              />
            </div>
            <p className="cooldown-text">
              Please wait {cooldownSeconds} second{cooldownSeconds !== 1 ? 's' : ''} before trying again
            </p>
          </div>
        )}

        {error.canRetry && onRetry && !isInCooldown && (
          <button className="retry-button" onClick={onRetry}>
            Try Again
          </button>
        )}
      </div>

      <style jsx>{`
        .error-display {
          position: relative;
          margin: 1rem 0;
          padding: 1rem;
          border-radius: 8px;
          border: 2px solid;
          opacity: 0;
          transform: translateY(-10px);
          transition: all 0.3s ease;
        }

        .error-display.visible {
          opacity: 1;
          transform: translateY(0);
        }

        .error-display.error {
          background: #ffebee;
          border-color: #d32f2f;
          color: #b71c1c;
        }

        .error-display.warning {
          background: #fff3e0;
          border-color: #f57c00;
          color: #e65100;
        }

        .error-display.info {
          background: #e3f2fd;
          border-color: #1976d2;
          color: #0d47a1;
        }

        .error-content {
          display: flex;
          flex-direction: column;
          gap: 0.75rem;
        }

        .error-header {
          display: flex;
          align-items: center;
          gap: 0.5rem;
        }

        .error-icon {
          font-size: 1.5rem;
          flex-shrink: 0;
        }

        .error-title {
          flex: 1;
          margin: 0;
          font-size: 1.125rem;
          font-weight: 600;
        }

        .dismiss-button {
          background: none;
          border: none;
          font-size: 1.25rem;
          cursor: pointer;
          padding: 0.25rem;
          opacity: 0.6;
          transition: opacity 0.2s;
          color: inherit;
        }

        .dismiss-button:hover {
          opacity: 1;
        }

        .error-message {
          margin: 0;
          line-height: 1.5;
          white-space: pre-line;
        }

        .error-guidance {
          padding: 0.75rem;
          background: rgba(0, 0, 0, 0.05);
          border-radius: 4px;
          margin-top: 0.5rem;
        }

        .error-guidance strong {
          display: block;
          margin-bottom: 0.5rem;
        }

        .error-guidance p {
          margin: 0;
          line-height: 1.5;
        }

        .cooldown-timer {
          margin-top: 0.5rem;
        }

        .cooldown-progress {
          height: 8px;
          background: rgba(0, 0, 0, 0.1);
          border-radius: 4px;
          overflow: hidden;
          margin-bottom: 0.5rem;
        }

        .cooldown-bar {
          height: 100%;
          background: currentColor;
          transition: width 1s linear;
        }

        .cooldown-text {
          margin: 0;
          font-size: 0.875rem;
          font-weight: 500;
          text-align: center;
        }

        .retry-button {
          align-self: flex-start;
          padding: 0.5rem 1rem;
          background: currentColor;
          color: white;
          border: none;
          border-radius: 4px;
          font-weight: 500;
          cursor: pointer;
          transition: opacity 0.2s;
        }

        .retry-button:hover {
          opacity: 0.9;
        }

        .retry-button:active {
          transform: scale(0.98);
        }

        @media (max-width: 640px) {
          .error-display {
            padding: 0.75rem;
          }

          .error-title {
            font-size: 1rem;
          }

          .error-message {
            font-size: 0.875rem;
          }
        }
      `}</style>
    </div>
  );
}

export default ErrorDisplay;
