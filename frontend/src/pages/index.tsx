/**
 * Home Page - Redirects to appropriate view based on auth state
 */

import { useEffect } from 'react';
import { useRouter } from 'next/router';
import { getAuthEndpoint } from '../utils/authHeaders';

export default function Home() {
  const router = useRouter();

  useEffect(() => {
    const checkAuthAndRedirect = async () => {
      try {
        const authEndpoint = getAuthEndpoint();
        const response = await fetch(authEndpoint, {
          credentials: 'include',
          cache: 'no-store',
          headers: {
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Pragma': 'no-cache'
          }
        });
        
        const data = await response.json();
        
        if (data.clientPrincipal) {
          const roles = data.clientPrincipal.userRoles || [];
          
          // Redirect based on role
          if (roles.includes('organizer')) {
            router.replace('/organizer');
          } else if (roles.includes('attendee')) {
            router.replace('/attendee');
          } else {
            // No valid role, redirect to login with error message
            router.replace('/login?error=no_role');
          }
        } else {
          // Not authenticated, redirect to login
          router.replace('/login');
        }
      } catch (error) {
        // Error checking auth, redirect to login
        router.replace('/login');
      }
    };

    checkAuthAndRedirect();
  }, [router]);

  return (
    <div style={{ 
      display: 'flex', 
      justifyContent: 'center', 
      alignItems: 'center', 
      height: '100vh',
      fontFamily: 'system-ui, sans-serif'
    }}>
      <p>Loading...</p>
    </div>
  );
}
