"use client"

import { useState, useEffect, useCallback, useRef } from 'react'

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

export interface LiveServerData {
  fivem: LiveFiveMData | null
  twitch: LiveTwitchData | null
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
    fetchTwitch = true
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
   * Fetch live Twitch data
   */
  const fetchTwitchData = useCallback(async (ids: string[]): Promise<Record<string, LiveTwitchData>> => {
    if (ids.length === 0 || !fetchTwitch) return {}

    try {
      const response = await fetch(`/api/live/twitch?serverIds=${ids.join(',')}`)
      
      if (!response.ok) {
        throw new Error(`Twitch API error: ${response.status}`)
      }

      const data = await response.json()
      return data.servers || {}
    } catch (error) {
      console.error('Error fetching live Twitch data:', error)
      return {}
    }
  }, [fetchTwitch])

  /**
   * Fetch all live data
   */
  const fetchLiveData = useCallback(async () => {
    // Prevent concurrent fetches
    if (fetchInProgressRef.current) return
    fetchInProgressRef.current = true

    try {
      // Fetch FiveM and Twitch data in parallel
      const [fivemData, twitchData] = await Promise.all([
        fetchFiveMData(serverIds),
        fetchTwitchData(serverIds)
      ])

      if (!mountedRef.current) return

      // Merge data into server records
      const servers: Record<string, LiveServerData> = {}
      
      serverIds.forEach(serverId => {
        servers[serverId] = {
          fivem: fivemData[serverId] || null,
          twitch: twitchData[serverId] || null
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
  }, [serverIds, fetchFiveMData, fetchTwitchData])

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
} {
  const serverData = liveData.servers[serverId]
  
  if (!serverData) {
    return {
      currentPlayers: 0,
      maxCapacity: 0,
      streamCount: 0,
      viewerCount: 0,
      online: false,
      hasLiveData: false
    }
  }

  return {
    currentPlayers: serverData.fivem?.currentPlayers ?? 0,
    maxCapacity: serverData.fivem?.maxCapacity ?? 0,
    streamCount: serverData.twitch?.streamCount ?? 0,
    viewerCount: serverData.twitch?.viewerCount ?? 0,
    online: serverData.fivem?.online ?? false,
    hasLiveData: !!(serverData.fivem || serverData.twitch)
  }
}
