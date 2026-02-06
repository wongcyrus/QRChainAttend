/**
 * Simple Student Session View
 * Students scan QR codes with their phone camera (external app)
 * This view only shows status and their own QR code when they're a holder
 */

import { useState, useEffect } from 'react';
import QRCode from 'qrcode';
import * as signalR from '@microsoft/signalr';

interface SimpleStudentViewProps {
  sessionId: string;
  studentId: string;
  onLeaveSession?: () => void;
}

interface SessionInfo {
  classId: string;
  startAt: string;
  endAt?: string;
  status: string;
}

interface StudentStatus {
  isHolder: boolean;
  entryStatus?: string;
  exitVerified: boolean;
  holderTokenUrl?: string;
  tokenExpiresAt?: number;
}

export function SimpleStudentView({ sessionId, studentId, onLeaveSession }: SimpleStudentViewProps) {
  const [session, setSession] = useState<SessionInfo | null>(null);
  const [status, setStatus] = useState<StudentStatus>({
    isHolder: false,
    exitVerified: false
  });
  const [qrCodeUrl, setQrCodeUrl] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'connected' | 'disconnected'>('connecting');
  const [timeRemaining, setTimeRemaining] = useState<number>(0);
  const [scanMessage, setScanMessage] = useState<string | null>(null);

  // Check URL parameters for scan simulation (when clicking QR URL in dev mode)
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const chainId = urlParams.get('chainId');
    const tokenId = urlParams.get('tokenId');
    const type = urlParams.get('type');

    if (chainId && tokenId && type === 'entry') {
      // Simulate scanning by calling the scan API
      handleScan(chainId, tokenId);
      
      // Clean up URL parameters
      window.history.replaceState({}, '', `/student?sessionId=${sessionId}`);
    }
  }, [sessionId]);

  const handleScan = async (chainId: string, tokenId: string) => {
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || '/api';
      
      const headers: HeadersInit = {
        'Content-Type': 'application/json'
      };
      
      const isLocal = process.env.NEXT_PUBLIC_ENVIRONMENT === 'local';
      if (isLocal) {
        const mockPrincipal = {
          userId: studentId,
          userDetails: studentId,
          userRoles: ['authenticated', 'student'],
          identityProvider: 'aad'
        };
        headers['x-ms-client-principal'] = Buffer.from(JSON.stringify(mockPrincipal)).toString('base64');
      } else {
        const authResponse = await fetch('/.auth/me', { credentials: 'include' });
        const authData = await authResponse.json();
        if (authData.clientPrincipal) {
          headers['x-ms-client-principal'] = Buffer.from(JSON.stringify(authData.clientPrincipal)).toString('base64');
        } else {
          throw new Error('Not authenticated');
        }
      }

      const response = await fetch(`${apiUrl}/sessions/${sessionId}/chains/${chainId}/scan`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ tokenId })
      });

      if (response.ok) {
        const data = await response.json();
        setScanMessage(`✓ Scan successful! You are now the chain holder (seq ${data.seq})`);
        // Refresh data to show updated status
        setTimeout(() => {
          fetchData();
          setScanMessage(null);
        }, 2000);
      } else {
        const errorData = await response.json();
        setScanMessage(`✗ Scan failed: ${errorData.error?.message || 'Unknown error'}`);
        setTimeout(() => setScanMessage(null), 5000);
      }
    } catch (err) {
      setScanMessage(`✗ Scan failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
      setTimeout(() => setScanMessage(null), 5000);
    }
  };

  // Fetch session and student status
  const fetchData = async () => {
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || '/api';
      
      // Create auth headers
      const headers: HeadersInit = {
        'Content-Type': 'application/json'
      };
      
      const isLocal = process.env.NEXT_PUBLIC_ENVIRONMENT === 'local';
      if (isLocal) {
        const mockPrincipal = {
          userId: studentId,
          userDetails: 'student@stu.vtc.edu.hk',
          userRoles: ['authenticated', 'student'],
          identityProvider: 'aad'
        };
        headers['x-ms-client-principal'] = Buffer.from(JSON.stringify(mockPrincipal)).toString('base64');
      } else {
        const authResponse = await fetch('/.auth/me', { credentials: 'include' });
        const authData = await authResponse.json();
        if (authData.clientPrincipal) {
          headers['x-ms-client-principal'] = Buffer.from(JSON.stringify(authData.clientPrincipal)).toString('base64');
        } else {
          throw new Error('Not authenticated');
        }
      }
      
      // Fetch session info
      const sessionRes = await fetch(`${apiUrl}/sessions/${sessionId}`, { headers });
      if (sessionRes.ok) {
        const data = await sessionRes.json();
        setSession({
          classId: data.session.classId,
          startAt: data.session.startAt,
          endAt: data.session.endAt,
          status: data.session.status
        });
        
        // Check if student is in attendance
        const myAttendance = data.attendance?.find((a: any) => a.studentId === studentId);
        if (myAttendance) {
          setStatus(prev => ({
            ...prev,
            entryStatus: myAttendance.entryStatus,
            exitVerified: myAttendance.exitVerified || false
          }));
        }
      }
      
      // Check if student is a holder by looking for active tokens
      try {
        const tokensRes = await fetch(`${apiUrl}/sessions/${sessionId}/tokens/${studentId}`, { headers });
        if (tokensRes.ok) {
          const tokenData = await tokensRes.json();
          if (tokenData.isHolder && tokenData.token && tokenData.chainId) {
            // Student is a holder - generate QR URL
            const baseUrl = process.env.NEXT_PUBLIC_FRONTEND_URL || window.location.origin;
            const holderUrl = `${baseUrl}/student?sessionId=${sessionId}&chainId=${tokenData.chainId}&tokenId=${tokenData.token}&type=entry`;
            
            setStatus(prev => ({
              ...prev,
              isHolder: true,
              holderTokenUrl: holderUrl,
              tokenExpiresAt: tokenData.expiresAt
            }));
          } else {
            setStatus(prev => ({
              ...prev,
              isHolder: false,
              holderTokenUrl: undefined,
              tokenExpiresAt: undefined
            }));
          }
        } else {
          // Token endpoint not available or student not a holder
          setStatus(prev => ({
            ...prev,
            isHolder: false,
            holderTokenUrl: undefined,
            tokenExpiresAt: undefined
          }));
        }
      } catch (tokenErr) {
        // Ignore token fetch errors - student is just not a holder
        console.log('Token check failed (expected if endpoint not deployed):', tokenErr);
      }
      
      setLoading(false);
    } catch (err) {
      setError('Failed to load session');
      setLoading(false);
    }
  };

  // Initial load
  useEffect(() => {
    fetchData();
  }, [sessionId, studentId]);

  // Setup SignalR connection
  useEffect(() => {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || '/api';
    
    let connection: signalR.HubConnection | null = null;
    let heartbeatInterval: NodeJS.Timeout | null = null;
    
    // Report online status
    const reportOnlineStatus = async (isOnline: boolean) => {
      const headers: HeadersInit = {
        'Content-Type': 'application/json'
      };
      
      const isLocal = process.env.NEXT_PUBLIC_ENVIRONMENT === 'local';
      if (isLocal) {
        const mockPrincipal = {
          userId: studentId,
          userDetails: studentId, // studentId is now the email
          userRoles: ['authenticated', 'student'],
          identityProvider: 'aad'
        };
        headers['x-ms-client-principal'] = Buffer.from(JSON.stringify(mockPrincipal)).toString('base64');
      } else {
        const authResponse = await fetch('/.auth/me', { credentials: 'include' });
        const authData = await authResponse.json();
        if (authData.clientPrincipal) {
          headers['x-ms-client-principal'] = Buffer.from(JSON.stringify(authData.clientPrincipal)).toString('base64');
        }
      }
      
      try {
        const response = await fetch(`${apiUrl}/sessions/${sessionId}/student-online`, {
          method: 'POST',
          headers,
          body: JSON.stringify({ isOnline })
        });
        
        if (!response.ok) {
          console.error('Failed to report online status:', response.status, await response.text());
        } else {
          console.log(`Online status reported: ${isOnline}`);
        }
      } catch (err) {
        console.error('Failed to report online status:', err);
      }
    };
    
    // Get negotiate endpoint
    const getNegotiateUrl = async () => {
      const headers: HeadersInit = {
        'Content-Type': 'application/json'
      };
      
      const isLocal = process.env.NEXT_PUBLIC_ENVIRONMENT === 'local';
      if (isLocal) {
        const mockPrincipal = {
          userId: studentId,
          userDetails: studentId, // studentId is now the email
          userRoles: ['authenticated', 'student'],
          identityProvider: 'aad'
        };
        headers['x-ms-client-principal'] = Buffer.from(JSON.stringify(mockPrincipal)).toString('base64');
      } else {
        const authResponse = await fetch('/.auth/me', { credentials: 'include' });
        const authData = await authResponse.json();
        if (authData.clientPrincipal) {
          headers['x-ms-client-principal'] = Buffer.from(JSON.stringify(authData.clientPrincipal)).toString('base64');
        }
      }
      
      try {
        const response = await fetch(`${apiUrl}/sessions/${sessionId}/negotiate`, { headers });
        if (response.ok) {
          return await response.json();
        }
      } catch (err) {
        console.log('SignalR negotiate failed, will use polling fallback');
      }
      return null;
    };

    const setupSignalR = async () => {
      // Report online immediately
      await reportOnlineStatus(true);
      
      // Setup heartbeat to keep online status fresh
      heartbeatInterval = setInterval(() => {
        reportOnlineStatus(true);
      }, 15000); // Every 15 seconds
      
      const negotiateData = await getNegotiateUrl();
      
      if (negotiateData && negotiateData.url) {
        // SignalR available - use it
        connection = new signalR.HubConnectionBuilder()
          .withUrl(negotiateData.url, {
            accessTokenFactory: () => negotiateData.accessToken
          })
          .withAutomaticReconnect()
          .build();

        connection.on('sessionUpdated', () => {
          console.log('SignalR: Session updated');
          fetchData();
        });

        connection.on('attendanceUpdated', () => {
          console.log('SignalR: Attendance updated');
          fetchData();
        });

        connection.on('chainUpdated', () => {
          console.log('SignalR: Chain updated');
          fetchData();
        });

        connection.onreconnecting(() => {
          setConnectionStatus('connecting');
        });

        connection.onreconnected(() => {
          setConnectionStatus('connected');
          reportOnlineStatus(true); // Report online after reconnection
          fetchData(); // Refresh data after reconnection
        });

        connection.onclose(() => {
          setConnectionStatus('disconnected');
          // Don't fall back to polling - SignalR should reconnect automatically
        });

        try {
          await connection.start();
          setConnectionStatus('connected');
          console.log('SignalR connected');
        } catch (err) {
          console.log('SignalR connection failed');
          setConnectionStatus('disconnected');
          // Don't use polling - rely on SignalR automatic reconnection
        }
      } else {
        // SignalR not available in local dev - this is expected
        console.log('SignalR not configured (local development mode)');
        setConnectionStatus('disconnected');
      }
    };

    setupSignalR();

    // Report offline when component unmounts
    return () => {
      if (heartbeatInterval) {
        clearInterval(heartbeatInterval);
      }
      reportOnlineStatus(false);
      if (connection) {
        connection.stop();
      }
    };
  }, [sessionId, studentId]);

  // Generate QR code when student becomes holder
  useEffect(() => {
    if (status.isHolder && status.holderTokenUrl) {
      QRCode.toDataURL(status.holderTokenUrl, {
        width: 300,
        margin: 2
      }).then(setQrCodeUrl).catch(console.error);
    }
  }, [status.isHolder, status.holderTokenUrl]);

  // Countdown timer for token expiration
  useEffect(() => {
    if (!status.isHolder || !status.tokenExpiresAt) {
      setTimeRemaining(0);
      return;
    }

    const updateTimer = () => {
      const now = Date.now();
      const remaining = Math.max(0, Math.floor((status.tokenExpiresAt! - now) / 1000));
      setTimeRemaining(remaining);

      if (remaining === 0) {
        // Token expired - refresh to get new status
        fetchData();
      }
    };

    // Update immediately
    updateTimer();

    // Update every second
    const interval = setInterval(updateTimer, 1000);

    return () => clearInterval(interval);
  }, [status.isHolder, status.tokenExpiresAt]);

  if (loading) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center' }}>
        <p>Loading session...</p>
      </div>
    );
  }

  if (error || !session) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center' }}>
        <p style={{ color: '#d13438' }}>{error || 'Session not found'}</p>
        {onLeaveSession && (
          <button onClick={onLeaveSession} style={{
            padding: '0.75rem 1.5rem',
            backgroundColor: '#666',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
            marginTop: '1rem'
          }}>
            Back
          </button>
        )}
      </div>
    );
  }

  const formatTime = (isoString?: string) => {
    if (!isoString) return 'Not set';
    try {
      return new Date(isoString).toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return 'Invalid';
    }
  };

  return (
    <div style={{
      padding: '2rem',
      maxWidth: '600px',
      margin: '0 auto',
      fontFamily: 'system-ui, sans-serif'
    }}>
      {/* Scan Message */}
      {scanMessage && (
        <div style={{
          position: 'fixed',
          top: '20px',
          left: '50%',
          transform: 'translateX(-50%)',
          padding: '1rem 2rem',
          backgroundColor: scanMessage.startsWith('✓') ? '#d4edda' : '#f8d7da',
          color: scanMessage.startsWith('✓') ? '#155724' : '#721c24',
          border: `2px solid ${scanMessage.startsWith('✓') ? '#c3e6cb' : '#f5c6cb'}`,
          borderRadius: '8px',
          boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
          zIndex: 1000,
          fontSize: '1rem',
          fontWeight: '600',
          maxWidth: '90%',
          textAlign: 'center'
        }}>
          {scanMessage}
        </div>
      )}

      {/* Header with connection status */}
      <div style={{ marginBottom: '2rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h1 style={{ margin: '0 0 0.5rem 0' }}>Class Session</h1>
            <p style={{ margin: 0, color: '#666', fontSize: '1.1rem' }}>{session.classId}</p>
          </div>
          <div style={{ textAlign: 'right', fontSize: '0.875rem' }}>
            {connectionStatus === 'connected' && (
              <span style={{ color: '#107c10' }}>🟢 Live</span>
            )}
            {connectionStatus === 'connecting' && (
              <span style={{ color: '#ff8c00' }}>🟡 Connecting...</span>
            )}
            {connectionStatus === 'disconnected' && (
              <span style={{ color: '#666' }}>⚪ Polling</span>
            )}
          </div>
        </div>
        
        {/* Student Email Display */}
        <div style={{
          marginTop: '1rem',
          padding: '0.75rem 1rem',
          backgroundColor: '#e3f2fd',
          borderRadius: '8px',
          border: '1px solid #90caf9',
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem'
        }}>
          <span style={{ fontSize: '1.2rem' }}>👤</span>
          <div>
            <div style={{ fontSize: '0.75rem', color: '#1976d2', fontWeight: '600' }}>
              Logged in as:
            </div>
            <div style={{ fontSize: '0.95rem', color: '#0d47a1', fontWeight: '500', fontFamily: 'monospace' }}>
              {studentId}
            </div>
          </div>
        </div>
      </div>

      {/* Session Info */}
      <div style={{
        backgroundColor: 'white',
        padding: '1.5rem',
        borderRadius: '8px',
        border: '1px solid #ddd',
        marginBottom: '1.5rem'
      }}>
        <div style={{ marginBottom: '0.75rem' }}>
          <span style={{ color: '#666' }}>Start Time: </span>
          <strong>{formatTime(session.startAt)}</strong>
        </div>
        <div style={{ marginBottom: '0.75rem' }}>
          <span style={{ color: '#666' }}>End Time: </span>
          <strong>{formatTime(session.endAt)}</strong>
        </div>
        <div>
          <span style={{ color: '#666' }}>Status: </span>
          <span style={{
            padding: '0.25rem 0.75rem',
            backgroundColor: session.status === 'ACTIVE' ? '#107c10' : '#666',
            color: 'white',
            borderRadius: '12px',
            fontSize: '0.875rem',
            fontWeight: 'bold'
          }}>
            {session.status}
          </span>
        </div>
      </div>

      {/* Student Status */}
      {status.entryStatus && (
        <div style={{
          backgroundColor: '#e8f5e9',
          padding: '1.5rem',
          borderRadius: '8px',
          marginBottom: '1.5rem'
        }}>
          <h2 style={{ margin: '0 0 1rem 0', fontSize: '1.2rem' }}>Your Status</h2>
          <div style={{ marginBottom: '0.5rem' }}>
            <span style={{ color: '#666' }}>Entry: </span>
            <strong>{status.entryStatus === 'PRESENT_ENTRY' ? 'Present' : 'Late'}</strong>
          </div>
          {status.exitVerified && (
            <div>
              <span style={{ color: '#666' }}>Exit: </span>
              <strong style={{ color: '#107c10' }}>✓ Verified</strong>
            </div>
          )}
        </div>
      )}

      {/* Holder QR Code */}
      {status.isHolder && qrCodeUrl && (
        <div style={{
          backgroundColor: '#fff3cd',
          padding: '1.5rem',
          borderRadius: '8px',
          textAlign: 'center',
          marginBottom: '1.5rem',
          border: timeRemaining <= 5 ? '3px solid #dc3545' : '1px solid #ffc107'
        }}>
          <h2 style={{ margin: '0 0 0.5rem 0', fontSize: '1.2rem', color: '#856404' }}>
            🎯 You are the Chain Holder!
          </h2>
          
          {/* Countdown Timer */}
          <div style={{
            margin: '0 0 1rem 0',
            padding: '0.5rem 1rem',
            backgroundColor: timeRemaining <= 5 ? '#dc3545' : timeRemaining <= 10 ? '#ffc107' : '#28a745',
            color: 'white',
            borderRadius: '20px',
            display: 'inline-block',
            fontWeight: 'bold',
            fontSize: '1.1rem',
            minWidth: '100px',
            transition: 'all 0.3s ease'
          }}>
            {timeRemaining > 0 ? (
              <>⏱️ {timeRemaining}s</>
            ) : (
              <>⏰ Expired</>
            )}
          </div>
          
          <p style={{ marginBottom: '1rem', color: '#856404' }}>
            {timeRemaining > 0 
              ? 'Show this QR code to another student' 
              : 'Token expired - waiting for refresh...'}
          </p>
          
          {timeRemaining > 0 && (
            <div style={{
              display: 'inline-block',
              padding: '1rem',
              backgroundColor: 'white',
              borderRadius: '8px'
            }}>
              <img src={qrCodeUrl} alt="Your chain QR code" />
            </div>
          )}
          
          {/* Development: Show URL for easy testing */}
          {process.env.NEXT_PUBLIC_ENVIRONMENT === 'local' && status.holderTokenUrl && timeRemaining > 0 && (
            <div style={{
              marginTop: '1rem',
              padding: '1rem',
              backgroundColor: '#f8f9fa',
              borderRadius: '4px',
              border: '1px dashed #6c757d'
            }}>
              <p style={{ 
                margin: '0 0 0.5rem 0', 
                fontSize: '0.875rem', 
                color: '#6c757d',
                fontWeight: 'bold'
              }}>
                🔧 Development Mode - QR Code URL:
              </p>
              <input
                type="text"
                readOnly
                value={status.holderTokenUrl}
                onClick={(e) => e.currentTarget.select()}
                style={{
                  width: '100%',
                  padding: '0.5rem',
                  fontSize: '0.75rem',
                  fontFamily: 'monospace',
                  border: '1px solid #ced4da',
                  borderRadius: '4px',
                  backgroundColor: 'white',
                  cursor: 'pointer'
                }}
              />
              <p style={{ 
                margin: '0.5rem 0 0 0', 
                fontSize: '0.75rem', 
                color: '#6c757d'
              }}>
                💡 Click to select, then copy and paste into another browser tab to simulate scanning
              </p>
            </div>
          )}
        </div>
      )}

      {/* Instructions */}
      {!status.entryStatus && (
        <div style={{
          backgroundColor: '#f5f5f5',
          padding: '1.5rem',
          borderRadius: '8px',
          marginBottom: '1.5rem'
        }}>
          <h2 style={{ margin: '0 0 1rem 0', fontSize: '1.2rem' }}>Waiting for Attendance</h2>
          <p style={{ margin: '0 0 1rem 0', color: '#666' }}>
            You've joined the session successfully. Waiting for the teacher to start attendance...
          </p>
          <div style={{ 
            backgroundColor: '#e3f2fd', 
            padding: '1rem', 
            borderRadius: '4px'
          }}>
            <strong>What happens next:</strong>
            <ul style={{ margin: '0.5rem 0 0 0', paddingLeft: '1.5rem' }}>
              <li style={{ marginBottom: '0.5rem' }}>Some students will see a QR code appear on this page</li>
              <li style={{ marginBottom: '0.5rem' }}>If you see a QR code: Show it to another student to scan</li>
              <li style={{ marginBottom: '0.5rem' }}>If you don't see a QR code: Scan another student's QR code with your phone camera</li>
              <li>This page updates automatically!</li>
            </ul>
          </div>
        </div>
      )}

      {/* Leave Button */}
      {onLeaveSession && (
        <button onClick={onLeaveSession} style={{
          padding: '0.75rem 1.5rem',
          backgroundColor: '#666',
          color: 'white',
          border: 'none',
          borderRadius: '4px',
          cursor: 'pointer',
          width: '100%',
          fontSize: '1rem'
        }}>
          Leave Session
        </button>
      )}
    </div>
  );
}
