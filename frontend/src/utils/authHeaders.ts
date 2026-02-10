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
 * In local: Uses mock teacher credentials
 */
export async function getAuthHeaders(): Promise<Record<string, string>> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json'
  };

  const isLocal = process.env.NEXT_PUBLIC_ENVIRONMENT === 'local';

  if (isLocal) {
    // Local development - use mock credentials
    headers['x-ms-client-principal'] = Buffer.from(JSON.stringify({
      userDetails: 'teacher@vtc.edu.hk',
      userRoles: ['authenticated', 'teacher']
    })).toString('base64');
  } else {
    // Production - fetch from Azure Static Web Apps auth
    try {
      // Check cache first
      const now = Date.now();
      if (cachedPrincipal && (now - cacheTimestamp) < CACHE_DURATION) {
        headers['x-ms-client-principal'] = cachedPrincipal;
        return headers;
      }

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
