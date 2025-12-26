import { withBotId } from 'botid/next/config'

/**
 * Content Security Policy Configuration
 * 
 * This CSP is designed to be secure while allowing necessary third-party integrations.
 * 
 * Security Notes:
 * - 'unsafe-inline' is required for style-src due to CSS-in-JS libraries (Tailwind, styled-components)
 * - 'unsafe-eval' is required for script-src due to Next.js development mode and some libraries
 * - In production, consider implementing nonce-based CSP for scripts
 * - frame-ancestors is set to 'none' to prevent clickjacking
 * 
 * @see https://developer.mozilla.org/en-US/docs/Web/HTTP/CSP
 */
const ContentSecurityPolicy = `
  default-src 'self';
  script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdn.jsdelivr.net https://www.googletagmanager.com https://www.google-analytics.com https://statsig.com https://cdn.statsig.com https://*.twitch.tv https://embed.twitch.tv https://player.twitch.tv https://*.nightdev.com https://nightdev.com https://snippet.meticulous.ai https://va.vercel-scripts.com https://*.amazonaws.com https://*.s3-accelerate.amazonaws.com https://vercel.com;
  style-src 'self' 'unsafe-inline' https://*.nightdev.com https://nightdev.com;
  img-src 'self' data: blob: https://cdn.7tv.app https://*.fivem.net https://*.cfx.re https://static-cdn.jtvnw.net https://*.twimg.com https://*.twitch.tv https://i.ytimg.com https://jst.cdn.scaleengine.net https://*.nightdev.com https://nightdev.com;
  font-src 'self' data:;
  connect-src 'self' https://cognito-identity.us-west-2.amazonaws.com https://servers-live.fivem.net https://*.supabase.co https://api.github.com https://www.google-analytics.com https://*.statsig.com https://*.twitch.tv https://api.twitch.tv https://prodregistryv2.org https://featureassets.org https://*.nightdev.com https://nightdev.com https://*.amazonaws.com https://vercel.com;
  frame-src 'self' https://*.twitch.tv https://player.twitch.tv https://embed.twitch.tv https://*.nightdev.com https://nightdev.com;
  media-src 'self' https://*.twitch.tv https://player.twitch.tv https://*.nightdev.com https://nightdev.com;
  object-src 'none';
  base-uri 'self';
  form-action 'self';
  frame-ancestors 'none';
  upgrade-insecure-requests;
`.replace(/\n/g, ' ').replace(/\s+/g, ' ').trim();

/**
 * Allowed origins for CORS
 * Add your production and staging domains here
 */
const ALLOWED_ORIGINS = [
  'https://gtarp.chriskrajewski.com',
  'https://gtarp-player-count-tracker.vercel.app',
  process.env.NODE_ENV === 'development' ? 'http://localhost:3000' : null,
  process.env.NODE_ENV === 'development' ? 'http://localhost:3001' : null,
].filter(Boolean);

/** @type {import('next').NextConfig} */
const nextConfig = {
  /**
   * Enable gzip compression for all responses
   * This significantly reduces response sizes for JSON API responses
   */
  compress: true,
  
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: false,
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'cdn.7tv.app',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'static-cdn.jtvnw.net',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'i.ytimg.com',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: '*.twimg.com',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'jst.cdn.scaleengine.net',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'cdn.discordapp.com',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'www.datocms-assets.com',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'media.discordapp.net',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'featureassets.org',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'featureassets.org/v1',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'mixpanel.com',
        pathname: '/**',
      }
    ],
  },
  poweredByHeader: false,
  async headers() {
    return [
      {
        // Apply security headers to all routes
        source: '/:path*',
        headers: [
          // DNS Prefetch Control - Enable DNS prefetching for performance
          {
            key: 'X-DNS-Prefetch-Control',
            value: 'on'
          },
          // XSS Protection - Enable browser's XSS filter
          {
            key: 'X-XSS-Protection',
            value: '1; mode=block'
          },
          // Frame Options - Prevent clickjacking (same origin allowed)
          {
            key: 'X-Frame-Options',
            value: 'SAMEORIGIN'
          },
          // Content Type Options - Prevent MIME type sniffing
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff'
          },
          // Referrer Policy - Control referrer information
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin'
          },
          // Permissions Policy - Restrict browser features
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=(), interest-cohort=()'
          },
          // Strict Transport Security - Force HTTPS
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=31536000; includeSubDomains; preload'
          },
          // Content Security Policy
          {
            key: 'Content-Security-Policy',
            value: ContentSecurityPolicy
          }
        ]
      },
      {
        // CORS headers for API routes
        source: '/api/:path*',
        headers: [
          {
            key: 'Access-Control-Allow-Credentials',
            value: 'true'
          },
          {
            key: 'Access-Control-Allow-Methods',
            value: 'GET, POST, PUT, DELETE, OPTIONS'
          },
          {
            key: 'Access-Control-Allow-Headers',
            value: 'Content-Type, Authorization, X-Requested-With, Accept, Origin, X-CSRF-Token'
          },
          {
            key: 'Access-Control-Expose-Headers',
            value: 'X-RateLimit-Limit, X-RateLimit-Remaining, X-RateLimit-Reset, X-Request-Id, ETag'
          },
          {
            key: 'Access-Control-Max-Age',
            value: '86400'
          },
          // Cache control for API responses
          {
            key: 'Cache-Control',
            value: 'no-store, no-cache, must-revalidate, proxy-revalidate'
          },
          {
            key: 'Vary',
            value: 'Accept-Encoding, Origin'
          }
        ]
      },
      {
        // Cache static assets aggressively
        source: '/static/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable'
          }
        ]
      },
      {
        // Cache images
        source: '/_next/image/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=86400, stale-while-revalidate=604800'
          }
        ]
      }
    ]
  }
}

export default withBotId(nextConfig)
