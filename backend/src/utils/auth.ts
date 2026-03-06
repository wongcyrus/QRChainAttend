/**
 * Authentication Utilities
 * Common functions for parsing and validating user authentication
 */

import { TableClient } from '@azure/data-tables';

// Cache for external teachers to avoid repeated DB lookups
let externalTeachersCache: Set<string> | null = null;
let cacheTimestamp = 0;
const CACHE_TTL_MS = 60000; // 1 minute cache

/**
 * Get external teachers table client
 */
function getExternalTeachersTable(): TableClient {
  const connectionString = process.env.AzureWebJobsStorage;
  if (!connectionString) {
    throw new Error('AzureWebJobsStorage not configured');
  }
  const isLocal = connectionString.includes("127.0.0.1") || 
                  connectionString.includes("localhost") ||
                  connectionString.includes("UseDevelopmentStorage=true");
  return TableClient.fromConnectionString(connectionString, 'ExternalTeachers', { allowInsecureConnection: isLocal });
}

/**
 * Check if an email is in the external teachers table
 * Uses caching to minimize database lookups
 * @param email - Email to check
 * @returns True if email is an approved external teacher
 */
export async function isExternalTeacher(email: string): Promise<boolean> {
  const emailLower = email.toLowerCase();
  
  // Check cache first
  const now = Date.now();
  if (externalTeachersCache && (now - cacheTimestamp) < CACHE_TTL_MS) {
    return externalTeachersCache.has(emailLower);
  }
  
  // Refresh cache
  try {
    const table = getExternalTeachersTable();
    const newCache = new Set<string>();
    
    for await (const entity of table.listEntities()) {
      if (entity.email) {
        newCache.add((entity.email as string).toLowerCase());
      }
    }
    
    externalTeachersCache = newCache;
    cacheTimestamp = now;
    
    return newCache.has(emailLower);
  } catch (error: any) {
    // Table might not exist yet - return false
    if (error.statusCode === 404) {
      externalTeachersCache = new Set();
      cacheTimestamp = now;
      return false;
    }
    throw error;
  }
}

/**
 * Synchronous check for external teacher (uses cached data only)
 * Returns false if cache is stale or empty - use isExternalTeacher() for authoritative check
 */
export function isExternalTeacherSync(email: string): boolean {
  if (!externalTeachersCache || (Date.now() - cacheTimestamp) >= CACHE_TTL_MS) {
    return false;
  }
  return externalTeachersCache.has(email.toLowerCase());
}

/**
 * Clear the external teachers cache (call after adding/removing external teachers)
 */
export function clearExternalTeachersCache(): void {
  externalTeachersCache = null;
  cacheTimestamp = 0;
}

/**
 * Parse the base64-encoded user principal header
 * @param header - The x-ms-client-principal header value
 * @returns Parsed principal object
 * @throws Error if header is invalid
 */
export function parseUserPrincipal(header: string): any {
  try {
    const decoded = Buffer.from(header, 'base64').toString('utf-8');
    return JSON.parse(decoded);
  } catch {
    throw new Error('Invalid authentication header');
  }
}

/**
 * Get user ID (email) from principal
 * @param principal - Parsed principal object
 * @returns User email address
 */
export function getUserId(principal: any): string {
  return principal.userDetails || principal.userId;
}

/**
 * Check if user has a specific role (synchronous version)
 * Uses email domain-based role assignment for VTC users
 * For external teacher check, use hasRoleAsync() instead
 * @param principal - Parsed principal object
 * @param role - Role to check ('teacher' or 'student')
 * @returns True if user has the role
 */
export function hasRole(principal: any, role: string): boolean {
  const email = principal.userDetails || principal.userId || '';
  const emailLower = email.toLowerCase();
  
  // VTC domain-based role assignment
  if (role.toLowerCase() === 'teacher') {
    // Check VTC teacher domain
    if (emailLower.endsWith('@vtc.edu.hk') && !emailLower.endsWith('@stu.vtc.edu.hk')) {
      return true;
    }
    // Check external teachers cache (sync)
    if (isExternalTeacherSync(emailLower)) {
      return true;
    }
  }
  
  if (role.toLowerCase() === 'student' && 
      emailLower.endsWith('@stu.vtc.edu.hk')) {
    return true;
  }
  
  // Fallback to checking userRoles array
  const roles = principal.userRoles || [];
  return roles.some((r: string) => r.toLowerCase() === role.toLowerCase());
}

/**
 * Check if user has a specific role (async version with external teacher lookup)
 * @param principal - Parsed principal object
 * @param role - Role to check ('teacher' or 'student')
 * @returns True if user has the role
 */
export async function hasRoleAsync(principal: any, role: string): Promise<boolean> {
  const email = principal.userDetails || principal.userId || '';
  const emailLower = email.toLowerCase();
  
  // VTC domain-based role assignment
  if (role.toLowerCase() === 'teacher') {
    // Check VTC teacher domain
    if (emailLower.endsWith('@vtc.edu.hk') && !emailLower.endsWith('@stu.vtc.edu.hk')) {
      return true;
    }
    // Check external teachers table
    if (await isExternalTeacher(emailLower)) {
      return true;
    }
  }
  
  if (role.toLowerCase() === 'student' && 
      emailLower.endsWith('@stu.vtc.edu.hk')) {
    return true;
  }
  
  // Fallback to checking userRoles array
  const roles = principal.userRoles || [];
  return roles.some((r: string) => r.toLowerCase() === role.toLowerCase());
}

/**
 * Get roles from email address (for role assignment) - synchronous version
 * @param email - User email address
 * @returns Array of role names
 */
export function getRolesFromEmail(email: string): string[] {
  const emailLower = email.toLowerCase();
  
  // Teacher: @vtc.edu.hk (excluding @stu.vtc.edu.hk)
  if (emailLower.endsWith('@vtc.edu.hk') && !emailLower.endsWith('@stu.vtc.edu.hk')) {
    return ['teacher'];
  }
  
  // Student: @stu.vtc.edu.hk
  if (emailLower.endsWith('@stu.vtc.edu.hk')) {
    return ['student'];
  }
  
  // Check external teachers cache (sync)
  if (isExternalTeacherSync(emailLower)) {
    return ['teacher'];
  }
  
  return [];
}

/**
 * Get roles from email address (async version with external teacher lookup)
 * @param email - User email address
 * @returns Array of role names
 */
export async function getRolesFromEmailAsync(email: string): Promise<string[]> {
  const emailLower = email.toLowerCase();
  
  // Teacher: @vtc.edu.hk (excluding @stu.vtc.edu.hk)
  if (emailLower.endsWith('@vtc.edu.hk') && !emailLower.endsWith('@stu.vtc.edu.hk')) {
    return ['teacher'];
  }
  
  // Student: @stu.vtc.edu.hk
  if (emailLower.endsWith('@stu.vtc.edu.hk')) {
    return ['student'];
  }
  
  // Check external teachers table
  if (await isExternalTeacher(emailLower)) {
    return ['teacher'];
  }
  
  return [];
}

/**
 * Check if an email is a valid teacher email (VTC domain or external teacher)
 * @param email - Email to check
 * @returns True if email belongs to a teacher
 */
export async function isValidTeacherEmail(email: string): Promise<boolean> {
  const emailLower = email.toLowerCase();
  
  // VTC teacher domain
  if (emailLower.endsWith('@vtc.edu.hk') && !emailLower.endsWith('@stu.vtc.edu.hk')) {
    return true;
  }
  
  // External teacher
  return await isExternalTeacher(emailLower);
}
