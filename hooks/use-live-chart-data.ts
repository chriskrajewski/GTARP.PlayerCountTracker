"use client"

import { useState, useEffect, useCallback, useRef } from 'react'
import {
  getPlayerCounts,
  getServerCapacities,
  type PlayerCountData,
  type ServerCapacityData
} from '@/lib/data'

/**
 * A single live data point collected from the FiveM API
 */
interface LiveDataPoint {
  timestamp: string
  serverData: Record<string, {
    currentPlayers: number
    maxCapacity: number
    online: boolean
  }>
}

interface UseLiveChartDataOptions {
  /** Polling interval in milliseconds (default: 60000 = 1 minute) */
  pollingInterval?: number
  /** Maximum number of data points to keep in memory (default: 240) */
  maxDataPoints?: number
  /** Whether live mode is active */
  enabled?: boolean
}

interface LiveChartDataState {
  /** Player count data formatted for the chart (historical + live) */
  playerData: PlayerCountData[]
  /** Capacity data formatted for the chart */
  capacityData: ServerCapacityData[]
  /** Whether the initial historical load is in progress */
  loading: boolean
  /** Error message if any */
  error: string | null
  /** Timestamp of the last live data point */
  lastUpdate: Date | null
  /** Total number of data points (historical + live) */
  dataPointCount: number
  /** Whether polling is active */
  isPolling: boolean
  /** Current live player counts per server (for the "price" display) */
  currentCounts: Record<string, number>
  /** Polling interval in ms (echoed back for countdown) */
  pollingIntervalMs: number
}

/**
 * Hook that preloads 1 hour of historical data, then polls FiveM and appends
 * new data points in real time — giving the chart a TradingView feel where
 * you see history on the left and the live edge on the right.
 */
