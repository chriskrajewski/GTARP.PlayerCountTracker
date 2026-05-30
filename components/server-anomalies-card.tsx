"use client"

import { useEffect, useState } from "react"
import { motion } from "motion/react"
import { Activity, TrendingDown, TrendingUp } from "lucide-react"
import { formatDistanceToNow } from "date-fns"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { useFailClosedFeatureFlag, FEATURE_FLAGS } from "@/lib/feature-flags"
import type { AnomalyRecord } from "@/lib/anomaly"

interface ServerAnomaliesCardProps {
  serverId: string
  serverName?: string
}

/** How many recent anomalies to surface on the compact server card. */
const PUBLIC_ANOMALY_LIMIT = 5

/** Local fetch lifecycle for the recorded anomalies. */
type AnomaliesState =
  | { status: "loading" }
  | { status: "error" }
  | { status: "ready"; anomalies: AnomalyRecord[] }

/**
 * Public anomaly surface for a single server (R7.5).
 *
 * Fetches recorded anomalies from `/api/anomalies` (which runs the server-side
 * `getAnomaliesForServer`, R9.3 — the component never queries the table
 * directly) and renders the most recent ones as a compact list: spike vs drop,
 * observed vs expected, deviation %, and a relative timestamp.
 *
 * The surface is gated fail-closed behind `anomaly_public` (R1.2/R1.4 + R7.5):
 * it renders nothing unless the flag is explicitly enabled. The API route also
 * enforces the flag server-side for defense-in-depth.
 *
 * Empty-state choice: when there are no active anomalies the component renders
 * NOTHING (returns `null`) to keep the server card surface clean — anomalies are
 * exceptional by nature, so a persistent "no anomalies" panel would add noise to
 * the common case. Loading and error states are likewise rendered as `null`
 * (the card only appears once there is something noteworthy to show).
 */
export function ServerAnomaliesCard({ serverId, serverName }: ServerAnomaliesCardProps) {
  const enabled = useFailClosedFeatureFlag(FEATURE_FLAGS.ANOMALY_PUBLIC)
  const [state, setState] = useState<AnomaliesState>({ status: "loading" })

  useEffect(() => {
    // Don't fetch while the feature is gated off or without a server.
    if (!enabled || !serverId) {
      return
    }

    let cancelled = false
    setState({ status: "loading" })

    const controller = new AbortController()

    fetch(
      `/api/anomalies?serverId=${encodeURIComponent(serverId)}&limit=${PUBLIC_ANOMALY_LIMIT}`,
      { signal: controller.signal }
    )
      .then(async (res) => {
        if (!res.ok) throw new Error(`Request failed: ${res.status}`)
        const data = await res.json()
        if (!data?.success || !Array.isArray(data.anomalies)) {
          throw new Error("Malformed anomalies response")
        }
        if (!cancelled) {
          setState({ status: "ready", anomalies: data.anomalies as AnomalyRecord[] })
        }
      })
      .catch(() => {
        if (!cancelled) {
          setState({ status: "error" })
        }
      })

    return () => {
      cancelled = true
      controller.abort()
    }
  }, [enabled, serverId])

  // Fail-closed gate (R1.2/R1.4 + R7.5): render nothing when disabled.
  if (!enabled) {
    return null
  }

  // Keep the surface clean: nothing to show while loading, on error, or when
  // there are no active anomalies.
  if (state.status !== "ready" || state.anomalies.length === 0) {
    return null
  }

  return (
    <Card variant="glass" className="overflow-hidden">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-bold text-white flex items-center gap-2">
          <Activity className="h-4 w-4 text-cyan-400" />
          <span>Recent anomalies</span>
          {serverName && (
            <span className="text-xs font-normal text-gray-500 truncate">· {serverName}</span>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-2">
        <ul className="flex flex-col gap-2.5">
          {state.anomalies.slice(0, PUBLIC_ANOMALY_LIMIT).map((anomaly, index) => (
            <AnomalyRow key={anomaly.id} anomaly={anomaly} index={index} />
          ))}
        </ul>
      </CardContent>
    </Card>
  )
}

/** Renders a single anomaly entry: spike (emerald) vs drop (red). */
function AnomalyRow({ anomaly, index }: { anomaly: AnomalyRecord; index: number }) {
  const isSpike = anomaly.direction === "spike"
  const Icon = isSpike ? TrendingUp : TrendingDown
  const accent = isSpike ? "text-emerald-400" : "text-red-400"

  return (
    <motion.li
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.04, duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
      className="flex items-start gap-2.5"
    >
      <Icon className={`mt-0.5 h-4 w-4 flex-shrink-0 ${accent}`} />
      <div className="flex min-w-0 flex-col">
        <div className="flex items-baseline gap-1.5 text-sm">
          <span className={`font-semibold capitalize ${accent}`}>{anomaly.direction}</span>
          <span className="text-gray-300">
            <span className="font-semibold text-white">{anomaly.observed_value}</span>
            <span className="text-gray-500"> vs expected </span>
            <span className="font-semibold text-gray-200">{anomaly.expected_value}</span>
          </span>
          <span className={`text-xs font-semibold ${accent}`}>
            {isSpike ? "+" : "−"}
            {Math.abs(anomaly.deviation_percent)}%
          </span>
        </div>
        <span className="text-[11px] text-gray-500">{relativeTime(anomaly.timestamp)}</span>
      </div>
    </motion.li>
  )
}

/**
 * Format an anomaly timestamp as a relative time (e.g. "3 hours ago"), falling
 * back to the raw value if it cannot be parsed.
 */
function relativeTime(timestamp: string): string {
  const ms = Date.parse(timestamp)
  if (Number.isNaN(ms)) {
    return timestamp
  }
  return formatDistanceToNow(new Date(ms), { addSuffix: true })
}

export default ServerAnomaliesCard
