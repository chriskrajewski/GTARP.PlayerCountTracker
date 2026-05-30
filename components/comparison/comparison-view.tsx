'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { BarChart3, Pin } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { motion } from '@/components/ui/motion';
import {
  getServers,
  getPlayerCounts,
  getServerColors,
  type PlayerCountData,
  type ServerData,
  type TimeRange,
} from '@/lib/data';
import {
  assignSeriesColors,
  buildComparisonChartModel,
  computeServerSummary,
  validatePinnedSelection,
  DEFAULT_COMPARISON_TIME_RANGE,
  MIN_PINNED_SERVERS,
  type ComparisonPreferences,
} from '@/lib/comparison-prefs';
import { createBrowserClient } from '@/lib/supabase-browser';
import { getCurrentUser } from '@/lib/user-auth-supabase';
import { ServerPinSelector } from './server-pin-selector';
import { ComparisonChart } from './comparison-chart';
import { ComparisonStatCard, type RestartInfo } from './comparison-stat-card';

/** Time-range options offered for the comparison (subset of {@link TimeRange}). */
const TIME_RANGE_OPTIONS: { value: TimeRange; label: string }[] = [
  { value: '6h', label: 'Last 6 hours' },
  { value: '24h', label: 'Last 24 hours' },
  { value: '7d', label: 'Last 7 days' },
  { value: '30d', label: 'Last 30 days' },
];

const PINNED_QUERY_PARAM = 'pinned';
const RANGE_QUERY_PARAM = 'range';
const LOCAL_STORAGE_KEY = 'comparison-preferences';

/** Shape of a single prediction returned by `/api/restart-prediction`. */
interface RestartPredictionResponse {
  serverId: string;
  nextRestartTime: string | null;
  confidence: number;
}

/**
 * Orchestrates the Server Comparison View (R2.1–R2.8).
 *
 * Responsibilities:
 * - Owns the pinned-server set and selected time range.
 * - Fetches player counts (`getPlayerCounts`), server colors (`getServerColors`),
 *   and restart predictions (the existing `/api/restart-prediction` endpoint) —
 *   reusing existing reads, never opening parallel query paths (R9.3).
 * - Builds the `serverId -> color` map ONCE per pinned set so the overlaid chart
 *   and every stat card agree on color (R2.8).
 * - Renders the < 2 prompt (R2.3), the overlaid chart (R2.1), and one stat card
 *   per pinned server (R2.4, R2.5).
 * - Recomputes chart + stats when the time range changes while preserving the
 *   pinned set (R2.6); removing a server retains the rest (R2.7).
 * - Persists the pinned set + range per signed-in user via the comparison-
 *   preferences API; anonymous users fall back to URL + localStorage.
 */
