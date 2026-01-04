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
 * Clip response format with server information and platform
 */
export interface AllClipsResponse {
  clip_id: string;
  streamer_username: string;
  title: string;
  thumbnail_url: string;
  embed_url: string;
  view_count: number;
  duration: number;
  created_at: string;
  profile_image_url?: string;
  server_id: string;
  server_name?: string;
  platform: ClipPlatform;
  channel_slug?: string; // For Kick clips
}

/**
 * Server info for filtering
 */
export interface ServerInfo {
  server_id: string;
  server_name: string;
}

/**
 * Database Twitch clip record format
 */
interface TwitchClipDatabaseRecord {
  clip_id: string;
  streamer_username: string;
  clip_title: string;
  thumbnail_url: string;
  embed_url: string;
  view_count: number;
  duration_seconds: number;
  twitch_created_at: string;
  serverId: string;
}

/**
 * Database Kick clip record format
 */
interface KickClipDatabaseRecord {
  clip_id: string;
  streamer_username: string;
  clip_title: string;
  thumbnail_url: string;
  clip_url: string;
  view_count: number;
  duration_seconds: number;
  kick_created_at: string;
  serverId: string;
  channel_slug: string;
  category_name: string | null;
}

/**
 * GET /api/clips/all
 * 
 * Fetches clips from BOTH Twitch and Kick from ALL servers with optional filtering.
 * 
 * Query parameters:
 * - server: (optional) Filter clips by specific server ID
 * - streamer: (optional) Filter clips by specific streamer username
 * - platform: (optional) Filter by platform: 'twitch', 'kick', or 'all' (default)
 * - limit: (optional) Maximum number of clips to return (default: 100, max: 500)
 * 
 * Response:
 * {
 *   success: boolean,
 *   data: AllClipsResponse[],
 *   servers: ServerInfo[] // List of servers with clips for filtering
 * }
 */
