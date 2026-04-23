import { supabase } from "./supabase"
import { createServerClient } from "./supabase-server"

export type TimeRange =
  | "live" // Real-time live data
  | "1h" // Last hour
  | "6h" // Last 6 hours
  | "24h" // Last 24 hours
  | "7d" // Last 7 days
  | "30d" // Last 30 days
  | "90d" // Last 3 months
  | "180d" // Last 6 months
  | "365d" // Last year
  | "all" // All time
  | "2h" // Last 2 hours
  | "4h" // Last 4 hours
  | "8h" // Last 8 hours

export type TimeAggregation =
  | "minute" // Group by minute
  | "hour" // Group by hour
  | "day" // Group by day
  | "week" // Group by week
  | "month" // Group by month

export type ServerData = {
  server_id: string
  server_name: string
}

export type PlayerCountData = {
  timestamp: string
  player_count: number
  server_id: string
}

export type ServerCapacityData = {
  timestamp: string
  max_capacity: number
  server_id: string
}

export type StreamCountData = {
  timestamp: string
  streamercount: number
  server_id: string
}

export type ViewerCountData = {
  timestamp: string
  viewcount: number
  server_id: string
}

export type ServerResourceChange = {
  id: number
  server_id: string
  timestamp: string
  added_resources: string[] | null
  removed_resources: string[] | null
}

export type ServerResourceSnapshot = {
  id: number
  server_id: string
  timestamp: string
  resources: string[] | null
  created_at?: string
}

export type AggregatedData = {
  timestamp: string
  [key: string]: number | string | null
}

export type DataStartInfo = {
  server_id: string;
  start_date: string;
}

export type LastRefreshInfo = {
  server_id: string;
  last_refresh: string;
}

export type PaginationOptions = {
  page?: number;
  pageSize?: number;
  maxRecords?: number;
}

const MAX_RESPONSE_RECORDS = 10000
const MAX_PERIOD_LIMIT = 100
const MIN_POINTS_PER_SERVER = 100

// New type for server colors
export type ServerColor = {
  server_id: string;
  color_hsl: string;
}

// Get optimal sampling interval for large datasets
function getOptimalSamplingInterval(timeRange: TimeRange): string {
  switch (timeRange) {
    case "30d":
      return "every 3 hours"
    case "90d":
      return "every 12 hours"
    case "180d":
      return "daily"
    case "365d":
      return "every 3 days"
    case "all":
      return "weekly"
    default:
      return "hourly"
  }
}

// Apply client-side sampling to reduce data points
function applySampling(data: PlayerCountData[], timeRange: TimeRange): PlayerCountData[] {
  if (data.length <= 1000) return data
  
  // Calculate sampling rate based on time range
  let sampleRate: number
  switch (timeRange) {
    case "30d":
      sampleRate = Math.max(1, Math.floor(data.length / 500)) // Target ~500 points
      break
    case "90d":
      sampleRate = Math.max(1, Math.floor(data.length / 300)) // Target ~300 points
      break
    case "180d":
    case "365d":
      sampleRate = Math.max(1, Math.floor(data.length / 200)) // Target ~200 points
      break
    default:
      sampleRate = Math.max(1, Math.floor(data.length / 1000))
  }
  
  // Sample data at regular intervals
  const sampledData: PlayerCountData[] = []
  for (let i = 0; i < data.length; i += sampleRate) {
    sampledData.push(data[i])
  }
  
  // Always include the last data point
  if (data.length > 0 && sampledData[sampledData.length - 1] !== data[data.length - 1]) {
    sampledData.push(data[data.length - 1])
  }
  
  return sampledData
}

function getPaginationBounds(recordLimit: number, options?: PaginationOptions) {
  const maxRecords = Math.max(1, Math.min(options?.maxRecords ?? MAX_RESPONSE_RECORDS, recordLimit))
  const pageSize = Math.max(1, Math.min(options?.pageSize ?? maxRecords, maxRecords))
  const page = Math.max(1, Math.floor(options?.page ?? 1))
  const start = (page - 1) * pageSize

  if (start >= maxRecords) {
    return { start: 0, end: -1, isEmpty: true }
  }

  const end = Math.min(start + pageSize - 1, maxRecords - 1)
  return { start, end, isEmpty: false }
}

