/**
 * Anomaly Detection for player-count time-series (R7).
 *
 * Flags unusual drops and spikes in a server's player count so server issues or
 * notable events are surfaced promptly to admins (R7.4) and, when enabled, to
 * the public (R7.5). The detection rule reuses the existing `lib/monitoring.ts`
 * approach — a percent deviation from an expected baseline combined with a
 * minimum ABSOLUTE change, plus the `previous > 10` small-baseline guard — but
 * persists each anomaly to the dedicated `anomaly_records` table with the
 * observed value, expected value, and direction (R7.2, R7.3).
 *
 * Layering / migration safety (R9.1)
 * ----------------------------------
 * The classification math lives in PURE functions ({@link classifyPoint},
 * {@link expectedValueFor}, {@link deviationPercentFor}) that take all inputs as
 * arguments and perform no I/O, so they are deterministic and directly
 * property-testable (tasks 8.3-8.6). All database access routes through this
 * `lib/` module via an injectable {@link AnomalyStore}. `anomaly_records` is
 * **service-role write / client read** (see
 * `api2db/sql/anomaly_records_schema.sql`):
 *   - WRITES ({@link recordAnomaly}) go through the service-role client.
 *   - READS ({@link getAnomaliesForServer}) select the client exactly as
 *     `lib/data.ts` does (`typeof window !== "undefined" ? supabase :
 *     createServerClient()`).
 * The table is not part of the generated `Database` type yet, so the client is
 * adapted to a minimal structural surface at a single boundary — the same
 * approach used by `lib/prediction-accuracy.ts` and `lib/web-push.ts`.
 *
 * Thresholds are admin-configurable via `system_settings` (the `anomaly_config`
 * key) and DEFAULT to the existing monitoring config values (R7.7); see
 * {@link loadAnomalyConfig} / {@link saveAnomalyConfig}.
 *
 * Threshold comparison convention
 * -------------------------------
 * R7.1 (and the task) specify "deviation > threshold" and "absolute change >
 * minChange". This module uses STRICT greater-than for BOTH comparisons: a
 * point is anomalous exactly when `percentDeviation > thresholdPercent` AND
 * `absoluteChange > minChange`. A value exactly equal to a threshold is NOT
 * anomalous. See {@link classifyPoint}.
 */
import { supabase } from './supabase';
import { createServerClient } from './supabase-server';
import { createServiceRoleClient } from './supabase-service-role';
import { getSystemSettingRecord, upsertSystemSetting } from './system-settings';
import { DEFAULT_MONITORING_CONFIG, loadMonitoringConfig } from './monitoring';
import type { PlayerCountData } from './data';

/* -------------------------------------------------------------------------- */
/* Constants                                                                  */
/* -------------------------------------------------------------------------- */

/** Table backing this module (see `api2db/sql/anomaly_records_schema.sql`). */
const ANOMALY_RECORDS_TABLE = 'anomaly_records';

/** `system_settings` key holding the admin-adjustable anomaly thresholds (R7.7). */
export const ANOMALY_CONFIG_KEY = 'anomaly_config';

const MS_PER_MINUTE = 60_000;

/**
 * Small-baseline guard, mirroring `lib/monitoring.ts`'s `previous > 10` check.
 * When the expected baseline is not strictly greater than this floor it is too
 * small to form a reliable percentage (a swing of a couple of players on a tiny
 * baseline is noise, not an anomaly), so {@link classifyPoint} returns
 * not-anomalous. The bound is STRICT (`expected > floor`) exactly like the
 * monitoring guard.
 */
export const DEFAULT_BASELINE_FLOOR = 10;

/**
 * Default detection/dedup configuration, derived directly from
 * `DEFAULT_MONITORING_CONFIG` so the anomaly detector defaults to the existing
 * monitoring values (R7.7). {@link loadAnomalyConfig} layers any persisted
 * `anomaly_config` override (and the live monitoring config) on top of this.
 */
export const DEFAULT_ANOMALY_CONFIG: AnomalyConfig = {
  thresholdPercent: DEFAULT_MONITORING_CONFIG.anomaly_threshold_percent,
  minChange: DEFAULT_MONITORING_CONFIG.anomaly_min_change,
  dedupWindowMinutes: DEFAULT_MONITORING_CONFIG.dedup_window_minutes,
};

