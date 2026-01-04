import { NextRequest, NextResponse } from "next/server"
import { type QueueSegment, type QueueServerData, type ServerQueueConfig, filterQueueEnabledServers, getQueueConfig } from "@/lib/server-queues"

interface LiveQueueServerData extends QueueServerData {
  lastUpdated: string
  error?: string
}

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
    const players = typeof (queueData as Record<string, unknown>).players === "number" ? (queueData as Record<string, unknown>).players : 0
    const cap = typeof (queueData as Record<string, unknown>).cap === "number" ? (queueData as Record<string, unknown>).cap : undefined

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

async function fetchQueueForServer(config: ServerQueueConfig): Promise<LiveQueueServerData> {
  try {
    const response = await fetch(config.apiUrl, {
      headers: DEFAULT_HEADERS,
      signal: AbortSignal.timeout(10000)
    })

    if (!response.ok) {
      throw new Error(`Queue API error: ${response.status}`)
    }

    const payload = await response.json()
    const parsed = parseQueueResponse(config.parser, payload)

    return {
      ...parsed,
      lastUpdated: new Date().toISOString()
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown queue error"
    console.error(`Error fetching queue data for ${config.serverId}:`, message)

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

