'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { createBrowserClient } from '@/lib/supabase-browser';
import type { RealtimeChannel } from '@supabase/supabase-js';

/**
 * Live Visitor Data State
 * Source: PRD §8.2 SL-1 through SL-8
 */
export interface LiveVisitorData {
  total: number;
  humans: number;
  bots: number;
  lastUpdated: string;
}

/**
 * Hook Options
 * Source: PRD §4.1 FR-3, FR-5
 */
export interface UseLiveVisitorDataOptions {
  pollingInterval?: number; // Fallback polling interval in ms
  enabled?: boolean; // Enable/disable tracking
  onError?: (error: Error) => void;
}

/**
 * useLiveVisitorData Hook
 * 
 * READ-ONLY hook for admin panel to view visitor counts.
 * Source: PRD §4.1 FR-3, FR-8; Blueprint §5.1
 * 
 * IMPORTANT: This hook does NOT create sessions or send heartbeats.
 * Session management is handled by VisitorTrackingProvider in layout.tsx.
 * This hook only:
 * 1. Fetches current visitor count
 * 2. Subscribes to real-time count updates (FR-3)
 * 3. Falls back to polling if realtime unavailable
 */
export function useLiveVisitorData(
  options: UseLiveVisitorDataOptions = {}
) {
  const {
    pollingInterval = 30000, // 30 seconds - matches server polling
    enabled = true,
    onError
  } = options;

  // State Management
  const [visitorData, setVisitorData] = useState<LiveVisitorData>({
    total: 0,
    humans: 0,
    bots: 0,
    lastUpdated: new Date().toISOString()
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  // Refs for cleanup
  const realtimeChannelRef = useRef<RealtimeChannel | null>(null);
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);

  /**
   * Fetch current visitor count
   * Source: PRD §5.1 Story §5.1, §6.1 V-1
   * Implements: FR-2, FR-11
   */
  const fetchVisitorCount = useCallback(async () => {
    try {
      const response = await fetch('/api/visitors/count', {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' }
      });

      if (!response.ok) {
        throw new Error(`Count fetch failed: ${response.statusText}`);
      }

      const data = await response.json();
      setVisitorData({
        total: data.total || 0,
        humans: data.humans || 0,
        bots: data.bots || 0,
        lastUpdated: new Date().toISOString()
      });
      setError(null);
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      setError(error);
      onError?.(error);
    }
  }, [onError]);

  /**
   * Fallback polling when Realtime unavailable
   * Source: PRD §4.1 FR-3 (Realtime with polling fallback)
   */
  const startPolling = useCallback(() => {
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
    }

    pollingIntervalRef.current = setInterval(() => {
      fetchVisitorCount();
    }, pollingInterval);
  }, [fetchVisitorCount, pollingInterval]);

  /**
   * Setup Supabase Realtime subscription
   * Source: PRD §4.1 FR-3, §4.2 NFR-9
   * Implements: Instant updates when visitor count changes
   */
  const setupRealtimeSubscription = useCallback(() => {
    try {
      const supabase = createBrowserClient();
      
      // Subscribe to visitor_sessions table changes
      const channel = supabase
        .channel('visitor_sessions_changes', {
          config: {
            broadcast: { self: true },
            presence: { key: 'visitor_count' }
          }
        })
        .on(
          'postgres_changes',
          {
            event: '*', // Listen to all events (INSERT, UPDATE, DELETE)
            schema: 'public',
            table: 'visitor_sessions'
          },
          () => {
            // Refetch count on any change
            // Source: PRD §6.2 T-2 (Instant timing)
            fetchVisitorCount();
          }
        )
        .on('subscribe', () => {
          setIsConnected(true);
          setError(null);
        })
        .on('error', (err) => {
          console.warn('Realtime subscription error:', err);
          setIsConnected(false);
          // Fallback to polling
          startPolling();
        })
        .subscribe();

      realtimeChannelRef.current = channel;
    } catch (err) {
      console.warn('Realtime setup failed, using polling fallback:', err);
      setIsConnected(false);
      startPolling();
    }
  }, [fetchVisitorCount, startPolling]);

  /**
   * Initialize visitor count fetching (READ-ONLY - no session creation)
   * Source: PRD §4.1 FR-8 (Admin panel viewing)
   */
  useEffect(() => {
    if (!enabled) return;

    let isMounted = true;

    const initialize = async () => {
      try {
        setLoading(true);

        // Step 1: Fetch initial count
        // Source: PRD §6.1 V-1 (User sees count immediately)
        await fetchVisitorCount();
        
        if (!isMounted) return;

        // Step 2: Setup Realtime subscription
        // Source: PRD §4.1 FR-3 (Real-time updates)
        setupRealtimeSubscription();

        setLoading(false);
      } catch (err) {
        if (isMounted) {
          const error = err instanceof Error ? err : new Error(String(err));
          setError(error);
          onError?.(error);
          setLoading(false);
        }
      }
    };

    initialize();

    // Cleanup on unmount
    return () => {
      isMounted = false;

      // Clear polling interval
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
      }

      // Unsubscribe from Realtime
      if (realtimeChannelRef.current) {
        const supabase = createBrowserClient();
        supabase.removeChannel(realtimeChannelRef.current);
      }
    };
  }, [enabled, fetchVisitorCount, setupRealtimeSubscription, onError]);

  return {
    visitorData,
    loading,
    error,
    isConnected,
    refetch: fetchVisitorCount
  };
}

/**
 * Get live visitor stats from state
 * Source: PRD §5.1 Story §5.1
 * Implements: FR-2, FR-11
 */
export function getLiveVisitorStats(visitorData: LiveVisitorData) {
  return {
    totalVisitors: visitorData.total,
    humanVisitors: visitorData.humans,
    botVisitors: visitorData.bots,
    lastUpdated: visitorData.lastUpdated
  };
}
