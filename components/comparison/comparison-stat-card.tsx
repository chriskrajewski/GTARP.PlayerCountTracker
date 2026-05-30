'use client';

import { useEffect, useState } from 'react';
import { Activity, TrendingUp, Clock, RotateCw, X } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import type { ServerSummary } from '@/lib/comparison-prefs';

/** Next-restart info for a single server, sourced from the prediction endpoint (R2.5). */
export interface RestartInfo {
  /** ISO timestamp of the next predicted restart, or null when none is available. */
  nextRestartTime: string | null;
  /** 0-100 confidence value, when available. */
  confidence?: number;
}

interface ComparisonStatCardProps {
  serverId: string;
  serverName: string;
  /** Accent color — MUST equal this server's chart series color (R2.8). */
  color: string;
  /** Current/peak/peak-time over the selected range (R2.4). */
  summary: ServerSummary;
  /** Next predicted restart (R2.5); undefined while predictions are loading. */
  restart?: RestartInfo;
  /** Remove this server from the comparison (R2.7). */
  onRemove: () => void;
}

/**
 * Render an ISO timestamp as a compact local date/time, or a dash when null.
 */
function formatTimestamp(iso: string | null): string {
  if (!iso) return '—';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });
}

/**
 * Map a 0-100 confidence value to a human label/color, mirroring the existing
 * restart-prediction UI thresholds.
 */
function confidenceLabel(confidence?: number): { text: string; color: string } | null {
  if (typeof confidence !== 'number' || confidence <= 0) return null;
  if (confidence >= 75) return { text: `High (${confidence}%)`, color: '#22c55e' };
  if (confidence >= 50) return { text: `Medium (${confidence}%)`, color: '#eab308' };
  return { text: `Low (${confidence}%)`, color: '#f97316' };
}

/**
 * Live countdown to the next predicted restart. Returns a short label or null
 * when there is no upcoming restart.
 */
function useRestartCountdown(nextRestartTime: string | null | undefined): string | null {
  const [label, setLabel] = useState<string | null>(null);

  useEffect(() => {
    if (!nextRestartTime) {
      setLabel(null);
      return;
    }

    const update = () => {
      const target = new Date(nextRestartTime).getTime();
      if (Number.isNaN(target)) {
        setLabel(null);
        return;
      }
      const diff = target - Date.now();
      if (diff <= 0) {
        setLabel('due now');
        return;
      }
      const totalMinutes = Math.floor(diff / 60000);
      const hours = Math.floor(totalMinutes / 60);
      const minutes = totalMinutes % 60;
      setLabel(hours > 0 ? `in ${hours}h ${minutes}m` : `in ${minutes}m`);
    };

    update();
    const id = setInterval(update, 30000);
    return () => clearInterval(id);
  }, [nextRestartTime]);

  return label;
}

/**
 * Per-server summary card for the Comparison View.
 *
 * Shows current player count, peak, and peak time over the selected range
 * (R2.4) plus the next predicted restart time and confidence (R2.5). The card's
 * accent (left border + swatch) uses the SAME color the chart series uses for
 * this server — both come from the shared `assignSeriesColors` map — so the
 * stat card and chart line stay visually consistent (R2.8).
 */
export function ComparisonStatCard({
  serverId,
  serverName,
  color,
  summary,
  restart,
  onRemove,
}: ComparisonStatCardProps) {
  const countdown = useRestartCountdown(restart?.nextRestartTime);
  const confidence = confidenceLabel(restart?.confidence);

  return (
    <Card variant="elevated" className="overflow-hidden" data-server-id={serverId}>
      {/* Left accent strip — same color as this server's chart series (R2.8).
          Rendered as an absolutely-positioned child rather than a `style` prop
          on Card, whose own variant `style` would otherwise be overwritten. */}
      <div
        className="absolute inset-y-0 left-0 z-10 w-1"
        style={{ backgroundColor: color }}
        aria-hidden="true"
      />
      <CardContent className="space-y-4">
        {/* Header: swatch + name + remove */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <span
              className="inline-block h-3 w-3 shrink-0 rounded-full"
              style={{ backgroundColor: color }}
            />
            <h3 className="truncate font-semibold text-white" title={serverName}>
              {serverName}
            </h3>
          </div>
          <button
            type="button"
            onClick={onRemove}
            className="rounded-full p-1 text-[#ADADB8] transition-colors hover:text-white"
            aria-label={`Remove ${serverName} from comparison`}
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Current + Peak (R2.4) */}
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-lg bg-[#26262c]/40 p-3">
            <p className="mb-1 flex items-center gap-1 text-xs text-[#ADADB8]">
              <Activity className="h-3.5 w-3.5 text-cyan-400/70" />
              Current
            </p>
            <p className="text-xl font-bold text-white">{summary.current.toLocaleString()}</p>
          </div>
          <div className="rounded-lg bg-[#26262c]/40 p-3">
            <p className="mb-1 flex items-center gap-1 text-xs text-[#ADADB8]">
              <TrendingUp className="h-3.5 w-3.5 text-cyan-400/70" />
              Peak
            </p>
            <p className="text-xl font-bold text-white">{summary.peak.toLocaleString()}</p>
          </div>
        </div>

        {/* Peak time (R2.4) */}
        <div className="flex items-center gap-2 text-sm">
          <Clock className="h-3.5 w-3.5 text-purple-400/70" />
          <span className="text-[#ADADB8]">Peak at</span>
          <span className="font-medium text-white">{formatTimestamp(summary.peakTime)}</span>
        </div>

        {/* Next predicted restart (R2.5) */}
        <div className="rounded-lg border border-[#26262c] bg-[#18181b]/60 p-3">
          <p className="mb-1 flex items-center gap-1 text-xs text-[#ADADB8]">
            <RotateCw className="h-3.5 w-3.5 text-cyan-400/70" />
            Next predicted restart
          </p>
          {restart === undefined ? (
            <p className="text-sm text-[#ADADB8]">Loading…</p>
          ) : restart.nextRestartTime ? (
            <div className="space-y-0.5">
              <p className="text-sm font-medium text-white">
                {formatTimestamp(restart.nextRestartTime)}
                {countdown && <span className="ml-2 text-cyan-400">({countdown})</span>}
              </p>
              {confidence && (
                <p className="text-xs" style={{ color: confidence.color }}>
                  Confidence: {confidence.text}
                </p>
              )}
            </div>
          ) : (
            <p className="text-sm text-[#ADADB8]">Not yet available</p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export default ComparisonStatCard;