// Fetch pre-computed daily averages from the player_counts_daily materialized view.
// This is a single fast query instead of dozens of sampling queries.
// Falls back to a direct full-range query if the materialized view doesn't exist yet.
export async function getPlayerCountsWithTimeBasedSampling(serverIds: string[], timeRange: TimeRange): Promise<PlayerCountData[]> {
  const isClient = typeof window !== "undefined"
  const client = isClient ? supabase : createServerClient()
  
  const now = new Date()
  let startDate: Date
  
  switch (timeRange) {
    case "7d":
      startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
      break
    case "30d":
      startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
      break
    case "90d":
      startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000)
      break
    case "180d":
      startDate = new Date(now.getTime() - 180 * 24 * 60 * 60 * 1000)
      break
    case "365d":
      startDate = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000)
      break
    default:
      return getPlayerCounts(serverIds, timeRange)
  }
  
  try {
    // Query the materialized view — one row per server per day, already averaged
    let query = client
      .from('player_counts_daily')
      .select('server_id, day, avg_player_count')
      .gte('day', startDate.toISOString().split('T')[0])
      .lte('day', now.toISOString().split('T')[0])
      .order('day', { ascending: true })

    if (serverIds.length > 0) {
      query = query.in('server_id', serverIds)
    }

    const { data, error } = await query

    if (error) {
      // Materialized view likely doesn't exist yet — fall back to direct query
      console.warn('player_counts_daily query failed, falling back to direct query:', error.message)
      return await getPlayerCountsFallback(client, serverIds, startDate, now, timeRange)
    }

    if (!data || data.length === 0) {
      return []
    }

    // Convert materialized view rows to PlayerCountData format
    // The aggregation step downstream will see one point per day per server
    // and pass it through as-is (since it's already daily)
    return data.map((row: { server_id: string; day: string; avg_player_count: number }) => ({
      server_id: row.server_id,
      timestamp: `${row.day}T12:00:00.000Z`, // Noon UTC as the representative timestamp for the day
      player_count: row.avg_player_count,
    }))
    
  } catch (error) {
    console.warn('Materialized view fetch failed, falling back:', error)
    return await getPlayerCounts(serverIds, timeRange)
  }
}

// Fallback: single direct query when the materialized view isn't available
async function getPlayerCountsFallback(
  client: ReturnType<typeof createServerClient>,
  serverIds: string[],
  startDate: Date,
  endDate: Date,
  timeRange: TimeRange,
): Promise<PlayerCountData[]> {
  const limit = timeRange === "7d" ? 20000 : 10000

  let query = client
    .from('player_counts')
    .select('server_id, timestamp, player_count')
    .gte('timestamp', startDate.toISOString())
    .lte('timestamp', endDate.toISOString())
    .order('timestamp', { ascending: true })
    .limit(limit)

  if (serverIds.length > 0) {
    query = query.in('server_id', serverIds)
  }

  const { data, error } = await query
  if (error) {
    console.error('Fallback query also failed:', error)
    return []
  }
  return data || []
}

// Get appropriate time aggregation based on time range
export function getTimeAggregation(timeRange: TimeRange): TimeAggregation {
  switch (timeRange) {
    case "live":
      return "minute"
    case "1h":
      return "minute"
    case "6h":
      return "minute"
    case "2h":
      return "minute"
    case "4h":
      return "minute"
    case "8h":
      return "minute"
    case "24h":
      return "hour"
    case "7d":
      return "day"
    case "30d":
      return "day"
    case "90d":
      return "week"
    case "180d":
      return "week"
    case "365d":
      return "month"
    case "all":
      return "month"
    default:
      return "day"
  }
}

