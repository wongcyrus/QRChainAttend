/**
 * useOnlineStatus Hook
 * Feature: qr-chain-attendance
 * Requirement: 20.5 - Offline message display and handling
 * 
 * Detects network connectivity status and provides real-time updates
 * when the connection is lost or restored.
 */

import { useState, useEffect } from 'react';

export interface OnlineStatus {
  isOnline: boolean;
  wasOffline: boolean; // Track if user was offline (for showing reconnection messages)
}

/**
 * Custom hook to detect and monitor network connectivity
 * 
 * @returns {OnlineStatus} Current online status and offline history
 * 
 * @example
 * ```tsx
 * const { isOnline, wasOffline } = useOnlineStatus();
 * 
 * if (!isOnline) {
 *   return <OfflineMessage />;
 * }
 * 
 * if (wasOffline) {
 *   showToast('Connection restored!');
 * }
 * ```
 */
export function useOnlineStatus(): OnlineStatus {
  // Initialize with current navigator.onLine status
  const [isOnline, setIsOnline] = useState<boolean>(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );
  
  // Track if user was offline (to show reconnection messages)
  const [wasOffline, setWasOffline] = useState<boolean>(false);

  useEffect(() => {
    // Only run in browser environment
    if (typeof window === 'undefined') {
      return;
    }

    /**
     * Handle online event
     * Fired when the browser gains network connectivity
     */
    const handleOnline = () => {
      console.log('[Offline Handler] Connection restored');
      setIsOnline(true);
      // Don't immediately clear wasOffline - let components handle it
    };

    /**
     * Handle offline event
     * Fired when the browser loses network connectivity
     */
    const handleOffline = () => {
      console.log('[Offline Handler] Connection lost');
      setIsOnline(false);
      setWasOffline(true);
    };

    // Add event listeners
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Cleanup event listeners on unmount
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return { isOnline, wasOffline };
}

/**
 * Hook variant that provides a callback when connection status changes
 * 
 * @param onStatusChange - Callback fired when online status changes
 * 
 * @example
 * ```tsx
 * useOnlineStatusCallback((isOnline) => {
 *   if (isOnline) {
 *     retryFailedRequests();
 *   } else {
 *     showOfflineNotification();
 *   }
 * });
 * ```
 */
export function useOnlineStatusCallback(
  onStatusChange: (isOnline: boolean) => void
): OnlineStatus {
  const status = useOnlineStatus();

  useEffect(() => {
    onStatusChange(status.isOnline);
  }, [status.isOnline, onStatusChange]);

  return status;
}
