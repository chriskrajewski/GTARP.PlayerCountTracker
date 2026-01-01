import { NextResponse } from 'next/server';
import { getServerName } from '@/lib/data';
import { getStreamSearchConfigByPlatform, type StreamSearchConfig } from '@/lib/stream-config';
import {
  getKickStreamsByCategoryQuery,
  getKickTopStreams,
  isKickApiConfigured,
  type KickStreamData
} from '@/lib/kick-api';

/**
 * Streams API - Fetches live streams from BOTH Twitch and Kick for a server
 * 
 * IMPORTANT: This API uses stream_search_config from Supabase to determine
 * which streams belong to which server. No hardcoded mappings.
 * 
 * The flow:
 * 1. Load server's search config for BOTH platforms from stream_search_config
 * 2. Fetch streams from Twitch API (GTA V category)
 * 3. Fetch streams from Kick API (based on config)
 * 4. Filter streams by the server's keywords
 * 5. Merge, dedupe, and return with platform indicator
 */

// Unified stream interface that includes platform
export interface UnifiedStream {
  id: string;
  user_id: string;
  user_name: string;
  game_name: string;
  title: string;
  viewer_count: number;
  started_at: string;
  thumbnail_url: string;
  tags: string[];
  profile_image_url?: string;
  platform: 'twitch' | 'kick';
}

interface TwitchUser {
  id: string;
  login: string;
  display_name: string;
  profile_image_url: string;
}

interface TwitchApiStream {
  id: string;
  user_id: string;
  user_name: string;
  user_login: string;
  game_id: string;
  game_name: string;
  type: string;
  title: string;
  viewer_count: number;
  started_at: string;
  language: string;
  thumbnail_url: string;
  tag_ids: string[];
  tags: string[];
  is_mature: boolean;
}

// ============================================
// TWITCH API FUNCTIONS
// ============================================

async function getTwitchToken(): Promise<string> {
  const clientId = process.env.TWITCH_CLIENT_ID;
  const clientSecret = process.env.TWITCH_CLIENT_SECRET;
  
  if (!clientId || !clientSecret) {
    throw new Error('Twitch credentials are not configured');
  }
  
  const response = await fetch('https://id.twitch.tv/oauth2/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `client_id=${clientId}&client_secret=${clientSecret}&grant_type=client_credentials`,
    signal: AbortSignal.timeout(10000)
  });
  
  if (!response.ok) {
    throw new Error('Failed to obtain Twitch access token');
  }
  
  const data = await response.json();
  return data.access_token;
}

async function getGTAGameId(clientId: string, token: string): Promise<string> {
  const response = await fetch(
    `https://api.twitch.tv/helix/games?name=${encodeURIComponent('Grand Theft Auto V')}`,
    {
      headers: {
        'Client-ID': clientId,
        'Authorization': `Bearer ${token}`
      },
      signal: AbortSignal.timeout(10000)
    }
  );

  if (!response.ok) {
    throw new Error('Failed to get GTA V game ID from Twitch');
  }

  const data = await response.json();
  const gameId = data.data?.[0]?.id;
  
  if (!gameId) {
    throw new Error('GTA V game not found on Twitch');
  }
  
  return gameId;
}

async function getGameIds(clientId: string, token: string, gameNames: string[]): Promise<Map<string, string>> {
  const gameMap = new Map<string, string>();
  
  for (const gameName of gameNames) {
    try {
      const response = await fetch(
        `https://api.twitch.tv/helix/games?name=${encodeURIComponent(gameName)}`,
        {
          headers: {
            'Client-ID': clientId,
            'Authorization': `Bearer ${token}`
          },
          signal: AbortSignal.timeout(10000)
        }
      );

      if (!response.ok) {
        console.warn(`[Streams API] Failed to get game ID for "${gameName}": ${response.status}`);
        continue;
      }

      const data = await response.json();
      const gameId = data.data?.[0]?.id;
      if (gameId) {
        gameMap.set(gameName, gameId);
        console.log(`[Streams API] Got game ID for "${gameName}": ${gameId}`);
      }
    } catch (error) {
      console.error(`[Streams API] Error getting game ID for "${gameName}":`, error);
    }
  }

  return gameMap;
}

