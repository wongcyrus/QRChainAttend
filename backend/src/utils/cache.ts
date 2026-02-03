/**
 * In-Memory Cache with TTL Support
 * Feature: qr-chain-attendance
 * Requirements: 16.1
 * 
 * Provides a simple in-memory cache for frequently accessed data
 * to reduce Azure Table Storage queries and improve p95 latency.
 */

/**
 * Cache entry with value and expiration time
 */
interface CacheEntry<T> {
  value: T;
  expiresAt: number; // Unix timestamp in milliseconds
}

/**
 * Cache options
 */
export interface CacheOptions {
  /**
   * Default TTL in milliseconds
   * Default: 60000 (60 seconds)
   */
  defaultTTL?: number;
}

/**
 * Simple in-memory cache with TTL support
 * 
 * Features:
 * - Automatic expiration based on TTL
 * - Manual invalidation
 * - Type-safe get/set operations
 * - Cleanup of expired entries
 */
export class Cache<T = any> {
  private store: Map<string, CacheEntry<T>> = new Map();
  private defaultTTL: number;
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor(options: CacheOptions = {}) {
    this.defaultTTL = options.defaultTTL ?? 60000; // Default 60 seconds
    
    // Start cleanup interval to remove expired entries every 30 seconds
    this.startCleanup();
  }

  /**
   * Get value from cache
   * 
   * @param key - Cache key
   * @returns Cached value or undefined if not found or expired
   */
  get(key: string): T | undefined {
    const entry = this.store.get(key);
    
    if (!entry) {
      return undefined;
    }
    
    // Check if expired
    if (Date.now() > entry.expiresAt) {
      this.store.delete(key);
      return undefined;
    }
    
    return entry.value;
  }

  /**
   * Set value in cache with optional TTL
   * 
   * @param key - Cache key
   * @param value - Value to cache
   * @param ttl - Time to live in milliseconds (optional, uses default if not provided)
   */
  set(key: string, value: T, ttl?: number): void {
    const ttlMs = ttl ?? this.defaultTTL;
    const expiresAt = Date.now() + ttlMs;
    
    this.store.set(key, {
      value,
      expiresAt
    });
  }

  /**
   * Check if key exists in cache and is not expired
   * 
   * @param key - Cache key
   * @returns True if key exists and is not expired
   */
  has(key: string): boolean {
    const entry = this.store.get(key);
    
    if (!entry) {
      return false;
    }
    
    // Check if expired
    if (Date.now() > entry.expiresAt) {
      this.store.delete(key);
      return false;
    }
    
    return true;
  }

  /**
   * Delete value from cache
   * 
   * @param key - Cache key
   * @returns True if key was deleted, false if not found
   */
  delete(key: string): boolean {
    return this.store.delete(key);
  }

  /**
   * Clear all entries from cache
   */
  clear(): void {
    this.store.clear();
  }

  /**
   * Get number of entries in cache (including expired)
   * 
   * @returns Number of entries
   */
  size(): number {
    return this.store.size;
  }

  /**
   * Get all keys in cache (including expired)
   * 
   * @returns Array of cache keys
   */
  keys(): string[] {
    return Array.from(this.store.keys());
  }

  /**
   * Start periodic cleanup of expired entries
   * Runs every 30 seconds
   */
  private startCleanup(): void {
    this.cleanupInterval = setInterval(() => {
      this.cleanup();
    }, 30000); // 30 seconds
    
    // Don't prevent Node.js from exiting
    if (this.cleanupInterval.unref) {
      this.cleanupInterval.unref();
    }
  }

  /**
   * Stop periodic cleanup
   */
  stopCleanup(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
  }

  /**
   * Remove expired entries from cache
   * 
   * @returns Number of entries removed
   */
  cleanup(): number {
    const now = Date.now();
    let removed = 0;
    
    for (const [key, entry] of this.store.entries()) {
      if (now > entry.expiresAt) {
        this.store.delete(key);
        removed++;
      }
    }
    
    return removed;
  }

  /**
   * Get cache statistics
   * 
   * @returns Cache statistics
   */
  getStats(): {
    totalEntries: number;
    expiredEntries: number;
    activeEntries: number;
  } {
    const now = Date.now();
    let expired = 0;
    
    for (const entry of this.store.values()) {
      if (now > entry.expiresAt) {
        expired++;
      }
    }
    
    return {
      totalEntries: this.store.size,
      expiredEntries: expired,
      activeEntries: this.store.size - expired
    };
  }
}

/**
 * Create a new cache instance
 * 
 * @param options - Cache options
 * @returns New cache instance
 */
export function createCache<T = any>(options: CacheOptions = {}): Cache<T> {
  return new Cache<T>(options);
}
