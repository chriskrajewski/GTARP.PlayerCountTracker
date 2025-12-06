"use client"

import { useMemo, useState } from "react"
import { formatDistanceToNow } from "date-fns"
import { AlertCircle, Box, History } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Input } from "@/components/ui/input"
import { Separator } from "@/components/ui/separator"
import type { ServerResourceChange, ServerResourceSnapshot } from "@/lib/data"

interface LatestAssetsCardProps {
  serverName: string
  latestChange: ServerResourceChange | null
  loading: boolean
  error?: string | null
}

export function ServerLatestAssetsCard({
  serverName,
  latestChange,
  loading,
  error,
}: LatestAssetsCardProps) {
  const addedResources = latestChange?.added_resources ?? []
  const removedResources = latestChange?.removed_resources ?? []

  return (
    <Card className="bg-[#0e0e10] border-[#26262c] h-full">
      <CardHeader className="border-b border-[#26262c]">
        <CardTitle className="text-[#EFEFF1] text-lg flex items-center gap-2">
          <Box className="h-5 w-5 text-[#00a7c4]" />
          Latest Assets Update
        </CardTitle>
        <CardDescription className="text-[#9CA3AF]">
          Most recent resource change recorded for {serverName}
        </CardDescription>
      </CardHeader>
      <CardContent className="pt-4 space-y-4">
        {error ? (
          <div className="flex items-start gap-2 rounded-md border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-300">
            <AlertCircle className="h-4 w-4 mt-0.5" />
            <div>
              <p className="font-medium">Unable to load latest change</p>
              <p className="text-xs text-red-200/70">{error}</p>
            </div>
          </div>
        ) : loading ? (
          <div className="space-y-3">
            <div className="h-4 w-2/3 animate-pulse rounded bg-[#1f1f23]" />
            <div className="h-4 w-1/2 animate-pulse rounded bg-[#1f1f23]" />
            <div className="h-4 w-3/4 animate-pulse rounded bg-[#1f1f23]" />
          </div>
        ) : !latestChange ? (
          <p className="text-sm text-[#9CA3AF]">
            No resource changes have been captured for this server yet.
          </p>
        ) : (
          <>
            <div className="text-sm text-[#9CA3AF]">
              Updated {formatDistanceToNow(new Date(latestChange.timestamp), { addSuffix: true })}
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <h3 className="text-sm font-semibold text-[#EFEFF1] mb-2">Added ({addedResources.length})</h3>
                {addedResources.length === 0 ? (
                  <p className="text-xs text-[#9CA3AF]">No new assets</p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {addedResources.map((resource, index) => (
                      <Badge key={`added-${index}-${resource}`} variant="secondary" className="bg-[#1f1f23] border-[#2d2d33] text-[#EFEFF1]">
                        {resource}
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
              <div>
                <h3 className="text-sm font-semibold text-[#EFEFF1] mb-2">Removed ({removedResources.length})</h3>
                {removedResources.length === 0 ? (
                  <p className="text-xs text-[#9CA3AF]">No removals</p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {removedResources.map((resource, index) => (
                      <Badge key={`removed-${index}-${resource}`} variant="outline" className="border-[#ef4444]/60 text-[#ef4444] bg-[#2a0f12]">
                        {resource}
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  )
}

interface ChangeLogCardProps {
  changes: ServerResourceChange[]
  loading: boolean
  error?: string | null
  title?: string
  description?: string
  emptyMessage?: string
  maxHeightClass?: string
}

export function ServerResourceChangesCard({
  changes,
  loading,
  error,
  title,
  description,
  emptyMessage,
  maxHeightClass,
}: ChangeLogCardProps) {
  const cardTitle = title ?? "Server Change Log"
  const cardDescription = description ?? "Timeline of recorded resource additions and removals"
  const emptyStateMessage =
    emptyMessage ?? "No resource change history is available yet for this server."
  const scrollClass = maxHeightClass ?? "max-h-[360px]"
  const containerClass = `${scrollClass} overflow-y-auto`

  return (
    <Card className="bg-[#0e0e10] border-[#26262c]">
      <CardHeader className="border-b border-[#26262c]">
        <CardTitle className="text-[#EFEFF1] text-lg flex items-center gap-2">
          <History className="h-5 w-5 text-[#8b5cf6]" />
          {cardTitle}
        </CardTitle>
        <CardDescription className="text-[#9CA3AF]">
          {cardDescription}
        </CardDescription>
      </CardHeader>
      <CardContent className="pt-4">
        {error ? (
          <div className="flex items-start gap-2 rounded-md border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-300">
            <AlertCircle className="h-4 w-4 mt-0.5" />
            <div>
              <p className="font-medium">Unable to load change log</p>
              <p className="text-xs text-red-200/70">{error}</p>
            </div>
          </div>
        ) : loading ? (
          <div className="space-y-4">
            {Array.from({ length: 3 }).map((_, index) => (
              <div key={`change-skeleton-${index}`} className="space-y-2">
                <div className="h-4 w-1/3 animate-pulse rounded bg-[#1f1f23]" />
                <div className="h-3 w-1/2 animate-pulse rounded bg-[#1f1f23]" />
                <div className="h-3 w-2/3 animate-pulse rounded bg-[#1f1f23]" />
              </div>
            ))}
          </div>
        ) : changes.length === 0 ? (
          <p className="text-sm text-[#9CA3AF]">
            {emptyStateMessage}
          </p>
        ) : (
          <div className={containerClass}>
            <div className="space-y-4">
              {changes.map((change) => {
                const added = change.added_resources ?? []
                const removed = change.removed_resources ?? []

                const formatList = (items: string[]) => {
                  if (items.length === 0) return "None"
                  return items.join(", ")
                }

                return (
                  <div key={change.id} className="rounded-md border border-[#26262c] bg-[#111113] p-4 text-sm text-[#EFEFF1]">
                    <div className="flex flex-col gap-3">
                      {/* Timestamp */}
                      <span className="text-xs font-medium text-[#9CA3AF] bg-[#1f1f23] px-2 py-1 rounded w-fit">
                        {formatDistanceToNow(new Date(change.timestamp), { addSuffix: true })}
                      </span>
                      
                      {/* Added Section */}
                      {added.length > 0 && (
                        <div className="flex flex-col gap-2">
                          <span className="text-xs font-semibold uppercase tracking-wider text-[#22c55e]">
                            ✓ Added ({added.length})
                          </span>
                          <div className="flex flex-col gap-1 pl-3 border-l-2 border-[#22c55e]/30">
                            {added.map((item, idx) => (
                              <span key={`added-${idx}`} className="text-sm text-[#C4F1F9] break-words">
                                • {item}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                      
                      {/* Removed Section */}
                      {removed.length > 0 && (
                        <div className="flex flex-col gap-2">
                          <span className="text-xs font-semibold uppercase tracking-wider text-[#ef4444]">
                            ✗ Removed ({removed.length})
                          </span>
                          <div className="flex flex-col gap-1 pl-3 border-l-2 border-[#ef4444]/30">
                            {removed.map((item, idx) => (
                              <span key={`removed-${idx}`} className="text-sm text-[#FCA5A5] break-words">
                                • {item}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

interface ResourceListCardProps {
  snapshot: ServerResourceSnapshot | null
  loading: boolean
  error?: string | null
}

export function ServerResourceListCard({ snapshot, loading, error }: ResourceListCardProps) {
  const resources = snapshot?.resources ?? []
  const [query, setQuery] = useState("")

  const sortedResources = useMemo(() => {
    return [...resources].sort((a, b) => a.localeCompare(b))
  }, [resources])

  const filteredResources = useMemo(() => {
    const value = query.trim().toLowerCase()
    if (!value) return sortedResources
    return sortedResources.filter((resource) => resource.toLowerCase().includes(value))
  }, [sortedResources, query])

  return (
    <Card className="bg-[#0e0e10] border-[#26262c] h-full">
      <CardHeader className="border-b border-[#26262c]">
        <CardTitle className="text-[#EFEFF1] text-lg flex items-center gap-2">
          <Box className="h-5 w-5 text-[#22c55e]" />
          Server Resources
        </CardTitle>
        <CardDescription className="text-[#9CA3AF]">
          Full snapshot of currently tracked assets ({resources.length})
        </CardDescription>
      </CardHeader>
      <CardContent className="pt-4 space-y-4">
        {error ? (
          <div className="flex items-start gap-2 rounded-md border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-300">
            <AlertCircle className="h-4 w-4 mt-0.5" />
            <div>
              <p className="font-medium">Unable to load resources</p>
              <p className="text-xs text-red-200/70">{error}</p>
            </div>
          </div>
        ) : loading ? (
          <div className="space-y-3">
            <div className="h-9 w-full animate-pulse rounded bg-[#1f1f23]" />
            <div className="h-40 w-full animate-pulse rounded bg-[#1f1f23]" />
          </div>
        ) : !snapshot ? (
          <p className="text-sm text-[#9CA3AF]">
            No resource snapshot is available yet for this server.
          </p>
        ) : (
          <>
            <div className="flex items-center gap-2">
              <Input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Filter resources..."
                className="bg-[#111113] border-[#26262c] text-[#EFEFF1] placeholder:text-[#6B7280]"
              />
              <span className="text-xs text-[#9CA3AF] whitespace-nowrap">
                {filteredResources.length} shown
              </span>
            </div>
            <ScrollArea className="max-h-[420px] rounded-md border border-[#1f1f23] bg-[#111113] p-3">
              {filteredResources.length === 0 ? (
                <p className="text-sm text-[#9CA3AF]">No resources match your search.</p>
              ) : (
                <ul className="space-y-2 text-sm text-[#EFEFF1]">
                  {filteredResources.map((resource, index) => (
                    <li
                      key={`${resource}-${index}`}
                      className="rounded-md border border-transparent bg-[#18181b] px-3 py-2 transition hover:border-[#2d2d33]"
                    >
                      {resource}
                    </li>
                  ))}
                </ul>
              )}
            </ScrollArea>
            <p className="text-xs text-[#6B7280]">
              Snapshot captured{" "}
              {formatDistanceToNow(new Date(snapshot.timestamp), { addSuffix: true })}.
            </p>
          </>
        )}
      </CardContent>
    </Card>
  )
}
