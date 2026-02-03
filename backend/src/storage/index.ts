/**
 * Azure Table Storage Connection
 * Feature: qr-chain-attendance
 * Requirements: 19.1, 19.4
 */

import { TableClient, TableServiceClient, AzureNamedKeyCredential } from "@azure/data-tables";
import { DefaultAzureCredential } from "@azure/identity";
import { getConfig } from "../config";
import { RetryableTableClient, createRetryableTableClient } from "./retryableTableClient";

/**
 * Table names in Azure Table Storage
 */
export enum TableName {
  SESSIONS = "Sessions",
  ATTENDANCE = "Attendance",
  TOKENS = "Tokens",
  CHAINS = "Chains",
  SCAN_LOGS = "ScanLogs"
}

/**
 * Get TableClient for a specific table using Managed Identity
 * Requirements: 19.1 - Use Managed Identity for authentication
 */
export function getTableClient(tableName: TableName): TableClient {
  const config = getConfig();
  
  // For local development with Azurite
  if (config.storageAccountUri.includes("127.0.0.1") || config.storageAccountUri.includes("localhost")) {
    const credential = new AzureNamedKeyCredential(
      config.storageAccountName,
      "Eby8vdM02xNOcqFlqUwJPLlmEtlCDXJ1OUzFT50uSRZ6IFsuFq2UVErCz4I6tq/K1SZFPTOtr/KBHBeksoGMGw=="
    );
    return new TableClient(
      config.storageAccountUri,
      tableName,
      credential
    );
  }
  
  // For production: use Managed Identity
  const credential = new DefaultAzureCredential();
  return new TableClient(
    config.storageAccountUri,
    tableName,
    credential
  );
}

/**
 * Get RetryableTableClient for a specific table with automatic retry logic
 * Requirements: 19.1, Task 20.3 - Use Managed Identity and retry logic
 * 
 * This is the recommended way to get a table client as it automatically
 * retries transient failures (network errors, storage throttling, etc.)
 */
export function getRetryableTableClient<T extends Record<string, any> = Record<string, any>>(
  tableName: TableName
): RetryableTableClient<T> {
  const client = getTableClient(tableName);
  return createRetryableTableClient<T>(client);
}

/**
 * Get TableServiceClient for table management operations
 */
export function getTableServiceClient(): TableServiceClient {
  const config = getConfig();
  
  // For local development with Azurite
  if (config.storageAccountUri.includes("127.0.0.1") || config.storageAccountUri.includes("localhost")) {
    const credential = new AzureNamedKeyCredential(
      config.storageAccountName,
      "Eby8vdM02xNOcqFlqUwJPLlmEtlCDXJ1OUzFT50uSRZ6IFsuFq2UVErCz4I6tq/K1SZFPTOtr/KBHBeksoGMGw=="
    );
    return new TableServiceClient(
      config.storageAccountUri.replace(/\/[^\/]+$/, ""),
      credential
    );
  }
  
  // For production: use Managed Identity
  const credential = new DefaultAzureCredential();
  return new TableServiceClient(
    config.storageAccountUri.replace(/\/[^\/]+$/, ""),
    credential
  );
}

/**
 * Initialize all required tables
 * Creates tables if they don't exist
 */
export async function initializeTables(): Promise<void> {
  const serviceClient = getTableServiceClient();
  
  const tables = Object.values(TableName);
  
  for (const tableName of tables) {
    try {
      await serviceClient.createTable(tableName);
      console.log(`Table ${tableName} created or already exists`);
    } catch (error: any) {
      // Ignore error if table already exists
      if (error.statusCode !== 409) {
        console.error(`Error creating table ${tableName}:`, error);
        throw error;
      }
    }
  }
}

// Re-export for convenience
export { RetryableTableClient, createRetryableTableClient } from "./retryableTableClient";
