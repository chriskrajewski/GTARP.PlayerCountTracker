"use client"

import { useEffect, useState } from "react"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { getDataStartTimes, getServers, type DataStartInfo, type ServerData } from "@/lib/data"
import { Skeleton } from "@/components/ui/skeleton"
import { InfoIcon } from "lucide-react"

export function DataStartPopup() {
  const [isOpen, setIsOpen] = useState(false)
  const [dataStartTimes, setDataStartTimes] = useState<DataStartInfo[]>([])
  const [servers, setServers] = useState<ServerData[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function fetchData() {
      if (!isOpen) return
      
      try {
        setIsLoading(true)
        const [startTimes, serverData] = await Promise.all([
          getDataStartTimes(),
          getServers()
        ])
        
        setDataStartTimes(startTimes)
        setServers(serverData)
      } catch (err) {
        // Silent error in production
        setIsLoading(false)
      } finally {
        setIsLoading(false)
      }
    }
    
    fetchData()
  }, [isOpen])
  
  // Get server name by ID
  const getServerNameById = (serverId: string): string => {
    const server = servers.find(s => s.server_id === serverId)
    return server ? server.server_name : `Server ${serverId}`
  }
  
  // Format date for display
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
  
  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <button className="inline-flex items-center gap-1 text-muted-foreground hover:text-primary hover:underline">
          <span>Data start information</span>
          <InfoIcon className="h-4 w-4" />
        </button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Data Collection Start Dates</DialogTitle>
          <DialogDescription>
            These are the dates we started collecting data for each server.
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
          ) : dataStartTimes.length === 0 ? (
            <div className="text-center text-muted-foreground">
              No data start information available
            </div>
          ) : (
            <div className="space-y-2">
              {dataStartTimes.map((item) => (
                <div key={item.server_id} className="grid grid-cols-2 gap-2 pb-2">
                  <div className="font-medium text-sm">{getServerNameById(item.server_id)}</div>
                  <div className="text-sm text-muted-foreground">{formatDate(item.start_date)}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
} 