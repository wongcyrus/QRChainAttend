/**
 * Token Management Types
 * Feature: qr-chain-attendance
 */

export enum TokenType {
  SESSION = "SESSION",
  CHAIN = "CHAIN",
  LATE_ENTRY = "LATE_ENTRY",
  EARLY_LEAVE = "EARLY_LEAVE",
  EXIT_CHAIN = "EXIT_CHAIN"
}

export enum TokenStatus {
  ACTIVE = "ACTIVE",
  USED = "USED",
  EXPIRED = "EXPIRED",
  REVOKED = "REVOKED"
}

export interface Token {
  tokenId: string;
  sessionId: string;
  type: TokenType;
  chainId?: string;
  issuedTo?: string; // holderId for chain tokens
  seq?: number;
  exp: number; // Unix timestamp
  status: TokenStatus;
  singleUse: boolean;
  etag: string;
}

export interface TokenEntity extends Token {
  // Azure Table Storage keys
  PartitionKey: string; // sessionId
  RowKey: string; // tokenId
  createdAt: number;
  usedAt?: number;
  Timestamp: Date;
  ETag: string;
}

export interface CreateTokenParams {
  sessionId: string;
  type: TokenType;
  chainId?: string;
  issuedTo?: string; // holderId for chain tokens
  seq?: number;
  ttlSeconds: number;
  singleUse: boolean;
}

export interface ConsumeResult {
  success: boolean;
  token?: Token;
  error?: "ALREADY_USED" | "EXPIRED" | "REVOKED" | "NOT_FOUND";
}

export interface ValidationResult {
  valid: boolean;
  reason?: string;
}