// Use server client for server-side operations
export async function getServers(): Promise<ServerData[]> {
  // Check if we're in a browser environment
  const isClient = typeof window !== "undefined"
  const client = isClient ? supabase : createServerClient()

  // First try to get servers from server_xref table
  const { data: serverXrefData, error: serverXrefError } = await client
    .from("server_xref")
    .select("server_id, server_name")
    .order("order", { ascending: true })

  if (!serverXrefError && serverXrefData && serverXrefData.length > 0) {
    return serverXrefData.map(server => ({
      server_id: server.server_id,
      server_name: server.server_name
    }));
  }

  // Fallback: If server_xref table doesn't exist or is empty, get unique server_ids from player_counts
  console.warn("Falling back to player_counts table for server IDs");
  const { data, error } = await client
    .from("player_counts")
    .select("server_id")
    .order("server_id")
    .limit(100)

  if (error) {
    console.error("Error fetching servers:", error)
    return []
  }

  // Get unique server IDs
  const uniqueServers = Array.from(new Set(data.map((item) => item.server_id))).map((server_id) => ({
    server_id,
    server_name: `Server ${server_id}` // Fallback name if no mapping exists
  }))

  return uniqueServers
}

// Get server name from server ID
export async function getServerName(serverId: string): Promise<string> {
  // Check if we're in a browser environment
  const isClient = typeof window !== "undefined"
  const client = isClient ? supabase : createServerClient()

  const { data, error } = await client
    .from("server_xref")
    .select("server_name")
    .eq("server_id", serverId)
    .single()

  if (error || !data) {
    return `Server ${serverId}` // Fallback name if no mapping exists
  }

  return data.server_name
}

export async function getServerResourceChangesBulk(serverIds: string[], limit = 50): Promise<ServerResourceChange[]> {
  const isClient = typeof window !== "undefined"
  const client = isClient ? supabase : createServerClient()

  let query = client
    .from("server_resource_changes")
    .select("id, server_id, timestamp, added_resources, removed_resources")
    .order("timestamp", { ascending: false })
    .limit(limit)

  if (serverIds.length > 0) {
    query = query.in("server_id", serverIds)
  }

  const { data, error } = await query

  if (error || !data) {
    if (error) {
      console.error("Error fetching server resource changes:", error)
    }
    return []
  }

  return data
}

export async function getLatestServerResourceSnapshots(serverIds: string[], limit = 200): Promise<ServerResourceSnapshot[]> {
  const isClient = typeof window !== "undefined"
  const client = isClient ? supabase : createServerClient()

  let query = client
    .from("server_resource_snapshots")
    .select("id, server_id, timestamp, resources")
    .order("timestamp", { ascending: false })

  if (serverIds.length > 0) {
    // Fetch a few recent entries per server to ensure we get the latest snapshot for each selected server
    query = query.in("server_id", serverIds).limit(Math.max(serverIds.length * 5, 25))
  } else {
    query = query.limit(limit)
  }

  const { data, error } = await query

  if (error || !data) {
    if (error) {
      console.error("Error fetching latest server resource snapshots:", error)
    }
    return []
  }

  const seen = new Set<string>()
  const latest: ServerResourceSnapshot[] = []

  for (const snapshot of data) {
    if (!seen.has(snapshot.server_id)) {
      latest.push(snapshot)
      seen.add(snapshot.server_id)
    }
    if (serverIds.length > 0 && latest.length === serverIds.length) {
      break
    }
  }

  return latest
}

function getRecordLimitForTimeRange(timeRange: TimeRange): number {
  switch (timeRange) {
    case "1h":
    case "2h":
    case "4h":
    case "6h":
    case "8h":
    case "24h":
      return 50000
    case "7d":
    case "30d":
      return 20000
    case "90d":
    case "180d":
      return 15000
    case "365d":
    case "all":
      return 10000
    default:
      return 50000
  }
}

