import type React from "react"
import "./globals.css"
import type { Metadata } from "next"
import { Inter } from "next/font/google"
import { ThemeProvider } from "@/components/theme-provider"
import { Analytics } from "@vercel/analytics/react"
import { Suspense } from "react"
import { SpeedInsights } from "@vercel/speed-insights/react"
import Script from "next/script";
import StatsigProvider from "@/components/statsig-provider";
import GoogleAnalytics from "@/components/google-analytics";
import { ServiceWorkerProvider } from "@/components/service-worker-provider";
import mixpanel from "mixpanel-browser";

// Create an instance of the Mixpanel object, your token is already added to this snippet
      mixpanel.init('13440c630224bb2155944bc8de971af7', {
      autocapture: true,
      record_sessions_percent: 100,
    })

const inter = Inter({ subsets: ["latin"] })

export const metadata: Metadata = {
  title: "FiveM Player Count Tracker",
  description: "Data refreshes every 5 minutes"
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
      
        {/* Force dark mode */}
        <meta name="color-scheme" content="dark" />
        <meta name="theme-color" content="#06070b" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
        <style dangerouslySetInnerHTML={{ __html: `
          body {
            background: radial-gradient(circle at 20% 20%, #141623 0%, #06070b 45%, #010103 100%) !important;
            background-attachment: fixed;
            color: #FFFFFF !important;
          }
          .dark {
            color-scheme: dark !important;
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
          <StatsigProvider>
            <Suspense>
              <GoogleAnalytics />
              <ServiceWorkerProvider />
              {children}
              <Analytics />
              <SpeedInsights />
            </Suspense>
          </StatsigProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}
