/**
 * Attendee Session View Page
 */

import { useEffect, useState } from 'react';
import { getAuthHeaders, getAuthEndpoint } from '../utils/authHeaders';
import { useRouter } from 'next/router';
import { SimpleAttendeeView } from '../components/SimpleAttendeeView';
import { getCurrentLocationWithError } from '../utils/geolocation';

interface UserInfo {
  userId: string;
  userDetails: string;
  userRoles: string[];
}

export default function AttendeePage() {
  const router = useRouter();
  const [user, setUser] = useState<UserInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [locationWarning, setLocationWarning] = useState<string | null>(null);
  const [hasAutoJoined, setHasAutoJoined] = useState(false);
  const [mounted, setMounted] = useState(false);
  
  
  // Get query params safely (only after mounting and router is ready)
  // Fallback to localStorage if query param is missing
  const sessionIdFromQuery = (mounted && router.isReady) ? router.query.sessionId : undefined;
  const sessionIdFromStorage = (typeof window !== 'undefined') ? localStorage.getItem('activeSessionId') : null;
  const sessionId = sessionIdFromQuery || sessionIdFromStorage || undefined;
  
  console.log('[AttendeePage] SessionId sources:', {
    fromQuery: sessionIdFromQuery,
    fromStorage: sessionIdFromStorage,
    final: sessionId
  });
  
  const type = (mounted && router.isReady) ? router.query.type : undefined;
  const token = (mounted && router.isReady) ? router.query.token : undefined;
  const chainId = (mounted && router.isReady) ? router.query.chainId : undefined;
  const tokenId = (mounted && router.isReady) ? router.query.tokenId : undefined;

  // Handle mounting to prevent SSR issues
  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return; // Don't run on server-side
    
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

          // Check if user has attendee role
          if (!roles.includes('attendee')) {
            router.replace('/login?error=no_role');
          } else {
            // If no sessionId in URL, check localStorage for active session
            if (!sessionId && typeof window !== 'undefined') {
              const storedSessionId = localStorage.getItem('activeSessionId');
              if (storedSessionId) {
                // Restore session from localStorage
                router.replace(`/attendee?sessionId=${storedSessionId}`, undefined, { shallow: true });
              }
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
  }, [router, sessionId, mounted]);

  // Reset hasAutoJoined when token changes (new QR scan)
  useEffect(() => {
    if (!mounted) return; // Don't run on server-side
    
    if (token) {
      console.log('[AttendeePage] Token changed, resetting hasAutoJoined:', token);
      setHasAutoJoined(false);
    }
  }, [token, mounted]);

  // Separate effect for auto-join to avoid infinite loop
  /* eslint-disable react-hooks/exhaustive-deps */
  useEffect(() => {
    if (!mounted) return; // Don't run on server-side
    
    // Check if this is a chain scan URL (has chainId and tokenId)
    const isChainScan = chainId && tokenId;
    
    // Only auto-join for organizer's entry/exit QR codes (has type parameter)
    // Don't auto-join when just restoring from localStorage (no type parameter)
    const hasQRType = type !== undefined;
    
    console.log('[AttendeePage] Auto-join check:', {
      user: !!user,
      sessionId,
      hasQRType,
      hasAutoJoined,
      joining,
      isChainScan
    });
    
    if (user && sessionId && typeof sessionId === 'string' && hasQRType && !hasAutoJoined && !joining && !isChainScan) {
      console.log('[AttendeePage] Triggering auto-join');
      setHasAutoJoined(true);
      const qrType = typeof type === 'string' ? type : undefined;
      const qrToken = typeof token === 'string' ? token : undefined;
      handleJoinSession(sessionId, qrType, qrToken);
    }
  }, [user, sessionId, type, token, chainId, tokenId, hasAutoJoined, joining, mounted, router.isReady]);

  const handleJoinSession = async (sessionIdToJoin: string, qrType?: string, qrToken?: string) => {
    if (!user) return;
    
    setJoining(true);
    setError(null);
    setLocationWarning(null);
    
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || '/api';
      
      // Try to get location with detailed error
      const { location, error: locationError, errorCode } = await getCurrentLocationWithError();
      
      // Show location warning if location is not available
      if (!location && locationError) {
        setLocationWarning(locationError);
        
        // If permission denied, show a more prominent warning
        if (errorCode === 'PERMISSION_DENIED') {
          // Continue with join but warn user
          console.warn('Location permission denied, continuing without location');
        }
      }
      
      // Create headers with authentication
      const headers = await getAuthHeaders();
      
      // Handle ENTRY or EXIT based on QR type
      if (qrType === 'ENTRY') {
        // Mark entry with token validation
        const response = await fetch(`${apiUrl}/sessions/${sessionIdToJoin}/join`, { credentials: 'include',
          method: 'POST',
          headers,
          body: JSON.stringify({ 
            token: qrToken,
            location // Include location if available
          })
        });
        
        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.error?.message || 'Failed to mark entry');
        }
        
        // Store session in localStorage for persistence across refreshes
        if (typeof window !== 'undefined') {
          localStorage.setItem('activeSessionId', sessionIdToJoin);
          console.log('[AttendeePage] Saved to localStorage:', localStorage.getItem('activeSessionId'));
        }
        
        // Don't navigate - just let the component re-render with the new state
        console.log('[AttendeePage] Join complete, component will re-render');
        // The sessionId from localStorage will be picked up on next render
        
      } else if (qrType === 'EXIT') {
        // Mark exit with token validation
        const response = await fetch(`${apiUrl}/sessions/${sessionIdToJoin}/exit`, { credentials: 'include',
          method: 'POST',
          headers,
          body: JSON.stringify({ 
            token: qrToken,
            location // Include location if available
          })
        });
        
        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.error?.message || 'Failed to mark exit');
        }
        
        // Clear session from localStorage when exiting
        if (typeof window !== 'undefined') {
          localStorage.removeItem('activeSessionId');
        }
        
        // Successfully marked exit - show success message and redirect
        alert('Exit marked successfully! You can now leave.');
        router.push('/attendee');
        
      } else {
        // No type specified - just join the session (backward compatibility)
        const response = await fetch(`${apiUrl}/sessions/${sessionIdToJoin}/join`, { credentials: 'include',
          method: 'POST',
          headers,
          body: JSON.stringify({ location }) // Include location if available
        });
        
        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.error?.message || 'Failed to join session');
        }
        
        // Store session in localStorage for persistence across refreshes
        if (typeof window !== 'undefined') {
          localStorage.setItem('activeSessionId', sessionIdToJoin);
        }
        
        // Successfully joined - navigate to session view
        router.push(`/attendee?sessionId=${sessionIdToJoin}`);
      }
      
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to process request';
      setError(errorMessage);
      setHasAutoJoined(false); // Allow retry
      
      // Clear URL parameters so user sees the error page
      router.replace('/attendee', undefined, { shallow: true });
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

  if (!user || !user.userRoles.includes('attendee')) {
    return null;
  }

  // Show loading state when joining
  if (joining) {
    return (
      <div style={{ 
        padding: '2rem', 
        fontFamily: 'system-ui, sans-serif',
        maxWidth: '600px',
        margin: '0 auto',
        textAlign: 'center'
      }}>
        <div style={{ 
          fontSize: '4rem', 
          marginBottom: '1rem',
          animation: 'pulse 1.5s ease-in-out infinite'
        }}>
          ⏳
        </div>
        <h2 style={{ margin: '0 0 0.5rem 0' }}>Joining Session...</h2>
        <p style={{ color: '#666' }}>Please wait while we verify your entry.</p>
      </div>
    );
  }

  // If sessionId in query and already joined, show session view
  // BUT: Don't show if there's an error (failed to join)
  // ALSO: Don't show if we're about to auto-join (has type parameter but hasn't joined yet)
  // Chain scan URLs have both chainId + tokenId — they must NOT trigger auto-join;
  // instead SimpleAttendeeView handles them via its URL-params useEffect.
  const isChainScanUrl = !!(chainId && tokenId);
  const needsAutoJoin = type !== undefined && !hasAutoJoined && !isChainScanUrl;
  
  if (sessionId && typeof sessionId === 'string' && !error && !needsAutoJoin) {
    return (
      <SimpleAttendeeView 
        sessionId={sessionId}
        attendeeId={user.userDetails}
        onLeaveSession={() => {
          // Clear stored session when leaving
          if (typeof window !== 'undefined') {
            localStorage.removeItem('activeSessionId');
          }
          router.push('/attendee');
        }}
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
      <div style={{ 
        marginBottom: '2rem',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
      }}>
        <div>
          <h1 style={{ margin: '0 0 0.5rem 0' }}>Attendee View</h1>
          <p style={{ margin: 0, color: '#666' }}>Welcome, {user.userDetails}</p>
        </div>
        <button 
          onClick={async () => {
            const isLocal = process.env.NEXT_PUBLIC_ENVIRONMENT === 'local';
            const { clearAuthCache } = await import('../utils/authHeaders');
            clearAuthCache();
            
            if (isLocal) {
              await fetch('/api/auth/logout', {
                method: 'POST',
                credentials: 'include'
              });
              window.location.href = '/login';
            } else {
              const apiUrl = process.env.NEXT_PUBLIC_API_URL || '/api';
              await fetch(`${apiUrl}/auth/logout`, {
                method: 'POST',
                credentials: 'include'
              });
              window.location.href = '/login';
            }
          }}
          style={{
            padding: '0.5rem 1rem',
            backgroundColor: 'white',
            color: '#d13438',
            border: '2px solid #d13438',
            borderRadius: '8px',
            cursor: 'pointer',
            fontSize: '0.875rem',
            fontWeight: '600',
            transition: 'all 0.2s'
          }}
          onMouseOver={(e) => {
            e.currentTarget.style.backgroundColor = '#d13438';
            e.currentTarget.style.color = 'white';
          }}
          onMouseOut={(e) => {
            e.currentTarget.style.backgroundColor = 'white';
            e.currentTarget.style.color = '#d13438';
          }}
        >
          🚪 Logout
        </button>
      </div>

      {locationWarning && (
        <div style={{
          padding: '1.5rem',
          backgroundColor: '#fff5e6',
          border: '2px solid #ff9800',
          borderRadius: '8px',
          marginBottom: '1.5rem',
          color: '#e65100'
        }}>
          <div style={{ 
            fontSize: '2rem', 
            marginBottom: '0.5rem',
            textAlign: 'center'
          }}>
            📍
          </div>
          <div style={{ 
            fontSize: '1.1rem', 
            fontWeight: 'bold',
            marginBottom: '0.5rem',
            textAlign: 'center'
          }}>
            Location Access Required
          </div>
          <div style={{ textAlign: 'center', marginBottom: '1rem' }}>
            {locationWarning}
          </div>
          <div style={{
            padding: '1rem',
            backgroundColor: '#fff',
            border: '1px solid #ff9800',
            borderRadius: '4px',
            fontSize: '0.9rem',
            lineHeight: '1.6'
          }}>
            <strong>How to enable location:</strong>
            <ol style={{ margin: '0.5rem 0 0 0', paddingLeft: '1.5rem' }}>
              <li>Click the location icon in your browser's address bar</li>
              <li>Select "Allow" or "Always allow"</li>
              <li>Refresh this page and try again</li>
            </ol>
          </div>
          <button
            onClick={() => setLocationWarning(null)}
            style={{
              marginTop: '1rem',
              padding: '0.5rem 1rem',
              backgroundColor: '#ff9800',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              width: '100%',
              fontSize: '0.95rem',
              fontWeight: '600'
            }}
          >
            I Understand
          </button>
        </div>
      )}

      {error && (
        <div style={{
          padding: '1.5rem',
          backgroundColor: '#fef0f0',
          border: '2px solid #d13438',
          borderRadius: '8px',
          marginBottom: '1.5rem',
          color: '#d13438'
        }}>
          <div style={{ 
            fontSize: '2rem', 
            marginBottom: '0.5rem',
            textAlign: 'center'
          }}>
            ❌
          </div>
          <div style={{ 
            fontSize: '1.1rem', 
            fontWeight: 'bold',
            marginBottom: '0.5rem',
            textAlign: 'center'
          }}>
            Failed to Join Session
          </div>
          <div style={{ textAlign: 'center' }}>
            {error}
          </div>
          {error.includes('expired') && (
            <div style={{
              marginTop: '1rem',
              padding: '1rem',
              backgroundColor: '#fff5e6',
              border: '1px solid #ff9800',
              borderRadius: '4px',
              color: '#e65100',
              fontSize: '0.9rem'
            }}>
              <strong>💡 Tip:</strong> QR codes expire after 20 seconds. Ask your organizer to show the QR code again.
            </div>
          )}
          <button
            onClick={() => setError(null)}
            style={{
              marginTop: '1rem',
              padding: '0.5rem 1rem',
              backgroundColor: '#d13438',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              width: '100%',
              fontSize: '0.95rem',
              fontWeight: '600'
            }}
          >
            Try Again
          </button>
        </div>
      )}

      <div style={{
        padding: '2rem',
        backgroundColor: '#f5f5f5',
        borderRadius: '8px',
        marginBottom: '2rem'
      }}>
        <h2 style={{ marginTop: 0 }}>Join a Session</h2>
        
        <div style={{
          textAlign: 'center',
          padding: '3rem 1rem'
        }}>
          <div style={{
            fontSize: '4rem',
            marginBottom: '1rem'
          }}>
            📱
          </div>
          <h3 style={{ margin: '0 0 1rem 0', color: '#333' }}>
            Scan QR Code to Join
          </h3>
          <p style={{ color: '#666', lineHeight: '1.6', maxWidth: '400px', margin: '0 auto' }}>
            Open your phone's camera app and point it at the session QR code displayed by your organizer.
          </p>
          <p style={{ color: '#666', lineHeight: '1.6', maxWidth: '400px', margin: '1rem auto 0' }}>
            Your camera will automatically detect the QR code and open the session link.
          </p>

          <div style={{
            marginTop: '2rem',
            padding: '1.25rem',
            backgroundColor: '#e8f4fd',
            border: '1px solid #b3d7f2',
            borderRadius: '8px',
            maxWidth: '400px',
            margin: '2rem auto 0'
          }}>
            <p style={{ margin: '0 0 0.5rem 0', fontWeight: 600, color: '#0078d4', fontSize: '0.95rem' }}>
              📷 How to scan
            </p>
            <ol style={{ margin: 0, paddingLeft: '1.25rem', color: '#555', fontSize: '0.9rem', lineHeight: '1.8', textAlign: 'left' }}>
              <li>Open your phone's Camera app</li>
              <li>Point it at the QR code on screen</li>
              <li>Tap the link that appears to join</li>
            </ol>
          </div>
        </div>
      </div>
    </div>
  );
}






