/**
 * OfflineIndicator Component
 * Feature: qr-chain-attendance
 * Requirement: 20.5 - Offline message display and handling
 * 
 * Displays a banner when the user is offline, providing clear feedback
 * about network connectivity status.
 */

import React, { useEffect, useState } from 'react';
import { useOnlineStatus } from '../hooks/useOnlineStatus';

export interface OfflineIndicatorProps {
  /**
   * Position of the indicator
   * @default 'top'
   */
  position?: 'top' | 'bottom';
  
  /**
   * Show reconnection message when connection is restored
   * @default true
   */
  showReconnectionMessage?: boolean;
  
  /**
   * Duration to show reconnection message (ms)
   * @default 3000
   */
  reconnectionMessageDuration?: number;
}

/**
 * OfflineIndicator - Displays network connectivity status
 * 
 * Shows a prominent banner when offline and optionally shows a success
 * message when connection is restored.
 * 
 * @example
 * ```tsx
 * // In your app layout
 * <OfflineIndicator position="top" />
 * ```
 */
export const OfflineIndicator: React.FC<OfflineIndicatorProps> = ({
  position = 'top',
  showReconnectionMessage = true,
  reconnectionMessageDuration = 3000,
}) => {
  const { isOnline, wasOffline } = useOnlineStatus();
  const [showReconnected, setShowReconnected] = useState(false);
  const [mounted, setMounted] = useState(false);

  // Ensure component only renders on client
  useEffect(() => {
    setMounted(true);
  }, []);

  // Handle reconnection message
  useEffect(() => {
    if (isOnline && wasOffline && showReconnectionMessage) {
      setShowReconnected(true);
      const timer = setTimeout(() => {
        setShowReconnected(false);
      }, reconnectionMessageDuration);
      
      return () => clearTimeout(timer);
    }
  }, [isOnline, wasOffline, showReconnectionMessage, reconnectionMessageDuration]);

  // Don't render on server or if online and not showing reconnection message
  if (!mounted || (isOnline && !showReconnected)) {
    return null;
  }

  const positionStyles = position === 'top' 
    ? { top: 0 } 
    : { bottom: 0 };

  return (
    <>
      <style dangerouslySetInnerHTML={{__html: `
        @keyframes slideDown {
          from {
            transform: translateY(-100%);
            opacity: 0;
          }
          to {
            transform: translateY(0);
            opacity: 1;
          }
        }
      `}} />
      <div
        style={{
          position: 'fixed',
          left: 0,
          right: 0,
          zIndex: 9999,
          ...positionStyles,
        }}
        role="alert"
        aria-live="assertive"
      >
        {!isOnline ? (
          // Offline banner
          <div
            style={{
              backgroundColor: '#d32f2f',
              color: 'white',
              padding: '12px 16px',
              textAlign: 'center',
              fontSize: '14px',
              fontWeight: 500,
              boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <line x1="1" y1="1" x2="23" y2="23" />
                <path d="M16.72 11.06A10.94 10.94 0 0 1 19 12.55" />
                <path d="M5 12.55a10.94 10.94 0 0 1 5.17-2.39" />
                <path d="M10.71 5.05A16 16 0 0 1 22.58 9" />
                <path d="M1.42 9a15.91 15.91 0 0 1 4.7-2.88" />
                <path d="M8.53 16.11a6 6 0 0 1 6.95 0" />
                <line x1="12" y1="20" x2="12.01" y2="20" />
              </svg>
              <span>
                <strong>You are offline.</strong> Some features may not be available.
              </span>
            </div>
          </div>
        ) : showReconnected ? (
          // Reconnection success banner
          <div
            style={{
              backgroundColor: '#388e3c',
              color: 'white',
              padding: '12px 16px',
              textAlign: 'center',
              fontSize: '14px',
              fontWeight: 500,
              boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
              animation: 'slideDown 0.3s ease-out',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <polyline points="20 6 9 17 4 12" />
              </svg>
              <span>
                <strong>Connection restored!</strong> You are back online.
              </span>
            </div>
          </div>
        ) : null}
      </div>
    </>
  );
};

export default OfflineIndicator;
