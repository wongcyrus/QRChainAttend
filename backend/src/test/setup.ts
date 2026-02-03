/**
 * Jest Test Setup
 * Feature: qr-chain-attendance
 */

// Set test environment variables
process.env.STORAGE_ACCOUNT_NAME = "devstorageaccount1";
process.env.STORAGE_ACCOUNT_URI = "http://127.0.0.1:10002/devstorageaccount1";
process.env.SIGNALR_CONNECTION_STRING = "Endpoint=http://localhost;AccessKey=test;Version=1.0;";
process.env.LATE_ROTATION_SECONDS = "60";
process.env.EARLY_LEAVE_ROTATION_SECONDS = "60";
process.env.CHAIN_TOKEN_TTL_SECONDS = "20";
process.env.OWNER_TRANSFER = "true";

// Increase timeout for property-based tests
jest.setTimeout(30000);
