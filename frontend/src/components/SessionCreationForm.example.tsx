/**
 * Example usage of SessionCreationForm component
 * 
 * This file demonstrates various ways to use the SessionCreationForm
 * in different scenarios.
 */

import React from 'react';
import { SessionCreationForm } from './SessionCreationForm';

/**
 * Example 1: Basic usage without callback
 * 
 * The simplest way to use the component. The form will display
 * the QR code after successful creation, but won't trigger any
 * additional actions.
 */
export function BasicExample() {
  return (
    <div className="teacher-dashboard">
      <h1>Create New Session</h1>
      <SessionCreationForm />
    </div>
  );
}

/**
 * Example 2: With navigation callback
 * 
 * After creating a session, navigate to the session dashboard
 * to manage the session in real-time.
 */
export function WithNavigationExample() {
  const handleSessionCreated = (sessionId: string) => {
    console.log('Session created:', sessionId);
    // In a real app, you would use a router here
    // router.push(`/sessions/${sessionId}/dashboard`);
    window.location.href = `/sessions/${sessionId}/dashboard`;
  };

  return (
    <div className="create-session-page">
      <header>
        <h1>Create New Attendance Session</h1>
        <p>Fill in the details below to create a new session for your class.</p>
      </header>
      <SessionCreationForm onSessionCreated={handleSessionCreated} />
    </div>
  );
}

/**
 * Example 3: With state management
 * 
 * Track created sessions in parent component state for
 * displaying a list or performing additional operations.
 */
export function WithStateManagementExample() {
  const [createdSessions, setCreatedSessions] = React.useState<string[]>([]);

  const handleSessionCreated = (sessionId: string) => {
    setCreatedSessions((prev) => [...prev, sessionId]);
    console.log('Total sessions created:', createdSessions.length + 1);
  };

  return (
    <div className="session-management">
      <div className="session-list">
        <h2>Created Sessions</h2>
        {createdSessions.length === 0 ? (
          <p>No sessions created yet.</p>
        ) : (
          <ul>
            {createdSessions.map((sessionId) => (
              <li key={sessionId}>
                <a href={`/sessions/${sessionId}`}>{sessionId}</a>
              </li>
            ))}
          </ul>
        )}
      </div>
      
      <div className="create-new">
        <h2>Create New Session</h2>
        <SessionCreationForm onSessionCreated={handleSessionCreated} />
      </div>
    </div>
  );
}

/**
 * Example 4: With analytics tracking
 * 
 * Track session creation events for analytics purposes.
 */
export function WithAnalyticsExample() {
  const handleSessionCreated = (sessionId: string) => {
    // Track in analytics
    if (typeof window !== 'undefined' && (window as any).gtag) {
      (window as any).gtag('event', 'session_created', {
        session_id: sessionId,
        timestamp: new Date().toISOString(),
      });
    }
    
    // Show success notification
    alert(`Session ${sessionId} created successfully!`);
  };

  return (
    <div className="analytics-tracked-form">
      <SessionCreationForm onSessionCreated={handleSessionCreated} />
    </div>
  );
}

/**
 * Example 5: In a modal/dialog
 * 
 * Use the form in a modal dialog that can be opened/closed.
 */
export function InModalExample() {
  const [isOpen, setIsOpen] = React.useState(false);

  const handleSessionCreated = (sessionId: string) => {
    console.log('Session created:', sessionId);
    // Close modal after a delay to show the QR code
    setTimeout(() => {
      setIsOpen(false);
    }, 5000);
  };

  return (
    <div>
      <button onClick={() => setIsOpen(true)}>
        Create New Session
      </button>
      
      {isOpen && (
        <div className="modal-overlay" onClick={() => setIsOpen(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <button 
              className="close-button"
              onClick={() => setIsOpen(false)}
            >
              ×
            </button>
            <SessionCreationForm onSessionCreated={handleSessionCreated} />
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Example 6: With pre-filled defaults
 * 
 * While the component doesn't accept default values as props,
 * you could wrap it to provide a customized version with
 * specific defaults for your use case.
 */
export function WithDefaultsExample() {
  // Note: This is a conceptual example. The actual component
  // would need to be modified to accept default values as props.
  
  return (
    <div className="quick-create">
      <h2>Quick Create Session</h2>
      <p>Create a session for today's class with standard settings.</p>
      <SessionCreationForm />
      <div className="help-text">
        <p><strong>Tip:</strong> Use the following standard settings:</p>
        <ul>
          <li>Late Cutoff: 15 minutes</li>
          <li>Exit Window: 10 minutes</li>
          <li>Enable geofence for classroom location</li>
        </ul>
      </div>
    </div>
  );
}

/**
 * Example 7: Multi-step wizard
 * 
 * Use the form as part of a larger multi-step process.
 */
export function MultiStepWizardExample() {
  const [step, setStep] = React.useState(1);
  const [sessionId, setSessionId] = React.useState<string | null>(null);

  const handleSessionCreated = (id: string) => {
    setSessionId(id);
    setStep(2);
  };

  return (
    <div className="wizard">
      <div className="wizard-steps">
        <div className={step === 1 ? 'active' : ''}>1. Create Session</div>
        <div className={step === 2 ? 'active' : ''}>2. Configure Chains</div>
        <div className={step === 3 ? 'active' : ''}>3. Start Session</div>
      </div>
      
      {step === 1 && (
        <SessionCreationForm onSessionCreated={handleSessionCreated} />
      )}
      
      {step === 2 && sessionId && (
        <div>
          <h2>Configure Entry Chains</h2>
          <p>Session ID: {sessionId}</p>
          <button onClick={() => setStep(3)}>Next</button>
        </div>
      )}
      
      {step === 3 && sessionId && (
        <div>
          <h2>Session Ready</h2>
          <p>Your session is ready to start!</p>
          <a href={`/sessions/${sessionId}/dashboard`}>Go to Dashboard</a>
        </div>
      )}
    </div>
  );
}

/**
 * Example 8: With error boundary
 * 
 * Wrap the form in an error boundary for better error handling.
 */
class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('SessionCreationForm error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="error-boundary">
          <h2>Something went wrong</h2>
          <p>Please refresh the page and try again.</p>
        </div>
      );
    }

    return this.props.children;
  }
}

export function WithErrorBoundaryExample() {
  return (
    <ErrorBoundary>
      <SessionCreationForm />
    </ErrorBoundary>
  );
}

/**
 * Example 9: Responsive layout
 * 
 * Use the form in a responsive layout that adapts to screen size.
 */
export function ResponsiveLayoutExample() {
  return (
    <div className="responsive-container">
      <div className="sidebar">
        <h3>Quick Tips</h3>
        <ul>
          <li>Set start time to when class begins</li>
          <li>Late cutoff is typically 10-15 minutes</li>
          <li>Enable geofence for in-person classes</li>
          <li>Use Wi-Fi allowlist for additional security</li>
        </ul>
      </div>
      
      <div className="main-content">
        <SessionCreationForm />
      </div>
    </div>
  );
}

/**
 * Example 10: With loading indicator
 * 
 * Show a loading state while the form is being prepared.
 */
export function WithLoadingExample() {
  const [isReady, setIsReady] = React.useState(false);

  React.useEffect(() => {
    // Simulate loading teacher data or permissions
    setTimeout(() => {
      setIsReady(true);
    }, 1000);
  }, []);

  if (!isReady) {
    return (
      <div className="loading-container">
        <div className="spinner" />
        <p>Loading session creation form...</p>
      </div>
    );
  }

  return <SessionCreationForm />;
}
