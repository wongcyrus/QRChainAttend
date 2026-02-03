/**
 * Home Page
 * Feature: qr-chain-attendance
 */

import { useEffect, useState } from 'react';

interface UserInfo {
  userId: string;
  userDetails: string;
  userRoles: string[];
}

export default function Home() {
  const [user, setUser] = useState<UserInfo | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check if user is authenticated
    // Add cache-busting and no-cache headers to prevent stale auth state
    fetch('/.auth/me', {
      cache: 'no-store',
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache'
      }
    })
      .then(res => res.json())
      .then(data => {
        if (data.clientPrincipal) {
          setUser({
            userId: data.clientPrincipal.userId,
            userDetails: data.clientPrincipal.userDetails,
            userRoles: data.clientPrincipal.userRoles || []
          });
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  // Re-check auth state when page becomes visible (handles back navigation)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        setLoading(true);
        fetch('/.auth/me', {
          cache: 'no-store',
          headers: {
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Pragma': 'no-cache'
          }
        })
          .then(res => res.json())
          .then(data => {
            if (data.clientPrincipal) {
              setUser({
                userId: data.clientPrincipal.userId,
                userDetails: data.clientPrincipal.userDetails,
                userRoles: data.clientPrincipal.userRoles || []
              });
            } else {
              setUser(null);
            }
            setLoading(false);
          })
          .catch(() => setLoading(false));
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, []);

  const handleLogin = () => {
    window.location.href = '/.auth/login/aad';
  };

  const handleLogout = () => {
    window.location.href = '/.auth/logout';
  };

  if (loading) {
    return (
      <div style={{ padding: '2rem', fontFamily: 'system-ui, sans-serif' }}>
        <p>Loading...</p>
      </div>
    );
  }

  return (
    <div style={{ padding: '2rem', fontFamily: 'system-ui, sans-serif' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <h1>QR Chain Attendance System</h1>
        {user ? (
          <div style={{ textAlign: 'right' }}>
            <p style={{ margin: '0 0 0.5rem 0', fontSize: '0.875rem' }}>
              Logged in as: <strong>{user.userDetails}</strong>
            </p>
            <p style={{ margin: '0 0 0.5rem 0', fontSize: '0.75rem', color: '#666' }}>
              Roles: {user.userRoles.join(', ') || 'None assigned'}
            </p>
            <button 
              onClick={handleLogout}
              style={{
                padding: '0.5rem 1rem',
                backgroundColor: '#d13438',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '0.875rem'
              }}
            >
              Logout
            </button>
          </div>
        ) : (
          <button 
            onClick={handleLogin}
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
            Login with Azure AD
          </button>
        )}
      </div>

      {!user && (
        <div style={{ 
          padding: '1rem', 
          backgroundColor: '#fff4ce', 
          border: '1px solid #ffd700',
          borderRadius: '4px',
          marginBottom: '2rem'
        }}>
          <p style={{ margin: 0 }}>
            ⚠️ Please login to access the attendance system.
          </p>
        </div>
      )}

      <p>Welcome to the QR Chain Attendance System.</p>
      
      <div style={{ marginTop: '2rem' }}>
        <h2>Getting Started</h2>
        <ul>
          <li>
            <strong>Students:</strong> Scan the session QR code to join a class
          </li>
          <li>
            <strong>Teachers:</strong> Create and manage attendance sessions
          </li>
        </ul>
      </div>

      {user && (
        <div style={{ marginTop: '2rem' }}>
          <h2>Quick Actions</h2>
          {user.userRoles.includes('teacher') && (
            <div style={{ marginBottom: '1rem' }}>
              <a 
                href="/teacher" 
                style={{
                  display: 'inline-block',
                  padding: '0.75rem 1.5rem',
                  backgroundColor: '#0078d4',
                  color: 'white',
                  textDecoration: 'none',
                  borderRadius: '4px',
                  marginRight: '1rem'
                }}
              >
                Teacher Dashboard
              </a>
            </div>
          )}
          {user.userRoles.includes('student') && (
            <div style={{ marginBottom: '1rem' }}>
              <a 
                href="/student" 
                style={{
                  display: 'inline-block',
                  padding: '0.75rem 1.5rem',
                  backgroundColor: '#107c10',
                  color: 'white',
                  textDecoration: 'none',
                  borderRadius: '4px'
                }}
              >
                Student View
              </a>
            </div>
          )}
          {user.userRoles.length === 0 && (
            <div style={{ 
              padding: '1rem', 
              backgroundColor: '#fef0f0', 
              border: '1px solid #d13438',
              borderRadius: '4px'
            }}>
              <p style={{ margin: 0 }}>
                ⚠️ No roles assigned. Please contact your administrator to assign you a "teacher" or "student" role.
              </p>
            </div>
          )}
        </div>
      )}

      <div style={{ marginTop: '2rem', fontSize: '0.875rem', color: '#666' }}>
        <p>
          This is a Progressive Web App. You can install it on your device for quick access.
        </p>
      </div>
    </div>
  );
}
