/**
 * StudentSessionView Component Examples
 * Feature: qr-chain-attendance
 * 
 * Demonstrates various usage scenarios for the StudentSessionView component
 */

import { StudentSessionView } from './StudentSessionView';
import type { Session } from '@qr-attendance/shared';

/**
 * Example 1: Basic Usage
 * 
 * Minimal setup with required props only
 */
export function BasicExample() {
  const sessionId = 'session-123';
  const studentId = 'student-456';

  return (
    <StudentSessionView
      sessionId={sessionId}
      studentId={studentId}
    />
  );
}

/**
 * Example 2: With Leave Session Callback
 * 
 * Includes navigation callback when student leaves
 */
export function WithLeaveCallback() {
  const sessionId = 'session-123';
  const studentId = 'student-456';

  const handleLeaveSession = () => {
    console.log('Student leaving session');
    // Navigate to session list or home page
    window.location.href = '/sessions';
  };

  return (
    <StudentSessionView
      sessionId={sessionId}
      studentId={studentId}
      onLeaveSession={handleLeaveSession}
    />
  );
}

/**
 * Example 3: With Custom Styling
 * 
 * Applies custom CSS class for styling
 */
export function WithCustomStyling() {
  const sessionId = 'session-123';
  const studentId = 'student-456';

  return (
    <div className="custom-container">
      <StudentSessionView
        sessionId={sessionId}
        studentId={studentId}
        className="custom-session-view"
      />
      <style jsx>{`
        .custom-container {
          background: linear-gradient(to bottom, #e3f2fd, #ffffff);
          min-height: 100vh;
        }
        
        :global(.custom-session-view) {
          /* Custom styles applied to the component */
        }
      `}</style>
    </div>
  );
}

/**
 * Example 4: With Router Integration (Next.js)
 * 
 * Integrates with Next.js router for navigation
 */
export function WithNextRouter() {
  // This would be in a Next.js page component
  /*
  import { useRouter } from 'next/router';
  import { StudentSessionView } from '@/components/StudentSessionView';

  export default function SessionPage() {
    const router = useRouter();
    const { sessionId } = router.query;
    const studentId = 'student-123'; // From auth context

    if (!sessionId) {
      return <div>Loading...</div>;
    }

    return (
      <StudentSessionView
        sessionId={sessionId as string}
        studentId={studentId}
        onLeaveSession={() => router.push('/sessions')}
      />
    );
  }
  */
}

/**
 * Example 5: With Authentication Context
 * 
 * Uses authentication context to get student ID
 */
export function WithAuthContext() {
  // This would use a real auth context
  /*
  import { useAuth } from '@/contexts/AuthContext';
  import { StudentSessionView } from '@/components/StudentSessionView';

  export default function AuthenticatedSessionView({ sessionId }: { sessionId: string }) {
    const { user, isAuthenticated } = useAuth();

    if (!isAuthenticated || !user) {
      return (
        <div className="auth-required">
          <h2>Authentication Required</h2>
          <p>Please sign in to view this session.</p>
          <button onClick={() => window.location.href = '/login'}>
            Sign In
          </button>
        </div>
      );
    }

    return (
      <StudentSessionView
        sessionId={sessionId}
        studentId={user.userId}
        onLeaveSession={() => window.location.href = '/dashboard'}
      />
    );
  }
  */
}

/**
 * Example 6: With Error Boundary
 * 
 * Wraps component in error boundary for error handling
 */
export function WithErrorBoundary() {
  // This would use a real error boundary
  /*
  import { ErrorBoundary } from '@/components/ErrorBoundary';
  import { StudentSessionView } from '@/components/StudentSessionView';

  export default function SafeSessionView({ sessionId, studentId }: {
    sessionId: string;
    studentId: string;
  }) {
    return (
      <ErrorBoundary
        fallback={
          <div className="error-container">
            <h2>Something went wrong</h2>
            <p>Unable to load the session. Please try again.</p>
            <button onClick={() => window.location.reload()}>
              Reload Page
            </button>
          </div>
        }
      >
        <StudentSessionView
          sessionId={sessionId}
          studentId={studentId}
        />
      </ErrorBoundary>
    );
  }
  */
}

/**
 * Example 7: With Loading State
 * 
 * Shows loading state while fetching session ID
 */
export function WithLoadingState() {
  /*
  import { useState, useEffect } from 'react';
  import { StudentSessionView } from '@/components/StudentSessionView';

  export default function SessionLoader({ qrCode }: { qrCode: string }) {
    const [sessionId, setSessionId] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const studentId = 'student-123'; // From auth

    useEffect(() => {
      // Parse QR code to get session ID
      try {
        const data = JSON.parse(qrCode);
        if (data.type === 'SESSION') {
          setSessionId(data.sessionId);
        }
      } catch (error) {
        console.error('Invalid QR code');
      } finally {
        setLoading(false);
      }
    }, [qrCode]);

    if (loading) {
      return <div>Loading session...</div>;
    }

    if (!sessionId) {
      return <div>Invalid session QR code</div>;
    }

    return (
      <StudentSessionView
        sessionId={sessionId}
        studentId={studentId}
      />
    );
  }
  */
}

/**
 * Example 8: With Session Enrollment Flow
 * 
 * Complete flow from scanning session QR to viewing session
 */
