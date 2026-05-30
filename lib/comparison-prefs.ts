/**
 * Pure helpers for the Server Comparison View (R2).
 *
 * This module contains ONLY pure functions — no async, no database access, no
 * `window`/DOM access. Every helper takes already-fetched data as arguments so
 * it can be unit- and property-tested directly without HTTP or a live
 * database, in line with the spec's migration-safe testing strategy.
 *
 * The pure helpers above are complemented by the per-user persistence functions
 * at the bottom of this module (task 3.3): {@link getComparisonPreferences} /
 * {@link saveComparisonPreferences} (owner-id based) and their
 * {@link getComparisonPreferencesForUser} / {@link saveComparisonPreferencesForUser}
 * convenience wrappers. All DB access routes through the shared owner-scoped
 * accessor in `lib/owner-scoped.ts` so per-user rows stay owner-scoped (R9.4)
 * across the in-flight Supabase -> Prisma/RDS migration.
 *
 * Requirement mapping:
 * - R2.1  one chart series per pinned server  -> {@link buildComparisonChartModel}
 * - R2.2  4-server maximum                     -> {@link validatePinnedSelection}
 * - R2.3  pin at least 2 prompt                -> {@link validatePinnedSelection}
 * - R2.4  current / peak / peak time           -> {@link computeServerSummary}
 * - R2.6  last selected time range persisted   -> {@link saveComparisonPreferences}
 * - R2.7  removing a pinned server             -> {@link removePinnedServer}
 * - R2.8  distinct, consistent series colors   -> {@link assignSeriesColors}
 * - R9.3  reuse existing reads (no new paths)  -> see persistence note below
 * - R9.4  per-user rows owner-scoped           -> {@link getComparisonPreferences} et al.
 */
import type { SupabaseClient, User } from '@supabase/supabase-js';
import {
  createSupabaseOwnerScopedAccessor,
  createOwnerScopedAccessorForUser,
  type OwnerScopedAccessor,
  type OwnerScopedRow,
} from '@/lib/owner-scoped';
import type { PlayerCountData, TimeRange } from '@/lib/data';
import type { Database } from '@/lib/supabase.types';
import { supabase } from '@/lib/supabase';
import { createServerClient } from '@/lib/supabase-server';

/* -------------------------------------------------------------------------- */
/* Shared types & constants                                                   */
/* -------------------------------------------------------------------------- */

/** Inclusive lower bound on the number of pinned servers (R2.3). */
export const MIN_PINNED_SERVERS = 2;
/** Inclusive upper bound on the number of pinned servers (R2.2). */
export const MAX_PINNED_SERVERS = 4;

/** Default time range used when a stored preference has none (consumed by task 3.3). */
export const DEFAULT_COMPARISON_TIME_RANGE: TimeRange = '24h';

/** An ordered set of pinned server ids (deduped before use). */
export type PinnedSet = string[];

/**
 * The client-facing comparison preferences shape. Task 3.3 maps this to/from
 * the persisted {@link ComparisonPreferencesRow}.
 */
export interface ComparisonPreferences {
  /** 2-4 distinct pinned server ids, in display order. */
  pinnedServerIds: string[];
  /** The last selected time range. */
  timeRange: TimeRange;
}

/**
 * The persisted `comparison_preferences` row shape (R2, R9.2/R9.4). Defined
 * here so the persistence layer (task 3.3) and the ownership helper share a
 * single source of truth. Extends {@link OwnerScopedRow} so it plugs directly
 * into the owner-scoped data-access utility.
 */
export interface ComparisonPreferencesRow extends OwnerScopedRow {
  /** 2-4 server ids; validated in `lib` (R2.2/R2.3). */
  pinned_server_ids: string[];
  /** Last selected time range; nullable in the schema. */
  time_range: string | null;
  created_at: string;
  updated_at: string;
}

/* -------------------------------------------------------------------------- */
/* Pinned-selection validation (R2.2, R2.3)                                   */
/* -------------------------------------------------------------------------- */

/** Why a pinned selection was rejected. */
export type PinnedSelectionReason = 'too_few' | 'too_many';

/**
 * Structured result of {@link validatePinnedSelection}. `distinct` always
 * carries the deduped selection (order preserved) so the UI can echo what was
 * actually considered; `reason`/`message` are present only when invalid.
 */
