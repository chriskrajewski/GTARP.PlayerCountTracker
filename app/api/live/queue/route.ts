import { NextRequest, NextResponse } from "next/server"
import { type QueueSegment, type QueueServerData, type ServerQueueConfig, filterQueueEnabledServers, getQueueConfig } from "@/lib/server-queues"
import { getAPICache } from "@/lib/api-cache"

const API_CACHE_NAME = "queue"

interface LiveQueueServerData extends QueueServerData {
  lastUpdated: string
  error?: string
}

// In-memory cache as fallback
const memoryCache = new Map<string, { data: LiveQueueServerData; timestamp: number }>()
const MEMORY_CACHE_TTL_MS = 30000 // 30 seconds

const DEFAULT_HEADERS = {
  Accept: "application/json",
  "User-Agent": "RPStats.com Queue Monitor/1.0"
}

function formatSegmentLabel(segmentType: string) {
  if (segmentType === "public") return "Paleto"
  if (segmentType === "allowlist") return "Whitelist"
  const formatted = segmentType.split("_").map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(" ")
  return formatted || "Queue"
}

function parseQueueResponse(type: ServerQueueConfig["parser"], payload: unknown): QueueServerData {
  switch (type) {
    case "chaseroleplay":
      return parseChaseRoleplayQueue(payload)
    case "free2rp":
      return parseFree2RPQueue(payload)
    default:
      throw new Error(`Unsupported queue parser: ${type}`)
  }
}

function parseChaseRoleplayQueue(payload: unknown): QueueServerData {
  if (!payload || typeof payload !== "object") {
    throw new Error("Invalid queue response")
  }

  const queueData = payload as Record<string, unknown>
  const segments: QueueSegment[] = []

  for (const [segmentType, segmentValue] of Object.entries(queueData)) {
    if (!segmentValue || typeof segmentValue !== "object") continue
    const segmentRecord = segmentValue as Record<string, unknown>
    const players = typeof segmentRecord.players === "number" ? segmentRecord.players : 0
    const cap = typeof segmentRecord.cap === "number" ? segmentRecord.cap : undefined

    if (players === 0 && typeof cap === "undefined") continue

    segments.push({
      type: segmentType,
      label: formatSegmentLabel(segmentType),
      players,
      cap
    })
  }

  // Fallback if API only returns a single object
  if (segments.length === 0) {
    const playersVal = (queueData as Record<string, unknown>).players
    const capVal = (queueData as Record<string, unknown>).cap
    const players = typeof playersVal === "number" ? playersVal : 0
    const cap = typeof capVal === "number" ? capVal : undefined

    segments.push({
      type: "queue",
      label: "Queue",
      players,
      cap
    })
  }

  const totalPlayers = segments.reduce((sum, segment) => sum + (segment.players || 0), 0)

  return {
    totalPlayers,
    segments
  }
}

function parseFree2RPQueue(payload: unknown): QueueServerData {
  if (!payload || typeof payload !== "object") {
    throw new Error("Invalid queue response")
  }

  const data = payload as Record<string, unknown>
  
  if (data.ok !== true) {
    throw new Error("Free2RP API returned error")
  }

  const inQueue = typeof data.in_queue === "number" ? data.in_queue : 0

  // Always show in_queue segment, even when 0
  const segments: QueueSegment[] = [{
    type: "in_queue",
    label: "Whitelist",
    players: inQueue
  }]

  return {
    totalPlayers: inQueue,
    segments
  }
}

async function fetchQueueForServer(config: ServerQueueConfig): Promise<LiveQueueServerData> {
  const cacheKey = `queue_${config.serverId}`
  const apiCache = getAPICache()

  // Check memory cache first (fastest)
  const memoryCached = memoryCache.get(config.serverId)
  if (memoryCached && Date.now() - memoryCached.timestamp < MEMORY_CACHE_TTL_MS) {
    // Trigger background refresh if data is getting stale (>15s old)
    if (Date.now() - memoryCached.timestamp > 15000) {
      refreshQueueInBackground(config, cacheKey, apiCache)
    }
    return memoryCached.data
  }

  // Check DB cache
  try {
    const dbCached = await apiCache.get<LiveQueueServerData>(API_CACHE_NAME, cacheKey)
    if (dbCached) {
      // Update memory cache
      memoryCache.set(config.serverId, { data: dbCached, timestamp: Date.now() })
      // Trigger background refresh
      refreshQueueInBackground(config, cacheKey, apiCache)
      return dbCached
    }
  } catch (e) {
    console.error(`DB cache error for ${config.serverId}:`, e)
  }

  // Use stale memory cache if available
  if (memoryCached) {
    refreshQueueInBackground(config, cacheKey, apiCache)
    return memoryCached.data
  }

  // No cache available, fetch synchronously
  return fetchQueueFromAPI(config, cacheKey, apiCache, null)
}

