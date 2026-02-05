/**
 * Mock /.auth/me endpoint for Local Development
 * This simulates Azure Static Web Apps authentication endpoint
 */

import type { NextApiRequest, NextApiResponse } from 'next';

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  const isLocal = process.env.NEXT_PUBLIC_ENVIRONMENT === 'local';
  
  if (!isLocal) {
    return res.status(404).json({ error: 'Not available in production' });
  }

  // Check for mock auth cookie
  const cookies = req.headers.cookie || '';
  const mockAuthMatch = cookies.match(/mock-auth=([^;]+)/);
  
  if (mockAuthMatch) {
    try {
      const userData = JSON.parse(decodeURIComponent(mockAuthMatch[1]));
      return res.status(200).json(userData);
    } catch (e) {
      // Invalid cookie
    }
  }

  // No authentication
  return res.status(200).json({
    clientPrincipal: null
  });
}