export interface PinnedSelectionResult {
  /** `true` only when the distinct count is within [MIN, MAX] inclusive. */
  valid: boolean;
  /** Set only when `valid` is `false`. */
  reason?: PinnedSelectionReason;
  /** The deduplicated selection, in first-seen order. */
  distinct: string[];
  /** Human-readable UI message; set only when `valid` is `false`. */
  message?: string;
}

/**
 * Validate a candidate pinned-server selection (R2.2, R2.3).
 *
 * Duplicates are removed first, then the DISTINCT count is bound-checked:
 * - fewer than {@link MIN_PINNED_SERVERS} distinct -> `too_few` ("pin at least 2")
 * - more than {@link MAX_PINNED_SERVERS} distinct  -> `too_many` ("4-server maximum")
 * - otherwise the selection is valid.
 *
 * Returning a structured result lets the caller surface the exact prompt the
 * requirements describe while reusing the deduped list.
 */
export function validatePinnedSelection(serverIds: readonly string[]): PinnedSelectionResult {
  const distinct = dedupe(serverIds);

  if (distinct.length < MIN_PINNED_SERVERS) {
    return {
      valid: false,
      reason: 'too_few',
      distinct,
      message: `Pin at least ${MIN_PINNED_SERVERS} servers to compare.`,
    };
  }

  if (distinct.length > MAX_PINNED_SERVERS) {
    return {
      valid: false,
      reason: 'too_many',
      distinct,
      message: `You can pin a maximum of ${MAX_PINNED_SERVERS} servers (${MAX_PINNED_SERVERS}-server maximum).`,
    };
  }

  return { valid: true, distinct };
}

/**
 * Remove a server from a pinned set, retaining the rest in their original order
 * (R2.7). All occurrences of `serverId` are removed (defensive against an
 * un-deduped input); every other server is preserved.
 */
export function removePinnedServer(pinned: readonly string[], serverId: string): string[] {
  return pinned.filter((id) => id !== serverId);
}

/* -------------------------------------------------------------------------- */
/* Per-server summary statistics (R2.4)                                       */
/* -------------------------------------------------------------------------- */

/**
 * Per-server summary over the (already range-scoped) player-count series.
 * `peakTime` is `null` only when the server has no data points.
 */
export interface ServerSummary {
  /** Latest player count for the server (by timestamp). */
  current: number;
  /** Maximum player count over the range. */
  peak: number;
  /** Timestamp at which `peak` was first reached, or `null` when no data. */
  peakTime: string | null;
}

/**
 * Compute `{ current, peak, peakTime }` for a single server (R2.4).
 *
 * The input is not assumed to be sorted, so:
 * - `current` is the value of the point with the MAXIMUM timestamp. If several
 *   points share that maximum timestamp, the one appearing LAST in the input is
 *   used (mirrors taking the last element of a stable ascending sort).
 * - `peak` is the maximum `player_count`.
 * - `peakTime` is the timestamp of that maximum, broken deterministically in
 *   favour of the EARLIEST timestamp achieving the max (and, on identical
 *   timestamps, the first occurrence in the input).
 *
 * Empty data returns `{ current: 0, peak: 0, peakTime: null }`, matching the
 * "no data" convention used by the existing `getServerStats`.
 */
export function computeServerSummary(
  series: readonly PlayerCountData[],
  serverId: string,
): ServerSummary {
  const serverData = series.filter((point) => point.server_id === serverId);

  if (serverData.length === 0) {
    return { current: 0, peak: 0, peakTime: null };
  }

  // current: point with the max timestamp; ties resolved to the later index.
  let latestIndex = 0;
  // peak: max player_count; ties resolved to the earliest timestamp, then first index.
  let peakIndex = 0;

  for (let i = 1; i < serverData.length; i++) {
    const point = serverData[i];

    if (compareTimestamps(point.timestamp, serverData[latestIndex].timestamp) >= 0) {
      latestIndex = i;
    }

    const peakPoint = serverData[peakIndex];
    if (point.player_count > peakPoint.player_count) {
      peakIndex = i;
    } else if (
      point.player_count === peakPoint.player_count &&
      compareTimestamps(point.timestamp, peakPoint.timestamp) < 0
    ) {
      peakIndex = i;
    }
  }

  return {
    current: serverData[latestIndex].player_count,
    peak: serverData[peakIndex].player_count,
    peakTime: serverData[peakIndex].timestamp,
  };
}

