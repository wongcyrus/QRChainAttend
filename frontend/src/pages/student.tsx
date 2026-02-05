/**
 * Student Session View Page
 */

import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { SimpleStudentView } from '../components/SimpleStudentView';

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
  const [manualSessionId, setManualSessionId] = useState('');
  const [hasAutoJoined, setHasAutoJoined] = useState(false);
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

  // Separate effect for auto-join to avoid infinite loop
  useEffect(() => {
    if (user && sessionId && typeof sessionId === 'string' && !hasAutoJoined && !joining) {
      setHasAutoJoined(true);
      handleJoinSession(sessionId);
    }
  }, [user, sessionId, hasAutoJoined, joining]);

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
      setHasAutoJoined(false); // Allow retry
    } finally {
      setJoining(false);
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
      <SimpleStudentView 
        sessionId={sessionId}
        studentId={user.userDetails}
        onLeaveSession={() => router.push('/student')}
      />
    );
  }

  // Show join interface - simplified to just manual entry
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
        
        <p style={{ color: '#666', marginBottom: '1.5rem' }}>
          Scan the teacher's session QR code with your phone camera, or enter the session ID manually below.
        </p>
        
        {/* Manual Entry */}
        <div>
          <label style={{ 
            display: 'block', 
            marginBottom: '0.5rem',
            fontWeight: 'bold'
          }}>
            Session ID
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
            onClick={() => {
              if (manualSessionId.trim()) {
                handleJoinSession(manualSessionId.trim());
              }
            }}
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