async function fetchStreamsFromGames(
  clientId: string,
  token: string,
  gameIds: string[],
  maxPages: number = 5
): Promise<TwitchApiStream[]> {
  const streams: TwitchApiStream[] = [];

  for (const gameId of gameIds) {
    let cursor: string | null = null;
    let pageCount = 0;

    try {
      while (pageCount < maxPages) {
        const params = new URLSearchParams({
          game_id: gameId,
          first: '100'
        });
        if (cursor) params.set('after', cursor);

        const response = await fetch(
          `https://api.twitch.tv/helix/streams?${params}`,
          {
            headers: {
              'Client-ID': clientId,
              'Authorization': `Bearer ${token}`
            },
            signal: AbortSignal.timeout(15000)
          }
        );

        if (!response.ok) {
          console.error(`[Streams API] Twitch API error for game ${gameId}: ${response.status}`);
          break;
        }

        const data = await response.json();
        const batch = Array.isArray(data.data) ? data.data : [];
        streams.push(...batch);

        cursor = data.pagination?.cursor || null;
        if (!cursor || batch.length === 0) break;
        pageCount++;
      }
    } catch (error) {
      console.error(`[Streams API] Error fetching streams for game ${gameId}:`, error);
    }
  }

  return streams;
}

async function fetchGTAVStreams(
  clientId: string,
  token: string,
  gameId: string,
  maxPages: number = 5
): Promise<TwitchApiStream[]> {
  return fetchStreamsFromGames(clientId, token, [gameId], maxPages);
}

async function fetchUserProfiles(
  clientId: string,
  accessToken: string,
  userIds: string[]
): Promise<Map<string, string>> {
  const profileMap = new Map<string, string>();
  if (userIds.length === 0) return profileMap;

  const batches: string[][] = [];
  for (let i = 0; i < userIds.length; i += 100) {
    batches.push(userIds.slice(i, i + 100));
  }

  for (const batch of batches) {
    try {
      const userIdParams = batch.map(id => `id=${id}`).join('&');
      const response = await fetch(
        `https://api.twitch.tv/helix/users?${userIdParams}`,
        {
          headers: {
            'Client-ID': clientId,
            'Authorization': `Bearer ${accessToken}`,
          },
          signal: AbortSignal.timeout(10000)
        }
      );

      if (!response.ok) {
        console.error(`[Streams API] Failed to fetch user profiles: ${response.status}`);
        continue;
      }

      const data = await response.json();
      for (const user of (data.data || []) as TwitchUser[]) {
        profileMap.set(user.id, user.profile_image_url);
      }
    } catch (error) {
      console.error('[Streams API] Error fetching user profiles:', error);
    }
  }

  return profileMap;
}

function filterTwitchStreamsByConfig(
  streams: TwitchApiStream[],
  config: StreamSearchConfig[]
): TwitchApiStream[] {
  if (config.length === 0) {
    return [];
  }

  const titleKeywords: string[] = [];
  const categoryKeywords: string[] = [];
  const tagKeywords: string[] = [];

  for (const rule of config) {
    const keyword = (rule.search_keyword || '').trim().toLowerCase();
    if (!keyword) continue;

    switch (rule.search_type) {
      case 'title':
        titleKeywords.push(keyword);
        break;
      case 'category':
        categoryKeywords.push(keyword);
        break;
      case 'tag':
        tagKeywords.push(keyword);
        break;
    }
  }

  const seen = new Set<string>();
  const matched: TwitchApiStream[] = [];

  for (const stream of streams) {
    const titleLower = (stream.title || '').toLowerCase();
    const gameLower = (stream.game_name || '').toLowerCase();
    const tagsLower = (stream.tags || []).map(t => (t || '').toLowerCase());

    // Use AND logic between search types (all specified types must match)
    // Use OR logic within each search type (any keyword in that type can match)
    
    // Check title keywords (partial match) - OR within titles
    const titleMatch = titleKeywords.length === 0 || titleKeywords.some(k => titleLower.includes(k));
    
    // Check category keywords (exact match) - OR within categories
    const categoryMatch = categoryKeywords.length === 0 || categoryKeywords.some(k => gameLower === k);
    
    // Check tag keywords (exact match) - OR within tags
    const tagMatch = tagKeywords.length === 0 || tagKeywords.some(k => tagsLower.includes(k));
    
    // ALL specified search types must match (AND logic between types)
    if (!titleMatch || !categoryMatch || !tagMatch) continue;

    const key = (stream.user_name || '').toLowerCase();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    matched.push(stream);
  }

  return matched;
}

