/**
 * Utility to get authentication headers for API calls
 */

export async function getAuthHeaders(): Promise<HeadersInit> {
  const headers: HeadersInit = { 'Content-Type': 'application/json' };
  
  const isLocal = process.env.NEXT_PUBLIC_ENVIRONMENT === 'local';
  
  if (isLocal) {
    // Local development - use mock authentication
    const mockPrincipal = {
      userId: 'local-dev-user',
      userDetails: 'teacher@vtc.edu.hk',
      userRoles: ['authenticated', 'teacher'],
      identityProvider: 'aad'
    };
    headers['x-ms-client-principal'] = Buffer.from(JSON.stringify(mockPrincipal)).toString('base64');
  } else {
    // Production - get real authentication from Azure Static Web Apps
    const authResponse = await fetch('/.auth/me', { credentials: 'include' });
    const authData = await authResponse.json();
    
    if (authData.clientPrincipal) {
      headers['x-ms-client-principal'] = Buffer.from(JSON.stringify(authData.clientPrincipal)).toString('base64');
    } else {
      throw new Error('Not authenticated');
    }
  }
  
  return headers;
}

export async function getAuthHeadersWithCustomPrincipal(customPrincipal: any): Promise<HeadersInit> {
  const headers: HeadersInit = { 'Content-Type': 'application/json' };
  
  const isLocal = process.env.NEXT_PUBLIC_ENVIRONMENT === 'local';
  
  if (isLocal) {
    // Local development - use provided custom principal
    headers['x-ms-client-principal'] = Buffer.from(JSON.stringify(customPrincipal)).toString('base64');
  } else {
    // Production - get real authentication and merge with custom data
    const authResponse = await fetch('/.auth/me', { credentials: 'include' });
    const authData = await authResponse.json();
    
    if (authData.clientPrincipal) {
      // Use real auth but allow overriding specific fields
      const principal = {
        ...authData.clientPrincipal,
        ...customPrincipal
      };
      headers['x-ms-client-principal'] = Buffer.from(JSON.stringify(principal)).toString('base64');
    } else {
      throw new Error('Not authenticated');
    }
  }
  
  return headers;
}
