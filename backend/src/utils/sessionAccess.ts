/**
 * Session Access Utilities
 * Helper functions for checking teacher access to sessions (owner or co-teacher)
 */

/**
 * Check if a teacher has access to a session (owner or co-teacher)
 * @param session - Session entity from database
 * @param teacherId - Teacher's user ID (email)
 * @returns Object with access info
 */
export function checkSessionAccess(
  session: any,
  teacherId: string
): { hasAccess: boolean; isOwner: boolean; isCoTeacher: boolean } {
  const teacherIdLower = teacherId.toLowerCase();
  const isOwner = session.teacherId?.toLowerCase() === teacherIdLower;
  
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
 * @returns Array of co-teacher emails
 */
export function getCoTeachers(session: any): string[] {
  if (!session.coTeachers) return [];
  try {
    return JSON.parse(session.coTeachers);
  } catch {
    return [];
  }
}
