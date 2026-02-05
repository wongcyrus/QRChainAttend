/**
 * Mock Logout for Local Development
 * This simulates Azure Static Web Apps logout
 */

import type { NextApiRequest, NextApiResponse } from 'next';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const isLocal = process.env.NEXT_PUBLIC_ENVIRONMENT === 'local';
  
  if (!isLocal) {
    return res.status(404).json({ error: 'Not available in production' });
  }

  // Get user email from cookie before clearing
  try {
    const cookie = req.cookies['mock-auth'];
    if (cookie) {
      const mockUser = JSON.parse(decodeURIComponent(cookie));
      const userEmail = mockUser.clientPrincipal?.userDetails;
      
      if (userEmail) {
        // Clear session from backend
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:7071/api';
        await fetch(`${apiUrl}/auth/clear-session`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ email: userEmail })
        }).catch(err => console.error('Failed to clear session:', err));
      }
    }
  } catch (error) {
    console.error('Error during logout:', error);
  }

  // Clear the mock auth cookie
  res.setHeader('Set-Cookie', 'mock-auth=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0');
  
  if (req.method === 'POST') {
    return res.status(200).json({ success: true });
  }
  
  // Redirect back to home for GET requests
  res.redirect(302, '/');
}
