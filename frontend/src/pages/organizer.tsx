/**
 * Organizer Dashboard Page
 */

import { useEffect, useState } from 'react';
import { getAuthHeaders, getAuthEndpoint } from '../utils/authHeaders';
import { useRouter } from 'next/router';
import { SessionCreationForm } from '../components/SessionCreationForm';
import { TeacherDashboard } from '../components/OrganizerDashboardWithTabs';
import { TeacherHeader } from '../components/OrganizerHeader';
import { SessionsList } from '../components/SessionsList';
import { DeleteConfirmModal } from '../components/DeleteConfirmModal';
import { QRCodeModal } from '../components/QRCodeModal';
import { AttendeeListManager } from '../components/AttendeeListManager';
import QRCode from 'qrcode';

interface UserInfo {
  userId: string;
  userDetails: string;
  userRoles: string[];
}

interface Session {
  sessionId: string;
  eventId: string;
  startAt: string;
  endAt?: string;
  status: string;
  isRecurring?: boolean;
  recurrencePattern?: 'DAILY' | 'WEEKLY' | 'MONTHLY';
  recurrenceEndDate?: string;
  parentSessionId?: string;
  occurrenceNumber?: number;
}

export default function TeacherPage() {
  const router = useRouter();

  // Helper function to get the correct base URL for QR codes
  const getQRBaseUrl = () => {
    // Use getAuthEndpoint helper
    const currentOrigin = window.location.origin;
    
    console.log('getQRBaseUrl debug:', { currentOrigin });
    
    // Always use the current origin - it will be the network IP if accessed via network IP
    console.log('Using current origin:', currentOrigin);
    return currentOrigin;
  };

  const [user, setUser] = useState<UserInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [showAttendeeListManager, setShowAttendeeListManager] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showQRModal, setShowQRModal] = useState(false);
  const [qrCodeData, setQrCodeData] = useState<{ sessionId: string; eventId: string; type: 'ENTRY' | 'EXIT'; qrDataUrl: string; studentUrl?: string; refreshIntervalMs?: number; expiresAt?: number } | null>(null);
  const [qrRefreshKey, setQrRefreshKey] = useState(0); // For triggering QR refresh
  
  // For delete confirmation dialog
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [selectedSessionForDelete, setSelectedSessionForDelete] = useState<Session | null>(null);
  const [deleteScope, setDeleteScope] = useState<'this' | 'future' | 'all'>('this');
  
  // For edit dialog
  const [showEditForm, setShowEditForm] = useState(false);
  const [selectedSessionForEdit, setSelectedSessionForEdit] = useState<Session | null>(null);

  useEffect(() => {
    // Use getAuthEndpoint helper
    const authEndpoint = getAuthEndpoint();
    
    fetch(authEndpoint, {
      credentials: 'include',
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
          // Use roles from backend API response
          const roles = data.clientPrincipal.userRoles || ['authenticated'];
          
          setUser({
            userId: data.clientPrincipal.userId,
            userDetails: email,
            userRoles: roles
          });

          // Check if user has organizer role
          if (!roles.includes('organizer')) {
            router.replace('/login?error=no_role');
          } else {
            // Restore selected session from localStorage if available
            const storedSessionId = localStorage.getItem('teacherActiveSessionId');
            if (storedSessionId) {
              setSelectedSessionId(storedSessionId);
            }
          }
        } else {
          router.push('/login');
        }
        setLoading(false);
      })
      .catch(() => {
        setLoading(false);
        router.replace('/login');
      });
  }, [router]);

  // Load organizer's sessions
  useEffect(() => {
    if (user) {
      loadSessions();
    }
  }, [user]);

  const loadSessions = async () => {
    try {
      // Use getAuthEndpoint helper
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || '/api';
      
      // Get fresh auth info
      const authEndpoint = getAuthEndpoint();
      const authResponse = await fetch(authEndpoint, { credentials: 'include' });
      const authData = await authResponse.json();
      
      if (!authData.clientPrincipal) {
        console.error('Not authenticated');
        return;
      }
      
      const headers = await getAuthHeaders();
      
      // Use email (userDetails) as organizer ID, not the generated userId
      const organizerId = authData.clientPrincipal.userDetails || authData.clientPrincipal.userId || '';
      // Use query parameter instead of path parameter to avoid URL encoding issues
      const response = await fetch(`${apiUrl}/organizer/sessions?organizerId=${encodeURIComponent(organizerId)}`, { credentials: 'include',
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
        console.error('Request URL:', `${apiUrl}/organizer/sessions?organizerId=${encodeURIComponent(organizerId)}`);
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
    // Store in localStorage for persistence
    localStorage.setItem('teacherActiveSessionId', sessionId);
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
        // Use getAuthEndpoint helper
        const authEndpoint = getAuthEndpoint();
        const authResponse = await fetch(authEndpoint, { credentials: 'include' });
        const authData = await authResponse.json();
        
        if (!authData.clientPrincipal) return;
        
        const headers = await getAuthHeaders();
        
        const endpoint = qrCodeData.type === 'ENTRY' ? 'entry-qr' : 'exit-qr';
        const response = await fetch(`${apiUrl}/sessions/${qrCodeData.sessionId}/${endpoint}`, { credentials: 'include', headers });
        
        if (!response.ok) {
          console.error(`Failed to refresh ${endpoint}:`, response.status);
          return;
        }
        
        const data = await response.json();
        
        if (!data.token) {
          console.error('No token in refresh response:', data);
          return;
        }
        
        const baseUrl = getQRBaseUrl();
        const studentUrl = `${baseUrl}/attendee?sessionId=${qrCodeData.sessionId}&type=${qrCodeData.type}&token=${data.token}`;
        console.log('QR REFRESH - baseUrl:', baseUrl);
        console.log('QR REFRESH - studentUrl:', studentUrl);
        console.log('QR REFRESH - token from Azure:', data.token);
        
        const qrDataUrl = await QRCode.toDataURL(studentUrl, {
          width: 300,
          margin: 2,
          color: {
            dark: '#000000',
            light: '#FFFFFF'
          }
        });
        
        setQrCodeData(prev => prev ? {
          ...prev,
          qrDataUrl,
          studentUrl,
          refreshIntervalMs: typeof data.refreshInterval === 'number' ? data.refreshInterval : prev.refreshIntervalMs,
          expiresAt: data.expiresAt
        } : null);
      } catch (err) {
        console.error('Failed to refresh QR code:', err);
      }
    };
    
    // Refresh immediately first, then by backend-provided interval
    refreshQR();
    const intervalMs = qrCodeData.refreshIntervalMs ?? 10000;
    const interval = setInterval(refreshQR, intervalMs);
    
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showQRModal, qrCodeData?.sessionId, qrCodeData?.type, qrCodeData?.refreshIntervalMs]);

  const handleShowEntryQR = async (session: Session) => {
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || '/api';
      
      // Get authentication
      // Use getAuthEndpoint helper
      const authEndpoint = getAuthEndpoint();
      const authResponse = await fetch(authEndpoint, { credentials: 'include' });
      const authData = await authResponse.json();
      
      if (!authData.clientPrincipal) {
        setError('Not authenticated');
        return;
      }
      
      const headers = await getAuthHeaders();
      
      // Get entry QR token from backend
      const response = await fetch(`${apiUrl}/sessions/${session.sessionId}/entry-qr`, { credentials: 'include', headers });
      
      if (!response.ok) {
        const error = await response.text();
        console.error('Entry QR API error:', response.status, error);
        throw new Error(`Failed to get entry QR code: ${response.status}`);
      }
      
      const data = await response.json();
      
      if (!data.token) {
        console.error('No token in response:', data);
        throw new Error('Server did not return a token');
      }
      
      // Create URL for students to scan
      const baseUrl = getQRBaseUrl();
      const studentUrl = `${baseUrl}/attendee?sessionId=${session.sessionId}&type=ENTRY&token=${data.token}`;
      console.log('ENTRY QR - baseUrl:', baseUrl);
      console.log('ENTRY QR - studentUrl:', studentUrl);
      console.log('ENTRY QR - token from Azure:', data.token);
      
      // Generate QR code with the URL
      const qrDataUrl = await QRCode.toDataURL(studentUrl, {
        width: 300,
        margin: 2,
        color: {
          dark: '#000000',
          light: '#FFFFFF'
        }
      });
      
      console.log('ENTRY QR - Final qrCodeData:', {
        sessionId: session.sessionId,
        eventId: session.eventId,
        type: 'ENTRY',
        qrDataUrl: qrDataUrl.substring(0, 50) + '...',
        studentUrl
      });
      setQrCodeData({
        sessionId: session.sessionId,
        eventId: session.eventId,
        type: 'ENTRY',
        qrDataUrl,
        studentUrl,
        refreshIntervalMs: typeof data.refreshInterval === 'number' ? data.refreshInterval : 10000,
        expiresAt: data.expiresAt
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
      // Use getAuthEndpoint helper
      const authEndpoint = getAuthEndpoint();
      const authResponse = await fetch(authEndpoint, { credentials: 'include' });
      const authData = await authResponse.json();
      
      if (!authData.clientPrincipal) {
        setError('Not authenticated');
        return;
      }
      
      const headers = await getAuthHeaders();
      
      // Get exit QR token from backend
      const response = await fetch(`${apiUrl}/sessions/${session.sessionId}/exit-qr`, { credentials: 'include', headers });
      
      if (!response.ok) {
        const error = await response.text();
        console.error('Exit QR API error:', response.status, error);
        throw new Error(`Failed to get exit QR code: ${response.status}`);
      }
      
      const data = await response.json();
      
      if (!data.token) {
        console.error('No token in response:', data);
        throw new Error('Server did not return a token');
      }
      
      // Create URL for students to scan
      const baseUrl = getQRBaseUrl();
      const studentUrl = `${baseUrl}/attendee?sessionId=${session.sessionId}&type=EXIT&token=${data.token}`;
      console.log('EXIT QR - baseUrl:', baseUrl);
      console.log('EXIT QR - studentUrl:', studentUrl);
      console.log('EXIT QR - token from Azure:', data.token);
      
      // Generate QR code with the URL
      const qrDataUrl = await QRCode.toDataURL(studentUrl, {
        width: 300,
        margin: 2,
        color: {
          dark: '#000000',
          light: '#FFFFFF'
        }
      });
      
      console.log('EXIT QR - Final qrCodeData:', {
        sessionId: session.sessionId,
        eventId: session.eventId,
        type: 'EXIT',
        qrDataUrl: qrDataUrl.substring(0, 50) + '...',
        studentUrl
      });
      setQrCodeData({
        sessionId: session.sessionId,
        eventId: session.eventId,
        type: 'EXIT',
        qrDataUrl,
        studentUrl,
        refreshIntervalMs: typeof data.refreshInterval === 'number' ? data.refreshInterval : 10000,
        expiresAt: data.expiresAt
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
      const message = `Are you sure you want to delete "${session.eventId}"?\n\nThis will delete:\n- ${session.status === 'ENDED' ? 'Historical' : 'Active'} attendance records\n- Session chains\n- Tokens\n- Scan logs\n\nThis action cannot be undone.`;
      
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
      // Use getAuthEndpoint helper
      const authEndpoint = getAuthEndpoint();
      const authResponse = await fetch(authEndpoint, { credentials: 'include' });
      const authData = await authResponse.json();
      
      if (!authData.clientPrincipal) {
        setError('Not authenticated');
        return;
      }
      
      const headers = await getAuthHeaders();
      
      // Call delete endpoint with scope parameter
      const url = new URL(`${apiUrl}/sessions/${sessionId}`, window.location.origin);
      url.searchParams.set('scope', scope);
      
      const response = await fetch(url.toString(), { credentials: 'include',
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

  if (!user || !user.userRoles.includes('organizer')) {
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
        <div style={{ marginBottom: '1.5rem', display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'center' }}>
          <button 
            onClick={() => {
              setSelectedSessionId(null);
              // Clear stored session when going back
              localStorage.removeItem('teacherActiveSessionId');
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
            ← Back to Sessions
          </button>
          
          {/* Entry QR Button */}
          <button 
            onClick={() => {
              if (currentSession) {
                handleShowEntryQR(currentSession);
              }
            }}
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
              boxShadow: '0 2px 8px rgba(72, 187, 120, 0.3)',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem'
            }}
            onMouseOver={(e) => {
              e.currentTarget.style.transform = 'translateY(-2px)';
              e.currentTarget.style.boxShadow = '0 4px 12px rgba(72, 187, 120, 0.4)';
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = '0 2px 8px rgba(72, 187, 120, 0.3)';
            }}
          >
            <span>📥</span>
            Entry QR
          </button>
          
          {/* Exit QR Button */}
          <button 
            onClick={() => {
              if (currentSession) {
                handleShowExitQR(currentSession);
              }
            }}
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
              boxShadow: '0 2px 8px rgba(237, 137, 54, 0.3)',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem'
            }}
            onMouseOver={(e) => {
              e.currentTarget.style.transform = 'translateY(-2px)';
              e.currentTarget.style.boxShadow = '0 4px 12px rgba(237, 137, 54, 0.4)';
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = '0 2px 8px rgba(237, 137, 54, 0.3)';
            }}
          >
            <span>📤</span>
            Exit QR
          </button>
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
              📚 {currentSession.eventId}
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
          currentUserId={user?.userDetails}
          onError={handleError}
        />
        
        {/* QR Code Modal for Dashboard */}
        {showQRModal && qrCodeData && (
          <QRCodeModal
            sessionId={qrCodeData.sessionId}
            eventId={qrCodeData.eventId}
            type={qrCodeData.type}
            qrDataUrl={qrCodeData.qrDataUrl}
            studentUrl={qrCodeData.studentUrl}
            expiresAt={qrCodeData.expiresAt}
            onClose={handleCloseQRModal}
          />
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
      <TeacherHeader 
        userDetails={user?.userDetails || ''}
        onResetView={() => {
          setShowCreateForm(false);
          setShowEditForm(false);
          setShowAttendeeListManager(false);
          setSelectedSessionForEdit(null);
        }}
      />

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
          {!showCreateForm && !showEditForm && !showAttendeeListManager ? (
            <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
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
              <button
                onClick={() => setShowAttendeeListManager(true)}
                style={{
                  padding: '1rem 2rem',
                  background: 'linear-gradient(135deg, #38b2ac 0%, #319795 100%)',
                  color: 'white',
                  border: 'none',
                  borderRadius: '12px',
                  cursor: 'pointer',
                  fontSize: '1.1rem',
                  fontWeight: '700',
                  boxShadow: '0 8px 24px rgba(56, 178, 172, 0.4)',
                  transition: 'all 0.3s',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.5rem'
                }}
                onMouseOver={(e) => {
                  e.currentTarget.style.transform = 'translateY(-2px)';
                  e.currentTarget.style.boxShadow = '0 12px 32px rgba(56, 178, 172, 0.5)';
                }}
                onMouseOut={(e) => {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = '0 8px 24px rgba(56, 178, 172, 0.4)';
                }}
              >
                <span style={{ fontSize: '1.5rem' }}>📋</span>
                Manage Attendee Lists
              </button>
            </div>
          ) : showAttendeeListManager ? (
            <div style={{
              padding: '2rem',
              backgroundColor: 'white',
              borderRadius: '16px',
              border: '2px solid #e2e8f0',
              boxShadow: '0 8px 32px rgba(0,0,0,0.08)'
            }}>
              <div style={{ marginBottom: '1rem' }}>
                <button
                  onClick={() => setShowAttendeeListManager(false)}
                  style={{
                    padding: '0.5rem 1rem',
                    backgroundColor: '#edf2f7',
                    color: '#4a5568',
                    border: 'none',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    fontSize: '0.9rem',
                    fontWeight: '600'
                  }}
                >
                  ← Back to Sessions
                </button>
              </div>
              <AttendeeListManager />
            </div>
          ) : (
            <div style={{
              padding: '2rem',
              backgroundColor: 'white',
              borderRadius: '16px',
              border: '2px solid #e2e8f0',
              boxShadow: '0 8px 32px rgba(0,0,0,0.08)'
            }}>
              <SessionCreationForm
                organizerId={user?.userId || ''}
                teacherEmail={user?.userDetails || ''}
                onSessionCreated={showEditForm ? handleEditComplete : handleSessionCreated}
                mode={showEditForm ? 'edit' : 'create'}
                sessionToEdit={showEditForm && selectedSessionForEdit ? selectedSessionForEdit : undefined}
                onCancel={showEditForm ? handleEditCancel : () => setShowCreateForm(false)}
              />
            </div>
          )}
        </div>

        {/* Active Sessions List - Hidden when creating/editing/managing attendee lists */}
        {!showCreateForm && !showEditForm && !showAttendeeListManager && (
        <SessionsList
          sessions={sessions}
          onDashboard={(session) => {
            setSelectedSessionId(session.sessionId);
            // Store in localStorage for persistence
            localStorage.setItem('teacherActiveSessionId', session.sessionId);
          }}
          onEntryQR={handleShowEntryQR}
          onExitQR={handleShowExitQR}
          onEdit={handleEditSession}
          onDelete={handleDeleteSession}
        />
        )}
      </div>

      {/* QR Code Modal */}
      {showQRModal && qrCodeData && (
        <QRCodeModal
          sessionId={qrCodeData.sessionId}
          eventId={qrCodeData.eventId}
          type={qrCodeData.type}
          qrDataUrl={qrCodeData.qrDataUrl}
          studentUrl={qrCodeData.studentUrl}
          expiresAt={qrCodeData.expiresAt}
          refreshIntervalMs={qrCodeData.refreshIntervalMs}
          onClose={handleCloseQRModal}
        />
      )}

      {/* Delete Confirmation Modal for Recurring Sessions */}
      {showDeleteConfirm && selectedSessionForDelete && (
        <DeleteConfirmModal
          session={selectedSessionForDelete}
          scope={deleteScope}
          onScopeChange={setDeleteScope}
          onConfirm={() => performDeleteSession(selectedSessionForDelete.sessionId, deleteScope)}
          onCancel={() => setShowDeleteConfirm(false)}
        />
      )}
    </div>
  );
}






