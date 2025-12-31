'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { RestartPrediction, RestartPredictionResponse, getConfidenceLevel, formatMLReasoning } from '@/lib/restart-prediction'

export interface UseRestartPredictionOptions {
  /**
   * Polling interval in milliseconds (default: 5 minutes)
   */
  pollingInterval?: number
  /**
   * Whether to enable polling (default: true)
   */
  enabled?: boolean
  /**
   * Number of days to analyze (default: 14, max: 30)
   */
  daysBack?: number
  /**
   * Force refresh from ML model (bypasses cache)
   */
  forceRefresh?: boolean
}

export interface UseRestartPredictionState {
  predictions: Record<string, RestartPrediction>
  loading: boolean
  error: string | null
  lastFetch: Date | null
  /**
   * Source of the predictions: 'ml' (fresh ML), 'cache' (stale cache), 'fallback' (database only)
   */
  source: 'ml' | 'cache' | 'fallback' | null
  /**
   * Whether any predictions are stale (older than 15 minutes)
   */
  hasStaleData: boolean
}

/**
 * Custom hook for fetching and polling ML-enhanced server restart predictions
 * 
 * @param serverIds - Array of server IDs to fetch predictions for
 * @param options - Configuration options
 * @returns Prediction state and control functions
 */
export function useRestartPrediction(
  serverIds: string[],
  options: UseRestartPredictionOptions = {}
) {
  const {
    pollingInterval = 5 * 60 * 1000, // 5 minutes default
    enabled = true,
    daysBack = 14,
    forceRefresh = false
  } = options

  const [state, setState] = useState<UseRestartPredictionState>({
    predictions: {},
    loading: true,
    error: null,
    lastFetch: null,
    source: null,
    hasStaleData: false
  })

  // Track if component is mounted to prevent state updates after unmount
  const mountedRef = useRef(true)
  const pollingTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const fetchInProgressRef = useRef(false)

  /**
   * Fetch restart predictions from the API
   */
  const fetchPredictions = useCallback(async (force: boolean = false) => {
    // Prevent concurrent fetches
    if (fetchInProgressRef.current) return
    fetchInProgressRef.current = true

    try {
      if (serverIds.length === 0) {
        setState(prev => ({
          ...prev,
          predictions: {},
          loading: false,
          source: null,
          hasStaleData: false
        }))
        return
      }

      const params = new URLSearchParams({
        serverIds: serverIds.join(','),
        daysBack: daysBack.toString()
      })
      
      if (force || forceRefresh) {
        params.set('forceRefresh', 'true')
      }

      // Add cache-busting parameter to bypass CDN cache when forcing refresh
      if (force || forceRefresh) {
        params.set('_t', Date.now().toString())
      }

      const response = await fetch(`/api/restart-prediction?${params}`)

      if (!response.ok) {
        throw new Error(`API error: ${response.status}`)
      }

      const data: RestartPredictionResponse = await response.json()

      if (!mountedRef.current) return

      // Convert array to record keyed by serverId
      const predictionsRecord: Record<string, RestartPrediction> = {}
      let hasStale = false
      
      if (Array.isArray(data.predictions)) {
        data.predictions.forEach((pred: RestartPrediction) => {
          predictionsRecord[pred.serverId] = pred
          if (pred.isStale) {
            hasStale = true
          }
        })
      }

      setState(prev => ({
        ...prev,
        predictions: predictionsRecord,
        loading: false,
        error: null,
        lastFetch: new Date(),
        source: data.source || 'fallback',
        hasStaleData: hasStale
      }))
    } catch (error) {
      if (!mountedRef.current) return

      const errorMessage = error instanceof Error ? error.message : 'Failed to fetch predictions'
      console.error('Error fetching restart predictions:', errorMessage)

      setState(prev => ({
        ...prev,
        loading: false,
        error: errorMessage
      }))
    } finally {
      fetchInProgressRef.current = false
    }
  }, [serverIds, daysBack, forceRefresh])

  /**
   * Manual refresh function
   */
  const refresh = useCallback((force: boolean = false) => {
    setState(prev => ({ ...prev, loading: true }))
    fetchPredictions(force)
  }, [fetchPredictions])

  /**
   * Force refresh from ML model (bypasses cache)
   */
  const forceMLRefresh = useCallback(() => {
    refresh(true)
  }, [refresh])

  /**
   * Calculate time remaining until restart
   */
  const getTimeRemaining = useCallback((nextRestartTime: string | null): number | null => {
    if (!nextRestartTime) return null

    const now = new Date().getTime()
    const restartTime = new Date(nextRestartTime).getTime()
    const remaining = restartTime - now

    return remaining > 0 ? remaining : null
  }, [])

  /**
   * Format time remaining as human-readable string
   */
  const formatTimeRemaining = useCallback((milliseconds: number): string => {
    const totalSeconds = Math.floor(milliseconds / 1000)
    const hours = Math.floor(totalSeconds / 3600)
    const minutes = Math.floor((totalSeconds % 3600) / 60)
    const seconds = totalSeconds % 60

    if (hours > 0) {
      return `${hours}h ${minutes}m`
    } else if (minutes > 0) {
      return `${minutes}m ${seconds}s`
    } else {
      return `${seconds}s`
    }
  }, [])

  /**
   * Get prediction for a specific server
   */
  const getPrediction = useCallback((serverId: string): RestartPrediction | null => {
    return state.predictions[serverId] || null
  }, [state.predictions])

  /**
   * Get ML reasoning for a prediction
   */
  const getReasoning = useCallback((serverId: string): string => {
    const prediction = state.predictions[serverId]
    if (!prediction) return 'No prediction data available.'
    return formatMLReasoning(prediction)
  }, [state.predictions])

  /**
   * Get confidence level for a prediction
   */
  const getConfidence = useCallback((serverId: string): { level: 'high' | 'medium' | 'low' | 'none', value: number } => {
    const prediction = state.predictions[serverId]
    if (!prediction) return { level: 'none', value: 0 }
    return {
      level: getConfidenceLevel(prediction.confidence),
      value: prediction.confidence
    }
  }, [state.predictions])

  /**
   * Check if a prediction is stale
   */
  const isStale = useCallback((serverId: string): boolean => {
    const prediction = state.predictions[serverId]
    return prediction?.isStale ?? true
  }, [state.predictions])

  // Initial fetch and polling setup
  useEffect(() => {
    mountedRef.current = true

    if (!enabled || serverIds.length === 0) {
      setState(prev => ({
        ...prev,
        loading: false,
        predictions: {},
        source: null,
        hasStaleData: false
      }))
      return
    }

    // Initial fetch
    fetchPredictions()

    // Setup polling
    const startPolling = () => {
      pollingTimeoutRef.current = setTimeout(() => {
        if (mountedRef.current && enabled) {
          fetchPredictions()
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
  }, [serverIds.join(','), enabled, pollingInterval, fetchPredictions])

  return {
    ...state,
    refresh,
    forceMLRefresh,
    getTimeRemaining,
    formatTimeRemaining,
    getPrediction,
    getReasoning,
    getConfidence,
    isStale,
    isPolling: enabled && serverIds.length > 0
  }
}

/**
 * Get prediction for a specific server from the state
 */
export function getRestartPrediction(
  predictions: Record<string, RestartPrediction>,
  serverId: string
): RestartPrediction | null {
  return predictions[serverId] || null
}

/**
 * Hook to get countdown timer for a specific server's restart
 */
export function useRestartCountdown(
  prediction: RestartPrediction | null,
  updateInterval: number = 1000
) {
  const [timeRemaining, setTimeRemaining] = useState<number | null>(null)
  const [isExpired, setIsExpired] = useState(false)

  useEffect(() => {
    if (!prediction?.nextRestartTime) {
      setTimeRemaining(null)
      setIsExpired(false)
      return
    }

    const updateCountdown = () => {
      const now = Date.now()
      const restartTime = new Date(prediction.nextRestartTime!).getTime()
      const remaining = restartTime - now

      if (remaining <= 0) {
        setTimeRemaining(0)
        setIsExpired(true)
      } else {
        setTimeRemaining(remaining)
        setIsExpired(false)
      }
    }

    // Initial update
    updateCountdown()

    // Set up interval
    const interval = setInterval(updateCountdown, updateInterval)

    return () => clearInterval(interval)
  }, [prediction?.nextRestartTime, updateInterval])

  return {
    timeRemaining,
    isExpired,
    formatted: timeRemaining !== null ? formatCountdown(timeRemaining) : null
  }
}

/**
 * Format milliseconds as countdown string (HH:MM:SS or MM:SS)
 */
function formatCountdown(milliseconds: number): string {
  if (milliseconds <= 0) return '00:00'
  
  const totalSeconds = Math.floor(milliseconds / 1000)
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60

  if (hours > 0) {
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
  }
  return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
}
