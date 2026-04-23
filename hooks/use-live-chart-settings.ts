"use client"

import { useState, useEffect } from 'react'

const DEFAULT_POLLING_INTERVAL = 60 // seconds
const SETTINGS_CACHE_KEY = 'liveChartPollingInterval'
const SETTINGS_CACHE_TTL = 5 * 60 * 1000 // 5 minutes

interface CachedSetting {
  value: number
  timestamp: number
}

/**
 * Hook to load the live chart polling interval from admin settings.
 * Falls back to 60 seconds if the setting is not configured.
 * Caches the value in localStorage to avoid repeated API calls.
 */
export function useLiveChartSettings() {
  const [pollingInterval, setPollingInterval] = useState(DEFAULT_POLLING_INTERVAL * 1000) // ms

  useEffect(() => {
    // Check localStorage cache first
    try {
      const cached = localStorage.getItem(SETTINGS_CACHE_KEY)
      if (cached) {
        const parsed: CachedSetting = JSON.parse(cached)
        if (Date.now() - parsed.timestamp < SETTINGS_CACHE_TTL) {
          setPollingInterval(parsed.value * 1000)
          return
        }
      }
    } catch {
      // Ignore cache errors
    }

    // Fetch from API
    async function loadSetting() {
      try {
        const response = await fetch('/api/admin/settings?category=chart')
        if (!response.ok) return

        const data = await response.json()
        const setting = data.data?.find((item: { key: string }) => item.key === 'live_chart_polling_interval')
        
        if (setting) {
          const seconds = Number(setting.value)
          if (Number.isFinite(seconds) && seconds >= 10 && seconds <= 300) {
            setPollingInterval(seconds * 1000)
            // Cache the value
            localStorage.setItem(SETTINGS_CACHE_KEY, JSON.stringify({
              value: seconds,
              timestamp: Date.now()
            }))
            return
          }
        }
      } catch {
        // Fall back to default on error
      }
    }

    loadSetting()
  }, [])

  return { pollingInterval }
}
