/**
 * Capacity and Queue Insights — "best time to join" advisor (R8).
 *
 * Produces a recommended weekly join window for a server from its historical
 * player-count series and server-capacity series (R8.1, R8.2), optionally
 * biased away from high-queue times when queue history is available (R8.3),
 * presented in the viewer's local time zone (R8.4), with an explicit
 * "not yet available" state for sparse data (R8.5) and a currently-full /
 * near-full indicator (R8.6).
 *
 * Layering / migration safety (R9.1, R9.3)
 * ----------------------------------------
 * The recommendation math lives entirely in PURE functions that take their
 * data (and `now`) as arguments, so they run with no I/O and are deterministic
 * for property testing. The single async convenience ({@link getJoinRecommendation})
 * reuses the EXISTING data-access functions `getPlayerCounts` /
 * `getServerCapacities` (R9.3 — no parallel query path) and
 * `hasQueueSupport` / `getQueueConfig` from `lib/server-queues.ts`; it never
 * opens its own database client.
 *
 * Queue history note
 * ------------------
 * Queue data is fetched LIVE today (see `lib/server-queues.ts` /
 * `app/api/live/queue`); there is no persisted `queue_history` table yet
 * (optionally added by task 5.9). Consequently {@link getJoinRecommendation}
 * currently has no `queueSeries` to pass and the advisor DEGRADES GRACEFULLY to
 * capacity + player-count only. The pure {@link computeJoinWindow} fully
 * supports a `queueSeries` for when that history exists (R8.3); when it is
 * absent or empty the result equals the queue-free computation.
 *
 * Algorithm (see {@link computeJoinWindow})
 * -----------------------------------------
 * 1. Filter player/capacity/queue points to the rolling analysis window
 *    `[now - analysisWindowDays, now]` (at least 7 days, R8.2 — Property 30).
 * 2. Bucket points by HOUR-OF-WEEK (0..167 = `utcDayOfWeek * 24 + utcHour`).
 * 3. Per bucket compute mean occupancy ratio = meanPlayers / meanCapacity,
 *    guarding divide-by-zero (a global mean-capacity fallback covers buckets
 *    that have player data but no capacity sample).
 * 4. Add a non-negative queue penalty (monotonic in mean queue length) to each
 *    bucket's score so high-queue buckets become less attractive (Property 31).
 * 5. Select the lowest-score contiguous run of hour-of-week buckets and return
 *    it in UTC; {@link formatRecommendationLocal} localizes it for display.
 */
import type { PlayerCountData, ServerCapacityData, TimeRange } from './data';
import { getPlayerCounts, getServerCapacities } from './data';
import { getQueueConfig, hasQueueSupport } from './server-queues';

/* -------------------------------------------------------------------------- */
/* Constants                                                                  */
/* -------------------------------------------------------------------------- */

/** Hours in a week — the number of hour-of-week buckets (0..167). */
export const HOURS_PER_WEEK = 168;

/**
 * Minimum rolling analysis window (R8.2 requires "at least 7 days"). A caller
 * may request a longer window, but {@link computeJoinWindow} clamps any shorter
 * request up to this value so the recommendation is always derived from at
 * least seven days of history.
 */
export const DEFAULT_ANALYSIS_WINDOW_DAYS = 7;

/**
 * Default "near full" occupancy ratio (R8.6). A server whose latest
 * `players / capacity` is at or above this fraction is reported as currently
 * full / near-full. 0.9 == 90%.
 */
export const DEFAULT_NEAR_FULL_THRESHOLD = 0.9;

/**
 * Preferred recommended-window length, in whole hour-of-week buckets. The
 * advisor picks the lowest-occupancy contiguous run of this many hours when one
 * exists, shrinking toward a single hour when the valid buckets are too
 * scattered to form a longer run.
 */
export const RECOMMENDATION_WINDOW_HOURS = 3;

/**
 * Weight applied to the (capacity-normalized) mean queue length when penalizing
 * a bucket's score (R8.3). The penalty is `weight * meanQueue / globalMeanCapacity`,
 * which is non-negative and strictly increasing in mean queue length with the
 * SAME coefficient for every bucket — the key to the monotonicity guarantee
 * (Property 31). See {@link computeJoinWindow} for the proof sketch.
 */
export const DEFAULT_QUEUE_PENALTY_WEIGHT = 1;

