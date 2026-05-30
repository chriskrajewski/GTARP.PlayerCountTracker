"use client"

import { useEffect, useState } from "react"
import { motion } from "motion/react"
import { Clock, Gauge, Users, AlertTriangle } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  formatRecommendationLocal,
  type JoinRecommendation,
  type JoinRecommendationResult,
  type LocalizedRecommendation,
} from "@/lib/capacity-advisor"
import { useFailClosedFeatureFlag, FEATURE_FLAGS } from "@/lib/feature-flags"

interface CapacityAdvisorCardProps {
  serverId: string
  serverName?: string
}

/** Local fetch lifecycle for the recommendation. */
type AdvisorState =
  | { status: "loading" }
  | { status: "error" }
  | { status: "ready"; recommendation: JoinRecommendationResult }

/**
 * Resolve the viewer's IANA time zone from the browser. Falls back to UTC if the
 * runtime cannot resolve a zone (extremely rare). The recommendation window is
 * localized to this zone for display (R8.4).
 */
function resolveViewerTimeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC"
  } catch {
    return "UTC"
  }
}

/**
 * Capacity Advisor surface (R8.1, R8.4, R8.5, R8.6).
 *
 * Fetches the server's "best time to join" recommendation from
 * `/api/capacity-advisor` (which runs the server-side `getJoinRecommendation`),
 * then localizes the recommended UTC window to the viewer's time zone with the
 * pure `formatRecommendationLocal` helper (R8.4). It renders:
 *  - the localized recommended join window (R8.1),
 *  - an explicit "not yet available" message when the data is too sparse (R8.5),
 *  - a "currently full / near-full" indicator alongside the window (R8.6).
 *
 * The surface is gated fail-closed behind `capacity_advisor` (R1.2/R1.4): it
 * renders nothing unless the flag is explicitly enabled.
 */
export function CapacityAdvisorCard({ serverId, serverName }: CapacityAdvisorCardProps) {
  const enabled = useFailClosedFeatureFlag(FEATURE_FLAGS.CAPACITY_ADVISOR)
  const [state, setState] = useState<AdvisorState>({ status: "loading" })

  useEffect(() => {
    // Don't fetch while the feature is gated off or without a server.
    if (!enabled || !serverId) {
      return
    }

    let cancelled = false
    setState({ status: "loading" })

    const controller = new AbortController()

    fetch(`/api/capacity-advisor?serverId=${encodeURIComponent(serverId)}`, {
      signal: controller.signal,
    })
      .then(async (res) => {
        if (!res.ok) throw new Error(`Request failed: ${res.status}`)
        const data = await res.json()
        if (!data?.success || !data.recommendation) {
          throw new Error("Malformed capacity advisor response")
        }
        if (!cancelled) {
          setState({ status: "ready", recommendation: data.recommendation as JoinRecommendationResult })
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

  // Fail-closed gate (R1.2/R1.4): render nothing when disabled.
  if (!enabled) {
    return null
  }

  return (
    <Card variant="glass" className="overflow-hidden">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-bold text-white flex items-center gap-2">
          <Clock className="h-4 w-4 text-cyan-400" />
          <span>Best time to join</span>
          {serverName && (
            <span className="text-xs font-normal text-gray-500 truncate">· {serverName}</span>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-2">
        <AdvisorBody state={state} />
      </CardContent>
    </Card>
  )
}

/** Renders the body based on the fetch lifecycle and recommendation availability. */
function AdvisorBody({ state }: { state: AdvisorState }) {
  if (state.status === "loading") {
    return (
      <motion.div
        className="flex items-center gap-2 text-sm text-gray-400"
        animate={{ opacity: [0.5, 1, 0.5] }}
        transition={{ duration: 1.5, repeat: Infinity }}
      >
        <Gauge className="h-4 w-4 text-cyan-400/70" />
        <span>Analyzing capacity trends…</span>
      </motion.div>
    )
  }

  if (state.status === "error") {
    // Subtle, non-fabricated unavailable message on fetch failure.
    return (
      <div className="text-sm text-gray-500">
        Recommendation unavailable right now.
      </div>
    )
  }

  const { recommendation } = state

  // R8.5 — explicit "not yet available" state; never fabricate a window.
  if (!recommendation.available) {
    return (
      <div className="text-sm text-gray-400">
        Recommendation not yet available — not enough capacity history for this server yet.
      </div>
    )
  }

  return <AvailableRecommendation recommendation={recommendation} />
}

/** Renders an available recommendation localized to the viewer's time zone. */
function AvailableRecommendation({ recommendation }: { recommendation: JoinRecommendation }) {
  const [localized, setLocalized] = useState<LocalizedRecommendation | null>(null)

  useEffect(() => {
    // Localize on the client so the viewer's own Intl time zone is used (R8.4).
    const tz = resolveViewerTimeZone()
    setLocalized(formatRecommendationLocal(recommendation, tz))
  }, [recommendation])

  if (!localized) {
    // Brief pre-localization tick (avoids SSR/client time-zone mismatch).
    return (
      <div className="flex items-center gap-2 text-sm text-gray-400">
        <Gauge className="h-4 w-4 text-cyan-400/70" />
        <span>Preparing recommendation…</span>
      </div>
    )
  }

  const occupancyPercent = Math.min(Math.max(Math.round(localized.occupancyRatio * 100), 0), 100)

  return (
    <div className="flex flex-col gap-3">
      {/* R8.6 — currently full / near-full indicator alongside the window. */}
      {localized.currentlyFull && (
        <motion.div
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          className="inline-flex w-fit items-center gap-1.5 rounded-md border px-2 py-1 text-xs font-semibold text-red-400"
          style={{
            background: "linear-gradient(135deg, rgba(24, 24, 27, 0.9) 0%, rgba(18, 18, 21, 0.9) 100%)",
            borderColor: "rgba(239, 68, 68, 0.35)",
          }}
        >
          <motion.span
            animate={{ opacity: [0.7, 1, 0.7] }}
            transition={{ duration: 2, repeat: Infinity }}
            className="flex items-center"
          >
            <AlertTriangle className="h-3.5 w-3.5" />
          </motion.span>
          Currently full / near-full
        </motion.div>
      )}

      {/* R8.1 / R8.4 — localized recommended join window. */}
      <div className="flex items-start gap-2">
        <Clock className="mt-0.5 h-4 w-4 flex-shrink-0 text-cyan-400" />
        <div className="flex flex-col">
          <span className="text-base font-bold text-white">{localized.label}</span>
          <span className="text-[11px] text-gray-500">
            {localized.windowHours}h window · times in {localized.timeZone}
          </span>
        </div>
      </div>

      {/* Supporting context: typical occupancy during the recommended window. */}
      <div className="flex items-center gap-2 text-xs text-gray-400">
        <Users className="h-3.5 w-3.5 text-cyan-400/70" />
        <span>
          Typically <span className="font-semibold text-cyan-300">{occupancyPercent}%</span> full
          during this window
        </span>
      </div>
    </div>
  )
}

export default CapacityAdvisorCard
