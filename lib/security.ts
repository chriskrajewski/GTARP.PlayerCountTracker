/**
 * Security Utilities Module
 * 
 * Provides comprehensive security utilities including:
 * - Content Security Policy (CSP) generation with nonce support
 * - CORS configuration and validation
 * - Security headers management
 * - Input sanitization
 * 
 * @module lib/security
 */

import { NextRequest, NextResponse } from 'next/server';
import { createHash, randomBytes } from 'crypto';

/**
 * CSP Directive configuration
 */
export interface CSPDirectives {
  'default-src'?: string[];
  'script-src'?: string[];
  'style-src'?: string[];
  'img-src'?: string[];
  'font-src'?: string[];
  'connect-src'?: string[];
  'frame-src'?: string[];
  'media-src'?: string[];
  'object-src'?: string[];
  'base-uri'?: string[];
  'form-action'?: string[];
  'frame-ancestors'?: string[];
  'upgrade-insecure-requests'?: boolean;
  'block-all-mixed-content'?: boolean;
}

/**
 * CORS configuration
 */
export interface CORSConfig {
  /** Allowed origins (use '*' for all, or specific origins) */
  allowedOrigins: string[];
  /** Allowed HTTP methods */
  allowedMethods: string[];
  /** Allowed headers */
  allowedHeaders: string[];
  /** Headers to expose to the client */
  exposedHeaders: string[];
  /** Allow credentials (cookies, auth headers) */
  allowCredentials: boolean;
  /** Preflight cache duration in seconds */
  maxAge: number;
}

/**
 * Default CSP directives for the application
 * 
 * Note: We're keeping 'unsafe-inline' for styles due to CSS-in-JS libraries
 * but removing 'unsafe-eval' where possible. For scripts, we use nonces.
 */
export const DEFAULT_CSP_DIRECTIVES: CSPDirectives = {
  'default-src': ["'self'"],
  'script-src': [
    "'self'",
    // Third-party scripts that are required
    'https://cdn.jsdelivr.net',
    'https://www.googletagmanager.com',
    'https://www.google-analytics.com',
    'https://statsig.com',
    'https://cdn.statsig.com',
    'https://*.twitch.tv',
    'https://embed.twitch.tv',
    'https://player.twitch.tv',
    'https://*.nightdev.com',
    'https://nightdev.com',
    'https://snippet.meticulous.ai',
    'https://va.vercel-scripts.com',
    'https://*.amazonaws.com',
    'https://*.s3-accelerate.amazonaws.com',
    'https://vercel.com',
  ],
  'style-src': [
    "'self'",
    "'unsafe-inline'", // Required for CSS-in-JS and Tailwind
    'https://*.nightdev.com',
    'https://nightdev.com',
  ],
  'img-src': [
    "'self'",
    'data:',
    'blob:',
    'https://cdn.7tv.app',
    'https://*.fivem.net',
    'https://*.cfx.re',
    'https://static-cdn.jtvnw.net',
    'https://*.twimg.com',
    'https://*.twitch.tv',
    'https://i.ytimg.com',
    'https://jst.cdn.scaleengine.net',
    'https://*.nightdev.com',
    'https://nightdev.com',
  ],
  'font-src': ["'self'", 'data:'],
  'connect-src': [
    "'self'",
    'https://cognito-identity.us-west-2.amazonaws.com',
    'https://servers-live.fivem.net',
    'https://*.supabase.co',
    'https://api.github.com',
    'https://www.google-analytics.com',
    'https://*.statsig.com',
    'https://*.twitch.tv',
    'https://api.twitch.tv',
    'https://prodregistryv2.org',
    'https://featureassets.org',
    'https://*.nightdev.com',
    'https://nightdev.com',
    'https://*.amazonaws.com',
    'https://vercel.com',
  ],
  'frame-src': [
    "'self'",
    'https://*.twitch.tv',
    'https://player.twitch.tv',
    'https://embed.twitch.tv',
    'https://*.nightdev.com',
    'https://nightdev.com',
  ],
  'media-src': [
    "'self'",
    'https://*.twitch.tv',
    'https://player.twitch.tv',
    'https://*.nightdev.com',
    'https://nightdev.com',
  ],
  'object-src': ["'none'"],
  'base-uri': ["'self'"],
  'form-action': ["'self'"],
  'frame-ancestors': ["'none'"],
  'upgrade-insecure-requests': true,
};

