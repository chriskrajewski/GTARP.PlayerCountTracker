import { NextRequest, NextResponse } from 'next/server';
import {
  getKickStreamsByCategoryQuery,
  getKickTopStreams,
  isKickApiConfigured,
  type KickStreamData
} from '@/lib/kick-api';
import { getStreamSearchConfigByPlatform, getKickSupportedServers } from '@/lib/stream-config';

/**
 * Live Kick.com Stream Data API
 * 
 * Fetches real-time Kick.com stream data based on stream_search_config from Supabase.
 * All configuration is dynamic - NO hardcoded server mappings or keywords.
 * This provides instant data updates for Kick streams.
 * 
 * Query Parameters:
 * - serverIds: Comma-separated list of server IDs (required for multi-server mode)
 * - serverId: Single server ID (legacy support, use serverIds instead)
 * - format: Response format - 'full' for detailed streams, 'stats' for summary only (default: 'stats')
 * 
 * IMPORTANT: Streams are filtered by each server's title keywords from stream_search_config.
 * This ensures each server only shows Kick streams that match their specific keywords.
 * 
 * Response Format (with serverIds):
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
 * 
 * Response Format (legacy single serverId):
 * {
 *   streamCount: number,
 *   viewerCount: number,
 *   topStreams: Array<{ name: string, viewers: number, title: string }>,
 *   lastUpdated: string (ISO timestamp)
 * }
 */

// NOTE: Stream filtering is done inline in the GET handler for better control
// over include/exclude keyword logic. No separate filterStreamsByKeywords function needed.

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

interface KickServerData {
  streamCount: number;
  viewerCount: number;
  topStreams: Array<{ name: string; viewers: number; title: string }>;
  lastUpdated: string;
  error?: string;
}

/**
 * Fetch Kick streams for a single server
 */
