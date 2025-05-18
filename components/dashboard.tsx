"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { RefreshCw } from "lucide-react"
import {
  getServers,
  getPlayerCounts,
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
  const [streamData, setStreamerData] = useState<StreamCountData[]>([])
  const [viewData, setViewerData] = useState<ViewerCountData[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)
  const [isLoadingServers, setIsLoadingServers] = useState(true)
  const [fetchError, setFetchError] = useState<string | null>(null)
  const [isLoadingData, setIsLoadingData] = useState(true)

  useEffect(() => {
    async function loadServers() {
      try {
        // Add loading indicator
        setIsLoadingServers(true)
        
        // Fetch server data
        const serverData = await getServers()
        
        // Update state with fetched servers
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
        // Silent error in production
        setFetchError("Failed to load servers. Please refresh the page.")
        setLoading(false)
      } finally {
        // Remove loading indicator
        setIsLoadingServers(false)
      }
    }

    loadServers()
  }, [])

  // Extract loadPlayerData function to make it reusable
  const loadPlayerData = async () => {
    try {
      // Add loading indicator
      setIsLoadingData(true)
      
      if (selectedServers.length === 0) return

      // Fetch player data for selected date range and servers
      const activeServers = selectedServers.includes('all') 
        ? servers.map(server => server.server_id)
        : selectedServers;
        
      const data = await getPlayerCounts(activeServers, timeRange)
      const streamData = await getStreamCounts(activeServers, timeRange)
      const viewData = await getViewerCounts(activeServers, timeRange)
      setPlayerData(data)
      setStreamerData(streamData)
      setViewerData(viewData)
      setLoading(false)
    } catch (err) {
      // Silent error in production
      setFetchError("Failed to load player data. Please refresh the page.")
      setLoading(false)
    } finally {
      // Remove loading indicator
      setIsLoadingData(false)
    }
  }

  useEffect(() => {
    loadPlayerData()
  }, [selectedServers, timeRange])

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

  if (fetchError) {
    return (
      <div className="p-4 bg-gray-800 border border-gray-700 rounded-md text-red-400">
        <h3 className="font-bold">Error</h3>
        <p>{fetchError}</p>
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
              disabled={loading || refreshing || selectedServers.length === 0}
              title="Refresh data"
              className="bg-[#18181b] border-[#26262c] text-[#EFEFF1] hover:bg-[#26262c] hover:border-[#343438]"
            >
              <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
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
              streamerData={streamData}
              viewerData={viewData}
            />
          ))}
        </div>
      )}

      <div className="w-full sm:w-auto overflow-x-auto">
      <Tabs defaultValue="8h" value={timeRange} onValueChange={handleTimeRangeChange} className="w-full">
        <TabsList className="grid grid-cols-4 md:grid-cols-11 bg-[#18181b] border border-[#26262c] p-0.5 rounded-md">
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
      </Tabs>
    </div>
        
      <Card className="bg-[#0e0e10] border-[#26262c] rounded-md shadow-md">
        <CardHeader className="border-b border-[#26262c]">
          <CardTitle className="text-[#EFEFF1]">Player Count Over Time</CardTitle>
        </CardHeader>
        <CardContent>
          <PlayerCountChart 
            data={chartData} 
            serverIds={selectedServers} 
            serverNames={serverNameMap}
            loading={loading} 
            timeRange={timeRange} 
          />
        </CardContent>
      </Card>
    </div>
  )
}