export async function getPlayerCounts(
  serverIds: string[],
  timeRange: TimeRange,
  options?: PaginationOptions
): Promise<PlayerCountData[]> {
  // Check if we're in a browser environment
  const isClient = typeof window !== "undefined"
  const client = isClient ? supabase : createServerClient()

  // Note: This function is now mainly for shorter time ranges
  // Longer ranges (30d+) should use getPlayerCountsSmart() instead
  
  // When fetching "all" data, we want newest first with a reasonable limit
  // For specific time ranges, we want chronological order
  const fetchingAll = timeRange === "all"
  const recordLimit = getRecordLimitForTimeRange(timeRange)
  const pagination = getPaginationBounds(recordLimit, options)

  if (pagination.isEmpty) {
    return []
  }
  
  let query = client
    .from("player_counts")
    .select("server_id, timestamp, player_count")
    .order("timestamp", { ascending: !fetchingAll }) // Descending for "all", ascending for time ranges
    .range(pagination.start, pagination.end)

  if (serverIds.length > 0) {
    query = query.in("server_id", serverIds)
  }

  // Apply time filter
  const now = new Date()
  if (timeRange !== "all") {
    let startDate: Date

    switch (timeRange) {
      case "1h":
        startDate = new Date(now.getTime() - 1 * 60 * 60 * 1000)
        break
      case "2h":
        startDate = new Date(now.getTime() - 2 * 60 * 60 * 1000)
        break
      case "4h":
        startDate = new Date(now.getTime() - 4 * 60 * 60 * 1000)
        break
      case "6h":
        startDate = new Date(now.getTime() - 6 * 60 * 60 * 1000)
        break
      case "8h":
        startDate = new Date(now.getTime() - 8 * 60 * 60 * 1000)
        break
      case "24h":
        startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000)
        break
      case "7d":
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
        break
      case "30d":
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
        break
      case "90d":
        startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000)
        break
      case "180d":
        startDate = new Date(now.getTime() - 180 * 24 * 60 * 60 * 1000)
        break
      case "365d":
        startDate = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000)
        break
      default:
        startDate = new Date(0)
    }

    query = query.gte("timestamp", startDate.toISOString())
  }

  const { data, error } = await query

  if (error) {
    console.error("Error fetching player counts:", error)
    return []
  }

  // If we fetched "all" data in descending order, reverse it to chronological order for the chart
  if (fetchingAll && data) {
    return data.reverse()
  }

  return data
}

export async function getStreamCounts(
  serverIds: string[],
  timeRange: TimeRange,
  options?: PaginationOptions
): Promise<StreamCountData[]> {
  const isClient = typeof window !== "undefined";
  const client = isClient ? supabase : createServerClient();
  const recordLimit = 10000
  const pagination = getPaginationBounds(recordLimit, options)

  if (pagination.isEmpty) {
    return []
  }

  let query = client
    .from("streamer_count")
    .select("server_id, timestamp, streamercount")
    .order("timestamp", { ascending: true })
    .range(pagination.start, pagination.end);

  if (serverIds.length > 0) {
    query = query.in("server_id", serverIds);
  }

  // Apply time filter
  const now = new Date();
  if (timeRange !== "all") {
    let startDate: Date;
    switch (timeRange) {
      case "1h":
        startDate = new Date(now.getTime() - 1 * 60 * 60 * 1000)
        break
      case "2h":
        startDate = new Date(now.getTime() - 2 * 60 * 60 * 1000)
        break
      case "4h":
        startDate = new Date(now.getTime() - 4 * 60 * 60 * 1000)
        break
      case "6h":
        startDate = new Date(now.getTime() - 6 * 60 * 60 * 1000)
        break
      case "8h":
        startDate = new Date(now.getTime() - 8 * 60 * 60 * 1000)
        break
      case "24h":
        startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000)
        break
      case "7d":
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
        break
      case "30d":
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
        break
      case "90d":
        startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000)
        break
      case "180d":
        startDate = new Date(now.getTime() - 180 * 24 * 60 * 60 * 1000)
        break
      case "365d":
        startDate = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000)
        break
      default:
        startDate = new Date(0)
    }
    query = query.gte("timestamp", startDate.toISOString());
  }

  const { data, error } = await query;

  if (error) {
    console.error("Error fetching streamer counts:", error);
    return [];
  }

  return data || []; // Ensure we always return an array
}

