/**
 * Teacher Dashboard Component - Example Usage
 * 
 * This file demonstrates how to use the TeacherDashboard component
 * in various scenarios.
 */

import React, { useState } from 'react';
import { TeacherDashboard } from './TeacherDashboard';

/**
 * Example 1: Basic Usage
 * 
 * Simple dashboard display for a specific session
 */
export function BasicDashboardExample() {
  const sessionId = 'session-123';
  
  return (
    <div>
      <h1>My Class Dashboard</h1>
      <TeacherDashboard sessionId={sessionId} />
    </div>
  );
}

/**
 * Example 2: With Error Handling
 * 
 * Dashboard with custom error handling and logging
 */
export function DashboardWithErrorHandling() {
  const sessionId = 'session-456';
  const [errors, setErrors] = useState<string[]>([]);
  
  const handleError = (error: string) => {
    console.error('Dashboard error:', error);
    setErrors(prev => [...prev, error]);
    
    // Could also send to error tracking service
    // trackError('TeacherDashboard', error);
  };
  
  return (
    <div>
      <h1>Class Monitoring</h1>
      
      {errors.length > 0 && (
        <div className="error-log">
          <h3>Error Log</h3>
          <ul>
            {errors.map((error, index) => (
              <li key={index}>{error}</li>
            ))}
          </ul>
        </div>
      )}
      
      <TeacherDashboard 
        sessionId={sessionId}
        onError={handleError}
      />
    </div>
  );
}

/**
 * Example 3: Multi-Session Dashboard
 * 
 * Teacher monitoring multiple sessions with tabs
 */
export function MultiSessionDashboard() {
  const sessions = [
    { id: 'session-1', name: 'CS101-A Morning' },
    { id: 'session-2', name: 'CS101-B Afternoon' },
    { id: 'session-3', name: 'CS102-A Evening' },
  ];
  
  const [activeSessionId, setActiveSessionId] = useState(sessions[0].id);
  
  return (
    <div className="multi-session-dashboard">
      <h1>All My Classes</h1>
      
      <div className="session-tabs">
        {sessions.map(session => (
          <button
            key={session.id}
            className={activeSessionId === session.id ? 'active' : ''}
            onClick={() => setActiveSessionId(session.id)}
          >
            {session.name}
          </button>
        ))}
      </div>
      
      <TeacherDashboard sessionId={activeSessionId} />
    </div>
  );
}

/**
 * Example 4: Dashboard with Session Controls
 * 
 * Integrated dashboard with chain management controls
 */
export function DashboardWithControls() {
  const sessionId = 'session-789';
  const [refreshKey, setRefreshKey] = useState(0);
  
  const handleSeedChains = async (count: number) => {
    try {
      const response = await fetch(`/api/sessions/${sessionId}/seed-entry?count=${count}`, {
        method: 'POST',
      });
      
      if (!response.ok) {
        throw new Error('Failed to seed chains');
      }
      
      // Force dashboard refresh
      setRefreshKey(prev => prev + 1);
      
      alert(`Successfully seeded ${count} entry chains`);
    } catch (error) {
      alert('Error seeding chains: ' + (error as Error).message);
    }
  };
  
  const handleStartExitChains = async (count: number) => {
    try {
      const response = await fetch(`/api/sessions/${sessionId}/start-exit-chain?count=${count}`, {
        method: 'POST',
      });
      
      if (!response.ok) {
        throw new Error('Failed to start exit chains');
      }
      
      setRefreshKey(prev => prev + 1);
      
      alert(`Successfully started ${count} exit chains`);
    } catch (error) {
      alert('Error starting exit chains: ' + (error as Error).message);
    }
  };
  
  const handleEndSession = async () => {
    if (!confirm('Are you sure you want to end this session?')) {
      return;
    }
    
    try {
      const response = await fetch(`/api/sessions/${sessionId}/end`, {
        method: 'POST',
      });
      
      if (!response.ok) {
        throw new Error('Failed to end session');
      }
      
      const data = await response.json();
      
      alert(`Session ended. Final attendance computed for ${data.finalAttendance.length} students.`);
      
      setRefreshKey(prev => prev + 1);
    } catch (error) {
      alert('Error ending session: ' + (error as Error).message);
    }
  };
  
  return (
    <div className="dashboard-with-controls">
      <h1>Class Dashboard with Controls</h1>
      
      <div className="control-panel">
        <div className="control-group">
          <h3>Entry Chains</h3>
          <button onClick={() => handleSeedChains(3)}>
            Seed 3 Entry Chains
          </button>
          <button onClick={() => handleSeedChains(5)}>
            Seed 5 Entry Chains
          </button>
        </div>
        
        <div className="control-group">
          <h3>Exit Chains</h3>
          <button onClick={() => handleStartExitChains(3)}>
            Start 3 Exit Chains
          </button>
          <button onClick={() => handleStartExitChains(5)}>
            Start 5 Exit Chains
          </button>
        </div>
        
        <div className="control-group">
          <h3>Session Control</h3>
          <button onClick={handleEndSession} className="danger">
            End Session
          </button>
        </div>
      </div>
      
      <TeacherDashboard 
        key={refreshKey}
        sessionId={sessionId}
      />
    </div>
  );
}

