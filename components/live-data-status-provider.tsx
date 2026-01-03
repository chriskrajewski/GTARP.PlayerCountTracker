"use client";

import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";

/**
 * Represents the current state of live data streaming
 */
export interface LiveDataStatus {
  isStreaming: boolean;
  lastFetch: Date | null;
  loading: boolean;
  activeServerCount: number;
  pollingInterval: number;
}

/**
 * Context for sharing live data status across the entire application
 */
const LiveDataStatusContext = createContext<{
  liveDataStatus: LiveDataStatus;
  setLiveDataStatus: (status: LiveDataStatus) => void;
} | undefined>(undefined);

/**
 * Default live data status when no data is available
 */
const DEFAULT_LIVE_DATA_STATUS: LiveDataStatus = {
  isStreaming: false,
  lastFetch: null,
  loading: false,
  activeServerCount: 0,
  pollingInterval: 30000
};

/**
 * Storage key for persisting live data status
 */
const STORAGE_KEY = "gtarp_live_data_status";

/**
 * Serialize live data status for storage
 */
function serializeStatus(status: LiveDataStatus): string {
  return JSON.stringify({
    ...status,
    lastFetch: status.lastFetch ? status.lastFetch.toISOString() : null
  });
}

/**
 * Deserialize live data status from storage
 */
function deserializeStatus(json: string): LiveDataStatus {
  try {
    const parsed = JSON.parse(json);
    return {
      ...parsed,
      lastFetch: parsed.lastFetch ? new Date(parsed.lastFetch) : null
    };
  } catch {
    return DEFAULT_LIVE_DATA_STATUS;
  }
}

/**
 * Provider component that manages live data status globally
 * 
 * This provider allows any component in the application to access
 * and update the live data streaming status without prop drilling.
 * 
 * The status is updated when the Dashboard component dispatches
 * the 'dashboardDataLoaded' event, and is persisted in localStorage
 * to survive page navigation.
 */
export function LiveDataStatusProvider({ children }: { children: ReactNode }) {
  const [liveDataStatus, setLiveDataStatusState] = useState<LiveDataStatus>(DEFAULT_LIVE_DATA_STATUS);

  // Initialize from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const status = deserializeStatus(stored);
        setLiveDataStatusState(status);
      }
    } catch (error) {
      console.error("Failed to load live data status from storage:", error);
    }
  }, []);

  /**
   * Update live data status and persist to localStorage
   */
  const setLiveDataStatus = (status: LiveDataStatus) => {
    setLiveDataStatusState(status);
    try {
      localStorage.setItem(STORAGE_KEY, serializeStatus(status));
    } catch (error) {
      console.error("Failed to save live data status to storage:", error);
    }
  };

  // Listen for dashboard data loaded event
  useEffect(() => {
    /**
     * Handle dashboard data loaded event
     * 
     * The Dashboard component dispatches this event whenever it updates
     * with new server data and live streaming information.
     */
    const handleDashboardDataLoaded = (event: any) => {
      if (event.detail?.liveDataStatus) {
        setLiveDataStatus(event.detail.liveDataStatus);
      }
    };

    window.addEventListener("dashboardDataLoaded", handleDashboardDataLoaded);

    return () => {
      window.removeEventListener("dashboardDataLoaded", handleDashboardDataLoaded);
    };
  }, []);

  return (
    <LiveDataStatusContext.Provider value={{ liveDataStatus, setLiveDataStatus }}>
      {children}
    </LiveDataStatusContext.Provider>
  );
}

/**
 * Hook to access the live data status from anywhere in the application
 * 
 * @returns The current live data status
 * @throws Error if used outside of LiveDataStatusProvider
 * 
 * @example
 * ```tsx
 * function MyComponent() {
 *   const { liveDataStatus } = useLiveDataStatus();
 *   return <div>{liveDataStatus.isStreaming ? 'Live' : 'Offline'}</div>;
 * }
 * ```
 */
export function useLiveDataStatus() {
  const context = useContext(LiveDataStatusContext);
  if (context === undefined) {
    throw new Error("useLiveDataStatus must be used within a LiveDataStatusProvider");
  }
  return context;
}
