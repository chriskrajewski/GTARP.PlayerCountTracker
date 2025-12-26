/**
 * Request Deduplication Module
 * 
 * Prevents duplicate API calls by caching in-flight requests.
 * Useful for reducing load when multiple components request the same data simultaneously.
 * 
 * Features:
 * - Request fingerprinting (URL + method + body hash)
 * - Configurable TTL per request type
 * - Automatic cleanup of expired entries
 * - Cache statistics for monitoring
 * 
 * @example
 * const data = await deduplicateRequest(
 *   'fetch-servers',
 *   () => fetch('/api/servers'),
 *   5000 // 5 second TTL
 * );
 * 
 * @module lib/request-deduplication
 */

import { NextRequest } from 'next/server';
import { createHash } from 'crypto';

/**
 * Cache entry interface
 */
interface CacheEntry<T> {
  promise: Promise<T>;
  expiresAt: number;
  createdAt: number;
  hits: number;
}

/**
 * Request fingerprint options
 */
interface FingerprintOptions {
  /** Include URL in fingerprint (default: true) */
  includeUrl?: boolean;
  /** Include method in fingerprint (default: true) */
  includeMethod?: boolean;
  /** Include body in fingerprint (default: true for POST/PUT/PATCH) */
  includeBody?: boolean;
  /** Include specific headers in fingerprint */
  includeHeaders?: string[];
  /** Custom fingerprint prefix */
  prefix?: string;
}

/**
 * Deduplication configuration
 */
interface DeduplicationConfig {
  /** Default TTL in milliseconds */
  defaultTTL: number;
  /** Maximum cache size (entries) */
  maxCacheSize: number;
  /** Cleanup interval in milliseconds */
  cleanupInterval: number;
}

/**
 * Default configuration
 */
const DEFAULT_CONFIG: DeduplicationConfig = {
  defaultTTL: 5000,
  maxCacheSize: 1000,
  cleanupInterval: 30000,
};

/**
 * In-memory request cache
 */
const requestCache = new Map<string, CacheEntry<unknown>>();

/**
 * Cache statistics
 */
let cacheStats = {
  hits: 0,
  misses: 0,
  evictions: 0,
  lastCleanup: Date.now(),
};

/**
 * Generate a hash from content
 * 
 * @param content - Content to hash
 * @returns MD5 hash of content
 */
function generateHash(content: string): string {
  return createHash('md5').update(content).digest('hex').substring(0, 12);
}

/**
 * Generate a request fingerprint for deduplication
 * 
 * Creates a unique identifier based on request properties.
 * Used to identify duplicate requests.
 * 
 * @param request - Next.js request object
 * @param options - Fingerprint options
 * @returns Unique fingerprint string
 * 
 * @example
 * const fingerprint = await generateRequestFingerprint(request);
 * // "req:GET:/api/servers:abc123"
 */
