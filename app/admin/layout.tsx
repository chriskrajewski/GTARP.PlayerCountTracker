import type { Metadata, Viewport } from 'next'

export const metadata: Metadata = {
  title: 'Admin Dashboard - GTA RP Player Count Tracker',
  description: 'Administrative dashboard for managing GTA RP Player Count Tracker with real-time visitor tracking and server management',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'GTARP Admin',
  },
  formatDetection: {
    telephone: false,
  },
  icons: [
    {
      rel: 'icon',
      url: '/placeholder-logo.png',
      sizes: '192x192',
      type: 'image/png',
    },
    {
      rel: 'apple-touch-icon',
      url: '/placeholder-logo.png',
      sizes: '180x180',
      type: 'image/png',
    },
  ],
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
  viewportFit: 'cover',
  themeColor: '#06070b',
}

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}
