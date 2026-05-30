import { NextRequest, NextResponse } from 'next/server'
import { getAnomaliesForServer, type AnomalyRecord } from '@/lib/anomaly'
import { isFeatureFlagEnabled } from '@/lib/feature-flags-server'
import { FEATURE_FLAGS } from '@/lib/feature-flags'

/**
 * GET /api/anomalies
 *
 * Returns recorded anomalies for a single server so they can be surfaced on the
 * server's public-facing surfaces (R7.5).
 *
 * The read math runs server-side through `lib/anomaly.ts` (`getAnomaliesForServer`,
 * R9.3) rather than querying the `anomaly_records` table directly. Only ACTIVE
 * anomalies are returned (`activeOnly: true`) so the public surface shows
 * currently-relevant events, most recent first.
 *
 * Query Parameters:
 * - serverId: the target server identifier (required)
 * - limit: optional max number of anomalies to return (most recent first)
 *
 * Response:
 * {
 *   success: true,
 *   anomalies: AnomalyRecord[]
 * }
 *
 * Flag gating (defense-in-depth, R7.5):
 * Public anomaly surfacing is controlled by the `anomaly_public` flag. The flag
 * is enforced fail-closed at the UI layer (the client component does not render
 * when disabled), but this route ALSO checks the server-side flag via
 * `isFeatureFlagEnabled('anomaly_public')` and returns an empty list when the
 * flag is off, so disabled-flag truly hides the data even from direct API calls.
 *
 * This is a public, non-sensitive read (no auth) over already-collected
 * anomaly records.
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

    // Defense-in-depth fail-closed flag check (R7.5): when public surfacing is
    // disabled, return an empty list rather than the recorded anomalies.
    const publicSurfacingEnabled = await isFeatureFlagEnabled(FEATURE_FLAGS.ANOMALY_PUBLIC)
    if (!publicSurfacingEnabled) {
      return NextResponse.json(
        { success: true, anomalies: [] as AnomalyRecord[] },
        { headers: noCacheHeaders() }
      )
    }

    const limitParam = request.nextUrl.searchParams.get('limit')
    const parsedLimit = limitParam !== null ? Number.parseInt(limitParam, 10) : undefined
    const limit =
      typeof parsedLimit === 'number' && Number.isFinite(parsedLimit) && parsedLimit > 0
        ? parsedLimit
        : undefined

    const anomalies: AnomalyRecord[] = await getAnomaliesForServer(serverId.trim(), {
      limit,
      activeOnly: true,
    })

    return NextResponse.json(
      {
        success: true,
        anomalies,
      },
      { headers: noCacheHeaders() }
    )
  } catch (error) {
    console.error('Error in anomalies API:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/** No-cache headers — anomalies reflect the latest evaluated data. */
function noCacheHeaders(): Record<string, string> {
  return {
    'Cache-Control': 'no-cache, no-store, must-revalidate',
    'Pragma': 'no-cache',
    'Expires': '0',
  }
}
