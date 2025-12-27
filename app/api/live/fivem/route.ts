import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase-server';

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

const FIVEM_API_BASE = 'https://servers-frontend.fivem.net/api/servers/single/';

// Request headers to mimic browser requests
const FIVEM_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
  'Accept': 'application/json, text/plain, */*',
  'Accept-Language': 'en-US,en;q=0.9',
  'Referer': 'https://servers.fivem.net/',
  'Origin': 'https://servers.fivem.net'
};

interface FiveMServerData {
  currentPlayers: number;
  maxCapacity: number;
  serverName: string;
  online: boolean;
  lastUpdated: string;
  error?: string;
}

interface ServerXref {
  server_id: string;
  server_name: string;
}

/**
 * Fetch live data for a single FiveM server
 */
async function fetchServerData(serverId: string): Promise<FiveMServerData> {
  try {
    const response = await fetch(`${FIVEM_API_BASE}${serverId}`, {
      headers: FIVEM_HEADERS,
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

    // Fetch live data for all servers in parallel
    const serverDataPromises = serverIds.map(async (serverId) => {
      const data = await fetchServerData(serverId);
      
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

    return NextResponse.json({
      servers,
      timestamp: new Date().toISOString()
    }, {
      headers: {
        // Allow caching for 15 seconds to reduce API load
        'Cache-Control': 'public, s-maxage=15, stale-while-revalidate=30'
      }
    });
  } catch (error) {
    console.error('Error in live FiveM API:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch live data' },
      { status: 500 }
    );
  }
}
