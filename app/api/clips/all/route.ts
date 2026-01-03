import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { rateLimiter } from '@/lib/rateLimiter';
import { getAPICache } from '@/lib/api-cache';
import type { NextRequest } from 'next/server';

/**
 * Clip response format with server information
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
}

/**
 * Server info for filtering
 */
export interface ServerInfo {
  server_id: string;
  server_name: string;
}

/**
 * Database clip record format
 */
interface ClipDatabaseRecord {
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
 * GET /api/clips/all
 * 
 * Fetches Twitch clips from ALL servers with optional filtering.
 * 
 * Query parameters:
 * - server: (optional) Filter clips by specific server ID
 * - streamer: (optional) Filter clips by specific streamer username
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
    const limitParam = url.searchParams.get('limit');
    const limit = Math.min(parseInt(limitParam || '100', 10), 500);

    // Generate cache key
    const cacheKey = `clips:all:${serverFilter || 'all'}:${streamerFilter || 'all'}:${limit}`;

    // Try to get from cache
    const cache = getAPICache();
    const cached = await cache.get<{ clips: AllClipsResponse[]; servers: ServerInfo[] }>('clips', cacheKey);
    if (cached) {
      console.log(`[All Clips API] Cache hit (server: ${serverFilter || 'all'}, streamer: ${streamerFilter || 'all'})`);
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

    // Fetch all servers that have clips
    const { data: serversWithClips, error: serversError } = await supabase
      .from('twitch_clips')
      .select('serverId')
      .eq('is_valid', true);

    if (serversError) {
      console.error('[All Clips API] Error fetching servers with clips:', serversError);
      throw new Error('Failed to fetch servers');
    }

    // Get unique server IDs
    const uniqueServerIds = [...new Set((serversWithClips || []).map((c: { serverId: string }) => c.serverId))];

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

    // Fetch clips from database
    let query = supabase
      .from('twitch_clips')
      .select('clip_id, streamer_username, clip_title, thumbnail_url, embed_url, view_count, duration_seconds, twitch_created_at, serverId')
      .eq('is_valid', true)
      .order('view_count', { ascending: false })
      .limit(limit);

    // Apply server filter if provided
    if (serverFilter) {
      query = query.eq('serverId', serverFilter);
    }

    // Apply streamer filter if provided
    if (streamerFilter) {
      query = query.eq('streamer_username', streamerFilter);
    }

    const { data: clips, error } = await query;

    if (error) {
      console.error('[All Clips API] Database error:', error);
      return NextResponse.json(
        { success: false, error: 'Failed to fetch clips' },
        { status: 500 }
      );
    }

    // Transform database format to response format
    const responseClips: AllClipsResponse[] = (clips || []).map((clip: ClipDatabaseRecord) => ({
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
    }));

    // Fetch profile images from streamer_server_history table
    // Get unique streamer usernames from clips
    const uniqueStreamers = [...new Set(responseClips.map(c => c.streamer_username.toLowerCase()))];
    
    if (uniqueStreamers.length > 0) {
      const { data: streamerHistory, error: historyError } = await supabase
        .from('streamer_server_history')
        .select('streamer_username, profile_image_url')
        .eq('platform', 'twitch');

      if (historyError) {
        console.warn('[All Clips API] Failed to fetch streamer history:', historyError);
      }

      // Build profile image map using lowercase keys for case-insensitive lookup
      const profileImages = new Map<string, string>();
      if (streamerHistory) {
        for (const record of streamerHistory) {
          if (record.profile_image_url) {
            profileImages.set(record.streamer_username.toLowerCase(), record.profile_image_url);
          }
        }
      }

      // Add profile images to response clips
      responseClips.forEach((clip: AllClipsResponse) => {
        clip.profile_image_url = profileImages.get(clip.streamer_username.toLowerCase());
      });
    }

    // Cache the response
    await cache.set('clips', cacheKey, { clips: responseClips, servers });

    console.log(`[All Clips API] Fetched ${responseClips.length} clips from ${servers.length} servers (server: ${serverFilter || 'all'}, streamer: ${streamerFilter || 'all'})`);

    return NextResponse.json({
      success: true,
      data: responseClips,
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
