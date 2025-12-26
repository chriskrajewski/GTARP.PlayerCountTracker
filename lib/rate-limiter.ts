/**
 * Enhanced Rate Limiter Module
 * 
 * Provides comprehensive rate limiting capabilities including:
 * - Per-IP rate limiting with sliding window algorithm
 * - Per-user rate limiting for authenticated endpoints
 * - Configurable rate limit tiers
 * - Rate limit bypass for trusted sources
 * 
 * @module lib/rate-limiter
 */

import { NextRequest, NextResponse } from 'next/server';

/**
 * Rate limit configuration
 */
export interface RateLimitConfig {
  /** Maximum number of requests allowed in the window */
  maxRequests: number;
  /** Time window in milliseconds */
  windowMs: number;
  /** Optional identifier for the rate limit (for logging) */
  identifier?: string;
  /** Skip rate limiting for certain conditions */
  skip?: (request: NextRequest) => boolean;
  /** Custom key generator for rate limiting */
  keyGenerator?: (request: NextRequest) => string;
  /** Headers to include in rate limit response */
  includeHeaders?: boolean;
}

/**
 * Rate limit entry stored in memory
 */
interface RateLimitEntry {
  /** Timestamps of requests within the window (sliding window) */
  timestamps: number[];
  /** First request timestamp for this entry */
  firstRequest: number;
}

/**
 * Rate limit result
 */
export interface RateLimitResult {
  /** Whether the request is allowed */
  allowed: boolean;
  /** Number of remaining requests */
  remaining: number;
  /** Total requests allowed */
  limit: number;
  /** Time until reset in seconds */
  resetIn: number;
  /** Number of requests made in current window */
  current: number;
}

/**
 * In-memory store for rate limiting
 * In production, consider using Redis for distributed rate limiting
 */
const rateLimitStore = new Map<string, RateLimitEntry>();

/**
 * Cleanup interval for expired entries (every 60 seconds)
 */
const CLEANUP_INTERVAL_MS = 60 * 1000;
let lastCleanup = Date.now();

/**
 * Default rate limit configurations for different tiers
 */
export const RATE_LIMIT_TIERS = {
  /** Standard API endpoints */
  standard: {
    maxRequests: 100,
    windowMs: 60 * 1000, // 1 minute
  },
  /** Strict rate limiting for sensitive endpoints */
  strict: {
    maxRequests: 10,
    windowMs: 60 * 1000, // 1 minute
  },
  /** Relaxed rate limiting for read-only endpoints */
  relaxed: {
    maxRequests: 300,
    windowMs: 60 * 1000, // 1 minute
  },
  /** Very strict for authentication endpoints */
  auth: {
    maxRequests: 5,
    windowMs: 60 * 1000, // 1 minute
  },
  /** AI/Chat endpoints (expensive operations) */
  ai: {
    maxRequests: 5,
    windowMs: 60 * 1000, // 1 minute
  },
} as const;

/**
 * Trusted IP addresses that bypass rate limiting
 * Add internal services, monitoring, etc.
 */
const TRUSTED_IPS = new Set([
  '127.0.0.1',
  '::1',
  // Add Vercel's internal IPs if needed
]);

/**
 * Extract client IP from request
 * 
 * @param request - Next.js request object
 * @returns Client IP address
 */
export function getClientIP(request: NextRequest): string {
  // Check various headers for the real IP (in order of preference)
  const forwardedFor = request.headers.get('x-forwarded-for');
  if (forwardedFor) {
    // x-forwarded-for can contain multiple IPs, take the first one
    return forwardedFor.split(',')[0].trim();
  }
  
  const realIP = request.headers.get('x-real-ip');
  if (realIP) {
    return realIP;
  }
  
  const cfConnectingIP = request.headers.get('cf-connecting-ip');
  if (cfConnectingIP) {
    return cfConnectingIP;
  }
  
  // Fallback to unknown
  return 'unknown';
}

/**
 * Clean up expired rate limit entries
 */
function cleanupExpiredEntries(windowMs: number): void {
  const now = Date.now();
  
  // Only cleanup periodically to avoid performance impact
  if (now - lastCleanup < CLEANUP_INTERVAL_MS) {
    return;
  }
  
  lastCleanup = now;
  const cutoff = now - windowMs;
  
  for (const [key, entry] of rateLimitStore.entries()) {
    // Remove entries where all timestamps are expired
    if (entry.timestamps.every(ts => ts < cutoff)) {
      rateLimitStore.delete(key);
    }
  }
}

/**
 * Sliding window rate limiter
 * 
 * Uses a sliding window algorithm for more accurate rate limiting.
 * Unlike fixed window, this prevents burst attacks at window boundaries.
 * 
 * @param key - Unique identifier for the rate limit (usually IP + endpoint)
 * @param config - Rate limit configuration
 * @returns Rate limit result
 */
