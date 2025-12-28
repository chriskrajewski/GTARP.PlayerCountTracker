"use client"

import { useEffect, useState, useMemo } from "react"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { getLastRefreshTimes, getDataStartTimes, getServers, type LastRefreshInfo, type DataStartInfo, type ServerData } from "@/lib/data"
import { Skeleton } from "@/components/ui/skeleton"
import { 
  Radio, 
  Database, 
  Clock, 
  HistoryIcon, 
  InfoIcon,
  Wifi,
  WifiOff,
  Activity,
  ChevronDown,
  Circle
} from "lucide-react"
import { motion, AnimatePresence } from "motion/react"
import { springs } from "@/lib/motion"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

interface DataStatusIndicatorProps {
  /**
   * Whether live data streaming is active
   */
  isLiveStreaming?: boolean
  /**
   * Last time live data was fetched
   */
  lastLiveFetch?: Date | null
  /**
   * Whether live data is currently loading
   */
  liveLoading?: boolean
  /**
   * Current time range being viewed
   */
  timeRange?: string
  /**
   * Number of servers with active live connections
   */
  activeServerCount?: number
  /**
   * Polling interval in milliseconds
   */
  pollingInterval?: number
}

export function DataStatusIndicator({
  isLiveStreaming = false,
  lastLiveFetch = null,
  liveLoading = false,
  timeRange = "8h",
  activeServerCount = 0,
  pollingInterval = 30000
}: DataStatusIndicatorProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [refreshTimes, setRefreshTimes] = useState<LastRefreshInfo[]>([])
  const [dataStartTimes, setDataStartTimes] = useState<DataStartInfo[]>([])
  const [servers, setServers] = useState<ServerData[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [latestRefresh, setLatestRefresh] = useState<Date | null>(null)
  const [currentTime, setCurrentTime] = useState(new Date())

  // Update current time every second for accurate relative times
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(new Date())
    }, 1000)
    return () => clearInterval(interval)
  }, [])

  // Fetch historical data info
  useEffect(() => {
    async function fetchData() {
      try {
        const [refreshData, startData, serverData] = await Promise.all([
          getLastRefreshTimes(),
          getDataStartTimes(),
          getServers()
        ])
        
        setRefreshTimes(refreshData)
        setDataStartTimes(startData)
        setServers(serverData)
        
        if (refreshData.length > 0) {
          const timestamps = refreshData.map(item => new Date(item.last_refresh).getTime())
          const latestTimestamp = Math.max(...timestamps)
          setLatestRefresh(new Date(latestTimestamp))
        }
      } catch (err) {
        console.error("Error loading data status:", err)
        setError("Failed to load status information")
      } finally {
        setIsLoading(false)
      }
    }
    
    fetchData()
    
    // Refresh every minute
    const intervalId = setInterval(fetchData, 60000)
    return () => clearInterval(intervalId)
  }, [])

  // Get server name by ID
  const getServerNameById = (serverId: string): string => {
    const server = servers.find(s => s.server_id === serverId)
    return server ? server.server_name : `Server ${serverId}`
  }

  // Format date for display
  const formatDateTime = (dateString: string): string => {
    try {
      const date = new Date(dateString)
      return date.toLocaleString("en-US", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit"
      })
    } catch (err) {
      return "Invalid date"
    }
  }

  const formatDate = (dateString: string): string => {
    try {
      const date = new Date(dateString)
      return date.toLocaleDateString("en-US", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit"
      })
    } catch (err) {
      return "Invalid date"
    }
  }

  // Format relative time
  const getRelativeTimeString = (date: Date | null): string => {
    if (!date) return "Unknown"
    
    const diffMs = currentTime.getTime() - date.getTime()
    const diffSecs = Math.round(diffMs / 1000)
    const diffMins = Math.round(diffSecs / 60)
    const diffHours = Math.round(diffMins / 60)
    const diffDays = Math.round(diffHours / 24)
    
    if (diffSecs < 5) return "just now"
    if (diffSecs < 60) return `${diffSecs}s ago`
    if (diffMins < 60) return `${diffMins}m ago`
    if (diffHours < 24) return `${diffHours}h ago`
    return `${diffDays}d ago`
  }

  // Get time range display label
  const getTimeRangeLabel = (range: string): string => {
    const labels: Record<string, string> = {
      "1h": "Last Hour",
      "2h": "Last 2 Hours",
      "4h": "Last 4 Hours",
      "6h": "Last 6 Hours",
      "8h": "Last 8 Hours",
      "24h": "Last 24 Hours",
      "7d": "Last 7 Days",
      "30d": "Last 30 Days",
      "90d": "Last 3 Months",
      "180d": "Last 6 Months",
      "365d": "Last Year",
      "all": "All Time"
    }
    return labels[range] || range
  }

  // Determine live status
  const liveStatus = useMemo(() => {
    if (!isLiveStreaming) return "disconnected"
    if (liveLoading) return "fetching"
    if (lastLiveFetch) {
      const timeSinceLastFetch = currentTime.getTime() - lastLiveFetch.getTime()
      // If more than 2x polling interval has passed, consider it stale
      if (timeSinceLastFetch > pollingInterval * 2) return "stale"
    }
    return "connected"
  }, [isLiveStreaming, liveLoading, lastLiveFetch, currentTime, pollingInterval])

  // Status colors
  const statusColors = {
    connected: "text-green-400",
    fetching: "text-yellow-400",
    stale: "text-orange-400",
    disconnected: "text-gray-500"
  }

  const statusLabels = {
    connected: "Live",
    fetching: "Updating...",
    stale: "Stale",
    disconnected: "Offline"
  }

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <motion.button 
          className="inline-flex items-center gap-2 text-gray-400 hover:text-white transition-all duration-300 px-3 py-1.5 rounded-lg group"
          style={{
            background: 'linear-gradient(135deg, rgba(24, 24, 27, 0.6) 0%, rgba(18, 18, 21, 0.6) 100%)',
            border: '1px solid rgba(0, 217, 255, 0.1)',
          }}
          whileHover={{ 
            scale: 1.02,
            borderColor: 'rgba(0, 217, 255, 0.3)',
          }}
          whileTap={{ scale: 0.98 }}
        >
          {/* Live Status Indicator */}
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="inline-flex items-center gap-1">
                  {liveStatus === "connected" && (
                    <motion.span
                      className="relative flex h-2 w-2"
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                    >
                      <motion.span
                        className="absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"
                        animate={{ scale: [1, 1.5, 1], opacity: [0.75, 0, 0.75] }}
                        transition={{ duration: 1.5, repeat: Infinity }}
                      />
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-400" />
                    </motion.span>
                  )}
                  {liveStatus === "fetching" && (
                    <motion.span
                      animate={{ rotate: 360 }}
                      transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                    >
                      <Activity className="h-3 w-3 text-yellow-400" />
                    </motion.span>
                  )}
                  {liveStatus === "stale" && (
                    <WifiOff className="h-3 w-3 text-orange-400" />
                  )}
                  {liveStatus === "disconnected" && (
                    <Circle className="h-3 w-3 text-gray-500" />
                  )}
                  <span className={`text-xs font-medium ${statusColors[liveStatus]}`}>
                    {statusLabels[liveStatus]}
                  </span>
                </span>
              </TooltipTrigger>
              <TooltipContent 
                className="text-white border-cyan-500/20"
                style={{
                  background: 'linear-gradient(135deg, rgba(14, 14, 16, 0.98) 0%, rgba(10, 10, 12, 0.98) 100%)',
                }}
              >
                {liveStatus === "connected" && `Live data streaming • ${activeServerCount} server${activeServerCount !== 1 ? 's' : ''}`}
                {liveStatus === "fetching" && "Fetching latest data..."}
                {liveStatus === "stale" && "Connection may be slow"}
                {liveStatus === "disconnected" && "Live streaming not active"}
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>

          <span className="text-cyan-500/30">|</span>

          {/* Historical Data Info */}
          <span className="inline-flex items-center gap-1 text-xs">
            <Database className="h-3 w-3 text-cyan-400/60" />
            <span>{getTimeRangeLabel(timeRange)}</span>
          </span>

          <span className="text-cyan-500/30">|</span>

          {/* Last ETL Refresh */}
          <span className="inline-flex items-center gap-1 text-xs">
            <Clock className="h-3 w-3 text-cyan-400/60" />
            <span>DB: {getRelativeTimeString(latestRefresh)}</span>
          </span>

          <ChevronDown className="h-3 w-3 text-gray-500 group-hover:text-cyan-400 transition-colors" />
        </motion.button>
      </DialogTrigger>

      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5 text-cyan-400" />
            <span className="bg-gradient-to-r from-white to-cyan-100 bg-clip-text text-transparent">
              Data Status Dashboard
            </span>
          </DialogTitle>
          <DialogDescription className="text-gray-400">
            View live data streaming status and historical data information
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="live" className="mt-4">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger 
              value="live" 
              className="data-[state=active]:bg-cyan-500/20 data-[state=active]:text-cyan-400"
            >
              <Radio className="h-3 w-3 mr-1.5" />
              Live Status
            </TabsTrigger>
            <TabsTrigger 
              value="refresh" 
              className="data-[state=active]:bg-cyan-500/20 data-[state=active]:text-cyan-400"
            >
              <HistoryIcon className="h-3 w-3 mr-1.5" />
              History Load
            </TabsTrigger>
            <TabsTrigger 
              value="start" 
              className="data-[state=active]:bg-cyan-500/20 data-[state=active]:text-cyan-400"
            >
              <InfoIcon className="h-3 w-3 mr-1.5" />
              Data Start
            </TabsTrigger>
          </TabsList>

          {/* Live Status Tab */}
          <TabsContent value="live" className="mt-4 space-y-4">
            <div 
              className="rounded-xl p-4"
              style={{
                background: 'linear-gradient(135deg, rgba(24, 24, 27, 0.8) 0%, rgba(18, 18, 21, 0.8) 100%)',
                border: '1px solid rgba(0, 217, 255, 0.1)',
              }}
            >
              <div className="flex items-center justify-between mb-4">
                <span className="text-sm font-medium text-white">Data Streaming Status</span>
                <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${
                  liveStatus === "connected" ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30" :
                  liveStatus === "fetching" ? "bg-yellow-500/20 text-yellow-400 border border-yellow-500/30" :
                  liveStatus === "stale" ? "bg-orange-500/20 text-orange-400 border border-orange-500/30" :
                  "bg-gray-500/20 text-gray-400 border border-gray-500/30"
                }`}>
                  {liveStatus === "connected" && (
                    <motion.span
                      className="w-1.5 h-1.5 rounded-full bg-emerald-400"
                      animate={{ scale: [1, 1.2, 1] }}
                      transition={{ duration: 1, repeat: Infinity }}
                    />
                  )}
                  {statusLabels[liveStatus]}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-4 text-sm">
                <div className="space-y-1">
                  <span className="text-gray-500 text-xs">Active Servers</span>
                  <p className="text-white font-semibold">{activeServerCount}</p>
                </div>
                <div className="space-y-1">
                  <span className="text-gray-500 text-xs">Polling Interval</span>
                  <p className="text-white font-semibold">{pollingInterval / 1000}s</p>
                </div>
                <div className="space-y-1">
                  <span className="text-gray-500 text-xs">Last Live Fetch</span>
                  <p className="text-white font-semibold">{getRelativeTimeString(lastLiveFetch)}</p>
                </div>
                <div className="space-y-1">
                  <span className="text-gray-500 text-xs">Viewing Range</span>
                  <p className="text-white font-semibold">{getTimeRangeLabel(timeRange)}</p>
                </div>
              </div>
            </div>

            <div 
              className="text-xs text-gray-400 rounded-xl p-3"
              style={{
                background: 'linear-gradient(135deg, rgba(0, 217, 255, 0.05) 0%, rgba(20, 184, 166, 0.05) 100%)',
                border: '1px solid rgba(0, 217, 255, 0.1)',
              }}
            >
              <p className="flex items-start gap-2">
                <InfoIcon className="h-4 w-4 mt-0.5 flex-shrink-0 text-cyan-400/60" />
                <span>
                  <strong className="text-cyan-400">Live data</strong> shows real-time player counts and stream info, 
                  fetched directly from FiveM and Twitch APIs every {pollingInterval / 1000} seconds. 
                  <strong className="text-cyan-400"> Historical data</strong> (charts, peaks, averages) comes from 
                  our database, updated every ~10 minutes.
                </span>
              </p>
            </div>
          </TabsContent>

          {/* Last Refresh Tab */}
          <TabsContent value="refresh" className="mt-4">
            <div 
              className="rounded-xl p-4"
              style={{
                background: 'linear-gradient(135deg, rgba(24, 24, 27, 0.8) 0%, rgba(18, 18, 21, 0.8) 100%)',
                border: '1px solid rgba(0, 217, 255, 0.1)',
              }}
            >
              {isLoading ? (
                <div className="space-y-3">
                  <Skeleton className="h-5 w-full bg-[#26262c]" />
                  <Skeleton className="h-5 w-full bg-[#26262c]" />
                  <Skeleton className="h-5 w-full bg-[#26262c]" />
                </div>
              ) : error ? (
                <div className="text-red-400 text-sm">{error}</div>
              ) : refreshTimes.length === 0 ? (
                <div className="text-center text-gray-500 text-sm py-4">
                  No refresh information available
                </div>
              ) : (
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {refreshTimes
                    .sort((a, b) => new Date(b.last_refresh).getTime() - new Date(a.last_refresh).getTime())
                    .map((item) => (
                      <div 
                        key={item.server_id} 
                        className="flex justify-between items-center py-2 border-b last:border-0"
                        style={{ borderColor: 'rgba(0, 217, 255, 0.1)' }}
                      >
                        <span className="font-medium text-sm text-white">{getServerNameById(item.server_id)}</span>
                        <span className="text-sm text-gray-400">{formatDateTime(item.last_refresh)}</span>
                      </div>
                    ))
                  }
                </div>
              )}
            </div>
            <p className="text-xs text-gray-500 mt-2">
              Database records are updated approximately every 10 minutes via our ETL pipeline.
            </p>
          </TabsContent>

          {/* Data Start Tab */}
          <TabsContent value="start" className="mt-4">
            <div 
              className="rounded-xl p-4"
              style={{
                background: 'linear-gradient(135deg, rgba(24, 24, 27, 0.8) 0%, rgba(18, 18, 21, 0.8) 100%)',
                border: '1px solid rgba(0, 217, 255, 0.1)',
              }}
            >
              {isLoading ? (
                <div className="space-y-3">
                  <Skeleton className="h-5 w-full bg-[#26262c]" />
                  <Skeleton className="h-5 w-full bg-[#26262c]" />
                  <Skeleton className="h-5 w-full bg-[#26262c]" />
                </div>
              ) : error ? (
                <div className="text-red-400 text-sm">{error}</div>
              ) : dataStartTimes.length === 0 ? (
                <div className="text-center text-gray-500 text-sm py-4">
                  No data start information available
                </div>
              ) : (
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {dataStartTimes.map((item) => (
                    <div 
                      key={item.server_id} 
                      className="flex justify-between items-center py-2 border-b last:border-0"
                      style={{ borderColor: 'rgba(0, 217, 255, 0.1)' }}
                    >
                      <span className="font-medium text-sm text-white">{getServerNameById(item.server_id)}</span>
                      <span className="text-sm text-gray-400">{formatDate(item.start_date)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <p className="text-xs text-gray-500 mt-2">
              These are the dates when we started collecting data for each server.
            </p>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  )
}
