/**
 * Authentication Headers Utility
 * Handles fetching and formatting authentication headers for API requests
 */

let cachedPrincipal: string | null = null;
let cacheTimestamp: number = 0;
const CACHE_DURATION = 30 * 60 * 1000; // 30 minutes (increased from 5)

/**
 * Get authentication headers for API requests
 * In production: sends x-client-principal (non-reserved header) from /.auth/me
 * In local: sends x-ms-client-principal for emulator compatibility
 */
export async function getAuthHeaders(): Promise<Record<string, string>> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json'
  };

  const isLocal = process.env.NEXT_PUBLIC_ENVIRONMENT === 'local';

  // Check cache first
  const now = Date.now();
  if (cachedPrincipal && (now - cacheTimestamp) < CACHE_DURATION) {
    if (isLocal) {
      headers['x-ms-client-principal'] = cachedPrincipal;
    } else {
      headers['x-client-principal'] = cachedPrincipal;
    }
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
  }
  else {
    // Production - fetch auth and include non-reserved header
    try {
      const authResponse = await fetch('/.auth/me', {
        credentials: 'include',
        cache: 'no-store'
      });

      if (authResponse.ok) {
        const authData = await authResponse.json();
        if (authData.clientPrincipal) {
          const principal = Buffer.from(JSON.stringify(authData.clientPrincipal)).toString('base64');

          cachedPrincipal = principal;
          cacheTimestamp = now;

          headers['x-client-principal'] = principal;
        }
      }
    } catch (error) {
      console.error('Failed to fetch production auth:', error);
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
