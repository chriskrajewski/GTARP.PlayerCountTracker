"use client"

import { useState } from "react"
import { Calendar } from "@/components/ui/calendar"
import { Button } from "@/components/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { cn } from "@/lib/utils"
import { format } from "date-fns"
import { CalendarIcon, Download } from "lucide-react"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { type ServerData } from "@/lib/data"
import { playerCountsToCSV, streamerCountsToCSV, viewerCountsToCSV, downloadCSV } from "@/lib/csv-export"
import { supabase } from "@/lib/supabase"

type CSVExportProps = {
  servers: ServerData[]
  selectedServers: string[]
}

export function CSVExport({ servers, selectedServers }: CSVExportProps) {
  const [startDate, setStartDate] = useState<Date | undefined>(new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)) // Default: 7 days ago
  const [endDate, setEndDate] = useState<Date | undefined>(new Date()) // Default: today
  const [dataType, setDataType] = useState<string>("player") // Default: player data
  const [isExporting, setIsExporting] = useState(false)

  // Function to handle export
  const handleExport = async () => {
    if (!startDate || !endDate || selectedServers.length === 0) {
      return
    }

    setIsExporting(true)

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
        // Direct database query with date filtering
        const { data: playerData, error } = await supabase
          .from("player_counts")
          .select("server_id, timestamp, player_count")
          .in("server_id", selectedServers)
          .gte("timestamp", customStartDate)
          .lte("timestamp", customEndDate)
          .order("timestamp", { ascending: true })
        
        if (error) {
          throw error
        }

        // Convert to CSV and download
        const csvContent = playerCountsToCSV(playerData || [], servers)
        downloadCSV(csvContent, `player-counts-${serverNames}-${dateStr}.csv`)
      } 
      else if (dataType === "streamer") {
        // Direct database query with date filtering
        const { data: streamerData, error } = await supabase
          .from("streamer_count")
          .select("server_id, timestamp, streamercount")
          .in("server_id", selectedServers)
          .gte("timestamp", customStartDate)
          .lte("timestamp", customEndDate)
          .order("timestamp", { ascending: true })
        
        if (error) {
          throw error
        }

        // Convert to CSV and download
        const csvContent = streamerCountsToCSV(streamerData || [], servers)
        downloadCSV(csvContent, `streamer-counts-${serverNames}-${dateStr}.csv`)
      }
      else if (dataType === "viewer") {
        // Direct database query with date filtering
        const { data: viewerData, error } = await supabase
          .from("viewer_count")
          .select("server_id, timestamp, viewcount")
          .in("server_id", selectedServers)
          .gte("timestamp", customStartDate)
          .lte("timestamp", customEndDate)
          .order("timestamp", { ascending: true })
        
        if (error) {
          throw error
        }

        // Convert to CSV and download
        const csvContent = viewerCountsToCSV(viewerData || [], servers)
        downloadCSV(csvContent, `viewer-counts-${serverNames}-${dateStr}.csv`)
      }
    } catch (error) {
      console.error("Error exporting data:", error)
      alert("Failed to export data. Please try again.")
    } finally {
      setIsExporting(false)
    }
  }

  return (
    <div className="flex flex-col gap-3 p-4 border rounded-lg bg-card text-card-foreground shadow-sm">
      <h3 className="text-lg font-semibold">Export Data as CSV</h3>
      
      <div className="flex flex-col sm:flex-row gap-3">
        {/* Data Type Selector */}
        <div className="space-y-1">
          <label className="text-sm font-medium">Data Type</label>
          <Tabs value={dataType} onValueChange={setDataType} defaultValue="player" className="w-full">
            <TabsList className="grid grid-cols-3">
              <TabsTrigger value="player">Player Counts</TabsTrigger>
              <TabsTrigger value="streamer">Streamer Counts</TabsTrigger>
              <TabsTrigger value="viewer">Viewer Counts</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        {/* Start Date Selector */}
        <div className="space-y-1">
          <label className="text-sm font-medium">Start Date</label>
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className={cn(
                  "w-full justify-start text-left font-normal",
                  !startDate && "text-muted-foreground"
                )}
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {startDate ? format(startDate, "PPP") : "Select date"}
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
        <div className="space-y-1">
          <label className="text-sm font-medium">End Date</label>
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className={cn(
                  "w-full justify-start text-left font-normal",
                  !endDate && "text-muted-foreground"
                )}
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {endDate ? format(endDate, "PPP") : "Select date"}
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
      <Button 
        onClick={handleExport} 
        disabled={isExporting || !startDate || !endDate || selectedServers.length === 0}
        className="mt-2"
      >
        {isExporting ? (
          <>Exporting...</>
        ) : (
          <>
            <Download className="mr-2 h-4 w-4" />
            Export CSV
          </>
        )}
      </Button>
      
      {selectedServers.length === 0 && (
        <p className="text-sm text-muted-foreground">Please select at least one server to export data.</p>
      )}
    </div>
  )
} 