/**
 * Restart Prediction Accuracy Tracking (R6).
 *
 * `lib/restart-prediction.ts` computes predictions on demand and does NOT
 * persist them. R6 requires a recording mechanism: each prediction is snapshot
 * into `recorded_restart_predictions` (R6.1), detected restarts are matched
 * back against the most recent applicable recorded prediction (R6.2), and a
 * rolling 7-day accuracy metric is derived from the matched rows (R6.3, R6.6).
 *
 * Layering / migration safety (R9.1, R9.3)
 * ----------------------------------------
 * All database access routes through this `lib/` module. The
 * `recorded_restart_predictions` table is **service-role write / client read**
 * (see `api2db/sql/recorded_restart_predictions_schema.sql`):
 *   - WRITES (`recordPrediction`, the match update in `matchRestartToPrediction`)
 *     go through the service-role client (`createServiceRoleClient`) and run
 *     server-side only.
 *   - READS for the public predictions tab (`computeRollingAccuracy`,
 *     `getDisplayAccuracy`) select the client exactly as `lib/data.ts` does
 *     (`typeof window !== "undefined" ? supabase : createServerClient()`).
 *
 * Restart detection reuses `detectRestartEvents` from `lib/restart-prediction.ts`
 * rather than re-implementing a parallel detection path (R9.3). The
 * detection->match orchestration is primarily the job of the
 * `/api/cron/record-predictions` route (task 4.7); a small convenience helper
 * {@link matchDetectedRestarts} is exported here so that route (or a test) can
 * derive observed restart times from player-count data and match them in one
 * call.
 *
 * Testability
 * -----------
 * The persistence functions accept an optional {@link PredictionAccuracyStore}
 * so the property tests (tasks 4.3-4.6) can inject the deterministic
 * {@link InMemoryPredictionStore} instead of a live database. The pure helpers
 * ({@link accuracyWithinTolerance}, {@link rollingAccuracy},
 * {@link selectMostRecentApplicablePrediction}, {@link computeDifferenceMinutes})
 * perform no I/O and take all inputs (including `now`) as arguments.
 *
 * Conventions
 * -----------
 * - Sign of `difference_minutes`: **predicted minus observed**, so a POSITIVE
 *   value means the prediction was LATER than the actual restart (prediction
 *   ran late) and a NEGATIVE value means it was EARLIER (prediction ran early).
 *   See {@link computeDifferenceMinutes}.
 * - Rolling window is measured by `prediction_made_at` and defaults to
 *   {@link DEFAULT_ACCURACY_WINDOW_DAYS} (7 days, R6.3).
 * - Tolerance defaults to {@link DEFAULT_TOLERANCE_MINUTES}.
 */
import { supabase } from './supabase';
import { createServerClient } from './supabase-server';
import { createServiceRoleClient } from './supabase-service-role';
import type { PlayerCountData } from './data';
import { detectRestartEvents } from './restart-prediction';

/* -------------------------------------------------------------------------- */
/* Constants                                                                  */
/* -------------------------------------------------------------------------- */

/** Table backing this module (see the matching SQL schema). */
const RECORDED_PREDICTIONS_TABLE = 'recorded_restart_predictions';

/**
 * Default rolling-accuracy window in days (R6.3 specifies a rolling 7-day
 * window). The window is measured against each row's `prediction_made_at`.
 */
export const DEFAULT_ACCURACY_WINDOW_DAYS = 7;

/**
 * Default "defined tolerance" (R6.3): an observed restart counts as accurate
 * when it fell within +/- this many minutes of the predicted time. Restart
 * predictions are coarse (pattern-derived), so 10 minutes is a sensible default.
 */
export const DEFAULT_TOLERANCE_MINUTES = 10;

const MS_PER_MINUTE = 60_000;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

/* -------------------------------------------------------------------------- */
/* Row & I/O types                                                            */
/* -------------------------------------------------------------------------- */

