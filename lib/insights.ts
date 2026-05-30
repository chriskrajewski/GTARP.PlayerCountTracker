/**
 * Historical Wrapped / Insights reports (R5).
 *
 * Generates a shareable monthly recap ("wrapped") from the existing
 * Player_Count_Series and persists it so previously generated reports remain
 * viewable and shareable (R5.1, R5.6). Each report captures three notable
 * metrics for the month (R5.2):
 *   - the peak-activity day,
 *   - the busiest server, and
 *   - the server with the largest month-over-month growth.
 * When the series lacks the data needed for a metric, that metric is emitted as
 * `{ available: false }` rather than a fabricated/zero value (R5.3).
 *
 * Layering / migration safety (R9.1, R9.3)
 * ----------------------------------------
 * All database access routes through this `lib/` module. Month data is read by
 * REUSING the existing `getPlayerCounts` read (R9.3) — no parallel raw query is
 * opened against `player_counts`. `insights_reports` is **service-role write /
 * client read** (see `api2db/sql/insights_reports_schema.sql`):
 *   - WRITES (`generateMonthlyReport`'s insert) go through the service-role
 *     client (`createServiceRoleClient`) and run server-side only (the cron).
 *   - READS (`getReportByMonth`, `getReportBySlug`, `listReports`) select the
 *     client exactly as `lib/data.ts` does
 *     (`typeof window !== "undefined" ? supabase : createServerClient()`).
 * The table is not part of the generated `Database` type yet, so the client is
 * adapted to a minimal structural surface at a single boundary — the same
 * approach used by `lib/prediction-accuracy.ts` and `lib/anomaly.ts`.
 *
 * Scoping a month via `getPlayerCounts` (R9.3)
 * --------------------------------------------
 * `getPlayerCounts(serverIds, timeRange)` only accepts a relative `TimeRange`
 * enum (e.g. `'90d'`) measured from "now", NOT an arbitrary start/end date, and
 * `lib/data.ts` exposes no date-bounded player-count read. To assemble a
 * specific month's data we therefore:
 *   1. pick the SMALLEST `TimeRange` whose lookback (relative to `now`) reaches
 *      back to the START of the month BEFORE the target month (the previous
 *      month is required for the month-over-month metric) — see
 *      {@link selectTimeRangeForMonth}; then
 *   2. filter that wider series down to the target and previous calendar months
 *      IN MEMORY inside {@link computeMetrics}.
 * For a just-completed month generated early in the following month this is
 * typically `'90d'`. The full series is passed to {@link computeMetrics}, which
 * splits it by UTC calendar-month boundaries itself.
 *
 * Metric definitions (documented for Property 19/20)
 * --------------------------------------------------
 * - **Aggregate activity** for the peak-activity day = the SUM of `player_count`
 *   across every series point that falls on that UTC calendar day (all servers,
 *   all samples). The peak-activity day is the day in the target month with the
 *   maximum such sum; ties break to the EARLIER day.
 * - **Busiest server** = the server with the maximum monthly total (sum of
 *   `player_count` over the target month); ties break to the lexicographically
 *   smaller `server_id`.
 * - **Month-over-month growth** is measured as the ABSOLUTE difference
 *   `currentMonthTotal - previousMonthTotal` per server (absolute, not a
 *   percentage — a percentage would require divide-by-zero guarding for servers
 *   absent in the prior month). A server present in only one of the two months
 *   contributes `0` for the missing month. The largest-growth server is the one
 *   with the maximum increase; ties break to the lexicographically smaller
 *   `server_id`. This metric is `{ available: false }` unless BOTH months carry
 *   data (R5.3) — without prior-month data there is nothing to compare against.
 *
 * Immutability (R5.6)
 * -------------------
 * Reports are immutable once generated. {@link generateMonthlyReport} first
 * checks whether a report already exists for the month and, if so, returns the
 * existing report unchanged rather than regenerating/overwriting it. The table
 * grants clients no insert/update/delete, so generated reports cannot be
 * mutated by client callers either.
 *
 * Testability
 * -----------
 * Persistence functions accept an optional {@link InsightsStore} so the
 * round-trip property test (task 11.5 / Property 21) can inject the
 * deterministic {@link InMemoryInsightsStore} instead of a live database, and
 * {@link generateMonthlyReport} accepts an injectable player-count fetcher and
 * slug generator. {@link computeMetrics} is PURE (no I/O), taking the series and
 * month as arguments, for the metric property tests (tasks 11.3, 11.4).
 */