/* --- Sparsity threshold (R8.5 / Property 33) ------------------------------ */
/*
 * A recommendation is produced only when ALL of the following hold for the data
 * inside the analysis window. Falling below ANY of them yields the explicit
 * `{ available: false }` "not yet available" state rather than a fabricated
 * window. These constants ARE the documented sparsity threshold.
 */

/** Minimum number of in-window player-count points required. */
export const MIN_PLAYER_POINTS = 24;

/** Minimum number of in-window capacity points required (R8.5: needs capacity data at all). */
export const MIN_CAPACITY_POINTS = 1;

/**
 * Minimum number of distinct hour-of-week buckets that must have a computable
 * occupancy ratio (player data + a usable capacity value). Below this the
 * weekly picture is too sparse to recommend a window.
 */
export const MIN_OCCUPIED_BUCKETS = 6;

/** Default time range used by {@link getJoinRecommendation} (covers >= 7 days, R8.2). */
export const DEFAULT_RECOMMENDATION_TIME_RANGE: TimeRange = '30d';

const MS_PER_HOUR = 60 * 60 * 1000;
const MS_PER_DAY = 24 * MS_PER_HOUR;

/** Short weekday labels indexed by UTC day-of-week (0 = Sunday .. 6 = Saturday). */
export const WEEKDAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;

/* -------------------------------------------------------------------------- */
/* Types                                                                      */
/* -------------------------------------------------------------------------- */

/**
 * An optional historical queue sample (R8.3). Queue data is fetched live today
 * and not yet persisted, so this type describes the shape a future
 * `queue_history` capture (task 5.9) would feed into the advisor.
 */
export interface QueueHistoryPoint {
  timestamp: string;
  server_id: string;
  queue_length: number;
  total_players?: number;
}

/** Input to {@link computeJoinWindow}. */
export interface ComputeJoinWindowInput {
  /** Player-count series, typically from `getPlayerCounts` (R9.3). */
  playerSeries: PlayerCountData[];
  /** Server-capacity series, typically from `getServerCapacities` (R9.3). */
  capacitySeries: ServerCapacityData[];
  /** Optional queue history; when present biases the window away from high-queue times (R8.3). */
  queueSeries?: QueueHistoryPoint[];
  /** Rolling analysis window in days; clamped up to {@link DEFAULT_ANALYSIS_WINDOW_DAYS} (R8.2). */
  analysisWindowDays: number;
  /**
   * Reference "now" ending the rolling window. Defaults to `new Date()`, but
   * the pure core accepts it explicitly so property tests are deterministic.
   */
  now?: Date;
  /** Queue penalty weight; defaults to {@link DEFAULT_QUEUE_PENALTY_WEIGHT}. */
  queuePenaltyWeight?: number;
  /** Preferred window length in hours; defaults to {@link RECOMMENDATION_WINDOW_HOURS}. */
  windowHours?: number;
  /** Latest observed player count; when paired with {@link latestCapacity} sets `currentlyFull` (R8.6). */
  latestPlayers?: number;
  /** Latest observed capacity; when paired with {@link latestPlayers} sets `currentlyFull` (R8.6). */
  latestCapacity?: number;
  /** Near-full threshold for `currentlyFull`; defaults to {@link DEFAULT_NEAR_FULL_THRESHOLD}. */
  nearFullThreshold?: number;
}

/**
 * A recommended weekly join window, expressed in UTC hour-of-week coordinates
 * (0..167 = `utcDayOfWeek * 24 + utcHour`). It describes a RECURRING weekly
 * window — `formatRecommendationLocal` resolves it to a concrete localized
 * instant for display (R8.4).
 */
export interface JoinRecommendation {
  available: true;
  /** Inclusive start bucket, 0..167 (UTC hour-of-week). */
  startHourOfWeek: number;
  /** Inclusive end bucket, 0..167 (UTC hour-of-week); may wrap past 167. */
  endHourOfWeek: number;
  /** Number of hour buckets in the window (>= 1). */
  windowHours: number;
  /** Mean occupancy ratio (players / capacity) over the selected window. */
  occupancyRatio: number;
  /** The minimized score (occupancy + queue penalty) for the selected window. */
  score: number;
  /** Mean queue length over the selected window (0 when no queue data participated). */
  meanQueueLength: number;
  /** Whether queue history participated in the scoring (R8.3). */
  queuePenaltyApplied: boolean;
  /** Effective analysis window actually used, in days (>= 7). */
  analysisWindowDays: number;
  /** Number of valid candidate buckets considered. */
  sampleBucketCount: number;
  /** Currently full / near-full indicator (R8.6), present when latest values were supplied. */
  currentlyFull?: boolean;
}

