/**
 * Teacher Dashboard Page
 */

import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { SessionCreationForm } from '../components/SessionCreationForm';
import { TeacherDashboard } from '../components/TeacherDashboard';
import QRCode from 'qrcode';

interface UserInfo {
  userId: string;
  userDetails: string;
  userRoles: string[];
}

interface Session {
  sessionId: string;
  classId: string;
  startAt: string;
  status: string;
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

export default function TeacherPage() {
  const router = useRouter();
  const [user, setUser] = useState<UserInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showQRModal, setShowQRModal] = useState(false);
  const [qrCodeData, setQrCodeData] = useState<{ sessionId: string; classId: string; qrDataUrl: string } | null>(null);

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

          // Check if user has teacher role
          if (!roles.includes('teacher')) {
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

  // Load teacher's sessions
  useEffect(() => {
    if (user) {
      loadSessions();
    }
  }, [user]);

  const loadSessions = async () => {
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || '/api';
      
      // Create mock auth header for local development
      const headers: HeadersInit = {
        'Content-Type': 'application/json'
      };
      
      // Add mock authentication header
      const mockPrincipal = {
        userId: user?.userId,
        userDetails: user?.userDetails,
        userRoles: user?.userRoles,
        identityProvider: 'aad'
      };
      headers['x-ms-client-principal'] = Buffer.from(JSON.stringify(mockPrincipal)).toString('base64');
      
      const response = await fetch(`${apiUrl}/sessions/teacher/${user?.userId}`, {
        headers
      });
      
      if (response.ok) {
        const data = await response.json();
        setSessions(data.sessions || []);
      } else if (response.status === 404) {
        // No sessions found - this is okay
        setSessions([]);
      } else {
        console.error('Failed to load sessions:', response.status);
        setSessions([]);
      }
    } catch (err) {
      console.error('Failed to load sessions:', err);
      // Don't show error to user - just show empty state
      setSessions([]);
    }
  };

  const handleSessionCreated = (sessionId: string) => {
    // Navigate to the session dashboard
    setShowCreateForm(false);
    setSelectedSessionId(sessionId);
    loadSessions();
  };

  const handleError = (errorMessage: string) => {
    setError(errorMessage);
    setTimeout(() => setError(null), 5000);
  };

  const handleShowQR = async (session: Session) => {
    try {
      // Generate URL for the session
      const baseUrl = window.location.origin;
      const sessionURL = `${baseUrl}/student?sessionId=${session.sessionId}`;
      
      const qrDataUrl = await QRCode.toDataURL(sessionURL, {
        width: 300,
        margin: 2,
        color: {
          dark: '#000000',
          light: '#FFFFFF'
        }
      });
      
      setQrCodeData({
        sessionId: session.sessionId,
        classId: session.classId,
        qrDataUrl
      });
      setShowQRModal(true);
    } catch (err) {
      setError('Failed to generate QR code');
    }
  };

  if (loading) {
    return (
      <div style={{ padding: '2rem', fontFamily: 'system-ui, sans-serif' }}>
        <p>Loading...</p>
      </div>
    );
  }

  if (!user || !user.userRoles.includes('teacher')) {
    return null;
  }

  // If a session is selected, show the dashboard
  if (selectedSessionId) {
    return (
      <div style={{ padding: '2rem', fontFamily: 'system-ui, sans-serif' }}>
        <div style={{ marginBottom: '1rem' }}>
          <button 
            onClick={() => setSelectedSessionId(null)}
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
            ← Back to Sessions
          </button>
        </div>
        <TeacherDashboard 
          sessionId={selectedSessionId}
          onError={handleError}
        />
      </div>
    );
  }

