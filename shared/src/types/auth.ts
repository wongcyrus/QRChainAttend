/**
 * Authentication and Authorization Types
 * Feature: qr-chain-attendance
 */

export enum Role {
  STUDENT = "student",
  TEACHER = "teacher"
}

export interface UserPrincipal {
  userId: string;
  userEmail: string;
  userRoles: Role[];
  identityProvider: string;
}

export class UnauthorizedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UnauthorizedError";
  }
}

export class ForbiddenError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ForbiddenError";
  }
}
