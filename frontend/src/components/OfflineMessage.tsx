/**
 * OfflineMessage Component
 * Feature: qr-chain-attendance
 * Requirement: 20.5 - Offline message display and handling
 * 
 * Displays a user-friendly message when a network operation cannot be
 * performed due to offline status.
 */

import React from 'react';

export interface OfflineMessageProps {
  /**
   * Title of the message
   * @default 'Network Connection Required'
   */
  title?: string;
  
  /**
   * Description of what requires network
   * @default 'This feature requires an active internet connection.'
   */
  message?: string;
  
  /**
   * Show retry button
   * @default false
   */
  showRetry?: boolean;
  
  /**
   * Callback when retry button is clicked
   */
  onRetry?: () => void;
  
  /**
   * Additional CSS class name
   */
  className?: string;
  
  /**
   * Variant style
   * @default 'card'
   */
  variant?: 'card' | 'inline' | 'banner';
}

/**
 * OfflineMessage - Displays a message when network is required
 * 
 * Use this component to show users when a specific feature or operation
 * requires network connectivity.
 * 
 * @example
 * ```tsx
 * const { isOnline } = useOnlineStatus();
 * 
 * if (!isOnline) {
 *   return (
 *     <OfflineMessage
 *       title="Cannot Scan QR Code"
 *       message="Scanning QR codes requires an active internet connection to verify attendance."
 *       showRetry
 *       onRetry={handleRetry}
 *     />
 *   );
 * }
 * ```
 */
export const OfflineMessage: React.FC<OfflineMessageProps> = ({
  title = 'Network Connection Required',
  message = 'This feature requires an active internet connection.',
  showRetry = false,
  onRetry,
  className = '',
  variant = 'card',
}) => {
  const styles = getVariantStyles(variant);

  return (
    <div
      className={className}
      style={styles.container}
      role="alert"
      aria-live="polite"
    >
      <div style={styles.iconContainer}>
        <svg
          width="48"
          height="48"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{ color: '#f57c00' }}
        >
          <line x1="1" y1="1" x2="23" y2="23" />
          <path d="M16.72 11.06A10.94 10.94 0 0 1 19 12.55" />
          <path d="M5 12.55a10.94 10.94 0 0 1 5.17-2.39" />
          <path d="M10.71 5.05A16 16 0 0 1 22.58 9" />
          <path d="M1.42 9a15.91 15.91 0 0 1 4.7-2.88" />
          <path d="M8.53 16.11a6 6 0 0 1 6.95 0" />
          <line x1="12" y1="20" x2="12.01" y2="20" />
        </svg>
      </div>
      
      <div style={styles.content}>
        <h3 style={styles.title}>{title}</h3>
        <p style={styles.message}>{message}</p>
        
        {showRetry && onRetry && (
          <button
            onClick={onRetry}
            style={styles.retryButton}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = '#0056b3';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = '#0078d4';
            }}
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{ marginRight: '8px' }}
            >
              <polyline points="23 4 23 10 17 10" />
              <polyline points="1 20 1 14 7 14" />
              <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
            </svg>
            Retry
          </button>
        )}
      </div>
    </div>
  );
};

/**
 * Get styles based on variant
 */
function getVariantStyles(variant: 'card' | 'inline' | 'banner') {
  const baseStyles = {
    container: {
      display: 'flex',
      alignItems: 'center',
      gap: '16px',
    },
    iconContainer: {
      flexShrink: 0,
    },
    content: {
      flex: 1,
    },
    title: {
      margin: '0 0 8px 0',
      fontSize: '18px',
      fontWeight: 600,
      color: '#212121',
    },
    message: {
      margin: '0 0 16px 0',
      fontSize: '14px',
      color: '#666',
      lineHeight: '1.5',
    },
    retryButton: {
      display: 'inline-flex',
      alignItems: 'center',
      padding: '8px 16px',
      backgroundColor: '#0078d4',
      color: 'white',
      border: 'none',
      borderRadius: '4px',
      fontSize: '14px',
      fontWeight: 500,
      cursor: 'pointer',
      transition: 'background-color 0.2s',
    },
  };

  if (variant === 'card') {
    return {
      ...baseStyles,
      container: {
        ...baseStyles.container,
        padding: '24px',
        backgroundColor: '#fff',
        border: '1px solid #e0e0e0',
        borderRadius: '8px',
        boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
      },
    };
  }

  if (variant === 'banner') {
    return {
      ...baseStyles,
      container: {
        ...baseStyles.container,
        padding: '16px',
        backgroundColor: '#fff3e0',
        border: '1px solid #ffb74d',
        borderRadius: '4px',
      },
    };
  }

  // inline variant
  return {
    ...baseStyles,
    container: {
      ...baseStyles.container,
      padding: '16px',
    },
  };
}

export default OfflineMessage;
