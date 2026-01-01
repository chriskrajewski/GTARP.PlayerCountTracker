import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase-server'

/**
 * Database row type for server_restart_predictions table
 */
interface DbPrediction {
  server_id: string
  next_restart_time: string | null
  confidence: number | null
  detected_pattern: string | null
  last_restart_time: string | null
  average_downtime: number | null
  pattern_type: string | null
  ml_reasoning: string | null
  detected_events_count: number | null
  updated_at: string
}

/**
 * Represents a detected restart event
 */
interface RestartEvent {
  timestamp: string
  playerCountBefore: number
  playerCountAfter: number
  downtime: number // minutes
}

/**
 * RestartPrediction format returned to clients
 */
interface RestartPrediction {
  serverId: string
  nextRestartTime: string | null
  confidence: number
  detectedPattern: string | null
  lastRestartTime: string | null
  averageDowntime: number
  detectedEvents: RestartEvent[]
  patternType?: string
  mlReasoning?: string
  isStale?: boolean
  cachedAt?: string
  detectedEventsCount?: number
}

/**
 * GET /api/restart-prediction
 * 
 * Fetches ML-generated server restart predictions from the database cache.
 * Predictions are refreshed by a Supabase Edge Function cron job every 15 minutes.
 * 
 * Query Parameters:
 * - serverIds: comma-separated list of server IDs (required)
 * 
 * Response:
 * {
 *   predictions: RestartPrediction[],
 *   source: 'cache',
 *   timestamp: string
 * }
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const serverIdsParam = searchParams.get('serverIds')

    if (!serverIdsParam) {
      return NextResponse.json(
        { error: 'serverIds parameter is required' },
        { status: 400 }
      )
    }

    const serverIds = serverIdsParam.split(',').filter(id => id.trim())
    if (serverIds.length === 0) {
      return NextResponse.json(
        { error: 'At least one server ID is required' },
        { status: 400 }
      )
    }

    // Limit to 20 servers
    const limitedServerIds = serverIds.slice(0, 20)

    // Fetch cached predictions from the database
    const predictions = await getCachedPredictions(limitedServerIds)
    
    return NextResponse.json({
      predictions,
      source: 'cache',
      timestamp: new Date().toISOString()
    }, {
      headers: {
        // No caching - always fetch fresh data from database
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      }
    })
  } catch (error) {
    console.error('Error in restart prediction API:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * Gets cached predictions from the database
 */
async function getCachedPredictions(serverIds: string[]): Promise<RestartPrediction[]> {
  const supabase = createServerClient()

  const { data: predictions, error } = await supabase
    .from('server_restart_predictions')
    .select('*')
    .in('server_id', serverIds)

  if (error) {
    console.error('Error fetching cached predictions:', error)
    // Return empty predictions on error
    return serverIds.map(serverId => ({
      serverId,
      nextRestartTime: null,
      confidence: 0,
      detectedPattern: null,
      lastRestartTime: null,
      averageDowntime: 0,
      detectedEvents: [],
      isStale: true,
      mlReasoning: 'Error fetching prediction from cache'
    }))
  }

  // Cast predictions to typed array
  const dbPredictions = (predictions || []) as DbPrediction[]

  // Fetch restart events for all servers
  const { data: eventsData, error: eventsError } = await supabase
    .from('server_restart_events')
    .select('*')
    .in('server_id', serverIds)
    .order('event_timestamp', { ascending: false })
    .limit(100) // Get up to 100 events per server

  if (eventsError) {
    console.error('Error fetching restart events:', eventsError)
  }

  // Group events by server_id
  const eventsByServer = new Map<string, RestartEvent[]>()
  if (eventsData) {
    for (const event of eventsData as any[]) {
      if (!eventsByServer.has(event.server_id)) {
        eventsByServer.set(event.server_id, [])
      }
      eventsByServer.get(event.server_id)!.push({
        timestamp: event.event_timestamp,
        playerCountBefore: event.player_count_before || 0,
        playerCountAfter: event.player_count_after || 0,
        downtime: event.downtime_minutes || 0
      })
    }
  }

  // Map database records to RestartPrediction format
  return serverIds.map(serverId => {
    const dbPrediction = dbPredictions.find(p => p.server_id === serverId)
    const events = eventsByServer.get(serverId) || []

    if (!dbPrediction) {
      return {
        serverId,
        nextRestartTime: null,
        confidence: 0,
        detectedPattern: null,
        lastRestartTime: null,
        averageDowntime: 0,
        detectedEvents: events,
        isStale: true,
        mlReasoning: 'No prediction available. Waiting for cron job to generate.'
      }
    }

    // Check if prediction is stale (older than 30 minutes)
    const updatedAt = new Date(dbPrediction.updated_at).getTime()
    const isStale = (Date.now() - updatedAt) > 30 * 60 * 1000

    return {
      serverId: dbPrediction.server_id,
      nextRestartTime: dbPrediction.next_restart_time,
      confidence: dbPrediction.confidence || 0,
      detectedPattern: dbPrediction.detected_pattern,
      lastRestartTime: dbPrediction.last_restart_time,
      averageDowntime: dbPrediction.average_downtime || 0,
      detectedEvents: events,
      patternType: dbPrediction.pattern_type || undefined,
      mlReasoning: dbPrediction.ml_reasoning || undefined,
      isStale,
      cachedAt: dbPrediction.updated_at,
      detectedEventsCount: dbPrediction.detected_events_count || 0
    }
  })
}