/**
 * Example 5: Dashboard with Notifications
 * 
 * Dashboard that shows toast notifications for important events
 */
export function DashboardWithNotifications() {
  const sessionId = 'session-999';
  const [notifications, setNotifications] = useState<Array<{
    id: number;
    message: string;
    type: 'info' | 'warning' | 'error';
  }>>([]);
  
  const addNotification = (message: string, type: 'info' | 'warning' | 'error') => {
    const id = Date.now();
    setNotifications(prev => [...prev, { id, message, type }]);
    
    // Auto-remove after 5 seconds
    setTimeout(() => {
      setNotifications(prev => prev.filter(n => n.id !== id));
    }, 5000);
  };
  
  const handleError = (error: string) => {
    addNotification(error, 'error');
  };
  
  return (
    <div className="dashboard-with-notifications">
      <h1>Class Dashboard</h1>
      
      {/* Notification Toast Container */}
      <div className="notification-container">
        {notifications.map(notification => (
          <div 
            key={notification.id}
            className={`notification ${notification.type}`}
          >
            {notification.message}
            <button onClick={() => 
              setNotifications(prev => prev.filter(n => n.id !== notification.id))
            }>
              ×
            </button>
          </div>
        ))}
      </div>
      
      <TeacherDashboard 
        sessionId={sessionId}
        onError={handleError}
      />
    </div>
  );
}

/**
 * Example 6: Responsive Dashboard
 * 
 * Dashboard that adapts to different screen sizes
 */
export function ResponsiveDashboard() {
  const sessionId = 'session-responsive';
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  
  React.useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768);
    };
    
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);
  
  return (
    <div className={`responsive-dashboard ${isMobile ? 'mobile' : 'desktop'}`}>
      <h1>{isMobile ? 'Dashboard' : 'Teacher Dashboard'}</h1>
      
      {isMobile && (
        <div className="mobile-notice">
          <p>📱 Mobile view - Swipe to see more details</p>
        </div>
      )}
      
      <TeacherDashboard sessionId={sessionId} />
    </div>
  );
}

/**
 * Example 7: Dashboard with Auto-Refresh
 * 
 * Dashboard that periodically refreshes data as a fallback
 */
export function DashboardWithAutoRefresh() {
  const sessionId = 'session-auto-refresh';
  const [refreshKey, setRefreshKey] = useState(0);
  const [autoRefresh, setAutoRefresh] = useState(true);
  
  React.useEffect(() => {
    if (!autoRefresh) return;
    
    // Refresh every 30 seconds as fallback
    const interval = setInterval(() => {
      setRefreshKey(prev => prev + 1);
    }, 30000);
    
    return () => clearInterval(interval);
  }, [autoRefresh]);
  
  return (
    <div className="dashboard-with-auto-refresh">
      <div className="header">
        <h1>Class Dashboard</h1>
        <label>
          <input
            type="checkbox"
            checked={autoRefresh}
            onChange={(e) => setAutoRefresh(e.target.checked)}
          />
          Auto-refresh every 30s
        </label>
      </div>
      
      <TeacherDashboard 
        key={refreshKey}
        sessionId={sessionId}
      />
    </div>
  );
}

/**
 * Example 8: Dashboard with Export
 * 
 * Dashboard with attendance export functionality
 */
export function DashboardWithExport() {
  const sessionId = 'session-export';
  
  const handleExport = async () => {
    try {
      const response = await fetch(`/api/sessions/${sessionId}/attendance`);
      
      if (!response.ok) {
        throw new Error('Failed to fetch attendance data');
      }
      
      const data = await response.json();
      
      // Convert to CSV
      const csv = convertToCSV(data.attendance);
      
      // Download file
      const blob = new Blob([csv], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `attendance-${sessionId}-${Date.now()}.csv`;
      a.click();
      window.URL.revokeObjectURL(url);
      
      alert('Attendance data exported successfully');
    } catch (error) {
      alert('Error exporting data: ' + (error as Error).message);
    }
  };
  
  const convertToCSV = (attendance: any[]): string => {
    const headers = ['Student ID', 'Entry Status', 'Entry Time', 'Exit Verified', 'Exit Time', 'Early Leave', 'Final Status'];
    const rows = attendance.map(record => [
      record.studentId,
      record.entryStatus || '',
      record.entryAt ? new Date(record.entryAt * 1000).toISOString() : '',
      record.exitVerified ? 'Yes' : 'No',
      record.exitVerifiedAt ? new Date(record.exitVerifiedAt * 1000).toISOString() : '',
      record.earlyLeaveAt ? new Date(record.earlyLeaveAt * 1000).toISOString() : '',
      record.finalStatus || '',
    ]);
    
    return [headers, ...rows].map(row => row.join(',')).join('\n');
  };
  
  return (
    <div className="dashboard-with-export">
      <div className="header">
        <h1>Class Dashboard</h1>
        <button onClick={handleExport} className="export-button">
          📥 Export Attendance
        </button>
      </div>
      
      <TeacherDashboard sessionId={sessionId} />
    </div>
  );
}
