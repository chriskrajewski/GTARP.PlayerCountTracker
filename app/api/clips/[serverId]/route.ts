import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { rateLimiter } from '@/lib/rateLimiter';
import { getAPICache } from '@/lib/api-cache';
import type { NextRequest } from 'next/server';

/**
 * Platform type for clips
 */
export type ClipPlatform = 'twitch' | 'kick';

/**
 * Clip response format with platform support
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
  platform: ClipPlatform;
  channel_slug?: string; // For Kick clips
}

/**
 * GET /api/clips/[serverId]
 * 
 * Fetches clips from BOTH Twitch and Kick for a server with optional filtering.
 * 
 * Query parameters:
 * - streamer: (optional) Filter clips by specific streamer username
 * - platform: (optional) Filter by platform: 'twitch', 'kick', or 'all' (default)
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

    // Get filters from query params
    const url = new URL(request.url);
    const streamerFilter = url.searchParams.get('streamer')?.toLowerCase().trim() || null;
    const platformFilter = url.searchParams.get('platform')?.toLowerCase().trim() as ClipPlatform | 'all' | null || 'all';

    // Generate cache key
    const cacheKey = `clips:${serverId}:${streamerFilter || 'all'}:${platformFilter}`;

    // Try to get from cache
    const cache = getAPICache();
    const cached = await cache.get<ClipResponse[]>('clips', cacheKey);
    if (cached) {
      console.log(`[Clips API] ${serverId} - Cache hit (platform: ${platformFilter})`);
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

    // ═══════════════════════════════════════════════════════════════════════════
    // FETCH CLIPS FROM BOTH PLATFORMS
    // ═══════════════════════════════════════════════════════════════════════════
    const responseClips: ClipResponse[] = [];

    // Fetch Twitch clips
    if (platformFilter === 'all' || platformFilter === 'twitch') {
      let twitchQuery = supabase
        .from('twitch_clips')
        .select('clip_id, streamer_username, clip_title, thumbnail_url, embed_url, view_count, duration_seconds, twitch_created_at')
        .eq('serverId', serverId)
        .eq('is_valid', true)
        .order('view_count', { ascending: false });

      if (streamerFilter) {
        twitchQuery = twitchQuery.eq('streamer_username', streamerFilter);
      }

      const { data: twitchClips, error: twitchError } = await twitchQuery;

      if (twitchError) {
        console.error(`[Clips API] Twitch database error for ${serverId}:`, twitchError);
      } else {
        (twitchClips || []).forEach((clip: any) => {
          responseClips.push({
            clip_id: clip.clip_id,
            streamer_username: clip.streamer_username,
            title: clip.clip_title,
            thumbnail_url: clip.thumbnail_url,
            embed_url: clip.embed_url,
            view_count: clip.view_count,
            duration: Math.round(clip.duration_seconds),
            created_at: clip.twitch_created_at,
            platform: 'twitch',
          });
        });
      }
    }

    // Fetch Kick clips
    if (platformFilter === 'all' || platformFilter === 'kick') {
      let kickQuery = supabase
        .from('kick_clips')
        .select('clip_id, streamer_username, clip_title, thumbnail_url, clip_url, view_count, duration_seconds, kick_created_at, channel_slug')
        .eq('serverId', serverId)
        .eq('is_valid', true)
        .order('view_count', { ascending: false });

      if (streamerFilter) {
        kickQuery = kickQuery.eq('streamer_username', streamerFilter);
      }

      const { data: kickClips, error: kickError } = await kickQuery;

      if (kickError) {
        console.error(`[Clips API] Kick database error for ${serverId}:`, kickError);
      } else {
        (kickClips || []).forEach((clip: any) => {
          responseClips.push({
            clip_id: clip.clip_id,
            streamer_username: clip.streamer_username,
            title: clip.clip_title,
            thumbnail_url: clip.thumbnail_url,
            embed_url: clip.clip_url, // Using clip_url as embed_url for Kick
            view_count: clip.view_count,
            duration: Math.round(clip.duration_seconds),
            created_at: clip.kick_created_at,
            platform: 'kick',
            channel_slug: clip.channel_slug,
          });
        });
      }
    }

    // Sort by view count
    responseClips.sort((a, b) => b.view_count - a.view_count);

    // ═══════════════════════════════════════════════════════════════════════════
    // FETCH PROFILE IMAGES
    // ═══════════════════════════════════════════════════════════════════════════
    // Fetch profile images for both platforms
    const { data: streamerHistory, error: historyError } = await supabase
      .from('streamer_server_history')
      .select('streamer_username, profile_image_url, platform')
      .eq('serverId', serverId);

    if (historyError) {
      console.warn(`[Clips API] Failed to fetch streamer history for ${serverId}:`, historyError);
    }

    // Build profile image map using lowercase keys for case-insensitive lookup
    // Key format: "platform:username"
    const profileImages = new Map<string, string>();
    if (streamerHistory) {
      for (const record of streamerHistory) {
        if (record.profile_image_url) {
          const key = `${record.platform}:${record.streamer_username.toLowerCase()}`;
          profileImages.set(key, record.profile_image_url);
        }
      }
    }

    // Add profile images to response clips
    const clipsWithProfiles = responseClips.map(clip => ({
      ...clip,
      profile_image_url: profileImages.get(`${clip.platform}:${clip.streamer_username.toLowerCase()}`),
    }));

    // Cache the response
    await cache.set('clips', cacheKey, clipsWithProfiles);

    const twitchCount = clipsWithProfiles.filter(c => c.platform === 'twitch').length;
    const kickCount = clipsWithProfiles.filter(c => c.platform === 'kick').length;
    console.log(`[Clips API] ${serverId} - Fetched ${clipsWithProfiles.length} clips (Twitch: ${twitchCount}, Kick: ${kickCount})`);

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
