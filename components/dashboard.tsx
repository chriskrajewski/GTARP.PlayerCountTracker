"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { RefreshCw, Loader2 } from "lucide-react"
import {
  getServers,
  getPlayerCounts,
  getPlayerCountsSmart,
  aggregateDataForChart,
  getStreamCounts,
  getViewerCounts,
  type TimeRange,
  type ServerData,
  type PlayerCountData,
  type StreamCountData,
  type ViewerCountData
} from "@/lib/data"
import PlayerCountChart from "./player-count-chart"
import ServerStatsCards from "./server-stats-cards"
import { MultiServerSelect } from "./multi-server-select"
import { supabase } from "@/lib/supabase"

// Local storage key for saving server selection
const SELECTED_SERVERS_KEY = "selectedServers"

export default function Dashboard() {
  const [servers, setServers] = useState<ServerData[]>([])
  const [selectedServers, setSelectedServers] = useState<string[]>([])
  const [timeRange, setTimeRange] = useState<TimeRange>("8h")
  const [playerData, setPlayerData] = useState<PlayerCountData[]>([])
  // Always current (24h) stream and view data - not affected by time range
  const [currentStreamData, setCurrentStreamData] = useState<StreamCountData[]>([])
  const [currentViewData, setCurrentViewData] = useState<ViewerCountData[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)
  const [chartLoading, setChartLoading] = useState(false)

  useEffect(() => {
    async function loadServers() {
      try {
        const serverData = await getServers()
        setServers(serverData)
        
        // Attempt to load saved server selection from localStorage
        const savedSelection = localStorage.getItem(SELECTED_SERVERS_KEY)
        
        if (savedSelection) {
          try {
            const parsedSelection = JSON.parse(savedSelection)
            // Verify the saved servers still exist in our current server list
            const validSavedServers = parsedSelection.filter(
              (id: string) => serverData.some(server => server.server_id === id)
            )
            
            if (validSavedServers.length > 0) {
              setSelectedServers(validSavedServers)
            } else {
              // If no valid servers from saved selection, default to first server
              if (serverData.length > 0) {
                setSelectedServers([serverData[0].server_id])
              }
            }
          } catch (e) {
            // If parsing fails, default to first server
            if (serverData.length > 0) {
              setSelectedServers([serverData[0].server_id])
            }
          }
        } else {
          // No saved selection, default to first server
        if (serverData.length > 0) {
          setSelectedServers([serverData[0].server_id])
          }
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

  // Save selected servers to localStorage whenever they change
  useEffect(() => {
    if (selectedServers.length > 0) {
      localStorage.setItem(SELECTED_SERVERS_KEY, JSON.stringify(selectedServers))
    }
  }, [selectedServers])

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

  const handleServerChange = (servers: string[]) => {
    setSelectedServers(servers)
  }

  const handleTimeRangeChange = (value: string) => {
    setTimeRange(value as TimeRange)
  }

  const handleRefresh = () => {
    loadPlayerData()
    loadStreamAndViewData()
  }

  const chartData = aggregateDataForChart(playerData, selectedServers, timeRange)


  


  // Get server name by ID
  const getServerNameById = (serverId: string): string => {
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
      <Tabs defaultValue="8h" value={timeRange} onValueChange={handleTimeRangeChange} className="w-full">
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
    </div>
  )
}
