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
 * - serverId: Server ID to fetch streams for (filters by server's title keywords)
 * - format: Response format - 'full' for detailed streams, 'stats' for summary only (default: 'full')
 * 
 * IMPORTANT: When serverId is provided, streams are filtered by that server's
 * title keywords from stream_search_config. This ensures each server only shows
 * Kick streams that match their specific keywords.
 * 
 * Response Format (full):
 * {
 *   streams: KickStreamData[],
 *   cached: boolean,
 *   timestamp: string (ISO timestamp)
 * }
 * 
 * Response Format (stats):
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

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const serverId = searchParams.get('serverId');
    const format = searchParams.get('format') || 'full';

    // Check if Kick API is configured
    if (!isKickApiConfigured()) {
      return NextResponse.json(
        { 
          error: 'Kick API not configured',
          streams: [],
          streamCount: 0,
          viewerCount: 0
        },
        { 
          status: 200, // Return 200 with empty data instead of 500
          headers: {
            'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=120'
          }
        }
      );
    }

    const timestamp = new Date().toISOString();
    
    // If serverId is provided, filter by server-specific keywords
    let filteredStreams: KickStreamData[] = [];
    
    if (serverId) {
      // Check if server supports Kick
      const kickSupportedServers = await getKickSupportedServers();
      if (!kickSupportedServers.includes(serverId)) {
        // Server doesn't support Kick streams - return empty data
        return NextResponse.json(
          {
            streams: [],
            streamCount: 0,
            viewerCount: 0,
            message: 'Kick streams not available for this server',
            timestamp
          },
          {
            headers: {
              'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600'
            }
          }
        );
      }
      
      // Load server-specific Kick config (Supabase-driven)
      const config = await getStreamSearchConfigByPlatform(serverId, 'kick');
      if (!config.length) {
        return NextResponse.json(
          {
            streams: [],
            streamCount: 0,
            viewerCount: 0,
            message: 'Kick streams not available for this server',
            timestamp
          },
          {
            headers: {
              'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600'
            }
          }
        );
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
        filteredStreams = [];
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
        filteredStreams = merged;
      }

      const keywordsDebug = config.map(c => `${c.search_type}:${c.search_keyword}`).join(', ');
      console.log(`[Kick API] Server ${serverId}: matched ${filteredStreams.length} streams using config: ${keywordsDebug}`);
      if (filteredStreams.length > 200) {
        console.warn(`[Kick API] High Kick match count for ${serverId}: ${filteredStreams.length}. Config=${keywordsDebug}`);
      }
    } else {
      // No serverId: return empty - serverId is REQUIRED to use stream_search_config
      // This ensures all streams are filtered by server-specific configuration
      console.warn('[Kick API] No serverId provided - returning empty streams. serverId is required to use stream_search_config.');
      filteredStreams = [];
    }

    // Return stats-only format
    if (format === 'stats') {
      return NextResponse.json({
        streamCount: filteredStreams.length,
        viewerCount: filteredStreams.reduce((sum, s) => sum + s.viewer_count, 0),
        topStreams: filteredStreams.slice(0, 5).map(s => ({
          name: s.user_name,
          viewers: s.viewer_count,
          title: s.title
        })),
        lastUpdated: timestamp
      }, {
        headers: {
          'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=60'
        }
      });
    }

    // Return full stream data
    return NextResponse.json(
      {
        streams: filteredStreams,
        streamCount: filteredStreams.length,
        viewerCount: filteredStreams.reduce((sum, s) => sum + s.viewer_count, 0),
        cached: false, // The lib handles caching internally
        timestamp
      },
      {
        headers: {
          // Allow caching for 30 seconds to reduce API load
          'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=60'
        }
      }
    );
  } catch (error) {
    console.error('[Kick API Route] Error:', error);
    
    // Return empty data on error instead of failing
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Failed to fetch Kick streams',
        streams: [],
        streamCount: 0,
        viewerCount: 0,
        timestamp: new Date().toISOString()
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