/**
 * Default CORS configuration
 */
export const DEFAULT_CORS_CONFIG: CORSConfig = {
  allowedOrigins: [
    // Production domains
    'https://gtarp.chriskrajewski.com',
    'https://gtarp-player-count-tracker.vercel.app',
    // Development
    'http://localhost:3000',
    'http://localhost:3001',
  ],
  allowedMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: [
    'Content-Type',
    'Authorization',
    'X-Requested-With',
    'Accept',
    'Origin',
    'X-CSRF-Token',
  ],
  exposedHeaders: [
    'X-RateLimit-Limit',
    'X-RateLimit-Remaining',
    'X-RateLimit-Reset',
    'X-Request-Id',
    'ETag',
  ],
  allowCredentials: true,
  maxAge: 86400, // 24 hours
};

/**
 * Generate a cryptographically secure nonce for CSP
 * 
 * @returns Base64-encoded nonce string
 */
export function generateNonce(): string {
  return randomBytes(16).toString('base64');
}

/**
 * Build CSP header string from directives
 * 
 * @param directives - CSP directives object
 * @param nonce - Optional nonce for script-src
 * @returns CSP header string
 */
export function buildCSPHeader(
  directives: CSPDirectives = DEFAULT_CSP_DIRECTIVES,
  nonce?: string
): string {
  const parts: string[] = [];
  
  for (const [directive, value] of Object.entries(directives)) {
    if (value === true) {
      // Boolean directives like upgrade-insecure-requests
      parts.push(directive);
    } else if (Array.isArray(value) && value.length > 0) {
      let sources = [...value];
      
      // Add nonce to script-src if provided
      if (directive === 'script-src' && nonce) {
        sources.push(`'nonce-${nonce}'`);
      }
      
      parts.push(`${directive} ${sources.join(' ')}`);
    }
  }
  
  return parts.join('; ');
}

/**
 * Check if an origin is allowed by CORS configuration
 * 
 * @param origin - Request origin
 * @param config - CORS configuration
 * @returns true if origin is allowed
 */
export function isOriginAllowed(origin: string, config: CORSConfig = DEFAULT_CORS_CONFIG): boolean {
  if (config.allowedOrigins.includes('*')) {
    return true;
  }
  
  return config.allowedOrigins.some(allowed => {
    // Support wildcard subdomains
    if (allowed.startsWith('*.')) {
      const domain = allowed.slice(2);
      return origin.endsWith(domain) || origin === `https://${domain}` || origin === `http://${domain}`;
    }
    return origin === allowed;
  });
}

/**
 * Add CORS headers to a response
 * 
 * @param response - NextResponse object
 * @param request - Original request (for origin check)
 * @param config - CORS configuration
 * @returns Response with CORS headers
 */
export function addCORSHeaders(
  response: NextResponse,
  request: NextRequest,
  config: CORSConfig = DEFAULT_CORS_CONFIG
): NextResponse {
  const origin = request.headers.get('origin');
  
  // Only add CORS headers if origin is present and allowed
  if (origin && isOriginAllowed(origin, config)) {
    response.headers.set('Access-Control-Allow-Origin', origin);
    response.headers.set('Access-Control-Allow-Methods', config.allowedMethods.join(', '));
    response.headers.set('Access-Control-Allow-Headers', config.allowedHeaders.join(', '));
    response.headers.set('Access-Control-Expose-Headers', config.exposedHeaders.join(', '));
    response.headers.set('Access-Control-Max-Age', config.maxAge.toString());
    
    if (config.allowCredentials) {
      response.headers.set('Access-Control-Allow-Credentials', 'true');
    }
  }
  
  return response;
}

/**
 * Handle CORS preflight request
 * 
 * @param request - Preflight request
 * @param config - CORS configuration
 * @returns Preflight response or null if not a preflight
 */