/**
 * A persisted `recorded_restart_predictions` row. Mirrors the SQL schema
 * (client-agnostic so it stays expressible in both Supabase and Prisma, R9.2).
 * `observed_restart_time`, `difference_minutes`, and `matched_at` are `null`
 * until the prediction is matched to an observed restart (R6.2).
 */
export interface RecordedRestartPredictionRow {
  id: number;
  server_id: string;
  predicted_restart_time: string;
  confidence: number;
  prediction_made_at: string;
  observed_restart_time: string | null;
  difference_minutes: number | null;
  matched_at: string | null;
}

/** The insertable subset of a recorded prediction (the match columns start null). */
export interface NewRecordedPrediction {
  server_id: string;
  predicted_restart_time: string;
  confidence: number;
  prediction_made_at: string;
}

/** The columns written when a recorded prediction is matched to a restart (R6.2). */
export interface PredictionMatchPatch {
  observed_restart_time: string;
  difference_minutes: number;
  matched_at: string;
}

/** Input to {@link recordPrediction} (R6.1). */
export interface RecordPredictionInput {
  serverId: string;
  predictedRestartTime: string;
  confidence: number;
  /** Defaults to `new Date().toISOString()` when omitted. */
  predictionMadeAt?: string;
}

/** Result of a successful {@link matchRestartToPrediction} (R6.2). */
export interface MatchResult {
  predictionId: number;
  serverId: string;
  predictedRestartTime: string;
  observedRestartTime: string;
  /** Signed minutes, predicted minus observed (positive => prediction was late). */
  differenceMinutes: number;
  confidence: number;
}

/** A rolling-accuracy window descriptor (measured by `prediction_made_at`). */
export interface AccuracyWindow {
  windowDays: number;
}

/** Computed rolling-accuracy counts and proportion (R6.3). */
export interface RollingAccuracyStats {
  /** In-window rows that HAVE an observed restart (the denominator). */
  matchedInWindow: number;
  /** Of those, how many fell within tolerance (the numerator). */
  withinTolerance: number;
  /** `withinTolerance / matchedInWindow`, or `null` when the denominator is 0. */
  accuracy: number | null;
  windowDays: number;
  toleranceMinutes: number;
}

/** A resolvable rolling-accuracy metric (R6.3). `null` is represented by the caller. */
export interface AccuracyMetric {
  /** Proportion within tolerance, 0..1. */
  accuracy: number;
  /** Number of in-window matched predictions the proportion is based on. */
  sampleSize: number;
  windowDays: number;
  toleranceMinutes: number;
}

/**
 * Display-ready accuracy for the predictions tab (R6.4, R6.6). The
 * `{ available: false }` variant is the explicit "not yet available" state used
 * when no matched predictions exist in the window (NOT a misleading `0`).
 */
export type AccuracyDisplay =
  | { available: false }
  | {
      available: true;
      /** 0..1 proportion within tolerance. */
      accuracy: number;
      /** `accuracy` rendered as a 0..100 integer percent. */
      accuracyPercent: number;
      /** In-window matched-prediction count the metric is based on. */
      sampleSize: number;
      windowDays: number;
      /** Short window label, e.g. `"7d"`. */
      window: string;
      toleranceMinutes: number;
    };

/* -------------------------------------------------------------------------- */
/* Pure helpers (no I/O — directly unit/property testable)                    */
/* -------------------------------------------------------------------------- */

/** Parse an ISO timestamp to epoch ms (`NaN` when unparseable). */
function parseTimeMs(value: string): number {
  return Date.parse(value);
}

/**
 * Whether an observed restart fell within tolerance of its prediction (R6.3).
 *
 * Returns `true` exactly when `|diffMinutes| <= toleranceMinutes`. The bound is
 * INCLUSIVE: a difference exactly equal to the tolerance counts as accurate.
 */
export function accuracyWithinTolerance(diffMinutes: number, toleranceMinutes: number): boolean {
  return Math.abs(diffMinutes) <= toleranceMinutes;
}

