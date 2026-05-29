import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

/**
 * Live FiveM Server Data API
 * 
 * Fetches real-time player counts and server capacity directly from the FiveM API.
 * This bypasses Supabase to provide instant data updates, not limited by ETL intervals.
 * 
 * Query Parameters:
 * - serverIds: Comma-separated list of server IDs (required)
 * 
 * Response Format:
 * {
 *   servers: {
 *     [serverId]: {
 *       currentPlayers: number,
 *       maxCapacity: number,
 *       serverName: string,
 *       online: boolean,
 *       lastUpdated: string (ISO timestamp)
 *     }
 *   },
 *   timestamp: string (ISO timestamp)
 * }
 */

const FIVEM_API_BASE = 'https://frontend.cfx-services.net/api/servers/single/';

// Request headers to mimic browser requests
const FIVEM_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
  'Accept': 'application/json, text/plain, */*',
  'Accept-Language': 'en-US,en;q=0.9',
  'Referer': 'https://servers.fivem.net/',
  'Origin': 'https://servers.fivem.net'
};

// Cache configuration
const CACHE_TTL_MS = 15_000; // fresh cache window to reduce upstream calls
const STALE_FALLBACK_MS = 2 * 60_000; // allow stale data for 2 minutes when upstream fails
const LIVE_CACHE_MAX_ENTRIES = 100;
const LIVE_CACHE_CLEANUP_INTERVAL_MS = 5 * 60_000;

type CacheStatus = 'live' | 'cache-hit' | 'cache-fallback';

interface CacheEntry {
  data: FiveMServerData;
  fetchedAt: number;
  lastNonZeroPlayers?: number; // Track last non-zero player count
}

const liveCache = new Map<string, CacheEntry>();
const pendingRequests = new Map<string, Promise<ServerDataResult>>();
let lastLiveCacheCleanup = 0;

interface FiveMServerData {
  currentPlayers: number;
  maxCapacity: number;
  serverName: string;
  online: boolean;
  lastUpdated: string;
  error?: string;
}

interface ServerDataResult {
  data: FiveMServerData;
  cacheStatus: CacheStatus;
}

interface ServerXref {
  server_id: string;
  server_name: string;
}

/**
 * Get a cached entry if it is within the allowed age
 */
function getCachedData(serverId: string, maxAgeMs: number): FiveMServerData | null {
  maybeCleanupLiveCache();
  const entry = liveCache.get(serverId);
  if (!entry) return null;

  const age = Date.now() - entry.fetchedAt;

  if (age <= maxAgeMs) {
    touchLiveCacheEntry(serverId, entry);
    return entry.data;
  }

  // Drop long-stale entries to keep the cache tidy
  if (age > STALE_FALLBACK_MS) {
    liveCache.delete(serverId);
  }

  return null;
}

function setCachedData(serverId: string, data: FiveMServerData) {
  // Preserve last non-zero player count for fallback when API returns 0
  const existingEntry = liveCache.get(serverId);
  const lastNonZeroPlayers = data.currentPlayers > 0 
    ? data.currentPlayers 
    : existingEntry?.lastNonZeroPlayers;
  
  const entry = { 
    data, 
    fetchedAt: Date.now(),
    lastNonZeroPlayers
  };
  liveCache.delete(serverId);
  liveCache.set(serverId, entry);
  enforceLiveCacheLimit();
}

function touchLiveCacheEntry(serverId: string, entry: CacheEntry) {
  liveCache.delete(serverId);
  liveCache.set(serverId, entry);
}

function enforceLiveCacheLimit() {
  while (liveCache.size > LIVE_CACHE_MAX_ENTRIES) {
    const oldestKey = liveCache.keys().next().value;
    if (!oldestKey) break;
    liveCache.delete(oldestKey);
  }
}

function cleanupLiveCache() {
  const now = Date.now();
  for (const [key, entry] of liveCache.entries()) {
    if (now - entry.fetchedAt > STALE_FALLBACK_MS) {
      liveCache.delete(key);
    }
  }
  enforceLiveCacheLimit();
}

function maybeCleanupLiveCache() {
  const now = Date.now();
  if (now - lastLiveCacheCleanup >= LIVE_CACHE_CLEANUP_INTERVAL_MS) {
    cleanupLiveCache();
    lastLiveCacheCleanup = now;
  }
}

/**
 * Fetch live data for a single FiveM server
 */
