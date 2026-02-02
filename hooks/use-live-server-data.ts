"use client"

import { useState, useEffect, useCallback, useRef } from 'react'
import { filterQueueEnabledServers, type QueueSegment } from '@/lib/server-queues'

/**
 * Live Server Data Types
 */
export interface LiveFiveMData {
  currentPlayers: number
  maxCapacity: number
  serverName: string
  online: boolean
  lastUpdated: string
  error?: string
}

export interface LiveTwitchStream {
  name: string
  viewers: number
  title: string
}

export interface LiveTwitchData {
  streamCount: number
  viewerCount: number
  topStreams: LiveTwitchStream[]
  lastUpdated: string
  error?: string
}

export interface LiveKickStream {
  name: string
  viewers: number
  title: string
}

export interface LiveKickData {
  streamCount: number
  viewerCount: number
  topStreams: LiveKickStream[]
  lastUpdated: string
  error?: string
}

export type LiveQueueSegment = QueueSegment

export interface LiveQueueData {
  totalPlayers: number
  segments: LiveQueueSegment[]
  lastUpdated: string
  error?: string
}

export interface LiveServerData {
  fivem: LiveFiveMData | null
  twitch: LiveTwitchData | null
  kick: LiveKickData | null
  queue: LiveQueueData | null
}

export interface LiveDataState {
  servers: Record<string, LiveServerData>
  loading: boolean
  error: string | null
  lastFetch: Date | null
}

interface UseLiveServerDataOptions {
  /**
   * Polling interval in milliseconds (default: 30000 = 30 seconds)
   */
  pollingInterval?: number
  /**
   * Whether to enable polling (default: true)
   */
  enabled?: boolean
  /**
   * Whether to fetch FiveM data (default: true)
   */
  fetchFiveM?: boolean
  /**
   * Whether to fetch Twitch data (default: true)
   */
  fetchTwitch?: boolean
  /**
   * Whether to fetch Kick data (default: true)
   */
  fetchKick?: boolean
  /**
   * Whether to fetch queue data when supported (default: true)
   */
  fetchQueue?: boolean
}

/**
 * Custom hook for fetching and polling live server data
 * 
 * This hook fetches real-time data directly from FiveM and Twitch APIs,
 * bypassing Supabase to provide instant updates not limited by ETL intervals.
 * 
 * @param serverIds - Array of server IDs to fetch data for
 * @param options - Configuration options
 * @returns Live data state and control functions
 */
