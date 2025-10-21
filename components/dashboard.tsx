"use client"

import { useState, useEffect, useMemo, useRef } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { RefreshCw, Loader2, Share2 } from "lucide-react"
import {
  getServers,
  getPlayerCountsSmart,
  aggregateDataForChart,
  getStreamCounts,
  getViewerCounts,
  getServerResourceChanges,
  getServerResourceSnapshot,
  type TimeRange,
  type ServerData,
  type PlayerCountData,
  type StreamCountData,
  type ViewerCountData,
  type ServerResourceChange,
  type ServerResourceSnapshot
} from "@/lib/data"
import PlayerCountChart from "./player-count-chart"
import ServerStatsCards from "./server-stats-cards"
import { MultiServerSelect } from "./multi-server-select"
import { trackServerSelect, trackTimeRangeSelect } from "@/lib/gtag"
import { ServerLatestAssetsCard, ServerResourceChangesCard, ServerResourceListCard } from "./server-resource-panels"
import { useRouter, usePathname } from "next/navigation"
import {
  buildServerSlugMaps,
  buildServerPrefixes,
  buildSlugLookup,
  resolveServerTokens,
  encodeServerTokens,
  decodeServerTokenString,
} from "@/lib/server-slugs"

// Local storage key for saving server selection
const SELECTED_SERVERS_KEY = "selectedServers"
const DEFAULT_TIME_RANGE: TimeRange = "8h"
const VALID_TIME_RANGES: TimeRange[] = [
  "1h",
  "2h",
  "4h",
  "6h",
  "8h",
  "24h",
  "7d",
  "30d",
  "90d",
  "180d",
  "365d",
  "all",
]

const SHORT_LINK_PARAM = "s"

type ShareStatus = "copied" | "shared" | "error" | null

const TIME_RANGE_CODES: Record<TimeRange, string> = {
  "1h": "1h",
  "2h": "2h",
  "4h": "4h",
  "6h": "6h",
  "8h": "8h",
  "24h": "1d",
  "7d": "7d",
  "30d": "30d",
  "90d": "3m",
  "180d": "6m",
  "365d": "1y",
  all: "all",
}

const CODE_TO_TIME_RANGE = Object.fromEntries(
  Object.entries(TIME_RANGE_CODES).map(([range, code]) => [code.toLowerCase(), range as TimeRange]),
) as Record<string, TimeRange>

const encodeSharePayload = (
  serverIds: string[],
  timeRange: TimeRange,
  prefixMap: Record<string, string>,
): string => {
  if (serverIds.length === 0) {
    return ""
  }

  const tokenPart = encodeServerTokens(serverIds, prefixMap)

  const timeToken = (TIME_RANGE_CODES[timeRange] ?? timeRange).toLowerCase()

  return `${tokenPart}.${timeToken}`
}

const normalizeUrlSafeBase64 = (value: string): string => {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/")
  const padding = normalized.length % 4 === 0 ? 0 : 4 - (normalized.length % 4)
  return normalized + "=".repeat(padding)
}

const decodeSharePayload = (
  value: string,
): { tokens: string[]; timeRange: TimeRange | null } | null => {
  if (!value) return null

  let serversPart = value
  let rangePart = ""

  if (value.includes(".")) {
    const lastDot = value.lastIndexOf(".")
    serversPart = value.slice(0, lastDot)
    rangePart = value.slice(lastDot + 1)
  } else if (value.includes("@")) {
    const [servers, range] = value.split("@")
    serversPart = servers || ""
    rangePart = range || ""
  }

  let tokens = decodeServerTokenString(serversPart)

  let timeRange: TimeRange | null = null
  if (rangePart) {
    const normalizedRange = rangePart.toLowerCase()
    timeRange =
      CODE_TO_TIME_RANGE[normalizedRange] ??
      (VALID_TIME_RANGES.includes(rangePart as TimeRange) ? (rangePart as TimeRange) : null)
  }

  if (tokens.length === 0 && typeof window !== "undefined") {
    try {
      const decoded = window.atob(normalizeUrlSafeBase64(value))
      const parsed = JSON.parse(decoded) as { s?: unknown; r?: unknown }

      if (Array.isArray(parsed.s)) {
        tokens = parsed.s.filter((id): id is string => typeof id === "string")
      }

      if (!timeRange && typeof parsed.r === "string" && VALID_TIME_RANGES.includes(parsed.r as TimeRange)) {
        timeRange = parsed.r as TimeRange
      }
    } catch (error) {
      // Ignore legacy decoding errors
    }
  }

  return { tokens, timeRange }
}