export async function GET(request: NextRequest) {
  try {
    // Apply rate limiting
    const rateLimitResponse = await rateLimiter(request);
    if (rateLimitResponse) {
      return rateLimitResponse;
    }

    // Get filters from query params
    const url = new URL(request.url);
    const serverFilter = url.searchParams.get('server')?.trim() || null;
    const streamerFilter = url.searchParams.get('streamer')?.toLowerCase().trim() || null;
    const platformFilter = url.searchParams.get('platform')?.toLowerCase().trim() as ClipPlatform | 'all' | null || 'all';
    const limitParam = url.searchParams.get('limit');
    const limit = Math.min(parseInt(limitParam || '100', 10), 500);
    const startDateParam = url.searchParams.get('startDate');
    const endDateParam = url.searchParams.get('endDate');

    const parseDateParam = (value: string | null) => {
      if (!value) return null;
      const parsed = new Date(value);
      if (Number.isNaN(parsed.getTime())) {
        return null;
      }
      return parsed;
    };

    const startDate = parseDateParam(startDateParam);
    const endDate = parseDateParam(endDateParam);
    const startDateIso = startDate ? startDate.toISOString() : null;
    const endDateIso = endDate ? endDate.toISOString() : null;

    // Generate cache key
    const cacheKey = `clips:all:${serverFilter || 'all'}:${streamerFilter || 'all'}:${platformFilter}:${limit}:${startDateIso || 'none'}:${endDateIso || 'none'}`;

    // Try to get from cache
    const cache = getAPICache();
    const cached = await cache.get<{ clips: AllClipsResponse[]; servers: ServerInfo[] }>('clips', cacheKey);
    if (cached) {
      console.log(`[All Clips API] Cache hit (server: ${serverFilter || 'all'}, platform: ${platformFilter})`);
      return NextResponse.json({
        success: true,
        data: cached.clips,
        servers: cached.servers,
      });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Supabase credentials not configured');
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // ═══════════════════════════════════════════════════════════════════════════
    // FETCH SERVERS WITH CLIPS FROM BOTH PLATFORMS
    // ═══════════════════════════════════════════════════════════════════════════
    const serverIdSet = new Set<string>();

    // Fetch Twitch servers
    if (platformFilter === 'all' || platformFilter === 'twitch') {
      let twitchServerQuery = supabase
        .from('twitch_clips')
        .select('serverId')
        .eq('is_valid', true);

      if (startDateIso) {
        twitchServerQuery = twitchServerQuery.gte('twitch_created_at', startDateIso);
      }
      if (endDateIso) {
        twitchServerQuery = twitchServerQuery.lte('twitch_created_at', endDateIso);
      }

      const { data: twitchServers } = await twitchServerQuery;
      (twitchServers || []).forEach((c: { serverId: string }) => serverIdSet.add(c.serverId));
    }

    // Fetch Kick servers
    if (platformFilter === 'all' || platformFilter === 'kick') {
      let kickServerQuery = supabase
        .from('kick_clips')
        .select('serverId')
        .eq('is_valid', true);

      if (startDateIso) {
        kickServerQuery = kickServerQuery.gte('kick_created_at', startDateIso);
      }
      if (endDateIso) {
        kickServerQuery = kickServerQuery.lte('kick_created_at', endDateIso);
      }

      const { data: kickServers } = await kickServerQuery;
      (kickServers || []).forEach((c: { serverId: string }) => serverIdSet.add(c.serverId));
    }

    const uniqueServerIds = Array.from(serverIdSet);

    // Fetch server names for all servers with clips
    const { data: serverNames, error: serverNamesError } = await supabase
      .from('server_xref')
      .select('server_id, server_name')
      .in('server_id', uniqueServerIds);

    if (serverNamesError) {
      console.warn('[All Clips API] Error fetching server names:', serverNamesError);
    }

    // Build server name map
    const serverNameMap = new Map<string, string>();
    (serverNames || []).forEach((s: { server_id: string; server_name: string }) => {
      serverNameMap.set(s.server_id, s.server_name);
    });

    // Build servers list for response
    const servers: ServerInfo[] = uniqueServerIds.map(id => ({
      server_id: id,
      server_name: serverNameMap.get(id) || `Server ${id}`,
    })).sort((a, b) => a.server_name.localeCompare(b.server_name));

    // ═══════════════════════════════════════════════════════════════════════════
    // FETCH CLIPS FROM BOTH PLATFORMS
    // ═══════════════════════════════════════════════════════════════════════════
    const responseClips: AllClipsResponse[] = [];

    // Fetch Twitch clips
    if (platformFilter === 'all' || platformFilter === 'twitch') {
      let twitchQuery = supabase
        .from('twitch_clips')
        .select('clip_id, streamer_username, clip_title, thumbnail_url, embed_url, view_count, duration_seconds, twitch_created_at, serverId')
        .eq('is_valid', true)
        .order('view_count', { ascending: false })
        .limit(limit);

      if (serverFilter) {
        twitchQuery = twitchQuery.eq('serverId', serverFilter);
      }
      if (streamerFilter) {
        twitchQuery = twitchQuery.eq('streamer_username', streamerFilter);
      }
      if (startDateIso) {
        twitchQuery = twitchQuery.gte('twitch_created_at', startDateIso);
      }
      if (endDateIso) {
        twitchQuery = twitchQuery.lte('twitch_created_at', endDateIso);
      }

      const { data: twitchClips, error: twitchError } = await twitchQuery;

      if (twitchError) {
        console.error('[All Clips API] Twitch database error:', twitchError);
      } else {
        (twitchClips || []).forEach((clip: TwitchClipDatabaseRecord) => {
          responseClips.push({
            clip_id: clip.clip_id,
            streamer_username: clip.streamer_username,
            title: clip.clip_title,
            thumbnail_url: clip.thumbnail_url,
            embed_url: clip.embed_url,
            view_count: clip.view_count,
            duration: Math.round(clip.duration_seconds),
            created_at: clip.twitch_created_at,
            server_id: clip.serverId,
            server_name: serverNameMap.get(clip.serverId) || `Server ${clip.serverId}`,
            platform: 'twitch',
          });
        });
      }
    }

    // Fetch Kick clips
    if (platformFilter === 'all' || platformFilter === 'kick') {
      let kickQuery = supabase
        .from('kick_clips')
        .select('clip_id, streamer_username, clip_title, thumbnail_url, clip_url, view_count, duration_seconds, kick_created_at, serverId, channel_slug')
        .eq('is_valid', true)
        .order('view_count', { ascending: false })
        .limit(limit);

      if (serverFilter) {
        kickQuery = kickQuery.eq('serverId', serverFilter);
      }
      if (streamerFilter) {
        kickQuery = kickQuery.eq('streamer_username', streamerFilter);
      }
      if (startDateIso) {
        kickQuery = kickQuery.gte('kick_created_at', startDateIso);
      }
      if (endDateIso) {
        kickQuery = kickQuery.lte('kick_created_at', endDateIso);
      }

      const { data: kickClips, error: kickError } = await kickQuery;

      if (kickError) {
        console.error('[All Clips API] Kick database error:', kickError);
      } else {
        (kickClips || []).forEach((clip: KickClipDatabaseRecord) => {
          responseClips.push({
            clip_id: clip.clip_id,
            streamer_username: clip.streamer_username,
            title: clip.clip_title,
            thumbnail_url: clip.thumbnail_url,
            embed_url: clip.clip_url, // Using clip_url as embed_url for Kick
            view_count: clip.view_count,
            duration: Math.round(clip.duration_seconds),
            created_at: clip.kick_created_at,
            server_id: clip.serverId,
            server_name: serverNameMap.get(clip.serverId) || `Server ${clip.serverId}`,
            platform: 'kick',
            channel_slug: clip.channel_slug,
          });
        });
      }
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // SORT BY VIEW COUNT AND LIMIT
    // ═══════════════════════════════════════════════════════════════════════════
    responseClips.sort((a, b) => b.view_count - a.view_count);
    const limitedClips = responseClips.slice(0, limit);

    // ═══════════════════════════════════════════════════════════════════════════
    // FETCH PROFILE IMAGES
    // ═══════════════════════════════════════════════════════════════════════════
    const uniqueStreamers = [...new Set(limitedClips.map(c => c.streamer_username.toLowerCase()))];
    
    if (uniqueStreamers.length > 0) {
      // Fetch profile images for both platforms
      const { data: streamerHistory, error: historyError } = await supabase
        .from('streamer_server_history')
        .select('streamer_username, profile_image_url, platform');

      if (historyError) {
        console.warn('[All Clips API] Failed to fetch streamer history:', historyError);
      }

      // Build profile image map using lowercase keys for case-insensitive lookup
      // Key format: "platform:username" for platform-specific lookup
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
      limitedClips.forEach((clip: AllClipsResponse) => {
        const key = `${clip.platform}:${clip.streamer_username.toLowerCase()}`;
        clip.profile_image_url = profileImages.get(key);
      });
    }

    // Cache the response
    await cache.set('clips', cacheKey, { clips: limitedClips, servers });

    const twitchCount = limitedClips.filter(c => c.platform === 'twitch').length;
    const kickCount = limitedClips.filter(c => c.platform === 'kick').length;
    console.log(`[All Clips API] Fetched ${limitedClips.length} clips (Twitch: ${twitchCount}, Kick: ${kickCount}) from ${servers.length} servers`);

    return NextResponse.json({
      success: true,
      data: limitedClips,
      servers,
    });
  } catch (error) {
    console.error('[All Clips API] Error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
