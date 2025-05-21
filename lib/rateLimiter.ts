import { NextRequest, NextResponse } from 'next/server';
import { RATE_LIMIT } from './grok';

// Simple in-memory store for rate limiting
// In a production environment, you might want to use Redis or another distributed cache
interface RateLimitStore {
  [ip: string]: {
    count: number;
    resetTime: number;
  };
}

// In-memory store (this will reset when the function cold starts)
const store: RateLimitStore = {};

export async function rateLimiter(req: NextRequest) {
  // Get IP from request
  const ip = req.headers.get('x-forwarded-for') || 'unknown';
  const now = Date.now();

  // Cleanup expired entries on each request
  Object.keys(store).forEach((storeIp) => {
    if (store[storeIp].resetTime <= now) {
      delete store[storeIp];
    }
  });

  // Initialize or get existing rate limit data for this IP
  if (!store[ip] || store[ip].resetTime <= now) {
    store[ip] = {
      count: 1,
      resetTime: now + RATE_LIMIT.windowMs,
    };
    return null; // Allow the request
  }

  // Increment count for existing IP
  store[ip].count++;

  // Check if rate limit exceeded
  if (store[ip].count > RATE_LIMIT.maxRequests) {
    // Return rate limit exceeded response
    return NextResponse.json(
      {
        error: 'Rate limit exceeded. Please try again later.',
        retryAfter: Math.ceil((store[ip].resetTime - now) / 1000),
      },
      {
        status: 429,
        headers: {
          'Retry-After': Math.ceil((store[ip].resetTime - now) / 1000).toString(),
        },
      }
    );
  }

  return null; // Allow the request
} 