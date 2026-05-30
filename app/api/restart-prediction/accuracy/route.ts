import { NextResponse } from 'next/server'
import { getDisplayAccuracy } from '@/lib/prediction-accuracy'

/**
 * GET /api/restart-prediction/accuracy
 *
 * Returns the rolling 7-day restart-prediction accuracy metric for the
 * predictions tab (R6.4, R6.6). Delegates entirely to
 * {@link getDisplayAccuracy} from `lib/prediction-accuracy.ts` so the accuracy
 * is never recomputed here — the route stays thin and the data-access stays in
 * the `lib/` layer (R9.1).
 *
 * This is a public, aggregate, non-sensitive read (the predictions tab is
 * user-facing), so no authentication is required. The response mirrors the
 * shape/error style of `app/api/restart-prediction/route.ts`.
 *
 * Response:
 *   { success: true, accuracy: AccuracyDisplay }
 * where `AccuracyDisplay` is either `{ available: false }` ("not yet
 * available", R6.6) or the available metric with `accuracyPercent`,
 * `sampleSize`, `window`, and `toleranceMinutes`.
 */
export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const accuracy = await getDisplayAccuracy()

    return NextResponse.json(
      { success: true, accuracy },
      {
        headers: {
          // No caching - always reflect the freshest matched predictions.
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0',
        },
      }
    )
  } catch (error) {
    console.error('Error in restart prediction accuracy API:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
