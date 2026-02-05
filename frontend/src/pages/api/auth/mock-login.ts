/**
 * Mock Authentication for Local Development
 * This simulates Azure Static Web Apps authentication locally
 */

import type { NextApiRequest, NextApiResponse } from 'next';

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  const isLocal = process.env.NEXT_PUBLIC_ENVIRONMENT === 'local';
  
  if (!isLocal) {
    return res.status(404).json({ error: 'Not available in production' });
  }

  let mockUser;

  if (req.method === 'POST' && req.body.clientPrincipal) {
    // Custom user from dev-config page
    mockUser = req.body;
  } else {
    // Default mock user
    mockUser = {
      clientPrincipal: {
        userId: 'local-dev-user-123',
        userDetails: process.env.MOCK_USER_EMAIL || 'teacher@vtc.edu.hk',
        identityProvider: 'aad',
        userRoles: ['authenticated', 'teacher']
      }
    };
  }

  // Store in cookie for /.auth/me endpoint
  res.setHeader('Set-Cookie', `mock-auth=${encodeURIComponent(JSON.stringify(mockUser))}; Path=/; HttpOnly; SameSite=Lax; Max-Age=86400`);
  
  if (req.method === 'POST') {
    return res.status(200).json({ success: true });
  }
  
  // Redirect back to home for GET requests
  res.redirect(302, '/');
}
