"use client"

import { useEffect, useState } from "react"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { getLastRefreshTimes, getServers, type LastRefreshInfo, type ServerData } from "@/lib/data"
import { Skeleton } from "@/components/ui/skeleton"
import { HistoryIcon } from "lucide-react"

export function DataRefreshPopup() {
  const [isOpen, setIsOpen] = useState(false)
  const [refreshTimes, setRefreshTimes] = useState<LastRefreshInfo[]>([])
  const [servers, setServers] = useState<ServerData[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  // For display in the button, store the most recent refresh time
  const [latestRefresh, setLatestRefresh] = useState<Date | null>(null)

  // Fetch data when popup opens or periodically (every minute) to keep the latest time updated
  useEffect(() => {
    async function fetchData() {
      try {
        const [refreshData, serverData] = await Promise.all([
          getLastRefreshTimes(),
          getServers()
        ])
        
        setRefreshTimes(refreshData)
        setServers(serverData)
        
        // Find the most recent timestamp across all servers
        if (refreshData.length > 0) {
          const timestamps = refreshData.map(item => new Date(item.last_refresh).getTime())
          const latestTimestamp = Math.max(...timestamps)
          setLatestRefresh(new Date(latestTimestamp))
        }
      } catch (err) {
        // Silent error in production
        setIsLoading(false)
      }
    }
    
    // Load immediately
    fetchData()
    
    // And refresh every minute when the dialog is open
    const intervalId = setInterval(() => {
      if (isOpen) {
        fetchData()
      }
    }, 60000)
    
    return () => clearInterval(intervalId)
  }, [isOpen])
  
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

  // Format relative time for button display (e.g. "3 minutes ago")
  const getRelativeTimeString = (date: Date | null): string => {
    if (!date) return "Unknown"
    
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffSecs = Math.round(diffMs / 1000)
    const diffMins = Math.round(diffSecs / 60)
    const diffHours = Math.round(diffMins / 60)
    const diffDays = Math.round(diffHours / 24)
    
    if (diffSecs < 60) return `${diffSecs} ${diffSecs === 1 ? 'second' : 'seconds'} ago`
    if (diffMins < 60) return `${diffMins} ${diffMins === 1 ? 'minute' : 'minutes'} ago`
    if (diffHours < 24) return `${diffHours} ${diffHours === 1 ? 'hour' : 'hours'} ago`
    return `${diffDays} ${diffDays === 1 ? 'day' : 'days'} ago`
  }
  
  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <button className="inline-flex items-center gap-1 text-muted-foreground hover:text-primary hover:underline">
          <span>Last updated {getRelativeTimeString(latestRefresh)}</span>
          <HistoryIcon className="h-4 w-4" />
        </button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Last Data Refresh Times</DialogTitle>
          <DialogDescription>
            These are the timestamps of the most recent data collected for each server.
          </DialogDescription>
        </DialogHeader>
        
        <div className="py-4">
          {isLoading ? (
            <div className="space-y-3">
              <Skeleton className="h-5 w-full" />
              <Skeleton className="h-5 w-full" />
              <Skeleton className="h-5 w-full" />
              <Skeleton className="h-5 w-full" />
            </div>
          ) : error ? (
            <div className="text-red-500">{error}</div>
          ) : refreshTimes.length === 0 ? (
            <div className="text-center text-muted-foreground">
              No refresh information available
            </div>
          ) : (
            <div className="space-y-2">
              {refreshTimes
                .sort((a, b) => new Date(b.last_refresh).getTime() - new Date(a.last_refresh).getTime())
                .map((item) => (
                  <div key={item.server_id} className="grid grid-cols-2 gap-2 pb-2">
                    <div className="font-medium text-sm">{getServerNameById(item.server_id)}</div>
                    <div className="text-sm text-muted-foreground">{formatDateTime(item.last_refresh)}</div>
                  </div>
                ))
              }
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
} 