import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import type { NextRequest } from 'next/server';
import type { Database } from '@/lib/supabase.types';
import { rateLimiter } from '@/lib/rateLimiter';
import { getOrCreateAppUser } from '@/lib/app-users';

type ClipPlatform = 'twitch' | 'kick';

interface FavoriteRecord {
  id: number;
  user_id: number;
  clip_id: string;
  platform: ClipPlatform;
  saved_at: string;
  notes: string | null;
  categories: string[] | null;
  viewing_history: string[] | null;
}

interface ClipDetail {
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
  channel_slug?: string;
}

/**
 * GET /api/favorites/list
 *
 * List the authenticated user's favorites with optional filtering.
 */
export async function GET(request: NextRequest) {
  try {
    const rateLimitResponse = await rateLimiter(request);
    if (rateLimitResponse) {
      return rateLimitResponse;
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseAnonKey) {
      throw new Error('Supabase credentials not configured');
    }

    const authHeader = request.headers.get('authorization') || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;

    if (!token) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      },
    });

    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { appUser, error: appUserError } = await getOrCreateAppUser(supabase, user);

    if (appUserError || !appUser) {
      return NextResponse.json({ success: false, error: 'User not found' }, { status: 404 });
    }

    const url = new URL(request.url);
    const platformParam = url.searchParams.get('platform')?.toLowerCase();
    const sortBy = url.searchParams.get('sortBy') || 'saved_at';
    const categoriesParam = url.searchParams.get('categories');
    const limitParam = url.searchParams.get('limit');
    const offsetParam = url.searchParams.get('offset');

    const limit = Math.min(parseInt(limitParam || '50', 10), 500);
    const offset = Math.max(parseInt(offsetParam || '0', 10), 0);

    const categories = categoriesParam
      ? categoriesParam.split(',').map((value) => value.trim()).filter(Boolean)
      : [];

    let favoritesQuery = supabase
      .from('user_favorites')
      .select('id, user_id, clip_id, platform, saved_at, notes, categories, viewing_history', { count: 'exact' })
      .eq('user_id', appUser.id);

    if (platformParam && platformParam !== 'all') {
      favoritesQuery = favoritesQuery.eq('platform', platformParam);
    }

    if (categories.length > 0) {
      favoritesQuery = favoritesQuery.contains('categories', categories);
    }

    if (sortBy === 'notes') {
      favoritesQuery = favoritesQuery.order('notes', { ascending: true, nullsFirst: true });
    } else {
      favoritesQuery = favoritesQuery.order('saved_at', { ascending: false });
    }

    favoritesQuery = favoritesQuery.range(offset, offset + limit - 1);

    const { data: favorites, error: favoritesError, count } = await favoritesQuery;

    if (favoritesError) {
      return NextResponse.json({ success: false, error: favoritesError.message }, { status: 400 });
    }

    const favoriteRecords = (favorites || []) as FavoriteRecord[];
    const twitchIds = favoriteRecords.filter((fav) => fav.platform === 'twitch').map((fav) => fav.clip_id);
    const kickIds = favoriteRecords.filter((fav) => fav.platform === 'kick').map((fav) => fav.clip_id);

    const clipDetails: ClipDetail[] = [];

    if (twitchIds.length > 0) {
      const { data: twitchClips } = await supabase
        .from('twitch_clips')
        .select('clip_id, streamer_username, clip_title, thumbnail_url, embed_url, view_count, duration_seconds, twitch_created_at, serverId')
        .in('clip_id', twitchIds)
        .eq('is_valid', true);

      (twitchClips || []).forEach((clip) => {
        clipDetails.push({
          clip_id: clip.clip_id,
          streamer_username: clip.streamer_username,
          title: clip.clip_title,
          thumbnail_url: clip.thumbnail_url,
          embed_url: clip.embed_url,
          view_count: clip.view_count,
          duration: Math.round(clip.duration_seconds),
          created_at: clip.twitch_created_at,
          server_id: clip.serverId,
          platform: 'twitch',
        });
      });
    }

    if (kickIds.length > 0) {
      const { data: kickClips } = await supabase
        .from('kick_clips')
        .select('clip_id, streamer_username, clip_title, thumbnail_url, clip_url, view_count, duration_seconds, kick_created_at, serverId, channel_slug')
        .in('clip_id', kickIds)
        .eq('is_valid', true);

      (kickClips || []).forEach((clip) => {
        clipDetails.push({
          clip_id: clip.clip_id,
          streamer_username: clip.streamer_username,
          title: clip.clip_title,
          thumbnail_url: clip.thumbnail_url,
          embed_url: clip.clip_url,
          view_count: clip.view_count,
          duration: Math.round(clip.duration_seconds),
          created_at: clip.kick_created_at,
          server_id: clip.serverId,
          platform: 'kick',
          channel_slug: clip.channel_slug,
        });
      });
    }

    const serverIdSet = new Set<string>(clipDetails.map((clip) => clip.server_id));
    const serverIds = Array.from(serverIdSet);

    if (serverIds.length > 0) {
      const { data: serverNames } = await supabase
        .from('server_xref')
        .select('server_id, server_name')
        .in('server_id', serverIds);

      const serverNameMap = new Map<string, string>();
      (serverNames || []).forEach((server) => {
        serverNameMap.set(server.server_id, server.server_name);
      });

      clipDetails.forEach((clip) => {
        clip.server_name = serverNameMap.get(clip.server_id) || `Server ${clip.server_id}`;
      });
    }

    const uniqueStreamers = [...new Set(clipDetails.map((clip) => `${clip.platform}:${clip.streamer_username.toLowerCase()}`))];
    if (uniqueStreamers.length > 0) {
      const { data: streamerHistory } = await supabase
        .from('streamer_server_history')
        .select('streamer_username, profile_image_url, platform');

      const profileImages = new Map<string, string>();
      (streamerHistory || []).forEach((record) => {
        if (record.profile_image_url) {
          const key = `${record.platform}:${record.streamer_username.toLowerCase()}`;
          profileImages.set(key, record.profile_image_url);
        }
      });

      clipDetails.forEach((clip) => {
        const key = `${clip.platform}:${clip.streamer_username.toLowerCase()}`;
        clip.profile_image_url = profileImages.get(key) || clip.profile_image_url;
      });
    }

    const clipMap = new Map<string, ClipDetail>();
    clipDetails.forEach((clip) => {
      clipMap.set(`${clip.platform}:${clip.clip_id}`, clip);
    });

    const responseData = favoriteRecords.map((favorite) => ({
      ...favorite,
      clip: clipMap.get(`${favorite.platform}:${favorite.clip_id}`) || null,
    }));

    return NextResponse.json({
      success: true,
      data: responseData,
      total: count || 0,
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Server error' },
      { status: 500 }
    );
  }
}