/* -------------------------------------------------------------------------- */
/* Public types                                                               */
/* -------------------------------------------------------------------------- */

/** Anomaly direction (matches the `anomaly_records.direction` CHECK). */
export type AnomalyDirection = 'spike' | 'drop';

/**
 * Admin-adjustable detection thresholds (R7.7). Mirrors the relevant
 * `MonitoringConfig` fields so the two stay aligned; defaults come from
 * {@link DEFAULT_ANOMALY_CONFIG}.
 */
export interface AnomalyConfig {
  /** Percent deviation from expected above which a point may be anomalous. */
  thresholdPercent: number;
  /** Minimum absolute player-count change required for an anomaly. */
  minChange: number;
  /** Dedup window in minutes for suppressing repeat anomalies (R7.6). */
  dedupWindowMinutes: number;
}

/** Input to {@link classifyPoint} (R7.1). */
export interface ClassifyPointInput {
  /** Observed player count at the data point. */
  observed: number;
  /** Expected player count for that time (e.g. from {@link expectedValueFor}). */
  expected: number;
  /** Percent-deviation threshold; a point must EXCEED this to be anomalous. */
  thresholdPercent: number;
  /** Minimum absolute change; a point must EXCEED this to be anomalous. */
  minChange: number;
  /**
   * Small-baseline guard floor; the expected baseline must be strictly greater
   * than this to be considered reliable. Defaults to {@link DEFAULT_BASELINE_FLOOR}
   * (10), mirroring monitoring's `previous > 10`.
   */
  baselineFloor?: number;
}

/** Result of {@link classifyPoint} (R7.1). */
export interface ClassificationResult {
  /** Whether the point is anomalous. */
  anomalous: boolean;
  /** Direction when anomalous; `null` when not anomalous. */
  direction: AnomalyDirection | null;
  /**
   * Percent deviation of observed from expected (`|observed - expected| /
   * expected * 100`, `0` when expected is non-positive). Exposed so callers can
   * persist `deviation_percent` (the record needs it) without recomputing.
   */
  deviationPercent: number;
}

/**
 * A persisted `anomaly_records` row. Mirrors the SQL schema (client-agnostic so
 * it stays expressible in both Supabase and Prisma, R9.2).
 */
export interface AnomalyRecord {
  id: number;
  server_id: string;
  timestamp: string;
  observed_value: number;
  expected_value: number;
  direction: AnomalyDirection;
  deviation_percent: number;
  is_active: boolean;
  created_at: string;
}

/** The insertable subset of an anomaly row (`id`/`created_at` are DB-assigned). */
export interface NewAnomalyRecord {
  server_id: string;
  timestamp: string;
  observed_value: number;
  expected_value: number;
  direction: AnomalyDirection;
  deviation_percent: number;
  is_active: boolean;
}

/** Input to {@link recordAnomaly} (R7.2, R7.3). */
export interface RecordAnomalyInput {
  serverId: string;
  timestamp: string;
  observedValue: number;
  expectedValue: number;
  direction: AnomalyDirection;
  deviationPercent: number;
}

/** Options for {@link getAnomaliesForServer} (R7.4, R7.5). */
export interface GetAnomaliesOptions {
  /** Max rows to return (most recent first). */
  limit?: number;
  /** When `true`, only `is_active = true` rows are returned. */
  activeOnly?: boolean;
}

/* -------------------------------------------------------------------------- */
/* Pure helpers (no I/O — directly unit/property testable)                    */
/* -------------------------------------------------------------------------- */

/** Parse an ISO timestamp to epoch ms (`NaN` when unparseable). */
function parseTimeMs(value: string): number {
  return Date.parse(value);
}

/**
 * Hour-of-week bucket index (0..167) for an instant, computed in UTC so the
 * bucketing is independent of the running machine's local zone (same convention
 * as `lib/capacity-advisor.ts`). The bucket is `utcDayOfWeek * 24 + utcHour`,
 * day-of-week 0 (Sunday)..6 (Saturday).
 */
export function hourOfWeekUTC(date: Date): number {
  return date.getUTCDay() * 24 + date.getUTCHours();
}

/**
 * Percent deviation of `observed` from `expected`:
 * `|observed - expected| / expected * 100`.
 *
 * Returns `0` when `expected` is non-positive or either input is non-finite —
 * a percentage off a non-positive baseline is undefined, so it cannot indicate
 * an anomaly (the small-baseline guard in {@link classifyPoint} also rejects
 * such cases).
 */