/** The explicit "recommendation not yet available" state (R8.5 / Property 33). */
export interface RecommendationUnavailable {
  available: false;
}

/** Result of {@link computeJoinWindow}: a recommendation or the unavailable state. */
export type JoinRecommendationResult = JoinRecommendation | RecommendationUnavailable;

/** Wall-clock parts of an instant rendered in a specific IANA time zone. */
export interface ZonedDateParts {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
}

/**
 * A {@link JoinRecommendation} resolved to a concrete instant and localized for
 * display in a target IANA time zone (R8.4 / Property 32).
 *
 * The round-trip anchor is {@link startInstantUtc} / {@link endInstantUtc}: the
 * localized strings are presentation only and never used to reconstruct the
 * instant, so the localized window always denotes the SAME moment as the
 * original UTC instant. Use {@link localizedToUtc} (or `utcToZonedParts` /
 * `zonedPartsToUtc`) for the explicit conversions.
 */
export interface LocalizedRecommendation {
  /** The IANA time zone the window was localized to. */
  timeZone: string;
  /** Canonical UTC ISO instant of the window start (round-trip anchor). */
  startInstantUtc: string;
  /** Canonical UTC ISO instant of the window end (round-trip anchor). */
  endInstantUtc: string;
  /** Localized display string for the window start (e.g. "Mon, 2:00 AM"). */
  startLocal: string;
  /** Localized display string for the window end. */
  endLocal: string;
  /** Combined human-friendly label, e.g. "Mon 2:00 AM – 5:00 AM". */
  label: string;
  /** Number of hour buckets in the window. */
  windowHours: number;
  /** Mean occupancy ratio carried through from the recommendation. */
  occupancyRatio: number;
  /** Currently full / near-full indicator carried through (R8.6). */
  currentlyFull?: boolean;
}

/* -------------------------------------------------------------------------- */
/* Pure helpers — hour-of-week bucketing & occupancy                          */
/* -------------------------------------------------------------------------- */

/** Parse an ISO timestamp to epoch ms (`NaN` when unparseable). */
function parseTimeMs(value: string): number {
  return Date.parse(value);
}

/**
 * Hour-of-week bucket index (0..167) for an instant, computed in UTC so the
 * bucketing is independent of the running machine's local zone. The bucket is
 * `utcDayOfWeek * 24 + utcHour` where day-of-week is 0 (Sunday)..6 (Saturday).
 */
export function hourOfWeekUTC(date: Date): number {
  const dayOfWeek = date.getUTCDay(); // 0..6
  const hour = date.getUTCHours(); // 0..23
  return dayOfWeek * 24 + hour;
}

/** Split an hour-of-week bucket into its `{ dayOfWeek, hour }` parts. */
export function splitHourOfWeek(hourOfWeek: number): { dayOfWeek: number; hour: number } {
  const normalized = ((hourOfWeek % HOURS_PER_WEEK) + HOURS_PER_WEEK) % HOURS_PER_WEEK;
  return { dayOfWeek: Math.floor(normalized / 24), hour: normalized % 24 };
}

/** Mean of a non-empty number array; `null` for an empty array. */
function meanOrNull(values: readonly number[]): number | null {
  if (values.length === 0) return null;
  let sum = 0;
  for (const v of values) sum += v;
  return sum / values.length;
}

/**
 * Per-hour-of-week aggregates derived from the windowed data. Exposed for
 * testing/inspection; {@link computeJoinWindow} builds and consumes this.
 */
export interface BucketStats {
  hourOfWeek: number;
  meanPlayers: number;
  meanCapacity: number | null;
  meanQueue: number;
  /** Occupancy ratio (meanPlayers / effective capacity), or `null` when uncomputable. */
  occupancyRatio: number | null;
}

/**
 * Filter a timestamped series to the rolling window `[now - windowDays, now]`
 * (inclusive on both ends). Points with unparseable timestamps are dropped.
 * This is the mechanism that makes the recommendation depend ONLY on in-window
 * data (R8.2 / Property 30).
 */
export function filterToWindow<T extends { timestamp: string }>(
  series: readonly T[],
  now: Date,
  windowDays: number,
): T[] {
  const nowMs = now.getTime();
  const startMs = nowMs - windowDays * MS_PER_DAY;
  return series.filter((point) => {
    const ms = parseTimeMs(point.timestamp);
    if (Number.isNaN(ms)) return false;
    return ms >= startMs && ms <= nowMs;
  });
}

