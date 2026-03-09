/**
 * Format attendee ID by removing email domain
 * 
 * Removes email domains to display clean attendee IDs
 * 
 * @param attendeeId - Full attendee ID (may include email domain)
 * @returns Formatted attendee ID without domain
 * 
 * @example
 * formatAttendeeId('user@example.com') // returns 'user'
 * formatAttendeeId('attendee123') // returns 'attendee123'
 */
export function formatAttendeeId(attendeeId: string | undefined | null): string {
  if (!attendeeId) return 'Unknown';
  
  // Remove email domain if present
  const atIndex = attendeeId.indexOf('@');
  if (atIndex > 0) {
    return attendeeId.substring(0, atIndex);
  }
  
  return attendeeId;
}

/**
 * Format multiple attendee IDs
 * 
 * @param attendeeIds - Array of attendee IDs
 * @returns Array of formatted attendee IDs
 */
export function formatAttendeeIds(attendeeIds: string[]): string[] {
  return attendeeIds.map(formatAttendeeId);
}