export function deviationPercentFor(observed: number, expected: number): number {
  if (!Number.isFinite(observed) || !Number.isFinite(expected) || expected <= 0) {
    return 0;
  }
  return (Math.abs(observed - expected) / expected) * 100;
}

/**
 * Classify a single data point as anomalous or not (R7.1 / Property 26).
 *
 * A point is flagged anomalous EXACTLY when BOTH hold:
 *   1. `percentDeviation > thresholdPercent` (strict), where
 *      `percentDeviation = |observed - expected| / expected * 100`; AND
 *   2. `|observed - expected| > minChange` (strict).
 *
 * Both comparisons are STRICT greater-than: a value exactly equal to a
 * threshold is NOT anomalous (R7.1 / the task specify "> threshold" and
 * "> minChange").
 *
 * Small-baseline guard: when `expected` is not strictly greater than
 * `baselineFloor` (default {@link DEFAULT_BASELINE_FLOOR} = 10, mirroring
 * monitoring's `previous > 10`) the baseline is too small to form a reliable
 * percentage, so the point is reported not-anomalous regardless of the swing.
 *
 * Direction (only meaningful when anomalous): `'spike'` when `observed >
 * expected`, otherwise `'drop'` (Property 26: spike when observed exceeds
 * expected, drop otherwise). When not anomalous, `direction` is `null`.
 *
 * `deviationPercent` is always returned (even when not anomalous) so callers can
 * persist `deviation_percent` without recomputing.
 */
export function classifyPoint(input: ClassifyPointInput): ClassificationResult {
  const { observed, expected, thresholdPercent, minChange } = input;
  const baselineFloor = input.baselineFloor ?? DEFAULT_BASELINE_FLOOR;
  const deviationPercent = deviationPercentFor(observed, expected);

  // Small-baseline guard (monitoring's `previous > 10`). Strict bound.
  if (!(expected > baselineFloor)) {
    return { anomalous: false, direction: null, deviationPercent };
  }

  const absoluteChange = Math.abs(observed - expected);
  const anomalous = deviationPercent > thresholdPercent && absoluteChange > minChange;

  if (!anomalous) {
    return { anomalous: false, direction: null, deviationPercent };
  }

  const direction: AnomalyDirection = observed > expected ? 'spike' : 'drop';
  return { anomalous: true, direction, deviationPercent };
}

/**
 * Expected baseline player count for the hour-of-week the given `timestamp`
 * falls in — the mean `player_count` over all in-series points sharing that
 * UTC hour-of-week bucket.
 *
 * This mirrors the capacity advisor's hour-of-week baseline: player activity is
 * strongly periodic by time-of-week, so the expected value for, say, "Friday
 * 21:00 UTC" is the historical average across the series at that same bucket.
 * Points with unparseable timestamps are ignored. Returns `0` when no in-bucket
 * point exists (the caller's small-baseline guard then suppresses any anomaly).
 *
 * The `previous > 10` guard is NOT applied here — this function only computes
 * the baseline. The guard is applied at classification time by
 * {@link classifyPoint} (via its `baselineFloor`), keeping this a pure mean.
 */
export function expectedValueFor(series: PlayerCountData[], timestamp: string | Date): number {
  const at = timestamp instanceof Date ? timestamp : new Date(parseTimeMs(timestamp));
  if (Number.isNaN(at.getTime())) return 0;

  const targetBucket = hourOfWeekUTC(at);

  let sum = 0;
  let count = 0;
  for (const point of series) {
    const ms = parseTimeMs(point.timestamp);
    if (Number.isNaN(ms)) continue;
    if (hourOfWeekUTC(new Date(ms)) !== targetBucket) continue;
    sum += point.player_count;
    count += 1;
  }

  return count === 0 ? 0 : sum / count;
}

/**
 * Orchestration helper: evaluate one player-count point for anomaly against a
 * series-derived baseline using a given config (R7.1-R7.3).
 *
 * Computes the hour-of-week {@link expectedValueFor} baseline, runs
 * {@link classifyPoint} with the config's `thresholdPercent`/`minChange`, and —
 * when anomalous — returns the ready-to-persist {@link RecordAnomalyInput}
 * (integer expected value and deviation percent, matching the `integer`
 * columns). Pure (no I/O); used by the `/api/cron/anomaly` route (task 8.7) and
 * by tests to wire {@link expectedValueFor} -> {@link classifyPoint} ->
 * {@link recordAnomaly} together.
 */