/**
 * Signed difference, in whole minutes, between a predicted and an observed
 * restart time (R6.2).
 *
 * Sign convention (predicted - observed):
 *   - POSITIVE => the predicted time was LATER than the actual restart
 *     (the prediction ran late).
 *   - NEGATIVE => the predicted time was EARLIER than the actual restart
 *     (the prediction ran early).
 *   - 0        => exact.
 *
 * Rounded to an integer because the column is `integer`.
 */
export function computeDifferenceMinutes(
  predictedRestartTime: string,
  observedRestartTime: string,
): number {
  const predictedMs = parseTimeMs(predictedRestartTime);
  const observedMs = parseTimeMs(observedRestartTime);
  return Math.round((predictedMs - observedMs) / MS_PER_MINUTE);
}

/**
 * Select the most recent recorded prediction APPLICABLE to an observed restart
 * (R6.2 / Property 23).
 *
 * A recorded prediction is "applicable" to an observed restart for a server
 * when ALL of the following hold:
 *   1. its `server_id` matches `serverId`;
 *   2. it is not already matched (`observed_restart_time` and `matched_at` are
 *      both `null`); and
 *   3. it was made before (or at) the observed restart
 *      (`prediction_made_at <= observedRestartTime`).
 *
 * Among the applicable predictions the one with the LATEST `prediction_made_at`
 * is chosen ("most recent applicable"). Ties on `prediction_made_at` are broken
 * deterministically by the larger `id` (the more recently inserted row).
 *
 * Returns `null` when no applicable prediction exists — the caller then skips
 * the restart rather than recording a mismatch (R6.2).
 */
export function selectMostRecentApplicablePrediction(
  records: readonly RecordedRestartPredictionRow[],
  serverId: string,
  observedRestartTime: string,
): RecordedRestartPredictionRow | null {
  const observedMs = parseTimeMs(observedRestartTime);
  if (Number.isNaN(observedMs)) return null;

  let best: RecordedRestartPredictionRow | null = null;
  let bestMadeMs = Number.NEGATIVE_INFINITY;

  for (const record of records) {
    if (record.server_id !== serverId) continue;
    // Already matched predictions are not applicable.
    if (record.observed_restart_time !== null || record.matched_at !== null) continue;

    const madeMs = parseTimeMs(record.prediction_made_at);
    if (Number.isNaN(madeMs)) continue;
    // Must have been made before (or at) the observed restart.
    if (madeMs > observedMs) continue;

    if (
      best === null ||
      madeMs > bestMadeMs ||
      (madeMs === bestMadeMs && record.id > best.id)
    ) {
      best = record;
      bestMadeMs = madeMs;
    }
  }

  return best;
}

/**
 * Compute rolling-accuracy counts over a window ending at `now` (R6.3 /
 * Property 24).
 *
 * "In-window" means `prediction_made_at` lies within
 * `[now - windowDays, now]` (both ends inclusive). Of the in-window rows:
 *   - the DENOMINATOR (`matchedInWindow`) counts rows that HAVE an observed
 *     restart (both `observed_restart_time` and `difference_minutes` non-null);
 *     rows with no observed restart are excluded from BOTH counts;
 *   - the NUMERATOR (`withinTolerance`) counts those whose `difference_minutes`
 *     is within tolerance per {@link accuracyWithinTolerance}.
 *
 * `accuracy` is `withinTolerance / matchedInWindow`, or `null` when the
 * denominator is 0 (which drives the "not yet available" state, R6.6).
 */