export async function getViewerCounts(
  serverIds: string[],
  timeRange: TimeRange,
  options?: PaginationOptions
): Promise<ViewerCountData[]> {
  const isClient = typeof window !== "undefined";
  const client = isClient ? supabase : createServerClient();
  const recordLimit = 50000
  const pagination = getPaginationBounds(recordLimit, options)

  if (pagination.isEmpty) {
    return []
  }

  let query = client
    .from("viewer_count")
    .select("server_id, timestamp, viewcount")
    .order("timestamp", { ascending: true })
    .range(pagination.start, pagination.end);

  if (serverIds.length > 0) {
    query = query.in("server_id", serverIds);
  }

  // Apply time filter
  const now = new Date();
  if (timeRange !== "all") {
    let startDate: Date;
    switch (timeRange) {
      case "1h":
        startDate = new Date(now.getTime() - 1 * 60 * 60 * 1000)
        break
      case "2h":
        startDate = new Date(now.getTime() - 2 * 60 * 60 * 1000)
        break
      case "4h":
        startDate = new Date(now.getTime() - 4 * 60 * 60 * 1000)
        break
      case "6h":
        startDate = new Date(now.getTime() - 6 * 60 * 60 * 1000)
        break
      case "8h":
        startDate = new Date(now.getTime() - 8 * 60 * 60 * 1000)
        break
      case "24h":
        startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000)
        break
      case "7d":
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
        break
      case "30d":
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
        break
      case "90d":
        startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000)
        break
      case "180d":
        startDate = new Date(now.getTime() - 180 * 24 * 60 * 60 * 1000)
        break
      case "365d":
        startDate = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000)
        break
      default:
        startDate = new Date(0)
    }
    query = query.gte("timestamp", startDate.toISOString());
  }

  const { data, error } = await query;

  if (error) {
    console.error("Error fetching viewer counts:", error);
    return [];
  }

  return data || []; // Ensure we always return an array
}

/**
 * Fetch server capacity data for the specified servers and time range
 * @param serverIds Array of server IDs to fetch capacity for
 * @param timeRange Time range to fetch data for
 * @returns Array of capacity data points
 */
export async function getServerCapacities(
  serverIds: string[],
  timeRange: TimeRange,
  options?: PaginationOptions
): Promise<ServerCapacityData[]> {
  const isClient = typeof window !== "undefined";
  const client = isClient ? supabase : createServerClient();

  // When fetching "all" data, we want newest first with a reasonable limit
  const fetchingAll = timeRange === "all"
  const recordLimit = getRecordLimitForTimeRange(timeRange)
  const pagination = getPaginationBounds(recordLimit, options)

  if (pagination.isEmpty) {
    return []
  }

  let query = client
    .from("server_capacity")
    .select("server_id, timestamp, max_capacity")
    .order("timestamp", { ascending: !fetchingAll }) // Descending for "all", ascending for time ranges
    .range(pagination.start, pagination.end);

  if (serverIds.length > 0) {
    query = query.in("server_id", serverIds);
  }

  // Apply time filter
  const now = new Date();
  if (timeRange !== "all") {
    let startDate: Date;
    switch (timeRange) {
      case "1h":
        startDate = new Date(now.getTime() - 1 * 60 * 60 * 1000)
        break
      case "2h":
        startDate = new Date(now.getTime() - 2 * 60 * 60 * 1000)
        break
      case "4h":
        startDate = new Date(now.getTime() - 4 * 60 * 60 * 1000)
        break
      case "6h":
        startDate = new Date(now.getTime() - 6 * 60 * 60 * 1000)
        break
      case "8h":
        startDate = new Date(now.getTime() - 8 * 60 * 60 * 1000)
        break
      case "24h":
        startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000)
        break
      case "7d":
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
        break
      case "30d":
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
        break
      case "90d":
        startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000)
        break
      case "180d":
        startDate = new Date(now.getTime() - 180 * 24 * 60 * 60 * 1000)
        break
      case "365d":
        startDate = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000)
        break
      default:
        startDate = new Date(0)
    }
    query = query.gte("timestamp", startDate.toISOString());
  }

  const { data, error } = await query;

  if (error) {
    console.error("Error fetching server capacities:", error);
    return [];
  }

  // If we fetched "all" data in descending order, reverse it to chronological order for the chart
  if (fetchingAll && data) {
    return data.reverse()
  }

  return data || [];
}

/**
 * Get the most recent max capacity for a server
 * @param serverId Server ID to fetch capacity for
 * @returns Latest capacity value or null if not found
 */
export async function getLatestServerCapacity(serverId: string): Promise<number | null> {
  const isClient = typeof window !== "undefined";
  const client = isClient ? supabase : createServerClient();

  const { data, error } = await client
    .from("server_capacity")
    .select("max_capacity")
    .eq("server_id", serverId)
    .order("timestamp", { ascending: false })
    .limit(1)
    .single();

  if (error || !data) {
    return null;
  }

  return data.max_capacity;
}

