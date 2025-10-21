"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Plus, Minus, Loader2, Share2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { CommonLayout } from "@/components/common-layout"
import {
  getServers,
  getServerResourceChanges,
  type ServerData,
  type ServerResourceChange,
} from "@/lib/data"
import { ServerResourceChangesCard } from "@/components/server-resource-panels"
import {
  buildServerSlugMaps,
  buildServerPrefixes,
  buildSlugLookup,
  resolveServerTokens,
  encodeServerTokens,
  decodeServerTokenString,
} from "@/lib/server-slugs"

type PageProps = {
  params: {
    servers?: string[]
  }
}

function arraysEqual(a: string[], b: string[]) {
  if (a.length !== b.length) return false
  return a.every((value, index) => value === b[index])
}

const SHORT_LINK_PARAM = "s"

type HorizonFilter = "24h" | "7d" | "30d" | "90d" | "all"
type ShareStatus = "copied" | "shared" | "error" | null

const HORIZON_OPTIONS: { value: HorizonFilter; label: string }[] = [
  { value: "24h", label: "24 Hours" },
  { value: "7d", label: "7 Days" },
  { value: "30d", label: "30 Days" },
  { value: "90d", label: "90 Days" },
  { value: "all", label: "All Time" },
]

const HORIZON_CODES: Record<HorizonFilter, string> = {
  "24h": "1d",
  "7d": "7d",
  "30d": "30d",
  "90d": "90d",
  all: "all",
}

const CODE_TO_HORIZON = Object.fromEntries(
  Object.entries(HORIZON_CODES).map(([horizon, code]) => [code.toLowerCase(), horizon as HorizonFilter]),
) as Record<string, HorizonFilter>

const HORIZON_FETCH_LIMIT: Record<HorizonFilter, number> = {
  "24h": 80,
  "7d": 120,
  "30d": 200,
  "90d": 300,
  all: 400,
}

const HORIZON_WINDOWS: Record<Exclude<HorizonFilter, "all">, number> = {
  "24h": 24 * 60 * 60 * 1000,
  "7d": 7 * 24 * 60 * 60 * 1000,
  "30d": 30 * 24 * 60 * 60 * 1000,
  "90d": 90 * 24 * 60 * 60 * 1000,
}

const normalizeUrlSafeBase64 = (value: string): string => {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/")
  const padding = normalized.length % 4 === 0 ? 0 : 4 - (normalized.length % 4)
  return normalized + "=".repeat(padding)
}

const decodeShareValue = (
  value: string,
): { tokens: string[]; horizon: HorizonFilter | null } | null => {
  if (!value) return null

  let serversPart = value
  let horizonPart = ""

  if (value.includes(".")) {
    const lastDot = value.lastIndexOf(".")
    serversPart = value.slice(0, lastDot)
    horizonPart = value.slice(lastDot + 1)
  }

  let tokens = decodeServerTokenString(serversPart)
  let horizon: HorizonFilter | null = null

  if (horizonPart) {
    const normalized = horizonPart.toLowerCase()
    horizon = CODE_TO_HORIZON[normalized] ?? null
  }

  if (tokens.length === 0 && typeof window !== "undefined") {
    try {
      const decoded = window.atob(normalizeUrlSafeBase64(value))
      const parsed = JSON.parse(decoded) as { s?: unknown; h?: unknown }

      if (Array.isArray(parsed.s)) {
        tokens = parsed.s.filter((id): id is string => typeof id === "string")
      }

      if (!horizon && typeof parsed.h === "string") {
        const candidate = parsed.h.toLowerCase()
        horizon = CODE_TO_HORIZON[candidate] ?? null
      }
    } catch (error) {
      // ignore legacy parse errors
    }
  }

  return { tokens, horizon }
}

const encodeShareValue = (
  serverIds: string[],
  horizon: HorizonFilter,
  prefixes: Record<string, string>,
): string => {
  if (serverIds.length === 0) return ""
  const tokenPart = encodeServerTokens(serverIds, prefixes)
  const horizonToken = (HORIZON_CODES[horizon] ?? horizon).toLowerCase()
  return `${tokenPart}.${horizonToken}`
}

const filterChangesByHorizon = (changes: ServerResourceChange[], horizon: HorizonFilter): ServerResourceChange[] => {
  if (horizon === "all") {
    return changes
  }

  const windowMs = HORIZON_WINDOWS[horizon]
  const now = Date.now()
  const cutoff = now - windowMs
  return changes.filter((change) => {
    const timestamp = new Date(change.timestamp).getTime()
    return !Number.isNaN(timestamp) && timestamp >= cutoff
  })
}