export default function Dashboard() {
  const [servers, setServers] = useState<ServerData[]>([])
  const [selectedServers, setSelectedServers] = useState<string[]>([])
  const [timeRange, setTimeRange] = useState<TimeRange>(DEFAULT_TIME_RANGE)
  const [playerData, setPlayerData] = useState<PlayerCountData[]>([])
  // Always current (24h) stream and view data - not affected by time range
  const [currentStreamData, setCurrentStreamData] = useState<StreamCountData[]>([])
  const [currentViewData, setCurrentViewData] = useState<ViewerCountData[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)
  const [chartLoading, setChartLoading] = useState(false)
  const [resourceChanges, setResourceChanges] = useState<ServerResourceChange[]>([])
  const [resourceSnapshot, setResourceSnapshot] = useState<ServerResourceSnapshot | null>(null)
  const [resourceLoading, setResourceLoading] = useState(false)
  const [resourceError, setResourceError] = useState<string | null>(null)
  const [shareStatus, setShareStatus] = useState<ShareStatus>(null)
  const shareResetTimeout = useRef<ReturnType<typeof setTimeout> | null>(null)

  const router = useRouter()
  const pathname = usePathname()

  const slugMaps = useMemo(() => buildServerSlugMaps(servers), [servers])
  const slugLookup = useMemo(() => buildSlugLookup(servers, slugMaps), [servers, slugMaps])
  const serverPrefixes = useMemo(() => buildServerPrefixes(servers, slugLookup), [servers, slugLookup])

  useEffect(() => {
    async function loadServers() {
      try {
        const serverData = await getServers()
        setServers(serverData)

        let selectionApplied = false
        let pendingTimeRange: TimeRange | null = null
        const maps = buildServerSlugMaps(serverData)
        const slugLookupForData = buildSlugLookup(serverData, maps)

        if (typeof window !== "undefined") {
          const url = new URL(window.location.href)
          const shortParam = url.searchParams.get(SHORT_LINK_PARAM)
          const serversParam = url.searchParams.get("servers")
          const rangeParam = url.searchParams.get("range")

          if (shortParam) {
            const decoded = decodeSharePayload(shortParam)
            if (decoded) {
              const resolvedFromShort = resolveServerTokens(
                decoded.tokens,
                maps,
                serverData,
                slugLookupForData,
              )

              if (resolvedFromShort.length > 0) {
                setSelectedServers(resolvedFromShort)
                selectionApplied = true
              }

              if (decoded.timeRange) {
                pendingTimeRange = decoded.timeRange
              }
            }
          }

          if (!selectionApplied && serversParam) {
            const tokens = serversParam
              .split(",")
              .map((token) => token.trim())
              .filter(Boolean)
            const resolved = resolveServerTokens(tokens, maps, serverData, slugLookupForData)
            if (resolved.length > 0) {
              setSelectedServers(resolved)
              selectionApplied = true
            }
          }

          if (!pendingTimeRange && rangeParam && VALID_TIME_RANGES.includes(rangeParam as TimeRange)) {
            pendingTimeRange = rangeParam as TimeRange
          }

          if (!selectionApplied) {
            const savedSelection = localStorage.getItem(SELECTED_SERVERS_KEY)
            if (savedSelection) {
              try {
                const parsedSelection = JSON.parse(savedSelection)
                const validSavedServers = parsedSelection.filter((id: string) =>
                  serverData.some((server) => server.server_id === id),
                )

                if (validSavedServers.length > 0) {
                  setSelectedServers(validSavedServers)
                  selectionApplied = true
                }
              } catch (e) {
                console.warn("Failed to parse saved server selection", e)
              }
            }
          }

          if (pendingTimeRange && pendingTimeRange !== timeRange) {
            setTimeRange(pendingTimeRange)
          }
        }

        if (!selectionApplied && serverData.length > 0) {
          setSelectedServers([serverData[0].server_id])
        }

        setLoading(false)
      } catch (err) {
        console.error("Error loading servers:", err)
        setError("Failed to load servers. Please check your connection and try again.")
        setLoading(false)
      }
    }

    loadServers()
  }, [])

  // Load stream and viewer counts - separate from player data
  const loadStreamAndViewData = async () => {
    if (selectedServers.length === 0) return

    try {
      // Always use "24h" for streamer and viewer counts to get current data
      const streamData = await getStreamCounts(selectedServers, "1h");
      const viewData = await getViewerCounts(selectedServers, "1h");
      
      setCurrentStreamData(streamData);
      setCurrentViewData(viewData);
    } catch (err) {
      console.error("Error loading stream and viewer data:", err)
    }
  }

  // Load player data - affected by time range
  const loadPlayerData = async () => {
    if (selectedServers.length === 0) return

    try {
      setChartLoading(true);
      setRefreshing(true);
      
      // Player counts are affected by time range - use smart fetching for large datasets
      const data = await getPlayerCountsSmart(selectedServers, timeRange);
      setPlayerData(data);
      
      setChartLoading(false);
      setRefreshing(false);
    } catch (err) {
      console.error("Error loading player data:", err)
      setError("Failed to load player data. Please check your connection and try again.")
      setChartLoading(false);
      setRefreshing(false);
    }
  }

  // Update player data when time range or server selection changes
  useEffect(() => {
    loadPlayerData()
  }, [selectedServers, timeRange])

  // Update stream and viewer data only when server selection changes
  useEffect(() => {
    loadStreamAndViewData()
  }, [selectedServers])

  useEffect(() => {
    let isMounted = true

    const loadServerResources = async (serverId: string) => {
      setResourceLoading(true)
      setResourceError(null)

      const [changesResult, snapshotResult] = await Promise.allSettled([
        getServerResourceChanges(serverId, 25),
        getServerResourceSnapshot(serverId)
      ])

      if (!isMounted) {
        return
      }

      let errorMessage: string | null = null

      if (changesResult.status === "fulfilled") {
        setResourceChanges(changesResult.value)
      } else {
        console.error("Error loading server resource changes:", changesResult.reason)
        setResourceChanges([])
        errorMessage = "Failed to load recent server changes."
      }

      if (snapshotResult.status === "fulfilled") {
        setResourceSnapshot(snapshotResult.value)
      } else {
        console.error("Error loading server resource snapshot:", snapshotResult.reason)
        setResourceSnapshot(null)
        errorMessage = errorMessage
          ? "Failed to load some server resource information."
          : "Failed to load server resource list."
      }

      setResourceError(errorMessage)
      setResourceLoading(false)
    }

    if (selectedServers.length === 1) {
      loadServerResources(selectedServers[0])
    } else if (isMounted) {
      setResourceChanges([])
      setResourceSnapshot(null)
      setResourceError(null)
      setResourceLoading(false)
    }

    return () => {
      isMounted = false
    }
  }, [selectedServers])

  // Save selected servers to localStorage whenever they change
  useEffect(() => {
    if (selectedServers.length > 0) {
      localStorage.setItem(SELECTED_SERVERS_KEY, JSON.stringify(selectedServers))
    }
  }, [selectedServers])

  useEffect(() => {
    if (typeof window === "undefined") return
    if (servers.length === 0) return

    const params = new URLSearchParams(window.location.search)
    let updated = false

    if (selectedServers.length > 0) {
      const encoded = encodeSharePayload(selectedServers, timeRange, serverPrefixes)
      if (encoded && params.get(SHORT_LINK_PARAM) !== encoded) {
        params.set(SHORT_LINK_PARAM, encoded)
        updated = true
      }
    } else if (params.has(SHORT_LINK_PARAM)) {
      params.delete(SHORT_LINK_PARAM)
      updated = true
    }

    if (params.has("servers")) {
      params.delete("servers")
      updated = true
    }

    if (params.has("range")) {
      params.delete("range")
      updated = true
    }

    if (!updated) {
      return
    }

    const nextSearch = params.toString()
    router.replace(`${pathname}${nextSearch ? `?${nextSearch}` : ""}`, { scroll: false })
  }, [selectedServers, timeRange, pathname, router, servers.length, serverPrefixes])

  // Update parent component with servers and selected servers
  useEffect(() => {
    if (typeof window !== 'undefined' && servers.length > 0) {
      // This makes the servers and selectedServers available to the CommonLayout
      // Use a custom event to communicate with the parent component
      const event = new CustomEvent('dashboardDataLoaded', { 
        detail: { 
          servers,
          selectedServers
        } 
      });
      window.dispatchEvent(event);
    }
  }, [servers, selectedServers]);

  useEffect(() => {
    return () => {
      if (shareResetTimeout.current) {
        clearTimeout(shareResetTimeout.current)
      }
    }
  }, [])

  const handleServerChange = (servers: string[]) => {
    setSelectedServers(servers)
    
    // Track server selection in Google Analytics
    if (servers.length > 0) {
      const serverNames = servers.map(serverId => 
        getServerNameById(serverId)
      ).join(', ')
      trackServerSelect(servers.join(','), serverNames)
    }
  }

  const handleTimeRangeChange = (value: string) => {
    setTimeRange(value as TimeRange)
    
    // Track time range selection in Google Analytics
    trackTimeRangeSelect(value)
  }

  const handleRefresh = () => {
    loadPlayerData()
    loadStreamAndViewData()
  }

  const buildShareableUrl = (): string => {
    if (typeof window === "undefined") return ""

    const url = new URL(window.location.href)
    if (selectedServers.length === 0) {
      url.searchParams.delete(SHORT_LINK_PARAM)
      url.searchParams.delete("servers")
      url.searchParams.delete("range")
      return url.toString()
    }
    const encoded = encodeSharePayload(selectedServers, timeRange, serverPrefixes)
    if (encoded) {
      url.searchParams.set(SHORT_LINK_PARAM, encoded)
    } else {
      url.searchParams.delete(SHORT_LINK_PARAM)
    }
    url.searchParams.delete("servers")
    url.searchParams.delete("range")

    return url.toString()
  }

  const scheduleShareReset = (status: ShareStatus, duration = 2500) => {
    if (shareResetTimeout.current) {
      clearTimeout(shareResetTimeout.current)
    }
    setShareStatus(status)

    if (status) {
      shareResetTimeout.current = setTimeout(() => {
        setShareStatus(null)
        shareResetTimeout.current = null
      }, duration)
    }
  }

  const handleShare = async () => {
    const shareUrl = buildShareableUrl()
    if (!shareUrl) return

    const canUseNativeShare = typeof navigator !== "undefined" && typeof navigator.share === "function"

    if (canUseNativeShare) {
      try {
        await navigator.share({ url: shareUrl, title: "GTA RP Player Count Tracker" })
        scheduleShareReset("shared")
        return
      } catch (error: any) {
        if (error?.name === "AbortError") {
          scheduleShareReset(null)
          return
        }
        console.warn("Native share failed, using clipboard fallback", error)
      }
    }

    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(shareUrl)
        scheduleShareReset("copied")
      } else {
        window.prompt("Copy this link", shareUrl)
        scheduleShareReset("copied")
      }
    } catch (error) {
      console.error("Error copying share link:", error)
      scheduleShareReset("error", 4000)
    }
  }

  const chartData = aggregateDataForChart(playerData, selectedServers, timeRange)

  const singleServerId = selectedServers.length === 1 ? selectedServers[0] : null
  const singleServerName = singleServerId ? getServerNameById(singleServerId) : ""
  const latestResourceChange = resourceChanges.length > 0 ? resourceChanges[0] : null

  const shareStatusMessage =
    shareStatus === "copied"
      ? "Link ready—copied to your clipboard when supported."
      : shareStatus === "shared"
        ? "Share dialog opened—send it to a friend."
        : shareStatus === "error"
          ? "Couldn't share the link. Please try again."
          : ""

  const shareStatusClass =
    shareStatus === "error" ? "text-red-400" : shareStatus ? "text-emerald-400" : ""

  


  // Get server name by ID
  function getServerNameById(serverId: string): string {
    const server = servers.find(s => s.server_id === serverId)
    return server ? server.server_name : `Server ${serverId}`
  }

  // Create a mapping of server IDs to names for the chart
  const serverNameMap = selectedServers.reduce((acc, serverId) => {
    acc[serverId] = getServerNameById(serverId)
    return acc
  }, {} as Record<string, string>)

  if (error) {
    return (
      <div className="p-4 bg-gray-800 border border-gray-700 rounded-md text-red-400">
        <h3 className="font-bold">Error</h3>
        <p>{error}</p>
        <p className="mt-2 text-sm">Please check that your Supabase environment variables are correctly set up.</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-col sm:flex-row gap-2 items-start sm:items-center">
          <MultiServerSelect
            servers={servers}
            selectedServers={selectedServers}
            onChange={handleServerChange}
            disabled={loading || servers.length === 0}
          />
          <div className="flex flex-col gap-1">
            <div className="flex gap-2">
              <Button 
                variant="outline" 
                size="icon" 
                onClick={handleRefresh} 
                disabled={loading || refreshing || chartLoading || selectedServers.length === 0}
                title="Refresh data"
                className="bg-[#18181b] border-[#26262c] text-[#EFEFF1] hover:bg-[#26262c] hover:border-[#343438]"
              >
                <RefreshCw className={`h-4 w-4 ${refreshing || chartLoading ? 'animate-spin' : ''}`} />
                <span className="sr-only">Refresh data</span>
              </Button>
              <Button
                variant="outline"
                onClick={handleShare}
                disabled={selectedServers.length === 0}
                title={shareStatusMessage || "Share this view"}
                className="flex items-center gap-2 bg-[#18181b] border-[#26262c] text-[#EFEFF1] hover:bg-[#26262c] hover:border-[#343438]"
              >
                <Share2 className={`h-4 w-4 ${shareStatus === 'copied' || shareStatus === 'shared' ? 'text-[#22c55e]' : shareStatus === 'error' ? 'text-red-400' : ''}`} />
                <span className="text-sm">Share</span>
              </Button>
            </div>
            {shareStatusMessage && (
              <span className={`text-xs ${shareStatusClass}`} aria-live="polite">
                {shareStatusMessage}
              </span>
            )}
          </div>
        </div>
      </div>

      {selectedServers.length > 0 && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {selectedServers.map((serverId) => (
            <ServerStatsCards 
              key={serverId} 
              playerData={playerData} 
              serverId={serverId} 
              serverName={getServerNameById(serverId)}
              loading={loading} 
              streamerData={currentStreamData}
              viewerData={currentViewData}
            />
          ))}
        </div>
      )}

      <div className="w-full overflow-x-auto">
      <Tabs defaultValue={DEFAULT_TIME_RANGE} value={timeRange} onValueChange={handleTimeRangeChange} className="w-full">
        <div className="flex flex-col gap-2 mb-2">
          <div className="text-sm text-gray-400">Time Range:</div>
          
          {/* Mobile touch-friendly time selector */}
          <div className="md:hidden flex overflow-x-auto pb-2 scrollbar-hide">
            <div className="flex space-x-2 min-w-max">
              <button 
                onClick={() => handleTimeRangeChange("1h")}
                className={`px-4 py-3 rounded-md min-w-[60px] text-center ${timeRange === "1h" ? "bg-[#004D61] text-white" : "bg-[#18181b] text-[#EFEFF1]"} border border-[#26262c]`}
              >
                1h
              </button>
              <button 
                onClick={() => handleTimeRangeChange("2h")}
                className={`px-4 py-3 rounded-md min-w-[60px] text-center ${timeRange === "2h" ? "bg-[#004D61] text-white" : "bg-[#18181b] text-[#EFEFF1]"} border border-[#26262c]`}
              >
                2h
              </button>
              <button 
                onClick={() => handleTimeRangeChange("4h")}
                className={`px-4 py-3 rounded-md min-w-[60px] text-center ${timeRange === "4h" ? "bg-[#004D61] text-white" : "bg-[#18181b] text-[#EFEFF1]"} border border-[#26262c]`}
              >
                4h
              </button>
              <button 
                onClick={() => handleTimeRangeChange("6h")}
                className={`px-4 py-3 rounded-md min-w-[60px] text-center ${timeRange === "6h" ? "bg-[#004D61] text-white" : "bg-[#18181b] text-[#EFEFF1]"} border border-[#26262c]`}
              >
                6h
              </button>
              <button 
                onClick={() => handleTimeRangeChange("8h")}
                className={`px-4 py-3 rounded-md min-w-[60px] text-center ${timeRange === "8h" ? "bg-[#004D61] text-white" : "bg-[#18181b] text-[#EFEFF1]"} border border-[#26262c]`}
              >
                8h
              </button>
              <button 
                onClick={() => handleTimeRangeChange("24h")}
                className={`px-4 py-3 rounded-md min-w-[60px] text-center ${timeRange === "24h" ? "bg-[#004D61] text-white" : "bg-[#18181b] text-[#EFEFF1]"} border border-[#26262c]`}
              >
                24h
              </button>
              <button 
                onClick={() => handleTimeRangeChange("7d")}
                className={`px-4 py-3 rounded-md min-w-[60px] text-center ${timeRange === "7d" ? "bg-[#004D61] text-white" : "bg-[#18181b] text-[#EFEFF1]"} border border-[#26262c]`}
              >
                7d
              </button>
              <button 
                onClick={() => handleTimeRangeChange("30d")}
                className={`px-4 py-3 rounded-md min-w-[60px] text-center ${timeRange === "30d" ? "bg-[#004D61] text-white" : "bg-[#18181b] text-[#EFEFF1]"} border border-[#26262c]`}
              >
                30d
              </button>
              <button 
                onClick={() => handleTimeRangeChange("90d")}
                className={`px-4 py-3 rounded-md min-w-[60px] text-center ${timeRange === "90d" ? "bg-[#004D61] text-white" : "bg-[#18181b] text-[#EFEFF1]"} border border-[#26262c]`}
              >
                3m
              </button>
              <button 
                onClick={() => handleTimeRangeChange("180d")}
                className={`px-4 py-3 rounded-md min-w-[60px] text-center ${timeRange === "180d" ? "bg-[#004D61] text-white" : "bg-[#18181b] text-[#EFEFF1]"} border border-[#26262c]`}
              >
                6m
              </button>
              <button 
                onClick={() => handleTimeRangeChange("365d")}
                className={`px-4 py-3 rounded-md min-w-[60px] text-center ${timeRange === "365d" ? "bg-[#004D61] text-white" : "bg-[#18181b] text-[#EFEFF1]"} border border-[#26262c]`}
              >
                1y
              </button>
              <button 
                onClick={() => handleTimeRangeChange("all")}
                className={`px-4 py-3 rounded-md min-w-[60px] text-center ${timeRange === "all" ? "bg-[#004D61] text-white" : "bg-[#18181b] text-[#EFEFF1]"} border border-[#26262c]`}
              >
                All
              </button>
            </div>
          </div>
          
          {/* Desktop - TabsList */}
          <TabsList className="hidden md:grid grid-cols-11 bg-[#18181b] border border-[#26262c] p-0.5 rounded-md">
            <TabsTrigger value="1h" className="text-[#EFEFF1] data-[state=active]:bg-[#004D61] data-[state=active]:text-white">1h</TabsTrigger>
            <TabsTrigger value="2h" className="text-[#EFEFF1] data-[state=active]:bg-[#004D61] data-[state=active]:text-white">2h</TabsTrigger>
            <TabsTrigger value="4h" className="text-[#EFEFF1] data-[state=active]:bg-[#004D61] data-[state=active]:text-white">4h</TabsTrigger>
            <TabsTrigger value="6h" className="text-[#EFEFF1] data-[state=active]:bg-[#004D61] data-[state=active]:text-white">6h</TabsTrigger>
            <TabsTrigger value="8h" className="text-[#EFEFF1] data-[state=active]:bg-[#004D61] data-[state=active]:text-white">8h</TabsTrigger>
            <TabsTrigger value="24h" className="text-[#EFEFF1] data-[state=active]:bg-[#004D61] data-[state=active]:text-white">24h</TabsTrigger>
            <TabsTrigger value="7d" className="text-[#EFEFF1] data-[state=active]:bg-[#004D61] data-[state=active]:text-white">7d</TabsTrigger>
            <TabsTrigger value="30d" className="text-[#EFEFF1] data-[state=active]:bg-[#004D61] data-[state=active]:text-white">30d</TabsTrigger>
            <TabsTrigger value="90d" className="text-[#EFEFF1] data-[state=active]:bg-[#004D61] data-[state=active]:text-white">3m</TabsTrigger>
            <TabsTrigger value="180d" className="text-[#EFEFF1] data-[state=active]:bg-[#004D61] data-[state=active]:text-white">6m</TabsTrigger>
            <TabsTrigger value="365d" className="text-[#EFEFF1] data-[state=active]:bg-[#004D61] data-[state=active]:text-white">1y</TabsTrigger>
          </TabsList>
        </div>
      </Tabs>
      </div>
        
      <Card className="bg-[#0e0e10] border-[#26262c] rounded-md shadow-md">
        <CardHeader className="border-b border-[#26262c]">
          <CardTitle className="text-[#EFEFF1]">Player Count Over Time</CardTitle>
          {/* Data availability warnings - only show when not loading */}
          {!chartLoading && playerData.length === 0 && (
            <div className="text-sm text-yellow-400 bg-yellow-900/20 p-2 rounded mt-2">
              ⚠️ No data available for {timeRange} range. Check "Data start information" below for available data periods.
            </div>
          )}
          {!chartLoading && playerData.length > 0 && chartData.length < 7 && timeRange !== "1h" && timeRange !== "2h" && (
            <div className="text-sm text-blue-400 bg-blue-900/20 p-2 rounded mt-2">
              📊 Limited historical data: Only {chartData.length} data point{chartData.length === 1 ? '' : 's'} available for {timeRange} range. 
              <br/>Consider using a shorter time range or check "Data start information" for data availability.
            </div>
          )}
        </CardHeader>
        <CardContent>
          {chartLoading ? (
            <div className="h-[400px] w-full flex flex-col items-center justify-center space-y-4">
              <Loader2 className="h-8 w-8 animate-spin text-[#004D61]" />
              <div className="text-center space-y-2">
                <p className="text-[#EFEFF1] font-medium">Loading chart data...</p>
                {["7d", "30d", "90d", "180d", "365d", "all"].includes(timeRange) && (
                  <p className="text-sm text-[#9CA3AF]">
                    Sampling data across {timeRange === "7d" ? "7 days" : timeRange === "30d" ? "30 days" : timeRange === "90d" ? "90 days" : timeRange === "180d" ? "6 months" : timeRange === "365d" ? "1 year" : "all time"} for optimal performance
                  </p>
                )}
              </div>
            </div>
          ) : (
            <PlayerCountChart 
              data={chartData} 
              serverIds={selectedServers} 
              serverNames={serverNameMap}
              loading={loading} 
              timeRange={timeRange} 
            />
          )}
        </CardContent>
      </Card>
      
      {singleServerId && (
        <div className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        </div>
      )}
    </div>
  )
}
