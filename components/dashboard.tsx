"use client"

import { useState, useEffect, useMemo, useRef } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { RefreshCw, Loader2, Share2 } from "lucide-react"
import { motion, AnimatePresence } from "motion/react"
import { ChartAnimation, StaggeredList, MotionItem, AnimatedSkeleton } from "@/components/ui/motion"
import { fadeInUp, springs, staggerContainer } from "@/lib/motion"
import {
  getServers,
  getPlayerCountsSmart,
  aggregateDataForChart,
  getStreamCounts,
  getViewerCounts,
  getServerResourceChanges,
  getServerResourceSnapshot,
  getServerCapacities,
  calculateTimeAtMaxCapacity,
  type TimeRange,
  type ServerData,
  type PlayerCountData,
  type StreamCountData,
  type ViewerCountData,
  type ServerResourceChange,
  type ServerResourceSnapshot,
  type ServerCapacityData
} from "@/lib/data"
import PlayerCountChart from "./player-count-chart-lw"
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
  const [capacityData, setCapacityData] = useState<ServerCapacityData[]>([])
  const [showCapacity, setShowCapacity] = useState(false)
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

  // Load player data and capacity data - affected by time range
  const loadPlayerData = async () => {
    if (selectedServers.length === 0) return

    try {
      setChartLoading(true);
      setRefreshing(true);
      
      // Fetch both player counts and capacity data in parallel
      const [playerCountsData, capacitiesData] = await Promise.all([
        getPlayerCountsSmart(selectedServers, timeRange),
        getServerCapacities(selectedServers, timeRange)
      ]);
      
      setPlayerData(playerCountsData);
      setCapacityData(capacitiesData);
      
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
  
  // Aggregate capacity data with forward-filling (use last known capacity)
  const capacityChartData = useMemo(() => {
    if (capacityData.length === 0 || chartData.length === 0) return []
    
    // Create a map of last known capacity for each server
    const lastKnownCapacity: Record<string, number> = {}
    
    // Initialize with the most recent capacity before the chart time range
    selectedServers.forEach(serverId => {
      const serverCapacities = capacityData
        .filter(d => d.server_id === serverId)
        .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
      
      if (serverCapacities.length > 0) {
        lastKnownCapacity[serverId] = serverCapacities[0].max_capacity
      }
    })
    
    // Build capacity data for each timestamp in chartData
    return chartData.map(chartPoint => {
      const result: Record<string, any> = {
        timestamp: chartPoint.timestamp
      }
      
      selectedServers.forEach(serverId => {
        // Find capacity data at this timestamp
        const capacityAtTimestamp = capacityData.find(
          c => c.server_id === serverId && c.timestamp === chartPoint.timestamp
        )
        
        if (capacityAtTimestamp) {
          // Update last known capacity
          lastKnownCapacity[serverId] = capacityAtTimestamp.max_capacity
          result[`${serverId}_capacity`] = capacityAtTimestamp.max_capacity
        } else if (lastKnownCapacity[serverId]) {
          // Forward-fill with last known capacity
          result[`${serverId}_capacity`] = lastKnownCapacity[serverId]
        }
      })
      
      return result
    })
  }, [capacityData, chartData, selectedServers])

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
    <motion.div 
      className="space-y-6"
      initial="hidden"
      animate="visible"
      variants={staggerContainer}
    >
      <motion.div 
        className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"
        variants={fadeInUp}
      >
        <div className="flex flex-col sm:flex-row gap-2 items-start sm:items-center">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={springs.smooth}
          >
            <MultiServerSelect
              servers={servers}
              selectedServers={selectedServers}
              onChange={handleServerChange}
              disabled={loading || servers.length === 0}
            />
          </motion.div>
          <div className="flex flex-col gap-1">
            <div className="flex gap-2">
              <motion.div
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                <Button 
                  variant="outline" 
                  size="icon" 
                  onClick={handleRefresh} 
                  disabled={loading || refreshing || chartLoading || selectedServers.length === 0}
                  title="Refresh data"
                  className="bg-[#18181b] border-[#26262c] text-[#EFEFF1] hover:bg-[#26262c] hover:border-[#343438]"
                >
                  <motion.span
                    animate={refreshing || chartLoading ? { rotate: 360 } : { rotate: 0 }}
                    transition={{ 
                      duration: 1, 
                      repeat: refreshing || chartLoading ? Infinity : 0,
                      ease: "linear"
                    }}
                  >
                    <RefreshCw className="h-4 w-4" />
                  </motion.span>
                  <span className="sr-only">Refresh data</span>
                </Button>
              </motion.div>
              <motion.div
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                <Button
                  variant="outline"
                  onClick={handleShare}
                  disabled={selectedServers.length === 0}
                  title={shareStatusMessage || "Share this view"}
                  className="flex items-center gap-2 bg-[#18181b] border-[#26262c] text-[#EFEFF1] hover:bg-[#26262c] hover:border-[#343438]"
                >
                  <motion.span
                    animate={shareStatus === 'copied' || shareStatus === 'shared' ? { 
                      scale: [1, 1.2, 1],
                      rotate: [0, 10, -10, 0]
                    } : {}}
                    transition={{ duration: 0.4 }}
                  >
                    <Share2 className={`h-4 w-4 ${shareStatus === 'copied' || shareStatus === 'shared' ? 'text-[#22c55e]' : shareStatus === 'error' ? 'text-red-400' : ''}`} />
                  </motion.span>
                  <span className="text-sm">Share</span>
                </Button>
              </motion.div>
            </div>
            <AnimatePresence>
              {shareStatusMessage && (
                <motion.span 
                  className={`text-xs ${shareStatusClass}`} 
                  aria-live="polite"
                  initial={{ opacity: 0, y: -5 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -5 }}
                  transition={{ duration: 0.2 }}
                >
                  {shareStatusMessage}
                </motion.span>
              )}
            </AnimatePresence>
          </div>
        </div>
      </motion.div>

      <AnimatePresence mode="wait">
        {selectedServers.length > 0 && (
          <motion.div 
            className="grid gap-4 md:grid-cols-2 lg:grid-cols-3"
            variants={fadeInUp}
            initial="hidden"
            animate="visible"
            exit="exit"
          >
            {selectedServers.map((serverId, index) => (
              <motion.div
                key={serverId}
                initial={{ opacity: 0, y: 20, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -10, scale: 0.98 }}
                transition={{
                  delay: index * 0.1,
                  ...springs.smooth
                }}
              >
                <ServerStatsCards 
                  playerData={playerData}
                  capacityData={capacityData}
                  serverId={serverId} 
                  serverName={getServerNameById(serverId)}
                  loading={loading} 
                  streamerData={currentStreamData}
                  viewerData={currentViewData}
                />
              </motion.div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      <motion.div 
        className="w-full overflow-x-auto"
        variants={fadeInUp}
      >
      <Tabs defaultValue={DEFAULT_TIME_RANGE} value={timeRange} onValueChange={handleTimeRangeChange} className="w-full">
        <div className="flex flex-col gap-2 mb-2">
          <div className="text-sm text-gray-400">Time Range:</div>
          
          {/* Mobile touch-friendly time selector */}
          <div className="md:hidden flex overflow-x-auto pb-2 scrollbar-hide">
            <motion.div 
              className="flex space-x-2 min-w-max"
              initial="hidden"
              animate="visible"
              variants={{
                hidden: { opacity: 0 },
                visible: {
                  opacity: 1,
                  transition: { staggerChildren: 0.03 }
                }
              }}
            >
              {[
                { value: "1h", label: "1h" },
                { value: "2h", label: "2h" },
                { value: "4h", label: "4h" },
                { value: "6h", label: "6h" },
                { value: "8h", label: "8h" },
                { value: "24h", label: "24h" },
                { value: "7d", label: "7d" },
                { value: "30d", label: "30d" },
                { value: "90d", label: "3m" },
                { value: "180d", label: "6m" },
                { value: "365d", label: "1y" },
                { value: "all", label: "All" }
              ].map((item) => (
                <motion.button
                  key={item.value}
                  onClick={() => handleTimeRangeChange(item.value)}
                  className={`px-4 py-3 rounded-md min-w-[60px] text-center ${timeRange === item.value ? "bg-[#004D61] text-white" : "bg-[#18181b] text-[#EFEFF1]"} border border-[#26262c]`}
                  variants={{
                    hidden: { opacity: 0, y: 10 },
                    visible: { opacity: 1, y: 0 }
                  }}
                  whileHover={{ scale: 1.05, y: -2 }}
                  whileTap={{ scale: 0.95 }}
                  transition={springs.stiff}
                >
                  {item.label}
                </motion.button>
              ))}
            </motion.div>
          </div>
          
          {/* Desktop - TabsList */}
          <TabsList className="hidden md:grid grid-cols-11 bg-[#18181b] border border-[#26262c] p-0.5 rounded-md">
            <TabsTrigger value="1h" className="text-[#EFEFF1] data-[state=active]:bg-[#004D61] data-[state=active]:text-white transition-all duration-200">1h</TabsTrigger>
            <TabsTrigger value="2h" className="text-[#EFEFF1] data-[state=active]:bg-[#004D61] data-[state=active]:text-white transition-all duration-200">2h</TabsTrigger>
            <TabsTrigger value="4h" className="text-[#EFEFF1] data-[state=active]:bg-[#004D61] data-[state=active]:text-white transition-all duration-200">4h</TabsTrigger>
            <TabsTrigger value="6h" className="text-[#EFEFF1] data-[state=active]:bg-[#004D61] data-[state=active]:text-white transition-all duration-200">6h</TabsTrigger>
            <TabsTrigger value="8h" className="text-[#EFEFF1] data-[state=active]:bg-[#004D61] data-[state=active]:text-white transition-all duration-200">8h</TabsTrigger>
            <TabsTrigger value="24h" className="text-[#EFEFF1] data-[state=active]:bg-[#004D61] data-[state=active]:text-white transition-all duration-200">24h</TabsTrigger>
            <TabsTrigger value="7d" className="text-[#EFEFF1] data-[state=active]:bg-[#004D61] data-[state=active]:text-white transition-all duration-200">7d</TabsTrigger>
            <TabsTrigger value="30d" className="text-[#EFEFF1] data-[state=active]:bg-[#004D61] data-[state=active]:text-white transition-all duration-200">30d</TabsTrigger>
            <TabsTrigger value="90d" className="text-[#EFEFF1] data-[state=active]:bg-[#004D61] data-[state=active]:text-white transition-all duration-200">3m</TabsTrigger>
            <TabsTrigger value="180d" className="text-[#EFEFF1] data-[state=active]:bg-[#004D61] data-[state=active]:text-white transition-all duration-200">6m</TabsTrigger>
            <TabsTrigger value="365d" className="text-[#EFEFF1] data-[state=active]:bg-[#004D61] data-[state=active]:text-white transition-all duration-200">1y</TabsTrigger>
          </TabsList>
        </div>
      </Tabs>
      </motion.div>
        
      <motion.div
        variants={fadeInUp}
        initial="hidden"
        animate="visible"
        transition={{ delay: 0.2 }}
      >
        <Card className="bg-[#0e0e10] border-[#26262c] rounded-md shadow-md overflow-hidden">
          <CardHeader className="border-b border-[#26262c]">
            <div className="flex items-center justify-between">
              <CardTitle className="text-[#EFEFF1]">Player Count Over Time</CardTitle>
              <motion.div 
                className="flex items-center gap-2"
                whileHover={{ scale: 1.02 }}
              >
                <input
                  type="checkbox"
                  id="showCapacity"
                  checked={showCapacity}
                  onChange={(e) => setShowCapacity(e.target.checked)}
                  className="w-4 h-4 text-[#004D61] bg-[#18181b] border-[#26262c] rounded focus:ring-[#004D61] focus:ring-2"
                />
                <label htmlFor="showCapacity" className="text-sm text-[#EFEFF1] cursor-pointer">
                  Show Max Capacity
                </label>
              </motion.div>
            </div>
            {/* Data availability warnings - only show when not loading */}
            <AnimatePresence>
              {!chartLoading && playerData.length === 0 && (
                <motion.div 
                  className="text-sm text-yellow-400 bg-yellow-900/20 p-2 rounded mt-2"
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.3 }}
                >
                  ⚠️ No data available for {timeRange} range. Check "Data start information" below for available data periods.
                </motion.div>
              )}
            </AnimatePresence>
            <AnimatePresence>
              {!chartLoading && playerData.length > 0 && chartData.length < 7 && timeRange !== "1h" && timeRange !== "2h" && (
                <motion.div 
                  className="text-sm text-blue-400 bg-blue-900/20 p-2 rounded mt-2"
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.3 }}
                >
                  📊 Limited historical data: Only {chartData.length} data point{chartData.length === 1 ? '' : 's'} available for {timeRange} range. 
                  <br/>Consider using a shorter time range or check "Data start information" for data availability.
                </motion.div>
              )}
            </AnimatePresence>
          </CardHeader>
          <CardContent>
            <AnimatePresence mode="wait">
              {chartLoading ? (
                <motion.div 
                  key="loading"
                  className="h-[400px] w-full flex flex-col items-center justify-center space-y-4"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.2 }}
                >
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                  >
                    <Loader2 className="h-8 w-8 text-[#004D61]" />
                  </motion.div>
                  <motion.div 
                    className="text-center space-y-2"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2 }}
                  >
                    <p className="text-[#EFEFF1] font-medium">Loading chart data...</p>
                    {["7d", "30d", "90d", "180d", "365d", "all"].includes(timeRange) && (
                      <motion.p 
                        className="text-sm text-[#9CA3AF]"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 0.4 }}
                      >
                        Sampling data across {timeRange === "7d" ? "7 days" : timeRange === "30d" ? "30 days" : timeRange === "90d" ? "90 days" : timeRange === "180d" ? "6 months" : timeRange === "365d" ? "1 year" : "all time"} for optimal performance
                      </motion.p>
                    )}
                  </motion.div>
                </motion.div>
              ) : (
                <motion.div
                  key="chart"
                  initial={{ opacity: 0, scale: 0.98 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.98 }}
                  transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
                >
                  <PlayerCountChart 
                    data={chartData} 
                    capacityData={capacityChartData}
                    serverIds={selectedServers} 
                    serverNames={serverNameMap}
                    loading={loading} 
                    timeRange={timeRange}
                    showCapacity={showCapacity}
                  />
                </motion.div>
              )}
            </AnimatePresence>
          </CardContent>
        </Card>
      </motion.div>
      
      {singleServerId && (
        <div className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        </div>
      )}
    </motion.div>
  )
}