/* -------------------------------------------------------------------------- */
/* Pure core — computeJoinWindow (R8.1, R8.2, R8.3, R8.5)                      */
/* -------------------------------------------------------------------------- */

/**
 * Compute the recommended weekly join window from historical data (R8.1, R8.2,
 * R8.3, R8.5 — Properties 30, 31, 33).
 *
 * The recommendation is derived ONLY from data inside the rolling analysis
 * window `[now - analysisWindowDays, now]`, where `analysisWindowDays` is
 * clamped up to {@link DEFAULT_ANALYSIS_WINDOW_DAYS} (>= 7, R8.2). Points are
 * bucketed by UTC hour-of-week; each bucket's occupancy ratio is
 * `meanPlayers / meanCapacity` (a global mean-capacity fallback covers buckets
 * with player data but no capacity sample), guarding divide-by-zero.
 *
 * Queue penalty / monotonicity (R8.3 — Property 31)
 * -------------------------------------------------
 * Each bucket's selection SCORE is `occupancyRatio + penalty(bucket)` where
 *   `penalty(bucket) = weight * meanQueue(bucket) / globalMeanCapacity`,
 * with `weight >= 0`. This penalty is:
 *   (a) non-negative, so it never makes a bucket MORE attractive than its
 *       queue-free score; and
 *   (b) a non-decreasing function of the bucket's mean queue length applied
 *       with the SAME coefficient to every bucket.
 * Therefore adding queue data can only ever RAISE a high-queue bucket's score
 * relative to a low-queue bucket's score, never the reverse — the recommended
 * window is never moved toward a higher-queue bucket compared with the
 * queue-free recommendation. When `queueSeries` is absent or empty, every
 * `meanQueue` is 0, every penalty is 0, and the result equals the queue-free
 * computation exactly.
 *
 * Sparsity (R8.5 — Property 33)
 * -----------------------------
 * Returns `{ available: false }` when the in-window data falls below the
 * documented sparsity threshold ({@link MIN_PLAYER_POINTS},
 * {@link MIN_CAPACITY_POINTS}, {@link MIN_OCCUPIED_BUCKETS}) rather than
 * fabricating a window.
 *
 * The returned window is in UTC hour-of-week coordinates;
 * {@link formatRecommendationLocal} localizes it for display (R8.4).
 */
