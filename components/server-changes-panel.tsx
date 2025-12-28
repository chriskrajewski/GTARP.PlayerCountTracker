"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { RefreshCw, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Badge } from "@/components/ui/badge"
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger
} from "@/components/ui/accordion"
import {
  type ServerData,
  type ServerResourceChange,
  type ServerResourceSnapshot,
  getServerResourceChangesBulk,
  getLatestServerResourceSnapshots,
  getServerResourceChanges,
  getServerResourceSnapshot
} from "@/lib/data"

interface ServerChangesPanelProps {
  isOpen: boolean
  serverId?: string | null
  serverName?: string | null
  servers: ServerData[]
}

const dateFormatter = new Intl.DateTimeFormat(undefined, {
  year: "numeric",
  month: "short",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit"
})

function formatTimestamp(timestamp: string) {
  try {
    return dateFormatter.format(new Date(timestamp))
  } catch (_err) {
    return timestamp
  }
}

export function ServerChangesPanel({
  isOpen,
  serverId,
  serverName,
  servers
}: ServerChangesPanelProps) {
  const [changes, setChanges] = useState<ServerResourceChange[]>([])
  const [latestSnapshot, setLatestSnapshot] = useState<ServerResourceSnapshot | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [expandedSections, setExpandedSections] = useState<string[]>([])
  const sectionRefs = useRef<Record<string, HTMLElement | null>>({})

  const serverNameMap = useMemo(() => {
    return servers.reduce<Record<string, string>>((acc, server) => {
      acc[server.server_id] = server.server_name
      return acc
    }, {})
  }, [servers])

  const loadData = async () => {
    if (!serverId) return

    setLoading(true)
    setError(null)
    try {
      const [changesResult, snapshotResult] = await Promise.allSettled([
        getServerResourceChanges(serverId, 100),
        getServerResourceSnapshot(serverId)
      ])

      let message: string | null = null

      if (changesResult.status === "fulfilled") {
        setChanges(changesResult.value)
      } else {
        console.error("Error loading server resource changes:", changesResult.reason)
        setChanges([])
        message = "Failed to load server changes."
      }

      if (snapshotResult.status === "fulfilled") {
        setLatestSnapshot(snapshotResult.value)
      } else {
        console.error("Error loading server resource snapshot:", snapshotResult.reason)
        setLatestSnapshot(null)
        message = message
          ? `${message} Current resource list unavailable.`
          : "Failed to load current resource list."
      }

      setError(message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!isOpen || !serverId) return
    loadData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, serverId])

  useEffect(() => {
    if (isOpen) {
      setExpandedSections([])
    }
  }, [isOpen, serverId])

  const resources = Array.isArray(latestSnapshot?.resources) ? latestSnapshot.resources : []

  return (
    <div className="space-y-4 text-white">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <div>
          <h2 className="text-lg font-semibold">Server Resource Changes</h2>
          <p className="text-xs text-[#ADADB8]">
            Tracking updates to the FiveM resource list for {serverName || "this server"}.
          </p>
        </div>
        <Button
          onClick={loadData}
          variant="secondary"
          size="sm"
          className="bg-[#18181b] hover:bg-[#26262c] text-white"
          disabled={loading}
        >
          {loading ? (
            <Loader2 className="mr-1 h-4 w-4 animate-spin" />
          ) : (
            <RefreshCw className="mr-1 h-4 w-4" />
          )}
          Refresh
        </Button>
      </div>

      {error && (
        <div className="rounded-md border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-200">
          {error}
        </div>
      )}

      <ScrollArea className="h-[60vh] min-h-[280px] pr-2">
        <div className="space-y-4 pb-2">
          {/* Change History Section */}
          <div className="rounded-md border border-[#26262c] bg-[#18181b] p-3">
            <h3 className="text-sm font-semibold text-white">Change History</h3>
            <p className="text-xs text-[#ADADB8]">
              Logged differences between consecutive snapshots.
            </p>

            {!loading && changes.length === 0 && !error && (
              <div className="mt-3 rounded-md border border-[#26262c] bg-[#141417] p-3 text-sm text-[#ADADB8]">
                No resource changes have been recorded yet for this server.
              </div>
            )}

            <div className="mt-3 space-y-3">
              {changes.map((change) => {
                const added = change.added_resources ?? []
                const removed = change.removed_resources ?? []
                return (
                  <div
                    key={change.id}
                    className="rounded-md border border-[#26262c] bg-[#141417] p-3"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 text-xs text-[#ADADB8]">
                      <span className="font-medium text-white">
                        {formatTimestamp(change.timestamp)}
                      </span>
                    </div>

                    {added.length > 0 && (
                      <div className="mt-3">
                        <p className="text-[11px] uppercase tracking-wide text-emerald-400">Added</p>
                        <div className="mt-1 flex flex-wrap gap-1">
                          {added.map((resource) => (
                            <Badge
                              key={`added-${change.id}-${resource}`}
                              className="bg-emerald-500/20 text-emerald-100 border border-emerald-500/40"
                            >
                              {resource}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}

                    {removed.length > 0 && (
                      <div className="mt-3">
                        <p className="text-[11px] uppercase tracking-wide text-rose-400">Removed</p>
                        <div className="mt-1 flex flex-wrap gap-1">
                          {removed.map((resource) => (
                            <Badge
                              key={`removed-${change.id}-${resource}`}
                              className="bg-rose-500/20 text-rose-100 border border-rose-500/40"
                            >
                              {resource}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}

                    {added.length === 0 && removed.length === 0 && (
                      <p className="mt-3 text-xs text-[#ADADB8]">
                        Resource list changed but no specific additions or removals were detected.
                      </p>
                    )}
                  </div>
                )
              })}
            </div>
          </div>

          {/* Current Resource List Section */}
          <div className="rounded-md border border-[#26262c] bg-[#18181b] p-3">
            <h3 className="text-sm font-semibold text-white">Current Resource List</h3>
            <p className="text-xs text-[#ADADB8]">
              Latest snapshot pulled from the FiveM API.
            </p>

            {!loading && !latestSnapshot && (
              <div className="mt-3 rounded-md border border-[#26262c] bg-[#141417] p-3 text-xs text-[#ADADB8]">
                No snapshot data available yet.
              </div>
            )}

            {latestSnapshot && (
              <div className="mt-3">
                <div className="rounded-md border border-[#26262c] bg-[#141417] p-3">
                  <div className="flex flex-col gap-1">
                    <span className="text-sm font-semibold text-white">
                      {serverName || `Server ${serverId}`}
                    </span>
                    <span className="text-[11px] text-[#ADADB8]">
                      Last updated {formatTimestamp(latestSnapshot.timestamp)} • {resources.length} resources
                    </span>
                  </div>
                  {resources.length > 0 ? (
                    <div className="mt-3 flex flex-wrap gap-1">
                      {resources.map((resource) => (
                        <Badge
                          key={`snapshot-${serverId}-${resource}`}
                          className="bg-[#1f1f24] text-[#EFEFF1] border border-[#2e2e36]"
                        >
                          {resource}
                        </Badge>
                      ))}
                    </div>
                  ) : (
                    <p className="mt-3 text-xs text-[#ADADB8]">
                      No resource data captured yet for this server.
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </ScrollArea>
    </div>
  )
}