import { supabase } from './supabase';
import { createServerClient } from './supabase-server';
import { createServiceRoleClient } from './supabase-service-role';
import { getPlayerCounts, type PlayerCountData, type TimeRange } from './data';

/* -------------------------------------------------------------------------- */
/* Constants                                                                  */
/* -------------------------------------------------------------------------- */

/** Table backing this module (see `api2db/sql/insights_reports_schema.sql`). */
const INSIGHTS_REPORTS_TABLE = 'insights_reports';

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * Relative {@link TimeRange} candidates, ordered smallest-lookback first, used
 * by {@link selectTimeRangeForMonth} to pick the tightest range that still
 * reaches back far enough to include the previous month. `'all'` is the
 * fallback when even a year is not enough.
 */
const TIME_RANGE_LOOKBACK_DAYS: ReadonlyArray<{ range: TimeRange; days: number }> = [
  { range: '30d', days: 30 },
  { range: '90d', days: 90 },
  { range: '180d', days: 180 },
  { range: '365d', days: 365 },
];

/* -------------------------------------------------------------------------- */
/* Public metric types                                                        */
/* -------------------------------------------------------------------------- */

/** The shared "unavailable" variant for a metric with insufficient data (R5.3). */
export interface MetricUnavailable {
  available: false;
}

/**
 * Peak-activity day of the month (R5.2). `day` is the UTC calendar day
 * (`'YYYY-MM-DD'`) with the maximum aggregate activity; `activity` is the sum of
 * `player_count` across all series points on that day.
 */
export type PeakDayMetric =
  | MetricUnavailable
  | { available: true; day: string; activity: number };

/**
 * Busiest server of the month (R5.2). `serverId` has the maximum monthly total
 * (`total` = sum of `player_count` over the target month).
 */
export type BusiestServerMetric =
  | MetricUnavailable
  | { available: true; serverId: string; total: number };

/**
 * Server with the largest month-over-month growth (R5.2). `growth` is the
 * ABSOLUTE difference `currentTotal - previousTotal`. `{ available: false }`
 * unless both months carry data (R5.3).
 */
export type MomGrowthMetric =
  | MetricUnavailable
  | {
      available: true;
      serverId: string;
      /** Absolute increase: `currentTotal - previousTotal`. */
      growth: number;
      currentTotal: number;
      previousTotal: number;
    };

/**
 * The three independently-available metrics of a monthly report (R5.2, R5.3).
 * Each metric is its own discriminated union, so one metric being unavailable
 * never forces the others to be.
 */
export interface InsightsMetrics {
  peakDay: PeakDayMetric;
  busiestServer: BusiestServerMetric;
  momGrowth: MomGrowthMetric;
}

/* -------------------------------------------------------------------------- */
/* Public report types                                                        */
/* -------------------------------------------------------------------------- */

/** A fully-resolved persisted report (camelCased for callers). */
export interface InsightsReport {
  id: number;
  /** Calendar month the report covers, `'YYYY-MM'`. */
  month: string;
  metrics: InsightsMetrics;
  /** ISO timestamp the report was generated. */
  generatedAt: string;
  /** Opaque public share-link slug (R5.4). */
  shareSlug: string;
}

/** A lighter summary used for the retained-reports list (R5.6). */
export interface InsightsReportSummary {
  month: string;
  shareSlug: string;
  generatedAt: string;
  /** Small preview metric so the list can show the month's headline server. */
  busiestServer: BusiestServerMetric;
}