export function ComparisonView() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [servers, setServers] = useState<ServerData[]>([]);
  const [pinned, setPinned] = useState<string[]>([]);
  const [timeRange, setTimeRange] = useState<TimeRange>(DEFAULT_COMPARISON_TIME_RANGE);
  const [playerData, setPlayerData] = useState<PlayerCountData[]>([]);
  const [colorMap, setColorMap] = useState<Record<string, string>>({});
  const [restartInfo, setRestartInfo] = useState<Record<string, RestartInfo>>({});
  const [loadingData, setLoadingData] = useState(false);
  const [isAuthed, setIsAuthed] = useState(false);
  const initializedRef = useRef(false);

  // ── Initial bootstrap: server list, color map, persisted preferences ──────
  useEffect(() => {
    let active = true;

    const init = async () => {
      // Server list (R2 selectable set) and DB color mapping (R2.8 base).
      const [serverList, serverColors] = await Promise.all([getServers(), getServerColors()]);
      if (!active) return;

      setServers(serverList);
      const baseColors: Record<string, string> = {};
      serverColors.forEach((c) => {
        baseColors[c.server_id] = c.color_hsl;
      });
      setColorMap(baseColors);

      // Resolve the starting pinned set + range from (in priority order):
      // signed-in saved prefs → URL query → localStorage → empty.
      const initial = await resolveInitialPreferences(serverList);
      if (!active) return;

      setIsAuthed(initial.authed);
      setPinned(initial.pinnedServerIds);
      setTimeRange(initial.timeRange);
      initializedRef.current = true;
    };

    init();
    return () => {
      active = false;
    };
  }, []);

  // ── Fetch player counts whenever the pinned set or range changes (R2.6) ───
  useEffect(() => {
    if (pinned.length < MIN_PINNED_SERVERS) {
      setPlayerData([]);
      return;
    }

    let active = true;
    setLoadingData(true);

    getPlayerCounts(pinned, timeRange)
      .then((data) => {
        if (active) setPlayerData(data);
      })
      .catch((error) => {
        console.error('Error fetching comparison player counts:', error);
        if (active) setPlayerData([]);
      })
      .finally(() => {
        if (active) setLoadingData(false);
      });

    return () => {
      active = false;
    };
  }, [pinned, timeRange]);

  // ── Fetch restart predictions for the pinned set (R2.5) ───────────────────
  useEffect(() => {
    if (pinned.length < MIN_PINNED_SERVERS) {
      setRestartInfo({});
      return;
    }

    let active = true;
    const params = new URLSearchParams({ serverIds: pinned.join(',') });

    fetch(`/api/restart-prediction?${params.toString()}`)
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error(`HTTP ${res.status}`))))
      .then((json: { predictions?: RestartPredictionResponse[] }) => {
        if (!active) return;
        const map: Record<string, RestartInfo> = {};
        (json.predictions ?? []).forEach((p) => {
          map[p.serverId] = {
            nextRestartTime: p.nextRestartTime,
            confidence: p.confidence,
          };
        });
        setRestartInfo(map);
      })
      .catch((error) => {
        console.error('Error fetching restart predictions:', error);
        if (active) setRestartInfo({});
      });

    return () => {
      active = false;
    };
  }, [pinned]);

  // ── Persist pinned set + range when they change after initialization ──────
  useEffect(() => {
    if (!initializedRef.current) return;
    persistPreferences(isAuthed, { pinnedServerIds: pinned, timeRange });
    syncUrl(router, searchParams, pinned, timeRange);
  }, [pinned, timeRange, isAuthed]);

  // Build the shared color map ONCE per pinned set so the chart and every stat
  // card use identical, distinct colors (R2.8).
  const seriesColors = useMemo(
    () => assignSeriesColors(pinned, colorMap),
    [pinned, colorMap],
  );

  // Build the overlaid chart model — one series per pinned server (R2.1).
  const chartModel = useMemo(
    () => buildComparisonChartModel(pinned, playerData, colorMap),
    [pinned, playerData, colorMap],
  );

  const serverNameMap = useMemo(() => {
    const map: Record<string, string> = {};
    servers.forEach((s) => {
      map[s.server_id] = s.server_name;
    });
    return map;
  }, [servers]);

  const handlePinnedChange = useCallback((next: string[]) => {
    // Only block additions that exceed the max; allow drops below 2 (the view
    // simply shows the < 2 prompt). Removal/retention is handled by the helper.
    const validation = validatePinnedSelection(next);
    if (!validation.valid && validation.reason === 'too_many') {
      return;
    }
    setPinned(next);
  }, []);

  const showPrompt = pinned.length < MIN_PINNED_SERVERS;

  return (
    <div className="space-y-6">
      {/* Controls: pin selector + time range */}
      <Card variant="glass">
        <CardHeader>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Pin className="h-5 w-5 text-cyan-400" />
              Pinned servers
            </CardTitle>
            <div className="w-full sm:w-56">
              <Select value={timeRange} onValueChange={(v) => setTimeRange(v as TimeRange)}>
                <SelectTrigger aria-label="Select time range">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TIME_RANGE_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <ServerPinSelector
            servers={servers}
            pinned={pinned}
            onChange={handlePinnedChange}
            colorMap={seriesColors}
          />
        </CardContent>
      </Card>

      {showPrompt ? (
        // < 2 pinned prompt (R2.3)
        <Card variant="elevated">
          <CardContent className="flex flex-col items-center justify-center gap-3 py-16 text-center">
            <div
              className="flex h-12 w-12 items-center justify-center rounded-xl"
              style={{
                background:
                  'linear-gradient(135deg, rgba(0, 217, 255, 0.2) 0%, rgba(20, 184, 166, 0.1) 100%)',
                border: '1px solid rgba(0, 217, 255, 0.3)',
              }}
            >
              <BarChart3 className="h-6 w-6 text-cyan-400" />
            </div>
            <h3 className="text-lg font-semibold text-white">Pin at least 2 servers</h3>
            <p className="max-w-md text-sm text-[#ADADB8]">
              Add {MIN_PINNED_SERVERS} to 4 servers above to overlay their player counts and
              compare current activity, peaks, and predicted restarts side by side.
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Overlaid chart (R2.1) */}
          <Card variant="elevated">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <BarChart3 className="h-5 w-5 text-cyan-400" />
                Player count comparison
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loadingData && playerData.length === 0 ? (
                <div className="flex h-[400px] w-full items-center justify-center text-[#ADADB8]">
                  Loading comparison data…
                </div>
              ) : (
                <ComparisonChart
                  model={chartModel}
                  serverNames={serverNameMap}
                  timeRange={timeRange}
                />
              )}
            </CardContent>
          </Card>

          {/* Per-server stat cards (R2.4, R2.5) */}
          <motion.div
            className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
          >
            {pinned.map((serverId) => (
              <ComparisonStatCard
                key={serverId}
                serverId={serverId}
                serverName={serverNameMap[serverId] || `Server ${serverId}`}
                color={seriesColors[serverId]}
                summary={computeServerSummary(playerData, serverId)}
                restart={restartInfo[serverId]}
                onRemove={() => handlePinnedChange(pinned.filter((id) => id !== serverId))}
              />
            ))}
          </motion.div>
        </>
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Preference persistence helpers (signed-in API + anonymous URL/localStorage) */
/* -------------------------------------------------------------------------- */

interface InitialPreferences {
  authed: boolean;
  pinnedServerIds: string[];
  timeRange: TimeRange;
}

/**
 * Resolve the starting pinned set + range. Priority: signed-in saved prefs →
 * URL query params → localStorage → empty/default. Pinned ids are filtered to
 * known servers so a stale id never produces an empty series.
 */
async function resolveInitialPreferences(
  servers: ServerData[],
): Promise<InitialPreferences> {
  const validIds = new Set(servers.map((s) => s.server_id));
  const filterValid = (ids: string[]) => ids.filter((id) => validIds.has(id));

  // 1. Signed-in user preferences (owner-scoped, via the API).
  try {
    const user = await getCurrentUser();
    if (user) {
      const token = await getAccessToken();
      if (token) {
        const res = await fetch('/api/comparison-preferences', {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const json: { success: boolean; data: ComparisonPreferences | null } = await res.json();
          if (json.success && json.data) {
            return {
              authed: true,
              pinnedServerIds: filterValid(json.data.pinnedServerIds).slice(0, 4),
              timeRange: json.data.timeRange,
            };
          }
        }
        return { authed: true, pinnedServerIds: [], timeRange: DEFAULT_COMPARISON_TIME_RANGE };
      }
    }
  } catch (error) {
    console.error('Error resolving signed-in comparison preferences:', error);
  }

  // 2. URL query params (shareable for anonymous users).
  if (typeof window !== 'undefined') {
    const params = new URLSearchParams(window.location.search);
    const pinnedParam = params.get(PINNED_QUERY_PARAM);
    const rangeParam = params.get(RANGE_QUERY_PARAM);
    if (pinnedParam) {
      return {
        authed: false,
        pinnedServerIds: filterValid(pinnedParam.split(',').filter(Boolean)).slice(0, 4),
        timeRange: normalizeRange(rangeParam),
      };
    }

    // 3. localStorage fallback.
    try {
      const stored = window.localStorage.getItem(LOCAL_STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as Partial<ComparisonPreferences>;
        if (Array.isArray(parsed.pinnedServerIds)) {
          return {
            authed: false,
            pinnedServerIds: filterValid(parsed.pinnedServerIds).slice(0, 4),
            timeRange: normalizeRange(parsed.timeRange),
          };
        }
      }
    } catch (error) {
      console.error('Error reading stored comparison preferences:', error);
    }
  }

  return { authed: false, pinnedServerIds: [], timeRange: DEFAULT_COMPARISON_TIME_RANGE };
}

/** Coerce an unknown range string into a supported {@link TimeRange}. */
function normalizeRange(value: string | null | undefined): TimeRange {
  const match = TIME_RANGE_OPTIONS.find((opt) => opt.value === value);
  return match ? match.value : DEFAULT_COMPARISON_TIME_RANGE;
}

/** Read the current Supabase access token, or null when unauthenticated. */
async function getAccessToken(): Promise<string | null> {
  try {
    const supabase = createBrowserClient();
    const {
      data: { session },
    } = await supabase.auth.getSession();
    return session?.access_token ?? null;
  } catch {
    return null;
  }
}

/**
 * Persist the pinned set + range. Signed-in users save through the owner-scoped
 * API (best-effort); everyone also gets a localStorage copy so a reload restores
 * the selection without a round-trip. The API enforces the 2..4 bound, so we
 * only call it when the selection is in range.
 */
function persistPreferences(authed: boolean, prefs: ComparisonPreferences): void {
  if (typeof window !== 'undefined') {
    try {
      window.localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(prefs));
    } catch (error) {
      console.error('Error writing comparison preferences to localStorage:', error);
    }
  }

  if (authed && prefs.pinnedServerIds.length >= MIN_PINNED_SERVERS) {
    getAccessToken()
      .then((token) => {
        if (!token) return;
        return fetch('/api/comparison-preferences', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(prefs),
        });
      })
      .catch((error) => {
        console.error('Error saving comparison preferences:', error);
      });
  }
}

/** Reflect the pinned set + range into the URL so the view is shareable. */
function syncUrl(
  router: ReturnType<typeof useRouter>,
  searchParams: ReturnType<typeof useSearchParams>,
  pinned: string[],
  timeRange: TimeRange,
): void {
  const params = new URLSearchParams(searchParams.toString());
  if (pinned.length > 0) {
    params.set(PINNED_QUERY_PARAM, pinned.join(','));
  } else {
    params.delete(PINNED_QUERY_PARAM);
  }
  params.set(RANGE_QUERY_PARAM, timeRange);
  router.replace(`?${params.toString()}`, { scroll: false });
}

export default ComparisonView;
