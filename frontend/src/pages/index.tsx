/**
 * Home Page
 * Feature: prove-present
 */

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { clearAuthCache, getAuthEndpoint } from '../utils/authHeaders';

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
    window.location.href = '/login';
  };

  const handleLogout = async () => {
    const isLocal = process.env.NEXT_PUBLIC_ENVIRONMENT === 'local';
    clearAuthCache();
    
    if (isLocal) {
      await fetch('/api/auth/logout', {
        method: 'POST',
        credentials: 'include'
      });
      window.location.href = '/';
    } else {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || '/api';
      await fetch(`${apiUrl}/auth/logout`, {
        method: 'POST',
        credentials: 'include'
      });
      window.location.href = '/';
    }
  };

  const handleSwitchAccount = async () => {
    const isLocal = process.env.NEXT_PUBLIC_ENVIRONMENT === 'local';
    clearAuthCache();
    
    if (isLocal) {
      window.location.href = '/dev-config';
    } else {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || '/api';
      await fetch(`${apiUrl}/auth/logout`, {
        method: 'POST',
        credentials: 'include'
      });
      window.location.href = '/login';
    }
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
        <h1>ProvePresent</h1>
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
                fontSize: '0.875rem',
                marginRight: '0.5rem'
              }}
            >
              Logout
            </button>
            <button
              onClick={handleSwitchAccount}
              style={{
                padding: '0.5rem 1rem',
                backgroundColor: '#3182ce',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '0.875rem'
              }}
            >
              Switch Account
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
            Login
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

      <p>Welcome to ProvePresent - Peer-Verified Event Attendance</p>
      
      <div style={{ marginTop: '2rem' }}>
        <h2>Getting Started</h2>
        <ul>
          <li>
            <strong>Attendees:</strong> Scan the session QR code to join an event
          </li>
          <li>
            <strong>Organizers:</strong> Create and manage attendance sessions
          </li>
        </ul>
      </div>

      {user && (
        <div style={{ marginTop: '2rem' }}>
          <h2>Quick Actions</h2>
          {user.userRoles.includes('organizer') && (
            <div style={{ marginBottom: '1rem' }}>
              <Link 
                href="/organizer" 
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
                Organizer Dashboard
              </Link>
            </div>
          )}
          {user.userRoles.includes('attendee') && (
            <div style={{ marginBottom: '1rem' }}>
              <Link 
                href="/attendee" 
                style={{
                  display: 'inline-block',
                  padding: '0.75rem 1.5rem',
                  backgroundColor: '#107c10',
                  color: 'white',
                  textDecoration: 'none',
                  borderRadius: '4px'
                }}
              >
                Attendee View
              </Link>
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
                ⚠️ No roles assigned. Please contact your administrator to assign you a "organizer" or "attendee" role.
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