export function checkRateLimit(key: string, config: RateLimitConfig): RateLimitResult {
  const now = Date.now();
  const { maxRequests, windowMs } = config;
  const windowStart = now - windowMs;
  
  // Cleanup expired entries periodically
  cleanupExpiredEntries(windowMs);
  
  // Get or create entry
  let entry = rateLimitStore.get(key);
  
  if (!entry) {
    entry = {
      timestamps: [],
      firstRequest: now,
    };
    rateLimitStore.set(key, entry);
  }
  
  // Filter out timestamps outside the current window (sliding window)
  entry.timestamps = entry.timestamps.filter(ts => ts > windowStart);
  
  // Calculate current request count
  const current = entry.timestamps.length;
  const remaining = Math.max(0, maxRequests - current);
  
  // Calculate reset time (when the oldest request in window expires)
  const oldestTimestamp = entry.timestamps[0] || now;
  const resetIn = Math.ceil((oldestTimestamp + windowMs - now) / 1000);
  
  // Check if rate limit exceeded
  if (current >= maxRequests) {
    return {
      allowed: false,
      remaining: 0,
      limit: maxRequests,
      resetIn: Math.max(1, resetIn),
      current,
    };
  }
  
  // Add current request timestamp
  entry.timestamps.push(now);
  
  return {
    allowed: true,
    remaining: remaining - 1, // Subtract 1 for current request
    limit: maxRequests,
    resetIn: Math.max(1, resetIn),
    current: current + 1,
  };
}

/**
 * Generate rate limit key from request
 * 
 * @param request - Next.js request object
 * @param config - Rate limit configuration
 * @returns Rate limit key
 */
function generateRateLimitKey(request: NextRequest, config: RateLimitConfig): string {
  if (config.keyGenerator) {
    return config.keyGenerator(request);
  }
  
  const ip = getClientIP(request);
  const path = request.nextUrl.pathname;
  const identifier = config.identifier || 'default';
  
  return `ratelimit:${identifier}:${ip}:${path}`;
}

/**
 * Rate limiting middleware function
 * 
 * @param request - Next.js request object
 * @param config - Rate limit configuration
 * @returns null if allowed, NextResponse if rate limited
 * 
 * @example
 * export async function GET(request: NextRequest) {
 *   const rateLimitResponse = await rateLimit(request, RATE_LIMIT_TIERS.standard);
 *   if (rateLimitResponse) return rateLimitResponse;
 *   
 *   // Handle request...
 * }
 */
export async function rateLimit(
  request: NextRequest,
  config: Partial<RateLimitConfig> = {}
): Promise<NextResponse | null> {
  // Merge with defaults
  const fullConfig: RateLimitConfig = {
    ...RATE_LIMIT_TIERS.standard,
    includeHeaders: true,
    ...config,
  };
  
  // Check skip condition
  if (fullConfig.skip && fullConfig.skip(request)) {
    return null;
  }
  
  // Check trusted IPs
  const ip = getClientIP(request);
  if (TRUSTED_IPS.has(ip)) {
    return null;
  }
  
  // Generate key and check rate limit
  const key = generateRateLimitKey(request, fullConfig);
  const result = checkRateLimit(key, fullConfig);
  
  // Build headers
  const headers: Record<string, string> = {};
  if (fullConfig.includeHeaders) {
    headers['X-RateLimit-Limit'] = result.limit.toString();
    headers['X-RateLimit-Remaining'] = result.remaining.toString();
    headers['X-RateLimit-Reset'] = result.resetIn.toString();
  }
  
  // If rate limit exceeded, return 429 response
  if (!result.allowed) {
    return NextResponse.json(
      {
        success: false,
        error: 'Rate limit exceeded',
        message: 'Too many requests. Please try again later.',
        retryAfter: result.resetIn,
      },
      {
        status: 429,
        headers: {
          ...headers,
          'Retry-After': result.resetIn.toString(),
        },
      }
    );
  }
  
  return null;
}

/**
 * Create a rate limiter with specific configuration
 * 
 * @param config - Rate limit configuration
 * @returns Rate limit middleware function
 * 
 * @example
 * const apiRateLimiter = createRateLimiter({
 *   maxRequests: 50,
 *   windowMs: 60000,
 *   identifier: 'api',
 * });
 * 
 * export async function GET(request: NextRequest) {
 *   const rateLimitResponse = await apiRateLimiter(request);
 *   if (rateLimitResponse) return rateLimitResponse;
 *   // ...
 * }
 */
export function createRateLimiter(
  config: Partial<RateLimitConfig>
): (request: NextRequest) => Promise<NextResponse | null> {
  return (request: NextRequest) => rateLimit(request, config);
}

/**
 * Pre-configured rate limiters for common use cases
 */
export const rateLimiters = {
  /** Standard API rate limiter */
  standard: createRateLimiter(RATE_LIMIT_TIERS.standard),
  
  /** Strict rate limiter for sensitive endpoints */
  strict: createRateLimiter(RATE_LIMIT_TIERS.strict),
  
  /** Relaxed rate limiter for read-only endpoints */
  relaxed: createRateLimiter(RATE_LIMIT_TIERS.relaxed),
  
  /** Auth rate limiter */
  auth: createRateLimiter(RATE_LIMIT_TIERS.auth),
  
  /** AI/Chat rate limiter */
  ai: createRateLimiter(RATE_LIMIT_TIERS.ai),
};

/**
 * Get rate limit statistics for monitoring
 * 
 * @returns Current rate limit store statistics
 */
export function getRateLimitStats(): {
  totalEntries: number;
  keys: string[];
} {
  return {
    totalEntries: rateLimitStore.size,
    keys: Array.from(rateLimitStore.keys()),
  };
}

/**
 * Clear rate limit for a specific key (useful for testing or admin actions)
 * 
 * @param key - Rate limit key to clear
 */
export function clearRateLimit(key: string): void {
  rateLimitStore.delete(key);
}

/**
 * Clear all rate limits (use with caution)
 */
export function clearAllRateLimits(): void {
  rateLimitStore.clear();
}
