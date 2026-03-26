/**
 * Email Validation Utility Tests
 * Run with: npm test -- emailValidation.test.ts
 */

import {
  isValidEmail,
  normalizeEmail,
  parseEmailInput,
  validateEmails,
} from './emailValidation';

describe('isValidEmail', () => {
  it('should accept a standard email', () => {
    expect(isValidEmail('user@example.com')).toBe(true);
  });

  it('should accept emails with subdomains', () => {
    expect(isValidEmail('user@mail.example.com')).toBe(true);
  });

  it('should accept emails with numeric local parts', () => {
    expect(isValidEmail('123@example.com')).toBe(true);
  });

  it('should reject email without @', () => {
    expect(isValidEmail('userexample.com')).toBe(false);
  });

  it('should reject email without domain', () => {
    expect(isValidEmail('user@')).toBe(false);
  });

  it('should reject email without local part', () => {
    expect(isValidEmail('@example.com')).toBe(false);
  });

  it('should reject email with spaces', () => {
    expect(isValidEmail('user @example.com')).toBe(false);
  });

  it('should reject empty string', () => {
    expect(isValidEmail('')).toBe(false);
  });

  it('should reject email without TLD dot', () => {
    expect(isValidEmail('user@examplecom')).toBe(false);
  });
});

describe('normalizeEmail', () => {
  it('should lowercase an email', () => {
    expect(normalizeEmail('User@Example.COM')).toBe('user@example.com');
  });

  it('should trim leading and trailing whitespace', () => {
    expect(normalizeEmail('  user@example.com  ')).toBe('user@example.com');
  });

  it('should handle already normalized email', () => {
    expect(normalizeEmail('user@example.com')).toBe('user@example.com');
  });
});

describe('parseEmailInput', () => {
  it('should split on commas', () => {
    expect(parseEmailInput('a@b.com,c@d.com')).toEqual(['a@b.com', 'c@d.com']);
  });

  it('should split on newlines', () => {
    expect(parseEmailInput('a@b.com\nc@d.com')).toEqual(['a@b.com', 'c@d.com']);
  });

  it('should split on mixed commas and newlines', () => {
    expect(parseEmailInput('a@b.com,b@c.com\nc@d.com')).toEqual([
      'a@b.com',
      'b@c.com',
      'c@d.com',
    ]);
  });

  it('should trim whitespace around entries', () => {
    expect(parseEmailInput('  a@b.com , c@d.com  ')).toEqual([
      'a@b.com',
      'c@d.com',
    ]);
  });

  it('should filter out empty strings', () => {
    expect(parseEmailInput('a@b.com,,\n,c@d.com')).toEqual([
      'a@b.com',
      'c@d.com',
    ]);
  });

  it('should return empty array for empty input', () => {
    expect(parseEmailInput('')).toEqual([]);
  });

  it('should return empty array for only separators', () => {
    expect(parseEmailInput(',,,\n\n,')).toEqual([]);
  });
});

describe('validateEmails', () => {
  it('should classify valid emails', () => {
    const result = validateEmails(['user@example.com', 'admin@test.org']);
    expect(result.valid).toEqual(['user@example.com', 'admin@test.org']);
    expect(result.invalid).toEqual([]);
  });

  it('should classify invalid emails', () => {
    const result = validateEmails(['notanemail', '@missing.com']);
    expect(result.valid).toEqual([]);
    expect(result.invalid).toEqual(['notanemail', '@missing.com']);
  });

  it('should partition mixed valid and invalid emails', () => {
    const result = validateEmails(['good@email.com', 'bad', 'also@good.org']);
    expect(result.valid).toEqual(['good@email.com', 'also@good.org']);
    expect(result.invalid).toEqual(['bad']);
  });

  it('should normalize emails before validating', () => {
    const result = validateEmails(['  User@Example.COM  ']);
    expect(result.valid).toEqual(['user@example.com']);
    expect(result.invalid).toEqual([]);
  });

  it('should handle empty array', () => {
    const result = validateEmails([]);
    expect(result.valid).toEqual([]);
    expect(result.invalid).toEqual([]);
  });
});
