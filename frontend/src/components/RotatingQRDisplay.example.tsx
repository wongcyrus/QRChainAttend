/**
 * Rotating QR Display Component Examples
 * Feature: qr-chain-attendance
 * Requirements: 4.1, 4.2, 5.1, 5.2
 * 
 * This file demonstrates various usage patterns for the RotatingQRDisplay component.
 */

import { useState } from 'react';
import { RotatingQRDisplay } from './RotatingQRDisplay';

/**
 * Example 1: Basic Late Entry Display
 * 
 * Simple late entry QR display that's always active after cutoff time.
 */
export function BasicLateEntryExample() {
  const sessionId = 'session-123';
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="example-container">
      <h2>Example 1: Basic Late Entry Display</h2>
      <p>Displays a rotating QR code for students arriving late.</p>

      {error && (
        <div className="error-banner">
          <strong>Error:</strong> {error}
        </div>
      )}

      <RotatingQRDisplay
        sessionId={sessionId}
        type="LATE_ENTRY"
        isActive={true}
        onError={setError}
      />

      <style jsx>{`
        .example-container {
          padding: 2rem;
          max-width: 600px;
          margin: 0 auto;
        }

        .error-banner {
          padding: 1rem;
          background: #ffebee;
          border: 1px solid #f44336;
          border-radius: 8px;
          margin-bottom: 1rem;
          color: #c62828;
        }
      `}</style>
    </div>
  );
}

/**
 * Example 2: Early Leave with Controls
 * 
 * Early leave display with start/stop controls and activity logging.
 */
export function EarlyLeaveWithControlsExample() {
  const sessionId = 'session-123';
  const [isActive, setIsActive] = useState(false);
  const [activityLog, setActivityLog] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  const handleStart = () => {
    const timestamp = new Date().toLocaleTimeString();
    setActivityLog(prev => [...prev, `✅ Early-leave window started at ${timestamp}`]);
    setIsActive(true);
  };

  const handleStop = () => {
    const timestamp = new Date().toLocaleTimeString();
    setActivityLog(prev => [...prev, `⛔ Early-leave window stopped at ${timestamp}`]);
    setIsActive(false);
  };

  const handleError = (errorMessage: string) => {
    const timestamp = new Date().toLocaleTimeString();
    setActivityLog(prev => [...prev, `❌ Error at ${timestamp}: ${errorMessage}`]);
    setError(errorMessage);
  };

  return (
    <div className="example-container">
      <h2>Example 2: Early Leave with Controls</h2>
      <p>Teacher-controlled early leave window with activity logging.</p>

      <RotatingQRDisplay
        sessionId={sessionId}
        type="EARLY_LEAVE"
        isActive={isActive}
        showControls={true}
        onStart={handleStart}
        onStop={handleStop}
        onError={handleError}
      />

      <div className="activity-log">
        <h3>Activity Log</h3>
        {activityLog.length === 0 ? (
          <p className="empty-log">No activity yet</p>
        ) : (
          <ul>
            {activityLog.map((log, index) => (
              <li key={index}>{log}</li>
            ))}
          </ul>
        )}
      </div>

      <style jsx>{`
        .example-container {
          padding: 2rem;
          max-width: 600px;
          margin: 0 auto;
        }

        .activity-log {
          margin-top: 2rem;
          padding: 1.5rem;
          background: #f5f5f5;
          border-radius: 12px;
        }

        .activity-log h3 {
          margin: 0 0 1rem 0;
          font-size: 1.1rem;
          color: #333;
        }

        .activity-log ul {
          list-style: none;
          padding: 0;
          margin: 0;
        }

        .activity-log li {
          padding: 0.5rem;
          margin-bottom: 0.5rem;
          background: white;
          border-radius: 6px;
          font-size: 0.9rem;
          font-family: monospace;
        }

        .empty-log {
          color: #999;
          font-style: italic;
          margin: 0;
        }
      `}</style>
    </div>
  );
}

/**
 * Example 3: Side-by-Side Display
 * 
 * Display both late entry and early leave QR codes side by side.
 */
