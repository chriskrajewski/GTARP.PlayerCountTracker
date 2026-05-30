import { NextRequest, NextResponse } from 'next/server';
import { getClipsForCharacter } from '@/lib/streamer-characters';
import { isFeatureFlagEnabled } from '@/lib/feature-flags-server';
import { FEATURE_FLAGS } from '@/lib/feature-flags-constants';

/**
 * Public character-clips API for Streamer Character Tracking (task 9.1).
 *
 * Backs the `'use client'` character-clips panel on the Streamer_Profile page.
 * The catalog itself is rendered server-side; this route lets the small client
 * child fetch the clips for a selected character WITHOUT ever importing the
 * service-role `lib/streamer-characters.ts` reads into client code (R8.1) — all
 * data access stays in the `lib/` Data_Layer and runs server-side here.
 *
 * GET /api/streamers/characters?username=&character=
 *   → { success: true, clips: Clip[], vods: [] }
 *
 * Defense-in-depth fail-closed gating (R1.2, R1.4): when `character_tracking`
 * is disabled the route returns 404 so the data is unreachable even by direct
 * call, mirroring the server-side gate on the page (and the `viewer-trend`
 * route's pattern).
 */

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    // Fail-closed: hide the data entirely when the feature flag is off (R1.2/R1.4).
    if (!(await isFeatureFlagEnabled(FEATURE_FLAGS.CHARACTER_TRACKING))) {
      return NextResponse.json({ success: false, error: 'Not found' }, { status: 404 });
    }

    const { searchParams } = new URL(request.url);
    const username = (searchParams.get('username') ?? '').trim();
    const character = (searchParams.get('character') ?? '').trim();

    if (!username || !character) {
      return NextResponse.json(
        { success: false, error: 'username and character parameters are required' },
        { status: 400 },
      );
    }

    const clips = await getClipsForCharacter(username, character);

    // `vods` is intentionally an empty array until a VOD data source exists
    // (R7.4): the VOD surface is omitted rather than surfaced as an error. The
    // pure overlap seam (`vodCharactersByOverlap`) is ready for when one does.
    return NextResponse.json(
      { success: true, clips, vods: [] },
      {
        headers: {
          'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=120',
        },
      },
    );
  } catch (error) {
    console.error('Error in streamer characters API:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch character clips' },
      { status: 500 },
    );
  }
}
