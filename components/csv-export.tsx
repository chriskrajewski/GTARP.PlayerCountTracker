"use client"

import { useState } from "react"
import { Calendar } from "@/components/ui/calendar"
import { Button } from "@/components/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { cn } from "@/lib/utils"
import { format } from "date-fns"
import { CalendarIcon, Download, FileSpreadsheet, Loader2 } from "lucide-react"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { type ServerData } from "@/lib/data"
import { playerCountsToCSV, streamerCountsToCSV, viewerCountsToCSV, downloadCSV } from "@/lib/csv-export"
import { supabase } from "@/lib/supabase"
import { motion } from "motion/react"

const PAGE_SIZE = 1000

/**
 * Fetches all rows from a Supabase query by paginating through results.
 * Supabase limits responses to 1000 rows by default, so we fetch in batches.
 */
async function fetchAllRows<T>(
  table: string,
  select: string,
  filters: {
    serverIds: string[]
    startDate: string
    endDate: string
  }
): Promise<T[]> {
  const allData: T[] = []
  let from = 0
  let hasMore = true

  while (hasMore) {
    const { data, error } = await supabase
      .from(table)
      .select(select)
      .in("server_id", filters.serverIds)
      .gte("timestamp", filters.startDate)
      .lte("timestamp", filters.endDate)
      .order("timestamp", { ascending: true })
      .range(from, from + PAGE_SIZE - 1)

    if (error) {
      throw error
    }

    if (data && data.length > 0) {
      allData.push(...(data as T[]))
      from += data.length
      // If we got fewer rows than the page size, we've reached the end
      hasMore = data.length === PAGE_SIZE
    } else {
      hasMore = false
    }
  }

  return allData
}

type CSVExportProps = {
  servers: ServerData[]
  selectedServers: string[]
}