export function SideBySideExample() {
  const sessionId = 'session-123';
  const [lateEntryActive] = useState(true);
  const [earlyLeaveActive, setEarlyLeaveActive] = useState(false);

  return (
    <div className="example-container">
      <h2>Example 3: Side-by-Side Display</h2>
      <p>Display both QR types simultaneously for comprehensive attendance tracking.</p>

      <div className="dual-display">
        <div className="qr-column">
          <RotatingQRDisplay
            sessionId={sessionId}
            type="LATE_ENTRY"
            isActive={lateEntryActive}
          />
        </div>

        <div className="qr-column">
          <RotatingQRDisplay
            sessionId={sessionId}
            type="EARLY_LEAVE"
            isActive={earlyLeaveActive}
            showControls={true}
            onStart={() => setEarlyLeaveActive(true)}
            onStop={() => setEarlyLeaveActive(false)}
          />
        </div>
      </div>

      <style jsx>{`
        .example-container {
          padding: 2rem;
          max-width: 1200px;
          margin: 0 auto;
        }

        .dual-display {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 2rem;
          margin-top: 2rem;
        }

        .qr-column {
          min-width: 0;
        }

        @media (max-width: 768px) {
          .dual-display {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </div>
  );
}

/**
 * Example 4: Conditional Display Based on Session State
 * 
 * Show appropriate QR display based on session timing and state.
 */
export function ConditionalDisplayExample() {
  const sessionId = 'session-123';
  
  // Simulated session state
  const [sessionState] = useState({
    hasStarted: true,
    lateCutoffPassed: true,
    exitWindowStarted: false,
    hasEnded: false,
  });

  const shouldShowLateEntry = sessionState.hasStarted && 
                               sessionState.lateCutoffPassed && 
                               !sessionState.hasEnded;

  const canShowEarlyLeave = sessionState.hasStarted && 
                            !sessionState.exitWindowStarted && 
                            !sessionState.hasEnded;

  return (
    <div className="example-container">
      <h2>Example 4: Conditional Display</h2>
      <p>Display QR codes based on session timing and state.</p>

      <div className="session-status">
        <h3>Session Status</h3>
        <ul>
          <li>Started: {sessionState.hasStarted ? '✅' : '❌'}</li>
          <li>Late Cutoff Passed: {sessionState.lateCutoffPassed ? '✅' : '❌'}</li>
          <li>Exit Window Started: {sessionState.exitWindowStarted ? '✅' : '❌'}</li>
          <li>Ended: {sessionState.hasEnded ? '✅' : '❌'}</li>
        </ul>
      </div>

      {shouldShowLateEntry && (
        <div className="qr-section">
          <h3>Late Entry Available</h3>
          <RotatingQRDisplay
            sessionId={sessionId}
            type="LATE_ENTRY"
            isActive={true}
          />
        </div>
      )}

      {canShowEarlyLeave && (
        <div className="qr-section">
          <h3>Early Leave Control</h3>
          <RotatingQRDisplay
            sessionId={sessionId}
            type="EARLY_LEAVE"
            isActive={false}
            showControls={true}
          />
        </div>
      )}

      {!shouldShowLateEntry && !canShowEarlyLeave && (
        <div className="no-qr-message">
          <p>No rotating QR codes available at this time.</p>
        </div>
      )}

      <style jsx>{`
        .example-container {
          padding: 2rem;
          max-width: 600px;
          margin: 0 auto;
        }

        .session-status {
          padding: 1.5rem;
          background: #f5f5f5;
          border-radius: 12px;
          margin-bottom: 2rem;
        }

        .session-status h3 {
          margin: 0 0 1rem 0;
          font-size: 1.1rem;
        }

        .session-status ul {
          list-style: none;
          padding: 0;
          margin: 0;
        }

        .session-status li {
          padding: 0.5rem 0;
          font-size: 0.95rem;
        }

        .qr-section {
          margin-bottom: 2rem;
        }

        .qr-section h3 {
          margin: 0 0 1rem 0;
          font-size: 1.1rem;
          color: #0078d4;
        }

        .no-qr-message {
          padding: 2rem;
          text-align: center;
          background: #f5f5f5;
          border-radius: 12px;
          color: #666;
        }
      `}</style>
    </div>
  );
}

/**
 * Example 5: With Custom Error Handling
 * 
 * Advanced error handling with retry logic and user notifications.
 */
export function CustomErrorHandlingExample() {
  const sessionId = 'session-123';
  const [error, setError] = useState<string | null>(null);
  const [errorCount, setErrorCount] = useState(0);
  const [showNotification, setShowNotification] = useState(false);

  const handleError = (errorMessage: string) => {
    setError(errorMessage);
    setErrorCount(prev => prev + 1);
    setShowNotification(true);

    // Auto-hide notification after 5 seconds
    setTimeout(() => {
      setShowNotification(false);
    }, 5000);

    // Log error for debugging
    console.error('RotatingQRDisplay error:', errorMessage);
  };

  const clearError = () => {
    setError(null);
    setShowNotification(false);
  };

  return (
    <div className="example-container">
      <h2>Example 5: Custom Error Handling</h2>
      <p>Advanced error handling with notifications and retry logic.</p>

      {showNotification && error && (
        <div className="notification error-notification">
          <div className="notification-content">
            <strong>⚠️ Error Occurred</strong>
            <p>{error}</p>
            <button onClick={clearError} className="dismiss-button">
              Dismiss
            </button>
          </div>
        </div>
      )}

      <div className="error-stats">
        <p>Total errors encountered: <strong>{errorCount}</strong></p>
      </div>

      <RotatingQRDisplay
        sessionId={sessionId}
        type="LATE_ENTRY"
        isActive={true}
        onError={handleError}
      />

      <style jsx>{`
        .example-container {
          padding: 2rem;
          max-width: 600px;
          margin: 0 auto;
        }

        .notification {
          position: fixed;
          top: 20px;
          right: 20px;
          max-width: 400px;
          padding: 1.5rem;
          border-radius: 12px;
          box-shadow: 0 4px 20px rgba(0, 0, 0, 0.2);
          animation: slideIn 0.3s ease-out;
          z-index: 1000;
        }

        @keyframes slideIn {
          from {
            transform: translateX(100%);
            opacity: 0;
          }
          to {
            transform: translateX(0);
            opacity: 1;
          }
        }

        .error-notification {
          background: #ffebee;
          border: 2px solid #f44336;
        }

        .notification-content strong {
          display: block;
          margin-bottom: 0.5rem;
          color: #c62828;
          font-size: 1rem;
        }

        .notification-content p {
          margin: 0 0 1rem 0;
          color: #c62828;
          font-size: 0.9rem;
        }

        .dismiss-button {
          padding: 0.5rem 1rem;
          background: #f44336;
          color: white;
          border: none;
          border-radius: 6px;
          font-size: 0.85rem;
          font-weight: 600;
          cursor: pointer;
          transition: background 0.2s;
        }

        .dismiss-button:hover {
          background: #d32f2f;
        }

        .error-stats {
          padding: 1rem;
          background: #f5f5f5;
          border-radius: 8px;
          margin-bottom: 2rem;
          text-align: center;
        }

        .error-stats p {
          margin: 0;
          font-size: 0.95rem;
          color: #666;
        }

        .error-stats strong {
          color: #f44336;
          font-size: 1.2rem;
        }
      `}</style>
    </div>
  );
}

/**
 * Example 6: Complete Teacher Dashboard Integration
 * 
 * Full integration example showing how to use RotatingQRDisplay
 * within a complete teacher dashboard.
 */
export function CompleteDashboardExample() {
  const sessionId = 'session-123';
  const [earlyLeaveActive, setEarlyLeaveActive] = useState(false);
  const [stats] = useState({
    totalStudents: 45,
    presentEntry: 38,
    lateEntry: 5,
    earlyLeave: 2,
  });

  return (
    <div className="dashboard-container">
      <header className="dashboard-header">
        <h1>Teacher Dashboard</h1>
        <div className="session-info">
          <span>Session: CS101-A</span>
          <span className="status-badge active">Active</span>
        </div>
      </header>

      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-value">{stats.totalStudents}</div>
          <div className="stat-label">Total Students</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{stats.presentEntry}</div>
          <div className="stat-label">Present Entry</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{stats.lateEntry}</div>
          <div className="stat-label">Late Entry</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{stats.earlyLeave}</div>
          <div className="stat-label">Early Leave</div>
        </div>
      </div>

      <div className="qr-sections">
        <section className="qr-section">
          <h2>Late Arrivals</h2>
          <RotatingQRDisplay
            sessionId={sessionId}
            type="LATE_ENTRY"
            isActive={true}
          />
        </section>

        <section className="qr-section">
          <h2>Early Departures</h2>
          <RotatingQRDisplay
            sessionId={sessionId}
            type="EARLY_LEAVE"
            isActive={earlyLeaveActive}
            showControls={true}
            onStart={() => setEarlyLeaveActive(true)}
            onStop={() => setEarlyLeaveActive(false)}
          />
        </section>
      </div>

      <style jsx>{`
        .dashboard-container {
          padding: 2rem;
          max-width: 1200px;
          margin: 0 auto;
        }

        .dashboard-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 2rem;
          padding-bottom: 1rem;
          border-bottom: 2px solid #e0e0e0;
        }

        .dashboard-header h1 {
          margin: 0;
          font-size: 2rem;
          color: #0078d4;
        }

        .session-info {
          display: flex;
          gap: 1rem;
          align-items: center;
        }

        .status-badge {
          padding: 0.5rem 1rem;
          border-radius: 20px;
          font-size: 0.85rem;
          font-weight: 600;
        }

        .status-badge.active {
          background: #e8f5e9;
          color: #2e7d32;
        }

        .stats-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: 1.5rem;
          margin-bottom: 3rem;
        }

        .stat-card {
          padding: 1.5rem;
          background: white;
          border-radius: 12px;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
          text-align: center;
        }

        .stat-value {
          font-size: 2.5rem;
          font-weight: 700;
          color: #0078d4;
          margin-bottom: 0.5rem;
        }

        .stat-label {
          font-size: 0.9rem;
          color: #666;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        .qr-sections {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 2rem;
        }

        .qr-section h2 {
          margin: 0 0 1.5rem 0;
          font-size: 1.5rem;
          color: #333;
        }

        @media (max-width: 768px) {
          .dashboard-header {
            flex-direction: column;
            align-items: flex-start;
            gap: 1rem;
          }

          .qr-sections {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </div>
  );
}

/**
 * Export all examples
 */
const examples = {
  BasicLateEntryExample,
  EarlyLeaveWithControlsExample,
  SideBySideExample,
  ConditionalDisplayExample,
  CustomErrorHandlingExample,
  CompleteDashboardExample,
};

export default examples;
