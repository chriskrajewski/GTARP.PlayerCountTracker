import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { rateLimiter } from '@/lib/rateLimiter';
import { getAPICache } from '@/lib/api-cache';
import type { NextRequest } from 'next/server';

/**
 * Clip response format
 */
export interface ClipResponse {
  clip_id: string;
  streamer_username: string;
  title: string;
  thumbnail_url: string;
  embed_url: string;
  view_count: number;
  duration: number;
  created_at: string;
}

/**
 * GET /api/clips/[serverId]
 * 
 * Fetches Twitch clips for a server with optional streamer filtering.
 * 
 * Query parameters:
 * - streamer: (optional) Filter clips by specific streamer username
 * 
 * Response:
 * {
 *   success: boolean,
 *   data: ClipResponse[]
 * }
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ serverId: string }> }
) {
  try {
    // Apply rate limiting
    const rateLimitResponse = await rateLimiter(request);
    if (rateLimitResponse) {
      return rateLimitResponse;
    }

    const { serverId } = await params;
    if (!serverId) {
      return NextResponse.json(
        { success: false, error: 'Server ID is required' },
        { status: 400 }
      );
    }

    // Get streamer filter from query params (optional)
    const url = new URL(request.url);
    const streamerFilter = url.searchParams.get('streamer')?.toLowerCase().trim() || null;

    // Generate cache key
    const cacheKey = streamerFilter 
      ? `clips:${serverId}:${streamerFilter}` 
      : `clips:${serverId}:all`;

    // Try to get from cache
    const cache = getAPICache();
    const cached = await cache.get<ClipResponse[]>('clips', cacheKey);
    if (cached) {
      console.log(`[Clips API] ${serverId} - Cache hit (${streamerFilter ? 'filtered' : 'all'})`);
      return NextResponse.json({
        success: true,
        data: cached,
      });
    }

    // Verify server exists
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Supabase credentials not configured');
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    const { data: serverExists } = await supabase
      .from('server_xref')
      .select('id')
      .eq('id', serverId)
      .single();

    if (!serverExists) {
      console.warn(`[Clips API] Server not found: ${serverId}`);
      return NextResponse.json(
        { success: false, error: 'Server not found' },
        { status: 404 }
      );
    }

    // Fetch clips from database
    let query = supabase
      .from('twitch_clips')
      .select('clip_id, streamer_username, clip_title, thumbnail_url, embed_url, view_count, duration_seconds, twitch_created_at')
      .eq('serverId', serverId)
      .eq('is_valid', true)
      .order('view_count', { ascending: false });

    // Apply streamer filter if provided
    if (streamerFilter) {
      query = query.eq('streamer_username', streamerFilter);
    }

    const { data: clips, error } = await query;

    if (error) {
      console.error(`[Clips API] Database error for ${serverId}:`, error);
      return NextResponse.json(
        { success: false, error: 'Failed to fetch clips' },
        { status: 500 }
      );
    }

    // Transform database format to response format
    const responseClips: ClipResponse[] = (clips || []).map((clip: any) => ({
      clip_id: clip.clip_id,
      streamer_username: clip.streamer_username,
      title: clip.clip_title,
      thumbnail_url: clip.thumbnail_url,
      embed_url: clip.embed_url,
      view_count: clip.view_count,
      duration: Math.round(clip.duration_seconds),
      created_at: clip.twitch_created_at,
    }));

    // Cache the response
    await cache.set('clips', cacheKey, responseClips);

    console.log(`[Clips API] ${serverId} - Fetched ${responseClips.length} clips (${streamerFilter ? 'filtered' : 'all'})`);

    return NextResponse.json({
      success: true,
      data: responseClips,
    });
  } catch (error) {
    console.error('[Clips API] Error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