export function useLiveServerData(
  serverIds: string[],
  options: UseLiveServerDataOptions = {}
) {
  const {
    pollingInterval = 30000, // 30 seconds default
    enabled = true,
    fetchFiveM = true,
    fetchTwitch = true,
    fetchKick = true,
    fetchQueue = true
  } = options

  const [state, setState] = useState<LiveDataState>({
    servers: {},
    loading: true,
    error: null,
    lastFetch: null
  })

  // Track if component is mounted to prevent state updates after unmount
  const mountedRef = useRef(true)
  const pollingTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const fetchInProgressRef = useRef(false)

  /**
   * Fetch live FiveM data
   */
  const fetchFiveMData = useCallback(async (ids: string[]): Promise<Record<string, LiveFiveMData>> => {
    if (ids.length === 0 || !fetchFiveM) return {}

    try {
      const response = await fetch(`/api/live/fivem?serverIds=${ids.join(',')}`)
      
      if (!response.ok) {
        throw new Error(`FiveM API error: ${response.status}`)
      }

      const data = await response.json()
      return data.servers || {}
    } catch (error) {
      console.error('Error fetching live FiveM data:', error)
      return {}
    }
  }, [fetchFiveM])

  /**
   * Fetch live stream data (Twitch + Kick combined)
   * Uses the same endpoint as the streams page to ensure consistent stream counts
   */
  const fetchStreamData = useCallback(async (ids: string[]): Promise<{
    twitch: Record<string, LiveTwitchData>,
    kick: Record<string, LiveKickData>
  }> => {
    if (ids.length === 0 || (!fetchTwitch && !fetchKick)) {
      return { twitch: {}, kick: {} }
    }

    const twitchResult: Record<string, LiveTwitchData> = {}
    const kickResult: Record<string, LiveKickData> = {}

    // Fetch from /api/streams/[serverId] for each server to ensure consistency
    // with the streams page display
    await Promise.all(ids.map(async (serverId) => {
      try {
        const response = await fetch(`/api/streams/${serverId}`)
        
        if (!response.ok) {
          console.error(`Streams API error for ${serverId}: ${response.status}`)
          return
        }

        const streams = await response.json()
        const now = new Date().toISOString()
        
        if (fetchTwitch) {
          // Filter to only Twitch streams and calculate counts
          const twitchStreams = Array.isArray(streams) 
            ? streams.filter((s: any) => s.platform === 'twitch')
            : []
          
          const streamCount = twitchStreams.length
          const viewerCount = twitchStreams.reduce((sum: number, s: any) => sum + (s.viewer_count || 0), 0)
          const topStreams = twitchStreams
            .slice(0, 5)
            .map((s: any) => ({
              name: s.user_name,
              viewers: s.viewer_count,
              title: s.title
            }))

          twitchResult[serverId] = {
            streamCount,
            viewerCount,
            topStreams,
            lastUpdated: now
          }
        }

        if (fetchKick) {
          // Filter to only Kick streams and calculate counts
          const kickStreams = Array.isArray(streams) 
            ? streams.filter((s: any) => s.platform === 'kick')
            : []
          
          const streamCount = kickStreams.length
          const viewerCount = kickStreams.reduce((sum: number, s: any) => sum + (s.viewer_count || 0), 0)
          const topStreams = kickStreams
            .slice(0, 5)
            .map((s: any) => ({
              name: s.user_name,
              viewers: s.viewer_count,
              title: s.title
            }))

          kickResult[serverId] = {
            streamCount,
            viewerCount,
            topStreams,
            lastUpdated: now
          }
        }
      } catch (error) {
        console.error(`Error fetching streams for ${serverId}:`, error)
      }
    }))

    return { twitch: twitchResult, kick: kickResult }
  }, [fetchTwitch, fetchKick])

  /**
   * Fetch live queue data
   */
  const fetchQueueData = useCallback(async (ids: string[]): Promise<Record<string, LiveQueueData>> => {
    if (ids.length === 0 || !fetchQueue) return {}

    const queueSupportedIds = filterQueueEnabledServers(ids)
    if (queueSupportedIds.length === 0) return {}

    try {
      const response = await fetch(`/api/live/queue?serverIds=${queueSupportedIds.join(',')}`)
      
      if (!response.ok) {
        throw new Error(`Queue API error: ${response.status}`)
      }

      const data = await response.json()
      return data.servers || {}
    } catch (error) {
      console.error('Error fetching live queue data:', error)
      return {}
    }
  }, [fetchQueue])

  /**
   * Fetch all live data
   */
  const fetchLiveData = useCallback(async () => {
    // Prevent concurrent fetches
    if (fetchInProgressRef.current) return
    fetchInProgressRef.current = true

    try {
      // Fetch FiveM, stream (Twitch+Kick combined), and queue data in parallel
      const [fivemData, streamData, queueData] = await Promise.all([
        fetchFiveMData(serverIds),
        fetchStreamData(serverIds),
        fetchQueueData(serverIds)
      ])

      if (!mountedRef.current) return

      // Merge data into server records, preserving previous queue data if new fetch failed
      const servers: Record<string, LiveServerData> = {}
      
      serverIds.forEach(serverId => {
        const prevQueue = state.servers[serverId]?.queue
        const newQueue = queueData[serverId]
        // Keep previous queue data if new data has error or is empty
        const shouldKeepPrevQueue = prevQueue && (!newQueue || newQueue.error)
        
        servers[serverId] = {
          fivem: fivemData[serverId] || null,
          twitch: streamData.twitch[serverId] || null,
          kick: streamData.kick[serverId] || null,
          queue: shouldKeepPrevQueue ? prevQueue : (newQueue || null)
        }
      })

      setState(prev => ({
        ...prev,
        servers,
        loading: false,
        error: null,
        lastFetch: new Date()
      }))
    } catch (error) {
      if (!mountedRef.current) return

      const errorMessage = error instanceof Error ? error.message : 'Failed to fetch live data'
      console.error('Error fetching live data:', errorMessage)
      
      setState(prev => ({
        ...prev,
        loading: false,
        error: errorMessage
      }))
    } finally {
      fetchInProgressRef.current = false
    }
  }, [serverIds, fetchFiveMData, fetchStreamData, fetchQueueData])

  /**
   * Manual refresh function
   */
  const refresh = useCallback(() => {
    setState(prev => ({ ...prev, loading: true }))
    fetchLiveData()
  }, [fetchLiveData])

  // Initial fetch and polling setup
  useEffect(() => {
    mountedRef.current = true

    if (!enabled || serverIds.length === 0) {
      setState(prev => ({
        ...prev,
        loading: false,
        servers: {}
      }))
      return
    }

    // Initial fetch
    fetchLiveData()

    // Setup polling
    const startPolling = () => {
      pollingTimeoutRef.current = setTimeout(() => {
        if (mountedRef.current && enabled) {
          fetchLiveData()
          startPolling()
        }
      }, pollingInterval)
    }

    startPolling()

    // Cleanup
    return () => {
      mountedRef.current = false
      if (pollingTimeoutRef.current) {
        clearTimeout(pollingTimeoutRef.current)
        pollingTimeoutRef.current = null
      }
    }
  }, [serverIds.join(','), enabled, pollingInterval, fetchLiveData])

  // Re-fetch when server selection changes
  useEffect(() => {
    if (enabled && serverIds.length > 0) {
      setState(prev => ({ ...prev, loading: true }))
      fetchLiveData()
    }
  }, [serverIds.join(',')])

  return {
    ...state,
    refresh,
    isPolling: enabled && serverIds.length > 0
  }
}

/**
 * Get live data for a specific server from the state
 */
export function getLiveServerStats(
  liveData: LiveDataState,
  serverId: string
): {
  currentPlayers: number
  maxCapacity: number
  streamCount: number
  viewerCount: number
  online: boolean
  hasLiveData: boolean
  queuePlayers: number
} {
  const serverData = liveData.servers[serverId]
  
  if (!serverData) {
    return {
      currentPlayers: 0,
      maxCapacity: 0,
      streamCount: 0,
      viewerCount: 0,
      online: false,
      hasLiveData: false,
      queuePlayers: 0
    }
  }

  // Aggregate streams and viewers from both Twitch and Kick
  const twitchStreams = serverData.twitch?.streamCount ?? 0
  const kickStreams = serverData.kick?.streamCount ?? 0
  const twitchViewers = serverData.twitch?.viewerCount ?? 0
  const kickViewers = serverData.kick?.viewerCount ?? 0

  return {
    currentPlayers: serverData.fivem?.currentPlayers ?? 0,
    maxCapacity: serverData.fivem?.maxCapacity ?? 0,
    streamCount: twitchStreams + kickStreams,
    viewerCount: twitchViewers + kickViewers,
    online: serverData.fivem?.online ?? false,
    hasLiveData: !!(serverData.fivem || serverData.twitch || serverData.kick || serverData.queue),
    queuePlayers: serverData.queue?.totalPlayers ?? 0
  }
}