/**
 * Calculate percentage of time server was at max capacity
 * @param playerData Array of player count data
 * @param capacityData Array of capacity data
 * @param serverId Server ID to calculate for
 * @returns Percentage (0-100) of time at max capacity
 */
export function calculateTimeAtMaxCapacity(
  playerData: PlayerCountData[],
  capacityData: ServerCapacityData[],
  serverId: string
): number {
  const serverPlayerData = playerData.filter(d => d.server_id === serverId);
  const serverCapacityData = capacityData.filter(d => d.server_id === serverId);

  if (serverPlayerData.length === 0 || serverCapacityData.length === 0) {
    return 0;
  }

  // Create a map of timestamps to capacity values
  const capacityMap = new Map<string, number>();
  serverCapacityData.forEach(c => {
    capacityMap.set(c.timestamp, c.max_capacity);
  });

  // Count data points where player count equals max capacity
  let atMaxCount = 0;
  let totalCount = 0;

  serverPlayerData.forEach(playerPoint => {
    // Find the capacity at this timestamp or the most recent capacity before it
    let capacity = capacityMap.get(playerPoint.timestamp);
    
    if (!capacity) {
      // Find the most recent capacity before this timestamp
      const sortedCapacities = serverCapacityData
        .filter(c => new Date(c.timestamp) <= new Date(playerPoint.timestamp))
        .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      
      if (sortedCapacities.length > 0) {
        capacity = sortedCapacities[0].max_capacity;
      }
    }

    if (capacity) {
      totalCount++;
      if (playerPoint.player_count >= capacity) {
        atMaxCount++;
      }
    }
  });

  if (totalCount === 0) {
    return 0;
  }

  return Math.round((atMaxCount / totalCount) * 100);
}

// Helper function to fill missing data points with intelligent interpolation
function fillMissingDataPoints(data: AggregatedData[], serverIds: string[]): AggregatedData[] {
  if (data.length === 0) return data
  
  // Convert null values to proper interpolated values
  const filledData = data.map((entry, index) => {
    const filledEntry = { ...entry }
    
    serverIds.forEach(serverId => {
      if (filledEntry[serverId] === null) {
        // Find the nearest non-null values before and after this point
        let beforeValue: number | null = null
        let afterValue: number | null = null
        
        // Look backwards for a valid value
        for (let i = index - 1; i >= 0; i--) {
          const prevValue = data[i][serverId]
          if (prevValue !== null && typeof prevValue === 'number') {
            beforeValue = prevValue
            break
          }
        }
        
        // Look forwards for a valid value
        for (let i = index + 1; i < data.length; i++) {
          const nextValue = data[i][serverId]
          if (nextValue !== null && typeof nextValue === 'number') {
            afterValue = nextValue
            break
          }
        }
        
        // Interpolate or use fallback
        if (beforeValue !== null && afterValue !== null) {
          // Linear interpolation
          filledEntry[serverId] = Math.round((beforeValue + afterValue) / 2)
        } else if (beforeValue !== null) {
          // Use last known value
          filledEntry[serverId] = beforeValue
        } else if (afterValue !== null) {
          // Use next known value
          filledEntry[serverId] = afterValue
        } else {
          // No nearby values, use 0 as last resort
          filledEntry[serverId] = 0
        }
      }
    })
    
    return filledEntry
  })
  
  return filledData
}

