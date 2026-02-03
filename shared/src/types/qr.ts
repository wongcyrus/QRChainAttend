/**
 * QR Code Data Format Types
 * Feature: qr-chain-attendance
 */

export interface SessionQRData {
  type: "SESSION";
  sessionId: string;
  classId: string;
}

export interface ChainQRData {
  type: "CHAIN" | "EXIT_CHAIN";
  sessionId: string;
  tokenId: string;
  etag: string;
  holderId: string;
  exp: number; // Unix timestamp
}

export interface RotatingQRData {
  type: "LATE_ENTRY" | "EARLY_LEAVE";
  sessionId: string;
  tokenId: string;
  etag: string;
  exp: number; // Unix timestamp
}

export type QRData = SessionQRData | ChainQRData | RotatingQRData;
