import { NextRequest, NextResponse } from 'next/server';
import { getStreamerViewerTrend, type StreamerPlatform } from '@/lib/streamers';
import { isFeatureFlagEnabled } from '@/lib/feature-flags-server';
import { FEATURE_FLAGS } from '@/lib/feature-flags';
import type { TimeRange } from '@/lib/data';

/**
 * Streamer viewer-trend API (R4.5 — task 10.6).
 *
 * Backs the selectable time-range chart on the Streamer_Profile page. The page
 * itself is a server component that renders an INITIAL trend; this public route
 * lets the small `'use client'` chart child refetch the trend when the viewer
 * changes the range, without ever importing the service-role `lib/streamers.ts`
 * functions into client code (R9.1) — all data access stays in the `lib/` layer
 * and runs server-side here.
 *
 * GET /api/streamers/viewer-trend?username=&platform=twitch|kick&range=24h|7d|30d
 *   → { success: true, points: ViewerTrendPoint[] }
 *
 * Defense-in-depth fail-closed gating (R1.4): when `streamer_pages` is disabled
 * the route returns 404 so the data is unreachable even by direct call, mirroring
 * the server-side `notFound()` gate on the page.
 */

/** Ranges the chart selector offers; constrains the public input space. */
const ALLOWED_RANGES: ReadonlySet<TimeRange> = new Set<TimeRange>(['24h', '7d', '30d']);
const ALLOWED_PLATFORMS: ReadonlySet<StreamerPlatform> = new Set<StreamerPlatform>([
  'twitch',
  'kick',
]);

export async function GET(request: NextRequest) {
  try {
    // Fail-closed: hide the data entirely when the feature flag is off.
    if (!(await isFeatureFlagEnabled(FEATURE_FLAGS.STREAMER_PAGES))) {
      return NextResponse.json({ success: false, error: 'Not found' }, { status: 404 });
    }

    const { searchParams } = new URL(request.url);
    const username = (searchParams.get('username') ?? '').trim();
    const platformParam = searchParams.get('platform');
    const rangeParam = searchParams.get('range');

    if (!username) {
      return NextResponse.json(
        { success: false, error: 'username parameter is required' },
        { status: 400 },
      );
    }

    const platform =
      platformParam && ALLOWED_PLATFORMS.has(platformParam as StreamerPlatform)
        ? (platformParam as StreamerPlatform)
        : undefined;

    const range: TimeRange = ALLOWED_RANGES.has(rangeParam as TimeRange)
      ? (rangeParam as TimeRange)
      : '7d';

    const points = await getStreamerViewerTrend(username, range, platform);

    return NextResponse.json(
      { success: true, points },
      {
        headers: {
          'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=120',
        },
      },
    );
  } catch (error) {
    console.error('Error in streamer viewer-trend API:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch viewer trend' },
      { status: 500 },
    );
  }
}