/* -------------------------------------------------------------------------- */
/* Row & I/O types (mirror the SQL schema, R9.2)                              */
/* -------------------------------------------------------------------------- */

/**
 * A persisted `insights_reports` row. `metrics` is stored as `jsonb` and read
 * back as a parsed object. Client-agnostic so it stays expressible in both
 * Supabase and Prisma (R9.2).
 */
export interface InsightsReportRow {
  id: number;
  month: string;
  metrics: InsightsMetrics;
  generated_at: string;
  share_slug: string;
}

/** The insertable subset of a report row (`id`/`generated_at` are DB-assigned). */
export interface NewInsightsReport {
  month: string;
  metrics: InsightsMetrics;
  share_slug: string;
  /** Optional explicit timestamp; the DB defaults `generated_at` to `now()`. */
  generated_at?: string;
}

/* -------------------------------------------------------------------------- */
/* Pure month helpers (no I/O — directly unit/property testable)              */
/* -------------------------------------------------------------------------- */

/** Whether a string is a well-formed `'YYYY-MM'` month key (months 01..12). */
export function isValidMonth(month: string): boolean {
  return /^\d{4}-(0[1-9]|1[0-2])$/.test(month);
}

/** Parse a valid `'YYYY-MM'` into `{ year, month1to12 }`, or `null` if invalid. */
function parseMonth(month: string): { year: number; month1to12: number } | null {
  if (!isValidMonth(month)) return null;
  const [yearStr, monthStr] = month.split('-');
  return { year: Number(yearStr), month1to12: Number(monthStr) };
}

/**
 * The calendar month immediately before `month` (`'YYYY-MM'`), e.g.
 * `'2024-01' -> '2023-12'`. Returns `null` for an invalid input.
 */
export function previousMonth(month: string): string | null {
  const parsed = parseMonth(month);
  if (!parsed) return null;
  // Date.UTC handles the January -> previous-December year rollover.
  const date = new Date(Date.UTC(parsed.year, parsed.month1to12 - 2, 1));
  return formatMonthKey(date);
}

/** Format a Date as a UTC `'YYYY-MM'` month key. */
function formatMonthKey(date: Date): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}

