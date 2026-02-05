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
      
      // Use email (userDetails) as teacher ID, not the generated userId
      const teacherId = user?.userDetails || user?.userId;
      const response = await fetch(`${apiUrl}/sessions/teacher/${teacherId}`, {
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
      <div style={{ 
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        padding: '2rem',
        fontFamily: 'system-ui, sans-serif'
      }}>
        <div style={{ marginBottom: '1rem' }}>
          <button 
            onClick={() => setSelectedSessionId(null)}
            style={{
              padding: '0.75rem 1.5rem',
              backgroundColor: 'white',
              color: '#667eea',
              border: '2px solid #667eea',
              borderRadius: '8px',
              cursor: 'pointer',
              fontSize: '0.95rem',
              fontWeight: '600',
              transition: 'all 0.2s',
              boxShadow: '0 2px 8px rgba(102, 126, 234, 0.2)'
            }}
            onMouseOver={(e) => {
              e.currentTarget.style.backgroundColor = '#667eea';
              e.currentTarget.style.color = 'white';
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.backgroundColor = 'white';
              e.currentTarget.style.color = '#667eea';
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
    <div style={{ 
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      fontFamily: 'system-ui, -apple-system, sans-serif'
    }}>
      {/* Header */}
      <div style={{
        backgroundColor: 'rgba(255, 255, 255, 0.95)',
        backdropFilter: 'blur(10px)',
        boxShadow: '0 2px 20px rgba(0,0,0,0.1)',
        padding: '1.5rem 2rem',
        marginBottom: '2rem'
      }}>
        <div style={{ 
          maxWidth: '1400px', 
          margin: '0 auto',
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center'
        }}>
          <div>
            <h1 style={{ 
              margin: '0 0 0.5rem 0',
              fontSize: '2rem',
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              fontWeight: '700'
            }}>
              📚 Teacher Dashboard
            </h1>
            <p style={{ 
              margin: 0, 
              color: '#666',
              fontSize: '0.95rem'
            }}>
              Welcome back, <strong>{user.userDetails}</strong>
            </p>
          </div>
          <button 
            onClick={() => router.push('/')}
            style={{
              padding: '0.75rem 1.5rem',
              backgroundColor: 'white',
              color: '#667eea',
              border: '2px solid #667eea',
              borderRadius: '8px',
              cursor: 'pointer',
              fontSize: '0.95rem',
              fontWeight: '600',
              transition: 'all 0.2s',
              boxShadow: '0 2px 8px rgba(102, 126, 234, 0.2)'
            }}
            onMouseOver={(e) => {
              e.currentTarget.style.backgroundColor = '#667eea';
              e.currentTarget.style.color = 'white';
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.backgroundColor = 'white';
              e.currentTarget.style.color = '#667eea';
            }}
          >
            🏠 Home
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div style={{ 
        maxWidth: '1400px', 
        margin: '0 auto',
        padding: '0 2rem 2rem'
      }}>

        {error && (
          <div style={{
            padding: '1.25rem 1.5rem',
            backgroundColor: '#fff5f5',
            border: '2px solid #fc8181',
            borderRadius: '12px',
            marginBottom: '2rem',
            color: '#c53030',
            display: 'flex',
            alignItems: 'center',
            gap: '0.75rem',
            boxShadow: '0 4px 12px rgba(252, 129, 129, 0.2)'
          }}>
            <span style={{ fontSize: '1.5rem' }}>⚠️</span>
            <span style={{ fontWeight: '500' }}>{error}</span>
          </div>
        )}

        {/* Create Session Section */}
        <div style={{ marginBottom: '2rem' }}>
          {!showCreateForm ? (
            <button
              onClick={() => setShowCreateForm(true)}
              style={{
                padding: '1rem 2rem',
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                color: 'white',
                border: 'none',
                borderRadius: '12px',
                cursor: 'pointer',
                fontSize: '1.1rem',
                fontWeight: '700',
                boxShadow: '0 8px 24px rgba(102, 126, 234, 0.4)',
                transition: 'all 0.3s',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.5rem'
              }}
              onMouseOver={(e) => {
                e.currentTarget.style.transform = 'translateY(-2px)';
                e.currentTarget.style.boxShadow = '0 12px 32px rgba(102, 126, 234, 0.5)';
              }}
              onMouseOut={(e) => {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = '0 8px 24px rgba(102, 126, 234, 0.4)';
              }}
            >
              <span style={{ fontSize: '1.5rem' }}>➕</span>
              Create New Session
            </button>
          ) : (
            <div style={{
              padding: '2rem',
              backgroundColor: 'white',
              borderRadius: '16px',
              border: '2px solid #e2e8f0',
              boxShadow: '0 8px 32px rgba(0,0,0,0.08)'
            }}>
              <div style={{ 
                display: 'flex', 
                justifyContent: 'space-between', 
                alignItems: 'center', 
                marginBottom: '1.5rem',
                paddingBottom: '1rem',
                borderBottom: '2px solid #e2e8f0'
              }}>
                <h2 style={{ 
                  margin: 0,
                  fontSize: '1.5rem',
                  color: '#2d3748'
                }}>
                  ✨ Create New Session
                </h2>
                <button
                  onClick={() => setShowCreateForm(false)}
                  style={{
                    padding: '0.5rem 1.25rem',
                    backgroundColor: '#e2e8f0',
                    color: '#4a5568',
                    border: 'none',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    fontSize: '0.95rem',
                    fontWeight: '600',
                    transition: 'all 0.2s'
                  }}
                  onMouseOver={(e) => {
                    e.currentTarget.style.backgroundColor = '#cbd5e0';
                  }}
                  onMouseOut={(e) => {
                    e.currentTarget.style.backgroundColor = '#e2e8f0';
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
          <h2 style={{ 
            color: 'white',
            fontSize: '1.75rem',
            marginBottom: '1.5rem',
            fontWeight: '700',
            textShadow: '0 2px 8px rgba(0,0,0,0.2)'
          }}>
            📋 Your Sessions
          </h2>
          {sessions.length === 0 ? (
            <div style={{
              padding: '4rem 2rem',
              textAlign: 'center',
              backgroundColor: 'white',
              borderRadius: '16px',
              boxShadow: '0 8px 32px rgba(0,0,0,0.08)'
            }}>
              <div style={{ fontSize: '4rem', marginBottom: '1rem' }}>📚</div>
              <h3 style={{ 
                color: '#2d3748',
                fontSize: '1.5rem',
                marginBottom: '0.5rem'
              }}>
                No sessions yet
              </h3>
              <p style={{ 
                color: '#718096',
                fontSize: '1.1rem',
                margin: 0
              }}>
                Create your first session to get started!
              </p>
            </div>
          ) : (
            <div style={{ 
              display: 'grid', 
              gap: '1.5rem',
              gridTemplateColumns: 'repeat(auto-fill, minmax(400px, 1fr))'
            }}>
              {sessions.map(session => (
                <div
                  key={session.sessionId}
                  style={{
                    padding: '2rem',
                    backgroundColor: 'white',
                    borderRadius: '16px',
                    boxShadow: '0 8px 32px rgba(0,0,0,0.08)',
                    transition: 'all 0.3s',
                    border: '2px solid transparent',
                    position: 'relative',
                    overflow: 'hidden'
                  }}
                  onMouseOver={(e) => {
                    e.currentTarget.style.transform = 'translateY(-4px)';
                    e.currentTarget.style.boxShadow = '0 12px 48px rgba(0,0,0,0.12)';
                    e.currentTarget.style.borderColor = '#667eea';
                  }}
                  onMouseOut={(e) => {
                    e.currentTarget.style.transform = 'translateY(0)';
                    e.currentTarget.style.boxShadow = '0 8px 32px rgba(0,0,0,0.08)';
                    e.currentTarget.style.borderColor = 'transparent';
                  }}
                >
                  {/* Status Badge */}
                  <div style={{
                    position: 'absolute',
                    top: '1rem',
                    right: '1rem'
                  }}>
                    <span
                      style={{
                        padding: '0.5rem 1rem',
                        backgroundColor: session.status === 'ACTIVE' ? '#48bb78' : '#a0aec0',
                        color: 'white',
                        borderRadius: '20px',
                        fontSize: '0.85rem',
                        fontWeight: '700',
                        textTransform: 'uppercase',
                        letterSpacing: '0.5px',
                        boxShadow: session.status === 'ACTIVE' 
                          ? '0 4px 12px rgba(72, 187, 120, 0.4)' 
                          : '0 4px 12px rgba(160, 174, 192, 0.4)'
                      }}
                    >
                      {session.status === 'ACTIVE' ? '🟢 Active' : '⚫ Ended'}
                    </span>
                  </div>

                  <div style={{ marginBottom: '1.5rem', paddingRight: '120px' }}>
                    <h3 style={{ 
                      margin: '0 0 1rem 0',
                      fontSize: '1.5rem',
                      color: '#2d3748',
                      fontWeight: '700'
                    }}>
                      {session.classId}
                    </h3>
                    <div style={{ 
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '0.5rem'
                    }}>
                      <p style={{ 
                        margin: 0, 
                        fontSize: '0.9rem', 
                        color: '#718096',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem'
                      }}>
                        <span>🆔</span>
                        <span style={{ 
                          fontFamily: 'monospace',
                          backgroundColor: '#f7fafc',
                          padding: '0.25rem 0.5rem',
                          borderRadius: '4px',
                          fontSize: '0.85rem'
                        }}>
                          {session.sessionId.substring(0, 8)}...
                        </span>
                      </p>
                      <p style={{ 
                        margin: 0, 
                        fontSize: '0.9rem', 
                        color: '#718096',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem'
                      }}>
                        <span>🕐</span>
                        <strong>{new Date(session.startAt).toLocaleString()}</strong>
                      </p>
                    </div>
                  </div>
                  
                  <div style={{ 
                    display: 'flex', 
                    gap: '0.75rem', 
                    flexWrap: 'wrap'
                  }}>
                    <button
                      onClick={() => setSelectedSessionId(session.sessionId)}
                      style={{
                        flex: '1',
                        minWidth: '140px',
                        padding: '0.875rem 1.25rem',
                        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                        color: 'white',
                        border: 'none',
                        borderRadius: '10px',
                        cursor: 'pointer',
                        fontSize: '0.95rem',
                        fontWeight: '600',
                        transition: 'all 0.2s',
                        boxShadow: '0 4px 12px rgba(102, 126, 234, 0.3)'
                      }}
                      onMouseOver={(e) => {
                        e.currentTarget.style.transform = 'scale(1.02)';
                        e.currentTarget.style.boxShadow = '0 6px 16px rgba(102, 126, 234, 0.4)';
                      }}
                      onMouseOut={(e) => {
                        e.currentTarget.style.transform = 'scale(1)';
                        e.currentTarget.style.boxShadow = '0 4px 12px rgba(102, 126, 234, 0.3)';
                      }}
                    >
                      📊 Dashboard
                    </button>
                    
                    <button
                      onClick={() => handleShowQR(session)}
                      style={{
                        flex: '1',
                        minWidth: '140px',
                        padding: '0.875rem 1.25rem',
                        backgroundColor: '#48bb78',
                        color: 'white',
                        border: 'none',
                        borderRadius: '10px',
                        cursor: 'pointer',
                        fontSize: '0.95rem',
                        fontWeight: '600',
                        transition: 'all 0.2s',
                        boxShadow: '0 4px 12px rgba(72, 187, 120, 0.3)'
                      }}
                      onMouseOver={(e) => {
                        e.currentTarget.style.transform = 'scale(1.02)';
                        e.currentTarget.style.boxShadow = '0 6px 16px rgba(72, 187, 120, 0.4)';
                      }}
                      onMouseOut={(e) => {
                        e.currentTarget.style.transform = 'scale(1)';
                        e.currentTarget.style.boxShadow = '0 4px 12px rgba(72, 187, 120, 0.3)';
                      }}
                    >
                      📱 QR Code
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
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
            backgroundColor: 'rgba(0,0,0,0.6)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            backdropFilter: 'blur(4px)'
          }}
          onClick={() => setShowQRModal(false)}
        >
          <div
            style={{
              backgroundColor: 'white',
              padding: '2.5rem',
              borderRadius: '20px',
              maxWidth: '500px',
              textAlign: 'center',
              boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
              animation: 'slideIn 0.3s ease-out'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ 
              fontSize: '3rem',
              marginBottom: '1rem'
            }}>
              📱
            </div>
            <h2 style={{ 
              color: '#2d3748',
              marginTop: 0,
              marginBottom: '0.5rem',
              fontSize: '1.75rem'
            }}>
              {qrCodeData.classId}
            </h2>
            <p style={{ 
              fontSize: '0.875rem', 
              color: '#718096', 
              marginBottom: '2rem',
              fontFamily: 'monospace',
              backgroundColor: '#f7fafc',
              padding: '0.5rem',
              borderRadius: '6px'
            }}>
              {qrCodeData.sessionId}
            </p>
            <div style={{
              display: 'inline-block',
              padding: '1.5rem',
              backgroundColor: '#f7fafc',
              borderRadius: '16px',
              marginBottom: '1.5rem'
            }}>
              <img src={qrCodeData.qrDataUrl} alt="Session QR Code" style={{
                display: 'block',
                borderRadius: '8px'
              }} />
            </div>
            <p style={{ 
              fontSize: '0.95rem', 
              color: '#4a5568', 
              margin: '0 0 1.5rem 0',
              lineHeight: '1.6'
            }}>
              Students can scan this QR code to join the session
            </p>
            <button
              onClick={() => setShowQRModal(false)}
              style={{
                padding: '0.875rem 2rem',
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                color: 'white',
                border: 'none',
                borderRadius: '10px',
                cursor: 'pointer',
                fontSize: '1rem',
                fontWeight: '600',
                boxShadow: '0 4px 12px rgba(102, 126, 234, 0.3)',
                transition: 'all 0.2s'
              }}
              onMouseOver={(e) => {
                e.currentTarget.style.transform = 'scale(1.05)';
                e.currentTarget.style.boxShadow = '0 6px 16px rgba(102, 126, 234, 0.4)';
              }}
              onMouseOut={(e) => {
                e.currentTarget.style.transform = 'scale(1)';
                e.currentTarget.style.boxShadow = '0 4px 12px rgba(102, 126, 234, 0.3)';
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
