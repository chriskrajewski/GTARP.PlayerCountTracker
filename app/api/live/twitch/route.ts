import { NextRequest, NextResponse } from 'next/server';
import { getStreamSearchConfigMap, type StreamSearchConfig, type SearchType } from '@/lib/stream-config';
import { getAPICache } from '@/lib/api-cache';

/**
 * Live Twitch Stream Data API
 * 
 * Fetches real-time Twitch stream counts and viewer data directly from the Twitch API.
 * This bypasses Supabase to provide instant data updates, not limited by ETL intervals.
 * 
 * Query Parameters:
 * - serverIds: Comma-separated list of server IDs (required)
 * 
 * Response Format:
 * {
 *   servers: {
 *     [serverId]: {
 *       streamCount: number,
 *       viewerCount: number,
 *       topStreams: Array<{ name: string, viewers: number, title: string }>,
 *       lastUpdated: string (ISO timestamp)
 *     }
 *   },
 *   timestamp: string (ISO timestamp)
 * }
 */

interface TwitchStream {
  name: string;
  viewers: number;
  title: string;
  profileImage?: string;
  gameName?: string;
  tags?: string[];
}

interface TwitchServerData {
  streamCount: number;
  viewerCount: number;
  topStreams: TwitchStream[];
  lastUpdated: string;
  error?: string;
}

/**
 * Get Twitch OAuth token
 */
async function getTwitchToken(): Promise<string | null> {
  const clientId = process.env.TWITCH_CLIENT_ID;
  const clientSecret = process.env.TWITCH_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    console.error('Twitch credentials not configured');
    return null;
  }

  try {
    const response = await fetch('https://id.twitch.tv/oauth2/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `client_id=${clientId}&client_secret=${clientSecret}&grant_type=client_credentials`,
      signal: AbortSignal.timeout(10000)
    });

    if (!response.ok) {
      console.error('Failed to get Twitch token:', response.status);
      return null;
    }

    const data = await response.json();
    return data.access_token;
  } catch (error) {
    console.error('Error getting Twitch token:', error);
    return null;
  }
}

/**
 * Get game IDs from Twitch by name
 */
async function getGameIds(clientId: string, token: string, gameNames: string[]): Promise<Map<string, string>> {
  const gameMap = new Map<string, string>();
  
  try {
    for (const gameName of gameNames) {
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
        console.warn(`Failed to get game ID for "${gameName}": ${response.status}`);
        continue;
      }

      const data = await response.json();
      const gameId = data.data?.[0]?.id;
      if (gameId) {
        gameMap.set(gameName, gameId);
        console.log(`[LiveTwitch] Got game ID for "${gameName}": ${gameId}`);
      }
    }
  } catch (error) {
    console.error('Error getting game IDs:', error);
  }

  return gameMap;
}

/**
 * Get GTA V game ID from Twitch (legacy, kept for compatibility)
 */
async function getGTAGameId(clientId: string, token: string): Promise<string | null> {
  const gameMap = await getGameIds(clientId, token, ['Grand Theft Auto V']);
  return gameMap.get('Grand Theft Auto V') || null;
}

/**
 * Fetch live streams from Twitch for multiple games (limited pagination to reduce API load)
 */
async function fetchLiveStreamsFromGames(
  clientId: string,
  token: string,
  gameIds: string[]
): Promise<TwitchStream[]> {
  const streams: TwitchStream[] = [];
  const maxPages = 20; // Increased to capture more streams (up to 2000 per game)
  
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
          break;
        }

        const data = await response.json();
        const batch = Array.isArray(data.data) ? data.data : [];

        for (const stream of batch) {
          const tags = Array.isArray(stream.tags) ? stream.tags : (Array.isArray(stream.tag_ids) ? [] : []);
          streams.push({
            name: stream.user_name,
            viewers: stream.viewer_count,
            title: stream.title,
            gameName: stream.game_name,
            tags
          });
        }

        cursor = data.pagination?.cursor || null;
        if (!cursor) break;
        pageCount++;
      }
    } catch (error) {
      console.error(`Error fetching live Twitch streams for game ${gameId}:`, error);
    }
  }

  return streams;
}

/**
 * Fetch live GTA V streams from Twitch (limited pagination to reduce API load)
 * Legacy function - kept for compatibility
 */
async function fetchLiveGTAVStreams(
  clientId: string,
  token: string,
  gameId: string
): Promise<TwitchStream[]> {
  return fetchLiveStreamsFromGames(clientId, token, [gameId]);
}

/**
 * Load per-server Twitch search configuration from Supabase.
 * IMPORTANT: This must come from Supabase (no hardcoded server mappings).
 */