export function handleCORSPreflight(
  request: NextRequest,
  config: CORSConfig = DEFAULT_CORS_CONFIG
): NextResponse | null {
  if (request.method !== 'OPTIONS') {
    return null;
  }
  
  const origin = request.headers.get('origin');
  
  if (!origin || !isOriginAllowed(origin, config)) {
    return new NextResponse(null, { status: 403 });
  }
  
  return new NextResponse(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': origin,
      'Access-Control-Allow-Methods': config.allowedMethods.join(', '),
      'Access-Control-Allow-Headers': config.allowedHeaders.join(', '),
      'Access-Control-Max-Age': config.maxAge.toString(),
      'Access-Control-Allow-Credentials': config.allowCredentials ? 'true' : 'false',
    },
  });
}

/**
 * Standard security headers
 */
export const SECURITY_HEADERS: Record<string, string> = {
  'X-DNS-Prefetch-Control': 'on',
  'X-XSS-Protection': '1; mode=block',
  'X-Frame-Options': 'SAMEORIGIN',
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), interest-cohort=()',
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
};

/**
 * Add all security headers to a response
 * 
 * @param response - NextResponse object
 * @param options - Optional overrides
 * @returns Response with security headers
 */
export function addSecurityHeaders(
  response: NextResponse,
  options: { csp?: string; additionalHeaders?: Record<string, string> } = {}
): NextResponse {
  // Add standard security headers
  for (const [key, value] of Object.entries(SECURITY_HEADERS)) {
    response.headers.set(key, value);
  }
  
  // Add CSP if provided
  if (options.csp) {
    response.headers.set('Content-Security-Policy', options.csp);
  }
  
  // Add any additional headers
  if (options.additionalHeaders) {
    for (const [key, value] of Object.entries(options.additionalHeaders)) {
      response.headers.set(key, value);
    }
  }
  
  return response;
}

/**
 * Sanitize a string to prevent XSS
 * 
 * @param input - Input string to sanitize
 * @returns Sanitized string
 */
export function sanitizeString(input: string): string {
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;');
}

/**
 * Validate and sanitize URL
 * 
 * @param url - URL to validate
 * @param allowedProtocols - Allowed URL protocols
 * @returns Sanitized URL or null if invalid
 */
export function sanitizeUrl(
  url: string,
  allowedProtocols: string[] = ['http:', 'https:']
): string | null {
  try {
    const parsed = new URL(url);
    
    if (!allowedProtocols.includes(parsed.protocol)) {
      return null;
    }
    
    return parsed.toString();
  } catch {
    return null;
  }
}

/**
 * Generate a hash for integrity checking
 * 
 * @param content - Content to hash
 * @param algorithm - Hash algorithm (default: sha384)
 * @returns SRI hash string
 */
export function generateIntegrityHash(
  content: string,
  algorithm: 'sha256' | 'sha384' | 'sha512' = 'sha384'
): string {
  const hash = createHash(algorithm).update(content).digest('base64');
  return `${algorithm}-${hash}`;
}

/**
 * Check if request is from a trusted source
 * 
 * @param request - Next.js request object
 * @returns true if request is from trusted source
 */
export function isTrustedRequest(request: NextRequest): boolean {
  // Check for internal requests (from same origin)
  const origin = request.headers.get('origin');
  const host = request.headers.get('host');
  
  if (origin && host) {
    try {
      const originUrl = new URL(origin);
      if (originUrl.host === host) {
        return true;
      }
    } catch {
      // Invalid origin, not trusted
    }
  }
  
  // Check for server-to-server requests (no origin)
  if (!origin && request.headers.get('x-forwarded-for')) {
    // Could be a server-to-server request, check other indicators
    const userAgent = request.headers.get('user-agent') || '';
    
    // Common server-side user agents
    if (
      userAgent.includes('node-fetch') ||
      userAgent.includes('axios') ||
      userAgent.includes('got')
    ) {
      return true;
    }
  }
  
  return false;
}

/**
 * Validate request method
 * 
 * @param request - Next.js request object
 * @param allowedMethods - Allowed HTTP methods
 * @returns NextResponse with 405 if method not allowed, null otherwise
 */
export function validateRequestMethod(
  request: NextRequest,
  allowedMethods: string[]
): NextResponse | null {
  if (!allowedMethods.includes(request.method)) {
    return new NextResponse(null, {
      status: 405,
      headers: {
        'Allow': allowedMethods.join(', '),
      },
    });
  }
  
  return null;
}