export function useLiveChartData(
  serverIds: string[],
  options: UseLiveChartDataOptions = {}
) {
  const {
    pollingInterval = 60000,
    maxDataPoints = 240,
    enabled = false
  } = options

  const [state, setState] = useState<LiveChartDataState>({
    playerData: [],
    capacityData: [],
    loading: true,
    error: null,
    lastUpdate: null,
    dataPointCount: 0,
    isPolling: false,
    currentCounts: {},
    pollingIntervalMs: pollingInterval
  })

  // Accumulated live data points (appended after historical)
  const livePointsRef = useRef<LiveDataPoint[]>([])
  // Historical data loaded once on activation
  const historicalPlayerRef = useRef<PlayerCountData[]>([])
  const historicalCapacityRef = useRef<ServerCapacityData[]>([])
  const mountedRef = useRef(true)
  const pollingTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const fetchInProgressRef = useRef(false)
  const historicalLoadedRef = useRef(false)

  /** Merge historical + live into chart-ready arrays */
  const buildChartData = useCallback((ids: string[]) => {
    const livePlayer: PlayerCountData[] = []
    const liveCapacity: ServerCapacityData[] = []

    for (const point of livePointsRef.current) {
      for (const serverId of ids) {
        const info = point.serverData[serverId]
        if (info) {
          livePlayer.push({
            timestamp: point.timestamp,
            player_count: info.currentPlayers,
            server_id: serverId
          })
          liveCapacity.push({
            timestamp: point.timestamp,
            max_capacity: info.maxCapacity,
            server_id: serverId
          })
        }
      }
    }

    return {
      playerData: [...historicalPlayerRef.current, ...livePlayer],
      capacityData: [...historicalCapacityRef.current, ...liveCapacity]
    }
  }, [])

  /** Fetch one data point from FiveM and accumulate */
  const fetchAndAccumulate = useCallback(async () => {
    if (fetchInProgressRef.current || serverIds.length === 0) return
    fetchInProgressRef.current = true

    try {
      const response = await fetch(`/api/live/fivem?serverIds=${serverIds.join(',')}`)
      if (!response.ok) throw new Error(`FiveM API error: ${response.status}`)

      const data = await response.json()
      const servers = data.servers || {}
      const now = new Date().toISOString()

      const dataPoint: LiveDataPoint = { timestamp: now, serverData: {} }
      const currentCounts: Record<string, number> = {}

      for (const serverId of serverIds) {
        const info = servers[serverId]
        if (info) {
          dataPoint.serverData[serverId] = {
            currentPlayers: info.currentPlayers ?? 0,
            maxCapacity: info.maxCapacity ?? 0,
            online: info.online ?? false
          }
          currentCounts[serverId] = info.currentPlayers ?? 0
        }
      }

      livePointsRef.current.push(dataPoint)

      // Trim combined length
      const totalHistorical = historicalPlayerRef.current.length
      const maxLive = Math.max(10, maxDataPoints - Math.floor(totalHistorical / serverIds.length))
      if (livePointsRef.current.length > maxLive) {
        livePointsRef.current = livePointsRef.current.slice(-maxLive)
      }

      if (!mountedRef.current) return

      const { playerData, capacityData } = buildChartData(serverIds)

      setState(prev => ({
        ...prev,
        playerData,
        capacityData,
        loading: false,
        error: null,
        lastUpdate: new Date(),
        dataPointCount: playerData.length,
        isPolling: true,
        currentCounts,
        pollingIntervalMs: pollingInterval
      }))
    } catch (error) {
      if (!mountedRef.current) return
      const msg = error instanceof Error ? error.message : 'Failed to fetch live data'
      console.error('Live chart data error:', msg)
      setState(prev => ({ ...prev, loading: false, error: msg }))
    } finally {
      fetchInProgressRef.current = false
    }
  }, [serverIds, maxDataPoints, pollingInterval, buildChartData])

  /** Load 1h of historical data from the database */
  const loadHistorical = useCallback(async (ids: string[]) => {
    try {
      const [playerData, capacityData] = await Promise.all([
        getPlayerCounts(ids, '1h'),
        getServerCapacities(ids, '1h')
      ])
      historicalPlayerRef.current = playerData
      historicalCapacityRef.current = capacityData
      historicalLoadedRef.current = true

      if (!mountedRef.current) return

      // Show historical data immediately while first live poll is in-flight
      const { playerData: merged, capacityData: mergedCap } = buildChartData(ids)
      setState(prev => ({
        ...prev,
        playerData: merged,
        capacityData: mergedCap,
        loading: false,
        dataPointCount: merged.length
      }))
    } catch (err) {
      console.warn('Failed to load historical data for live chart:', err)
      historicalLoadedRef.current = true
      // Not fatal — live polling will still work
    }
  }, [buildChartData])

  /** Clear all data */
  const clear = useCallback(() => {
    livePointsRef.current = []
    historicalPlayerRef.current = []
    historicalCapacityRef.current = []
    historicalLoadedRef.current = false
    setState({
      playerData: [],
      capacityData: [],
      loading: true,
      error: null,
      lastUpdate: null,
      dataPointCount: 0,
      isPolling: false,
      currentCounts: {},
      pollingIntervalMs: pollingInterval
    })
  }, [pollingInterval])

  // Main lifecycle
  useEffect(() => {
    mountedRef.current = true

    if (!enabled || serverIds.length === 0) {
      if (pollingTimeoutRef.current) {
        clearTimeout(pollingTimeoutRef.current)
        pollingTimeoutRef.current = null
      }
      setState(prev => ({ ...prev, loading: false, isPolling: false }))
      return
    }

    // Reset on server change
    livePointsRef.current = []
    historicalPlayerRef.current = []
    historicalCapacityRef.current = []
    historicalLoadedRef.current = false
    setState(prev => ({
      ...prev,
      loading: true,
      playerData: [],
      capacityData: [],
      dataPointCount: 0,
      currentCounts: {}
    }))

    // Load historical, then start polling
    const init = async () => {
      await loadHistorical(serverIds)
      if (!mountedRef.current) return
      // First live fetch
      await fetchAndAccumulate()
      if (!mountedRef.current) return
      // Start polling loop
      const poll = () => {
        pollingTimeoutRef.current = setTimeout(async () => {
          if (!mountedRef.current || !enabled) return
          await fetchAndAccumulate()
          poll()
        }, pollingInterval)
      }
      poll()
    }

    init()

    return () => {
      mountedRef.current = false
      if (pollingTimeoutRef.current) {
        clearTimeout(pollingTimeoutRef.current)
        pollingTimeoutRef.current = null
      }
    }
  }, [serverIds.join(','), enabled, pollingInterval, fetchAndAccumulate, loadHistorical])

  return { ...state, clear }
}