function normalizeConfigMap(map: Map<string, StreamSearchConfig[]>): Map<string, Array<Pick<StreamSearchConfig, 'search_keyword' | 'search_type'>>> {
  const result = new Map<string, Array<Pick<StreamSearchConfig, 'search_keyword' | 'search_type'>>>();

  for (const [serverId, rows] of map.entries()) {
    const rules = rows
      .map(row => ({
        search_keyword: (row.search_keyword || '').trim().toLowerCase(),
        search_type: row.search_type as SearchType
      }))
      .filter(rule => rule.search_keyword.length > 0);

    result.set(serverId, rules);
  }

  return result;
}

// (Intentionally no extra helpers here — matching is done in a tight loop below for efficiency.)

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const serverIdsParam = searchParams.get('serverIds');
    const bustCache = searchParams.get('bustCache') === 'true';

    if (!serverIdsParam) {
      return NextResponse.json(
        { error: 'serverIds parameter is required' },
        { status: 400 }
      );
    }

    const serverIds = Array.from(new Set(
      serverIdsParam
        .split(',')
        .map(id => id.trim())
        .filter(Boolean)
    ));

    if (serverIds.length === 0) {
      return NextResponse.json(
        { error: 'At least one server ID is required' },
        { status: 400 }
      );
    }

    // Limit to prevent abuse
    if (serverIds.length > 20) {
      return NextResponse.json(
        { error: 'Maximum 20 servers per request' },
        { status: 400 }
      );
    }

    // Check cache first
    const cache = getAPICache();
    const cacheKey = `twitch_streams_${serverIds.join(',')}`;
    
    if (!bustCache) {
      const cachedData = await cache.get('twitch_live_streams', cacheKey);
      if (cachedData) {
        console.log('[LiveTwitch] Returning cached data for servers:', serverIds.join(', '));
        return NextResponse.json(cachedData, {
          headers: {
            'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=60',
            'X-Cache': 'HIT',
          },
        });
      }
    }

    // Get Twitch authentication
    const clientId = process.env.TWITCH_CLIENT_ID;
    if (!clientId) {
      return NextResponse.json(
        { error: 'Twitch credentials not configured' },
        { status: 500 }
      );
    }

    const token = await getTwitchToken();
    if (!token) {
      return NextResponse.json(
        { error: 'Failed to authenticate with Twitch' },
        { status: 500 }
      );
    }

    // Load per-server search config from Supabase (no hardcoded mappings)
    if (bustCache) {
      console.log('[LiveTwitch] Cache bust requested - clearing stream config cache');
      const { clearStreamConfigCache } = await import('@/lib/stream-config');
      clearStreamConfigCache();
    }
    
    const rawConfig = await getStreamSearchConfigMap(serverIds, 'twitch');
    const configByServer = normalizeConfigMap(rawConfig);

    // Collect all unique category keywords from all servers
    const allCategoryKeywords = new Set<string>();
    for (const cfg of configByServer.values()) {
      for (const rule of cfg) {
        if (rule.search_type === 'category') {
          allCategoryKeywords.add(rule.search_keyword);
        }
      }
    }

    // Get game IDs for all categories mentioned in config
    // Always include GTA V as a default, but dedupe with config categories
    const allCategoryKeywordsLower = new Set(Array.from(allCategoryKeywords).map(k => k.toLowerCase()));
    const gamesToFetch: string[] = [];
    
    // Add GTA V if not already in config (case-insensitive check)
    if (!allCategoryKeywordsLower.has('grand theft auto v')) {
      gamesToFetch.push('Grand Theft Auto V');
    }
    
    // Add all category keywords from config
    gamesToFetch.push(...Array.from(allCategoryKeywords));
    
    console.log(`[LiveTwitch] Fetching streams from games: ${gamesToFetch.join(', ')}`);
    
    const gameIdMap = await getGameIds(clientId, token, gamesToFetch);
    // Dedupe game IDs (in case multiple category names resolve to the same game)
    const gameIds = [...new Set(Array.from(gameIdMap.values()))];

    if (gameIds.length === 0) {
      return NextResponse.json(
        { error: 'Failed to get any game IDs from Twitch' },
        { status: 500 }
      );
    }

    // Build response object
    const servers: Record<string, TwitchServerData> = {};
    const timestamp = new Date().toISOString();

    // Fetch live streams from all configured games
    const allStreams = await fetchLiveStreamsFromGames(clientId, token, gameIds);
    console.log(`[LiveTwitch] Fetched ${allStreams.length} total streams from ${gameIds.length} games`);

    // Normalize once for matching efficiency
    const normalized = allStreams.map(s => ({
      ...s,
      _titleLower: (s.title || '').toLowerCase(),
      _gameLower: (s.gameName || '').toLowerCase(),
      _tagsLower: Array.isArray(s.tags) ? s.tags.map(t => (t || '').toLowerCase()) : []
    }));

    for (const serverId of serverIds) {
      const cfg = configByServer.get(serverId) || [];
      if (cfg.length === 0) {
        servers[serverId] = {
          streamCount: 0,
          viewerCount: 0,
          topStreams: [],
          lastUpdated: timestamp,
          error: 'No Twitch search config found for this server (stream_search_config)'
        };
        continue;
      }

      // Pre-group rules by search type for efficient matching (same approach as /api/streams/[serverId])
      // Supports # prefix for exclude keywords (e.g., #nopixel excludes streams with "nopixel" in title)
      const titleInclude: string[] = [];
      const titleExclude: string[] = [];
      const categoryInclude: string[] = [];
      const categoryExclude: string[] = [];
      const tagInclude: string[] = [];
      const tagExclude: string[] = [];

      for (const rule of cfg) {
        const keyword = (rule.search_keyword || '').trim().toLowerCase();
        if (!keyword) continue;

        // Check if this is an exclude keyword (starts with #)
        const isExclude = keyword.startsWith('#') && keyword.length > 1;
        const cleanKeyword = isExclude ? keyword.slice(1) : keyword;

        switch (rule.search_type) {
          case 'title':
            if (isExclude) {
              titleExclude.push(cleanKeyword);
            } else {
              titleInclude.push(cleanKeyword);
            }
            break;
          case 'category':
            if (isExclude) {
              categoryExclude.push(cleanKeyword);
            } else {
              categoryInclude.push(cleanKeyword);
            }
            break;
          case 'tag':
            if (isExclude) {
              tagExclude.push(cleanKeyword);
            } else {
              tagInclude.push(cleanKeyword);
            }
            break;
        }
      }

      // Debug: Log filtering configuration
      console.log(`[LiveTwitch] ${serverId} - Filtering ${normalized.length} streams with:`);
      console.log(`  Title: include=[${titleInclude.join(', ')}], exclude=[${titleExclude.join(', ')}]`);
      console.log(`  Category: include=[${categoryInclude.join(', ')}], exclude=[${categoryExclude.join(', ')}]`);;

      // De-dupe matched streams per server (a stream may match multiple keywords)
      const seen = new Set<string>();
      const matches: TwitchStream[] = [];

      for (const s of normalized) {
        // Use AND logic between search types (all specified types must match)
        // Use OR logic within each search type (any keyword in that type can match)
        // Exclude keywords filter out streams that match them
        
        // Title matching: include must match (if any), exclude must not match
        let titleMatch = true;
        if (titleInclude.length > 0) {
          titleMatch = titleInclude.some(k => s._titleLower.includes(k));
        }
        if (titleMatch && titleExclude.length > 0) {
          titleMatch = !titleExclude.some(k => s._titleLower.includes(k));
        }
        
        // Category matching (exact match)
        let categoryMatch = true;
        if (categoryInclude.length > 0) {
          categoryMatch = categoryInclude.some(k => s._gameLower === k);
        }
        if (categoryMatch && categoryExclude.length > 0) {
          categoryMatch = !categoryExclude.some(k => s._gameLower === k);
        }
        
        // Tag matching (exact match)
        let tagMatch = true;
        if (tagInclude.length > 0) {
          tagMatch = tagInclude.some(k => s._tagsLower.includes(k));
        }
        if (tagMatch && tagExclude.length > 0) {
          tagMatch = !tagExclude.some(k => s._tagsLower.includes(k));
        }
        
        // ALL specified search types must match (AND logic between types)
        if (!titleMatch || !categoryMatch || !tagMatch) continue;

        // Use streamer name as stable identifier within the GTA V listing.
        const key = (s.name || '').toLowerCase();
        if (!key || seen.has(key)) continue;
        seen.add(key);
        matches.push({ name: s.name, viewers: s.viewers, title: s.title, gameName: s.gameName, tags: s.tags });
      }

      console.log(`[LiveTwitch] ${serverId} - Matched ${matches.length} streams from ${normalized.length} total`);
      
      if (matches.length > 200) {
        console.warn(`[LiveTwitch] High Twitch match count for ${serverId}: ${matches.length}. Keywords=${cfg.map(r => `${r.search_type}:${r.search_keyword}`).join(', ')}`);
      }

      const viewerCount = matches.reduce((sum, s) => sum + s.viewers, 0);
      const topStreams = matches
        .slice()
        .sort((a, b) => b.viewers - a.viewers)
        .slice(0, 5);

      servers[serverId] = {
        streamCount: matches.length,
        viewerCount,
        topStreams,
        lastUpdated: timestamp
      };
    }

    const responseData = {
      servers,
      timestamp
    };

    // Cache the response
    await cache.set('twitch_live_streams', cacheKey, responseData);

    return NextResponse.json(responseData, {
      headers: {
        // Allow caching for 30 seconds to reduce API load
        'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=60',
        'X-Cache': 'MISS',
      }
    });
  } catch (error) {
    console.error('Error in live Twitch API:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch live Twitch data' },
      { status: 500 }
    );
  }
}