async function fetchServerData(serverId: string): Promise<FiveMServerData> {
  try {
    const response = await fetch(`${FIVEM_API_BASE}${serverId}`, {
      headers: FIVEM_HEADERS,
      cache: 'no-store',
      next: { revalidate: 0 },
      // Short timeout to prevent blocking
      signal: AbortSignal.timeout(10000)
    });

    if (!response.ok) {
      return {
        currentPlayers: 0,
        maxCapacity: 0,
        serverName: `Server ${serverId}`,
        online: false,
        lastUpdated: new Date().toISOString(),
        error: `HTTP ${response.status}`
      };
    }

    const data = await response.json();
    
    // Extract player count from multiple possible sources
    const currentPlayers = data?.Data?.selfReportedClients || 0;
    
    // Extract max capacity from multiple possible sources for robustness
    let maxCapacity = 0;
    if (data?.Data?.vars?.sv_maxClients) {
      maxCapacity = parseInt(data.Data.vars.sv_maxClients, 10) || 0;
    } else if (typeof data?.Data?.svMaxclients === 'number') {
      maxCapacity = data.Data.svMaxclients;
    } else if (typeof data?.Data?.sv_maxclients === 'number') {
      maxCapacity = data.Data.sv_maxclients;
    }

    // Extract server name from API or use fallback
    const serverName = data?.Data?.hostname || 
                       data?.Data?.vars?.sv_projectName || 
                       `Server ${serverId}`;

    return {
      currentPlayers,
      maxCapacity,
      serverName,
      online: true,
      lastUpdated: new Date().toISOString()
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error(`Error fetching FiveM data for server ${serverId}:`, errorMessage);
    
    return {
      currentPlayers: 0,
      maxCapacity: 0,
      serverName: `Server ${serverId}`,
      online: false,
      lastUpdated: new Date().toISOString(),
      error: errorMessage
    };
  }
}

/**
 * Fetch live data with caching and stale fallback to prevent UI dropouts
 */
async function getServerDataWithCache(serverId: string): Promise<ServerDataResult> {
  const freshCache = getCachedData(serverId, CACHE_TTL_MS);
  if (freshCache) {
    return { data: freshCache, cacheStatus: 'cache-hit' };
  }

  // Reuse in-flight request for the same server to avoid duplicate upstream calls
  const inflight = pendingRequests.get(serverId);
  if (inflight) {
    return inflight;
  }

  const requestPromise: Promise<ServerDataResult> = (async () => {
    const liveData = await fetchServerData(serverId);

    // Mitigation for FiveM API bug: if API returns 0 players but we have a cached non-zero value,
    // use the cached value instead to prevent UI from showing incorrect zero counts
    const existingEntry = liveCache.get(serverId);
    if (liveData.online && liveData.currentPlayers === 0 && existingEntry?.lastNonZeroPlayers) {
      console.log(`[FiveM Live API] Server ${serverId}: API returned 0 players, using cached value: ${existingEntry.lastNonZeroPlayers}`);
      liveData.currentPlayers = existingEntry.lastNonZeroPlayers;
    }

    if (liveData.online) {
      setCachedData(serverId, liveData);
      return { data: liveData, cacheStatus: 'live' };
    }

    const fallback = getCachedData(serverId, STALE_FALLBACK_MS);
    if (fallback) {
      return {
        data: {
          ...fallback,
          error: liveData.error
            ? `${liveData.error} (serving cached data)`
            : 'Serving cached data after live fetch failure'
        },
        cacheStatus: 'cache-fallback'
      };
    }

    return { data: liveData, cacheStatus: 'live' };
  })();

  pendingRequests.set(serverId, requestPromise);

  try {
    return await requestPromise;
  } finally {
    pendingRequests.delete(serverId);
  }
}

/**
 * Get server names from database
 */
async function getServerNames(serverIds: string[]): Promise<Map<string, string>> {
  const supabase = createServerClient();
  const nameMap = new Map<string, string>();

  try {
    const { data, error } = await supabase
      .from('server_xref')
      .select('server_id, server_name')
      .in('server_id', serverIds);

    if (!error && data) {
      data.forEach((server: ServerXref) => {
        nameMap.set(server.server_id, server.server_name);
      });
    }
  } catch (err) {
    console.error('Error fetching server names:', err);
  }

  return nameMap;
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

    // Fetch server names from database
    const serverNames = await getServerNames(serverIds);

    const cacheStats = {
      live: 0,
      cacheHit: 0,
      cacheFallback: 0
    };

    // Fetch live data for all servers in parallel
    const serverDataPromises = serverIds.map(async (serverId) => {
      const { data, cacheStatus } = await getServerDataWithCache(serverId);

      if (cacheStatus === 'live') cacheStats.live += 1;
      if (cacheStatus === 'cache-hit') cacheStats.cacheHit += 1;
      if (cacheStatus === 'cache-fallback') cacheStats.cacheFallback += 1;
      
      // Use database server name if available, otherwise use API name
      if (serverNames.has(serverId)) {
        data.serverName = serverNames.get(serverId)!;
      }
      
      return { serverId, data };
    });

    const results = await Promise.all(serverDataPromises);

    // Build response object
    const servers: Record<string, FiveMServerData> = {};
    results.forEach(({ serverId, data }) => {
      servers[serverId] = data;
    });

    const response = NextResponse.json({
      servers,
      timestamp: new Date().toISOString()
    }, {
      headers: {
        // Allow caching for 15 seconds to reduce API load
        'Cache-Control': 'public, s-maxage=15, stale-while-revalidate=30'
      }
    });

    response.headers.set(
      'X-FiveM-Live-Cache',
      `live=${cacheStats.live};fresh=${cacheStats.cacheHit};fallback=${cacheStats.cacheFallback}`
    );

    return response;
  } catch (error) {
    console.error('Error in live FiveM API:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch live data' },
      { status: 500 }
    );
  }
}