export function evaluatePointForAnomaly(
  series: PlayerCountData[],
  point: { serverId: string; timestamp: string; observed: number },
  config: Pick<AnomalyConfig, 'thresholdPercent' | 'minChange'> & { baselineFloor?: number },
):
  | { anomalous: false }
  | { anomalous: true; record: RecordAnomalyInput } {
  const expected = expectedValueFor(series, point.timestamp);
  const classification = classifyPoint({
    observed: point.observed,
    expected,
    thresholdPercent: config.thresholdPercent,
    minChange: config.minChange,
    baselineFloor: config.baselineFloor,
  });

  if (!classification.anomalous || classification.direction === null) {
    return { anomalous: false };
  }

  return {
    anomalous: true,
    record: {
      serverId: point.serverId,
      timestamp: point.timestamp,
      observedValue: point.observed,
      expectedValue: Math.round(expected),
      direction: classification.direction,
      deviationPercent: Math.round(classification.deviationPercent),
    },
  };
}

/* -------------------------------------------------------------------------- */
/* Anomaly-record store (injectable for tests)                                */
/* -------------------------------------------------------------------------- */

/** `{ row|rows, error }` envelopes mirroring the existing `lib/` convention. */
export interface AnomalyStore {
  /**
   * Active anomalies for a `(server_id, direction)` whose `created_at >=
   * sinceIso` — the dedup-window lookup (R7.6).
   */
  findActiveByServerDirectionSince(
    serverId: string,
    direction: AnomalyDirection,
    sinceIso: string,
  ): Promise<{ rows: AnomalyRecord[]; error: Error | null }>;
  /** Insert a new anomaly row (R7.2, R7.3). */
  insertAnomaly(
    row: NewAnomalyRecord,
  ): Promise<{ row: AnomalyRecord | null; error: Error | null }>;
  /** Recent anomalies for a server ordered by `created_at` desc (R7.4, R7.5). */
  listByServer(
    serverId: string,
    opts?: GetAnomaliesOptions,
  ): Promise<{ rows: AnomalyRecord[]; error: Error | null }>;
}

/* --- Supabase-backed store ------------------------------------------------ */

type PgError = { message: string };

interface SelectQuery<T> extends PromiseLike<{ data: T[] | null; error: PgError | null }> {
  eq(column: string, value: string | number | boolean): SelectQuery<T>;
  gte(column: string, value: string): SelectQuery<T>;
  order(column: string, opts: { ascending: boolean }): SelectQuery<T>;
  limit(count: number): SelectQuery<T>;
}
type SingleQuery<T> = PromiseLike<{ data: T | null; error: PgError | null }>;
interface InsertQuery<T> {
  select(columns?: string): { single(): SingleQuery<T> };
}
interface AnomalyTable<T> {
  select(columns?: string): SelectQuery<T>;
  insert(rows: ReadonlyArray<Partial<T>>): InsertQuery<T>;
}
/**
 * The narrow structural surface of the Supabase client this store relies on.
 * `anomaly_records` is not part of the generated `Database` type yet, so the
 * client is adapted at this single boundary rather than threaded through the
 * fully-typed `from(<known table>)` overloads (same approach as
 * `lib/prediction-accuracy.ts` / `lib/web-push.ts`).
 */
interface MinimalClient {
  from<T>(table: string): AnomalyTable<T>;
}

function toError(error: PgError | null): Error | null {
  return error ? new Error(error.message) : null;
}

/**
 * Build an {@link AnomalyStore} backed by a Supabase client. The caller supplies
 * the correct client for the operation: the service-role client for writes
 * ({@link recordAnomaly}), the normal browser/server client for reads
 * ({@link getAnomaliesForServer}).
 */
