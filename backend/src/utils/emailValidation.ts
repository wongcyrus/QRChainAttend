/**
 * Email Validation Utilities
 * Functions for validating, normalizing, and parsing email inputs
 */

/**
 * Validate an email address using a standard regex pattern.
 * @param email - The email address to validate
 * @returns true if the email matches the expected format
 */
export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

/**
 * Normalize an email address by trimming whitespace and lowercasing.
 * @param email - The email address to normalize
 * @returns The trimmed, lowercased email
 */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/**
 * Parse a raw input string containing email addresses separated by commas and/or newlines.
 * @param input - Raw string with emails separated by commas or newlines
 * @returns Array of trimmed, non-empty strings
 */
export function parseEmailInput(input: string): string[] {
  return input
    .split(/[,\n]+/)
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);
}

/**
 * Validate an array of emails: normalize each, then partition into valid and invalid sets.
 * @param emails - Array of raw email strings
 * @returns Object with `valid` and `invalid` arrays of normalized emails
 */
export function validateEmails(emails: string[]): { valid: string[]; invalid: string[] } {
  const valid: string[] = [];
  const invalid: string[] = [];

  for (const email of emails) {
    const normalized = normalizeEmail(email);
    if (isValidEmail(normalized)) {
      valid.push(normalized);
    } else {
      invalid.push(normalized);
    }
  }

  return { valid, invalid };
}
