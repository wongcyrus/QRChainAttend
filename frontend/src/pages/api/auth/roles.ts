/**
 * Custom Role Assignment API
 * This endpoint is called by Azure Static Web Apps after authentication
 * to assign custom roles based on email domain
 */

import type { NextApiRequest, NextApiResponse } from 'next';

interface ClientPrincipal {
  identityProvider: string;
  userId: string;
  userDetails: string;
  userRoles: string[];
}

interface RoleResponse {
  roles: string[];
}

export default function handler(req: NextApiRequest, res: NextApiResponse<RoleResponse>) {
  // Get the authenticated user info from the header
  const clientPrincipalHeader = req.headers['x-ms-client-principal'] as string;
  
  if (!clientPrincipalHeader) {
    // Not authenticated - return only anonymous role
    return res.status(200).json({ roles: ['anonymous'] });
  }

  try {
    // Decode the client principal
    const clientPrincipal: ClientPrincipal = JSON.parse(
      Buffer.from(clientPrincipalHeader, 'base64').toString('utf-8')
    );

    const email = clientPrincipal.userDetails || '';
    const emailLower = email.toLowerCase();
    
    // Start with authenticated role
    const roles: string[] = ['authenticated'];
    
    // Check VTC domain-based roles
    if (emailLower.endsWith('@stu.vtc.edu.hk')) {
      roles.push('student');
    } else if (emailLower.endsWith('@vtc.edu.hk')) {
      roles.push('teacher');
    }
    
    return res.status(200).json({ roles });
  } catch (error) {
    // If there's an error parsing, return only anonymous
    return res.status(200).json({ roles: ['anonymous'] });
  }
}