export function createSupabaseAnomalyStore(client: MinimalClient): AnomalyStore {
  const table = () => client.from<AnomalyRecord>(ANOMALY_RECORDS_TABLE);

  return {
    async findActiveByServerDirectionSince(serverId, direction, sinceIso) {
      const { data, error } = await table()
        .select('*')
        .eq('server_id', serverId)
        .eq('direction', direction)
        .eq('is_active', true)
        .gte('created_at', sinceIso)
        .limit(1);
      return { rows: data ?? [], error: toError(error) };
    },

    async insertAnomaly(row) {
      const { data, error } = await table()
        .insert([row as Partial<AnomalyRecord>])
        .select()
        .single();
      return { row: data ?? null, error: toError(error) };
    },

    async listByServer(serverId, opts) {
      let query = table().select('*').eq('server_id', serverId);
      if (opts?.activeOnly) {
        query = query.eq('is_active', true);
      }
      query = query.order('created_at', { ascending: false });
      if (typeof opts?.limit === 'number') {
        query = query.limit(opts.limit);
      }
      const { data, error } = await query;
      return { rows: data ?? [], error: toError(error) };
    },
  };
}

/** Read store: selects the client exactly as `lib/data.ts` does. */
function createDefaultReadStore(): AnomalyStore {
  const client = (typeof window !== 'undefined' ? supabase : createServerClient()) as unknown as MinimalClient;
  return createSupabaseAnomalyStore(client);
}

/** Write store: service-role client (server-side only, bypasses RLS). */
function createDefaultWriteStore(): AnomalyStore {
  const client = createServiceRoleClient() as unknown as MinimalClient;
  return createSupabaseAnomalyStore(client);
}

/* --- In-memory store (deterministic tests) -------------------------------- */

/**
 * Dependency-free {@link AnomalyStore} backed by a plain array, with identical
 * semantics to the Supabase store so it is a faithful stand-in for the
 * record-shape (Property 27) and dedup (Property 28) tests. New rows are
 * assigned an incrementing `id` and a `created_at` of "now" unless seeded.
 */
export class InMemoryAnomalyStore implements AnomalyStore {
  private rows: AnomalyRecord[] = [];
  private nextId: number;

  constructor(options?: { seed?: AnomalyRecord[]; startId?: number }) {
    if (options?.seed) {
      this.rows = options.seed.map((r) => ({ ...r }));
    }
    const maxSeededId = this.rows.reduce((max, r) => Math.max(max, r.id), 0);
    this.nextId = options?.startId ?? maxSeededId + 1;
  }

  /** Snapshot of all stored rows (test inspection only). */
  all(): AnomalyRecord[] {
    return this.rows.map((r) => ({ ...r }));
  }

  async findActiveByServerDirectionSince(
    serverId: string,
    direction: AnomalyDirection,
    sinceIso: string,
  ): Promise<{ rows: AnomalyRecord[]; error: Error | null }> {
    const sinceMs = parseTimeMs(sinceIso);
    const rows = this.rows
      .filter((r) => r.server_id === serverId && r.direction === direction && r.is_active)
      .filter((r) => {
        const createdMs = parseTimeMs(r.created_at);
        if (Number.isNaN(createdMs) || Number.isNaN(sinceMs)) return true;
        return createdMs >= sinceMs;
      })
      .map((r) => ({ ...r }));
    return { rows, error: null };
  }

  async insertAnomaly(
    row: NewAnomalyRecord,
  ): Promise<{ row: AnomalyRecord | null; error: Error | null }> {
    const created: AnomalyRecord = {
      id: this.nextId++,
      server_id: row.server_id,
      timestamp: row.timestamp,
      observed_value: row.observed_value,
      expected_value: row.expected_value,
      direction: row.direction,
      deviation_percent: row.deviation_percent,
      is_active: row.is_active,
      created_at: new Date().toISOString(),
    };
    this.rows.push(created);
    return { row: { ...created }, error: null };
  }

  async listByServer(
    serverId: string,
    opts?: GetAnomaliesOptions,
  ): Promise<{ rows: AnomalyRecord[]; error: Error | null }> {
    let rows = this.rows.filter((r) => r.server_id === serverId);
    if (opts?.activeOnly) {
      rows = rows.filter((r) => r.is_active);
    }
    rows = rows
      .slice()
      .sort((a, b) => parseTimeMs(b.created_at) - parseTimeMs(a.created_at));
    if (typeof opts?.limit === 'number') {
      rows = rows.slice(0, opts.limit);
    }
    return { rows: rows.map((r) => ({ ...r })), error: null };
  }
}

