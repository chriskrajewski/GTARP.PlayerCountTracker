"use client";

import { useState, useEffect, useCallback, useRef } from 'react';

/**
 * Represents a detected restart event
 */
export interface RestartEvent {
  timestamp: string;
  playerCountBefore: number;
  playerCountAfter: number;
  downtime: number; // minutes
}

/**
 * Represents a server restart prediction
 */
export interface RestartPrediction {
  serverId: string;
  nextRestartTime: string | null;
  confidence: number;
  detectedPattern: string | null;
  lastRestartTime: string | null;
  averageDowntime: number;
  detectedEvents: RestartEvent[];
  patternType?: string;
  mlReasoning?: string;
  isStale?: boolean;
  cachedAt?: string;
  detectedEventsCount?: number;
}

/**
 * API response format
 */
interface RestartPredictionResponse {
  predictions: RestartPrediction[];
  source: 'cache' | 'ml' | 'fallback';
  timestamp: string;
}

/**
 * Hook to fetch and auto-refresh restart predictions for servers
 * @param serverIds - Array of server IDs to fetch predictions for
 * @param autoRefreshInterval - Interval in milliseconds to auto-refresh (default: 60000 = 1 minute)
 * @param enabled - Whether to enable auto-refresh (default: true)
 */
export function useRestartPredictions(
  serverIds: string[],
  autoRefreshInterval: number = 60000,
  enabled: boolean = true
) {
  const [predictions, setPredictions] = useState<Map<string, RestartPrediction>>(new Map());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const refreshIntervalRef = useRef<NodeJS.Timeout | null>(null);

  /**
   * Fetch predictions from the API
   */
  const fetchPredictions = useCallback(async () => {
    if (serverIds.length === 0) {
      setPredictions(new Map());
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const queryParams = new URLSearchParams({
        serverIds: serverIds.join(','),
      });

      const response = await fetch(`/api/restart-prediction?${queryParams}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch predictions: ${response.statusText}`);
      }

      const data: RestartPredictionResponse = await response.json();

      // Convert array to map for easier lookup
      const predictionMap = new Map<string, RestartPrediction>();
      data.predictions.forEach((pred) => {
        predictionMap.set(pred.serverId, pred);
      });

      setPredictions(predictionMap);
      setLastUpdated(new Date());
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMessage);
      console.error('Error fetching restart predictions:', err);
    } finally {
      setLoading(false);
    }
  }, [serverIds]);

  /**
   * Get prediction for a specific server
   */
  const getPrediction = useCallback(
    (serverId: string): RestartPrediction | undefined => {
      return predictions.get(serverId);
    },
    [predictions]
  );

  /**
   * Manually refresh predictions
   */
  const refresh = useCallback(async () => {
    await fetchPredictions();
  }, [fetchPredictions]);

  /**
   * Set up auto-refresh interval
   */
  useEffect(() => {
    if (!enabled || serverIds.length === 0) {
      if (refreshIntervalRef.current) {
        clearInterval(refreshIntervalRef.current);
        refreshIntervalRef.current = null;
      }
      return;
    }

    // Fetch immediately on mount
    fetchPredictions();

    // Set up interval for auto-refresh
    refreshIntervalRef.current = setInterval(() => {
      fetchPredictions();
    }, autoRefreshInterval);

    return () => {
      if (refreshIntervalRef.current) {
        clearInterval(refreshIntervalRef.current);
        refreshIntervalRef.current = null;
      }
    };
  }, [enabled, serverIds, autoRefreshInterval, fetchPredictions]);

  return {
    predictions,
    getPrediction,
    loading,
    error,
    lastUpdated,
    refresh,
  };
}