async function fetchKickStreamsForServer(serverId: string): Promise<KickServerData> {
  const timestamp = new Date().toISOString();
  
  // Check if server supports Kick
  const kickSupportedServers = await getKickSupportedServers();
  if (!kickSupportedServers.includes(serverId)) {
    return {
      streamCount: 0,
      viewerCount: 0,
      topStreams: [],
      lastUpdated: timestamp,
      error: 'Kick streams not available for this server'
    };
  }
  
  // Load server-specific Kick config (Supabase-driven)
  const config = await getStreamSearchConfigByPlatform(serverId, 'kick');
  if (!config.length) {
    return {
      streamCount: 0,
      viewerCount: 0,
      topStreams: [],
      lastUpdated: timestamp,
      error: 'Kick streams not available for this server'
    };
  }

  // Kick supports category-based fetch; for title-based we filter a global/top listing.
  // We merge results from all active rules and de-dupe by channel slug.
  const seen = new Set<string>();
  const merged: KickStreamData[] = [];

  const categoryRules = config.filter(c => c.search_type === 'category');
  const titleRules = config.filter(c => c.search_type === 'title');

  // Build a candidate pool.
  // - If category rules exist, union streams from those categories.
  // - Otherwise, use the global top listing as a fallback pool.
  let poolStreams: KickStreamData[] = [];
  if (categoryRules.length) {
    const poolSeen = new Set<string>();
    for (const rule of categoryRules) {
      const keyword = (rule.search_keyword || '').trim().toLowerCase();
      if (!keyword) continue;

      // Fetch streams for this category (caching is handled in kick-api.ts)
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

  // If there are no include keywords, we can't do per-server filtering reliably.
  // Return empty rather than misleading global category totals.
  if (include.length === 0) {
    console.warn(`[Kick API] No include keywords for ${serverId}; returning 0 to avoid unscoped results.`);
  } else {
    // Keep streams that match any include keyword and none of the exclude keywords.
    for (const s of poolStreams) {
      const title = (s.title || '').toLowerCase();
      if (!include.some(k => title.includes(k))) continue;
      if (exclude.length && exclude.some(k => title.includes(k))) continue;

      const key = (s.channel_slug || s.user_name || '').toLowerCase();
      if (!key || seen.has(key)) continue;
      seen.add(key);
      merged.push(s);
    }
  }

  const filteredStreams = merged;
  const keywordsDebug = config.map(c => `${c.search_type}:${c.search_keyword}`).join(', ');
  console.log(`[Kick API] Server ${serverId}: matched ${filteredStreams.length} streams using config: ${keywordsDebug}`);
  if (filteredStreams.length > 200) {
    console.warn(`[Kick API] High Kick match count for ${serverId}: ${filteredStreams.length}. Config=${keywordsDebug}`);
  }

  return {
    streamCount: filteredStreams.length,
    viewerCount: filteredStreams.reduce((sum, s) => sum + s.viewer_count, 0),
    topStreams: filteredStreams.slice(0, 5).map(s => ({
      name: s.user_name,
      viewers: s.viewer_count,
      title: s.title
    })),
    lastUpdated: timestamp
  };
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const serverIdsParam = searchParams.get('serverIds');
    const serverId = searchParams.get('serverId'); // Legacy support
    const format = searchParams.get('format') || 'stats';

    // Check if Kick API is configured
    if (!isKickApiConfigured()) {
      const emptyResponse = serverIdsParam 
        ? { servers: {}, timestamp: new Date().toISOString() }
        : {
            streamCount: 0,
            viewerCount: 0,
            topStreams: [],
            lastUpdated: new Date().toISOString(),
            error: 'Kick API not configured'
          };
      
      return NextResponse.json(emptyResponse, { 
        status: 200, // Return 200 with empty data instead of 500
        headers: {
          'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=120'
        }
      });
    }

    const timestamp = new Date().toISOString();

    // Multi-server mode (preferred)
    if (serverIdsParam) {
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

      // Fetch data for all servers in parallel
      const serverDataPromises = serverIds.map(async (id) => {
        const data = await fetchKickStreamsForServer(id);
        return { serverId: id, data };
      });

      const results = await Promise.all(serverDataPromises);

      // Build response object
      const servers: Record<string, KickServerData> = {};
      results.forEach(({ serverId, data }) => {
        servers[serverId] = data;
      });

      return NextResponse.json({
        servers,
        timestamp
      }, {
        headers: {
          'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=60'
        }
      });
    }

    // Legacy single-server mode
    if (serverId) {
      const data = await fetchKickStreamsForServer(serverId);

      // Return stats-only format (default for API compatibility)
      if (format === 'stats') {
        return NextResponse.json({
          streamCount: data.streamCount,
          viewerCount: data.viewerCount,
          topStreams: data.topStreams,
          lastUpdated: data.lastUpdated,
          ...(data.error && { error: data.error })
        }, {
          headers: {
            'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=60'
          }
        });
      }

      // Full format would require fetching full stream data
      // For now, return stats format
      return NextResponse.json({
        streamCount: data.streamCount,
        viewerCount: data.viewerCount,
        topStreams: data.topStreams,
        lastUpdated: data.lastUpdated,
        ...(data.error && { error: data.error })
      }, {
        headers: {
          'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=60'
        }
      });
    }

    // No serverId/serverIds: return empty
    console.warn('[Kick API] No serverId or serverIds provided - returning empty data.');
    return NextResponse.json(
      serverIdsParam 
        ? { servers: {}, timestamp }
        : {
            streamCount: 0,
            viewerCount: 0,
            topStreams: [],
            lastUpdated: timestamp,
            error: 'serverId or serverIds parameter is required'
          },
      {
        status: 200,
        headers: {
          'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=120'
        }
      }
    );
  } catch (error) {
    console.error('[Kick API Route] Error:', error);
    
    const timestamp = new Date().toISOString();
    // Return empty data on error instead of failing
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Failed to fetch Kick streams',
        servers: {},
        timestamp
      },
      { 
        status: 200, // Return 200 with error info, not 500
        headers: {
          'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=120'
        }
      }
    );
  }
}
