/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: false,
  },
  images: {
    unoptimized: false,
    remotePatterns: [
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
            value: "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdn.jsdelivr.net https://www.googletagmanager.com https://cdn.7tv.app https://www.google-analytics.com https://cdn.jsdelivr.net https://statsig.com https://cdn.statsig.com https://*.twitch.tv https://embed.twitch.tv https://player.twitch.tv https://*.nightdev.com https://nightdev.com https://snippet.meticulous.ai https://va.vercel-scripts.com/ https://*.amazonaws.com https://*.s3-accelerate.amazonaws.com; style-src 'self' 'unsafe-inline' https://*.nightdev.com https://nightdev.com; img-src 'self' data: https://cdn.7tv.app https://*.fivem.net https://*.cfx.re https://static-cdn.jtvnw.net https://*.twimg.com https://*.twitch.tv https://i.ytimg.com https://jst.cdn.scaleengine.net https://*.nightdev.com https://nightdev.com; font-src 'self' data:; connect-src 'self' https://cognito-identity.us-west-2.amazonaws.com/ https://servers-live.fivem.net https://*.supabase.co https://api.github.com https://www.google-analytics.com https://*.statsig.com https://*.twitch.tv https://api.twitch.tv https://prodregistryv2.org https://featureassets.org https://*.nightdev.com https://nightdev.com https://*.amazonaws.com; frame-src 'self' https://*.twitch.tv https://player.twitch.tv https://embed.twitch.tv https://*.nightdev.com https://nightdev.com; media-src 'self' https://*.twitch.tv https://player.twitch.tv https://*.nightdev.com https://nightdev.com; frame-ancestors 'none';"
          }
        ]
      }
    ]
  }
}

export default nextConfig
