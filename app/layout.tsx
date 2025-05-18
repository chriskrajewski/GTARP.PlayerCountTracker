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
    <html lang="en" className="dark !bg-black" style={{ 
      colorScheme: 'dark', 
      backgroundColor: '#000000',
      color: '#FFFFFF'
    }}>
      <head>
        {/* Force dark mode */}
        <meta name="color-scheme" content="dark" />
        <meta name="theme-color" content="#000000" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
        <style dangerouslySetInnerHTML={{ __html: `
          body {
            background-color: #000000 !important;
            color: #FFFFFF !important;
          }
          .dark {
            color-scheme: dark !important;
          }
        `}} />
        <script src="https://cdn.jsdelivr.net/npm/@statsig/js-client@3/build/statsig-js-client+session-replay+web-analytics.min.js?apikey=client-Nu49JS6kPL97gZnvHVQZF64xQpf7aCGgRMdLm3wrEt5">
        </script>
        <Script src="https://www.googletagmanager.com/gtag/js?id=G-546BM3B67W" strategy="afterInteractive">
        {`
          window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments)}
          gtag('js', new Date());
          gtag('config', 'G-546BM3B67W');
        `}
      </Script>
      </head>
      <body className={`${inter.className} !bg-black !text-white`} style={{ 
        backgroundColor: '#000000', 
        color: '#FFFFFF',
        margin: 0,
        padding: 0
      }}>
        <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false} forcedTheme="dark" disableTransitionOnChange>
          <StatsigProvider>
            <Suspense>
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
