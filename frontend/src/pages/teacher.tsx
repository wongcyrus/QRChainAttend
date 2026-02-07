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
  endAt?: string;
  status: string;
  isRecurring?: boolean;
  recurrencePattern?: 'DAILY' | 'WEEKLY' | 'MONTHLY';
  recurrenceEndDate?: string;
  parentSessionId?: string;
  occurrenceNumber?: number;
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
  const [qrCodeData, setQrCodeData] = useState<{ sessionId: string; classId: string; type: 'ENTRY' | 'EXIT'; qrDataUrl: string } | null>(null);
  const [qrRefreshKey, setQrRefreshKey] = useState(0); // For triggering QR refresh
  
  // For delete confirmation dialog
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [selectedSessionForDelete, setSelectedSessionForDelete] = useState<Session | null>(null);
  const [deleteScope, setDeleteScope] = useState<'this' | 'future' | 'all'>('this');
  
  // For edit dialog
  const [showEditForm, setShowEditForm] = useState(false);
  const [selectedSessionForEdit, setSelectedSessionForEdit] = useState<Session | null>(null);

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
          // Always compute roles from email (don't rely on Azure AD roles)
          const roles = getRolesFromEmail(email);
          
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
      const isLocal = process.env.NEXT_PUBLIC_ENVIRONMENT === 'local';
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || '/api';
      
      // Get fresh auth info
      const authEndpoint = isLocal ? '/api/auth/me' : '/.auth/me';
      const authResponse = await fetch(authEndpoint, { credentials: 'include' });
      const authData = await authResponse.json();
      
      if (!authData.clientPrincipal) {
        console.error('Not authenticated');
        return;
      }
      
      // Create headers with authentication
      const headers: HeadersInit = {
        'Content-Type': 'application/json'
      };
      
      // Create principal header for backend
      const principal = {
        userId: authData.clientPrincipal.userId,
        userDetails: authData.clientPrincipal.userDetails,
        userRoles: getRolesFromEmail(authData.clientPrincipal.userDetails),
        identityProvider: authData.clientPrincipal.identityProvider || 'aad'
      };
      headers['x-ms-client-principal'] = Buffer.from(JSON.stringify(principal)).toString('base64');
      
      // Use email (userDetails) as teacher ID, not the generated userId
      const teacherId = authData.clientPrincipal.userDetails || authData.clientPrincipal.userId || '';
      // Use query parameter instead of path parameter to avoid URL encoding issues
      const response = await fetch(`${apiUrl}/teacher/sessions?teacherId=${encodeURIComponent(teacherId)}`, {
        headers
      });
      
      if (response.ok) {
        const data = await response.json();
        setSessions(data.sessions || []);
      } else if (response.status === 404) {
        // No sessions found - this is okay
        setSessions([]);
      } else {
        // Log the full error response for debugging
        const errorText = await response.text();
        console.error('Failed to load sessions:', response.status, errorText);
        console.error('Request URL:', `${apiUrl}/teacher/sessions?teacherId=${encodeURIComponent(teacherId)}`);
        console.error('Request headers:', headers);
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

  // Auto-refresh QR code every 30 seconds when modal is open
  useEffect(() => {
    if (!showQRModal || !qrCodeData) return;
    
    const refreshQR = async () => {
      try {
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || '/api';
        const isLocal = process.env.NEXT_PUBLIC_ENVIRONMENT === 'local';
        const authEndpoint = isLocal ? '/api/auth/me' : '/.auth/me';
        const authResponse = await fetch(authEndpoint, { credentials: 'include' });
        const authData = await authResponse.json();
        
        if (!authData.clientPrincipal) return;
        
        const headers: HeadersInit = {
          'Content-Type': 'application/json',
          'x-ms-client-principal': Buffer.from(JSON.stringify(authData.clientPrincipal)).toString('base64')
        };
        
        const endpoint = qrCodeData.type === 'ENTRY' ? 'entry-qr' : 'exit-qr';
        const response = await fetch(`${apiUrl}/sessions/${qrCodeData.sessionId}/${endpoint}`, { headers });
        
        if (!response.ok) return;
        
        const data = await response.json();
        const baseUrl = window.location.origin;
        const studentUrl = `${baseUrl}/student?sessionId=${qrCodeData.sessionId}&type=${qrCodeData.type}&token=${data.token}`;
        
        const qrDataUrl = await QRCode.toDataURL(studentUrl, {
          width: 300,
          margin: 2,
          color: {
            dark: '#000000',
            light: '#FFFFFF'
          }
        });
        
        setQrCodeData(prev => prev ? { ...prev, qrDataUrl } : null);
      } catch (err) {
        console.error('Failed to refresh QR code:', err);
      }
    };
    
    // Refresh every 30 seconds
    const interval = setInterval(refreshQR, 30000);
    
    return () => clearInterval(interval);
  }, [showQRModal, qrCodeData?.sessionId, qrCodeData?.type]);

  const handleShowEntryQR = async (session: Session) => {
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || '/api';
      
      // Get authentication
      const isLocal = process.env.NEXT_PUBLIC_ENVIRONMENT === 'local';
      const authEndpoint = isLocal ? '/api/auth/me' : '/.auth/me';
      const authResponse = await fetch(authEndpoint, { credentials: 'include' });
      const authData = await authResponse.json();
      
      if (!authData.clientPrincipal) {
        setError('Not authenticated');
        return;
      }
      
      // Create headers with authentication
      const headers: HeadersInit = {
        'Content-Type': 'application/json',
        'x-ms-client-principal': Buffer.from(JSON.stringify(authData.clientPrincipal)).toString('base64')
      };
      
      // Get entry QR token from backend
      const response = await fetch(`${apiUrl}/sessions/${session.sessionId}/entry-qr`, { headers });
      
      if (!response.ok) {
        throw new Error('Failed to get entry QR code');
      }
      
      const data = await response.json();
      
      // Create URL for students to scan
      const baseUrl = window.location.origin;
      const studentUrl = `${baseUrl}/student?sessionId=${session.sessionId}&type=ENTRY&token=${data.token}`;
      
      // Generate QR code with the URL
      const qrDataUrl = await QRCode.toDataURL(studentUrl, {
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
        type: 'ENTRY',
        qrDataUrl
      });
      setShowQRModal(true);
    } catch (err) {
      setError('Failed to generate entry QR code');
    }
  };

  const handleShowExitQR = async (session: Session) => {
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || '/api';
      
      // Get authentication
      const isLocal = process.env.NEXT_PUBLIC_ENVIRONMENT === 'local';
      const authEndpoint = isLocal ? '/api/auth/me' : '/.auth/me';
      const authResponse = await fetch(authEndpoint, { credentials: 'include' });
      const authData = await authResponse.json();
      
      if (!authData.clientPrincipal) {
        setError('Not authenticated');
        return;
      }
      
      // Create headers with authentication
      const headers: HeadersInit = {
        'Content-Type': 'application/json',
        'x-ms-client-principal': Buffer.from(JSON.stringify(authData.clientPrincipal)).toString('base64')
      };
      
      // Get exit QR token from backend
      const response = await fetch(`${apiUrl}/sessions/${session.sessionId}/exit-qr`, { headers });
      
      if (!response.ok) {
        throw new Error('Failed to get exit QR code');
      }
      
      const data = await response.json();
      
      // Create URL for students to scan
      const baseUrl = window.location.origin;
      const studentUrl = `${baseUrl}/student?sessionId=${session.sessionId}&type=EXIT&token=${data.token}`;
      
      // Generate QR code with the URL
      const qrDataUrl = await QRCode.toDataURL(studentUrl, {
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
        type: 'EXIT',
        qrDataUrl
      });
      setShowQRModal(true);
    } catch (err) {
      setError('Failed to generate exit QR code');
    }
  };

  const handleDeleteSession = async (session: Session) => {
    // Check if this is a recurring session
    const isRecurring = (session as any).isRecurring || (session as any).parentSessionId;
    
    if (isRecurring) {
      // Show scope selection dialog for recurring sessions
      setSelectedSessionForDelete(session);
      setDeleteScope('this');
      setShowDeleteConfirm(true);
    } else {
      // Direct confirmation for non-recurring sessions
      const message = `Are you sure you want to delete "${session.classId}"?\n\nThis will delete:\n- ${session.status === 'ENDED' ? 'Historical' : 'Active'} attendance records\n- Session chains\n- Tokens\n- Scan logs\n\nThis action cannot be undone.`;
      
      if (!window.confirm(message)) {
        return;
      }
      
      await performDeleteSession(session.sessionId, 'this');
    }
  };

  const performDeleteSession = async (sessionId: string, scope: string = 'this') => {
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || '/api';
      
      // Get authentication
      const isLocal = process.env.NEXT_PUBLIC_ENVIRONMENT === 'local';
      const authEndpoint = isLocal ? '/api/auth/me' : '/.auth/me';
      const authResponse = await fetch(authEndpoint, { credentials: 'include' });
      const authData = await authResponse.json();
      
      if (!authData.clientPrincipal) {
        setError('Not authenticated');
        return;
      }
      
      // Create headers with authentication
      const headers: HeadersInit = {
        'Content-Type': 'application/json',
        'x-ms-client-principal': Buffer.from(JSON.stringify(authData.clientPrincipal)).toString('base64')
      };
      
      // Call delete endpoint with scope parameter
      const url = new URL(`${apiUrl}/sessions/${sessionId}`, window.location.origin);
      url.searchParams.set('scope', scope);
      
      const response = await fetch(url.toString(), {
        method: 'DELETE',
        headers
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error?.message || 'Failed to delete session');
      }
      
      const data = await response.json();
      
      // Show success message
      const summary = data.details?.deletionSummary;
      const sessionsDeleted = data.details?.sessionsDeleted || 1;
      const message = `${sessionsDeleted} session${sessionsDeleted > 1 ? 's' : ''} deleted successfully!\n\nDeleted:\n- ${summary.deletedAttendance} attendance records\n- ${summary.deletedChains} chains\n- ${summary.deletedTokens} tokens\n- ${summary.deletedScanLogs} scan logs`;
      alert(message);
      
      // Close confirmation dialog
      setShowDeleteConfirm(false);
      setSelectedSessionForDelete(null);
      
      // Reload sessions list
      loadSessions();
      
    } catch (err) {
      setError((err as Error).message || 'Failed to delete session');
      setShowDeleteConfirm(false);
    }
  };

  const handleEditSession = (session: Session) => {
    let recurrenceEndDate = '';
    const parentId = session.parentSessionId || session.sessionId;
    const isRecurring = !!(session.isRecurring || session.parentSessionId);

    if (isRecurring) {
      const series = sessions.filter((s) => s.sessionId === parentId || s.parentSessionId === parentId);
      if (series.length > 0) {
        const last = series.reduce((latest, current) =>
          new Date(current.startAt).getTime() > new Date(latest.startAt).getTime() ? current : latest
        , series[0]);
        recurrenceEndDate = last.startAt.slice(0, 10);
      }
    }

    setSelectedSessionForEdit({
      ...session,
      recurrenceEndDate
    });
    setShowEditForm(true);
  };

  const handleEditComplete = () => {
    setShowEditForm(false);
    setSelectedSessionForEdit(null);
    loadSessions(); // Reload the sessions list
  };

  const handleEditCancel = () => {
    setShowEditForm(false);
    setSelectedSessionForEdit(null);
  };

  const handleCloseQRModal = () => {
    setShowQRModal(false);
    setQrCodeData(null);
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
    const currentSession = sessions.find(s => s.sessionId === selectedSessionId);
    
    return (
      <div style={{ 
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        padding: '2rem',
        fontFamily: 'system-ui, sans-serif'
      }}>
        <div style={{ marginBottom: '1.5rem', display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
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
          
          {currentSession && (
            <>
              <button 
                onClick={() => handleShowEntryQR(currentSession)}
                style={{
                  padding: '0.75rem 1.5rem',
                  backgroundColor: '#48bb78',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontSize: '0.95rem',
                  fontWeight: '600',
                  transition: 'all 0.2s',
                  boxShadow: '0 2px 8px rgba(72, 187, 120, 0.2)'
                }}
                onMouseOver={(e) => {
                  e.currentTarget.style.transform = 'scale(1.02)';
                  e.currentTarget.style.boxShadow = '0 4px 12px rgba(72, 187, 120, 0.3)';
                }}
                onMouseOut={(e) => {
                  e.currentTarget.style.transform = 'scale(1)';
                  e.currentTarget.style.boxShadow = '0 2px 8px rgba(72, 187, 120, 0.2)';
                }}
              >
                📥 Show Entry QR
              </button>
              
              <button 
                onClick={() => handleShowExitQR(currentSession)}
                style={{
                  padding: '0.75rem 1.5rem',
                  backgroundColor: '#ed8936',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontSize: '0.95rem',
                  fontWeight: '600',
                  transition: 'all 0.2s',
                  boxShadow: '0 2px 8px rgba(237, 137, 54, 0.2)'
                }}
                onMouseOver={(e) => {
                  e.currentTarget.style.transform = 'scale(1.02)';
                  e.currentTarget.style.boxShadow = '0 4px 12px rgba(237, 137, 54, 0.3)';
                }}
                onMouseOut={(e) => {
                  e.currentTarget.style.transform = 'scale(1)';
                  e.currentTarget.style.boxShadow = '0 2px 8px rgba(237, 137, 54, 0.2)';
                }}
              >
                📤 Show Exit QR
              </button>
            </>
          )}
        </div>
        
        {currentSession && (
          <div style={{
            backgroundColor: 'rgba(255, 255, 255, 0.95)',
            backdropFilter: 'blur(10px)',
            padding: '1.5rem 2rem',
            borderRadius: '12px',
            marginBottom: '1.5rem',
            boxShadow: '0 4px 20px rgba(0,0,0,0.1)'
          }}>
            <h1 style={{ 
              margin: '0 0 0.5rem 0',
              fontSize: '2rem',
              color: '#2d3748',
              fontWeight: '700'
            }}>
              📚 {currentSession.classId}
            </h1>
            <p style={{ 
              margin: 0, 
              color: '#718096',
              fontSize: '0.95rem'
            }}>
              Session Dashboard
            </p>
          </div>
        )}
        
        <TeacherDashboard 
          sessionId={selectedSessionId}
          onError={handleError}
        />
        
        {/* QR Code Modal for Dashboard */}
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
            onClick={handleCloseQRModal}
          >
            <div
              style={{
                backgroundColor: 'white',
                padding: '2.5rem',
                borderRadius: '20px',
                maxWidth: '500px',
                textAlign: 'center',
                boxShadow: '0 20px 60px rgba(0,0,0,0.3)'
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>
                {qrCodeData.type === 'ENTRY' ? '📥' : '📤'}
              </div>
              <h2 style={{ 
                color: '#2d3748',
                marginTop: 0,
                marginBottom: '0.5rem',
                fontSize: '1.75rem'
              }}>
                {qrCodeData.type === 'ENTRY' ? 'Entry QR Code' : 'Exit QR Code'}
              </h2>
              <h3 style={{ 
                color: '#4a5568',
                marginTop: 0,
                marginBottom: '0.5rem',
                fontSize: '1.25rem'
              }}>
                {qrCodeData.classId}
              </h3>
              <p style={{ 
                fontSize: '0.875rem', 
                color: '#718096', 
                marginBottom: '1rem',
                fontFamily: 'monospace',
                backgroundColor: '#f7fafc',
                padding: '0.5rem',
                borderRadius: '6px',
                wordBreak: 'break-all'
              }}>
                Session: {qrCodeData.sessionId.substring(0, 8)}...
              </p>
              
              
              <div style={{
                display: 'inline-block',
                padding: '1.5rem',
                backgroundColor: qrCodeData.type === 'ENTRY' ? '#e6ffed' : '#fff5e6',
                borderRadius: '16px',
                marginBottom: '1.5rem',
                border: `3px solid ${qrCodeData.type === 'ENTRY' ? '#48bb78' : '#ed8936'}`
              }}>
                <img src={qrCodeData.qrDataUrl} alt={`${qrCodeData.type} QR Code`} style={{
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
                {qrCodeData.type === 'ENTRY' 
                  ? 'Students scan this QR code to mark their entry' 
                  : 'Students scan this QR code to mark their exit'}
              </p>
              <button
                onClick={handleCloseQRModal}
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
            onClick={() => {
              setShowCreateForm(false);
              setShowEditForm(false);
              setSelectedSessionForEdit(null);
            }}
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

        {/* Create/Edit Session Section */}
        <div style={{ marginBottom: '2rem' }}>
          {!showCreateForm && !showEditForm ? (
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
              <SessionCreationForm
                teacherId={user.userId}
                teacherEmail={user.userDetails}
                onSessionCreated={showEditForm ? handleEditComplete : handleSessionCreated}
                mode={showEditForm ? 'edit' : 'create'}
                sessionToEdit={showEditForm && selectedSessionForEdit ? selectedSessionForEdit : undefined}
                onCancel={showEditForm ? handleEditCancel : () => setShowCreateForm(false)}
              />
            </div>
          )}
        </div>

        {/* Active Sessions List - Hidden when creating/editing */}
        {!showCreateForm && !showEditForm && (
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
                    right: '1rem',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.5rem',
                    alignItems: 'flex-end'
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
                    
                    {/* Recurring Badge */}
                    {(session.isRecurring || session.parentSessionId) && (
                      <span
                        style={{
                          padding: '0.5rem 1rem',
                          backgroundColor: '#667eea',
                          color: 'white',
                          borderRadius: '20px',
                          fontSize: '0.85rem',
                          fontWeight: '700',
                          textTransform: 'uppercase',
                          letterSpacing: '0.5px',
                          boxShadow: '0 4px 12px rgba(102, 126, 234, 0.4)'
                        }}
                      >
                        🔄 Recurring{session.occurrenceNumber ? ` #${session.occurrenceNumber}` : ''}
                      </span>
                    )}
                  </div>

                  <div style={{ marginBottom: '1.5rem', paddingRight: '120px' }}>
                    {/* Class Title */}
                    <h3 style={{ 
                      margin: '0 0 0.5rem 0',
                      fontSize: '1.4rem',
                      color: '#2d3748',
                      fontWeight: '700'
                    }}>
                      {session.classId}
                    </h3>
                    
                    {/* Session Details */}
                    <div style={{ 
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '0.75rem'
                    }}>
                      {/* Start Time */}
                      <p style={{ 
                        margin: 0, 
                        fontSize: '0.9rem', 
                        color: '#2d3748',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem',
                        fontWeight: '500'
                      }}>
                        <span>📅</span>
                        <span>{new Date(session.startAt).toLocaleDateString()}</span>
                      </p>

                      {/* Start & End Time */}
                      <p style={{ 
                        margin: 0, 
                        fontSize: '0.9rem', 
                        color: '#2d3748',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem',
                        fontWeight: '500'
                      }}>
                        <span>🕐</span>
                        <span>
                          {new Date(session.startAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                        {session.endAt && (
                          <>
                            <span style={{ color: '#a0aec0' }}>→</span>
                            <span>
                              {new Date(session.endAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </>
                        )}
                      </p>

                      {/* Duration */}
                      {session.endAt && (
                        <p style={{ 
                          margin: 0, 
                          fontSize: '0.85rem', 
                          color: '#667eea',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.5rem',
                          fontWeight: '600'
                        }}>
                          <span>⏱️</span>
                          <span>
                            {(() => {
                              const start = new Date(session.startAt).getTime();
                              const end = new Date(session.endAt!).getTime();
                              const minutes = Math.round((end - start) / 60000);
                              const hours = Math.floor(minutes / 60);
                              const mins = minutes % 60;
                              return hours > 0 
                                ? `${hours}h ${mins}min` 
                                : `${mins}min`;
                            })()}
                          </span>
                        </p>
                      )}
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
                        minWidth: '120px',
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
                      onClick={() => handleShowEntryQR(session)}
                      style={{
                        flex: '1',
                        minWidth: '120px',
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
                      📥 Entry QR
                    </button>
                    
                    <button
                      onClick={() => handleShowExitQR(session)}
                      style={{
                        flex: '1',
                        minWidth: '120px',
                        padding: '0.875rem 1.25rem',
                        backgroundColor: '#ed8936',
                        color: 'white',
                        border: 'none',
                        borderRadius: '10px',
                        cursor: 'pointer',
                        fontSize: '0.95rem',
                        fontWeight: '600',
                        transition: 'all 0.2s',
                        boxShadow: '0 4px 12px rgba(237, 137, 54, 0.3)'
                      }}
                      onMouseOver={(e) => {
                        e.currentTarget.style.transform = 'scale(1.02)';
                        e.currentTarget.style.boxShadow = '0 6px 16px rgba(237, 137, 54, 0.4)';
                      }}
                      onMouseOut={(e) => {
                        e.currentTarget.style.transform = 'scale(1)';
                        e.currentTarget.style.boxShadow = '0 4px 12px rgba(237, 137, 54, 0.3)';
                      }}
                    >
                      📤 Exit QR
                    </button>

                    <button
                      onClick={() => handleEditSession(session)}
                      style={{
                        flex: '1',
                        minWidth: '120px',
                        padding: '0.875rem 1.25rem',
                        backgroundColor: '#3182ce',
                        color: 'white',
                        border: 'none',
                        borderRadius: '10px',
                        cursor: 'pointer',
                        fontSize: '0.95rem',
                        fontWeight: '600',
                        transition: 'all 0.2s',
                        boxShadow: '0 4px 12px rgba(49, 130, 206, 0.3)'
                      }}
                      onMouseOver={(e) => {
                        e.currentTarget.style.transform = 'scale(1.02)';
                        e.currentTarget.style.boxShadow = '0 6px 16px rgba(49, 130, 206, 0.4)';
                      }}
                      onMouseOut={(e) => {
                        e.currentTarget.style.transform = 'scale(1)';
                        e.currentTarget.style.boxShadow = '0 4px 12px rgba(49, 130, 206, 0.3)';
                      }}
                    >
                      ✏️ Edit
                    </button>

                    <button
                      onClick={() => handleDeleteSession(session)}
                      style={{
                        flex: '1',
                        minWidth: '120px',
                        padding: '0.875rem 1.25rem',
                        backgroundColor: '#e53e3e',
                        color: 'white',
                        border: 'none',
                        borderRadius: '10px',
                        cursor: 'pointer',
                        fontSize: '0.95rem',
                        fontWeight: '600',
                        transition: 'all 0.2s',
                        boxShadow: '0 4px 12px rgba(229, 62, 62, 0.3)'
                      }}
                      onMouseOver={(e) => {
                        e.currentTarget.style.transform = 'scale(1.02)';
                        e.currentTarget.style.boxShadow = '0 6px 16px rgba(229, 62, 62, 0.4)';
                      }}
                      onMouseOut={(e) => {
                        e.currentTarget.style.transform = 'scale(1)';
                        e.currentTarget.style.boxShadow = '0 4px 12px rgba(229, 62, 62, 0.3)';
                      }}
                    >
                      🗑️ Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
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
            backgroundColor: 'rgba(0,0,0,0.6)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            backdropFilter: 'blur(4px)'
          }}
          onClick={handleCloseQRModal}
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
              {qrCodeData.type === 'ENTRY' ? '📥' : '📤'}
            </div>
            <h2 style={{ 
              color: '#2d3748',
              marginTop: 0,
              marginBottom: '0.5rem',
              fontSize: '1.75rem'
            }}>
              {qrCodeData.type === 'ENTRY' ? 'Entry QR Code' : 'Exit QR Code'}
            </h2>
            <h3 style={{ 
              color: '#4a5568',
              marginTop: 0,
              marginBottom: '0.5rem',
              fontSize: '1.25rem'
            }}>
              {qrCodeData.classId}
            </h3>
            <p style={{ 
              fontSize: '0.875rem', 
              color: '#718096', 
              marginBottom: '1rem',
              fontFamily: 'monospace',
              backgroundColor: '#f7fafc',
              padding: '0.5rem',
              borderRadius: '6px',
              wordBreak: 'break-all'
            }}>
              Session: {qrCodeData.sessionId.substring(0, 8)}...
            </p>
            
            <div style={{
              display: 'inline-block',
              padding: '1.5rem',
              backgroundColor: qrCodeData.type === 'ENTRY' ? '#e6ffed' : '#fff5e6',
              borderRadius: '16px',
              marginBottom: '1.5rem',
              border: `3px solid ${qrCodeData.type === 'ENTRY' ? '#48bb78' : '#ed8936'}`
            }}>
              <img src={qrCodeData.qrDataUrl} alt={`${qrCodeData.type} QR Code`} style={{
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
              {qrCodeData.type === 'ENTRY' 
                ? 'Students scan this QR code to mark their entry' 
                : 'Students scan this QR code to mark their exit'}
            </p>
            <button
              onClick={handleCloseQRModal}
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

      {/* Delete Confirmation Modal for Recurring Sessions */}
      {showDeleteConfirm && selectedSessionForDelete && (
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
            zIndex: 1001,
            backdropFilter: 'blur(4px)'
          }}
          onClick={() => setShowDeleteConfirm(false)}
        >
          <div
            style={{
              backgroundColor: 'white',
              padding: '2.5rem',
              borderRadius: '20px',
              maxWidth: '500px',
              boxShadow: '0 20px 60px rgba(0,0,0,0.3)'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ fontSize: '2.5rem', marginBottom: '1rem', textAlign: 'center' }}>🗑️</div>
            <h2 style={{ 
              color: '#2d3748',
              marginTop: 0,
              marginBottom: '1rem',
              fontSize: '1.5rem',
              textAlign: 'center'
            }}>
              Delete "{selectedSessionForDelete.classId}"?
            </h2>
            
            <div style={{ marginBottom: '1.5rem' }}>
              {((selectedSessionForDelete as any).isRecurring || (selectedSessionForDelete as any).parentSessionId) ? (
                <>
                  <p style={{ 
                    color: '#4a5568',
                    fontSize: '0.95rem',
                    marginBottom: '1rem',
                    textAlign: 'center'
                  }}>
                    This is a recurring session. How would you like to delete it?
                  </p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    <label style={{ 
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.75rem',
                      padding: '0.875rem',
                      backgroundColor: deleteScope === 'this' ? '#edf2f7' : '#f7fafc',
                      border: `2px solid ${deleteScope === 'this' ? '#667eea' : '#e2e8f0'}`,
                      borderRadius: '8px',
                      cursor: 'pointer',
                      transition: 'all 0.2s'
                    }}>
                      <input
                        type="radio"
                        name="deleteScope"
                        value="this"
                        checked={deleteScope === 'this'}
                        onChange={() => setDeleteScope('this')}
                        style={{ cursor: 'pointer', width: '18px', height: '18px' }}
                      />
                      <div>
                        <strong>This session only</strong>
                        <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.875rem', color: '#718096' }}>
                          Delete only this occurrence
                        </p>
                      </div>
                    </label>
                    
                    <label style={{ 
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.75rem',
                      padding: '0.875rem',
                      backgroundColor: deleteScope === 'future' ? '#edf2f7' : '#f7fafc',
                      border: `2px solid ${deleteScope === 'future' ? '#667eea' : '#e2e8f0'}`,
                      borderRadius: '8px',
                      cursor: 'pointer',
                      transition: 'all 0.2s'
                    }}>
                      <input
                        type="radio"
                        name="deleteScope"
                        value="future"
                        checked={deleteScope === 'future'}
                        onChange={() => setDeleteScope('future')}
                        style={{ cursor: 'pointer', width: '18px', height: '18px' }}
                      />
                      <div>
                        <strong>This & future sessions</strong>
                        <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.875rem', color: '#718096' }}>
                          Delete this and all future occurrences
                        </p>
                      </div>
                    </label>
                    
                    <label style={{ 
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.75rem',
                      padding: '0.875rem',
                      backgroundColor: deleteScope === 'all' ? '#edf2f7' : '#f7fafc',
                      border: `2px solid ${deleteScope === 'all' ? '#667eea' : '#e2e8f0'}`,
                      borderRadius: '8px',
                      cursor: 'pointer',
                      transition: 'all 0.2s'
                    }}>
                      <input
                        type="radio"
                        name="deleteScope"
                        value="all"
                        checked={deleteScope === 'all'}
                        onChange={() => setDeleteScope('all')}
                        style={{ cursor: 'pointer', width: '18px', height: '18px' }}
                      />
                      <div>
                        <strong>All sessions</strong>
                        <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.875rem', color: '#718096' }}>
                          Delete all occurrences in this recurring series
                        </p>
                      </div>
                    </label>
                  </div>
                </>
              ) : (
                <p style={{ 
                  color: '#4a5568',
                  fontSize: '0.95rem',
                  marginBottom: '1rem'
                }}>
                  This will delete:<br/>
                  • Attendance records<br/>
                  • Chains<br/>
                  • Tokens<br/>
                  • Scan logs<br/><br/>
                  <strong>This action cannot be undone.</strong>
                </p>
              )}
            </div>
            
            <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center' }}>
              <button
                onClick={() => setShowDeleteConfirm(false)}
                style={{
                  padding: '0.875rem 1.5rem',
                  backgroundColor: '#e2e8f0',
                  color: '#4a5568',
                  border: 'none',
                  borderRadius: '10px',
                  cursor: 'pointer',
                  fontSize: '0.95rem',
                  fontWeight: '600',
                  transition: 'all 0.2s'
                }}
                onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#cbd5e0'}
                onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#e2e8f0'}
              >
                Cancel
              </button>
              <button
                onClick={() => performDeleteSession(selectedSessionForDelete.sessionId, deleteScope)}
                style={{
                  padding: '0.875rem 1.5rem',
                  backgroundColor: '#e53e3e',
                  color: 'white',
                  border: 'none',
                  borderRadius: '10px',
                  cursor: 'pointer',
                  fontSize: '0.95rem',
                  fontWeight: '600',
                  boxShadow: '0 4px 12px rgba(229, 62, 62, 0.3)',
                  transition: 'all 0.2s'
                }}
                onMouseOver={(e) => {
                  e.currentTarget.style.transform = 'scale(1.02)';
                  e.currentTarget.style.boxShadow = '0 6px 16px rgba(229, 62, 62, 0.4)';
                }}
                onMouseOut={(e) => {
                  e.currentTarget.style.transform = 'scale(1)';
                  e.currentTarget.style.boxShadow = '0 4px 12px rgba(229, 62, 62, 0.3)';
                }}
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