export async function generateRequestFingerprint(
  request: NextRequest,
  options: FingerprintOptions = {}
): Promise<string> {
  const {
    includeUrl = true,
    includeMethod = true,
    includeBody = true,
    includeHeaders = [],
    prefix = 'req',
  } = options;
  
  const parts: string[] = [prefix];
  
  // Add method
  if (includeMethod) {
    parts.push(request.method);
  }
  
  // Add URL path and query params
  if (includeUrl) {
    const url = request.nextUrl;
    parts.push(url.pathname);
    
    // Include sorted query params for consistency
    const params = Array.from(url.searchParams.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${k}=${v}`)
      .join('&');
    
    if (params) {
      parts.push(generateHash(params));
    }
  }
  
  // Add body hash for POST/PUT/PATCH requests
  if (includeBody && ['POST', 'PUT', 'PATCH'].includes(request.method)) {
    try {
      const body = await request.clone().text();
      if (body) {
        parts.push(generateHash(body));
      }
    } catch {
      // Body might not be readable, skip
    }
  }
  
  // Add specific headers if requested
  if (includeHeaders.length > 0) {
    const headerValues = includeHeaders
      .map(h => request.headers.get(h) || '')
      .filter(Boolean)
      .join(':');
    
    if (headerValues) {
      parts.push(generateHash(headerValues));
    }
  }
  
  return parts.join(':');
}

/**
 * Cleanup expired entries and enforce max cache size
 */
function cleanupCache(): void {
  const now = Date.now();
  
  // Skip if cleanup was recent
  if (now - cacheStats.lastCleanup < DEFAULT_CONFIG.cleanupInterval) {
    return;
  }
  
  cacheStats.lastCleanup = now;
  
  // Remove expired entries
  for (const [key, entry] of requestCache.entries()) {
    if (entry.expiresAt <= now) {
      requestCache.delete(key);
      cacheStats.evictions++;
    }
  }
  
  // Enforce max cache size (LRU-like eviction based on creation time)
  if (requestCache.size > DEFAULT_CONFIG.maxCacheSize) {
    const entries = Array.from(requestCache.entries())
      .sort(([, a], [, b]) => a.createdAt - b.createdAt);
    
    const toRemove = entries.slice(0, requestCache.size - DEFAULT_CONFIG.maxCacheSize);
    for (const [key] of toRemove) {
      requestCache.delete(key);
      cacheStats.evictions++;
    }
  }
}

/**
 * Deduplicates requests by caching in-flight promises
 * 
 * @param key - Unique identifier for the request
 * @param fn - Async function to execute
 * @param ttl - Time to live in milliseconds (default: 5000ms)
 * @returns Promise that resolves to the result
 * 
 * @example
 * const data = await deduplicateRequest(
 *   'fetch-servers',
 *   () => fetch('/api/servers'),
 *   5000
 * );
 */
export async function deduplicateRequest<T>(
  key: string,
  fn: () => Promise<T>,
  ttl: number = DEFAULT_CONFIG.defaultTTL
): Promise<T> {
  const now = Date.now();
  
  // Cleanup periodically
  cleanupCache();
  
  const cached = requestCache.get(key) as CacheEntry<T> | undefined;

  // Return cached promise if still valid
  if (cached && cached.expiresAt > now) {
    cached.hits++;
    cacheStats.hits++;
    return cached.promise;
  }

  // Remove expired entry
  if (cached) {
    requestCache.delete(key);
  }

  cacheStats.misses++;

  // Create new promise
  const promise = fn();
  const expiresAt = now + ttl;
  const entry: CacheEntry<T> = {
    promise,
    expiresAt,
    createdAt: now,
    hits: 0,
  };

  // Store in cache
  requestCache.set(key, entry as CacheEntry<unknown>);

  // Clean up after TTL or on error
  promise
    .finally(() => {
      // Only delete if this is still the cached entry
      const current = requestCache.get(key);
      if (current && current.expiresAt === expiresAt) {
        // Keep successful responses until TTL expires
        // They'll be cleaned up by the periodic cleanup
      }
    })
    .catch(() => {
      // Remove failed requests immediately to allow retry
      const current = requestCache.get(key);
      if (current && current.expiresAt === expiresAt) {
        requestCache.delete(key);
      }
    });

  return promise;
}

/**
 * Deduplicate an API request using request fingerprinting
 * 
 * @param request - Next.js request object
 * @param fn - Async function to execute
 * @param options - Fingerprint and TTL options
 * @returns Promise that resolves to the result
 * 
 * @example
 * export async function GET(request: NextRequest) {
 *   return deduplicateApiRequest(request, async () => {
 *     const data = await fetchData();
 *     return NextResponse.json(data);
 *   });
 * }
 */
export async function deduplicateApiRequest<T>(
  request: NextRequest,
  fn: () => Promise<T>,
  options: FingerprintOptions & { ttl?: number } = {}
): Promise<T> {
  const { ttl = DEFAULT_CONFIG.defaultTTL, ...fingerprintOptions } = options;
  const fingerprint = await generateRequestFingerprint(request, fingerprintOptions);
  return deduplicateRequest(fingerprint, fn, ttl);
}

/**
 * Clears all cached requests
 */
export function clearRequestCache(): void {
  requestCache.clear();
  cacheStats = {
    hits: 0,
    misses: 0,
    evictions: 0,
    lastCleanup: Date.now(),
  };
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
 * Gets cache statistics for debugging and monitoring
 */
export function getRequestCacheStats(): {
  size: number;
  keys: string[];
  hits: number;
  misses: number;
  evictions: number;
  hitRate: number;
} {
  const total = cacheStats.hits + cacheStats.misses;
  const hitRate = total > 0 ? cacheStats.hits / total : 0;
  
  return {
    size: requestCache.size,
    keys: Array.from(requestCache.keys()),
    hits: cacheStats.hits,
    misses: cacheStats.misses,
    evictions: cacheStats.evictions,
    hitRate: Math.round(hitRate * 100) / 100,
  };
}

/**
 * Check if a key is currently cached
 * 
 * @param key - Cache key to check
 * @returns true if key exists and is not expired
 */
export function isCached(key: string): boolean {
  const entry = requestCache.get(key);
  if (!entry) return false;
  return entry.expiresAt > Date.now();
}

/**
 * Get remaining TTL for a cached entry
 * 
 * @param key - Cache key to check
 * @returns Remaining TTL in milliseconds, or 0 if not cached
 */
export function getRemainingTTL(key: string): number {
  const entry = requestCache.get(key);
  if (!entry) return 0;
  const remaining = entry.expiresAt - Date.now();
  return Math.max(0, remaining);
}
