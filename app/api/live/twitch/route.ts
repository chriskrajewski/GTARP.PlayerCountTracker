import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase-server';

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

// Server ID to search keyword mapping (same as edge function)
const SEARCH_CONFIG: Record<string, string> = {
  'o3re8y': 'unscripted',
  '46pb7q': 'onx',
  '3lamjz': 'nopixel',
  '9mxzbe': 'prodigy',
  'l7o9o4': 'district 10',
  '7pkv5d': 'SmileRP',
  'k8px4v': 'Time2RP',
  'vqkmaq': 'unscripted public',
  'wmev57': 'newdayrp',
  '77qvev': 'rebirth',
  'r8q73g': 'nopixel public',
  '775kda': 'prodigy public',
  '68oab8': 'echorp',
  'ak44p9': 'free2rp',
  'zx57jp': 'nopixel',  // Additional server mappings
  'ypq96k': 'nopixel',
  '6j7je6': 'nopixel'
};

interface TwitchStream {
  name: string;
  viewers: number;
  title: string;
  profileImage?: string;
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
 * Fetch streams matching a keyword from Twitch
 */
async function fetchStreamsForKeyword(
  clientId: string,
  token: string,
  gameId: string,
  keyword: string
): Promise<TwitchStream[]> {
  const lowerKeyword = keyword.toLowerCase().trim();
  if (!lowerKeyword) return [];

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
        const title = (stream.title || '').toLowerCase();
        if (title.includes(lowerKeyword)) {
          streams.push({
            name: stream.user_name,
            viewers: stream.viewer_count,
            title: stream.title
          });
        }
      }

      cursor = data.pagination?.cursor || null;
      if (!cursor) break;
      pageCount++;
    }
  } catch (error) {
    console.error(`Error fetching streams for keyword "${keyword}":`, error);
  }

  return streams;
}

/**
 * Get server names from database
 */
async function getServerKeywords(serverIds: string[]): Promise<Map<string, string>> {
  const keywordMap = new Map<string, string>();

  // First use the static config
  serverIds.forEach(serverId => {
    if (SEARCH_CONFIG[serverId]) {
      keywordMap.set(serverId, SEARCH_CONFIG[serverId]);
    }
  });

  // Try to get any additional mappings from database if needed
  // (This could be extended to use a database table for dynamic keyword mappings)

  return keywordMap;
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const serverIdsParam = searchParams.get('serverIds');

    if (!serverIdsParam) {
      return NextResponse.json(
        { error: 'serverIds parameter is required' },
        { status: 400 }
      );
    }

    const serverIds = serverIdsParam
      .split(',')
      .map(id => id.trim())
      .filter(Boolean);

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

    // Get keyword mappings for servers
    const keywordMap = await getServerKeywords(serverIds);

    // Build response object
    const servers: Record<string, TwitchServerData> = {};
    const timestamp = new Date().toISOString();

    // Group servers by keyword to reduce API calls
    const keywordToServers = new Map<string, string[]>();
    serverIds.forEach(serverId => {
      const keyword = keywordMap.get(serverId);
      if (keyword) {
        const existing = keywordToServers.get(keyword) || [];
        existing.push(serverId);
        keywordToServers.set(keyword, existing);
      } else {
        // No keyword mapping - return empty data
        servers[serverId] = {
          streamCount: 0,
          viewerCount: 0,
          topStreams: [],
          lastUpdated: timestamp,
          error: 'No keyword mapping for this server'
        };
      }
    });

    // Fetch streams for each unique keyword
    const keywordPromises = Array.from(keywordToServers.entries()).map(
      async ([keyword, relatedServerIds]) => {
        const streams = await fetchStreamsForKeyword(clientId, token, gameId, keyword);
        
        // Calculate totals
        const streamCount = streams.length;
        const viewerCount = streams.reduce((sum, s) => sum + s.viewers, 0);
        
        // Get top 5 streams by viewer count
        const topStreams = streams
          .sort((a, b) => b.viewers - a.viewers)
          .slice(0, 5);

        // Apply to all servers with this keyword
        relatedServerIds.forEach(serverId => {
          servers[serverId] = {
            streamCount,
            viewerCount,
            topStreams,
            lastUpdated: timestamp
          };
        });
      }
    );

    await Promise.all(keywordPromises);

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
