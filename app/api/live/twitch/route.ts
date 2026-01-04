import { NextRequest, NextResponse } from 'next/server';
import { getStreamSearchConfigMap, type StreamSearchConfig, type SearchType } from '@/lib/stream-config';
import { getAPICache } from '@/lib/api-cache';
import { getTwitchGameIds } from '@/lib/twitch-game-ids';
import { DEFAULT_TWITCH_STREAM_PAGE_LIMIT, getTwitchStreamPageLimit } from '@/lib/system-settings';

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

function getLatestTimestamp(servers: Record<string, TwitchServerData>): string {
  let latest = 0;
  for (const data of Object.values(servers)) {
    const parsed = Date.parse(data.lastUpdated);
    if (!Number.isNaN(parsed) && parsed > latest) {
      latest = parsed;
    }
  }

  return latest ? new Date(latest).toISOString() : new Date().toISOString();
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
 * Fetch live streams from Twitch for multiple games (limited pagination to reduce API load)
 */
async function fetchLiveStreamsFromGames(
  clientId: string,
  token: string,
  gameIds: string[],
  maxPages?: number
): Promise<TwitchStream[]> {
  const streams: TwitchStream[] = [];
  const pageLimit = typeof maxPages === 'number' && Number.isFinite(maxPages)
    ? Math.max(1, Math.min(maxPages, 75))
    : DEFAULT_TWITCH_STREAM_PAGE_LIMIT;
  
  for (const gameId of gameIds) {
    let cursor: string | null = null;
    let pageCount = 0;

    try {
      while (pageCount < pageLimit) {
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
  gameId: string,
  maxPages?: number
): Promise<TwitchStream[]> {
  return fetchLiveStreamsFromGames(clientId, token, [gameId], maxPages);
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

    const cache = getAPICache();
    const cacheKey = `twitch_streams_${serverIds.join(',')}`;
    const servers: Record<string, TwitchServerData> = {};
    const serversToFetch = new Set<string>();

    if (!bustCache) {
      for (const serverId of serverIds) {
        const cachedServer = await cache.get<TwitchServerData>('twitch_live_streams', serverId);
        if (cachedServer) {
          servers[serverId] = cachedServer;
        } else {
          serversToFetch.add(serverId);
        }
      }

      if (serversToFetch.size > 0) {
        const legacyCache = await cache.get<{ servers: Record<string, TwitchServerData> }>('twitch_live_streams', cacheKey);
        if (legacyCache?.servers) {
          for (const serverId of Array.from(serversToFetch)) {
            const legacyServer = legacyCache.servers[serverId];
            if (legacyServer) {
              servers[serverId] = legacyServer;
              serversToFetch.delete(serverId);
              // Backfill per-server cache for future requests
              await cache.set('twitch_live_streams', serverId, legacyServer);
            }
          }
        }
      }

      if (serversToFetch.size === 0) {
        const responseData = {
          servers,
          timestamp: getLatestTimestamp(servers)
        };
        await cache.set('twitch_live_streams', cacheKey, responseData);

        console.log('[LiveTwitch] Returning cached data for servers:', serverIds.join(', '));
        return NextResponse.json(responseData, {
          headers: {
            'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=60',
            'X-Cache': 'HIT',
          },
        });
      }
    } else {
      for (const serverId of serverIds) {
        serversToFetch.add(serverId);
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

    const serversToProcess = Array.from(serversToFetch);
    if (serversToProcess.length === 0) {
      console.log('[LiveTwitch] Returning cached data after cache reconciliation for servers:', serverIds.join(', '));
      const responseData = {
        servers,
        timestamp: getLatestTimestamp(servers),
      };
      await cache.set('twitch_live_streams', cacheKey, responseData);

      return NextResponse.json(responseData, {
        headers: {
          'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=60',
          'X-Cache': 'HIT',
        },
      });
    }

    // Load per-server search config from Supabase (no hardcoded mappings)
    if (bustCache) {
      console.log('[LiveTwitch] Cache bust requested - clearing stream config cache');
      const { clearStreamConfigCache } = await import('@/lib/stream-config');
      clearStreamConfigCache();
    }
    
    const rawConfig = await getStreamSearchConfigMap(serversToProcess, 'twitch');
    const configByServer = normalizeConfigMap(rawConfig);

    // Collect all unique category keywords from all servers (preserve original casing for Twitch API lookups)
    const categoryKeywordMap = new Map<string, string>(); // lower-case => original keyword
    for (const cfg of rawConfig.values()) {
      for (const row of cfg) {
        if (row.search_type !== 'category') continue;
        const originalKeyword = (row.search_keyword || '').trim();
        if (!originalKeyword) continue;
        const lowerKeyword = originalKeyword.toLowerCase();
        if (!categoryKeywordMap.has(lowerKeyword)) {
          categoryKeywordMap.set(lowerKeyword, originalKeyword);
        }
      }
    }

    // Always include GTA V as a default (case-insensitive dedupe)
    if (!categoryKeywordMap.has('grand theft auto v')) {
      categoryKeywordMap.set('grand theft auto v', 'Grand Theft Auto V');
    }

    const gamesToFetch = Array.from(categoryKeywordMap.values());
    
    console.log(`[LiveTwitch] Fetching streams from games: ${gamesToFetch.join(', ')}`);
    
    const gameIdMap = await getTwitchGameIds(clientId, token, gamesToFetch, { bustCache });
    // Dedupe game IDs (in case multiple category names resolve to the same game)
    const gameIds = [...new Set(Array.from(gameIdMap.values()))];

    if (gameIds.length === 0) {
      return NextResponse.json(
        { error: 'Failed to get any game IDs from Twitch' },
        { status: 500 }
      );
    }

    // Build response object for cache misses
    const fetchTimestamp = new Date().toISOString();

    // Fetch live streams from all configured games
    const twitchPageLimit = await getTwitchStreamPageLimit({ bustCache });
    const allStreams = await fetchLiveStreamsFromGames(clientId, token, gameIds, twitchPageLimit);
    console.log(`[LiveTwitch] Fetched ${allStreams.length} total streams from ${gameIds.length} games (page limit=${twitchPageLimit})`);

    // Normalize once for matching efficiency
    const normalized = allStreams.map(s => ({
      ...s,
      _titleLower: (s.title || '').toLowerCase(),
      _gameLower: (s.gameName || '').toLowerCase(),
      _tagsLower: Array.isArray(s.tags) ? s.tags.map(t => (t || '').toLowerCase()) : []
    }));

    for (const serverId of serversToProcess) {
      const cfg = configByServer.get(serverId) || [];
      if (cfg.length === 0) {
        const serverData: TwitchServerData = {
          streamCount: 0,
          viewerCount: 0,
          topStreams: [],
          lastUpdated: fetchTimestamp,
          error: 'No Twitch search config found for this server (stream_search_config)'
        };
        servers[serverId] = serverData;
        await cache.set('twitch_live_streams', serverId, serverData);
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

      const serverData: TwitchServerData = {
        streamCount: matches.length,
        viewerCount,
        topStreams,
        lastUpdated: fetchTimestamp
      };
      servers[serverId] = serverData;
      await cache.set('twitch_live_streams', serverId, serverData);
    }

    const responseData = {
      servers,
      timestamp: getLatestTimestamp(servers)
    };

    // Cache combined response for compatibility with existing tooling
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
