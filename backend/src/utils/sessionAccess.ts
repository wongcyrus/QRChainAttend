/**
 * Session Access Utilities
 * Helper functions for checking organizer access to sessions (owner or co-organizer)
 */

/**
 * Check if a organizer has access to a session (owner or co-organizer)
 * @param session - Session entity from database
 * @param organizerId - Organizer's user ID (email)
 * @returns Object with access info
 */
export function checkSessionAccess(
  session: any,
  organizerId: string
): { hasAccess: boolean; isOwner: boolean; isCoTeacher: boolean } {
  const teacherIdLower = organizerId.toLowerCase();
  const isOwner = session.organizerId?.toLowerCase() === teacherIdLower;
  
  let isCoTeacher = false;
  if (session.coTeachers) {
    try {
      const coTeachers: string[] = JSON.parse(session.coTeachers);
      isCoTeacher = coTeachers.some(ct => ct.toLowerCase() === teacherIdLower);
    } catch {
      isCoTeacher = false;
    }
  }

  return {
    hasAccess: isOwner || isCoTeacher,
    isOwner,
    isCoTeacher
  };
}

/**
 * Parse co-teachers from session entity
 * @param session - Session entity from database
 * @returns Array of co-organizer emails
 */
export function getCoTeachers(session: any): string[] {
  if (!session.coTeachers) return [];
  try {
    return JSON.parse(session.coTeachers);
  } catch {
    return [];
  }
}