// ============================================
// KICK API FUNCTIONS
// ============================================

function partitionKeywords(keywords: string[]): { include: string[]; exclude: string[] } {
  const include: string[] = [];
  const exclude: string[] = [];
  for (const raw of keywords) {
    const k = (raw || '').trim().toLowerCase();
    if (!k) continue;
    if (k.startsWith('!') && k.length > 1) exclude.push(k.slice(1));
    else include.push(k);
  }
  return { include, exclude };
}

async function fetchKickStreams(
  serverId: string,
  config: StreamSearchConfig[]
): Promise<KickStreamData[]> {
  if (!isKickApiConfigured() || config.length === 0) {
    return [];
  }

  const categoryRules = config.filter(c => c.search_type === 'category');
  const titleRules = config.filter(c => c.search_type === 'title');

  // Build candidate pool from categories or top streams
  let poolStreams: KickStreamData[] = [];
  if (categoryRules.length) {
    const poolSeen = new Set<string>();
    for (const rule of categoryRules) {
      const keyword = (rule.search_keyword || '').trim().toLowerCase();
      if (!keyword) continue;

      const candidates = await getKickStreamsByCategoryQuery(keyword, 100);
      for (const s of candidates) {
        const key = (s.channel_slug || s.user_name || '').toLowerCase();
        if (!key || poolSeen.has(key)) continue;
        poolSeen.add(key);
        poolStreams.push(s);
      }
    }
  } else {
    poolStreams = await getKickTopStreams(100);
  }

  const { include, exclude } = partitionKeywords(titleRules.map(r => r.search_keyword));

  // If no include keywords, can't filter reliably
  if (include.length === 0) {
    return [];
  }

  // Filter by title keywords
  const seen = new Set<string>();
  const matched: KickStreamData[] = [];

  for (const s of poolStreams) {
    const title = (s.title || '').toLowerCase();
    if (!include.some(k => title.includes(k))) continue;
    if (exclude.length && exclude.some(k => title.includes(k))) continue;

    const key = (s.channel_slug || s.user_name || '').toLowerCase();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    matched.push(s);
  }

  return matched;
}

// ============================================
// MAIN API HANDLER
// ============================================

