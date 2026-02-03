/**
 * Example usage of SessionEndAndExportControls component
 * Feature: qr-chain-attendance
 */

import React, { useState } from 'react';
import { SessionEndAndExportControls } from './SessionEndAndExportControls';

/**
 * Example 1: Basic usage with active session
 */
export function BasicExample() {
  const [sessionStatus, setSessionStatus] = useState<'ACTIVE' | 'ENDED'>('ACTIVE');
  const [error, setError] = useState<string | null>(null);

  const handleSessionEnded = (finalAttendance: any[]) => {
    console.log('Session ended with final attendance:', finalAttendance);
    setSessionStatus('ENDED');
  };

  const handleError = (errorMessage: string) => {
    console.error('Error:', errorMessage);
    setError(errorMessage);
  };

  return (
    <div style={{ padding: '2rem', maxWidth: '1200px', margin: '0 auto' }}>
      <h1>Session End and Export Controls - Basic Example</h1>
      
      {error && (
        <div style={{ 
          padding: '1rem', 
          background: '#ffebee', 
          border: '1px solid #f44336',
          borderRadius: '8px',
          marginBottom: '1rem',
          color: '#c62828'
        }}>
          <strong>Error:</strong> {error}
        </div>
      )}

      <SessionEndAndExportControls
        sessionId="example-session-123"
        sessionStatus={sessionStatus}
        onSessionEnded={handleSessionEnded}
        onError={handleError}
      />
    </div>
  );
}

/**
 * Example 2: Ended session (no end button)
 */
export function EndedSessionExample() {
  return (
    <div style={{ padding: '2rem', maxWidth: '1200px', margin: '0 auto' }}>
      <h1>Session End and Export Controls - Ended Session</h1>
      <p>This session has already ended. Only export is available.</p>

      <SessionEndAndExportControls
        sessionId="ended-session-456"
        sessionStatus="ENDED"
        onError={(error) => console.error('Error:', error)}
      />
    </div>
  );
}

/**
 * Example 3: With custom error handling
 */
export function CustomErrorHandlingExample() {
  const [errors, setErrors] = useState<string[]>([]);

  const handleError = (errorMessage: string) => {
    setErrors(prev => [...prev, `${new Date().toLocaleTimeString()}: ${errorMessage}`]);
  };

  const clearErrors = () => {
    setErrors([]);
  };

  return (
    <div style={{ padding: '2rem', maxWidth: '1200px', margin: '0 auto' }}>
      <h1>Session End and Export Controls - Custom Error Handling</h1>

      {errors.length > 0 && (
        <div style={{ 
          padding: '1rem', 
          background: '#fff3e0', 
          border: '1px solid #ff9800',
          borderRadius: '8px',
          marginBottom: '1rem'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <strong>Error Log ({errors.length})</strong>
            <button 
              onClick={clearErrors}
              style={{
                padding: '0.5rem 1rem',
                background: '#ff9800',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer'
              }}
            >
              Clear
            </button>
          </div>
          <ul style={{ margin: '0.5rem 0 0 0', paddingLeft: '1.5rem' }}>
            {errors.map((error, index) => (
              <li key={index}>{error}</li>
            ))}
          </ul>
        </div>
      )}

      <SessionEndAndExportControls
        sessionId="error-handling-session-789"
        sessionStatus="ACTIVE"
        onError={handleError}
      />
    </div>
  );
}

/**
 * Example 4: Integration with teacher dashboard
 */
export function DashboardIntegrationExample() {
  const [sessionStatus, setSessionStatus] = useState<'ACTIVE' | 'ENDED'>('ACTIVE');
  const [attendanceCount, setAttendanceCount] = useState<number>(0);
  const [showControls, setShowControls] = useState(true);

  const handleSessionEnded = (finalAttendance: any[]) => {
    console.log('Session ended successfully');
    setSessionStatus('ENDED');
    setAttendanceCount(finalAttendance.length);
    
    // Show notification
    alert(`Session ended! Final attendance computed for ${finalAttendance.length} students.`);
  };

  return (
    <div style={{ padding: '2rem', maxWidth: '1200px', margin: '0 auto' }}>
      <h1>Teacher Dashboard - Session Management</h1>

      {/* Dashboard header */}
      <div style={{ 
        padding: '1.5rem', 
        background: '#f5f5f5', 
        borderRadius: '8px',
        marginBottom: '2rem'
      }}>
        <h2 style={{ margin: '0 0 0.5rem 0' }}>Session: CS101 - Introduction to Programming</h2>
        <div style={{ display: 'flex', gap: '2rem', fontSize: '0.95rem', color: '#666' }}>
          <span>Session ID: dashboard-session-001</span>
          <span>Status: <strong>{sessionStatus}</strong></span>
          {attendanceCount > 0 && <span>Students: <strong>{attendanceCount}</strong></span>}
        </div>
      </div>

      {/* Toggle controls visibility */}
      <div style={{ marginBottom: '1rem' }}>
        <button
          onClick={() => setShowControls(!showControls)}
          style={{
            padding: '0.5rem 1rem',
            background: '#0078d4',
            color: 'white',
            border: 'none',
            borderRadius: '6px',
            cursor: 'pointer'
          }}
        >
          {showControls ? 'Hide' : 'Show'} Session Controls
        </button>
      </div>

      {/* Session controls */}
      {showControls && (
        <SessionEndAndExportControls
          sessionId="dashboard-session-001"
          sessionStatus={sessionStatus}
          onSessionEnded={handleSessionEnded}
          onError={(error) => {
            console.error('Dashboard error:', error);
            alert(`Error: ${error}`);
          }}
        />
      )}

      {/* Additional dashboard content */}
      <div style={{ 
        marginTop: '2rem', 
        padding: '1.5rem', 
        background: '#e3f2fd',
        borderRadius: '8px'
      }}>
        <h3 style={{ margin: '0 0 1rem 0' }}>Dashboard Tips</h3>
        <ul style={{ margin: 0, paddingLeft: '1.5rem' }}>
          <li>End the session when class is complete to compute final attendance</li>
          <li>Export attendance data at any time to download a JSON file</li>
          <li>The final attendance summary shows detailed statistics and records</li>
          <li>Exported data includes all required fields for institutional reporting</li>
        </ul>
      </div>
    </div>
  );
}

/**
 * Example 5: Minimal usage
 */
export function MinimalExample() {
  return (
    <div style={{ padding: '2rem' }}>
      <SessionEndAndExportControls
        sessionId="minimal-session"
        sessionStatus="ACTIVE"
      />
    </div>
  );
}

// Export all examples
export default {
  BasicExample,
  EndedSessionExample,
  CustomErrorHandlingExample,
  DashboardIntegrationExample,
  MinimalExample,
};