/* -------------------------------------------------------------------------- */
/* Config persistence (R7.7)                                                  */
/* -------------------------------------------------------------------------- */

/**
 * The persistence surface for the admin-adjustable anomaly thresholds (R7.7).
 * `read` returns the persisted override (or `null`/partial when unset); the
 * caller layers it over the monitoring-derived defaults. Injectable so the
 * config round-trip property test (task 8.6 / Property 29) can use the
 * in-memory fake instead of a live `system_settings` table.
 */
export interface AnomalyConfigStore {
  /** Read the persisted `anomaly_config` override, or `null` when unset. */
  read(): Promise<Partial<AnomalyConfig> | null>;
  /** Persist the full {@link AnomalyConfig}. */
  write(cfg: AnomalyConfig): Promise<void>;
}

/** Default config store backed by `system_settings` (`anomaly_config` key). */
function createDefaultConfigStore(): AnomalyConfigStore {
  return {
    async read() {
      const record = await getSystemSettingRecord(ANOMALY_CONFIG_KEY);
      if (!record?.value) return null;
      try {
        const parsed = JSON.parse(record.value) as Partial<AnomalyConfig>;
        return parsed && typeof parsed === 'object' ? parsed : null;
      } catch {
        return null;
      }
    },
    async write(cfg) {
      await upsertSystemSetting({
        key: ANOMALY_CONFIG_KEY,
        value: cfg as unknown as Record<string, unknown>,
        data_type: 'json',
        category: 'monitoring',
      });
    },
  };
}

/**
 * In-memory {@link AnomalyConfigStore} for deterministic tests (Property 29).
 * Holds a single persisted override that {@link write} replaces and
 * {@link read} returns.
 */
export class InMemoryAnomalyConfigStore implements AnomalyConfigStore {
  private stored: AnomalyConfig | null;

  constructor(seed?: AnomalyConfig | null) {
    this.stored = seed ? { ...seed } : null;
  }

  async read(): Promise<Partial<AnomalyConfig> | null> {
    return this.stored ? { ...this.stored } : null;
  }

  async write(cfg: AnomalyConfig): Promise<void> {
    this.stored = { ...cfg };
  }
}

/**
 * Resolve the monitoring-derived defaults for the anomaly config (R7.7).
 *
 * Reads the live monitoring config (`monitoring_config` system setting, falling
 * back to {@link DEFAULT_MONITORING_CONFIG}) and maps its anomaly fields onto an
 * {@link AnomalyConfig}, so admin changes to the monitoring thresholds flow
 * through as the anomaly detector's defaults.
 */
async function loadAnomalyDefaults(): Promise<AnomalyConfig> {
  try {
    const monitoring = await loadMonitoringConfig();
    return {
      thresholdPercent: monitoring.anomaly_threshold_percent,
      minChange: monitoring.anomaly_min_change,
      dedupWindowMinutes: monitoring.dedup_window_minutes,
    };
  } catch {
    return { ...DEFAULT_ANOMALY_CONFIG };
  }
}

/**
 * Load the effective anomaly detection config (R7.7).
 *
 * Defaults come from the monitoring config ({@link loadAnomalyDefaults}); any
 * persisted `anomaly_config` override is merged on top (a partial override only
 * replaces the fields it sets, mirroring how `loadMonitoringConfig` merges).
 * The result feeds {@link classifyPoint} (threshold/minChange) and
 * {@link recordAnomaly} (dedup window).
 *
 * @param options.defaults override the monitoring-derived defaults (tests).
 * @param options.store inject a config store (tests use
 *   {@link InMemoryAnomalyConfigStore}); defaults to the `system_settings` store.
 */
export async function loadAnomalyConfig(options?: {
  defaults?: AnomalyConfig;
  store?: AnomalyConfigStore;
}): Promise<AnomalyConfig> {
  const defaults = options?.defaults ?? (await loadAnomalyDefaults());
  const store = options?.store ?? createDefaultConfigStore();

  let override: Partial<AnomalyConfig> | null = null;
  try {
    override = await store.read();
  } catch (error) {
    console.error('Error loading anomaly config; using defaults:', error);
  }

  return { ...defaults, ...(override ?? {}) };
}

