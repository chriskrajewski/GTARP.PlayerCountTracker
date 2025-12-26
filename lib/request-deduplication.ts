/**
 * Request Deduplication Module
 * 
 * Prevents duplicate API calls by caching in-flight requests.
 * Useful for reducing load when multiple components request the same data simultaneously.
 * 
 * @example
 * const data = await deduplicateRequest(
 *   'fetch-servers',
 *   () => fetch('/api/servers'),
 *   5000 // 5 second TTL
 * );
 */

interface CacheEntry<T> {
  promise: Promise<T>;
  expiresAt: number;
}

const requestCache = new Map<string, CacheEntry<any>>();

/**
 * Deduplicates requests by caching in-flight promises
 * 
 * @param key - Unique identifier for the request
 * @param fn - Async function to execute
 * @param ttl - Time to live in milliseconds (default: 5000ms)
 * @returns Promise that resolves to the result
 */
export async function deduplicateRequest<T>(
  key: string,
  fn: () => Promise<T>,
  ttl: number = 5000
): Promise<T> {
  const now = Date.now();
  const cached = requestCache.get(key);

  // Return cached promise if still valid
  if (cached && cached.expiresAt > now) {
    return cached.promise;
  }

  // Remove expired entry
  if (cached) {
    requestCache.delete(key);
  }

  // Create new promise
  const promise = fn();
  const expiresAt = now + ttl;

  // Store in cache
  requestCache.set(key, { promise, expiresAt });

  // Clean up after TTL
  promise
    .finally(() => {
      // Only delete if this is still the cached entry
      const current = requestCache.get(key);
      if (current && current.expiresAt === expiresAt) {
        requestCache.delete(key);
      }
    })
    .catch(() => {
      // Silently handle cleanup errors
    });

  return promise;
}

/**
 * Clears all cached requests
 */
export function clearRequestCache(): void {
  requestCache.clear();
}

/**
 * Clears a specific cached request
 * 
 * @param key - The cache key to clear
 */
export function clearRequestCacheEntry(key: string): void {
  requestCache.delete(key);
}

/**
 * Gets cache statistics for debugging
 */
export function getRequestCacheStats(): {
  size: number;
  keys: string[];
} {
  return {
    size: requestCache.size,
    keys: Array.from(requestCache.keys()),
  };
}
