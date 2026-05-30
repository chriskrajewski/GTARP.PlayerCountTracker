import { NextRequest, NextResponse } from 'next/server'
import { getJoinRecommendation, type JoinRecommendationResult } from '@/lib/capacity-advisor'

/**
 * GET /api/capacity-advisor
 *
 * Returns the "best time to join" recommendation for a single server (R8.1–R8.6).
 *
 * The recommendation math runs server-side because it reuses the existing
 * data-access reads (`getPlayerCounts` / `getServerCapacities`, R9.3). The
 * returned window is in UTC hour-of-week coordinates; the client localizes it to
 * the viewer's time zone with `formatRecommendationLocal` (R8.4). When the
 * server's history is too sparse the recommendation is the explicit
 * `{ available: false }` "not yet available" state (R8.5) rather than a
 * fabricated window.
 *
 * Query Parameters:
 * - serverId: the target server identifier (required)
 *
 * Response:
 * {
 *   success: true,
 *   recommendation: JoinRecommendation | { available: false }
 * }
 *
 * This is a public, non-sensitive read (no auth) over already-collected
 * time-series data.
 */
export async function GET(request: NextRequest) {
  try {
    const serverId = request.nextUrl.searchParams.get('serverId')

    if (!serverId || !serverId.trim()) {
      return NextResponse.json(
        { success: false, error: 'serverId parameter is required' },
        { status: 400 }
      )
    }

    const recommendation: JoinRecommendationResult = await getJoinRecommendation(serverId.trim())

    return NextResponse.json(
      {
        success: true,
        recommendation,
      },
      {
        headers: {
          // No caching - the recommendation reflects the latest collected data.
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0',
        },
      }
    )
  } catch (error) {
    console.error('Error in capacity advisor API:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