/* -------------------------------------------------------------------------- */
/* Series color assignment (R2.8)                                             */
/* -------------------------------------------------------------------------- */

/**
 * Built-in distinct palette, reused from the existing multi-series chart
 * (`components/player-count-chart-lw.tsx`) so comparison colors match the
 * platform's established look. Servers without an explicit color fall back to
 * these in order.
 */
const FALLBACK_PALETTE: readonly string[] = [
  'hsl(0, 80%, 50%)',
  'hsl(210, 80%, 50%)',
  'hsl(48, 80%, 50%)',
  'hsl(180, 80%, 50%)',
  'hsl(30, 80%, 50%)',
  'hsl(240, 80%, 50%)',
  'hsl(15, 80%, 50%)',
  'hsl(195, 80%, 50%)',
  'hsl(135, 80%, 50%)',
  'hsl(345, 80%, 50%)',
];

/**
 * Deterministically derive a distinct color for the Nth generated assignment,
 * used only once the palette is exhausted. Hues are spread by the golden angle
 * and lightness cycles across full hue rotations, yielding a large pool of
 * distinct, valid `hsl(...)` strings purely as a function of `index`.
 */
function deterministicColor(index: number): string {
  const hue = Math.round((index * 137.508) % 360);
  const lightnessSteps = [50, 60, 40, 65, 35];
  const lightness = lightnessSteps[Math.floor(index / 360) % lightnessSteps.length];
  return `hsl(${hue}, 70%, ${lightness}%)`;
}

/**
 * Assign a visually distinct, stable color to each server (R2.8).
 *
 * Rules:
 * - A server's color is taken from `colorMap` (the existing server->color
 *   mapping derived from `getServerColors()`) when present and not already
 *   claimed by an earlier server.
 * - When a server has no `colorMap` entry, or that entry collides with one
 *   already assigned, a distinct color is drawn from {@link FALLBACK_PALETTE}
 *   and then, if the palette is exhausted, from {@link deterministicColor}.
 * - The result is a function of the inputs alone, so it is STABLE: the same
 *   server always maps to the same color given the same `serverIds`/`colorMap`.
 * - No two servers ever share a color (distinctness).
 *
 * Callers build `colorMap` from `getServerColors()` (e.g. mapping each
 * `ServerColor` to `{ [server_id]: color_hsl }`). Both the chart-model builder
 * and the stat cards consume THIS map so colors are consistent across the chart
 * series and the summary statistics (R2.8).
 *
 * @returns a `serverId -> color` map covering each distinct input server.
 */
export function assignSeriesColors(
  serverIds: readonly string[],
  colorMap: Record<string, string> = {},
): Record<string, string> {
  const distinct = dedupe(serverIds);
  const result: Record<string, string> = {};
  const used = new Set<string>();

  let paletteCursor = 0;
  let generatedCursor = 0;

  const nextFreeColor = (): string => {
    while (paletteCursor < FALLBACK_PALETTE.length) {
      const candidate = FALLBACK_PALETTE[paletteCursor++];
      if (!used.has(candidate)) {
        return candidate;
      }
    }
    // Palette exhausted: derive a fresh, unused deterministic color. The search
    // space is large (hundreds of hues x several lightness cycles), so this
    // terminates well within the bound for any realistic server count.
    for (let guard = 0; guard < 100000; guard++) {
      const candidate = deterministicColor(generatedCursor++);
      if (!used.has(candidate)) {
        return candidate;
      }
    }
    return deterministicColor(generatedCursor++);
  };

  for (const serverId of distinct) {
    const preferred = colorMap[serverId];
    const color =
      typeof preferred === 'string' && preferred.length > 0 && !used.has(preferred)
        ? preferred
        : nextFreeColor();

    used.add(color);
    result[serverId] = color;
  }

  return result;
}

/* -------------------------------------------------------------------------- */
/* Chart-model builder (R2.1)                                                 */
/* -------------------------------------------------------------------------- */

/** A single plotted point in a comparison series. */
export interface ChartPoint {
  timestamp: string;
  value: number;
}

