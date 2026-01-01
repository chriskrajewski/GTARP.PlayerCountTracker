import { NextRequest, NextResponse } from 'next/server';
import { getStreamSearchConfigMap, type StreamSearchConfig, type SearchType } from '@/lib/stream-config';

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
 * Get GTA V game ID from Twitch
 */
async function getGTAGameId(clientId: string, token: string): Promise<string | null> {
  try {
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
      return null;
    }

    const data = await response.json();
    return data.data?.[0]?.id || null;
  } catch (error) {
    console.error('Error getting GTA game ID:', error);
    return null;
  }
}

/**
 * Fetch live GTA V streams from Twitch (limited pagination to reduce API load)
 */
async function fetchLiveGTAVStreams(
  clientId: string,
  token: string,
  gameId: string
): Promise<TwitchStream[]> {
  const streams: TwitchStream[] = [];
  let cursor: string | null = null;
  const maxPages = 5; // Limit pagination to prevent excessive API calls
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
    console.error('Error fetching live Twitch streams:', error);
  }

  return streams;
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

    // Get GTA V game ID
    const gameId = await getGTAGameId(clientId, token);
    if (!gameId) {
      return NextResponse.json(
        { error: 'Failed to get GTA V game ID from Twitch' },
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

    // Build response object
    const servers: Record<string, TwitchServerData> = {};
    const timestamp = new Date().toISOString();

    // Fetch live GTA V streams once, then apply per-server filtering.
    const allStreams = await fetchLiveGTAVStreams(clientId, token, gameId);

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
      const titleKeywords: string[] = [];
      const categoryKeywords: string[] = [];
      const tagKeywords: string[] = [];

      for (const rule of cfg) {
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

      // Debug: Log filtering configuration
      console.log(`[LiveTwitch] ${serverId} - Filtering ${normalized.length} streams with:`);
      console.log(`  Title keywords: [${titleKeywords.join(', ')}]`);
      console.log(`  Category keywords: [${categoryKeywords.join(', ')}]`);
      console.log(`  Tag keywords: [${tagKeywords.join(', ')}]`);
      console.log(`  Logic: ${titleKeywords.length > 0 ? 'title' : ''}${titleKeywords.length > 0 && categoryKeywords.length > 0 ? ' AND ' : ''}${categoryKeywords.length > 0 ? 'category' : ''}${(titleKeywords.length > 0 || categoryKeywords.length > 0) && tagKeywords.length > 0 ? ' AND ' : ''}${tagKeywords.length > 0 ? 'tag' : ''}`);

      // De-dupe matched streams per server (a stream may match multiple keywords)
      const seen = new Set<string>();
      const matches: TwitchStream[] = [];
      let debugCount = 0;
      
      // Debug: Show sample of actual game names from Twitch
      if (normalized.length > 0) {
        const sampleGames = new Set(normalized.slice(0, 10).map(s => s._gameLower));
        console.log(`[LiveTwitch] Sample game names from Twitch (lowercase): [${Array.from(sampleGames).join(', ')}]`);
      }

      for (const s of normalized) {
        // Use AND logic between search types (all specified types must match)
        // Use OR logic within each search type (any keyword in that type can match)
        
        // Check title keywords (partial match) - OR within titles
        const titleMatch = titleKeywords.length === 0 || titleKeywords.some(k => s._titleLower.includes(k));
        
        // Check category keywords (exact match) - OR within categories
        const categoryMatch = categoryKeywords.length === 0 || categoryKeywords.some(k => s._gameLower === k);
        
        // Check tag keywords (exact match) - OR within tags
        const tagMatch = tagKeywords.length === 0 || tagKeywords.some(k => s._tagsLower.includes(k));
        
        // Debug first 3 matches and first 3 non-matches
        if (debugCount < 6) {
          const willMatch = titleMatch && categoryMatch && tagMatch;
          if (willMatch || debugCount < 3) {
            console.log(`[LiveTwitch] ${willMatch ? '✓' : '✗'} "${s.name}" - "${s.title.substring(0, 50)}..." | game:"${s.gameName}" (lower:"${s._gameLower}") | title:${titleMatch} cat:${categoryMatch} tag:${tagMatch}`);
            debugCount++;
          }
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

    return NextResponse.json({
      servers,
      timestamp
    }, {
      headers: {
        // Allow caching for 30 seconds to reduce API load
        'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=60'
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
