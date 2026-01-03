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
  profile_image_url?: string;
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
      .select('server_id')
      .eq('server_id', serverId)
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
    // Use the original thumbnail_url from Twitch API stored in database
    // These URLs are served from Twitch's CDN (clips-media-assets2.twitch.tv or static-cdn.jtvnw.net)
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

    // Fetch profile images from streamer_server_history table
    // Note: twitch_clips stores usernames in lowercase, but streamer_server_history 
    // stores them with original Twitch casing, so we need case-insensitive matching
    const { data: streamerHistory, error: historyError } = await supabase
      .from('streamer_server_history')
      .select('streamer_username, profile_image_url')
      .eq('serverId', serverId)
      .eq('platform', 'twitch');

    if (historyError) {
      console.warn(`[Clips API] Failed to fetch streamer history for ${serverId}:`, historyError);
    }

    // Build profile image map from database using lowercase keys for case-insensitive lookup
    const profileImages = new Map<string, string>();
    if (streamerHistory) {
      for (const record of streamerHistory) {
        if (record.profile_image_url) {
          // Store with lowercase key for case-insensitive matching
          profileImages.set(record.streamer_username.toLowerCase(), record.profile_image_url);
        }
      }
    }

    // Add profile images to response clips (clip usernames are already lowercase)
    const clipsWithProfiles = responseClips.map(clip => ({
      ...clip,
      profile_image_url: profileImages.get(clip.streamer_username.toLowerCase()),
    }));

    // Cache the response
    await cache.set('clips', cacheKey, clipsWithProfiles);

    console.log(`[Clips API] ${serverId} - Fetched ${clipsWithProfiles.length} clips (${streamerFilter ? 'filtered' : 'all'}) with ${profileImages.size} profile images`);

    return NextResponse.json({
      success: true,
      data: clipsWithProfiles,
    });
  } catch (error) {
    console.error('[Clips API] Error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
