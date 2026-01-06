import { withBotId } from 'botid/next/config'

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
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
      },
      {
        protocol: 'https',
        hostname: 'static-cdn.jtvnw.net/previews-ttv',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'cdn.nightdev.com',
        pathname: '/**',
      },  
      {
        protocol: 'https',
        hostname: 'images.kick.com',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'clips-media-assets2.twitch.tv',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'clips-media-assets.twitch.tv',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'files.kick.com',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'clips.kick.com',
        pathname: '/**',
      }
    ],
  },
  poweredByHeader: false,
  async headers() {
    return [
      // PWA and icon caching headers - Critical for iOS PWA icon display
      {
        source: '/apple-touch-icon.png',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable'
          },
          {
            key: 'Content-Type',
            value: 'image/png'
          }
        ]
      },
      {
        source: '/apple-touch-icon-precomposed.png',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable'
          },
          {
            key: 'Content-Type',
            value: 'image/png'
          }
        ]
      },
      {
        source: '/icons/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable'
          },
          {
            key: 'Content-Type',
            value: 'image/png'
          }
        ]
      },
      {
        source: '/manifest.json',
        headers: [
          {
            key: 'Content-Type',
            value: 'application/manifest+json'
          },
          {
            key: 'Cache-Control',
            value: 'public, max-age=3600'
          }
        ]
      },
      {
        source: '/sw.js',
        headers: [
          {
            key: 'Content-Type',
            value: 'application/javascript'
          },
          {
            key: 'Cache-Control',
            value: 'public, max-age=0, must-revalidate'
          }
        ]
      },
      // Default security headers for all routes
      {
        source: '/:path*',
        headers: [
          {
            key: 'X-DNS-Prefetch-Control',
            value: 'on'
          },
          {
            key: 'X-XSS-Protection',
            value: '1; mode=block'
          },
          {
            key: 'X-Frame-Options',
            value: 'SAMEORIGIN'
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff'
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin'
          },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=(), interest-cohort=()'
          },
          {
            key: 'Content-Security-Policy',
            value: "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdn.jsdelivr.net https://www.googletagmanager.com https://cdn.7tv.app https://www.google-analytics.com https://cdn.jsdelivr.net https://statsig.com https://cdn.statsig.com https://*.twitch.tv https://embed.twitch.tv https://player.twitch.tv https://*.nightdev.com https://nightdev.com https://snippet.meticulous.ai https://va.vercel-scripts.com/ https://*.amazonaws.com https://*.s3-accelerate.amazonaws.com https://vercel.com; style-src 'self' 'unsafe-inline' https://*.nightdev.com https://nightdev.com; img-src 'self' data: https://cdn.7tv.app https://*.fivem.net https://*.cfx.re https://static-cdn.jtvnw.net https://*.twimg.com https://*.twitch.tv https://i.ytimg.com https://jst.cdn.scaleengine.net https://*.nightdev.com https://nightdev.com https://images.kick.com https://files.kick.com https://clips.kick.com https://*.vercel.app https://vercel.live https://clips-media-assets2.twitch.tv https://clips-media-assets.twitch.tv; font-src 'self' data:; connect-src 'self' https://cognito-identity.us-west-2.amazonaws.com/ https://servers-live.fivem.net https://*.supabase.co https://api.github.com https://www.google-analytics.com https://*.statsig.com https://*.twitch.tv https://api.twitch.tv https://prodregistryv2.org https://featureassets.org https://*.nightdev.com https://nightdev.com https://*.amazonaws.com https://vercel.com https://static-cdn.jtvnw.net https://clips-media-assets2.twitch.tv https://clips-media-assets.twitch.tv https://images.kick.com https://files.kick.com https://clips.kick.com; frame-src 'self' https://*.twitch.tv https://player.twitch.tv https://embed.twitch.tv https://clips.twitch.tv https://*.nightdev.com https://nightdev.com https://player.kick.com https://*.kick.com; media-src 'self' blob: https://*.twitch.tv https://player.twitch.tv https://*.nightdev.com https://nightdev.com https://player.kick.com https://*.kick.com https://clips.kick.com; frame-ancestors 'none';"
          }
        ]
      }
    ]
  }
}

/**
 * Conditionally apply BotID wrapper
 * BotID is a Vercel-specific feature and should only be applied on Vercel deployments
 */
const isVercel = process.env.VERCEL === '1';
export default isVercel ? withBotId(nextConfig) : nextConfig
