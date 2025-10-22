import { NextResponse } from 'next/server'
import { getLastRefreshTimes, getServers } from '@/lib/data'

const thresholdFromEnv = Number.parseInt(
  process.env.PLAYER_TRACKER_REFRESH_THRESHOLD_MINUTES ?? '20',
  10,
)

const STALE_THRESHOLD_MINUTES = Number.isNaN(thresholdFromEnv)
  ? 20
  : Math.max(thresholdFromEnv, 1)

export const revalidate = 60

export async function GET() {
  try {
    const [refreshTimes, servers] = await Promise.all([
      getLastRefreshTimes(),
      getServers(),
    ])

    const serverNameMap = new Map(
      (servers || []).map((server) => [server.server_id, server.server_name]),
    )

    const now = Date.now()

    const serverStats = (refreshTimes || []).map((item) => {
      const lastRefreshMs = Date.parse(item.last_refresh)
      const minutesSince =
        Number.isNaN(lastRefreshMs) || lastRefreshMs === 0
          ? null
          : Math.round((now - lastRefreshMs) / (1000 * 60))

      return {
        serverId: item.server_id,
        serverName: serverNameMap.get(item.server_id) ?? item.server_id,
        lastRefresh: item.last_refresh,
        minutesSinceLastRefresh: minutesSince,
        isStale:
          minutesSince !== null && minutesSince > STALE_THRESHOLD_MINUTES,
      }
    })

    const staleServers = serverStats.filter((server) => server.isStale)

    return NextResponse.json({
      success: true,
      generatedAt: new Date(now).toISOString(),
      thresholdMinutes: STALE_THRESHOLD_MINUTES,
      staleCount: staleServers.length,
      staleServers: staleServers.map(
        ({ serverId, serverName, minutesSinceLastRefresh }) => ({
          serverId,
          serverName,
          minutesSinceLastRefresh,
        }),
      ),
      servers: serverStats,
    })
  } catch (error) {
    console.error('Error building refresh status payload:', error)

    return NextResponse.json(
      {
        success: false,
        error: 'Failed to compute refresh status',
      },
      { status: 500 },
    )
  }
}
