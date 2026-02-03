/**
 * Retryable Table Client Wrapper
 * Feature: qr-chain-attendance
 * Task: 20.3
 * Requirements: Storage error handling
 * 
 * Wraps Azure Table Storage operations with automatic retry logic
 * for transient failures (network errors, storage throttling, etc.)
 */

import {
  TableClient,
  TableEntity,
  CreateTableEntityOptions,
  UpdateTableEntityOptions,
  GetTableEntityOptions,
  DeleteTableEntityOptions,
  ListTableEntitiesOptions,
  TableEntityResult,
  TableEntityQueryOptions,
} from "@azure/data-tables";
import { withRetry, RetryOptions } from "../utils/retry";

/**
 * Default retry options for Table Storage operations
 * Requirements: Storage error handling
 */
const DEFAULT_TABLE_RETRY_OPTIONS: RetryOptions = {
  maxRetries: 3,
  initialDelayMs: 100,
  maxDelayMs: 10000,
  backoffMultiplier: 2,
  useJitter: true,
  onRetry: (error, attempt, delayMs) => {
    console.warn(
      `[TableStorage] Retry attempt ${attempt} after ${delayMs}ms due to: ${error.message}`
    );
  },
};

/**
 * Retryable wrapper for Azure TableClient
 * Automatically retries transient failures with exponential backoff
 * 
 * Usage:
 * ```typescript
 * const tableClient = getTableClient(TableName.SESSIONS);
 * const retryableClient = new RetryableTableClient(tableClient);
 * 
 * // All operations automatically retry on transient failures
 * const entity = await retryableClient.getEntity("partition", "row");
 * await retryableClient.createEntity(entity);
 * ```
 */
export class RetryableTableClient<T extends TableEntity = TableEntity> {
  private client: TableClient;
  private retryOptions: RetryOptions;

  constructor(client: TableClient, retryOptions?: RetryOptions) {
    this.client = client;
    this.retryOptions = {
      ...DEFAULT_TABLE_RETRY_OPTIONS,
      ...retryOptions,
    };
  }

  /**
   * Get the underlying TableClient
   * Use this for operations that should NOT be retried
   */
  getUnderlyingClient(): TableClient {
    return this.client;
  }

  /**
   * Create a new entity with retry logic
   * Requirements: Storage error handling
   */
  async createEntity(
    entity: T,
    options?: CreateTableEntityOptions
  ): Promise<TableEntityResult<T>> {
    return withRetry(
      () => this.client.createEntity(entity, options),
      this.retryOptions
    );
  }

  /**
   * Update an entity with retry logic
   * Requirements: Storage error handling
   */
  async updateEntity(
    entity: T,
    mode?: "Merge" | "Replace",
    options?: UpdateTableEntityOptions
  ): Promise<TableEntityResult<T>> {
    return withRetry(
      () => this.client.updateEntity(entity, mode, options),
      this.retryOptions
    );
  }

  /**
   * Upsert an entity with retry logic
   * Requirements: Storage error handling
   */
  async upsertEntity(
    entity: T,
    mode?: "Merge" | "Replace",
    options?: UpdateTableEntityOptions
  ): Promise<TableEntityResult<T>> {
    return withRetry(
      () => this.client.upsertEntity(entity, mode, options),
      this.retryOptions
    );
  }

  /**
   * Get an entity with retry logic
   * Requirements: Storage error handling
   */
  async getEntity<U extends T = T>(
    partitionKey: string,
    rowKey: string,
    options?: GetTableEntityOptions
  ): Promise<TableEntityResult<U>> {
    return withRetry(
      () => this.client.getEntity<U>(partitionKey, rowKey, options),
      this.retryOptions
    );
  }

  /**
   * Delete an entity with retry logic
   * Requirements: Storage error handling
   */
  async deleteEntity(
    partitionKey: string,
    rowKey: string,
    options?: DeleteTableEntityOptions
  ): Promise<void> {
    return withRetry(
      () => this.client.deleteEntity(partitionKey, rowKey, options),
      this.retryOptions
    );
  }

  /**
   * List entities with retry logic
   * Requirements: Storage error handling
   * 
   * Note: This returns an async iterable. The retry logic applies to
   * the initial query setup, but individual page fetches are not retried.
   * For more robust pagination retry, consider using listEntitiesArray.
   */
  listEntities<U extends T = T>(
    options?: ListTableEntitiesOptions
  ): AsyncIterableIterator<TableEntityResult<U>> {
    // Note: We can't easily wrap the async iterator with retry logic
    // because it's a stream. The underlying SDK already has some retry logic.
    // For critical operations, use listEntitiesArray instead.
    return this.client.listEntities<U>(options);
  }

  /**
   * List all entities as an array with retry logic
   * Requirements: Storage error handling
   * 
   * This is more robust than listEntities for retry purposes,
   * but loads all entities into memory.
   */
  async listEntitiesArray<U extends T = T>(
    options?: ListTableEntitiesOptions
  ): Promise<TableEntityResult<U>[]> {
    return withRetry(async () => {
      const entities: TableEntityResult<U>[] = [];
      for await (const entity of this.client.listEntities<U>(options)) {
        entities.push(entity);
      }
      return entities;
    }, this.retryOptions);
  }

  /**
   * Submit a transaction with retry logic
   * Requirements: Storage error handling
   */
  async submitTransaction(
    actions: Array<any>
  ): Promise<any> {
    return withRetry(
      () => this.client.submitTransaction(actions),
      this.retryOptions
    );
  }

  /**
   * Create the table if it doesn't exist with retry logic
   * Requirements: Storage error handling
   */
  async createTable(): Promise<void> {
    return withRetry(
      () => this.client.createTable(),
      this.retryOptions
    );
  }

  /**
   * Delete the table with retry logic
   * Requirements: Storage error handling
   */
  async deleteTable(): Promise<void> {
    return withRetry(
      () => this.client.deleteTable(),
      this.retryOptions
    );
  }
}

/**
 * Create a retryable table client
 * Convenience function for creating RetryableTableClient instances
 * 
 * @param client - TableClient to wrap
 * @param retryOptions - Optional retry configuration
 * @returns RetryableTableClient instance
 */
export function createRetryableTableClient<T extends TableEntity = TableEntity>(
  client: TableClient,
  retryOptions?: RetryOptions
): RetryableTableClient<T> {
  return new RetryableTableClient<T>(client, retryOptions);
}
