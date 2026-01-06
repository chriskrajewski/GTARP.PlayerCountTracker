import { NextRequest, NextResponse } from 'next/server'

/**
 * Middleware for BotID verification
 * 
 * This middleware can be used to protect specific routes globally.
 * It gracefully handles both Vercel and non-Vercel environments.
 * On non-Vercel platforms (like Azure), BotID headers won't be present and are skipped.
 * 
 * @see https://vercel.com/docs/botid/get-started
 */

// Routes that require BotID verification
const PROTECTED_ROUTES = [
  '/api/feedback',
  '/api/admin',
]

// Routes that should be excluded from BotID checks
const EXCLUDED_ROUTES = [
  '/api/status',
  '/api/health',
  '/_next',
  '/public',
]

export function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname

  // Skip excluded routes
  if (EXCLUDED_ROUTES.some(route => pathname.startsWith(route))) {
    return NextResponse.next()
  }

  // Check if route requires BotID verification
  const isProtectedRoute = PROTECTED_ROUTES.some(route => 
    pathname.startsWith(route)
  )

  if (isProtectedRoute) {
    // Get BotID headers (only available on Vercel)
    const botidHeader = request.headers.get('x-vercel-botid')
    const botidScore = request.headers.get('x-vercel-botid-score')
    
    // Check if we're running on Vercel
    const isVercel = botidHeader !== null || process.env.VERCEL === '1'

    // Log verification attempt
    console.debug('[BotID Middleware]', {
      pathname,
      hasBotIDHeader: !!botidHeader,
      botidScore: botidScore ? parseFloat(botidScore) : null,
      isVercel,
      timestamp: new Date().toISOString(),
    })

    // Note: Actual bot detection is handled in route handlers
    // This middleware just logs the verification attempt
    // On non-Vercel platforms, BotID headers simply won't exist and are skipped
  }

  return NextResponse.next()
}

// Configure which routes to run middleware on
export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
}