export function rollingAccuracyStats(
  records: readonly RecordedRestartPredictionRow[],
  now: Date,
  window: AccuracyWindow,
  toleranceMinutes: number,
): RollingAccuracyStats {
  const nowMs = now.getTime();
  const windowStartMs = nowMs - window.windowDays * MS_PER_DAY;

  let matchedInWindow = 0;
  let withinTolerance = 0;

  for (const record of records) {
    const madeMs = parseTimeMs(record.prediction_made_at);
    if (Number.isNaN(madeMs)) continue;
    // In-window by prediction_made_at (inclusive on both ends).
    if (madeMs < windowStartMs || madeMs > nowMs) continue;
    // Only rows with an observed restart participate in either count.
    if (record.observed_restart_time === null || record.difference_minutes === null) continue;

    matchedInWindow += 1;
    if (accuracyWithinTolerance(record.difference_minutes, toleranceMinutes)) {
      withinTolerance += 1;
    }
  }

  return {
    matchedInWindow,
    withinTolerance,
    accuracy: matchedInWindow === 0 ? null : withinTolerance / matchedInWindow,
    windowDays: window.windowDays,
    toleranceMinutes,
  };
}

/**
 * The within-tolerance proportion over the rolling window (R6.3 / Property 24).
 *
 * Equals (in-window predictions whose observed restart fell within tolerance) /
 * (in-window predictions that HAVE an observed restart). Returns `null` when
 * the denominator is 0, never `0` in that case (R6.6). Otherwise returns a
 * value in `[0, 1]`.
 */
export function rollingAccuracy(
  records: readonly RecordedRestartPredictionRow[],
  now: Date,
  window: AccuracyWindow,
  toleranceMinutes: number,
): number | null {
  return rollingAccuracyStats(records, now, window, toleranceMinutes).accuracy;
}

/* -------------------------------------------------------------------------- */
/* Data-access store (injectable for tests)                                   */
/* -------------------------------------------------------------------------- */

/** `{ row|rows, error }` envelopes mirroring the existing `lib/` convention. */
export interface PredictionAccuracyStore {
  /** Insert a new recorded prediction (R6.1). */
  insertPrediction(
    row: NewRecordedPrediction,
  ): Promise<{ row: RecordedRestartPredictionRow | null; error: Error | null }>;
  /** All recorded predictions for a server (filtering is done in the pure helper). */
  listServerPredictions(
    serverId: string,
  ): Promise<{ rows: RecordedRestartPredictionRow[]; error: Error | null }>;
  /** Apply a match patch to a single recorded prediction by id (R6.2). */
  updatePredictionMatch(
    id: number,
    patch: PredictionMatchPatch,
  ): Promise<{ row: RecordedRestartPredictionRow | null; error: Error | null }>;
  /** All recorded predictions whose `prediction_made_at >= sinceIso` (window scan). */
  listPredictionsSince(
    sinceIso: string,
  ): Promise<{ rows: RecordedRestartPredictionRow[]; error: Error | null }>;
}

/* --- Supabase-backed store ------------------------------------------------ */

type PgError = { message: string };

interface SelectQuery<T> extends PromiseLike<{ data: T[] | null; error: PgError | null }> {
  eq(column: string, value: string | number): SelectQuery<T>;
  gte(column: string, value: string): SelectQuery<T>;
  order(column: string, opts: { ascending: boolean }): SelectQuery<T>;
}
type SingleQuery<T> = PromiseLike<{ data: T | null; error: PgError | null }>;
interface UpdateQuery<T> {
  eq(column: string, value: string | number): UpdateQuery<T>;
  select(columns?: string): { single(): SingleQuery<T> };
}
interface InsertQuery<T> {
  select(columns?: string): { single(): SingleQuery<T> };
}
interface PredictionTable<T> {
  select(columns?: string): SelectQuery<T>;
  insert(rows: ReadonlyArray<Partial<T>>): InsertQuery<T>;
  update(patch: Partial<T>): UpdateQuery<T>;
}
/**
 * The narrow structural surface of the Supabase client this store relies on.
 * `recorded_restart_predictions` is not part of the generated `Database` type
 * yet, so the client is adapted at this single boundary rather than threaded
 * through the fully-typed `from(<known table>)` overloads (same approach as
 * `lib/owner-scoped.ts`).
 */
interface MinimalClient {
  from<T>(table: string): PredictionTable<T>;
}

function toError(error: PgError | null): Error | null {
  return error ? new Error(error.message) : null;
}