export function computeJoinWindow(input: ComputeJoinWindowInput): JoinRecommendationResult {
  const now = input.now ?? new Date();
  const analysisWindowDays = Math.max(input.analysisWindowDays, DEFAULT_ANALYSIS_WINDOW_DAYS);
  const queuePenaltyWeight = input.queuePenaltyWeight ?? DEFAULT_QUEUE_PENALTY_WEIGHT;
  const windowHours = Math.max(1, Math.floor(input.windowHours ?? RECOMMENDATION_WINDOW_HOURS));

  // 1. Restrict every series to the rolling analysis window (Property 30).
  const players = filterToWindow(input.playerSeries, now, analysisWindowDays);
  const capacities = filterToWindow(input.capacitySeries, now, analysisWindowDays);
  const queues = filterToWindow(input.queueSeries ?? [], now, analysisWindowDays);

  // 2. Sparsity gate (Property 33) — bail before fabricating anything.
  if (players.length < MIN_PLAYER_POINTS || capacities.length < MIN_CAPACITY_POINTS) {
    return { available: false };
  }

  // Global mean capacity is the divide-by-zero-safe fallback for buckets that
  // have player samples but no capacity sample, and the normalizer for the
  // queue penalty so its units match the occupancy ratio.
  const globalMeanCapacity = meanOrNull(capacities.map((c) => c.max_capacity));
  if (globalMeanCapacity === null || globalMeanCapacity <= 0) {
    return { available: false };
  }

  // 3. Accumulate per-hour-of-week sums.
  const playerByBucket = new Map<number, number[]>();
  const capacityByBucket = new Map<number, number[]>();
  const queueByBucket = new Map<number, number[]>();

  const pushTo = (map: Map<number, number[]>, bucket: number, value: number) => {
    const list = map.get(bucket);
    if (list) list.push(value);
    else map.set(bucket, [value]);
  };

  for (const p of players) {
    pushTo(playerByBucket, hourOfWeekUTC(new Date(parseTimeMs(p.timestamp))), p.player_count);
  }
  for (const c of capacities) {
    pushTo(capacityByBucket, hourOfWeekUTC(new Date(parseTimeMs(c.timestamp))), c.max_capacity);
  }
  for (const q of queues) {
    pushTo(queueByBucket, hourOfWeekUTC(new Date(parseTimeMs(q.timestamp))), q.queue_length);
  }

  // 4. Build per-bucket occupancy + queue stats for every bucket with players.
  const buckets: BucketStats[] = [];
  for (const [hourOfWeek, playerValues] of playerByBucket) {
    const meanPlayers = meanOrNull(playerValues);
    if (meanPlayers === null) continue;

    const meanCapacity = meanOrNull(capacityByBucket.get(hourOfWeek) ?? []);
    const effectiveCapacity = meanCapacity ?? globalMeanCapacity;
    const occupancyRatio = effectiveCapacity > 0 ? meanPlayers / effectiveCapacity : null;

    const meanQueue = meanOrNull(queueByBucket.get(hourOfWeek) ?? []) ?? 0;

    buckets.push({
      hourOfWeek,
      meanPlayers,
      meanCapacity,
      meanQueue,
      occupancyRatio,
    });
  }

  const validBuckets = buckets.filter(
    (b): b is BucketStats & { occupancyRatio: number } => b.occupancyRatio !== null,
  );

  if (validBuckets.length < MIN_OCCUPIED_BUCKETS) {
    return { available: false };
  }

  // 5. Score every bucket: occupancy + non-negative, monotone queue penalty.
  const scoreByHour = new Map<number, number>();
  const occupancyByHour = new Map<number, number>();
  const queueByHour = new Map<number, number>();
  let queuePenaltyApplied = false;

  for (const b of validBuckets) {
    const penalty =
      queuePenaltyWeight > 0 && b.meanQueue > 0
        ? (queuePenaltyWeight * b.meanQueue) / globalMeanCapacity
        : 0;
    if (penalty > 0) queuePenaltyApplied = true;
    scoreByHour.set(b.hourOfWeek, b.occupancyRatio + penalty);
    occupancyByHour.set(b.hourOfWeek, b.occupancyRatio);
    queueByHour.set(b.hourOfWeek, b.meanQueue);
  }

  // 6. Select the lowest-score contiguous run of buckets (length up to
  //    `windowHours`), preferring longer runs only among equal candidate
  //    windows. A run is contiguous in cyclic hour-of-week space and only spans
  //    buckets that have a score (gaps break the run).
  const selection = selectLowOccupancyWindow(scoreByHour, windowHours);

  // Aggregate the chosen window's occupancy and queue means for reporting.
  let occupancySum = 0;
  let queueSum = 0;
  for (const hour of selection.hours) {
    occupancySum += occupancyByHour.get(hour) ?? 0;
    queueSum += queueByHour.get(hour) ?? 0;
  }
  const selectedLen = selection.hours.length;

  const recommendation: JoinRecommendation = {
    available: true,
    startHourOfWeek: selection.startHourOfWeek,
    endHourOfWeek: selection.endHourOfWeek,
    windowHours: selectedLen,
    occupancyRatio: selectedLen > 0 ? occupancySum / selectedLen : 0,
    score: selection.score,
    meanQueueLength: selectedLen > 0 ? queueSum / selectedLen : 0,
    queuePenaltyApplied,
    analysisWindowDays,
    sampleBucketCount: validBuckets.length,
  };

  // R8.6 — include the near-full indicator alongside the window when the latest
  // values are supplied (Property 34).
  if (input.latestPlayers !== undefined && input.latestCapacity !== undefined) {
    recommendation.currentlyFull = isCurrentlyFull(
      input.latestPlayers,
      input.latestCapacity,
      input.nearFullThreshold ?? DEFAULT_NEAR_FULL_THRESHOLD,
    );
  }

  return recommendation;
}

/**
 * Select the lowest-score contiguous run of scored hour-of-week buckets.
 *
 * Buckets are considered in cyclic hour-of-week order (167 wraps to 0). A
 * candidate window is a maximal-length contiguous run of present (scored)
 * buckets, up to `windowHours` long; its score is the MEAN of its buckets'
 * scores so windows of differing lengths compare fairly. The lowest-mean-score
 * window wins; ties prefer the longer window, then the earliest start. When no
 * contiguous multi-bucket run exists the single lowest-score bucket is returned.
 */