export async function GET(
  request: Request,
  context: { params: Promise<{ serverId: string }> }
) {
  try {
    const params = await context.params;
    const serverId = params.serverId;

    if (!serverId) {
      return NextResponse.json(
        { error: 'Server ID is required' },
        { status: 400 }
      );
    }

    const serverName = await getServerName(serverId);

    // Load configs for BOTH platforms
    const [twitchConfig, kickConfig] = await Promise.all([
      getStreamSearchConfigByPlatform(serverId, 'twitch'),
      getStreamSearchConfigByPlatform(serverId, 'kick')
    ]);

    const hasTwitchConfig = twitchConfig.length > 0;
    const hasKickConfig = kickConfig.length > 0;

    if (!hasTwitchConfig && !hasKickConfig) {
      console.log(`[Streams API] No config found for server ${serverId} (${serverName})`);
      return NextResponse.json([]);
    }

    const allStreams: UnifiedStream[] = [];
    const seenStreamers = new Set<string>();

    // ============================================
    // FETCH TWITCH STREAMS
    // ============================================
    if (hasTwitchConfig) {
      const clientId = process.env.TWITCH_CLIENT_ID;
      if (clientId) {
        try {
          const accessToken = await getTwitchToken();
          
          // Collect all unique category keywords from config
          const categoryKeywords = new Set<string>();
          for (const config of twitchConfig) {
            if (config.search_type === 'category') {
              categoryKeywords.add(config.search_keyword);
            }
          }
          
          // Get game IDs for all categories mentioned in config
          // Always include GTA V as a default
          const gamesToFetch = ['Grand Theft Auto V', ...Array.from(categoryKeywords)];
          console.log(`[Streams API] ${serverId} - Fetching Twitch streams from games: ${gamesToFetch.join(', ')}`);
          
          const gameIdMap = await getGameIds(clientId, accessToken, gamesToFetch);
          const gameIds = Array.from(gameIdMap.values());
          
          if (gameIds.length === 0) {
            console.warn(`[Streams API] ${serverId} - No game IDs found for Twitch`);
          } else {
            const rawStreams = await fetchStreamsFromGames(clientId, accessToken, gameIds);
            console.log(`[Streams API] ${serverId} - Fetched ${rawStreams.length} total Twitch streams from ${gameIds.length} games`);
            
            const matchedStreams = filterTwitchStreamsByConfig(rawStreams, twitchConfig);

            // Fetch profile images
            const userIds = matchedStreams.map(s => s.user_id);
            const profileMap = await fetchUserProfiles(clientId, accessToken, userIds);

            // Convert to unified format
            for (const stream of matchedStreams) {
              const key = stream.user_name.toLowerCase();
              if (seenStreamers.has(key)) continue;
              seenStreamers.add(key);

              const formattedThumbnail = stream.thumbnail_url
                .replace('{width}', '440')
                .replace('{height}', '248');

              allStreams.push({
                id: stream.id,
                user_id: stream.user_id,
                user_name: stream.user_name,
                game_name: stream.game_name,
                title: stream.title,
                viewer_count: stream.viewer_count,
                started_at: stream.started_at,
                thumbnail_url: formattedThumbnail,
                tags: stream.tags || [],
                profile_image_url: profileMap.get(stream.user_id),
                platform: 'twitch'
              });
            }

            console.log(`[Streams API] Twitch: ${matchedStreams.length} streams for ${serverId}`);
          }
        } catch (error) {
          console.error('[Streams API] Twitch error:', error);
        }
      }
    }

    // ============================================
    // FETCH KICK STREAMS
    // ============================================
    if (hasKickConfig) {
      try {
        const kickStreams = await fetchKickStreams(serverId, kickConfig);

        // Convert to unified format
        for (const stream of kickStreams) {
          const key = (stream.channel_slug || stream.user_name || '').toLowerCase();
          if (seenStreamers.has(key)) continue;
          seenStreamers.add(key);

          allStreams.push({
            id: `kick_${stream.channel_slug}`,
            user_id: stream.channel_slug,
            user_name: stream.user_name || stream.channel_slug,
            game_name: stream.category_name || 'Unknown',
            title: stream.title,
            viewer_count: stream.viewer_count,
            started_at: stream.started_at,
            thumbnail_url: stream.thumbnail_url,
            tags: [],
            profile_image_url: undefined, // Kick doesn't provide profile images in same way
            platform: 'kick'
          });
        }

        console.log(`[Streams API] Kick: ${kickStreams.length} streams for ${serverId}`);
      } catch (error) {
        console.error('[Streams API] Kick error:', error);
      }
    }

    // Sort all streams by viewer count (descending)
    allStreams.sort((a, b) => b.viewer_count - a.viewer_count);

    const twitchCount = allStreams.filter(s => s.platform === 'twitch').length;
    const kickCount = allStreams.filter(s => s.platform === 'kick').length;
    console.log(`[Streams API] ${serverId} (${serverName}): Total ${allStreams.length} streams (Twitch: ${twitchCount}, Kick: ${kickCount})`);

    return NextResponse.json(allStreams);
  } catch (error) {
    console.error('[Streams API] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch streams' },
      { status: 500 }
    );
  }
}
