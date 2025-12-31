import type React from "react"
import "./globals.css"
import "../styles/ios-safe-area.css"
import type { Metadata, Viewport } from "next"
import { Inter } from "next/font/google"
import { ThemeProvider } from "@/components/theme-provider"
import { Analytics } from "@vercel/analytics/react"
import { Suspense } from "react"
import { SpeedInsights } from "@vercel/speed-insights/react"
import Script from "next/script";
import StatsigProvider from "@/components/statsig-provider";
import GoogleAnalytics from "@/components/google-analytics";
import { BotIDProvider } from "@/components/botid-provider"
import { VisitorTrackingProvider } from "@/components/visitor-tracking-provider"
import { PWAProvider } from "@/components/pwa-provider"
import mixpanel from "mixpanel-browser";

// Create an instance of the Mixpanel object, your token is already added to this snippet
      mixpanel.init('13440c630224bb2155944bc8de971af7', {
      autocapture: true,
      record_sessions_percent: 100,
    })

const inter = Inter({ subsets: ["latin"] })

// PWA and SEO Metadata
export const metadata: Metadata = {
  title: {
    default: "RPStats.com",
    template: "%s | RPStats.com"
  },
  description: "Discover, track, and watch GTA roleplay servers with real-time player counts, stream data, and server analytics. Your ultimate companion for GTA RP communities.",
  keywords: ["GTA RP", "FiveM", "player count", "roleplay", "tracker", "NoPixel", "GTARP", "streams", "Twitch"],
  authors: [{ name: "RPStats.com" }],
  creator: "RPStats.com",
  publisher: "RPStats.com",
  robots: {
    index: true,
    follow: true,
  },
  openGraph: {
    type: "website",
    locale: "en_US",
    url: "https://rpstats.com",
    siteName: "RPStats.com",
    title: "RPStats.com",
    description: "Discover, track, and watch GTA roleplay servers with real-time player counts and stream data.",
    images: [
      {
        url: "/icons/icon-512.png",
        width: 512,
        height: 512,
        alt: "RPStats.com Logo",
      },
    ],
  },
  twitter: {
    card: "summary",
    title: "RPStats.com",
    description: "Discover, track, and watch GTA roleplay servers with real-time player counts and stream data.",
    images: ["/icons/icon-512.png"],
  },
  manifest: "/manifest.json",
  icons: {
    icon: [
      { url: "/pepeRP.webp", sizes: "any", type: "image/webp" },
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [
      { url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
      { url: "/apple-touch-icon-precomposed.png", sizes: "180x180", type: "image/png" },
    ],
    shortcut: ["/pepeRP.webp"],
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "RPStats.com",
    startupImage: [
      {
        url: "/icons/icon-512.png",
        media: "(device-width: 320px) and (device-height: 568px) and (-webkit-device-pixel-ratio: 2)",
      },
    ],
  },
  formatDetection: {
    telephone: false,
  },
  other: {
    "mobile-web-app-capable": "yes",
  },
}

// Viewport configuration for PWA
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#06070b" },
    { media: "(prefers-color-scheme: light)", color: "#06070b" },
  ],
  colorScheme: "dark",
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}): React.JSX.Element {
  return (
    
    <html lang="en" className="dark" style={{ 
      colorScheme: 'dark', 
      color: '#FFFFFF'
    }}>

      
      <head>
      {(process.env.NODE_ENV === "development" || process.env.VERCEL_ENV === "preview") && (
       // eslint-disable-next-line @next/next/no-sync-scripts
       //Import Mixpanel SDK

      <script
      data-recording-token="PSW2hFNYWiRq1mWWr7bv4nKfgD9aY45suYTDZVLi"
      data-is-production-environment="false"
      src="https://snippet.meticulous.ai/v1/meticulous.js"
      />
      )}
      
        {/* PWA Support - Additional meta tags */}
        <meta name="application-name" content="GTARP Tracker" />
        <meta name="msapplication-TileColor" content="#06070b" />
        <meta name="msapplication-config" content="/browserconfig.xml" />
        
        {/* iOS PWA Icons - Explicit link tags required for iOS */}
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
        <link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png" />
        <link rel="apple-touch-icon-precomposed" href="/apple-touch-icon-precomposed.png" />
        
        {/* Force dark mode */}
        <meta name="color-scheme" content="dark" />
        
        <style dangerouslySetInnerHTML={{ __html: `
          html, body {
            margin: 0;
            padding: 0;
            width: 100%;
            height: 100%;
          }
          body {
            background: radial-gradient(circle at 10% 20%, rgba(0, 77, 97, 0.15) 0%, rgba(6, 7, 11, 0.98) 25%, #000000 50%),
                        radial-gradient(circle at 90% 80%, rgba(0, 217, 255, 0.08) 0%, rgba(1, 1, 3, 0.95) 30%, #000000 60%),
                        linear-gradient(135deg, #000000 0%, #06070b 50%, #010103 100%) !important;
            background-attachment: fixed;
            color: #FFFFFF !important;
            /* iOS Safe Area - sides and bottom only, header handles top */
            padding-left: env(safe-area-inset-left, 0px);
            padding-right: env(safe-area-inset-right, 0px);
            padding-bottom: env(safe-area-inset-bottom, 0px);
          }
          .dark {
            color-scheme: dark !important;
          }
          /* Prevent zoom on input focus for iOS */
          input, select, textarea {
            font-size: 16px !important;
          }
        `}} />
        <script src="https://cdn.jsdelivr.net/npm/@statsig/js-client@3/build/statsig-js-client+session-replay+web-analytics.min.js?apikey=client-Nu49JS6kPL97gZnvHVQZF64xQpf7aCGgRMdLm3wrEt5">
        </script>
        {(process.env.NODE_ENV === 'production' || process.env.NODE_ENV === 'development') && process.env.NEXT_PUBLIC_GA_TRACKING_ID && (
          <>
            <Script src={`https://www.googletagmanager.com/gtag/js?id=${process.env.NEXT_PUBLIC_GA_TRACKING_ID}`} strategy="afterInteractive" />
            <Script id="google-analytics" strategy="afterInteractive">
              {`
                window.dataLayer = window.dataLayer || [];
                function gtag(){dataLayer.push(arguments);}
                gtag('js', new Date());
                gtag('config', '${process.env.NEXT_PUBLIC_GA_TRACKING_ID}', {
                  page_title: document.title,
                  page_location: window.location.href,
                  send_page_view: true,
                  anonymize_ip: true,
                  allow_google_signals: true,
                  allow_ad_personalization_signals: false,
                  custom_map: {
                    'dimension1': 'server_id',
                    'dimension2': 'time_range'
                  }
                });
                
                // Debug logging
                console.log('Google Analytics loaded for tracking ID: ${process.env.NEXT_PUBLIC_GA_TRACKING_ID}');
                window.gtag = gtag;
                
                // Track initial page load
                gtag('event', 'page_view', {
                  page_title: document.title,
                  page_location: window.location.href,
                  page_path: window.location.pathname
                });
              `}
            </Script>
          </>
        )}
      </head>
      <body className={`${inter.className} text-white`} style={{ 
        margin: 0,
        padding: 0
      }}>
        <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false} forcedTheme="dark" disableTransitionOnChange>
          <PWAProvider>
            <StatsigProvider>
              <Suspense>
                <BotIDProvider />
                <GoogleAnalytics />
                <VisitorTrackingProvider />
                {children}
                <Analytics />
                <SpeedInsights />
              </Suspense>
            </StatsigProvider>
          </PWAProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}
