import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase-server'
import { RestartPrediction } from '@/lib/restart-prediction'

/**
 * GET /api/restart-prediction
 * 
 * Fetches pre-calculated server restart predictions from the database
 * Predictions are calculated by a scheduled PL/pgSQL function every 5-10 minutes
 * 
 * Query Parameters:
 * - serverIds: comma-separated list of server IDs (required)
 * - daysBack: number of days to analyze (default: 14, max: 30) - for reference only
 * 
 * Response:
 * {
 *   predictions: RestartPrediction[]
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

    // Fetch pre-calculated predictions from the database
    const supabase = createServerClient()

    const { data: predictions, error } = await supabase
      .from('server_restart_predictions')
      .select('*')
      .in('server_id', serverIds)

    if (error) {
      console.error('Error fetching restart predictions:', error)
      return NextResponse.json(
        { error: 'Failed to fetch restart predictions' },
        { status: 500 }
      )
    }

    // Map database records to RestartPrediction format
    const formattedPredictions: RestartPrediction[] = serverIds.map(serverId => {
      const dbPrediction = predictions?.find(p => p.server_id === serverId)

      if (!dbPrediction) {
        // Return empty prediction if not found
        return {
          serverId,
          nextRestartTime: null,
          confidence: 0,
          detectedPattern: null,
          lastRestartTime: null,
          averageDowntime: 0,
          detectedEvents: []
        }
      }

      return {
        serverId: dbPrediction.server_id,
        nextRestartTime: dbPrediction.next_restart_time,
        confidence: dbPrediction.confidence || 0,
        detectedPattern: dbPrediction.detected_pattern,
        lastRestartTime: dbPrediction.last_restart_time,
        averageDowntime: dbPrediction.average_downtime || 0,
        detectedEvents: [] // Not stored in DB, but available if needed
      }
    })

    return NextResponse.json({ predictions: formattedPredictions })
  } catch (error) {
    console.error('Error in restart prediction API:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

