/**
 * Custom Role Assignment API
 * This endpoint is called by Azure Static Web Apps after authentication
 * to assign custom roles based on email domain or external organizer table
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

// External organizers list - fetched from backend
let externalOrganizersCache: Set<string> | null = null;
let cacheTimestamp = 0;
const CACHE_TTL_MS = 60000; // 1 minute

async function fetchExternalOrganizers(): Promise<Set<string>> {
  const now = Date.now();
  if (externalOrganizersCache && (now - cacheTimestamp) < CACHE_TTL_MS) {
    return externalOrganizersCache;
  }

  try {
    // In production, this calls the backend API
    const backendUrl = process.env.NEXT_PUBLIC_API_URL || '';
    const response = await fetch(`${backendUrl}/api/admin/external-organizers`);
    
    if (response.ok) {
      const data = await response.json();
      const organizers = new Set<string>(
        (data.organizers || []).map((t: { email: string }) => t.email.toLowerCase())
      );
      externalOrganizersCache = organizers;
      cacheTimestamp = now;
      return organizers;
    }
  } catch (error) {
    // If fetch fails, return empty set
    console.error('Failed to fetch external organizers:', error);
  }

  return externalOrganizersCache || new Set();
}

export default async function handler(req: NextApiRequest, res: NextApiResponse<RoleResponse>) {
  // Get the authenticated user info from the header
  const clientPrincipalHeader = (req.headers['x-ms-client-principal'] || req.headers['x-client-principal']) as string;
  
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
    
    // Check domain-based assignment (from environment variables)
    const organizerDomain = process.env.ORGANIZER_DOMAIN?.toLowerCase().trim();
    const attendeeDomain = process.env.ATTENDEE_DOMAIN?.toLowerCase().trim();
    
    // Check organizer domain
    if (organizerDomain && emailLower.endsWith(`@${organizerDomain}`)) {
      // Exclude attendee domain if specified
      if (!attendeeDomain || !emailLower.endsWith(`@${attendeeDomain}`)) {
        roles.push('organizer');
        return res.status(200).json({ roles });
      }
    }
    
    // Check external organizers table
    const externalOrganizers = await fetchExternalOrganizers();
    if (externalOrganizers.has(emailLower)) {
      roles.push('organizer');
      return res.status(200).json({ roles });
    }
    
    // Check attendee domain restriction (if set)
    if (attendeeDomain) {
      // If attendee domain is set, ONLY that domain can be attendee
      if (emailLower.endsWith(`@${attendeeDomain}`)) {
        roles.push('attendee');
      }
      // Else: no role assigned (not organizer, not in allowed attendee domain)
      return res.status(200).json({ roles });
    }
    
    // No attendee domain restriction - any email can be attendee
    roles.push('attendee');
    return res.status(200).json({ roles });
  } catch (error) {
    // If there's an error parsing, return only anonymous
    return res.status(200).json({ roles: ['anonymous'] });
  }
}