/** One overlaid series in the comparison chart, scoped to a single server. */
export interface ChartSeries {
  serverId: string;
  /** Color shared with this server's summary stat card (R2.8). */
  color: string;
  /** This server's points, sorted ascending by timestamp. */
  points: ChartPoint[];
}

/** The full comparison chart model: one series per pinned server. */
export interface ComparisonChartModel {
  series: ChartSeries[];
}

/**
 * Build the overlaid comparison chart model (R2.1).
 *
 * Produces EXACTLY one series per (distinct) pinned server, in pinned order,
 * each containing only that server's points filtered from `series`. Servers not
 * in the pinned set never appear. Colors come from {@link assignSeriesColors}
 * over the same `colorMap` the stat cards use, so chart and stats agree (R2.8).
 */
export function buildComparisonChartModel(
  pinnedServerIds: readonly string[],
  series: readonly PlayerCountData[],
  colorMap: Record<string, string> = {},
): ComparisonChartModel {
  const distinct = dedupe(pinnedServerIds);
  const colors = assignSeriesColors(distinct, colorMap);

  const chartSeries: ChartSeries[] = distinct.map((serverId) => {
    const points: ChartPoint[] = series
      .filter((point) => point.server_id === serverId)
      .map((point) => ({ timestamp: point.timestamp, value: point.player_count }))
      .sort((a, b) => compareTimestamps(a.timestamp, b.timestamp));

    return { serverId, color: colors[serverId], points };
  });

  return { series: chartSeries };
}

/* -------------------------------------------------------------------------- */
/* Internal utilities                                                         */
/* -------------------------------------------------------------------------- */

/** Remove duplicates while preserving first-seen order. */
function dedupe(ids: readonly string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const id of ids) {
    if (!seen.has(id)) {
      seen.add(id);
      out.push(id);
    }
  }
  return out;
}

/**
 * Compare two timestamps chronologically. ISO-8601 strings (as stored in
 * `player_counts`) are compared by parsed epoch milliseconds; if either value
 * is not parseable, the comparison falls back to lexicographic ordering so the
 * result is always total and deterministic.
 *
 * @returns negative when `a < b`, positive when `a > b`, `0` when equal.
 */
function compareTimestamps(a: string, b: string): number {
  const ta = Date.parse(a);
  const tb = Date.parse(b);
  if (!Number.isNaN(ta) && !Number.isNaN(tb)) {
    return ta - tb;
  }
  if (a < b) return -1;
  if (a > b) return 1;
  return 0;
}

/* -------------------------------------------------------------------------- */
/* Per-user pinned-set persistence (R2.5, R2.6, R9.3, R9.4) — task 3.3        */
/* -------------------------------------------------------------------------- */

/**
 * The `comparison_preferences` table name (see
 * `api2db/sql/comparison_preferences_schema.sql`). All access goes through the
 * shared owner-scoped accessor — never a direct `.from('comparison_preferences')`
 * call — so the owner-only guarantee (R9.4) is enforced in the `lib/` layer and
 * survives the Supabase -> Prisma/RDS migration (R9.1).
 */
const COMPARISON_PREFERENCES_TABLE = 'comparison_preferences';

/** All valid {@link TimeRange} literals, used to validate persisted values. */
const VALID_TIME_RANGES: readonly TimeRange[] = [
  'live',
  '1h',
  '2h',
  '4h',
  '6h',
  '8h',
  '24h',
  '7d',
  '30d',
  '90d',
  '180d',
  '365d',
  'all',
];

/**
 * Discriminated result of {@link saveComparisonPreferences} /
 * {@link saveComparisonPreferencesForUser}. On success it carries the saved,
 * normalized {@link ComparisonPreferences}; on failure it carries a
 * UI-displayable `error` message (e.g. the 2..4 validation message).
 */
export type SaveComparisonPreferencesResult =
  | { ok: true; data: ComparisonPreferences }
  | { ok: false; error: string };

/** A persistable pinned-set + time-range payload (the writable subset). */
export interface ComparisonPreferencesInput {
  pinnedServerIds: string[];
  timeRange: TimeRange;
}

/**
 * Select the Supabase client following the convention used across `lib/data.ts`:
 * a caller-supplied client wins (e.g. an authed route handler client); otherwise
 * the browser singleton is used in the browser and a fresh server client on the
 * server. The result is typed as `SupabaseClient<Database>` for the accessor.
 */