// Background refresh - doesn't block response
function refreshQueueInBackground(config: ServerQueueConfig, cacheKey: string, apiCache: ReturnType<typeof getAPICache>) {
  // Don't refresh too frequently
  const lastRefresh = backgroundRefreshTimestamps.get(config.serverId) || 0
  if (Date.now() - lastRefresh < 15000) return // 15 second minimum between refreshes
  
  backgroundRefreshTimestamps.set(config.serverId, Date.now())
  
  fetchQueueFromAPI(config, cacheKey, apiCache, null).catch(() => {})
}

const backgroundRefreshTimestamps = new Map<string, number>()

async function fetchQueueFromAPI(
  config: ServerQueueConfig, 
  cacheKey: string, 
  apiCache: ReturnType<typeof getAPICache>,
  fallbackCache: { data: LiveQueueServerData; timestamp: number } | null
): Promise<LiveQueueServerData> {
  try {
    const response = await fetch(config.apiUrl, {
      headers: DEFAULT_HEADERS,
      signal: AbortSignal.timeout(5000),
      next: { revalidate: 15 }
    })

    if (!response.ok) {
      throw new Error(`Queue API error: ${response.status}`)
    }

    const payload = await response.json()
    const parsed = parseQueueResponse(config.parser, payload)

    const data: LiveQueueServerData = {
      ...parsed,
      lastUpdated: new Date().toISOString()
    }

    // Update both caches
    memoryCache.set(config.serverId, { data, timestamp: Date.now() })
    apiCache.set(API_CACHE_NAME, cacheKey, data as unknown as Record<string, unknown>).catch(() => {})

    return data
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown queue error"
    console.error(`Error fetching queue data for ${config.serverId}:`, message)

    // Return cached data if available, even if stale
    if (fallbackCache) {
      return { ...fallbackCache.data, error: message }
    }

    return {
      totalPlayers: 0,
      segments: [],
      lastUpdated: new Date().toISOString(),
      error: message
    }
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const serverIdsParam = searchParams.get("serverIds")

    if (!serverIdsParam) {
      return NextResponse.json(
        { error: "serverIds parameter is required" },
        { status: 400 }
      )
    }

    const requestedServerIds = serverIdsParam
      .split(",")
      .map((id) => id.trim())
      .filter(Boolean)

    if (requestedServerIds.length === 0) {
      return NextResponse.json(
        { error: "At least one server ID is required" },
        { status: 400 }
      )
    }

    const queueEnabledIds = filterQueueEnabledServers(requestedServerIds)

    if (queueEnabledIds.length === 0) {
      return NextResponse.json(
        { servers: {}, timestamp: new Date().toISOString() },
        { status: 200 }
      )
    }

    const serverDataPromises = queueEnabledIds.map(async (serverId) => {
      const config = getQueueConfig(serverId)
      if (!config) return null

      const data = await fetchQueueForServer(config)
      return { serverId, data }
    })

    const results = (await Promise.all(serverDataPromises)).filter(
      (result): result is { serverId: string; data: LiveQueueServerData } => result !== null
    )

    const servers: Record<string, LiveQueueServerData> = {}
    results.forEach(({ serverId, data }) => {
      servers[serverId] = data
    })

    return NextResponse.json(
      {
        servers,
        timestamp: new Date().toISOString()
      },
      {
        headers: {
          "Cache-Control": "public, s-maxage=15, stale-while-revalidate=30"
        }
      }
    )
  } catch (error) {
    console.error("Error in live queue API:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch queue data" },
      { status: 500 }
    )
  }
}