function selectLowOccupancyWindow(
  scoreByHour: Map<number, number>,
  windowHours: number,
): { startHourOfWeek: number; endHourOfWeek: number; hours: number[]; score: number } {
  const present = (h: number) => scoreByHour.has(((h % HOURS_PER_WEEK) + HOURS_PER_WEEK) % HOURS_PER_WEEK);
  const scoreAt = (h: number) =>
    scoreByHour.get(((h % HOURS_PER_WEEK) + HOURS_PER_WEEK) % HOURS_PER_WEEK) as number;

  const startHours = Array.from(scoreByHour.keys()).sort((a, b) => a - b);

  let best: { startHourOfWeek: number; endHourOfWeek: number; hours: number[]; score: number } | null =
    null;

  for (const start of startHours) {
    // Grow a contiguous run from `start` up to `windowHours` buckets.
    const hours: number[] = [];
    let sum = 0;
    for (let offset = 0; offset < windowHours; offset++) {
      const h = start + offset;
      if (!present(h)) break;
      const norm = ((h % HOURS_PER_WEEK) + HOURS_PER_WEEK) % HOURS_PER_WEEK;
      hours.push(norm);
      sum += scoreAt(h);
    }
    if (hours.length === 0) continue;
    const meanScore = sum / hours.length;

    const candidate = {
      startHourOfWeek: hours[0],
      endHourOfWeek: hours[hours.length - 1],
      hours,
      score: meanScore,
    };

    if (
      best === null ||
      candidate.score < best.score - 1e-12 ||
      (Math.abs(candidate.score - best.score) <= 1e-12 && candidate.hours.length > best.hours.length)
    ) {
      best = candidate;
    }
  }

  // `startHours` is non-empty because the caller guarantees >= MIN_OCCUPIED_BUCKETS.
  return best as { startHourOfWeek: number; endHourOfWeek: number; hours: number[]; score: number };
}

/* -------------------------------------------------------------------------- */
/* Pure core — isCurrentlyFull (R8.6 / Property 34)                           */
/* -------------------------------------------------------------------------- */

/**
 * Whether a server is currently full / near-full (R8.6 — Property 34).
 *
 * Returns `true` exactly when the latest occupancy ratio
 * `latestPlayers / latestCapacity` is at or above `nearThreshold`
 * (default {@link DEFAULT_NEAR_FULL_THRESHOLD}). The bound is INCLUSIVE: a ratio
 * exactly equal to the threshold counts as full.
 *
 * Divide-by-zero / invalid input is treated as NOT full (returns `false`): a
 * non-positive or non-finite capacity, or a negative player count, cannot
 * establish near-fullness, so the advisor never reports a fabricated full state.
 */
export function isCurrentlyFull(
  latestPlayers: number,
  latestCapacity: number,
  nearThreshold: number = DEFAULT_NEAR_FULL_THRESHOLD,
): boolean {
  if (!Number.isFinite(latestPlayers) || !Number.isFinite(latestCapacity)) return false;
  if (latestCapacity <= 0 || latestPlayers < 0) return false;
  return latestPlayers / latestCapacity >= nearThreshold;
}

/* -------------------------------------------------------------------------- */
/* Pure core — local-time conversion (R8.4 / Property 32)                     */
/* -------------------------------------------------------------------------- */

/**
 * Render a UTC instant as the wall-clock parts observed in an IANA time zone.
 *
 * Uses `Intl.DateTimeFormat` with the target `timeZone`; this is presentation
 * only and pairs with {@link zonedPartsToUtc} for the inverse. Together they
 * satisfy the round-trip property: `zonedPartsToUtc(utcToZonedParts(t, tz), tz)`
 * equals `t` (Property 32).
 */
export function utcToZonedParts(instant: Date, timeZone: string): ZonedDateParts {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });

  const parts = formatter.formatToParts(instant);
  const lookup: Record<string, string> = {};
  for (const part of parts) {
    if (part.type !== 'literal') lookup[part.type] = part.value;
  }

  // `hour` can come back as "24" at midnight in some environments; normalize to 0.
  let hour = Number(lookup.hour);
  if (hour === 24) hour = 0;

  return {
    year: Number(lookup.year),
    month: Number(lookup.month),
    day: Number(lookup.day),
    hour,
    minute: Number(lookup.minute),
    second: Number(lookup.second),
  };
}

/**
 * Inverse of {@link utcToZonedParts}: given wall-clock parts interpreted in a
 * target IANA time zone, return the corresponding UTC instant.
 *
 * Implementation: treat the parts as if they were UTC to get a provisional
 * instant, measure that provisional instant's offset in the target zone, and
 * subtract it. A second pass corrects the rare case where the offset changes
 * across a DST boundary between the provisional and corrected instants. This is
 * the inverse that makes the Property 32 round-trip hold for any IANA zone.
 */