export function WithEnrollmentFlow() {
  /*
  import { useState } from 'react';
  import { QRScanner } from '@/components/QRScanner';
  import { StudentSessionView } from '@/components/StudentSessionView';
  import type { SessionQRData } from '@qr-attendance/shared';

  export default function SessionEnrollment() {
    const [sessionId, setSessionId] = useState<string | null>(null);
    const [enrolling, setEnrolling] = useState(true);
    const studentId = 'student-123'; // From auth

    const handleSessionScanned = async (data: SessionQRData) => {
      try {
        // Enroll in session
        const response = await fetch(`/api/sessions/${data.sessionId}/enroll`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ studentId }),
        });

        if (response.ok) {
          setSessionId(data.sessionId);
          setEnrolling(false);
        } else {
          alert('Failed to enroll in session');
        }
      } catch (error) {
        console.error('Enrollment error:', error);
        alert('Failed to enroll in session');
      }
    };

    if (enrolling) {
      return (
        <div className="enrollment-container">
          <h1>Scan Session QR Code</h1>
          <p>Scan the QR code displayed by your teacher to join the session</p>
          <QRScanner
            isActive={true}
            onSessionScanned={handleSessionScanned}
            onScanError={(error) => alert(error)}
          />
        </div>
      );
    }

    if (!sessionId) {
      return <div>No session selected</div>;
    }

    return (
      <StudentSessionView
        sessionId={sessionId}
        studentId={studentId}
        onLeaveSession={() => {
          setSessionId(null);
          setEnrolling(true);
        }}
      />
    );
  }
  */
}

/**
 * Example 9: With Offline Support
 * 
 * Handles offline scenarios gracefully
 */
export function WithOfflineSupport() {
  /*
  import { useState, useEffect } from 'react';
  import { StudentSessionView } from '@/components/StudentSessionView';

  export default function OfflineAwareSession({ sessionId, studentId }: {
    sessionId: string;
    studentId: string;
  }) {
    const [isOnline, setIsOnline] = useState(navigator.onLine);

    useEffect(() => {
      const handleOnline = () => setIsOnline(true);
      const handleOffline = () => setIsOnline(false);

      window.addEventListener('online', handleOnline);
      window.addEventListener('offline', handleOffline);

      return () => {
        window.removeEventListener('online', handleOnline);
        window.removeEventListener('offline', handleOffline);
      };
    }, []);

    return (
      <div>
        {!isOnline && (
          <div className="offline-banner">
            <p>⚠️ You are offline. Some features may not work.</p>
          </div>
        )}
        <StudentSessionView
          sessionId={sessionId}
          studentId={studentId}
        />
      </div>
    );
  }
  */
}

/**
 * Example 10: With Analytics Tracking
 * 
 * Tracks user interactions for analytics
 */
export function WithAnalytics() {
  /*
  import { useEffect } from 'react';
  import { StudentSessionView } from '@/components/StudentSessionView';
  import { trackEvent } from '@/utils/analytics';

  export default function TrackedSession({ sessionId, studentId }: {
    sessionId: string;
    studentId: string;
  }) {
    useEffect(() => {
      // Track session view
      trackEvent('session_viewed', {
        sessionId,
        studentId,
        timestamp: Date.now(),
      });
    }, [sessionId, studentId]);

    const handleLeaveSession = () => {
      // Track session leave
      trackEvent('session_left', {
        sessionId,
        studentId,
        timestamp: Date.now(),
      });
      
      // Navigate away
      window.location.href = '/sessions';
    };

    return (
      <StudentSessionView
        sessionId={sessionId}
        studentId={studentId}
        onLeaveSession={handleLeaveSession}
      />
    );
  }
  */
}

/**
 * Example 11: Mobile App Integration (React Native)
 * 
 * Shows how to integrate with React Native
 */
export function MobileAppIntegration() {
  /*
  // This would be in a React Native component
  import { View, SafeAreaView, StatusBar } from 'react-native';
  import { WebView } from 'react-native-webview';

  export default function MobileSessionView({ sessionId, studentId }: {
    sessionId: string;
    studentId: string;
  }) {
    const webViewUrl = `https://your-app.com/session/${sessionId}?studentId=${studentId}`;

    return (
      <SafeAreaView style={{ flex: 1 }}>
        <StatusBar barStyle="dark-content" />
        <WebView
          source={{ uri: webViewUrl }}
          style={{ flex: 1 }}
          javaScriptEnabled={true}
          domStorageEnabled={true}
          startInLoadingState={true}
        />
      </SafeAreaView>
    );
  }
  */
}

/**
 * Example 12: With Real-Time Updates (WebSocket)
 * 
 * Uses WebSocket for real-time updates instead of polling
 */
export function WithWebSocket() {
  /*
  import { useState, useEffect } from 'react';
  import { StudentSessionView } from '@/components/StudentSessionView';

  export default function RealtimeSession({ sessionId, studentId }: {
    sessionId: string;
    studentId: string;
  }) {
    const [ws, setWs] = useState<WebSocket | null>(null);

    useEffect(() => {
      // Connect to WebSocket
      const websocket = new WebSocket(`wss://your-app.com/ws/${sessionId}`);
      
      websocket.onopen = () => {
        console.log('WebSocket connected');
        websocket.send(JSON.stringify({
          type: 'subscribe',
          studentId,
        }));
      };

      websocket.onmessage = (event) => {
        const data = JSON.parse(event.data);
        console.log('Received update:', data);
        // Handle real-time updates
      };

      websocket.onerror = (error) => {
        console.error('WebSocket error:', error);
      };

      websocket.onclose = () => {
        console.log('WebSocket disconnected');
      };

      setWs(websocket);

      return () => {
        websocket.close();
      };
    }, [sessionId, studentId]);

    return (
      <StudentSessionView
        sessionId={sessionId}
        studentId={studentId}
      />
    );
  }
  */
}

// Export all examples
const examples = {
  BasicExample,
  WithLeaveCallback,
  WithCustomStyling,
  WithNextRouter,
  WithAuthContext,
  WithErrorBoundary,
  WithLoadingState,
  WithEnrollmentFlow,
  WithOfflineSupport,
  WithAnalytics,
  MobileAppIntegration,
  WithWebSocket,
};

export default examples;