function resolveClient(supabaseClient?: SupabaseClient<Database>): SupabaseClient<Database> {
  if (supabaseClient) return supabaseClient;
  return (
    typeof window !== 'undefined' ? supabase : createServerClient()
  ) as unknown as SupabaseClient<Database>;
}

/**
 * Coerce a stored `time_range` (nullable / possibly stale) into a valid
 * {@link TimeRange}, falling back to {@link DEFAULT_COMPARISON_TIME_RANGE} when
 * the value is null, empty, or not a recognized range. Supports R2.6 by
 * round-tripping whatever range the user last selected.
 */
function normalizeTimeRange(value: string | null | undefined): TimeRange {
  if (value && (VALID_TIME_RANGES as readonly string[]).includes(value)) {
    return value as TimeRange;
  }
  return DEFAULT_COMPARISON_TIME_RANGE;
}

/**
 * Map a persisted {@link ComparisonPreferencesRow} to the client-facing
 * {@link ComparisonPreferences} shape. Defensive against a null/non-array
 * `pinned_server_ids` so a malformed row degrades to an empty pinned set rather
 * than throwing.
 */
function mapRowToPreferences(row: ComparisonPreferencesRow): ComparisonPreferences {
  return {
    pinnedServerIds: Array.isArray(row.pinned_server_ids) ? [...row.pinned_server_ids] : [],
    timeRange: normalizeTimeRange(row.time_range),
  };
}

/**
 * Read the owner's single comparison-preferences row (R9.4) by a PRE-RESOLVED
 * `app_users.id`. Prefer this from server code that already knows the owner id;
 * route handlers holding a Supabase auth `User` should use
 * {@link getComparisonPreferencesForUser} instead.
 *
 * The `user_id` column is UNIQUE, so the owner has at most one row; we read via
 * the owner-scoped `accessor.list()` and take the first result. Returns `null`
 * when the user has saved no preferences (or on any read error, logged like
 * `lib/data.ts`). The stored `time_range` is normalized to a valid
 * {@link TimeRange} (R2.6).
 *
 * @param ownerId the resolved `app_users.id` to scope all access to.
 * @param supabaseClient optional client override (defaults per `resolveClient`).
 */
export async function getComparisonPreferences(
  ownerId: number,
  supabaseClient?: SupabaseClient<Database>,
): Promise<ComparisonPreferences | null> {
  const accessor = createSupabaseOwnerScopedAccessor<ComparisonPreferencesRow>(
    resolveClient(supabaseClient),
    COMPARISON_PREFERENCES_TABLE,
    ownerId,
  );

  const { data, error } = await accessor.list();
  if (error) {
    console.error('Error fetching comparison preferences:', error);
    return null;
  }

  const row = data[0];
  return row ? mapRowToPreferences(row) : null;
}

/**
 * Convenience wrapper around {@link getComparisonPreferences} for callers that
 * hold a Supabase auth `User` (e.g. API route handlers). Resolves the owning
 * `app_users.id` via `getOrCreateAppUser` (through
 * `createOwnerScopedAccessorForUser`) and then reads owner-scoped. Returns
 * `null` when the owner cannot be resolved or no preferences exist.
 */
export async function getComparisonPreferencesForUser(
  supabaseClient: SupabaseClient<Database>,
  user: User,
): Promise<ComparisonPreferences | null> {
  const { accessor, error } = await createOwnerScopedAccessorForUser<ComparisonPreferencesRow>(
    supabaseClient,
    user,
    COMPARISON_PREFERENCES_TABLE,
  );
  if (error || !accessor) {
    console.error('Error resolving owner for comparison preferences:', error);
    return null;
  }

  const { data, error: listError } = await accessor.list();
  if (listError) {
    console.error('Error fetching comparison preferences:', listError);
    return null;
  }

  const row = data[0];
  return row ? mapRowToPreferences(row) : null;
}

/**
 * Upsert the owner's single comparison-preferences row through the owner-scoped
 * `accessor`. Shared by the owner-id and user-based save variants so both have
 * identical persistence semantics. The caller must have already validated and
 * deduped `pinnedServerIds` (via {@link validatePinnedSelection}).
 *
 * Because `user_id` is UNIQUE we look up the existing row first: when present we
 * `update` it (bumping `updated_at`); otherwise we `insert` a new one. Every
 * operation goes through the accessor, which forces `user_id = ownerId` (R9.4).
 */
