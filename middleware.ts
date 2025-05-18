import { NextResponse, type NextRequest } from 'next/server';

// Simple in-memory rate limiting store
// Note: This will be reset on server restart, and won't work across multiple instances
// For production, consider using a more robust solution like Redis or a rate-limiting service
const ipRequests: Record<string, { count: number; lastReset: number }> = {};
const API_RATE_LIMIT = 60; // 60 requests per minute
const RATE_LIMIT_WINDOW = 60 * 1000; // 1 minute in milliseconds

// API routes that are exempt from rate limiting (essential data fetching routes)
const EXEMPT_ROUTES = [
  '/api/player-counts',
  '/api/server-list',
  '/api/streamer-counts',
  '/api/viewer-counts'
];

export default function middleware(request: NextRequest) {
  const response = NextResponse.next();

  // Add security headers to all responses
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('X-XSS-Protection', '1; mode=block');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');

  // Only apply rate limiting to API routes that aren't exempted
  if (request.nextUrl.pathname.startsWith('/api/')) {
    // Check if the route is exempt from rate limiting
    const isExemptRoute = EXEMPT_ROUTES.some(route => 
      request.nextUrl.pathname.startsWith(route)
    );
    
    // Skip rate limiting for essential data fetching routes
    if (!isExemptRoute) {
      // Get client IP from headers (the standard way in Next.js middleware)
      let ip = request.headers.get('x-forwarded-for') || 
               request.headers.get('x-real-ip') || 
               'unknown';
      
      // If IP is a comma-separated list (from proxies), take the first one
      if (ip && ip.includes(',')) {
        ip = ip.split(',')[0].trim();
      }
      
      // Initialize or get rate limit data for this IP
      const now = Date.now();
      if (!ipRequests[ip] || now - ipRequests[ip].lastReset > RATE_LIMIT_WINDOW) {
        ipRequests[ip] = { count: 1, lastReset: now };
      } else {
        ipRequests[ip].count++;
      }
      
      // Add rate limit headers
      response.headers.set('X-RateLimit-Limit', API_RATE_LIMIT.toString());
      response.headers.set('X-RateLimit-Remaining', 
        Math.max(0, API_RATE_LIMIT - ipRequests[ip].count).toString()
      );
      response.headers.set('X-RateLimit-Reset', 
        new Date(ipRequests[ip].lastReset + RATE_LIMIT_WINDOW).toISOString()
      );
      
      // If rate limit exceeded
      if (ipRequests[ip].count > API_RATE_LIMIT) {
        return new NextResponse(
          JSON.stringify({ 
            error: 'Too many requests', 
            message: 'API rate limit exceeded. Please try again later.' 
          }),
          { 
            status: 429, 
            headers: {
              'Content-Type': 'application/json',
              'Retry-After': '60',
              'X-RateLimit-Limit': API_RATE_LIMIT.toString(),
              'X-RateLimit-Remaining': '0',
              'X-RateLimit-Reset': new Date(ipRequests[ip].lastReset + RATE_LIMIT_WINDOW).toISOString()
            }
          }
        );
      }
    }
  }

  return response;
}

// Configure which paths should trigger this middleware
export const config = {
  matcher: [
    // Apply to all API routes
    '/api/:path*',
    // Apply to all routes (for security headers)
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
}; 