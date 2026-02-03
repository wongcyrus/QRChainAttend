/**
 * Authentication Service
 * Feature: qr-chain-attendance
 * Requirements: 1.1, 1.2, 1.3, 1.4, 1.6
 * 
 * Handles user authentication and authorization by parsing Azure Static Web Apps
 * authentication headers and determining user roles based on email domains.
 */

import { Role, UserPrincipal, UnauthorizedError, ForbiddenError } from "@qr-attendance/shared";

/**
 * Azure Static Web Apps Client Principal structure
 * This is the decoded structure from the x-ms-client-principal header
 */
interface ClientPrincipal {
  identityProvider: string;
  userId: string;
  userDetails: string; // This is the email address
  userRoles: string[];
  claims?: Array<{
    typ: string;
    val: string;
  }>;
}

/**
 * AuthService handles user authentication and authorization
 */
export class AuthService {
  /**
   * Parse the x-ms-client-principal header from Azure Static Web Apps
   * Requirements: 1.1, 1.2, 1.6
   * 
   * The header contains a base64-encoded JSON object with user information.
   * This method decodes it and determines the user's role based on their email domain.
   * 
   * @param header - The base64-encoded x-ms-client-principal header value
   * @returns UserPrincipal with userId, email, roles, and identity provider
   * @throws UnauthorizedError if header is missing or invalid
   */
  parseUserPrincipal(header: string | undefined): UserPrincipal {
    // Validate header exists
    if (!header) {
      throw new UnauthorizedError("Missing authentication header");
    }

    try {
      // Decode base64 header
      const decodedString = Buffer.from(header, "base64").toString("utf-8");
      const clientPrincipal: ClientPrincipal = JSON.parse(decodedString);

      // Validate required fields
      if (!clientPrincipal.userId || !clientPrincipal.userDetails) {
        throw new UnauthorizedError("Invalid authentication data: missing userId or userDetails");
      }

      const email = clientPrincipal.userDetails;

      // Determine role based on email domain
      // Requirement 1.1: @stu.edu.hk → STUDENT
      // Requirement 1.2: @vtc.edu.hk → TEACHER
      const roles = this.determineRoles(email);

      return {
        userId: clientPrincipal.userId,
        userEmail: email,
        userRoles: roles,
        identityProvider: clientPrincipal.identityProvider || "unknown",
      };
    } catch (error) {
      if (error instanceof UnauthorizedError) {
        throw error;
      }
      throw new UnauthorizedError(`Failed to parse authentication header: ${error instanceof Error ? error.message : "unknown error"}`);
    }
  }

  /**
   * Determine user roles based on email domain
   * Requirements: 1.1, 1.2
   * 
   * @param email - User's email address
   * @returns Array of roles assigned to the user
   */
  private determineRoles(email: string): Role[] {
    const roles: Role[] = [];

    // Normalize email to lowercase for comparison
    const normalizedEmail = email.toLowerCase();

    // Requirement 1.1: @stu.edu.hk → STUDENT
    if (normalizedEmail.endsWith("@stu.edu.hk")) {
      roles.push(Role.STUDENT);
    }

    // Requirement 1.2: @vtc.edu.hk → TEACHER
    if (normalizedEmail.endsWith("@vtc.edu.hk")) {
      roles.push(Role.TEACHER);
    }

    return roles;
  }

  /**
   * Validate that the user has the required role
   * Requirements: 1.3, 1.4, 1.6
   * 
   * @param principal - User principal to validate
   * @param requiredRole - Role required for the operation
   * @throws ForbiddenError if user doesn't have the required role
   */
  requireRole(principal: UserPrincipal, requiredRole: Role): void {
    if (!principal.userRoles.includes(requiredRole)) {
      throw new ForbiddenError(
        `Access denied: ${requiredRole} role required. User has roles: ${principal.userRoles.join(", ")}`
      );
    }
  }

  /**
   * Extract user ID from principal
   * 
   * @param principal - User principal
   * @returns User ID
   */
  getUserId(principal: UserPrincipal): string {
    return principal.userId;
  }

  /**
   * Extract user email from principal
   * 
   * @param principal - User principal
   * @returns User email address
   */
  getUserEmail(principal: UserPrincipal): string {
    return principal.userEmail;
  }
}

// Export singleton instance
export const authService = new AuthService();
