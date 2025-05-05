"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  getServers,
  getPlayerCounts,
  aggregateDataForChart,
  type TimeRange,
  type ServerData,
  type PlayerCountData,
} from "@/lib/data"
import PlayerCountChart from "./player-count-chart"
import ServerStatsCards from "./server-stats-cards"
import { MultiServerSelect } from "./multi-server-select"

export default function Dashboard() {
  const [servers, setServers] = useState<ServerData[]>([])
  const [selectedServers, setSelectedServers] = useState<string[]>([])
  const [timeRange, setTimeRange] = useState<TimeRange>("24h")
  const [playerData, setPlayerData] = useState<PlayerCountData[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function loadServers() {
      try {
        const serverData = await getServers()
        setServers(serverData)
        if (serverData.length > 0) {
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

  useEffect(() => {
    async function loadPlayerData() {
      if (selectedServers.length === 0) return

      try {
        setLoading(true)
        const data = await getPlayerCounts(selectedServers, timeRange)
        setPlayerData(data)
        setLoading(false)
      } catch (err) {
        console.error("Error loading player data:", err)
        setError("Failed to load player data. Please check your connection and try again.")
        setLoading(false)
      }
    }

    loadPlayerData()
  }, [selectedServers, timeRange])

  const handleServerChange = (servers: string[]) => {
    setSelectedServers(servers)
  }

  const handleTimeRangeChange = (value: string) => {
    setTimeRange(value as TimeRange)
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
      <div className="p-4 bg-red-50 border border-red-200 rounded-md text-red-700">
        <h3 className="font-bold">Error</h3>
        <p>{error}</p>
        <p className="mt-2 text-sm">Please check that your Supabase environment variables are correctly set up.</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <MultiServerSelect
          servers={servers}
          selectedServers={selectedServers}
          onChange={handleServerChange}
          disabled={loading || servers.length === 0}
        />

        <div className="w-full sm:w-auto overflow-x-auto">
          <Tabs defaultValue="24h" value={timeRange} onValueChange={handleTimeRangeChange} className="w-full">
            <TabsList className="grid grid-cols-4 md:grid-cols-8">
              <TabsTrigger value="1h">1h</TabsTrigger>
              <TabsTrigger value="6h">6h</TabsTrigger>
              <TabsTrigger value="24h">24h</TabsTrigger>
              <TabsTrigger value="7d">7d</TabsTrigger>
              <TabsTrigger value="30d">30d</TabsTrigger>
              <TabsTrigger value="90d">3m</TabsTrigger>
              <TabsTrigger value="180d">6m</TabsTrigger>
              <TabsTrigger value="365d">1y</TabsTrigger>
            </TabsList>
          </Tabs>
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
            />
          ))}
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Player Count Over Time</CardTitle>
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
