/**
 * Property-Based Tests for AuthService
 * Feature: qr-chain-attendance
 * Requirements: 1.1, 1.2, 1.3, 1.4, 1.6
 * 
 * These tests validate universal properties that should hold across all valid inputs
 * using property-based testing with fast-check.
 */

import * as fc from "fast-check";
import { AuthService } from "./AuthService";
import { Role, ForbiddenError, UnauthorizedError } from "@qr-attendance/shared";

describe("AuthService - Property-Based Tests", () => {
  let authService: AuthService;

  beforeEach(() => {
    authService = new AuthService();
  });

  /**
   * Property 1: Student role assignment by email domain
   * **Validates: Requirements 1.1**
   * 
   * For any user with an @stu.edu.hk email address, the system should assign them the Student role.
   */
  describe("Property 1: Student role assignment by email domain", () => {
    it("should assign STUDENT role to any email ending with @stu.edu.hk", () => {
      fc.assert(
        fc.property(
          // Generate arbitrary email local parts (before @)
          fc.stringMatching(/^[a-zA-Z0-9._+-]+$/),
          fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0),
          (localPart, userId) => {
            // Construct email with @stu.edu.hk domain
            const email = `${localPart}@stu.edu.hk`;
            
            const clientPrincipal = {
              identityProvider: "aad",
              userId: userId,
              userDetails: email,
              userRoles: [],
            };
            const header = Buffer.from(JSON.stringify(clientPrincipal)).toString("base64");

            const result = authService.parseUserPrincipal(header);

            // Property: Must contain STUDENT role
            expect(result.userRoles).toContain(Role.STUDENT);
            expect(result.userEmail).toBe(email);
          }
        ),
        { numRuns: 100 }
      );
    });

    it("should assign STUDENT role regardless of email case variations", () => {
      fc.assert(
        fc.property(
          fc.stringMatching(/^[a-zA-Z0-9._+-]+$/),
          fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0),
          // Generate random case variations for the domain
          fc.constantFrom(
            "@stu.edu.hk",
            "@STU.EDU.HK",
            "@Stu.Edu.Hk",
            "@STU.edu.hk",
            "@stu.EDU.HK"
          ),
          (localPart, userId, domain) => {
            const email = `${localPart}${domain}`;
            
            const clientPrincipal = {
              identityProvider: "aad",
              userId: userId,
              userDetails: email,
              userRoles: [],
            };
            const header = Buffer.from(JSON.stringify(clientPrincipal)).toString("base64");

            const result = authService.parseUserPrincipal(header);

            // Property: Must contain STUDENT role regardless of case
            expect(result.userRoles).toContain(Role.STUDENT);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * Property 2: Teacher role assignment by email domain
   * **Validates: Requirements 1.2**
   * 
   * For any user with an @vtc.edu.hk email address, the system should assign them the Teacher role.
   */
  describe("Property 2: Teacher role assignment by email domain", () => {
    it("should assign TEACHER role to any email ending with @vtc.edu.hk", () => {
      fc.assert(
        fc.property(
          fc.stringMatching(/^[a-zA-Z0-9._+-]+$/),
          fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0),
          (localPart, userId) => {
            // Construct email with @vtc.edu.hk domain
            const email = `${localPart}@vtc.edu.hk`;
            
            const clientPrincipal = {
              identityProvider: "aad",
              userId: userId,
              userDetails: email,
              userRoles: [],
            };
            const header = Buffer.from(JSON.stringify(clientPrincipal)).toString("base64");

            const result = authService.parseUserPrincipal(header);

            // Property: Must contain TEACHER role
            expect(result.userRoles).toContain(Role.TEACHER);
            expect(result.userEmail).toBe(email);
          }
        ),
        { numRuns: 100 }
      );
    });

    it("should assign TEACHER role regardless of email case variations", () => {
      fc.assert(
        fc.property(
          fc.stringMatching(/^[a-zA-Z0-9._+-]+$/),
          fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0),
          // Generate random case variations for the domain
          fc.constantFrom(
            "@vtc.edu.hk",
            "@VTC.EDU.HK",
            "@Vtc.Edu.Hk",
            "@VTC.edu.hk",
            "@vtc.EDU.HK"
          ),
          (localPart, userId, domain) => {
            const email = `${localPart}${domain}`;
            
            const clientPrincipal = {
              identityProvider: "aad",
              userId: userId,
              userDetails: email,
              userRoles: [],
            };
            const header = Buffer.from(JSON.stringify(clientPrincipal)).toString("base64");

            const result = authService.parseUserPrincipal(header);

            // Property: Must contain TEACHER role regardless of case
            expect(result.userRoles).toContain(Role.TEACHER);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * Property 3: Teacher endpoint authorization enforcement
   * **Validates: Requirements 1.3**
   * 
   * For any user without the Teacher role, attempting to access any teacher-only endpoint 
   * should result in an authorization error.
   */
  describe("Property 3: Teacher endpoint authorization enforcement", () => {
    it("should reject any non-teacher user from teacher endpoints", () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1, maxLength: 100 }),
          fc.string({ minLength: 1, maxLength: 100 }),
          fc.constantFrom("aad", "github", "google", "twitter"),
          // Generate roles that don't include TEACHER
          fc.constantFrom(
            [],
            [Role.STUDENT],
            // Could add more roles here if they existed
          ),
          (userId, email, identityProvider, roles) => {
            const principal = {
              userId,
              userEmail: email,
              userRoles: roles,
              identityProvider,
            };

            // Property: Must throw ForbiddenError when requiring TEACHER role
            expect(() => {
              authService.requireRole(principal, Role.TEACHER);
            }).toThrow(ForbiddenError);
          }
        ),
        { numRuns: 100 }
      );
    });

    it("should specifically reject students from teacher endpoints", () => {
      fc.assert(
        fc.property(
          fc.stringMatching(/^[a-zA-Z0-9._+-]+$/),
          fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0),
          (localPart, userId) => {
            // Create a student user
            const email = `${localPart}@stu.edu.hk`;
            const clientPrincipal = {
              identityProvider: "aad",
              userId: userId,
              userDetails: email,
              userRoles: [],
            };
            const header = Buffer.from(JSON.stringify(clientPrincipal)).toString("base64");

            const principal = authService.parseUserPrincipal(header);

            // Property: Student must be rejected from teacher endpoints
            expect(() => {
              authService.requireRole(principal, Role.TEACHER);
            }).toThrow(ForbiddenError);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * Property 4: Student endpoint authorization enforcement
   * **Validates: Requirements 1.4**
   * 
   * For any user without the Student role, attempting to access any student-only endpoint 
   * should result in an authorization error.
   */
  describe("Property 4: Student endpoint authorization enforcement", () => {
    it("should reject any non-student user from student endpoints", () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1, maxLength: 100 }),
          fc.string({ minLength: 1, maxLength: 100 }),
          fc.constantFrom("aad", "github", "google", "twitter"),
          // Generate roles that don't include STUDENT
          fc.constantFrom(
            [],
            [Role.TEACHER],
            // Could add more roles here if they existed
          ),
          (userId, email, identityProvider, roles) => {
            const principal = {
              userId,
              userEmail: email,
              userRoles: roles,
              identityProvider,
            };

            // Property: Must throw ForbiddenError when requiring STUDENT role
            expect(() => {
              authService.requireRole(principal, Role.STUDENT);
            }).toThrow(ForbiddenError);
          }
        ),
        { numRuns: 100 }
      );
    });

    it("should specifically reject teachers from student endpoints", () => {
      fc.assert(
        fc.property(
          fc.stringMatching(/^[a-zA-Z0-9._+-]+$/),
          fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0),
          (localPart, userId) => {
            // Create a teacher user
            const email = `${localPart}@vtc.edu.hk`;
            const clientPrincipal = {
              identityProvider: "aad",
              userId: userId,
              userDetails: email,
              userRoles: [],
            };
            const header = Buffer.from(JSON.stringify(clientPrincipal)).toString("base64");

            const principal = authService.parseUserPrincipal(header);

            // Property: Teacher must be rejected from student endpoints
            expect(() => {
              authService.requireRole(principal, Role.STUDENT);
            }).toThrow(ForbiddenError);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * Property 5: Server-side role validation
   * **Validates: Requirements 1.6**
   * 
   * For any API request, the system should validate user roles on the server side 
   * regardless of client-side state.
   */
  describe("Property 5: Server-side role validation", () => {
    it("should always parse and validate roles from server-side header", () => {
      fc.assert(
        fc.property(
          fc.stringMatching(/^[a-zA-Z0-9._+-]+$/),
          fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0),
          fc.constantFrom("@stu.edu.hk", "@vtc.edu.hk", "@example.com"),
          (localPart, userId, domain) => {
            const email = `${localPart}${domain}`;
            const clientPrincipal = {
              identityProvider: "aad",
              userId: userId,
              userDetails: email,
              userRoles: [], // Client-provided roles are ignored
            };
            const header = Buffer.from(JSON.stringify(clientPrincipal)).toString("base64");

            const principal = authService.parseUserPrincipal(header);

            // Property: Roles must be determined server-side based on email domain
            // Not from client-provided userRoles field
            if (domain === "@stu.edu.hk") {
              expect(principal.userRoles).toContain(Role.STUDENT);
            } else if (domain === "@vtc.edu.hk") {
              expect(principal.userRoles).toContain(Role.TEACHER);
            } else {
              expect(principal.userRoles).toHaveLength(0);
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it("should validate roles consistently across multiple calls", () => {
      fc.assert(
        fc.property(
          fc.stringMatching(/^[a-zA-Z0-9._+-]+$/),
          fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0),
          fc.constantFrom("@stu.edu.hk", "@vtc.edu.hk"),
          (localPart, userId, domain) => {
            const email = `${localPart}${domain}`;
            const clientPrincipal = {
              identityProvider: "aad",
              userId: userId,
              userDetails: email,
              userRoles: [],
            };
            const header = Buffer.from(JSON.stringify(clientPrincipal)).toString("base64");

            // Parse the same header multiple times
            const result1 = authService.parseUserPrincipal(header);
            const result2 = authService.parseUserPrincipal(header);
            const result3 = authService.parseUserPrincipal(header);

            // Property: Results must be consistent across calls
            expect(result1.userRoles).toEqual(result2.userRoles);
            expect(result2.userRoles).toEqual(result3.userRoles);
            expect(result1.userId).toBe(result2.userId);
            expect(result1.userEmail).toBe(result2.userEmail);
          }
        ),
        { numRuns: 100 }
      );
    });

    it("should enforce role validation regardless of principal source", () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1, maxLength: 100 }),
          fc.string({ minLength: 1, maxLength: 100 }),
          fc.array(fc.constantFrom(Role.STUDENT, Role.TEACHER), { minLength: 0, maxLength: 2 }),
          fc.constantFrom(Role.STUDENT, Role.TEACHER),
          (userId, email, userRoles, requiredRole) => {
            // Create principal with arbitrary roles
            const principal = {
              userId,
              userEmail: email,
              userRoles,
              identityProvider: "aad",
            };

            // Property: requireRole must validate based on actual roles in principal
            if (userRoles.includes(requiredRole)) {
              // Should not throw
              expect(() => {
                authService.requireRole(principal, requiredRole);
              }).not.toThrow();
            } else {
              // Should throw ForbiddenError
              expect(() => {
                authService.requireRole(principal, requiredRole);
              }).toThrow(ForbiddenError);
            }
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * Additional property: Email domain matching must be exact
   * This ensures that similar but different domains don't get incorrectly matched
   */
  describe("Additional Property: Exact domain matching", () => {
    it("should not assign roles to emails with similar but different domains", () => {
      fc.assert(
        fc.property(
          fc.stringMatching(/^[a-zA-Z0-9._+-]+$/),
          fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0),
          fc.constantFrom(
            "@example.com",
            "@gmail.com",
            "@stu.edu.com",
            "@vtc.edu.com",
            "@mail.stu.edu.hk",
            "@mail.vtc.edu.hk",
            "@stu.edu.hk.example.com",
            "@vtc.edu.hk.example.com"
          ),
          (localPart, userId, domain) => {
            const email = `${localPart}${domain}`;
            const clientPrincipal = {
              identityProvider: "aad",
              userId: userId,
              userDetails: email,
              userRoles: [],
            };
            const header = Buffer.from(JSON.stringify(clientPrincipal)).toString("base64");

            const result = authService.parseUserPrincipal(header);

            // Property: Must not assign any roles to non-matching domains
            expect(result.userRoles).toHaveLength(0);
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