/**
 * Build a {@link PredictionAccuracyStore} backed by a Supabase client. The
 * caller supplies the correct client for the operation: the service-role client
 * for writes, the normal browser/server client for reads.
 */
export function createSupabasePredictionStore(client: MinimalClient): PredictionAccuracyStore {
  const table = () => client.from<RecordedRestartPredictionRow>(RECORDED_PREDICTIONS_TABLE);

  return {
    async insertPrediction(row) {
      const { data, error } = await table().insert([row as Partial<RecordedRestartPredictionRow>])
        .select()
        .single();
      return { row: data ?? null, error: toError(error) };
    },

    async listServerPredictions(serverId) {
      const { data, error } = await table()
        .select('*')
        .eq('server_id', serverId)
        .order('prediction_made_at', { ascending: false });
      return { rows: data ?? [], error: toError(error) };
    },

    async updatePredictionMatch(id, patch) {
      const { data, error } = await table()
        .update(patch as Partial<RecordedRestartPredictionRow>)
        .eq('id', id)
        .select()
        .single();
      return { row: data ?? null, error: toError(error) };
    },

    async listPredictionsSince(sinceIso) {
      const { data, error } = await table()
        .select('*')
        .gte('prediction_made_at', sinceIso)
        .order('prediction_made_at', { ascending: false });
      return { rows: data ?? [], error: toError(error) };
    },
  };
}

/** Read store: selects the client exactly as `lib/data.ts` does. */
function createDefaultReadStore(): PredictionAccuracyStore {
  const client = (typeof window !== 'undefined' ? supabase : createServerClient()) as unknown as MinimalClient;
  return createSupabasePredictionStore(client);
}

/** Write store: service-role client (server-side only, bypasses RLS). */
function createDefaultWriteStore(): PredictionAccuracyStore {
  const client = createServiceRoleClient() as unknown as MinimalClient;
  return createSupabasePredictionStore(client);
}

/* --- In-memory store (deterministic tests) -------------------------------- */

/**
 * Dependency-free {@link PredictionAccuracyStore} backed by a plain array, with
 * identical semantics to the Supabase store so it is a faithful stand-in for
 * the persistence round-trip / matching property tests (tasks 4.3-4.4). New
 * rows start with `observed_restart_time`, `difference_minutes`, and
 * `matched_at` set to `null`, exactly as the table defaults them.
 */
export class InMemoryPredictionStore implements PredictionAccuracyStore {
  private rows: RecordedRestartPredictionRow[] = [];
  private nextId: number;

  constructor(options?: { seed?: RecordedRestartPredictionRow[]; startId?: number }) {
    if (options?.seed) {
      this.rows = options.seed.map((r) => ({ ...r }));
    }
    const maxSeededId = this.rows.reduce((max, r) => Math.max(max, r.id), 0);
    this.nextId = options?.startId ?? maxSeededId + 1;
  }

  /** Snapshot of all stored rows (test inspection only). */
  all(): RecordedRestartPredictionRow[] {
    return this.rows.map((r) => ({ ...r }));
  }

  async insertPrediction(
    row: NewRecordedPrediction,
  ): Promise<{ row: RecordedRestartPredictionRow | null; error: Error | null }> {
    const created: RecordedRestartPredictionRow = {
      id: this.nextId++,
      server_id: row.server_id,
      predicted_restart_time: row.predicted_restart_time,
      confidence: row.confidence,
      prediction_made_at: row.prediction_made_at,
      observed_restart_time: null,
      difference_minutes: null,
      matched_at: null,
    };
    this.rows.push(created);
    return { row: { ...created }, error: null };
  }

  async listServerPredictions(
    serverId: string,
  ): Promise<{ rows: RecordedRestartPredictionRow[]; error: Error | null }> {
    const rows = this.rows.filter((r) => r.server_id === serverId).map((r) => ({ ...r }));
    return { rows, error: null };
  }

