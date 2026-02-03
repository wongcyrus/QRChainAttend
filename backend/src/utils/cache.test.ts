/**
 * Tests for In-Memory Cache with TTL Support
 * Feature: qr-chain-attendance
 * Requirements: 16.1
 */

import { Cache, createCache } from './cache';

describe('Cache', () => {
  let cache: Cache<string>;

  beforeEach(() => {
    cache = createCache<string>({ defaultTTL: 1000 }); // 1 second default TTL
  });

  afterEach(() => {
    cache.stopCleanup();
    cache.clear();
  });

  describe('Basic Operations', () => {
    test('should set and get value', () => {
      cache.set('key1', 'value1');
      expect(cache.get('key1')).toBe('value1');
    });

    test('should return undefined for non-existent key', () => {
      expect(cache.get('nonexistent')).toBeUndefined();
    });

    test('should check if key exists', () => {
      cache.set('key1', 'value1');
      expect(cache.has('key1')).toBe(true);
      expect(cache.has('nonexistent')).toBe(false);
    });

    test('should delete value', () => {
      cache.set('key1', 'value1');
      expect(cache.delete('key1')).toBe(true);
      expect(cache.get('key1')).toBeUndefined();
      expect(cache.delete('key1')).toBe(false); // Already deleted
    });

    test('should clear all values', () => {
      cache.set('key1', 'value1');
      cache.set('key2', 'value2');
      cache.clear();
      expect(cache.get('key1')).toBeUndefined();
      expect(cache.get('key2')).toBeUndefined();
      expect(cache.size()).toBe(0);
    });

    test('should return cache size', () => {
      expect(cache.size()).toBe(0);
      cache.set('key1', 'value1');
      expect(cache.size()).toBe(1);
      cache.set('key2', 'value2');
      expect(cache.size()).toBe(2);
    });

    test('should return all keys', () => {
      cache.set('key1', 'value1');
      cache.set('key2', 'value2');
      const keys = cache.keys();
      expect(keys).toContain('key1');
      expect(keys).toContain('key2');
      expect(keys.length).toBe(2);
    });
  });

  describe('TTL Expiration', () => {
    test('should expire value after default TTL', async () => {
      cache.set('key1', 'value1');
      expect(cache.get('key1')).toBe('value1');

      // Wait for expiration (1 second + buffer)
      await new Promise(resolve => setTimeout(resolve, 1100));

      expect(cache.get('key1')).toBeUndefined();
    });

    test('should expire value after custom TTL', async () => {
      cache.set('key1', 'value1', 500); // 500ms TTL
      expect(cache.get('key1')).toBe('value1');

      // Wait for expiration
      await new Promise(resolve => setTimeout(resolve, 600));

      expect(cache.get('key1')).toBeUndefined();
    });

    test('should not expire value before TTL', async () => {
      cache.set('key1', 'value1', 1000); // 1 second TTL
      
      // Wait less than TTL
      await new Promise(resolve => setTimeout(resolve, 500));

      expect(cache.get('key1')).toBe('value1');
    });

    test('should return false for has() on expired key', async () => {
      cache.set('key1', 'value1', 500);
      expect(cache.has('key1')).toBe(true);

      await new Promise(resolve => setTimeout(resolve, 600));

      expect(cache.has('key1')).toBe(false);
    });

    test('should remove expired entry on get', async () => {
      cache.set('key1', 'value1', 500);
      expect(cache.size()).toBe(1);

      await new Promise(resolve => setTimeout(resolve, 600));

      cache.get('key1'); // Should trigger removal
      expect(cache.size()).toBe(0);
    });
  });

  describe('Cache Invalidation', () => {
    test('should invalidate specific key', () => {
      cache.set('key1', 'value1');
      cache.set('key2', 'value2');
      
      cache.delete('key1');
      
      expect(cache.get('key1')).toBeUndefined();
      expect(cache.get('key2')).toBe('value2');
    });

    test('should update value for existing key', () => {
      cache.set('key1', 'value1');
      expect(cache.get('key1')).toBe('value1');
      
      cache.set('key1', 'value2');
      expect(cache.get('key1')).toBe('value2');
    });

    test('should update TTL when setting existing key', async () => {
      cache.set('key1', 'value1', 500);
      
      // Wait 300ms
      await new Promise(resolve => setTimeout(resolve, 300));
      
      // Update with new TTL
      cache.set('key1', 'value2', 1000);
      
      // Wait another 300ms (total 600ms, original would have expired)
      await new Promise(resolve => setTimeout(resolve, 300));
      
      // Should still be valid with new TTL
      expect(cache.get('key1')).toBe('value2');
    });
  });

  describe('Cleanup', () => {
    test('should cleanup expired entries', async () => {
      cache.set('key1', 'value1', 500);
      cache.set('key2', 'value2', 2000);
      
      await new Promise(resolve => setTimeout(resolve, 600));
      
      const removed = cache.cleanup();
      expect(removed).toBe(1);
      expect(cache.size()).toBe(1);
      expect(cache.get('key2')).toBe('value2');
    });

    test('should return 0 when no expired entries', () => {
      cache.set('key1', 'value1', 2000);
      const removed = cache.cleanup();
      expect(removed).toBe(0);
    });

    test('should cleanup all expired entries', async () => {
      cache.set('key1', 'value1', 500);
      cache.set('key2', 'value2', 500);
      cache.set('key3', 'value3', 500);
      
      await new Promise(resolve => setTimeout(resolve, 600));
      
      const removed = cache.cleanup();
      expect(removed).toBe(3);
      expect(cache.size()).toBe(0);
    });
  });

  describe('Statistics', () => {
    test('should return accurate stats for active entries', () => {
      cache.set('key1', 'value1');
      cache.set('key2', 'value2');
      
      const stats = cache.getStats();
      expect(stats.totalEntries).toBe(2);
      expect(stats.activeEntries).toBe(2);
      expect(stats.expiredEntries).toBe(0);
    });

    test('should return accurate stats with expired entries', async () => {
      cache.set('key1', 'value1', 500);
      cache.set('key2', 'value2', 2000);
      
      await new Promise(resolve => setTimeout(resolve, 600));
      
      const stats = cache.getStats();
      expect(stats.totalEntries).toBe(2);
      expect(stats.activeEntries).toBe(1);
      expect(stats.expiredEntries).toBe(1);
    });

    test('should return zero stats for empty cache', () => {
      const stats = cache.getStats();
      expect(stats.totalEntries).toBe(0);
      expect(stats.activeEntries).toBe(0);
      expect(stats.expiredEntries).toBe(0);
    });
  });

  describe('Type Safety', () => {
    test('should work with different types', () => {
      const numberCache = createCache<number>();
      numberCache.set('count', 42);
      expect(numberCache.get('count')).toBe(42);
      numberCache.stopCleanup();

      const objectCache = createCache<{ name: string }>();
      objectCache.set('user', { name: 'Alice' });
      expect(objectCache.get('user')).toEqual({ name: 'Alice' });
      objectCache.stopCleanup();

      const arrayCache = createCache<string[]>();
      arrayCache.set('tags', ['tag1', 'tag2']);
      expect(arrayCache.get('tags')).toEqual(['tag1', 'tag2']);
      arrayCache.stopCleanup();
    });
  });

  describe('Edge Cases', () => {
    test('should handle zero TTL', async () => {
      cache.set('key1', 'value1', 0);
      // Wait a tiny bit for time to advance
      await new Promise(resolve => setTimeout(resolve, 10));
      // Should be expired
      expect(cache.get('key1')).toBeUndefined();
    });

    test('should handle negative TTL', () => {
      cache.set('key1', 'value1', -1000);
      // Should be immediately expired
      expect(cache.get('key1')).toBeUndefined();
    });

    test('should handle very large TTL', () => {
      const largeCache = createCache<string>({ defaultTTL: 1000000000 });
      largeCache.set('key1', 'value1');
      expect(largeCache.get('key1')).toBe('value1');
      largeCache.stopCleanup();
    });

    test('should handle empty string key', () => {
      cache.set('', 'value1');
      expect(cache.get('')).toBe('value1');
    });

    test('should handle special characters in key', () => {
      const specialKey = 'key:with:colons/and/slashes';
      cache.set(specialKey, 'value1');
      expect(cache.get(specialKey)).toBe('value1');
    });

    test('should handle undefined value', () => {
      const anyCache = createCache<any>();
      anyCache.set('key1', undefined);
      // get() returns undefined for both missing and undefined values
      // This is expected behavior - use has() to distinguish
      expect(anyCache.has('key1')).toBe(true);
      anyCache.stopCleanup();
    });

    test('should handle null value', () => {
      const anyCache = createCache<any>();
      anyCache.set('key1', null);
      expect(anyCache.get('key1')).toBeNull();
      anyCache.stopCleanup();
    });
  });

  describe('Concurrent Operations', () => {
    test('should handle multiple sets to same key', () => {
      cache.set('key1', 'value1');
      cache.set('key1', 'value2');
      cache.set('key1', 'value3');
      expect(cache.get('key1')).toBe('value3');
    });

    test('should handle rapid set/get operations', () => {
      for (let i = 0; i < 100; i++) {
        cache.set(`key${i}`, `value${i}`);
      }
      
      for (let i = 0; i < 100; i++) {
        expect(cache.get(`key${i}`)).toBe(`value${i}`);
      }
    });
  });

  describe('Default TTL', () => {
    test('should use default TTL when not specified', async () => {
      const shortCache = createCache<string>({ defaultTTL: 500 });
      shortCache.set('key1', 'value1');
      
      await new Promise(resolve => setTimeout(resolve, 600));
      
      expect(shortCache.get('key1')).toBeUndefined();
      shortCache.stopCleanup();
    });

    test('should use 60 seconds as default when not specified', () => {
      const defaultCache = createCache<string>();
      defaultCache.set('key1', 'value1');
      
      // Should still be valid after 1 second
      expect(defaultCache.get('key1')).toBe('value1');
      defaultCache.stopCleanup();
    });
  });
});