export function zonedPartsToUtc(parts: ZonedDateParts, timeZone: string): Date {
  const asUtcMs = Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
    parts.second,
  );

  const offsetAt = (utcMs: number): number => {
    // Offset (ms) = wall-clock-in-zone minus the actual UTC instant.
    const zoned = utcToZonedParts(new Date(utcMs), timeZone);
    const zonedAsUtcMs = Date.UTC(
      zoned.year,
      zoned.month - 1,
      zoned.day,
      zoned.hour,
      zoned.minute,
      zoned.second,
    );
    return zonedAsUtcMs - utcMs;
  };

  const firstOffset = offsetAt(asUtcMs);
  let resultMs = asUtcMs - firstOffset;
  // Correct for a DST transition between the provisional and corrected instants.
  const secondOffset = offsetAt(resultMs);
  if (secondOffset !== firstOffset) {
    resultMs = asUtcMs - secondOffset;
  }

  return new Date(resultMs);
}

/**
 * Resolve a UTC hour-of-week bucket to the concrete UTC instant of its next
 * occurrence at or after `reference` (default `new Date()`).
 *
 * The recommendation describes a RECURRING weekly window; this picks the next
 * real instant matching that hour-of-week so it can be localized to a wall
 * clock and round-tripped (Property 32). The returned instant is aligned to the
 * top of the hour in UTC.
 */
export function nextInstantForHourOfWeek(hourOfWeek: number, reference: Date = new Date()): Date {
  const normalized = ((hourOfWeek % HOURS_PER_WEEK) + HOURS_PER_WEEK) % HOURS_PER_WEEK;
  const refHourOfWeek = hourOfWeekUTC(reference);
  let hoursAhead = normalized - refHourOfWeek;
  if (hoursAhead < 0) hoursAhead += HOURS_PER_WEEK;

  // Align `reference` to the top of its UTC hour, then advance.
  const aligned = Date.UTC(
    reference.getUTCFullYear(),
    reference.getUTCMonth(),
    reference.getUTCDate(),
    reference.getUTCHours(),
    0,
    0,
    0,
  );
  return new Date(aligned + hoursAhead * MS_PER_HOUR);
}

/**
 * Convert a {@link LocalizedRecommendation} back to its underlying UTC instants
 * (Property 32 round-trip). Returns the canonical anchors directly — the
 * localized strings are never parsed — so the localized window always denotes
 * the same moment as the original UTC recommendation.
 */
export function localizedToUtc(localized: LocalizedRecommendation): {
  startInstantUtc: Date;
  endInstantUtc: Date;
} {
  return {
    startInstantUtc: new Date(localized.startInstantUtc),
    endInstantUtc: new Date(localized.endInstantUtc),
  };
}

/**
 * Localize a {@link JoinRecommendation} for display in a viewer's IANA time
 * zone (R8.4 / Property 32).
 *
 * The window's start/end UTC hour-of-week buckets are resolved to concrete UTC
 * instants (next occurrence at/after `reference`) which become the canonical
 * round-trip anchors {@link LocalizedRecommendation.startInstantUtc} /
 * `endInstantUtc`. The localized strings are produced with
 * `Intl.DateTimeFormat({ timeZone })` purely for display and are never used to
 * reconstruct the instant — so converting the localized window back to UTC (via
 * {@link localizedToUtc}) always yields the original instant.
 *
 * @param reference anchor for resolving the recurring window to a concrete
 *   instant; defaults to `new Date()`. Pass a fixed date in tests.
 */
