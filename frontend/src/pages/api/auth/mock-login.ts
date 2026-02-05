/**
 * Mock Authentication for Local Development
 * This simulates Azure Static Web Apps authentication locally
 */

import type { NextApiRequest, NextApiResponse } from 'next';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const isLocal = process.env.NEXT_PUBLIC_ENVIRONMENT === 'local';
  
  if (!isLocal) {
    return res.status(404).json({ error: 'Not available in production' });
  }

  let mockUser;

  if (req.method === 'POST' && req.body.clientPrincipal) {
    // Custom user from dev-config page
    mockUser = req.body;
    
    // Check if user is already logged in elsewhere
    const userEmail = mockUser.clientPrincipal.userDetails;
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:7071/api';
    
    try {
      const checkResponse = await fetch(`${apiUrl}/auth/check-session`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ email: userEmail })
      });
      
      if (checkResponse.ok) {
        const data = await checkResponse.json();
        if (data.hasActiveSession) {
          return res.status(409).json({ 
            error: 'User already logged in',
            message: `${userEmail} is already logged in another browser. Only one session per user is allowed.`
          });
        }
      }
      
      // Register this session
      await fetch(`${apiUrl}/auth/register-session`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ 
          email: userEmail,
          userId: mockUser.clientPrincipal.userId,
          sessionId: `session-${Date.now()}`
        })
      });
      
    } catch (error) {
      console.error('Session check failed:', error);
      // Continue anyway if backend is not available
    }
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