/** Format epoch-ms as a UTC `'YYYY-MM-DD'` day key. */
function utcDayKey(ms: number): string {
  const date = new Date(ms);
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  const d = String(date.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Half-open UTC instant bounds `[startMs, endMs)` for a `'YYYY-MM'` month, or
 * `null` for an invalid input. `endMs` is the start of the following month.
 */
export function monthBoundsUTC(month: string): { startMs: number; endMs: number } | null {
  const parsed = parseMonth(month);
  if (!parsed) return null;
  const startMs = Date.UTC(parsed.year, parsed.month1to12 - 1, 1);
  const endMs = Date.UTC(parsed.year, parsed.month1to12, 1);
  return { startMs, endMs };
}

/**
 * Pick the smallest relative {@link TimeRange} whose lookback from `now` reaches
 * back to the START of the month BEFORE `month` (so both the target month and
 * its predecessor are covered for the MoM metric). Falls back to `'all'` when no
 * bounded range is wide enough. See the module header for why a relative range
 * is required.
 */
export function selectTimeRangeForMonth(month: string, now: Date = new Date()): TimeRange {
  const prev = previousMonth(month);
  const prevBounds = prev ? monthBoundsUTC(prev) : null;
  if (!prevBounds) return 'all';

  const daysBack = (now.getTime() - prevBounds.startMs) / MS_PER_DAY;
  if (daysBack <= 0) {
    // The previous month has not started relative to `now`; smallest range is fine.
    return TIME_RANGE_LOOKBACK_DAYS[0].range;
  }
  for (const candidate of TIME_RANGE_LOOKBACK_DAYS) {
    if (candidate.days >= daysBack) return candidate.range;
  }
  return 'all';
}

/* -------------------------------------------------------------------------- */
/* Pure metric computation (no I/O — Property 19, 20)                         */
/* -------------------------------------------------------------------------- */

/** Sum `player_count` per server over a set of points. */
function totalsByServer(points: readonly PlayerCountData[]): Map<string, number> {
  const totals = new Map<string, number>();
  for (const point of points) {
    totals.set(point.server_id, (totals.get(point.server_id) ?? 0) + point.player_count);
  }
  return totals;
}

/**
 * Filter `series` to the points whose `timestamp` falls within the half-open
 * UTC month bounds `[startMs, endMs)`. Points with unparseable timestamps are
 * dropped.
 */
function pointsInMonth(
  series: readonly PlayerCountData[],
  bounds: { startMs: number; endMs: number },
): PlayerCountData[] {
  const result: PlayerCountData[] = [];
  for (const point of series) {
    const ms = Date.parse(point.timestamp);
    if (Number.isNaN(ms)) continue;
    if (ms >= bounds.startMs && ms < bounds.endMs) result.push(point);
  }
  return result;
}

/** Peak-activity day from the target month's points (Property 19/20). */
function computePeakDay(currentPoints: readonly PlayerCountData[]): PeakDayMetric {
  if (currentPoints.length === 0) return { available: false };

  const activityByDay = new Map<string, number>();
  for (const point of currentPoints) {
    const ms = Date.parse(point.timestamp);
    if (Number.isNaN(ms)) continue;
    const day = utcDayKey(ms);
    activityByDay.set(day, (activityByDay.get(day) ?? 0) + point.player_count);
  }
  if (activityByDay.size === 0) return { available: false };

  let bestDay: string | null = null;
  let bestActivity = Number.NEGATIVE_INFINITY;
  for (const [day, activity] of activityByDay) {
    // Max activity; ties break to the earlier (lexicographically smaller) day.
    if (activity > bestActivity || (activity === bestActivity && (bestDay === null || day < bestDay))) {
      bestDay = day;
      bestActivity = activity;
    }
  }
  if (bestDay === null) return { available: false };
  return { available: true, day: bestDay, activity: bestActivity };
}

/** Busiest server from the target month's totals (Property 19/20). */
function computeBusiestServer(currentTotals: Map<string, number>): BusiestServerMetric {
  if (currentTotals.size === 0) return { available: false };

  let bestServer: string | null = null;
  let bestTotal = Number.NEGATIVE_INFINITY;
  for (const [serverId, total] of currentTotals) {
    // Max total; ties break to the lexicographically smaller server id.
    if (
      total > bestTotal ||
      (total === bestTotal && (bestServer === null || serverId < bestServer))
    ) {
      bestServer = serverId;
      bestTotal = total;
    }
  }
  if (bestServer === null) return { available: false };
  return { available: true, serverId: bestServer, total: bestTotal };
}

/** Largest month-over-month growth across both months (Property 19/20). */
function computeMomGrowth(
  currentTotals: Map<string, number>,
  previousTotals: Map<string, number>,
): MomGrowthMetric {
  // Without data for BOTH months there is nothing meaningful to compare (R5.3).
  if (currentTotals.size === 0 || previousTotals.size === 0) {
    return { available: false };
  }

  const serverIds = new Set<string>([...currentTotals.keys(), ...previousTotals.keys()]);
  let bestServer: string | null = null;
  let bestGrowth = Number.NEGATIVE_INFINITY;
  let bestCurrent = 0;
  let bestPrevious = 0;

  for (const serverId of serverIds) {
    const current = currentTotals.get(serverId) ?? 0;
    const previous = previousTotals.get(serverId) ?? 0;
    const growth = current - previous;
    // Max growth; ties break to the lexicographically smaller server id.
    if (
      growth > bestGrowth ||
      (growth === bestGrowth && (bestServer === null || serverId < bestServer))
    ) {
      bestServer = serverId;
      bestGrowth = growth;
      bestCurrent = current;
      bestPrevious = previous;
    }
  }

  if (bestServer === null) return { available: false };
  return {
    available: true,
    serverId: bestServer,
    growth: bestGrowth,
    currentTotal: bestCurrent,
    previousTotal: bestPrevious,
  };
}

/**
 * Compute the month's insights metrics from a player-count series (PURE — R5.2,
 * R5.3 / Properties 19, 20).
 *
 * `series` should span BOTH the target `month` and the month before it (the
 * month-over-month metric needs the predecessor); this function splits it by UTC
 * calendar-month boundaries itself, so passing a wider series (e.g. a 90-day
 * window) is fine — only points inside the relevant months are used.
 *
 * Each returned metric is independently `{ available: true; ... }` or
 * `{ available: false }`:
 *   - `peakDay` / `busiestServer` are unavailable when the target month has no
 *     points;
 *   - `momGrowth` is unavailable unless BOTH months have data.
 *
 * See the module header for the precise definitions of "aggregate activity",
 * "busiest", and the absolute growth measure, plus the tie-break rules.
 *
 * @param series player-count points (any range covering the two months).
 * @param month the target month, `'YYYY-MM'`. An invalid month yields all
 *   metrics unavailable.
 */
export function computeMetrics(series: readonly PlayerCountData[], month: string): InsightsMetrics {
  const currentBounds = monthBoundsUTC(month);
  const prev = previousMonth(month);
  const previousBounds = prev ? monthBoundsUTC(prev) : null;

  if (!currentBounds) {
    return {
      peakDay: { available: false },
      busiestServer: { available: false },
      momGrowth: { available: false },
    };
  }

  const currentPoints = pointsInMonth(series, currentBounds);
  const previousPoints = previousBounds ? pointsInMonth(series, previousBounds) : [];

  const currentTotals = totalsByServer(currentPoints);
  const previousTotals = totalsByServer(previousPoints);

  return {
    peakDay: computePeakDay(currentPoints),
    busiestServer: computeBusiestServer(currentTotals),
    momGrowth: computeMomGrowth(currentTotals, previousTotals),
  };
}

/* -------------------------------------------------------------------------- */
/* Data-access store (injectable for tests)                                   */
/* -------------------------------------------------------------------------- */

/** `{ row|rows, error }` envelopes mirroring the existing `lib/` convention. */
export interface InsightsStore {
  /** The report for a month, or `null` when none exists (R5.6 immutability check). */
  getByMonth(month: string): Promise<{ row: InsightsReportRow | null; error: Error | null }>;
  /** The report addressed by share slug, or `null` (R5.4 share resolution). */
  getBySlug(slug: string): Promise<{ row: InsightsReportRow | null; error: Error | null }>;
  /** Insert a new report row (service-role write, R5.1). */
  insert(row: NewInsightsReport): Promise<{ row: InsightsReportRow | null; error: Error | null }>;
  /** Retained reports newest-first for the list (R5.6). */
  list(): Promise<{ rows: InsightsReportRow[]; error: Error | null }>;
}

/* --- Supabase-backed store ------------------------------------------------ */

type PgError = { message: string };

interface SelectQuery<T> extends PromiseLike<{ data: T[] | null; error: PgError | null }> {
  eq(column: string, value: string | number): SelectQuery<T>;
  order(column: string, opts: { ascending: boolean }): SelectQuery<T>;
  limit(count: number): SelectQuery<T>;
}
type SingleQuery<T> = PromiseLike<{ data: T | null; error: PgError | null }>;
interface InsertQuery<T> {
  select(columns?: string): { single(): SingleQuery<T> };
}
interface InsightsTable<T> {
  select(columns?: string): SelectQuery<T>;
  insert(rows: ReadonlyArray<Partial<T>>): InsertQuery<T>;
}
/**
 * The narrow structural surface of the Supabase client this store relies on.
 * `insights_reports` is not part of the generated `Database` type yet, so the
 * client is adapted at this single boundary rather than threaded through the
 * fully-typed `from(<known table>)` overloads (same approach as
 * `lib/prediction-accuracy.ts` / `lib/anomaly.ts`).
 */
interface MinimalClient {
  from<T>(table: string): InsightsTable<T>;
}

function toError(error: PgError | null): Error | null {
  return error ? new Error(error.message) : null;
}

/**
 * Build an {@link InsightsStore} backed by a Supabase client. The caller
 * supplies the correct client: the service-role client for the write path
 * ({@link generateMonthlyReport}), the normal browser/server client for the
 * public reads.
 */
export function createSupabaseInsightsStore(client: MinimalClient): InsightsStore {
  const table = () => client.from<InsightsReportRow>(INSIGHTS_REPORTS_TABLE);

  return {
    async getByMonth(month) {
      const { data, error } = await table()
        .select('*')
        .eq('month', month)
        .limit(1);
      return { row: data?.[0] ?? null, error: toError(error) };
    },

    async getBySlug(slug) {
      const { data, error } = await table()
        .select('*')
        .eq('share_slug', slug)
        .limit(1);
      return { row: data?.[0] ?? null, error: toError(error) };
    },

    async insert(row) {
      const { data, error } = await table()
        .insert([row as Partial<InsightsReportRow>])
        .select()
        .single();
      return { row: data ?? null, error: toError(error) };
    },

    async list() {
      const { data, error } = await table()
        .select('*')
        .order('generated_at', { ascending: false });
      return { rows: data ?? [], error: toError(error) };
    },
  };
}

/** Read store: selects the client exactly as `lib/data.ts` does. */
function createDefaultReadStore(): InsightsStore {
  const client = (typeof window !== 'undefined' ? supabase : createServerClient()) as unknown as MinimalClient;
  return createSupabaseInsightsStore(client);
}

/** Write store: service-role client (server-side only, bypasses RLS). */
function createDefaultWriteStore(): InsightsStore {
  const client = createServiceRoleClient() as unknown as MinimalClient;
  return createSupabaseInsightsStore(client);
}

/* --- In-memory store (deterministic tests) -------------------------------- */

/**
 * Dependency-free {@link InsightsStore} backed by a plain array, with identical
 * semantics to the Supabase store so it is a faithful stand-in for the
 * retention/retrieval round-trip property test (task 11.5 / Property 21).
 * Enforces the schema's `month` and `share_slug` UNIQUE constraints by
 * returning an error on a conflicting insert, so the immutability path is
 * exercised deterministically.
 */
export class InMemoryInsightsStore implements InsightsStore {
  private rows: InsightsReportRow[] = [];
  private nextId: number;

  constructor(options?: { seed?: InsightsReportRow[]; startId?: number }) {
    if (options?.seed) {
      this.rows = options.seed.map((r) => ({ ...r }));
    }
    const maxSeededId = this.rows.reduce((max, r) => Math.max(max, r.id), 0);
    this.nextId = options?.startId ?? maxSeededId + 1;
  }

  /** Snapshot of all stored rows (test inspection only). */
  all(): InsightsReportRow[] {
    return this.rows.map((r) => ({ ...r }));
  }

  async getByMonth(
    month: string,
  ): Promise<{ row: InsightsReportRow | null; error: Error | null }> {
    const found = this.rows.find((r) => r.month === month) ?? null;
    return { row: found ? { ...found } : null, error: null };
  }

  async getBySlug(
    slug: string,
  ): Promise<{ row: InsightsReportRow | null; error: Error | null }> {
    const found = this.rows.find((r) => r.share_slug === slug) ?? null;
    return { row: found ? { ...found } : null, error: null };
  }

  async insert(
    row: NewInsightsReport,
  ): Promise<{ row: InsightsReportRow | null; error: Error | null }> {
    if (this.rows.some((r) => r.month === row.month)) {
      return { row: null, error: new Error(`insights_reports: month ${row.month} already exists`) };
    }
    if (this.rows.some((r) => r.share_slug === row.share_slug)) {
      return { row: null, error: new Error(`insights_reports: share_slug already exists`) };
    }
    const created: InsightsReportRow = {
      id: this.nextId++,
      month: row.month,
      metrics: row.metrics,
      generated_at: row.generated_at ?? new Date().toISOString(),
      share_slug: row.share_slug,
    };
    this.rows.push(created);
    return { row: { ...created }, error: null };
  }

  async list(): Promise<{ rows: InsightsReportRow[]; error: Error | null }> {
    const rows = this.rows
      .slice()
      .sort((a, b) => Date.parse(b.generated_at) - Date.parse(a.generated_at))
      .map((r) => ({ ...r }));
    return { rows, error: null };
  }
}

/* -------------------------------------------------------------------------- */
/* Mapping helpers                                                            */
/* -------------------------------------------------------------------------- */

/** Map a persisted row to the camelCased public {@link InsightsReport}. */
function rowToReport(row: InsightsReportRow): InsightsReport {
  return {
    id: row.id,
    month: row.month,
    metrics: row.metrics,
    generatedAt: row.generated_at,
    shareSlug: row.share_slug,
  };
}

/** Map a persisted row to the lighter {@link InsightsReportSummary}. */
function rowToSummary(row: InsightsReportRow): InsightsReportSummary {
  return {
    month: row.month,
    shareSlug: row.share_slug,
    generatedAt: row.generated_at,
    busiestServer: row.metrics?.busiestServer ?? { available: false },
  };
}

/**
 * Generate an opaque, hard-to-guess share slug (R5.4). Prefers Web Crypto
 * (`randomUUID` / `getRandomValues`, available in Node 20+ and browsers); falls
 * back to a non-crypto source only if neither exists. Injectable in
 * {@link generateMonthlyReport} for deterministic tests.
 */
function defaultGenerateSlug(): string {
  const cryptoObj = (globalThis as { crypto?: Crypto }).crypto;
  if (cryptoObj?.randomUUID) {
    return cryptoObj.randomUUID().replace(/-/g, '');
  }
  if (cryptoObj?.getRandomValues) {
    const bytes = new Uint8Array(16);
    cryptoObj.getRandomValues(bytes);
    return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
  }
  return `${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
}

/* -------------------------------------------------------------------------- */
/* Persistence / orchestration functions                                      */
/* -------------------------------------------------------------------------- */

/**
 * Options for {@link generateMonthlyReport} (all injectable for tests).
 */
export interface GenerateMonthlyReportOptions {
  /** Inject a store (tests use {@link InMemoryInsightsStore}); defaults to service-role. */
  store?: InsightsStore;
  /**
   * Fetch the player-count series covering the target + previous month. Defaults
   * to reusing `getPlayerCounts([], range)` over the {@link selectTimeRangeForMonth}
   * range (R9.3) and filtering to the months inside {@link computeMetrics}.
   */
  fetchPlayerCounts?: (timeRange: TimeRange) => Promise<PlayerCountData[]>;
  /** Reference "now" used to choose the relative time range (defaults to `new Date()`). */
  now?: Date;
  /** Opaque slug generator (defaults to {@link defaultGenerateSlug}). */
  generateSlug?: () => string;
}

/**
 * Generate (or return the already-generated) monthly Insights_Report (R5.1,
 * R5.6 / Property 21).
 *
 * Immutability (R5.6): if a report already exists for `month`, it is returned
 * UNCHANGED — the report is never regenerated or overwritten. Otherwise the
 * month's data is read by REUSING `getPlayerCounts` (R9.3) over the smallest
 * relative range that covers the target and previous months
 * ({@link selectTimeRangeForMonth}), {@link computeMetrics} derives the metrics,
 * an opaque {@link defaultGenerateSlug} share slug is minted, and the row is
 * inserted via the service-role store and returned.
 *
 * On a rare insert conflict (another generation raced in and inserted the same
 * month first — the `month` UNIQUE constraint, R5.6) this re-reads and returns
 * the existing report rather than failing.
 *
 * @param month the target month, `'YYYY-MM'`.
 * @throws if `month` is invalid, or if persistence fails for a non-conflict reason.
 */
export async function generateMonthlyReport(
  month: string,
  options?: GenerateMonthlyReportOptions,
): Promise<InsightsReport> {
  if (!isValidMonth(month)) {
    throw new Error(`generateMonthlyReport: invalid month '${month}' (expected 'YYYY-MM')`);
  }

  const store = options?.store ?? createDefaultWriteStore();
  const now = options?.now ?? new Date();

  // R5.6 — never regenerate/overwrite an existing report.
  const existing = await store.getByMonth(month);
  if (existing.error) {
    console.error('Error checking for existing insights report:', existing.error);
    throw existing.error;
  }
  if (existing.row) {
    return rowToReport(existing.row);
  }

  // Read the month (and previous month) data by reusing getPlayerCounts (R9.3).
  const timeRange = selectTimeRangeForMonth(month, now);
  const fetchPlayerCounts =
    options?.fetchPlayerCounts ?? ((range: TimeRange) => getPlayerCounts([], range));
  const series = (await fetchPlayerCounts(timeRange)) ?? [];

  const metrics = computeMetrics(series, month);
  const shareSlug = (options?.generateSlug ?? defaultGenerateSlug)();

  const inserted = await store.insert({ month, metrics, share_slug: shareSlug });
  if (inserted.error || !inserted.row) {
    // A concurrent generation may have won the `month` UNIQUE race; return theirs.
    const raced = await store.getByMonth(month);
    if (raced.row) {
      return rowToReport(raced.row);
    }
    const error = inserted.error ?? new Error('insights report insert returned no row');
    console.error('Error inserting insights report:', error);
    throw error;
  }

  return rowToReport(inserted.row);
}

/**
 * Retrieve a retained report by its calendar month (R5.6). Returns `null` when
 * no report exists for that month. Reads via the public read client.
 *
 * @param options.store inject a store (tests); defaults to the read store.
 */
export async function getReportByMonth(
  month: string,
  options?: { store?: InsightsStore },
): Promise<InsightsReport | null> {
  if (!isValidMonth(month)) return null;
  const store = options?.store ?? createDefaultReadStore();
  const { row, error } = await store.getByMonth(month);
  if (error) {
    console.error('Error loading insights report by month:', error);
    return null;
  }
  return row ? rowToReport(row) : null;
}

/**
 * Resolve a report by its public share slug (R5.4 / Property 21). The same
 * stored report is returned for any caller, and it stays resolvable unchanged
 * after later reports are generated. Returns `null` for an unknown slug.
 *
 * @param options.store inject a store (tests); defaults to the read store.
 */
export async function getReportBySlug(
  slug: string,
  options?: { store?: InsightsStore },
): Promise<InsightsReport | null> {
  const store = options?.store ?? createDefaultReadStore();
  const { row, error } = await store.getBySlug(slug);
  if (error) {
    console.error('Error loading insights report by slug:', error);
    return null;
  }
  return row ? rowToReport(row) : null;
}

/**
 * Retrieve a report by month (R5.4, R5.6). Alias of {@link getReportByMonth}
 * matching the design's `getReport(month)` signature; share-link resolution by
 * slug uses {@link getReportBySlug}.
 *
 * @param options.store inject a store (tests); defaults to the read store.
 */
export async function getReport(
  month: string,
  options?: { store?: InsightsStore },
): Promise<InsightsReport | null> {
  return getReportByMonth(month, options);
}

/**
 * List retained reports, newest first (R5.6). Public read.
 *
 * @param options.store inject a store (tests); defaults to the read store.
 */
export async function listReports(options?: {
  store?: InsightsStore;
}): Promise<InsightsReportSummary[]> {
  const store = options?.store ?? createDefaultReadStore();
  const { rows, error } = await store.list();
  if (error) {
    console.error('Error listing insights reports:', error);
    return [];
  }
  return rows.map(rowToSummary);
}
