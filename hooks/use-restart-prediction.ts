'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { RestartPrediction } from '@/lib/restart-prediction'

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
}

export interface UseRestartPredictionState {
  predictions: Record<string, RestartPrediction>
  loading: boolean
  error: string | null
  lastFetch: Date | null
}

/**
 * Custom hook for fetching and polling server restart predictions
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
    daysBack = 14
  } = options

  const [state, setState] = useState<UseRestartPredictionState>({
    predictions: {},
    loading: true,
    error: null,
    lastFetch: null
  })

  // Track if component is mounted to prevent state updates after unmount
  const mountedRef = useRef(true)
  const pollingTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const fetchInProgressRef = useRef(false)

  /**
   * Fetch restart predictions from the API
   */
  const fetchPredictions = useCallback(async () => {
    // Prevent concurrent fetches
    if (fetchInProgressRef.current) return
    fetchInProgressRef.current = true

    try {
      if (serverIds.length === 0) {
        setState(prev => ({
          ...prev,
          predictions: {},
          loading: false
        }))
        return
      }

      const response = await fetch(
        `/api/restart-prediction?serverIds=${serverIds.join(',')}&daysBack=${daysBack}`
      )

      if (!response.ok) {
        throw new Error(`API error: ${response.status}`)
      }

      const data = await response.json()

      if (!mountedRef.current) return

      // Convert array to record keyed by serverId
      const predictionsRecord: Record<string, RestartPrediction> = {}
      if (Array.isArray(data.predictions)) {
        data.predictions.forEach((pred: RestartPrediction) => {
          predictionsRecord[pred.serverId] = pred
        })
      }

      setState(prev => ({
        ...prev,
        predictions: predictionsRecord,
        loading: false,
        error: null,
        lastFetch: new Date()
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
  }, [serverIds, daysBack])

  /**
   * Manual refresh function
   */
  const refresh = useCallback(() => {
    setState(prev => ({ ...prev, loading: true }))
    fetchPredictions()
  }, [fetchPredictions])

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

  // Initial fetch and polling setup
  useEffect(() => {
    mountedRef.current = true

    if (!enabled || serverIds.length === 0) {
      setState(prev => ({
        ...prev,
        loading: false,
        predictions: {}
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
    getTimeRemaining,
    formatTimeRemaining,
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