  async updatePredictionMatch(
    id: number,
    patch: PredictionMatchPatch,
  ): Promise<{ row: RecordedRestartPredictionRow | null; error: Error | null }> {
    let updated: RecordedRestartPredictionRow | null = null;
    this.rows = this.rows.map((r) => {
      if (r.id !== id) return r;
      const next = { ...r, ...patch };
      updated = { ...next };
      return next;
    });
    return { row: updated, error: null };
  }

  async listPredictionsSince(
    sinceIso: string,
  ): Promise<{ rows: RecordedRestartPredictionRow[]; error: Error | null }> {
    const sinceMs = parseTimeMs(sinceIso);
    const rows = this.rows
      .filter((r) => {
        const madeMs = parseTimeMs(r.prediction_made_at);
        return Number.isNaN(madeMs) || Number.isNaN(sinceMs) ? true : madeMs >= sinceMs;
      })
      .map((r) => ({ ...r }));
    return { rows, error: null };
  }
}

/* -------------------------------------------------------------------------- */
/* Persistence / orchestration functions                                      */
/* -------------------------------------------------------------------------- */

/**
 * Record a restart prediction snapshot (R6.1 / Property 22).
 *
 * Inserts a row carrying `predicted_restart_time`, `confidence`, and
 * `prediction_made_at` (defaulting to now) via the service-role client, so
 * reading the row back returns those same three values. Writes only — the match
 * columns start `null`.
 *
 * @param p the prediction to record.
 * @param options.store inject a store (tests use {@link InMemoryPredictionStore});
 *   defaults to the service-role-backed store.
 */
export async function recordPrediction(
  p: RecordPredictionInput,
  options?: { store?: PredictionAccuracyStore },
): Promise<void> {
  const store = options?.store ?? createDefaultWriteStore();
  const predictionMadeAt = p.predictionMadeAt ?? new Date().toISOString();

  const { error } = await store.insertPrediction({
    server_id: p.serverId,
    predicted_restart_time: p.predictedRestartTime,
    confidence: p.confidence,
    prediction_made_at: predictionMadeAt,
  });

  if (error) {
    console.error('Error recording restart prediction:', error);
    throw error;
  }
}

/**
 * Match an observed restart to the most recent applicable recorded prediction
 * and persist the signed difference (R6.2 / Property 23).
 *
 * Loads the server's recorded predictions, picks the most-recent-applicable one
 * via {@link selectMostRecentApplicablePrediction}, computes the signed
 * `difference_minutes` (predicted - observed), and updates that row
 * (`observed_restart_time`, `difference_minutes`, `matched_at = now`) through
 * the service-role client.
 *
 * Returns the {@link MatchResult}, or `null` when no applicable prediction
 * exists (the restart is skipped, never mismatched — R6.2).
 *
 * @param options.matchedAt override the match timestamp (defaults to now).
 * @param options.store inject a store (defaults to the service-role-backed store).
 */
export async function matchRestartToPrediction(
  serverId: string,
  observedRestartTime: string,
  options?: { store?: PredictionAccuracyStore; matchedAt?: string },
): Promise<MatchResult | null> {
  const store = options?.store ?? createDefaultWriteStore();

  const { rows, error } = await store.listServerPredictions(serverId);
  if (error) {
    console.error('Error loading recorded predictions for match:', error);
    return null;
  }

  const selected = selectMostRecentApplicablePrediction(rows, serverId, observedRestartTime);
  if (!selected) return null;

  const differenceMinutes = computeDifferenceMinutes(
    selected.predicted_restart_time,
    observedRestartTime,
  );
  const matchedAt = options?.matchedAt ?? new Date().toISOString();

  const { row: updated, error: updateError } = await store.updatePredictionMatch(selected.id, {
    observed_restart_time: observedRestartTime,
    difference_minutes: differenceMinutes,
    matched_at: matchedAt,
  });

  if (updateError || !updated) {
    console.error('Error persisting restart match:', updateError);
    return null;
  }

  return {
    predictionId: selected.id,
    serverId,
    predictedRestartTime: selected.predicted_restart_time,
    observedRestartTime,
    differenceMinutes,
    confidence: selected.confidence,
  };
}

