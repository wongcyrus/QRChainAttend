/**
 * Unit Tests for AuthService
 * Feature: qr-chain-attendance
 * Requirements: 1.1, 1.2, 1.3, 1.4, 1.6
 */

import { AuthService } from "./AuthService";
import { Role, UnauthorizedError, ForbiddenError } from "@qr-attendance/shared";

describe("AuthService", () => {
  let authService: AuthService;

  beforeEach(() => {
    authService = new AuthService();
  });

  describe("parseUserPrincipal", () => {
    it("should parse valid student principal with @stu.edu.hk email", () => {
      // Requirement 1.1: @stu.edu.hk → STUDENT
      const clientPrincipal = {
        identityProvider: "aad",
        userId: "student-123",
        userDetails: "john.doe@stu.edu.hk",
        userRoles: [],
      };
      const header = Buffer.from(JSON.stringify(clientPrincipal)).toString("base64");

      const result = authService.parseUserPrincipal(header);

      expect(result.userId).toBe("student-123");
      expect(result.userEmail).toBe("john.doe@stu.edu.hk");
      expect(result.userRoles).toContain(Role.STUDENT);
      expect(result.userRoles).not.toContain(Role.TEACHER);
      expect(result.identityProvider).toBe("aad");
    });

    it("should parse valid teacher principal with @vtc.edu.hk email", () => {
      // Requirement 1.2: @vtc.edu.hk → TEACHER
      const clientPrincipal = {
        identityProvider: "aad",
        userId: "teacher-456",
        userDetails: "jane.smith@vtc.edu.hk",
        userRoles: [],
      };
      const header = Buffer.from(JSON.stringify(clientPrincipal)).toString("base64");

      const result = authService.parseUserPrincipal(header);

      expect(result.userId).toBe("teacher-456");
      expect(result.userEmail).toBe("jane.smith@vtc.edu.hk");
      expect(result.userRoles).toContain(Role.TEACHER);
      expect(result.userRoles).not.toContain(Role.STUDENT);
      expect(result.identityProvider).toBe("aad");
    });

    it("should handle email with uppercase letters", () => {
      const clientPrincipal = {
        identityProvider: "aad",
        userId: "student-789",
        userDetails: "John.Doe@STU.EDU.HK",
        userRoles: [],
      };
      const header = Buffer.from(JSON.stringify(clientPrincipal)).toString("base64");

      const result = authService.parseUserPrincipal(header);

      expect(result.userRoles).toContain(Role.STUDENT);
      expect(result.userEmail).toBe("John.Doe@STU.EDU.HK"); // Original case preserved
    });

    it("should assign no roles for unknown email domain", () => {
      const clientPrincipal = {
        identityProvider: "aad",
        userId: "user-999",
        userDetails: "user@example.com",
        userRoles: [],
      };
      const header = Buffer.from(JSON.stringify(clientPrincipal)).toString("base64");

      const result = authService.parseUserPrincipal(header);

      expect(result.userId).toBe("user-999");
      expect(result.userEmail).toBe("user@example.com");
      expect(result.userRoles).toHaveLength(0);
    });

    it("should throw UnauthorizedError when header is undefined", () => {
      expect(() => {
        authService.parseUserPrincipal(undefined);
      }).toThrow(UnauthorizedError);
      
      expect(() => {
        authService.parseUserPrincipal(undefined);
      }).toThrow("Missing authentication header");
    });

    it("should throw UnauthorizedError when header is empty string", () => {
      expect(() => {
        authService.parseUserPrincipal("");
      }).toThrow(UnauthorizedError);
    });

    it("should throw UnauthorizedError when header is not valid base64", () => {
      expect(() => {
        authService.parseUserPrincipal("not-valid-base64!");
      }).toThrow(UnauthorizedError);
    });

    it("should throw UnauthorizedError when decoded JSON is invalid", () => {
      const invalidJson = "not valid json";
      const header = Buffer.from(invalidJson).toString("base64");

      expect(() => {
        authService.parseUserPrincipal(header);
      }).toThrow(UnauthorizedError);
    });

    it("should throw UnauthorizedError when userId is missing", () => {
      const clientPrincipal = {
        identityProvider: "aad",
        userDetails: "user@stu.edu.hk",
        userRoles: [],
      };
      const header = Buffer.from(JSON.stringify(clientPrincipal)).toString("base64");

      expect(() => {
        authService.parseUserPrincipal(header);
      }).toThrow(UnauthorizedError);
      
      expect(() => {
        authService.parseUserPrincipal(header);
      }).toThrow("Invalid authentication data: missing userId or userDetails");
    });

    it("should throw UnauthorizedError when userDetails is missing", () => {
      const clientPrincipal = {
        identityProvider: "aad",
        userId: "user-123",
        userRoles: [],
      };
      const header = Buffer.from(JSON.stringify(clientPrincipal)).toString("base64");

      expect(() => {
        authService.parseUserPrincipal(header);
      }).toThrow(UnauthorizedError);
      
      expect(() => {
        authService.parseUserPrincipal(header);
      }).toThrow("Invalid authentication data: missing userId or userDetails");
    });

    it("should handle missing identityProvider gracefully", () => {
      const clientPrincipal = {
        userId: "user-123",
        userDetails: "user@stu.edu.hk",
        userRoles: [],
      };
      const header = Buffer.from(JSON.stringify(clientPrincipal)).toString("base64");

      const result = authService.parseUserPrincipal(header);

      expect(result.identityProvider).toBe("unknown");
    });
  });

  describe("requireRole", () => {
    it("should not throw when user has required STUDENT role", () => {
      // Requirement 1.4: Student endpoint authorization
      const principal = {
        userId: "student-123",
        userEmail: "student@stu.edu.hk",
        userRoles: [Role.STUDENT],
        identityProvider: "aad",
      };

      expect(() => {
        authService.requireRole(principal, Role.STUDENT);
      }).not.toThrow();
    });

    it("should not throw when user has required TEACHER role", () => {
      // Requirement 1.3: Teacher endpoint authorization
      const principal = {
        userId: "teacher-456",
        userEmail: "teacher@vtc.edu.hk",
        userRoles: [Role.TEACHER],
        identityProvider: "aad",
      };

      expect(() => {
        authService.requireRole(principal, Role.TEACHER);
      }).not.toThrow();
    });

    it("should throw ForbiddenError when student tries to access teacher endpoint", () => {
      // Requirement 1.3: Teacher endpoint authorization enforcement
      const principal = {
        userId: "student-123",
        userEmail: "student@stu.edu.hk",
        userRoles: [Role.STUDENT],
        identityProvider: "aad",
      };

      expect(() => {
        authService.requireRole(principal, Role.TEACHER);
      }).toThrow(ForbiddenError);
      
      expect(() => {
        authService.requireRole(principal, Role.TEACHER);
      }).toThrow("Access denied: teacher role required");
    });

    it("should throw ForbiddenError when teacher tries to access student endpoint", () => {
      // Requirement 1.4: Student endpoint authorization enforcement
      const principal = {
        userId: "teacher-456",
        userEmail: "teacher@vtc.edu.hk",
        userRoles: [Role.TEACHER],
        identityProvider: "aad",
      };

      expect(() => {
        authService.requireRole(principal, Role.STUDENT);
      }).toThrow(ForbiddenError);
      
      expect(() => {
        authService.requireRole(principal, Role.STUDENT);
      }).toThrow("Access denied: student role required");
    });

    it("should throw ForbiddenError when user has no roles", () => {
      const principal = {
        userId: "user-999",
        userEmail: "user@example.com",
        userRoles: [],
        identityProvider: "aad",
      };

      expect(() => {
        authService.requireRole(principal, Role.STUDENT);
      }).toThrow(ForbiddenError);
      
      expect(() => {
        authService.requireRole(principal, Role.TEACHER);
      }).toThrow(ForbiddenError);
    });
  });

  describe("getUserId", () => {
    it("should return user ID from principal", () => {
      const principal = {
        userId: "user-123",
        userEmail: "user@stu.edu.hk",
        userRoles: [Role.STUDENT],
        identityProvider: "aad",
      };

      const result = authService.getUserId(principal);

      expect(result).toBe("user-123");
    });
  });

  describe("getUserEmail", () => {
    it("should return user email from principal", () => {
      const principal = {
        userId: "user-123",
        userEmail: "user@stu.edu.hk",
        userRoles: [Role.STUDENT],
        identityProvider: "aad",
      };

      const result = authService.getUserEmail(principal);

      expect(result).toBe("user@stu.edu.hk");
    });
  });

  describe("Edge cases", () => {
    it("should handle email with subdomain", () => {
      const clientPrincipal = {
        identityProvider: "aad",
        userId: "student-123",
        userDetails: "student@mail.stu.edu.hk",
        userRoles: [],
      };
      const header = Buffer.from(JSON.stringify(clientPrincipal)).toString("base64");

      const result = authService.parseUserPrincipal(header);

      // Should not match because it's @mail.stu.edu.hk, not @stu.edu.hk
      expect(result.userRoles).toHaveLength(0);
    });

    it("should handle email that contains but doesn't end with domain", () => {
      const clientPrincipal = {
        identityProvider: "aad",
        userId: "user-123",
        userDetails: "stu.edu.hk@example.com",
        userRoles: [],
      };
      const header = Buffer.from(JSON.stringify(clientPrincipal)).toString("base64");

      const result = authService.parseUserPrincipal(header);

      // Should not match because domain is not at the end
      expect(result.userRoles).toHaveLength(0);
    });

    it("should handle very long email addresses", () => {
      const longName = "a".repeat(100);
      const clientPrincipal = {
        identityProvider: "aad",
        userId: "student-123",
        userDetails: `${longName}@stu.edu.hk`,
        userRoles: [],
      };
      const header = Buffer.from(JSON.stringify(clientPrincipal)).toString("base64");

      const result = authService.parseUserPrincipal(header);

      expect(result.userRoles).toContain(Role.STUDENT);
      expect(result.userEmail).toBe(`${longName}@stu.edu.hk`);
    });

    it("should handle special characters in email local part", () => {
      const clientPrincipal = {
        identityProvider: "aad",
        userId: "student-123",
        userDetails: "john.doe+test@stu.edu.hk",
        userRoles: [],
      };
      const header = Buffer.from(JSON.stringify(clientPrincipal)).toString("base64");

      const result = authService.parseUserPrincipal(header);

      expect(result.userRoles).toContain(Role.STUDENT);
      expect(result.userEmail).toBe("john.doe+test@stu.edu.hk");
    });
  });
});