  return (
    <div style={{ padding: '2rem', fontFamily: 'system-ui, sans-serif', maxWidth: '1200px', margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <div>
          <h1 style={{ margin: '0 0 0.5rem 0' }}>Teacher Dashboard</h1>
          <p style={{ margin: 0, color: '#666' }}>Welcome, {user.userDetails}</p>
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
          Home
        </button>
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

      {/* Create Session Section */}
      <div style={{ marginBottom: '2rem' }}>
        {!showCreateForm ? (
          <button
            onClick={() => setShowCreateForm(true)}
            style={{
              padding: '0.75rem 1.5rem',
              backgroundColor: '#0078d4',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '1rem',
              fontWeight: 'bold'
            }}
          >
            + Create New Session
          </button>
        ) : (
          <div style={{
            padding: '1.5rem',
            backgroundColor: '#f5f5f5',
            borderRadius: '8px',
            border: '1px solid #ddd'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h2 style={{ margin: 0 }}>Create New Session</h2>
              <button
                onClick={() => setShowCreateForm(false)}
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
                Cancel
              </button>
            </div>
            <SessionCreationForm
              teacherId={user.userId}
              teacherEmail={user.userDetails}
              onSessionCreated={handleSessionCreated}
            />
          </div>
        )}
      </div>

      {/* Active Sessions List */}
      <div>
        <h2>Your Sessions</h2>
        {sessions.length === 0 ? (
          <div style={{
            padding: '2rem',
            textAlign: 'center',
            backgroundColor: '#f5f5f5',
            borderRadius: '8px',
            color: '#666'
          }}>
            <p>No sessions yet. Create your first session to get started!</p>
          </div>
        ) : (
          <div style={{ display: 'grid', gap: '1rem' }}>
            {sessions.map(session => (
              <div
                key={session.sessionId}
                style={{
                  padding: '1.5rem',
                  backgroundColor: 'white',
                  border: '1px solid #ddd',
                  borderRadius: '8px',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '1rem' }}>
                  <div>
                    <h3 style={{ margin: '0 0 0.5rem 0' }}>{session.classId}</h3>
                    <p style={{ margin: '0 0 0.25rem 0', fontSize: '0.875rem', color: '#666' }}>
                      Session ID: {session.sessionId}
                    </p>
                    <p style={{ margin: 0, fontSize: '0.875rem', color: '#666' }}>
                      Started: {new Date(session.startAt).toLocaleString()}
                    </p>
                  </div>
                  <span
                    style={{
                      padding: '0.25rem 0.75rem',
                      backgroundColor: session.status === 'ACTIVE' ? '#107c10' : '#666',
                      color: 'white',
                      borderRadius: '12px',
                      fontSize: '0.75rem',
                      fontWeight: 'bold'
                    }}
                  >
                    {session.status}
                  </span>
                </div>
                
                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                  <button
                    onClick={() => setSelectedSessionId(session.sessionId)}
                    style={{
                      padding: '0.5rem 1rem',
                      backgroundColor: '#0078d4',
                      color: 'white',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      fontSize: '0.875rem'
                    }}
                  >
                    View Dashboard
                  </button>
                  
                  <button
                    onClick={() => handleShowQR(session)}
                    style={{
                      padding: '0.5rem 1rem',
                      backgroundColor: '#107c10',
                      color: 'white',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      fontSize: '0.875rem'
                    }}
                  >
                    📱 Show QR Code
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* QR Code Modal */}
      {showQRModal && qrCodeData && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000
          }}
          onClick={() => setShowQRModal(false)}
        >
          <div
            style={{
              backgroundColor: 'white',
              padding: '2rem',
              borderRadius: '8px',
              maxWidth: '500px',
              textAlign: 'center'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h2 style={{ color: '#107c10', marginTop: 0 }}>✓ {qrCodeData.classId}</h2>
            <p style={{ fontSize: '0.875rem', color: '#666', marginBottom: '1.5rem' }}>
              Session ID: {qrCodeData.sessionId}
            </p>
            <div style={{
              display: 'inline-block',
              padding: '1rem',
              backgroundColor: '#f5f5f5',
              borderRadius: '8px'
            }}>
              <img src={qrCodeData.qrDataUrl} alt="Session QR Code" />
            </div>
            <p style={{ fontSize: '0.875rem', color: '#666', margin: '1rem 0' }}>
              Students can scan this QR code to join the session
            </p>
            <button
              onClick={() => setShowQRModal(false)}
              style={{
                padding: '0.75rem 1.5rem',
                backgroundColor: '#0078d4',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '1rem',
                marginTop: '1rem'
              }}
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