/**
 * Persist the admin-adjustable anomaly thresholds (R7.7, admin-only path).
 *
 * Writes the full {@link AnomalyConfig} to the `anomaly_config` system setting
 * (`data_type: 'json'`, `category: 'monitoring'`). After saving,
 * {@link loadAnomalyConfig} returns the saved values and any classification run
 * with the loaded config uses them (Property 29).
 *
 * @param options.store inject a config store (tests); defaults to the
 *   `system_settings` store.
 */
export async function saveAnomalyConfig(
  cfg: AnomalyConfig,
  options?: { store?: AnomalyConfigStore },
): Promise<void> {
  const store = options?.store ?? createDefaultConfigStore();
  await store.write(cfg);
}

/* -------------------------------------------------------------------------- */
/* Persistence / orchestration functions                                      */
/* -------------------------------------------------------------------------- */

/**
 * Record an anomaly, deduplicating within the configured window (R7.2, R7.3,
 * R7.6 / Properties 27, 28).
 *
 * BEFORE inserting, looks for an ACTIVE anomaly with the same
 * `(server_id, direction)` whose `created_at` falls within the dedup window
 * `[now - dedupWindowMinutes, now]`. If one exists the new anomaly is SUPPRESSED
 * (returns `{ recorded: false }`, no insert — R7.6). Otherwise it inserts a row
 * carrying the server id, timestamp, observed value, expected value, direction,
 * and deviation percent with `is_active = true` (Property 27) and returns
 * `{ recorded: true }`.
 *
 * The dedup window is taken from {@link options.dedupWindowMinutes} when given,
 * else from {@link options.config}, else from {@link loadAnomalyConfig}.
 *
 * @param options.store inject a store (tests use {@link InMemoryAnomalyStore});
 *   defaults to the service-role-backed write store.
 * @param options.now reference "now" ending the dedup window (defaults to
 *   `new Date()`; injectable for deterministic tests).
 */
export async function recordAnomaly(
  rec: RecordAnomalyInput,
  options?: {
    store?: AnomalyStore;
    config?: AnomalyConfig;
    dedupWindowMinutes?: number;
    now?: Date;
  },
): Promise<{ recorded: boolean }> {
  const store = options?.store ?? createDefaultWriteStore();
  const now = options?.now ?? new Date();

  const dedupWindowMinutes =
    options?.dedupWindowMinutes ??
    options?.config?.dedupWindowMinutes ??
    (await loadAnomalyConfig()).dedupWindowMinutes;

  const sinceIso = new Date(now.getTime() - dedupWindowMinutes * MS_PER_MINUTE).toISOString();

  // R7.6 — suppress when an active anomaly for the same (server, direction)
  // already exists within the window.
  const { rows: active, error: lookupError } = await store.findActiveByServerDirectionSince(
    rec.serverId,
    rec.direction,
    sinceIso,
  );
  if (lookupError) {
    console.error('Error checking for active anomaly during dedup:', lookupError);
    throw lookupError;
  }
  if (active.length > 0) {
    return { recorded: false };
  }

  const { error: insertError } = await store.insertAnomaly({
    server_id: rec.serverId,
    timestamp: rec.timestamp,
    observed_value: rec.observedValue,
    expected_value: rec.expectedValue,
    direction: rec.direction,
    deviation_percent: rec.deviationPercent,
    is_active: true,
  });

  if (insertError) {
    console.error('Error recording anomaly:', insertError);
    throw insertError;
  }

  return { recorded: true };
}

/**
 * Read recent anomalies for a server, most recent first (R7.4, R7.5).
 *
 * Used by the admin monitoring view (R7.4, always) and the flag-gated public
 * server surfaces (R7.5). Ordered by `created_at` desc; `opts.limit` caps the
 * count and `opts.activeOnly` restricts to currently-active anomalies. Returns
 * an empty array on a read error (logged like `lib/data.ts`).
 *
 * @param opts.store inject a store (tests); defaults to the read store
 *   (browser/server client).
 */
export async function getAnomaliesForServer(
  serverId: string,
  opts?: GetAnomaliesOptions & { store?: AnomalyStore },
): Promise<AnomalyRecord[]> {
  const store = opts?.store ?? createDefaultReadStore();
  const { rows, error } = await store.listByServer(serverId, {
    limit: opts?.limit,
    activeOnly: opts?.activeOnly,
  });
  if (error) {
    console.error('Error loading anomalies for server:', error);
    return [];
  }
  return rows;
}