// Aggregate data by time period
export function aggregateDataByTime(
  data: PlayerCountData[],
  serverIds: string[],
  aggregation: TimeAggregation,
): AggregatedData[] {
  if (data.length === 0) return []

  // Group data by the appropriate time period
  const groupedData: Record<string, Record<string, number[]>> = {}

  data.forEach((item) => {
    const date = new Date(item.timestamp)
    let timeKey: string

    switch (aggregation) {
      case "minute":
        // Format: 2023-01-01 12:30
        timeKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")} ${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`
        break
      case "hour":
        // Format: 2023-01-01 12:00
        timeKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")} ${String(date.getHours()).padStart(2, "0")}:00`
        break
      case "day":
        // Format: 2023-01-01
        timeKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`
        break
      case "week":
        // Get the first day of the week (Sunday)
        const firstDayOfWeek = new Date(date)
        const day = date.getDay()
        const diff = date.getDate() - day
        firstDayOfWeek.setDate(diff)
        // Use the first day of the week as a proper ISO date format
        timeKey = `${firstDayOfWeek.getFullYear()}-${String(firstDayOfWeek.getMonth() + 1).padStart(2, "0")}-${String(firstDayOfWeek.getDate()).padStart(2, "0")}`
        break
      case "month":
        // Format: 2023-01
        timeKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`
        break
      default:
        timeKey = item.timestamp
    }

    if (!groupedData[timeKey]) {
      groupedData[timeKey] = {}
    }

    if (!groupedData[timeKey][item.server_id]) {
      groupedData[timeKey][item.server_id] = []
    }

    groupedData[timeKey][item.server_id].push(item.player_count)
  })

  // Convert to array format for the chart with better missing data handling
  const result = Object.entries(groupedData)
    .map(([timestamp, servers]) => {
      const entry: AggregatedData = { timestamp }

      serverIds.forEach((serverId) => {
        const counts = servers[serverId] || []
        if (counts.length > 0) {
          // Calculate average player count for this time period
          entry[serverId] = Math.round(counts.reduce((sum, count) => sum + count, 0) / counts.length)
        } else {
          // Instead of always defaulting to 0, use null to let the chart handle gaps properly
          // This prevents misleading zeros in the chart display
          entry[serverId] = null
        }
      })

      return entry
    })
    .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
  
  // Fill in missing data points with interpolated values for better chart continuity
  const filledResult = fillMissingDataPoints(result, serverIds)

  return filledResult
}

// This function now uses the time aggregation
export function aggregateDataForChart(
  data: PlayerCountData[],
  serverIds: string[],
  timeRange: TimeRange,
): AggregatedData[] {
  const aggregation = getTimeAggregation(timeRange)
  return aggregateDataByTime(data, serverIds, aggregation)
}

// Smart data fetching that chooses the best strategy based on time range
export async function getPlayerCountsSmart(serverIds: string[], timeRange: TimeRange): Promise<PlayerCountData[]> {
  // Live mode doesn't fetch historical data - it uses the live chart hook
  if (timeRange === "live") return []
  
  // For time ranges with potentially dense data, use time-based sampling
  if (["7d", "30d", "90d", "180d", "365d", "all"].includes(timeRange)) {
    try {

      return await getPlayerCountsWithTimeBasedSampling(serverIds, timeRange)
    } catch (error) {

      return await getPlayerCounts(serverIds, timeRange)
    }
  }
  
  // For very short ranges (1h-24h), use regular method for maximum detail
  return await getPlayerCounts(serverIds, timeRange)
}

export function getServerStats(data: PlayerCountData[], serverId: string) {
  const serverData = data.filter((item) => item.server_id === serverId)

  if (serverData.length === 0) {
    return { current: 0, peak: 0, average: 0 }
  }

  const counts = serverData.map((item) => item.player_count)
  const current = serverData[serverData.length - 1]?.player_count || 0
  const peak = Math.max(...counts)
  const average = Math.round(counts.reduce((sum, count) => sum + count, 0) / counts.length)

  return { current, peak, average }
}

export function getStreamerStats(streamData: StreamCountData[], serverId: string) {
  if (!Array.isArray(streamData)) {
    console.error("getStreamerStats: Invalid or undefined data provided - ", streamData);
    return { streamCurrent: 0, streamPeak: 0, streamAverage: 0 };
  }

  const serverData = streamData.filter((item) => item.server_id === serverId);

  if (serverData.length === 0) {
    return { streamCurrent: 0, streamPeak: 0, streamAverage: 0 };
  }

  const counts = serverData.map((item) => item.streamercount);
  const streamCurrent = serverData[serverData.length - 1]?.streamercount || 0;
  const streamPeak = Math.max(...counts);
  const streamAverage = Math.round(counts.reduce((sum, count) => sum + count, 0) / counts.length);


  return { streamCurrent, streamPeak, streamAverage };
}