export function formatRecommendationLocal(
  rec: JoinRecommendation,
  ianaTimeZone: string,
  reference: Date = new Date(),
): LocalizedRecommendation {
  const startInstant = nextInstantForHourOfWeek(rec.startHourOfWeek, reference);
  // End instant is the END of the last bucket (exclusive boundary => start + windowHours).
  const endInstant = new Date(startInstant.getTime() + rec.windowHours * MS_PER_HOUR);

  const dayTimeFormatter = new Intl.DateTimeFormat('en-US', {
    timeZone: ianaTimeZone,
    weekday: 'short',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
  const timeOnlyFormatter = new Intl.DateTimeFormat('en-US', {
    timeZone: ianaTimeZone,
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });

  const startLocal = dayTimeFormatter.format(startInstant);
  const endLocal = dayTimeFormatter.format(endInstant);
  const endLocalTimeOnly = timeOnlyFormatter.format(endInstant);

  const localized: LocalizedRecommendation = {
    timeZone: ianaTimeZone,
    startInstantUtc: startInstant.toISOString(),
    endInstantUtc: endInstant.toISOString(),
    startLocal,
    endLocal,
    label: `${startLocal} – ${endLocalTimeOnly}`,
    windowHours: rec.windowHours,
    occupancyRatio: rec.occupancyRatio,
  };

  if (rec.currentlyFull !== undefined) {
    localized.currentlyFull = rec.currentlyFull;
  }

  return localized;
}

/* -------------------------------------------------------------------------- */
/* Async orchestration — getJoinRecommendation (R9.1, R9.3)                   */
/* -------------------------------------------------------------------------- */

/** Options for {@link getJoinRecommendation}. */
export interface GetJoinRecommendationOptions {
  /** Time range passed to the existing data-access reads; defaults to {@link DEFAULT_RECOMMENDATION_TIME_RANGE} (>= 7 days). */
  timeRange?: TimeRange;
  /** Rolling analysis window in days; defaults to {@link DEFAULT_ANALYSIS_WINDOW_DAYS}. */
  analysisWindowDays?: number;
  /** Reference "now"; defaults to `new Date()`. */
  now?: Date;
  /** Near-full threshold for the currently-full indicator; defaults to {@link DEFAULT_NEAR_FULL_THRESHOLD}. */
  nearFullThreshold?: number;
  /**
   * Optional pre-fetched queue history (R8.3). Queue data is not persisted yet,
   * so this is normally absent and the advisor degrades to capacity + players.
   */
  queueSeries?: QueueHistoryPoint[];
}

/**
 * Convenience orchestrator that fetches a server's history through the EXISTING
 * data-access functions and computes its join recommendation (R8.1–R8.6, R9.3).
 *
 * Reuses `getPlayerCounts([serverId], timeRange)` and
 * `getServerCapacities([serverId], timeRange)` (no parallel query path, R9.1/R9.3)
 * over a range covering at least 7 days, checks
 * `hasQueueSupport(serverId)` / `getQueueConfig(serverId)` to decide whether
 * queue data participates, and delegates the math to the pure
 * {@link computeJoinWindow}. The latest player/capacity values are taken from
 * the most recent in-range samples to populate the currently-full indicator
 * (R8.6).
 *
 * NOTE: there is no persisted queue history table yet, so unless `queueSeries`
 * is supplied explicitly the queue input is empty and the recommendation
 * degrades gracefully to capacity + player-count (R8.3 is "WHERE a server
 * provides queue data").
 */
export async function getJoinRecommendation(
  serverId: string,
  options?: GetJoinRecommendationOptions,
): Promise<JoinRecommendationResult> {
  const timeRange = options?.timeRange ?? DEFAULT_RECOMMENDATION_TIME_RANGE;
  const analysisWindowDays = options?.analysisWindowDays ?? DEFAULT_ANALYSIS_WINDOW_DAYS;
  const now = options?.now ?? new Date();

  const [playerSeries, capacitySeries] = await Promise.all([
    getPlayerCounts([serverId], timeRange),
    getServerCapacities([serverId], timeRange),
  ]);

  // Queue history is only meaningful for servers with queue support (checked via
  // the existing `lib/server-queues` helpers, R8.3) but is not persisted today,
  // so it is empty unless a caller supplies it explicitly.
  const serverHasQueue = hasQueueSupport(serverId) && getQueueConfig(serverId) !== null;
  const queueSeries: QueueHistoryPoint[] = options?.queueSeries ?? (serverHasQueue ? [] : []);

  const latestPlayers = latestValue(playerSeries, (p) => p.player_count);
  const latestCapacity = latestValue(capacitySeries, (c) => c.max_capacity);

  return computeJoinWindow({
    playerSeries,
    capacitySeries,
    queueSeries,
    analysisWindowDays,
    now,
    nearFullThreshold: options?.nearFullThreshold,
    latestPlayers,
    latestCapacity,
  });
}

/** Pick the value of the most recent (latest timestamp) point in a series. */
function latestValue<T extends { timestamp: string }>(
  series: readonly T[],
  pick: (point: T) => number,
): number | undefined {
  let bestMs = Number.NEGATIVE_INFINITY;
  let bestValue: number | undefined;
  for (const point of series) {
    const ms = parseTimeMs(point.timestamp);
    if (Number.isNaN(ms)) continue;
    if (ms > bestMs) {
      bestMs = ms;
      bestValue = pick(point);
    }
  }
  return bestValue;
}
