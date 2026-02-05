/**
 * Mock Logout for Local Development
 * This simulates Azure Static Web Apps logout
 */

import type { NextApiRequest, NextApiResponse } from 'next';

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  const isLocal = process.env.NEXT_PUBLIC_ENVIRONMENT === 'local';
  
  if (!isLocal) {
    return res.status(404).json({ error: 'Not available in production' });
  }

  // Clear the mock auth cookie
  res.setHeader('Set-Cookie', 'mock-auth=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0');
  
  // Redirect back to home
  res.redirect(302, '/');
}