export default function ServerChangelogPage({ params }: PageProps) {
  const [servers, setServers] = useState<ServerData[]>([])
  const [selectedServers, setSelectedServers] = useState<string[]>([])
  const [changeData, setChangeData] = useState<Record<string, ServerResourceChange[]>>({})
  const [loadingServers, setLoadingServers] = useState(true)
  const [loadingChanges, setLoadingChanges] = useState(false)
  const [changesError, setChangesError] = useState<string | null>(null)
  const [addPopoverOpen, setAddPopoverOpen] = useState(false)
  const [timeHorizon, setTimeHorizon] = useState<HorizonFilter>("7d")
  const [shareStatus, setShareStatus] = useState<ShareStatus>(null)

  const shareResetTimeout = useRef<ReturnType<typeof setTimeout> | null>(null)

  const router = useRouter()
  const searchParams = useSearchParams()
  const basePath = "/serverchangelog"

  useEffect(() => {
    let active = true

    async function loadServers() {
      try {
        setLoadingServers(true)
        const data = await getServers()
        if (!active) return
        setServers(data)
      } catch (error) {
        console.error("Failed to load servers:", error)
      } finally {
        if (active) {
          setLoadingServers(false)
        }
      }
    }

    loadServers()

    return () => {
      active = false
    }
  }, [])

  const slugMaps = useMemo(() => buildServerSlugMaps(servers), [servers])
  const slugLookup = useMemo(() => buildSlugLookup(servers, slugMaps), [servers, slugMaps])
  const serverPrefixes = useMemo(() => buildServerPrefixes(servers, slugLookup), [servers, slugLookup])
  useEffect(() => {
    if (typeof window === "undefined") return
    if (servers.length === 0) return

    const params = new URLSearchParams(window.location.search)
    let updated = false

    if (selectedServers.length > 0) {
      const encoded = encodeShareValue(selectedServers, timeHorizon, serverPrefixes)
      if (encoded && params.get(SHORT_LINK_PARAM) !== encoded) {
        params.set(SHORT_LINK_PARAM, encoded)
        updated = true
      }
    } else if (params.has(SHORT_LINK_PARAM)) {
      params.delete(SHORT_LINK_PARAM)
      updated = true
    }

    if (params.has("servers")) {
      params.delete("servers")
      updated = true
    }

    if (params.has("range")) {
      params.delete("range")
      updated = true
    }

    if (params.has("h")) {
      params.delete("h")
      updated = true
    }

    if (!updated) return

    const nextSearch = params.toString()
    router.replace(`${basePath}${nextSearch ? `?${nextSearch}` : ""}`, { scroll: false })
  }, [selectedServers, timeHorizon, router, servers.length, serverPrefixes, basePath])

  useEffect(() => {
    return () => {
      if (shareResetTimeout.current) {
        clearTimeout(shareResetTimeout.current)
      }
    }
  }, [])

  const buildShareableUrl = (): string => {
    if (typeof window === "undefined") return ""
    const url = new URL(window.location.href)

    if (selectedServers.length === 0) {
      url.searchParams.delete(SHORT_LINK_PARAM)
      return url.toString()
    }

    const encoded = encodeShareValue(selectedServers, timeHorizon, serverPrefixes)
    if (encoded) {
      url.searchParams.set(SHORT_LINK_PARAM, encoded)
    } else {
      url.searchParams.delete(SHORT_LINK_PARAM)
    }

    return url.toString()
  }

  const scheduleShareReset = (status: ShareStatus, duration = 2500) => {
    if (shareResetTimeout.current) {
      clearTimeout(shareResetTimeout.current)
    }

    setShareStatus(status)

    if (status) {
      shareResetTimeout.current = setTimeout(() => {
        setShareStatus(null)
        shareResetTimeout.current = null
      }, duration)
    }
  }

  const handleShare = async () => {
    const shareUrl = buildShareableUrl()
    if (!shareUrl) return

    const canUseNativeShare = typeof navigator !== "undefined" && typeof navigator.share === "function"

    if (canUseNativeShare) {
      try {
        await navigator.share({ url: shareUrl, title: "Server Change Log" })
        scheduleShareReset("shared")
        return
      } catch (error: any) {
        if (error?.name === "AbortError") {
          scheduleShareReset(null)
          return
        }
        console.warn("Native share failed, using clipboard fallback", error)
      }
    }

    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(shareUrl)
        scheduleShareReset("copied")
      } else {
        window.prompt("Copy this link", shareUrl)
        scheduleShareReset("copied")
      }
    } catch (error) {
      console.error("Error copying share link:", error)
      scheduleShareReset("error", 4000)
    }
  }

  const shareStatusMessage =
    shareStatus === "copied"
      ? "Link ready—copied to your clipboard when supported."
      : shareStatus === "shared"
        ? "Share dialog opened—send it to a friend."
        : shareStatus === "error"
          ? "Couldn't share the link. Please try again."
          : ""

  const shareStatusClass =
    shareStatus === "error" ? "text-red-400" : shareStatus ? "text-emerald-400" : ""

  const searchKey = searchParams ? searchParams.toString() : ""

  useEffect(() => {
    if (loadingServers) return

    if (servers.length === 0) {
      if (selectedServers.length > 0) {
        setSelectedServers([])
      }
      return
    }

    const shareValue = searchParams?.get(SHORT_LINK_PARAM) ?? null
    let nextServers: string[] | null = null
    let nextHorizon: HorizonFilter | null = null

    if (shareValue) {
      const decoded = decodeShareValue(shareValue)
      if (decoded) {
        const resolvedShare = resolveServerTokens(decoded.tokens, slugMaps, servers, slugLookup)
        if (resolvedShare.length > 0) {
          nextServers = resolvedShare
        }
        if (decoded.horizon && HORIZON_OPTIONS.some((option) => option.value === decoded.horizon)) {
          nextHorizon = decoded.horizon
        }
      }
    }

    if (!nextServers) {
      const routeServers = params.servers ?? []
      if (routeServers.length > 0) {
        const resolvedRoute = resolveServerTokens(
          routeServers.map((segment) => segment.trim()).filter((segment) => segment.length > 0),
          slugMaps,
          servers,
          slugLookup,
        )
        if (resolvedRoute.length > 0) {
          nextServers = resolvedRoute
        }
      }
    }

    if (!nextServers && selectedServers.length > 0) {
      nextServers = selectedServers
    }

    if (!nextServers) {
      if (selectedServers.length > 0) {
        setSelectedServers([])
      }
    } else if (!arraysEqual(nextServers, selectedServers)) {
      setSelectedServers(nextServers)
    }

    if (nextHorizon && nextHorizon !== timeHorizon) {
      setTimeHorizon(nextHorizon)
    }
  }, [loadingServers, servers, slugMaps, slugLookup, params.servers, searchKey, selectedServers, timeHorizon])

  useEffect(() => {
    if (selectedServers.length === 0) {
      setChangeData({})
      setChangesError(null)
      return
    }

    let active = true
    const selectionSnapshot = [...selectedServers]

    async function loadChanges() {
      setChangeData({})
      setLoadingChanges(true)
      setChangesError(null)

      try {
        const fetchLimit = HORIZON_FETCH_LIMIT[timeHorizon] ?? 200
        const results = await Promise.allSettled(
          selectionSnapshot.map((serverId) => getServerResourceChanges(serverId, fetchLimit)),
        )

        if (!active) return

        const nextData: Record<string, ServerResourceChange[]> = {}
        let errorMessage: string | null = null

        results.forEach((result, index) => {
          const serverId = selectionSnapshot[index]
          if (result.status === "fulfilled") {
            nextData[serverId] = result.value
          } else {
            nextData[serverId] = []
            errorMessage = "Some server data failed to load."
            console.error("Error loading change log for server:", serverId, result.reason)
          }
        })

        setChangeData(nextData)
        setChangesError(errorMessage)
      } finally {
        if (active) {
          setLoadingChanges(false)
        }
      }
    }

    loadChanges()

    return () => {
      active = false
    }
  }, [selectedServers, timeHorizon])

  const getServerNameById = (serverId: string): string => {
    const server = servers.find((entry) => entry.server_id === serverId)
    return server ? server.server_name : serverId
  }

  const handleAddServer = (serverId: string) => {
    if (!serverId || selectedServers.includes(serverId)) return
    const next = [...selectedServers, serverId]
    setSelectedServers(next)
    setAddPopoverOpen(false)
  }

  const handleRemoveServer = (serverId: string) => {
    const next = selectedServers.filter((id) => id !== serverId)
    setSelectedServers(next)
  }

  const unselectedServers = servers.filter((server) => !selectedServers.includes(server.server_id))

  return (
    <CommonLayout showBackButton pageTitle="Server Change Log">
      <div className="space-y-6 py-4">
        <div className="flex flex-wrap items-center gap-2">
          {selectedServers.map((serverId) => {
            const serverName = getServerNameById(serverId)
            return (
              <Badge
                key={serverId}
                variant="secondary"
                className="flex items-center gap-2 bg-[#18181b] border-[#26262c] text-[#EFEFF1]"
              >
                {serverName}
                <button
                  onClick={() => handleRemoveServer(serverId)}
                  className="inline-flex items-center justify-center rounded-full bg-[#2d2d33] p-0.5 hover:bg-[#3e3e44]"
                >
                  <Minus className="h-3 w-3" />
                  <span className="sr-only">Remove {serverName}</span>
                </button>
              </Badge>
            )
          })}

          <Popover open={addPopoverOpen} onOpenChange={setAddPopoverOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                size="icon"
                className="h-9 w-9 bg-[#18181b] border-[#26262c] text-[#EFEFF1] hover:bg-[#26262c]"
                disabled={loadingServers || unselectedServers.length === 0}
              >
                <Plus className="h-4 w-4" />
                <span className="sr-only">Add server</span>
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-72 p-0 border-[#26262c] bg-[#0e0e10]">
              <Command>
                <CommandInput
                  placeholder="Search servers..."
                  className="border-b border-[#26262c] text-[#EFEFF1] placeholder:text-[#6B7280]"
                />
                <CommandList>
                  <CommandEmpty>No server found.</CommandEmpty>
                  <CommandGroup>
                    {unselectedServers.map((server) => (
                      <CommandItem
                        key={server.server_id}
                        value={server.server_name}
                        onSelect={() => handleAddServer(server.server_id)}
                        className="text-[#EFEFF1] focus:bg-[#1f1f23]"
                      >
                        {server.server_name}
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2 text-sm text-[#9CA3AF]">
            <span>Time Horizon:</span>
            <Select value={timeHorizon} onValueChange={(value) => setTimeHorizon(value as HorizonFilter)}>
              <SelectTrigger className="w-[180px] bg-[#18181b] border-[#26262c] text-[#EFEFF1]">
                <SelectValue placeholder="Select horizon" />
              </SelectTrigger>
              <SelectContent className="bg-[#0e0e10] border-[#26262c] text-[#EFEFF1]">
                {HORIZON_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1 sm:items-end">
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                onClick={handleShare}
                disabled={selectedServers.length === 0}
                title={shareStatusMessage || "Share this view"}
                className="flex items-center gap-2 bg-[#18181b] border-[#26262c] text-[#EFEFF1] hover:bg-[#26262c] hover:border-[#343438]"
              >
                <Share2 className={`h-4 w-4 ${shareStatus === "copied" || shareStatus === "shared" ? "text-[#22c55e]" : shareStatus === "error" ? "text-red-400" : ""}`} />
                <span className="text-sm">Share</span>
              </Button>
            </div>
            {shareStatusMessage && (
              <span className={`text-xs ${shareStatusClass}`} aria-live="polite">
                {shareStatusMessage}
              </span>
            )}
          </div>
        </div>

        {loadingServers ? (
          <div className="flex items-center gap-2 rounded-md border border-[#26262c] bg-[#111113] p-4 text-[#9CA3AF]">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading available servers...
          </div>
        ) : selectedServers.length === 0 ? (
          <div className="rounded-md border border-dashed border-[#26262c] bg-[#111113] p-6 text-center text-sm text-[#9CA3AF]">
            Use the <span className="font-semibold text-[#EFEFF1]">+</span> button to add servers and review their
            resource change history here.
          </div>
        ) : (
          <div className="grid gap-4">
            {changesError && (
              <div className="rounded-md border border-yellow-500/40 bg-yellow-500/10 p-3 text-sm text-yellow-200">
                {changesError}
              </div>
            )}

            {selectedServers.map((serverId) => {
              const serverName = getServerNameById(serverId)
              const data = changeData[serverId] ?? []
              const isLoading = loadingChanges && !(serverId in changeData)
              const filteredChanges = filterChangesByHorizon(data, timeHorizon)
              const horizonLabel = HORIZON_OPTIONS.find((option) => option.value === timeHorizon)?.label ?? "Selected range"

              return (
                <ServerResourceChangesCard
                  key={serverId}
                  changes={filteredChanges}
                  loading={isLoading}
                  error={null}
                  title={`${serverName} Change Log`}
                  description={`Latest resource updates for ${serverName} (Last ${horizonLabel.toLowerCase()})`}
                  emptyMessage={`No recorded resource changes for ${serverName} yet.`}
                  maxHeightClass="max-h-[480px]"
                />
              )
            })}
          </div>
        )}
      </div>
    </CommonLayout>
  )
}