export function getViewerStats(streamData: ViewerCountData[], serverId: string) {
  if (!Array.isArray(streamData)) {
    console.error("getViewStats: Invalid or undefined data provided - ", streamData);
    return { viewerCurrent: 0, viewerPeak: 0, viewerAverage: 0 };
  }

  const serverData = streamData.filter((item) => item.server_id === serverId);

  if (serverData.length === 0) {
    return { viewerCurrent: 0, viewerPeak: 0, viewerAverage: 0 };
  }

  const counts = serverData.map((item) => item.viewcount);
  const viewerCurrent = serverData[serverData.length - 1]?.viewcount || 0;
  const viewerPeak = Math.max(...counts);
  const viewerAverage = Math.round(counts.reduce((sum, count) => sum + count, 0) / counts.length);


  return { viewerCurrent, viewerPeak, viewerAverage };
}

export async function getServerResourceChanges(serverId: string, limit = 20): Promise<ServerResourceChange[]> {
  if (!serverId) return []

  const isClient = typeof window !== "undefined"
  const client = isClient ? supabase : createServerClient()

  const { data, error } = await client
    .from("server_resource_changes")
    .select("id, server_id, timestamp, added_resources, removed_resources, created_at")
    .eq("server_id", serverId)
    .order("timestamp", { ascending: false })
    .limit(limit)

  if (error) {
    console.error("Error fetching server resource changes:", error)
    return []
  }

  if (!data) {
    return []
  }

  return data.map((change) => ({
    id: change.id,
    server_id: change.server_id,
    timestamp: change.timestamp,
    added_resources: Array.isArray(change.added_resources) ? change.added_resources : [],
    removed_resources: Array.isArray(change.removed_resources) ? change.removed_resources : [],
    created_at: change.created_at,
  }))
}

export async function getServerResourceSnapshot(serverId: string): Promise<ServerResourceSnapshot | null> {
  if (!serverId) return null

  const isClient = typeof window !== "undefined"
  const client = isClient ? supabase : createServerClient()

  const { data, error } = await client
    .from("server_resource_snapshots")
    .select("id, server_id, timestamp, resources, created_at")
    .eq("server_id", serverId)
    .order("timestamp", { ascending: false })
    .limit(1)

  if (error) {
    console.error("Error fetching server resource snapshot:", error)
    return null
  }

  if (!data || data.length === 0) {
    return null
  }

  const snapshot = data[0]

  return {
    id: snapshot.id,
    server_id: snapshot.server_id,
    timestamp: snapshot.timestamp,
    resources: Array.isArray(snapshot.resources) ? snapshot.resources : [],
    created_at: snapshot.created_at,
  }
}

export async function getDataStartTimes(): Promise<DataStartInfo[]> {
  try {
    // Check if we're in a browser environment
    const isClient = typeof window !== "undefined"
    const client = isClient ? supabase : createServerClient()

    const { data, error } = await client
      .from("data_start")
      .select("server_id, start_date")
      .order("server_id", { ascending: true })

    if (error) {
      console.error("Error fetching data start times:", error)
      return []
    }

    return data || []
  } catch (err) {
    console.error("Error in getDataStartTimes:", err)
    return []
  }
}

export async function getLastRefreshTimes(): Promise<LastRefreshInfo[]> {
  try {
    // Check if we're in a browser environment
    const isClient = typeof window !== "undefined"
    const client = isClient ? supabase : createServerClient()

    // This query gets the latest timestamp for each server_id
    const { data, error } = await client
      .from("player_counts")
      .select("server_id, timestamp")
      .order("timestamp", { ascending: false })

    if (error) {
      console.error("Error fetching last refresh times:", error)
      return []
    }

    // Group by server_id and take only the most recent timestamp for each
    const serverMap = new Map<string, string>()
    data.forEach(item => {
      if (!serverMap.has(item.server_id)) {
        serverMap.set(item.server_id, item.timestamp)
      }
    })

    // Convert the map to an array of objects
    const lastRefreshData = Array.from(serverMap.entries()).map(([server_id, last_refresh]) => ({
      server_id,
      last_refresh
    }))

    return lastRefreshData
  } catch (err) {
    console.error("Error in getLastRefreshTimes:", err)
    return []
  }
}

// Add this new function to fetch server colors
export async function getServerColors(): Promise<ServerColor[]> {
  // Check if we're in a browser environment
  const isClient = typeof window !== "undefined";
  const client = isClient ? supabase : createServerClient();

  
  const { data, error } = await client
    .from("server_colors")
    .select("server_id, color_hsl");

  if (error) {
    console.error("Error fetching server colors:", error);
    return [];
  }


  return data || [];
}
