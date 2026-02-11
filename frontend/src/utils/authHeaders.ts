/**
 * Authentication Headers Utility
 * Handles fetching and formatting authentication headers for API requests
 */

let cachedPrincipal: string | null = null;
let cacheTimestamp: number = 0;
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

/**
 * Get authentication headers for API requests
 * In production: Fetches from /.auth/me and formats as x-ms-client-principal
 * In local: Fetches from /api/auth/me and caches for 5 minutes
 */
export async function getAuthHeaders(): Promise<Record<string, string>> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json'
  };

  const isLocal = process.env.NEXT_PUBLIC_ENVIRONMENT === 'local';

  // Check cache first (for both local and production)
  const now = Date.now();
  if (cachedPrincipal && (now - cacheTimestamp) < CACHE_DURATION) {
    headers['x-ms-client-principal'] = cachedPrincipal;
    return headers;
  }

  if (isLocal) {
    // Local development - fetch actual user from /api/auth/me
    try {
      const authResponse = await fetch('/api/auth/me', {
        credentials: 'include',
        cache: 'no-store'
      });

      if (authResponse.ok) {
        const authData = await authResponse.json();
        if (authData.clientPrincipal) {
          const principal = Buffer.from(JSON.stringify(authData.clientPrincipal)).toString('base64');
          
          // Cache it
          cachedPrincipal = principal;
          cacheTimestamp = now;
          
          headers['x-ms-client-principal'] = principal;
        }
      }
    } catch (error) {
      console.error('Failed to fetch local auth:', error);
    }
  } else {
    // Production - fetch from Azure Static Web Apps auth
    try {
      // Fetch fresh auth data
      const authResponse = await fetch('/.auth/me', {
        credentials: 'include',
        cache: 'no-store'
      });

      if (authResponse.ok) {
        const authData = await authResponse.json();
        if (authData.clientPrincipal) {
          // Format as x-ms-client-principal header
          const principal = Buffer.from(JSON.stringify(authData.clientPrincipal)).toString('base64');
          
          // Cache it
          cachedPrincipal = principal;
          cacheTimestamp = now;
          
          headers['x-ms-client-principal'] = principal;
        }
      }
    } catch (error) {
      console.error('Failed to fetch auth headers:', error);
      // Continue without auth header - backend will return 401
    }
  }

  return headers;
}

/**
 * Clear the cached principal (e.g., on logout)
 */
export function clearAuthCache() {
  cachedPrincipal = null;
  cacheTimestamp = 0;
}
