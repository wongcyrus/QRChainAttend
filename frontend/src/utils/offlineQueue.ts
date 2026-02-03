/**
 * Offline Queue Utility
 * Feature: qr-chain-attendance
 * Requirement: 20.5 - Queue operations for retry when connection restored
 * 
 * Provides utilities for queuing failed network operations and retrying
 * them when connection is restored.
 */

export interface QueuedOperation {
  id: string;
  operation: () => Promise<any>;
  retryCount: number;
  maxRetries: number;
  timestamp: number;
  description?: string;
}

export interface OfflineQueueOptions {
  maxRetries?: number;
  retryDelay?: number;
  onSuccess?: (id: string, result: any) => void;
  onError?: (id: string, error: Error) => void;
  onRetry?: (id: string, attempt: number) => void;
}

/**
 * OfflineQueue - Manages queued operations for offline scenarios
 * 
 * This class provides a simple queue for operations that fail due to
 * network issues. Operations are automatically retried when connection
 * is restored.
 * 
 * @example
 * ```tsx
 * const queue = new OfflineQueue({
 *   maxRetries: 3,
 *   onSuccess: (id, result) => console.log('Operation succeeded:', id),
 *   onError: (id, error) => console.error('Operation failed:', id, error),
 * });
 * 
 * // Queue an operation
 * queue.add(
 *   () => fetch('/api/scan/chain', { method: 'POST', body: data }),
 *   'scan-chain-operation'
 * );
 * 
 * // Retry all queued operations when connection restored
 * queue.retryAll();
 * ```
 */
export class OfflineQueue {
  private queue: Map<string, QueuedOperation> = new Map();
  private options: Required<OfflineQueueOptions>;
  private isProcessing = false;

  constructor(options: OfflineQueueOptions = {}) {
    this.options = {
      maxRetries: options.maxRetries ?? 3,
      retryDelay: options.retryDelay ?? 1000,
      onSuccess: options.onSuccess ?? (() => {}),
      onError: options.onError ?? (() => {}),
      onRetry: options.onRetry ?? (() => {}),
    };
  }

  /**
   * Add an operation to the queue
   * 
   * @param operation - Async function to execute
   * @param description - Optional description for debugging
   * @returns Operation ID
   */
  add(operation: () => Promise<any>, description?: string): string {
    const id = this.generateId();
    
    const queuedOp: QueuedOperation = {
      id,
      operation,
      retryCount: 0,
      maxRetries: this.options.maxRetries,
      timestamp: Date.now(),
      description,
    };

    this.queue.set(id, queuedOp);
    console.log(`[Offline Queue] Added operation: ${id}`, description);
    
    return id;
  }

  /**
   * Remove an operation from the queue
   * 
   * @param id - Operation ID
   */
  remove(id: string): void {
    this.queue.delete(id);
    console.log(`[Offline Queue] Removed operation: ${id}`);
  }

  /**
   * Get all queued operations
   */
  getAll(): QueuedOperation[] {
    return Array.from(this.queue.values());
  }

  /**
   * Get queue size
   */
  size(): number {
    return this.queue.size;
  }

  /**
   * Clear all queued operations
   */
  clear(): void {
    this.queue.clear();
    console.log('[Offline Queue] Cleared all operations');
  }

  /**
   * Retry a specific operation
   * 
   * @param id - Operation ID
   */
  async retry(id: string): Promise<void> {
    const op = this.queue.get(id);
    if (!op) {
      console.warn(`[Offline Queue] Operation not found: ${id}`);
      return;
    }

    try {
      op.retryCount++;
      this.options.onRetry(id, op.retryCount);
      console.log(`[Offline Queue] Retrying operation: ${id} (attempt ${op.retryCount})`);

      const result = await op.operation();
      
      // Success - remove from queue
      this.remove(id);
      this.options.onSuccess(id, result);
      console.log(`[Offline Queue] Operation succeeded: ${id}`);
    } catch (error) {
      console.error(`[Offline Queue] Operation failed: ${id}`, error);

      // Check if we should retry
      if (op.retryCount >= op.maxRetries) {
        // Max retries reached - remove from queue and call error handler
        this.remove(id);
        this.options.onError(id, error as Error);
        console.log(`[Offline Queue] Max retries reached for: ${id}`);
      } else {
        // Will retry later
        console.log(`[Offline Queue] Will retry operation: ${id} (${op.retryCount}/${op.maxRetries})`);
      }
    }
  }

  /**
   * Retry all queued operations
   * 
   * This should be called when connection is restored.
   */
  async retryAll(): Promise<void> {
    if (this.isProcessing) {
      console.log('[Offline Queue] Already processing queue');
      return;
    }

    const operations = this.getAll();
    if (operations.length === 0) {
      console.log('[Offline Queue] No operations to retry');
      return;
    }

    this.isProcessing = true;
    console.log(`[Offline Queue] Retrying ${operations.length} operations`);

    // Process operations sequentially with delay
    for (const op of operations) {
      await this.retry(op.id);
      
      // Add delay between retries to avoid overwhelming the server
      if (this.queue.has(op.id)) {
        await this.delay(this.options.retryDelay);
      }
    }

    this.isProcessing = false;
    console.log('[Offline Queue] Finished processing queue');
  }

  /**
   * Generate a unique operation ID
   */
  private generateId(): string {
    return `op_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Delay helper
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

/**
 * Global offline queue instance
 * 
 * Use this singleton for application-wide offline operation management.
 */
export const globalOfflineQueue = new OfflineQueue({
  maxRetries: 3,
  retryDelay: 2000,
  onSuccess: (id, result) => {
    console.log(`[Global Queue] Operation ${id} succeeded`);
  },
  onError: (id, error) => {
    console.error(`[Global Queue] Operation ${id} failed permanently:`, error);
  },
});

/**
 * Wrapper for fetch that automatically queues failed requests
 * 
 * @param url - Request URL
 * @param options - Fetch options
 * @param queueOptions - Queue options
 * @returns Promise that resolves with response or rejects with error
 * 
 * @example
 * ```tsx
 * try {
 *   const response = await fetchWithOfflineQueue('/api/scan/chain', {
 *     method: 'POST',
 *     body: JSON.stringify(data),
 *   });
 * } catch (error) {
 *   // Request failed and was queued for retry
 *   console.log('Request queued for retry');
 * }
 * ```
 */
export async function fetchWithOfflineQueue(
  url: string,
  options?: RequestInit,
  queueOptions?: {
    queue?: OfflineQueue;
    description?: string;
    autoQueue?: boolean;
  }
): Promise<Response> {
  const queue = queueOptions?.queue ?? globalOfflineQueue;
  const autoQueue = queueOptions?.autoQueue ?? true;

  try {
    const response = await fetch(url, options);
    
    // Check if response indicates offline (service worker offline response)
    if (response.status === 503 && response.statusText === 'Service Unavailable') {
      throw new Error('Network unavailable');
    }
    
    return response;
  } catch (error) {
    // Check if error is network-related
    const isNetworkError = 
      error instanceof TypeError ||
      (error as Error).message.includes('Network') ||
      (error as Error).message.includes('Failed to fetch');

    if (isNetworkError && autoQueue) {
      // Queue the operation for retry
      const operation = () => fetch(url, options);
      queue.add(operation, queueOptions?.description ?? `Fetch ${url}`);
      console.log(`[Offline Queue] Queued failed request: ${url}`);
    }

    throw error;
  }
}
