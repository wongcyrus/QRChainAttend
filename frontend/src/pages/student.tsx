/**
 * Student Session View Page
 */

import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import StudentSessionView from '../components/StudentSessionView';
import { QRScanner } from '../components/QRScanner';

interface UserInfo {
  userId: string;
  userDetails: string;
  userRoles: string[];
}

function getRolesFromEmail(email: string): string[] {
  const roles: string[] = ['authenticated'];
  if (!email) return roles;
  const emailLower = email.toLowerCase();
  if (emailLower.endsWith('@stu.vtc.edu.hk')) {
    roles.push('student');
  } else if (emailLower.endsWith('@vtc.edu.hk')) {
    roles.push('teacher');
  }
  return roles;
}

export default function StudentPage() {
  const router = useRouter();
  const [user, setUser] = useState<UserInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showScanner, setShowScanner] = useState(false);
  const [manualSessionId, setManualSessionId] = useState('');
  const { sessionId } = router.query;

  useEffect(() => {
    const isLocal = process.env.NEXT_PUBLIC_ENVIRONMENT === 'local';
    const authEndpoint = isLocal ? '/api/auth/me' : '/.auth/me';
    
    fetch(authEndpoint, {
      cache: 'no-store',
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache'
      }
    })
      .then(res => res.json())
      .then(data => {
        if (data.clientPrincipal) {
          const email = data.clientPrincipal.userDetails || '';
          const roles = data.clientPrincipal.userRoles || getRolesFromEmail(email);
          
          setUser({
            userId: data.clientPrincipal.userId,
            userDetails: email,
            userRoles: roles
          });

          // Check if user has student role
          if (!roles.includes('student')) {
            router.push('/');
          }
        } else {
          const loginUrl = isLocal ? '/dev-config' : '/.auth/login/aad';
          router.push(loginUrl);
        }
        setLoading(false);
      })
      .catch(() => {
        setLoading(false);
        router.push('/');
      });
  }, [router]);

  const handleJoinSession = async (sessionIdToJoin: string) => {
    if (!user) return;
    
    setJoining(true);
    setError(null);
    
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || '/api';
      
      // Create headers with authentication
      const headers: HeadersInit = {
        'Content-Type': 'application/json'
      };
      
      // Add mock authentication header for local development
      if (process.env.NEXT_PUBLIC_ENVIRONMENT === 'local') {
        const mockPrincipal = {
          userId: user.userId,
          userDetails: user.userDetails,
          userRoles: user.userRoles,
          identityProvider: 'aad'
        };
        headers['x-ms-client-principal'] = Buffer.from(JSON.stringify(mockPrincipal)).toString('base64');
      }
      
      const response = await fetch(`${apiUrl}/sessions/${sessionIdToJoin}/join`, {
        method: 'POST',
        headers
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error?.message || 'Failed to join session');
      }
      
      // Successfully joined - navigate to session view
      router.push(`/student?sessionId=${sessionIdToJoin}`);
      
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to join session');
    } finally {
      setJoining(false);
    }
  };

  const handleQRScan = (data: any) => {
    try {
      // Decode the QR data
      const decoded = JSON.parse(Buffer.from(data.sessionId || data, 'base64').toString('utf-8'));
      
      if (decoded.type === 'SESSION' && decoded.sessionId) {
        setShowScanner(false);
        handleJoinSession(decoded.sessionId);
      } else {
        setError('Invalid QR code. Please scan a session QR code.');
      }
    } catch (err) {
      setError('Failed to read QR code. Please try again.');
    }
  };

  const handleManualJoin = () => {
    if (manualSessionId.trim()) {
      handleJoinSession(manualSessionId.trim());
    }
  };

  if (loading) {
    return (
      <div style={{ padding: '2rem', fontFamily: 'system-ui, sans-serif' }}>
        <p>Loading...</p>
      </div>
    );
  }

  if (!user || !user.userRoles.includes('student')) {
    return null;
  }

  // If sessionId in query and already joined, show session view
  if (sessionId && typeof sessionId === 'string') {
    return (
      <StudentSessionView 
        sessionId={sessionId}
        studentId={user.userId}
        onLeaveSession={() => router.push('/student')}
      />
    );
  }

  // Show join interface
  return (
    <div style={{ 
      padding: '2rem', 
      fontFamily: 'system-ui, sans-serif',
      maxWidth: '600px',
      margin: '0 auto'
    }}>
      <div style={{ marginBottom: '2rem' }}>
        <h1 style={{ margin: '0 0 0.5rem 0' }}>Student View</h1>
        <p style={{ margin: 0, color: '#666' }}>Welcome, {user.userDetails}</p>
      </div>

      {error && (
        <div style={{
          padding: '1rem',
          backgroundColor: '#fef0f0',
          border: '1px solid #d13438',
          borderRadius: '4px',
          marginBottom: '1rem',
          color: '#d13438'
        }}>
          {error}
        </div>
      )}

      <div style={{
        padding: '2rem',
        backgroundColor: '#f5f5f5',
        borderRadius: '8px',
        marginBottom: '2rem'
      }}>
        <h2 style={{ marginTop: 0 }}>Join a Session</h2>
        
        {/* QR Scanner */}
        <div style={{ marginBottom: '2rem' }}>
          <button
            onClick={() => setShowScanner(!showScanner)}
            disabled={joining}
            style={{
              padding: '0.75rem 1.5rem',
              backgroundColor: '#0078d4',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: joining ? 'not-allowed' : 'pointer',
              fontSize: '1rem',
              fontWeight: 'bold',
              width: '100%',
              opacity: joining ? 0.6 : 1
            }}
          >
            {showScanner ? '📷 Close Scanner' : '📷 Scan QR Code'}
          </button>
          
          {showScanner && (
            <div style={{ marginTop: '1rem' }}>
              <QRScanner
                onSessionScanned={handleQRScan}
                onScanError={(err: string) => setError(err)}
              />
            </div>
          )}
        </div>

        {/* Manual Entry */}
        <div>
          <p style={{ 
            textAlign: 'center', 
            color: '#666',
            margin: '1rem 0'
          }}>
            — OR —
          </p>
          
          <label style={{ 
            display: 'block', 
            marginBottom: '0.5rem',
            fontWeight: 'bold'
          }}>
            Enter Session ID Manually
          </label>
          <input
            type="text"
            value={manualSessionId}
            onChange={(e) => setManualSessionId(e.target.value)}
            placeholder="Enter session ID"
            disabled={joining}
            style={{
              width: '100%',
              padding: '0.75rem',
              fontSize: '1rem',
              border: '1px solid #ccc',
              borderRadius: '4px',
              marginBottom: '1rem',
              boxSizing: 'border-box'
            }}
          />
          <button
            onClick={handleManualJoin}
            disabled={joining || !manualSessionId.trim()}
            style={{
              padding: '0.75rem 1.5rem',
              backgroundColor: '#107c10',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: (joining || !manualSessionId.trim()) ? 'not-allowed' : 'pointer',
              fontSize: '1rem',
              fontWeight: 'bold',
              width: '100%',
              opacity: (joining || !manualSessionId.trim()) ? 0.6 : 1
            }}
          >
            {joining ? 'Joining...' : 'Join Session'}
          </button>
        </div>
      </div>

      <button 
        onClick={() => router.push('/')}
        style={{
          padding: '0.5rem 1rem',
          backgroundColor: '#666',
          color: 'white',
          border: 'none',
          borderRadius: '4px',
          cursor: 'pointer',
          fontSize: '0.875rem'
        }}
      >
        Back to Home
      </button>
    </div>
  );
}