async function persistComparisonPreferences(
  accessor: OwnerScopedAccessor<ComparisonPreferencesRow>,
  pinnedServerIds: string[],
  timeRange: TimeRange,
): Promise<SaveComparisonPreferencesResult> {
  const nowIso = new Date().toISOString();

  const { data: existingRows, error: listError } = await accessor.list();
  if (listError) {
    console.error('Error reading comparison preferences before save:', listError);
    return { ok: false, error: 'Failed to read existing comparison preferences.' };
  }

  const existing = existingRows[0];

  if (existing) {
    const { data: updated, error: updateError } = await accessor.update(existing.id, {
      pinned_server_ids: pinnedServerIds,
      time_range: timeRange,
      updated_at: nowIso,
    });
    if (updateError || !updated) {
      console.error('Error updating comparison preferences:', updateError);
      return { ok: false, error: 'Failed to update comparison preferences.' };
    }
    return { ok: true, data: mapRowToPreferences(updated) };
  }

  const { data: inserted, error: insertError } = await accessor.insert({
    pinned_server_ids: pinnedServerIds,
    time_range: timeRange,
    created_at: nowIso,
    updated_at: nowIso,
  });
  if (insertError || !inserted) {
    console.error('Error inserting comparison preferences:', insertError);
    return { ok: false, error: 'Failed to save comparison preferences.' };
  }
  return { ok: true, data: mapRowToPreferences(inserted) };
}

/**
 * Persist the owner's pinned set + last-selected time range (R2.6) by a
 * PRE-RESOLVED `app_users.id`. Prefer this from server code that already knows
 * the owner id; route handlers holding a Supabase auth `User` should use
 * {@link saveComparisonPreferencesForUser}.
 *
 * Behaviour:
 * - FIRST validates the selection with {@link validatePinnedSelection}; an
 *   out-of-bounds selection (< 2 or > 4 distinct) returns
 *   `{ ok: false, error }` with the validation message and writes NOTHING,
 *   enforcing the 2..4 bound at the persistence boundary (R2.2/R2.3).
 * - Then upserts the single per-user row using the DEDUPED `distinct` selection
 *   from validation, forcing `user_id = ownerId` via the accessor (R9.4).
 *
 * @returns the saved {@link ComparisonPreferences} on success, or a
 *   UI-displayable error string on failure.
 */
export async function saveComparisonPreferences(
  ownerId: number,
  prefs: ComparisonPreferencesInput,
  supabaseClient?: SupabaseClient<Database>,
): Promise<SaveComparisonPreferencesResult> {
  const validation = validatePinnedSelection(prefs.pinnedServerIds);
  if (!validation.valid) {
    return { ok: false, error: validation.message ?? 'Invalid pinned server selection.' };
  }

  const accessor = createSupabaseOwnerScopedAccessor<ComparisonPreferencesRow>(
    resolveClient(supabaseClient),
    COMPARISON_PREFERENCES_TABLE,
    ownerId,
  );

  return persistComparisonPreferences(accessor, validation.distinct, prefs.timeRange);
}

/**
 * Convenience wrapper around {@link saveComparisonPreferences} for callers that
 * hold a Supabase auth `User`. Validates the selection BEFORE resolving the
 * owner (so an invalid selection never triggers user creation), then resolves
 * the owning `app_users.id` via `getOrCreateAppUser` and upserts owner-scoped.
 */
export async function saveComparisonPreferencesForUser(
  supabaseClient: SupabaseClient<Database>,
  user: User,
  prefs: ComparisonPreferencesInput,
): Promise<SaveComparisonPreferencesResult> {
  const validation = validatePinnedSelection(prefs.pinnedServerIds);
  if (!validation.valid) {
    return { ok: false, error: validation.message ?? 'Invalid pinned server selection.' };
  }

  const { accessor, error } = await createOwnerScopedAccessorForUser<ComparisonPreferencesRow>(
    supabaseClient,
    user,
    COMPARISON_PREFERENCES_TABLE,
  );
  if (error || !accessor) {
    console.error('Error resolving owner for comparison preferences:', error);
    return { ok: false, error: 'Unable to resolve the current user.' };
  }

  return persistComparisonPreferences(accessor, validation.distinct, prefs.timeRange);
}
