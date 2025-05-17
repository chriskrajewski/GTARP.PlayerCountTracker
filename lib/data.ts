import { supabase } from "./supabase"
import { createServerClient } from "./supabase-server"

export type TimeRange =
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

export type AggregatedData = {
  timestamp: string
  [key: string]: number | string
}

export type DataStartInfo = {
  server_id: string;
  start_date: string;
}

export type LastRefreshInfo = {
  server_id: string;
  last_refresh: string;
}

// New type for server colors
export type ServerColor = {
  server_id: string;
  color_hsl: string;
}

// Get appropriate time aggregation based on time range
export function getTimeAggregation(timeRange: TimeRange): TimeAggregation {
  switch (timeRange) {
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
      return "hour"
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

export async function getPlayerCounts(serverIds: string[], timeRange: TimeRange): Promise<PlayerCountData[]> {
  // Check if we're in a browser environment
  const isClient = typeof window !== "undefined"
  const client = isClient ? supabase : createServerClient()

  let query = client
    .from("player_counts")
    .select("server_id, timestamp, player_count")
    .order("timestamp", { ascending: true })

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

  return data
}

export async function getStreamCounts(serverIds: string[], timeRange: TimeRange): Promise<StreamCountData[]> {
  const isClient = typeof window !== "undefined";
  const client = isClient ? supabase : createServerClient();

  console.log(serverIds);
  let query = client
    .from("streamer_count")
    .select("server_id, timestamp, streamercount")
    .order("timestamp", { ascending: true });

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

  console.log("getStreamCounts result:", data); // Add this to debug
  console.log("getStreamCounts serverids result:", serverIds); // Add this to debug
  return data || []; // Ensure we always return an array
}

export async function getViewerCounts(serverIds: string[], timeRange: TimeRange): Promise<ViewerCountData[]> {
  const isClient = typeof window !== "undefined";
  const client = isClient ? supabase : createServerClient();

  console.log(serverIds);
  let query = client
    .from("viewer_count")
    .select("server_id, timestamp, viewcount")
    .order("timestamp", { ascending: true });

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

  console.log("getViewerCounts result:", data); // Add this to debug
  console.log("getViewerCounts serverids result:", serverIds); // Add this to debug
  return data || []; // Ensure we always return an array
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
        // Format: 2023-W01 (year and week number)
        const weekNumber = Math.ceil(
          ((date.getTime() - new Date(date.getFullYear(), 0, 1).getTime()) / 86400000 + 1) / 7,
        )
        timeKey = `${date.getFullYear()}-W${String(weekNumber).padStart(2, "0")}`
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

  // Convert to array format for the chart
  return Object.entries(groupedData)
    .map(([timestamp, servers]) => {
      const entry: AggregatedData = { timestamp }

      serverIds.forEach((serverId) => {
        const counts = servers[serverId] || []
        if (counts.length > 0) {
          // Calculate average player count for this time period
          entry[serverId] = Math.round(counts.reduce((sum, count) => sum + count, 0) / counts.length)
        } else {
          entry[serverId] = 0
        }
      })

      return entry
    })
    .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
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
    return { viewerurrent: 0, viewerPeak: 0, viewerAverage: 0 };
  }

  const serverData = streamData.filter((item) => item.server_id === serverId);

  if (serverData.length === 0) {
    return { viewerurrent: 0, viewerPeak: 0, viewerAverage: 0 };
  }

  const counts = serverData.map((item) => item.viewcount);
  const viewerCurrent = serverData[serverData.length - 1]?.viewcount || 0;
  const viewerPeak = Math.max(...counts);
  const viewerAverage = Math.round(counts.reduce((sum, count) => sum + count, 0) / counts.length);


  return { viewerCurrent, viewerPeak, viewerAverage };
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
    .select("id, server_id, color_hsl");

  if (error) {
    console.error("Error fetching server colors:", error);
    return [];
  }

  if (!data || data.length === 0) {
    return [];
  }
  
  // Normalize server IDs to ensure they match exactly as expected in the application
  return data.map(color => ({
    ...color,
    // Ensure server_id is properly trimmed and consistent
    server_id: color.server_id.trim(),
  }));
}