export function CSVExport({ servers, selectedServers }: CSVExportProps) {
  const [startDate, setStartDate] = useState<Date | undefined>(new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)) // Default: 7 days ago
  const [endDate, setEndDate] = useState<Date | undefined>(new Date()) // Default: today
  const [dataType, setDataType] = useState<string>("player") // Default: player data
  const [isExporting, setIsExporting] = useState(false)
  const [exportProgress, setExportProgress] = useState<string>("")

  // Function to handle export
  const handleExport = async () => {
    if (!startDate || !endDate || selectedServers.length === 0) {
      return
    }

    setIsExporting(true)
    setExportProgress("Fetching data...")

    try {
      // Format dates for database query
      const customStartDate = startDate.toISOString()
      const customEndDate = endDate.toISOString()

      // Get the selected server names for filename
      const serverNames = selectedServers.map(id => {
        const server = servers.find(s => s.server_id === id)
        return server ? server.server_name : id
      }).join("-")

      // Format date for filename
      const dateStr = format(new Date(), "yyyy-MM-dd")
      
      if (dataType === "player") {
        setExportProgress("Fetching player count data...")
        const playerData = await fetchAllRows<{ server_id: string; timestamp: string; player_count: number }>(
          "player_counts",
          "server_id, timestamp, player_count",
          { serverIds: selectedServers, startDate: customStartDate, endDate: customEndDate }
        )

        setExportProgress(`Processing ${playerData.length.toLocaleString()} rows...`)
        const csvContent = playerCountsToCSV(playerData, servers)
        downloadCSV(csvContent, `player-counts-${serverNames}-${dateStr}.csv`)
      } 
      else if (dataType === "streamer") {
        setExportProgress("Fetching streamer count data...")
        const streamerData = await fetchAllRows<{ server_id: string; timestamp: string; streamercount: number }>(
          "streamer_count",
          "server_id, timestamp, streamercount",
          { serverIds: selectedServers, startDate: customStartDate, endDate: customEndDate }
        )

        setExportProgress(`Processing ${streamerData.length.toLocaleString()} rows...`)
        const csvContent = streamerCountsToCSV(streamerData, servers)
        downloadCSV(csvContent, `streamer-counts-${serverNames}-${dateStr}.csv`)
      }
      else if (dataType === "viewer") {
        setExportProgress("Fetching viewer count data...")
        const viewerData = await fetchAllRows<{ server_id: string; timestamp: string; viewcount: number }>(
          "viewer_count",
          "server_id, timestamp, viewcount",
          { serverIds: selectedServers, startDate: customStartDate, endDate: customEndDate }
        )

        setExportProgress(`Processing ${viewerData.length.toLocaleString()} rows...`)
        const csvContent = viewerCountsToCSV(viewerData, servers)
        downloadCSV(csvContent, `viewer-counts-${serverNames}-${dateStr}.csv`)
      }
    } catch (error) {
      console.error("Error exporting data:", error)
      alert("Failed to export data. Please try again.")
    } finally {
      setIsExporting(false)
      setExportProgress("")
    }
  }

  return (
    <motion.div 
      className="flex flex-col gap-4 p-4 sm:p-5 rounded-xl relative overflow-visible"
      style={{
        background: 'linear-gradient(135deg, rgba(14, 14, 16, 0.95) 0%, rgba(10, 10, 12, 0.95) 100%)',
        border: '1px solid rgba(0, 217, 255, 0.15)',
        boxShadow: '0 10px 40px rgba(0, 0, 0, 0.3), 0 0 30px rgba(0, 217, 255, 0.03)',
      }}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      {/* Background gradient orb */}
      <div 
        className="absolute -top-1/2 -right-1/2 w-full h-full rounded-full blur-3xl opacity-10 pointer-events-none"
        style={{ 
          background: 'radial-gradient(circle, rgba(0, 217, 255, 0.2) 0%, transparent 70%)' 
        }}
      />
      
      <div className="flex items-center gap-2 relative z-10">
        <FileSpreadsheet className="h-5 w-5 text-cyan-400" />
        <h3 className="text-base sm:text-lg font-semibold text-white">Export Data as CSV</h3>
      </div>
      
      <div className="flex flex-col gap-4 relative z-10">
        {/* Data Type Selector */}
        <div className="space-y-2">
          <label className="text-xs sm:text-sm font-medium text-gray-400">Data Type</label>
          <Tabs value={dataType} onValueChange={setDataType} defaultValue="player" className="w-full">
            <TabsList className="grid grid-cols-3 h-auto w-full">
              <TabsTrigger 
                value="player" 
                className="text-xs sm:text-sm py-2 px-2 data-[state=active]:bg-cyan-500/20 data-[state=active]:text-cyan-400"
              >
                Player Counts
              </TabsTrigger>
              <TabsTrigger 
                value="streamer" 
                className="text-xs sm:text-sm py-2 px-2 data-[state=active]:bg-cyan-500/20 data-[state=active]:text-cyan-400"
              >
                Streamer Counts
              </TabsTrigger>
              <TabsTrigger 
                value="viewer" 
                className="text-xs sm:text-sm py-2 px-2 data-[state=active]:bg-cyan-500/20 data-[state=active]:text-cyan-400"
              >
                Viewer Counts
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-3 relative z-10">
        {/* Start Date Selector */}
        <div className="space-y-2 w-full">
          <label className="text-xs sm:text-sm font-medium text-gray-400">Start Date</label>
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className={cn(
                  "w-full justify-start text-left font-normal text-xs sm:text-sm py-2.5",
                  !startDate && "text-gray-500"
                )}
                style={{
                  background: 'linear-gradient(135deg, rgba(24, 24, 27, 0.9) 0%, rgba(18, 18, 21, 0.9) 100%)',
                  borderColor: 'rgba(0, 217, 255, 0.15)',
                }}
              >
                <CalendarIcon className="mr-2 h-4 w-4 text-cyan-400/60" />
                <span className="text-white">{startDate ? format(startDate, "PP") : "Select date"}</span>
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0">
              <Calendar
                mode="single"
                selected={startDate}
                onSelect={setStartDate}
                initialFocus
              />
            </PopoverContent>
          </Popover>
        </div>

        {/* End Date Selector */}
        <div className="space-y-2 w-full">
          <label className="text-xs sm:text-sm font-medium text-gray-400">End Date</label>
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className={cn(
                  "w-full justify-start text-left font-normal text-xs sm:text-sm py-2.5",
                  !endDate && "text-gray-500"
                )}
                style={{
                  background: 'linear-gradient(135deg, rgba(24, 24, 27, 0.9) 0%, rgba(18, 18, 21, 0.9) 100%)',
                  borderColor: 'rgba(0, 217, 255, 0.15)',
                }}
              >
                <CalendarIcon className="mr-2 h-4 w-4 text-cyan-400/60" />
                <span className="text-white">{endDate ? format(endDate, "PP") : "Select date"}</span>
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0">
              <Calendar
                mode="single"
                selected={endDate}
                onSelect={setEndDate}
                initialFocus
              />
            </PopoverContent>
          </Popover>
        </div>
      </div>

      {/* Export Button */}
      <motion.div
        whileHover={{ scale: 1.01 }}
        whileTap={{ scale: 0.99 }}
        className="relative z-10"
      >
        <Button 
          onClick={handleExport} 
          disabled={isExporting || !startDate || !endDate || selectedServers.length === 0}
          className="w-full mt-1 text-sm py-2.5 h-auto font-medium"
          variant="cyber"
        >
          {isExporting ? (
            <span className="flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              {exportProgress || "Exporting..."}
            </span>
          ) : (
            <span className="flex items-center gap-2">
              <Download className="h-4 w-4" />
              Export CSV
            </span>
          )}
        </Button>
      </motion.div>
      
      {selectedServers.length === 0 && (
        <p className="text-xs sm:text-sm text-gray-500 relative z-10">
          Please select at least one server to export data.
        </p>
      )}
    </motion.div>
  )
} 