import { NextRequest, NextResponse } from 'next/server'

/**
 * Middleware for BotID verification
 * 
 * This middleware can be used to protect specific routes globally.
 * Currently configured to allow all requests through, but can be extended
 * to verify BotID headers for sensitive endpoints.
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
    // Get BotID headers
    const botidHeader = request.headers.get('x-vercel-botid')
    const botidScore = request.headers.get('x-vercel-botid-score')

    // Log verification attempt
    console.debug('[BotID Middleware]', {
      pathname,
      hasBotIDHeader: !!botidHeader,
      botidScore: botidScore ? parseFloat(botidScore) : null,
      timestamp: new Date().toISOString(),
    })

    // Note: Actual bot detection is handled in route handlers
    // This middleware just logs the verification attempt
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