/**
 * Convenience helper: derive observed restart times for a server from
 * player-count data using `detectRestartEvents` (reused from
 * `lib/restart-prediction.ts`, R9.3) and match each detected restart.
 *
 * Restarts are matched in chronological order so that each consumes a distinct
 * prediction (a row matched by an earlier event is excluded from later
 * selections). The primary orchestrator is `/api/cron/record-predictions`
 * (task 4.7); this helper just keeps the detection->match glue in the data
 * layer for that route and for tests.
 *
 * @returns the matches that were recorded (events with no applicable
 *   prediction are skipped).
 */
export async function matchDetectedRestarts(
  serverId: string,
  playerData: PlayerCountData[],
  options?: { store?: PredictionAccuracyStore; matchedAt?: string },
): Promise<MatchResult[]> {
  const serverData = playerData.filter((point) => point.server_id === serverId);
  const events = detectRestartEvents(serverData);

  const results: MatchResult[] = [];
  for (const event of events) {
    const match = await matchRestartToPrediction(serverId, event.timestamp, options);
    if (match) results.push(match);
  }
  return results;
}

/**
 * Compute the rolling-window accuracy metric (R6.3, R6.6).
 *
 * Reads recorded predictions made within the window (`prediction_made_at >=
 * now - windowDays`) and applies the pure {@link rollingAccuracyStats}. Returns
 * `null` when no in-window prediction has an observed restart (the "not yet
 * available" condition), otherwise an {@link AccuracyMetric}.
 *
 * @param options.windowDays defaults to {@link DEFAULT_ACCURACY_WINDOW_DAYS}.
 * @param options.toleranceMinutes defaults to {@link DEFAULT_TOLERANCE_MINUTES}.
 * @param options.now defaults to `new Date()` (injectable for tests).
 * @param options.store defaults to the read store (browser/server client).
 */
export async function computeRollingAccuracy(options?: {
  windowDays?: number;
  toleranceMinutes?: number;
  now?: Date;
  store?: PredictionAccuracyStore;
}): Promise<AccuracyMetric | null> {
  const windowDays = options?.windowDays ?? DEFAULT_ACCURACY_WINDOW_DAYS;
  const toleranceMinutes = options?.toleranceMinutes ?? DEFAULT_TOLERANCE_MINUTES;
  const now = options?.now ?? new Date();
  const store = options?.store ?? createDefaultReadStore();

  const sinceIso = new Date(now.getTime() - windowDays * MS_PER_DAY).toISOString();
  const { rows, error } = await store.listPredictionsSince(sinceIso);
  if (error) {
    console.error('Error loading recorded predictions for accuracy:', error);
    return null;
  }

  const stats = rollingAccuracyStats(rows, now, { windowDays }, toleranceMinutes);
  if (stats.accuracy === null) return null;

  return {
    accuracy: stats.accuracy,
    sampleSize: stats.matchedInWindow,
    windowDays,
    toleranceMinutes,
  };
}

/**
 * Display-ready rolling accuracy for the predictions tab (R6.4, R6.6 /
 * Property 25).
 *
 * Returns the explicit `{ available: false }` "not yet available" state when no
 * matched predictions exist in the window (never a misleading `0`); otherwise
 * returns the proportion plus a rounded percent and sample size. Accepts the
 * same options as {@link computeRollingAccuracy}.
 */
export async function getDisplayAccuracy(options?: {
  windowDays?: number;
  toleranceMinutes?: number;
  now?: Date;
  store?: PredictionAccuracyStore;
}): Promise<AccuracyDisplay> {
  const metric = await computeRollingAccuracy(options);
  if (metric === null) {
    return { available: false };
  }

  return {
    available: true,
    accuracy: metric.accuracy,
    accuracyPercent: Math.round(metric.accuracy * 100),
    sampleSize: metric.sampleSize,
    windowDays: metric.windowDays,
    window: `${metric.windowDays}d`,
    toleranceMinutes: metric.toleranceMinutes,
  };
}
