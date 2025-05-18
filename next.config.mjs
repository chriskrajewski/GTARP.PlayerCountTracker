/** @type {import('next').NextConfig} */
const nextConfig = {
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
            value: "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdn.jsdelivr.net https://www.googletagmanager.com https://cdn.7tv.app https://www.google-analytics.com https://cdn.jsdelivr.net https://statsig.com https://cdn.statsig.com; style-src 'self' 'unsafe-inline'; img-src 'self' data: https://cdn.7tv.app https://*.fivem.net https://*.cfx.re https://static-cdn.jtvnw.net https://*.twimg.com https://*.twitch.tv https://i.ytimg.com https://jst.cdn.scaleengine.net; font-src 'self' data:; connect-src 'self' https://servers-live.fivem.net https://*.supabase.co https://api.github.com https://www.google-analytics.com https://*.statsig.com https://*.twitch.tv https://api.twitch.tv https://prodregistryv2.org https://featureassets.org; frame-ancestors 'none';"
          }
        ]
      }
    ]
  }
}

export default nextConfig
