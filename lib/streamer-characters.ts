/**
 * Data_Layer for Streamer Character Tracking — the module through which every
 * character read routes (mirrors `lib/streamers.ts`).
 *
 * In GTA RP a streamer plays one or more named in-character personas whose name
 * is embedded (inconsistently) in the stream title. This module owns:
 *
 *  - the domain types for stored extractions, derived play-sessions, the
 *    character catalog, the admin review queue, and the resolved title records
 *    that feed the pure derivation core;
 *  - the pure derivation functions (sessions / catalog / clip association) and
 *    the async reads / processing / admin actions.
 *
 * This task introduces the domain types plus {@link resolveEffectiveCharacter}
 * (the "effective character resolution" algorithm, R6). The derivation
 * functions and the async reads/processing are added in later tasks.
 */

import {
  charactersEqual,
  extractCharacterFromTitle,
  normalizeCharacterName,
  type CharacterAiClient,
  type ExtractionMethod,
} from './character-extractor';
import type { Clip, MinimalStreamerClient, StreamerPlatform } from './streamers';
import { createServiceRoleClient } from './supabase-service-role';

// Re-export so consumers can import the unified clip shape and platform literal
// from the character Data_Layer too, the same way `lib/streamers.ts` re-exports
// `StreamerPlatform` from `lib/alerts.ts`.
export type { Clip, StreamerPlatform };

/* -------------------------------------------------------------------------- */
/* Table names                                                                */
/* -------------------------------------------------------------------------- */

/**
 * Single stream table for BOTH platforms (same as `lib/streamers.ts`): titles
 * + timestamps are read from `twitch_streams` regardless of platform. There is
 * no separate `kick_streams` table and no platform discriminator column.
 */
const STREAMS_TABLE = 'twitch_streams';

/** Per-`(streamer, title)` extraction cache + review-state table (R2.7, R6). */
const CHARACTER_EXTRACTIONS_TABLE = 'character_extractions';

/** Twitch clips table — one clip source for character association (R5). */
const TWITCH_CLIPS_TABLE = 'twitch_clips';

/** Kick clips table — the other clip source for character association (R5). */
const KICK_CLIPS_TABLE = 'kick_clips';

/* -------------------------------------------------------------------------- */
/* Read bounds (perf safety for the on-read catalog/sessions over titles)     */
/* -------------------------------------------------------------------------- */

/**
 * Lookback window bounding the title history scanned by the on-read catalog /
 * sessions reads ({@link readResolvedTitleRecords}) and the admin processing
 * read ({@link processStreamerTitles}). The profile-facing catalog/sessions are
 * a recency-oriented surface, so 180 days of title history is more than enough
 * to populate it while keeping the `twitch_streams` scan bounded.
 *
 * Without this bound the title read was an UNBOUNDED scan over a busy streamer's
 * entire history (no `created_at` floor, no order, no limit), which tripped the
 * Postgres statement timeout (SQLSTATE 57014) on every profile render. Bounding
 * on `created_at` mirrors how {@link getStreamerViewerTrend} in `lib/streamers.ts`
 * keeps its read fast.
 */
export const CHARACTER_TITLE_LOOKBACK_MS = 180 * 24 * 60 * 60 * 1000; // 180 days

/**
 * Hard safety cap on the number of title rows returned by the bounded reads,
 * fetched most-recent first. Even within the {@link CHARACTER_TITLE_LOOKBACK_MS}
 * window a pathological streamer could have an enormous row count; this caps the
 * worst case so a single read can never load an unbounded result set.
 */
const MAX_TITLE_ROWS = 20000;

/* -------------------------------------------------------------------------- */
/* Domain types                                                               */
/* -------------------------------------------------------------------------- */

/** Review/resolution state of a stored extraction (R6). */
export type ReviewState = 'pending' | 'confirmed' | 'overridden' | 'rejected';

/**
 * A persisted `character_extractions` row mapped to domain shape (R2.7). One
 * row exists per distinct `(streamer, title text)`.
 */
export interface StoredExtraction {
  id: number;
  streamerName: string;
  sourceTitle: string;
  /** Extractor's normalized name, or `null` for an explicit "no character". */
  characterName: string | null;
  confidence: number;
  method: ExtractionMethod;
  reviewState: ReviewState;
  /** Admin correction supplied by an override action (R6.4). */
  overrideName: string | null;
  reviewedBy: string | null;
  reviewedAt: string | null;
}

/** One contiguous play window for a single character (R4). */
export interface CharacterPlaySession {
  characterName: string;
  /** ISO timestamp; `start <= end` always holds (R4.4). */
  start: string;
  /** ISO timestamp. */
  end: string;
  titleRecordCount: number;
}

/** A catalog entry shown on the Streamer_Profile (R3). */
export interface CharacterCatalogEntry {
  characterName: string;
  firstSeen: string;
  /** Most-recent observation for the character (R3.3). */
  lastSeen: string;
  sourceTitleCount: number;
  clipCount: number;
}

/** A review-queue item for the admin UI (R6.1). */
export interface ReviewQueueItem extends StoredExtraction {
  streamerDisplayName: string;
}

/**
 * A time-ordered, character-resolved title record — the input to the pure
 * session-derivation core. `character` is the effective character for the
 * record (`null` means the record is excluded and acts as a separator).
 */
export interface ResolvedTitleRecord {
  id: number;
  /** Source `twitch_streams.created_at`. */
  timestamp: string;
  character: string | null;
}

/* -------------------------------------------------------------------------- */
/* Pure derivation core                                                       */
/* -------------------------------------------------------------------------- */

/**
 * Slab cap for {@link deriveCharacterPlaySessions} (R4): the longest a single
 * title record's coverage extends past its own timestamp, and equivalently the
 * largest gap between two consecutive same-character records that still keeps
 * them in one session. Aligned with `lib/streamers.ts`'s
 * {@link STREAMER_LIVE_FRESHNESS_MS} so "still playing" and "still live" share
 * the same best-effort 10-minute window. Overridable per call via
 * `opts.sessionTailMs` (used by tests).
 */
export const SESSION_TAIL_MS = 10 * 60 * 1000;

/**
 * Resolve a stored extraction to its EFFECTIVE character, or `null` when the
 * extraction does not contribute a character (R6, "Core algorithms #2"):
 *
 *  - `rejected` → `null` (admin marked "no character", R6.5).
 *  - `pending`  → `null` (below the confidence threshold, not yet confirmed —
 *    excluded from the catalog and sessions, R3.1 / R6.1).
 *  - `confirmed` | `overridden` → the normalized `overrideName ?? characterName`,
 *    or `null` when that normalizes to empty.
 */
export function resolveEffectiveCharacter(e: StoredExtraction): string | null {
  if (e.reviewState === 'rejected' || e.reviewState === 'pending') {
    return null;
  }

  // confirmed | overridden: prefer the admin override, then the extractor's
  // name. Normalize for display/identity; an empty result contributes nothing.
  const normalized = normalizeCharacterName(e.overrideName ?? e.characterName ?? '');
  return normalized === '' ? null : normalized;
}

/**
 * Derive non-overlapping {@link CharacterPlaySession}s from time-ordered,
 * character-resolved title records ("Core algorithms #3", R4). PURE and
 * deterministic: it never reads the clock, never mutates `records`, and the same
 * input always yields the same output (this is what makes idempotency, R23,
 * trivially provable).
 *
 * Algorithm:
 *  1. Sort records ascending by `(timestamp, id)` — a total order because ids
 *     are unique. Timestamps are parsed to epoch ms; records whose timestamp is
 *     unparseable (NaN) are skipped so the function never throws and they act as
 *     a separator, exactly like a `null` character.
 *  2. For record `k` at time `t_k`, its coverage slab is the half-open interval
 *     `[t_k, min(t_{k+1}, t_k + SESSION_TAIL_MS))`; the final record uses
 *     `[t_n, t_n + SESSION_TAIL_MS)`. Slabs are pairwise disjoint (each ends no
 *     later than the next record's start) so sessions never overlap (R4.5).
 *  3. A session is a maximal run of CONSECUTIVE slabs whose records resolve to
 *     the SAME real (non-`null`) character AND are contiguous — i.e. the current
 *     slab reaches the next record (`slab_k.end === t_{k+1}`, equivalently the
 *     gap to the next record is ≤ `SESSION_TAIL_MS`). A `null`/skipped record
 *     contributes no slab and breaks the run (R4.3).
 *  4. `session.start = t_first` (ISO); `session.end = slab_last.end` (ISO).
 *     Because `SESSION_TAIL_MS > 0`, `start < end` (so `start <= end`, R4.4).
 *
 * Consequences (all tested): same-character consecutive records within the cap
 * merge into one session (R4.2); a character change or excluded/`null` record
 * ends the current session and the next character starts a new one at its
 * boundary (R4.3); disjoint half-open slabs mean different-character sessions
 * never overlap (R4.5); a character may have several sessions when separated by
 * a gap or another character (R4.1).
 *
 * @param records time-ordered resolved title records (order not assumed; sorted
 *   here). `character === null` marks an excluded/separator record.
 * @param opts.sessionTailMs override for {@link SESSION_TAIL_MS} (must be > 0 to
 *   guarantee `start < end`); defaults to `SESSION_TAIL_MS`.
 */
export function deriveCharacterPlaySessions(
  records: ResolvedTitleRecord[],
  opts?: { sessionTailMs?: number },
): CharacterPlaySession[] {
  const tailMs = opts?.sessionTailMs ?? SESSION_TAIL_MS;

  // 1. Parse + sort a COPY ascending by (timestamp, id). Skip unparseable
  //    timestamps (NaN) so the function never throws; a skipped record carries
  //    no slab and therefore behaves like a separator below.
  const parsed = records
    .map((r) => ({ id: r.id, time: Date.parse(r.timestamp), character: r.character }))
    .filter((r) => Number.isFinite(r.time))
    .sort((a, b) => (a.time - b.time) || (a.id - b.id));

  const sessions: CharacterPlaySession[] = [];

  // Accumulator for the run currently being built. `null` => no open run.
  let runCharacter: string | null = null; // normalized effective name
  let runStartMs = 0; // t_first of the open run
  let runEndMs = 0; // slab end of the most recent record in the run
  let runCount = 0;

  const flush = () => {
    if (runCharacter !== null) {
      sessions.push({
        characterName: runCharacter,
        start: new Date(runStartMs).toISOString(),
        end: new Date(runEndMs).toISOString(),
        titleRecordCount: runCount,
      });
    }
    runCharacter = null;
    runCount = 0;
  };

  for (let k = 0; k < parsed.length; k++) {
    const rec = parsed[k];
    const tK = rec.time;

    // A null character contributes no slab and breaks any open run (R4.3).
    if (rec.character === null) {
      flush();
      continue;
    }

    // Half-open coverage slab: [t_k, min(t_{k+1}, t_k + tailMs)). The final
    // record (no successor) uses the full tail. The gap to the next record is
    // bridged only when t_{k+1} <= t_k + tailMs, in which case the slab reaches
    // exactly t_{k+1} and the run can continue (contiguity test below).
    const next = parsed[k + 1];
    const slabEnd = next ? Math.min(next.time, tK + tailMs) : tK + tailMs;

    // Continue the open run only when the same character AND the previous slab
    // reached this record (contiguous: runEndMs === tK). Otherwise flush and
    // start a fresh run at this record's timestamp.
    const sameCharacter = runCharacter !== null && charactersEqual(runCharacter, rec.character);
    const contiguous = runCharacter !== null && runEndMs === tK;

    if (sameCharacter && contiguous) {
      runEndMs = slabEnd;
      runCount += 1;
    } else {
      flush();
      runCharacter = rec.character;
      runStartMs = tK;
      runEndMs = slabEnd;
      runCount = 1;
    }
  }

  flush();

  return sessions;
}

/**
 * Identity key for a character name: the normalized name lower-cased. Two names
 * that are `charactersEqual` (case-insensitive over normalized forms, R2.6)
 * produce the SAME key, so case-variants collapse into one catalog character
 * (R3.1 / Property 8). Kept private so every grouping/lookup below uses the same
 * keying and stays consistent with {@link charactersEqual}.
 */
function characterKey(name: string): string {
  return normalizeCharacterName(name).toLowerCase();
}

/**
 * Build the {@link CharacterCatalogEntry} list from derived play sessions
 * ("Core algorithms #4", R3). PURE and deterministic: it never reads the clock
 * and never mutates its inputs.
 *
 *  - One entry per DISTINCT character. Sessions are grouped by character
 *    identity ({@link characterKey} — normalized + lower-cased) so case-variants
 *    of the same character collapse into a single entry, preserving a display
 *    name (the name of that character's most-recently-played session). Entries
 *    therefore have pairwise-distinct character names (R3.1 — Property 8).
 *  - `firstSeen` = the minimum `session.start` across the character's sessions;
 *    `lastSeen` = the maximum `session.end` (most recent observation, R3.3).
 *  - `sourceTitleCount` = the sum of `titleRecordCount` across those sessions.
 *  - `clipCount` = looked up from `clipsByCharacter`. The incoming map is re-keyed
 *    by {@link characterKey} (summing any collisions) so the lookup is consistent
 *    with how the catalog character is keyed regardless of the casing the caller
 *    used; absent characters default to `0`.
 *
 * The result is ordered by `lastSeen` DESCENDING (most recently played first,
 * R3.2), with ties broken by case-insensitive character name then the raw
 * display name so the ordering is total and stable.
 *
 * @param sessions derived play sessions (any order; only real characters appear
 *   since `deriveCharacterPlaySessions` never emits `null`-character sessions).
 * @param clipsByCharacter clip counts keyed by character name (any casing).
 */
export function buildCharacterCatalog(
  sessions: CharacterPlaySession[],
  clipsByCharacter: Map<string, number>,
): CharacterCatalogEntry[] {
  // Re-key the clip-count map by the canonical character key so lookups match
  // the catalog's keying no matter how the caller cased its keys. Collisions
  // (distinct casings of the same character) are summed.
  const clipsByKey = new Map<string, number>();
  for (const [name, count] of clipsByCharacter) {
    const key = characterKey(name);
    clipsByKey.set(key, (clipsByKey.get(key) ?? 0) + count);
  }

  // Accumulate one group per distinct character key.
  interface Group {
    displayName: string;
    firstSeenMs: number;
    lastSeenMs: number;
    sourceTitleCount: number;
  }
  const groups = new Map<string, Group>();

  for (const s of sessions) {
    const key = characterKey(s.characterName);
    const startMs = Date.parse(s.start);
    const endMs = Date.parse(s.end);
    // Skip sessions whose timestamps are unparseable so the function never
    // throws; a malformed session simply contributes nothing.
    if (!Number.isFinite(startMs) || !Number.isFinite(endMs)) {
      continue;
    }

    const existing = groups.get(key);
    if (!existing) {
      groups.set(key, {
        displayName: s.characterName,
        firstSeenMs: startMs,
        lastSeenMs: endMs,
        sourceTitleCount: s.titleRecordCount,
      });
      continue;
    }

    if (startMs < existing.firstSeenMs) {
      existing.firstSeenMs = startMs;
    }
    // The display name tracks the most-recently-played session (max end).
    if (endMs > existing.lastSeenMs) {
      existing.lastSeenMs = endMs;
      existing.displayName = s.characterName;
    }
    existing.sourceTitleCount += s.titleRecordCount;
  }

  const entries: CharacterCatalogEntry[] = [];
  for (const [key, g] of groups) {
    entries.push({
      characterName: g.displayName,
      firstSeen: new Date(g.firstSeenMs).toISOString(),
      lastSeen: new Date(g.lastSeenMs).toISOString(),
      sourceTitleCount: g.sourceTitleCount,
      clipCount: clipsByKey.get(key) ?? 0,
    });
  }

  // Most-recent first (R3.2). Deterministic tie-break: case-insensitive name,
  // then the raw display name, so the total order is stable.
  entries.sort((a, b) => {
    const byLastSeen = Date.parse(b.lastSeen) - Date.parse(a.lastSeen);
    if (byLastSeen !== 0) return byLastSeen;
    const ka = characterKey(a.characterName);
    const kb = characterKey(b.characterName);
    if (ka < kb) return -1;
    if (ka > kb) return 1;
    return a.characterName < b.characterName ? -1 : a.characterName > b.characterName ? 1 : 0;
  });

  return entries;
}

/**
 * Associate a clip with the character whose play session contains the clip's
 * creation timestamp ("Core algorithms #4", R5). PURE and deterministic.
 *
 * Returns the `characterName` of the unique session whose half-open interval
 * `[start, end)` contains the parsed `clipCreatedAt`, or `null` when no session
 * contains it. Half-open semantics: a timestamp exactly equal to a session's
 * `end` is NOT contained (it belongs to no session / the next one). Because
 * sessions are pairwise disjoint, a clip matches at most one character, so the
 * first containing session found is the unique answer.
 *
 * Unparseable inputs are guarded: a NaN `clipCreatedAt` returns `null`, and any
 * session with an unparseable boundary is skipped rather than throwing.
 */
export function associateClipToCharacter(
  clipCreatedAt: string,
  sessions: CharacterPlaySession[],
): string | null {
  const t = Date.parse(clipCreatedAt);
  if (!Number.isFinite(t)) {
    return null;
  }

  for (const s of sessions) {
    const startMs = Date.parse(s.start);
    const endMs = Date.parse(s.end);
    if (!Number.isFinite(startMs) || !Number.isFinite(endMs)) {
      continue;
    }
    // Half-open [start, end): end is excluded.
    if (startMs <= t && t < endMs) {
      return s.characterName;
    }
  }

  return null;
}

/**
 * Return the DISTINCT characters whose play session overlaps the VOD interval
 * `[vodStart, vodEnd)` (R7.1). PURE and deterministic. This is the pure seam for
 * Property 24 / VOD-to-character association; no VOD data source is consumed yet
 * (the async read + API payload are wired once a source exists).
 *
 * Standard half-open interval overlap: a session `[start, end)` overlaps the VOD
 * `[vodStart, vodEnd)` iff `sessionStart < vodEnd && vodStart < sessionEnd`.
 * Characters are de-duplicated by identity ({@link characterKey}) and returned
 * in first-appearance order across `sessions` for stable output, preserving each
 * character's display name.
 *
 * Unparseable inputs are guarded: a NaN `vodStart`/`vodEnd` returns `[]`, and any
 * session with an unparseable boundary is skipped rather than throwing.
 */
export function vodCharactersByOverlap(
  vodStart: string,
  vodEnd: string,
  sessions: CharacterPlaySession[],
): string[] {
  const vStart = Date.parse(vodStart);
  const vEnd = Date.parse(vodEnd);
  if (!Number.isFinite(vStart) || !Number.isFinite(vEnd)) {
    return [];
  }

  const seen = new Set<string>();
  const result: string[] = [];

  for (const s of sessions) {
    const startMs = Date.parse(s.start);
    const endMs = Date.parse(s.end);
    if (!Number.isFinite(startMs) || !Number.isFinite(endMs)) {
      continue;
    }
    // Half-open overlap test.
    if (startMs < vEnd && vStart < endMs) {
      const key = characterKey(s.characterName);
      if (!seen.has(key)) {
        seen.add(key);
        result.push(s.characterName);
      }
    }
  }

  return result;
}

/* -------------------------------------------------------------------------- */
/* Async reads (route through the Data_Layer; service-role default)           */
/* -------------------------------------------------------------------------- */

/**
 * Build the default service-role-backed {@link MinimalStreamerClient} (mirrors
 * `defaultClient()` in `lib/streamers.ts`). Server-side reads only; the
 * privileged streamer-scoped tables have RLS enabled with no public SELECT
 * policy, so reads use the service-role client (R8.2).
 */
function defaultClient(): MinimalStreamerClient {
  return createServiceRoleClient() as unknown as MinimalStreamerClient;
}

/**
 * Escape SQL LIKE/ILIKE wildcards (`\`, `%`, `_`) so a username containing an
 * underscore is matched literally rather than as a single-character wildcard.
 * Local copy of the private helper in `lib/streamers.ts` (R8.3).
 */
function escapeLikePattern(value: string): string {
  return value.replace(/[\\%_]/g, (ch) => `\\${ch}`);
}

/**
 * Case-insensitive exact match used to re-filter loose `ilike` results so a
 * record is attributed to a streamer only when the username is exactly equal
 * under case-insensitive comparison (R8.3). Local copy of the private helper in
 * `lib/streamers.ts`.
 */
function namesEqual(a: string, b: string): boolean {
  return a.toLowerCase() === b.toLowerCase();
}

/** A `twitch_streams` title row consumed for session derivation. */
interface StreamTitleRow {
  id: number;
  streamer_name: string;
  stream_title: string | null;
  created_at: string | null;
}

/** A persisted `character_extractions` row (snake_case, as stored). */
interface CharacterExtractionRow {
  id: number;
  streamer_name: string;
  source_title: string;
  character_name: string | null;
  confidence: number;
  extraction_method: string;
  review_state: string;
  override_name: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
}

/** Map a persisted extraction row to the domain {@link StoredExtraction}. */
function mapExtractionRow(row: CharacterExtractionRow): StoredExtraction {
  return {
    id: row.id,
    streamerName: row.streamer_name,
    sourceTitle: row.source_title,
    characterName: row.character_name,
    confidence: row.confidence,
    method: row.extraction_method as ExtractionMethod,
    reviewState: row.review_state as ReviewState,
    overrideName: row.override_name,
    reviewedBy: row.reviewed_by,
    reviewedAt: row.reviewed_at,
  };
}

/**
 * A persisted `twitch_clips` row consumed for character association (R5).
 * Local copy of the private shape in `lib/streamers.ts` (those are not
 * exported), matching the columns selected below.
 */
interface TwitchClipRow {
  clip_id: string;
  streamer_username: string;
  clip_title: string;
  view_count: number;
  duration_seconds: number;
  thumbnail_url: string;
  embed_url: string;
  twitch_created_at: string;
}

/**
 * A persisted `kick_clips` row consumed for character association (R5). Local
 * copy of the private shape in `lib/streamers.ts`, matching the columns
 * selected below.
 */
interface KickClipRow {
  clip_id: string;
  streamer_username: string;
  clip_title: string;
  view_count: number;
  duration_seconds: number;
  thumbnail_url: string;
  clip_url: string;
  kick_created_at: string;
  channel_slug: string;
}

/** Map a persisted Twitch clip row to the unified {@link Clip}. */
function mapTwitchClip(row: TwitchClipRow): Clip {
  return {
    clipId: row.clip_id,
    streamerUsername: row.streamer_username,
    title: row.clip_title,
    viewCount: row.view_count,
    durationSeconds: row.duration_seconds,
    thumbnailUrl: row.thumbnail_url,
    url: row.embed_url,
    createdAt: row.twitch_created_at,
    platform: 'twitch',
  };
}

/** Map a persisted Kick clip row to the unified {@link Clip}. */
function mapKickClip(row: KickClipRow): Clip {
  return {
    clipId: row.clip_id,
    streamerUsername: row.streamer_username,
    title: row.clip_title,
    viewCount: row.view_count,
    durationSeconds: row.duration_seconds,
    thumbnailUrl: row.thumbnail_url,
    url: row.clip_url,
    createdAt: row.kick_created_at,
    platform: 'kick',
    channelSlug: row.channel_slug,
  };
}

/**
 * Read the streamer's title records from `twitch_streams` and their stored
 * extractions from `character_extractions`, then resolve each title to its
 * EFFECTIVE character ({@link resolveEffectiveCharacter}) to produce the
 * time-ordered {@link ResolvedTitleRecord}s that feed the pure derivation core.
 *
 * Matching mirrors `lib/streamers.ts` (R8.3): both reads narrow at the database
 * with a wildcard-escaped `ilike` then re-filter in memory with
 * {@link namesEqual} for exact case-insensitive attribution. Each extraction is
 * matched to a title by exact `source_title` text; a title with no matching
 * extraction (or one resolving to `null`) yields a `null`-character record that
 * acts as a session separator.
 *
 * Error handling (R8.4): on either read's error this logs and returns `null` so
 * callers can short-circuit to a safe empty value (never throws).
 *
 * Performance (perf regression fix): the titles read is BOUNDED — it filters
 * `created_at >= now - CHARACTER_TITLE_LOOKBACK_MS`, orders most-recent first,
 * and caps at {@link MAX_TITLE_ROWS} rows — so a busy streamer's full history is
 * never scanned (previously an unbounded scan that tripped the Postgres
 * statement timeout, SQLSTATE 57014). The descending DB order is fine because
 * {@link deriveCharacterPlaySessions} sorts ascending internally.
 */
async function readResolvedTitleRecords(
  normalized: string,
  client: MinimalStreamerClient,
  now: Date,
): Promise<ResolvedTitleRecord[] | null> {
  const escaped = escapeLikePattern(normalized);
  const since = new Date(now.getTime() - CHARACTER_TITLE_LOOKBACK_MS);

  // Titles + timestamps from the single stream table (both platforms). Bounded
  // by `created_at` + ordered most-recent first + hard row cap so a busy
  // streamer's full history is never scanned (mirrors getStreamerViewerTrend).
  const { data: titleData, error: titleError } = await client
    .from<StreamTitleRow>(STREAMS_TABLE)
    .select('id, streamer_name, stream_title, created_at')
    .ilike('streamer_name', escaped)
    .gte('created_at', since.toISOString())
    .order('created_at', { ascending: false })
    .limit(MAX_TITLE_ROWS);
  if (titleError) {
    console.error('Error fetching streamer titles for characters:', titleError);
    return null;
  }

  // Stored extractions (cache + review state) for the same streamer.
  const { data: extractionData, error: extractionError } = await client
    .from<CharacterExtractionRow>(CHARACTER_EXTRACTIONS_TABLE)
    .select(
      'id, streamer_name, source_title, character_name, confidence, extraction_method, review_state, override_name, reviewed_by, reviewed_at',
    )
    .ilike('streamer_name', escaped);
  if (extractionError) {
    console.error('Error fetching character extractions:', extractionError);
    return null;
  }

  // Build an exact-title -> effective character lookup from the streamer's
  // extractions (exact case-insensitive streamer match, exact title text).
  const effectiveByTitle = new Map<string, string | null>();
  for (const row of extractionData ?? []) {
    if (!namesEqual(row.streamer_name, normalized)) continue;
    effectiveByTitle.set(row.source_title, resolveEffectiveCharacter(mapExtractionRow(row)));
  }

  // One resolved record per title row. A title with no matching extraction (or
  // one resolving to null) contributes a null-character separator record.
  const records: ResolvedTitleRecord[] = [];
  const sinceMs = since.getTime();
  for (const row of titleData ?? []) {
    if (!namesEqual(row.streamer_name, normalized)) continue;
    if (!row.created_at) continue;
    // Defensive in-memory floor mirroring getStreamerViewerTrend: skip rows
    // whose timestamp parses older than `since` (or is unparseable).
    const ts = new Date(row.created_at).getTime();
    if (Number.isNaN(ts) || ts < sinceMs) continue;
    const title = row.stream_title ?? '';
    const effective = effectiveByTitle.has(title) ? (effectiveByTitle.get(title) ?? null) : null;
    records.push({ id: row.id, timestamp: row.created_at, character: effective });
  }

  return records;
}

/**
 * Return the streamer's derived {@link CharacterPlaySession}s (R4.1). Reads
 * titles + extractions through the Data_Layer, resolves effective characters,
 * and runs the pure {@link deriveCharacterPlaySessions}.
 *
 * Short-circuits to `[]` for an empty/whitespace username before any query.
 * Logs and returns `[]` on any read error (R8.4); never throws.
 *
 * @param now accepted for signature consistency / deterministic tests; bounds
 *   the title history scanned (see {@link CHARACTER_TITLE_LOOKBACK_MS}).
 */
export async function getCharacterPlaySessions(
  username: string,
  client?: MinimalStreamerClient,
  now: Date = new Date(),
): Promise<CharacterPlaySession[]> {
  const normalized = username.trim();
  if (normalized.length === 0) return [];

  const c = client ?? defaultClient();
  const records = await readResolvedTitleRecords(normalized, c, now);
  if (records === null) return [];

  return deriveCharacterPlaySessions(records);
}

/**
 * Return the streamer's {@link CharacterCatalogEntry} list, most-recent first
 * (R3.1, R3.2, R3.3). Reads titles + extractions through the Data_Layer,
 * resolves effective characters, derives sessions, then builds the catalog.
 *
 * Short-circuits to `[]` for an empty/whitespace username before any query.
 * Logs and returns `[]` on any read error (R8.4); never throws.
 *
 * Clip counts: the catalog's `clipCount` is populated once
 * {@link getClipsForCharacter} (task 6.2) exists; until then an empty count map
 * is passed (clip counts are a display nicety and the catalog is derived from
 * sessions), so every entry reports `clipCount: 0`.
 *
 * @param now accepted for signature consistency / deterministic tests; bounds
 *   the title history scanned (see {@link CHARACTER_TITLE_LOOKBACK_MS}).
 */
export async function getCharacterCatalog(
  username: string,
  client?: MinimalStreamerClient,
  now: Date = new Date(),
): Promise<CharacterCatalogEntry[]> {
  const normalized = username.trim();
  if (normalized.length === 0) return [];

  const c = client ?? defaultClient();
  const records = await readResolvedTitleRecords(normalized, c, now);
  if (records === null) return [];

  const sessions = deriveCharacterPlaySessions(records);
  // Clip counts are populated once getClipsForCharacter (6.2) exists.
  const clipsByCharacter = new Map<string, number>();
  return buildCharacterCatalog(sessions, clipsByCharacter);
}

/**
 * Read a single clip source ('twitch_clips' or 'kick_clips') for a streamer and
 * map the rows to the unified {@link Clip} shape, with PER-SOURCE error
 * isolation (R8.4): on a query error or a thrown failure this logs and returns
 * `[]` so the OTHER source still contributes (mirrors
 * `streamerHasClipsOrStreams`'s per-table tolerance in `lib/streamers.ts`).
 *
 * Matching mirrors `getStreamerClips` (R8.3): narrow at the database with a
 * wildcard-escaped `ilike` + `is_valid = true`, then re-filter in memory with
 * {@link namesEqual} for exact case-insensitive streamer attribution.
 */
async function readCharacterClipSource(
  source: 'twitch' | 'kick',
  normalized: string,
  client: MinimalStreamerClient,
): Promise<Clip[]> {
  const escaped = escapeLikePattern(normalized);

  try {
    if (source === 'kick') {
      const { data, error } = await client
        .from<KickClipRow>(KICK_CLIPS_TABLE)
        .select(
          'clip_id, streamer_username, clip_title, view_count, duration_seconds, thumbnail_url, clip_url, kick_created_at, channel_slug',
        )
        .ilike('streamer_username', escaped)
        .eq('is_valid', true);
      if (error) {
        console.error('Error fetching Kick clips for character:', error);
        return [];
      }
      return (data ?? [])
        .filter((row) => namesEqual(row.streamer_username, normalized))
        .map(mapKickClip);
    }

    const { data, error } = await client
      .from<TwitchClipRow>(TWITCH_CLIPS_TABLE)
      .select(
        'clip_id, streamer_username, clip_title, view_count, duration_seconds, thumbnail_url, embed_url, twitch_created_at',
      )
      .ilike('streamer_username', escaped)
      .eq('is_valid', true);
    if (error) {
      console.error('Error fetching Twitch clips for character:', error);
      return [];
    }
    return (data ?? [])
      .filter((row) => namesEqual(row.streamer_username, normalized))
      .map(mapTwitchClip);
  } catch (err) {
    // Per-source isolation: a thrown failure on one source must not prevent the
    // other source from contributing (R8.4).
    console.error(`Error reading ${source} clips for character:`, err);
    return [];
  }
}

/**
 * Return EXACTLY the clips associated with `characterName` for a streamer,
 * ordered by `viewCount` DESCENDING (R5.1, R5.2, R5.3, R5.4). A clip is
 * associated with the character whose play session contains the clip's creation
 * timestamp ({@link associateClipToCharacter}); clips that fall in no session,
 * or in a different character's session, are excluded (R5.3 — exactness: no
 * extras, no omissions).
 *
 * Clips are read from `twitch_clips` and `kick_clips` INDEPENDENTLY with
 * per-source error isolation (R8.4): an error on one source is logged and that
 * source contributes nothing while the other still contributes. The streamer's
 * sessions are derived via {@link getCharacterPlaySessions} (which re-reads the
 * title history; acceptable). Reads route through the Data_Layer with
 * service-role default + exact case-insensitive streamer matching (R8.1, R8.3).
 *
 * Error handling (R8.4): the function never throws — it returns `[]` for an
 * empty/whitespace username or a `characterName` that normalizes to empty, on a
 * catastrophic failure, and naturally when sessions can't be derived (a read
 * error yields no sessions, so no clip associates).
 *
 * @param now accepted for deterministic tests; passed through to
 *   {@link getCharacterPlaySessions}. Defaults to the current time.
 */
export async function getClipsForCharacter(
  username: string,
  characterName: string,
  client?: MinimalStreamerClient,
  now: Date = new Date(),
): Promise<Clip[]> {
  try {
    const normalized = username.trim();
    if (normalized.length === 0) return [];

    // A character name that normalizes to empty can match nothing.
    const targetCharacter = normalizeCharacterName(characterName);
    if (targetCharacter === '') return [];

    const c = client ?? defaultClient();

    // Sessions for the streamer (re-reads titles/extractions; deterministic in
    // `now`). On a read error this is [], so no clip will associate -> [].
    const sessions = await getCharacterPlaySessions(username, c, now);

    // Read both clip sources independently (per-source error isolation, R8.4).
    const [twitchClips, kickClips] = await Promise.all([
      readCharacterClipSource('twitch', normalized, c),
      readCharacterClipSource('kick', normalized, c),
    ]);

    // Keep only clips whose associated character matches the requested one
    // (R5.1, R5.2); clips associating to no session or another character are
    // excluded (R5.3).
    const matching = [...twitchClips, ...kickClips].filter((clip) => {
      const associated = associateClipToCharacter(clip.createdAt, sessions);
      return associated !== null && charactersEqual(associated, targetCharacter);
    });

    // Order by view count descending (R5.4). Array.prototype.sort is stable in
    // Node 20, so equal-viewCount clips preserve their deterministic source
    // order (twitch then kick, each in read order).
    matching.sort((a, b) => b.viewCount - a.viewCount);

    return matching;
  } catch (err) {
    // The function as a whole must never throw (R8.4).
    console.error('Error fetching clips for character:', err);
    return [];
  }
}

/**
 * Default cap on the number of review-queue items returned when the caller does
 * not supply an explicit `opts.limit`. Keeps an unbounded `pending` backlog from
 * loading the whole table into the admin UI in one read; callers that genuinely
 * want everything can pass a larger explicit limit.
 */
const DEFAULT_REVIEW_QUEUE_LIMIT = 200;

/**
 * Return the admin review queue: the pending {@link ReviewQueueItem}s awaiting a
 * confirm / override / "no character" decision (R6.1). Reads
 * `character_extractions` where `review_state = 'pending'` (the below-threshold
 * extractions that {@link resolveEffectiveCharacter} excludes from the catalog
 * until an admin acts) and maps each row to the domain shape via
 * {@link mapExtractionRow}, adding `streamerDisplayName` from the stored
 * `streamer_name` (the best display name available at this layer).
 *
 * Ordering: by `confidence` ASCENDING so the lowest-confidence (most uncertain,
 * most-in-need-of-review) extractions surface first — the design says "ordered
 * by confidence" and ascending is the useful choice for a review workflow. This
 * lines up with the partial `idx_char_extractions_review (review_state,
 * confidence) where review_state = 'pending'` index.
 *
 * Bounding: when `opts.limit` is provided it is applied directly; otherwise a
 * {@link DEFAULT_REVIEW_QUEUE_LIMIT} cap is applied so an unbounded backlog never
 * loads in one read.
 *
 * Reads route through the Data_Layer with the service-role default (R8.1). Error
 * handling (R8.4): on a query error or any thrown failure this logs and returns
 * `[]`; it never throws.
 */
export async function getCharacterReviewQueue(
  opts?: { limit?: number },
  client?: MinimalStreamerClient,
): Promise<ReviewQueueItem[]> {
  try {
    const c = client ?? defaultClient();
    const limit = opts?.limit ?? DEFAULT_REVIEW_QUEUE_LIMIT;

    const { data, error } = await c
      .from<CharacterExtractionRow>(CHARACTER_EXTRACTIONS_TABLE)
      .select(
        'id, streamer_name, source_title, character_name, confidence, extraction_method, review_state, override_name, reviewed_by, reviewed_at',
      )
      .eq('review_state', 'pending')
      .order('confidence', { ascending: true })
      .limit(limit);
    if (error) {
      console.error('Error fetching character review queue:', error);
      return [];
    }

    return (data ?? []).map((row) => ({
      ...mapExtractionRow(row),
      streamerDisplayName: row.streamer_name,
    }));
  } catch (err) {
    // The function as a whole must never throw (R8.4).
    console.error('Error fetching character review queue:', err);
    return [];
  }
}

/* -------------------------------------------------------------------------- */
/* Processing (backfill + incremental)                                        */
/* -------------------------------------------------------------------------- */

/**
 * Outcome counters returned by {@link processStreamerTitles} (R9). `processed`
 * = distinct titles newly extracted + upserted this run; `reused` = distinct
 * titles whose stored extraction was reused with NO AI call (idempotency,
 * R2.8/R9.3); `aiCalls` = actual AI extraction requests issued this run.
 */
export interface ProcessResult {
  processed: number;
  reused: number;
  aiCalls: number;
}

/**
 * Default `Confidence_Threshold` (R6.1/R6.2): an extraction whose confidence is
 * at or above this AND which resolved to a real character is auto-`confirmed`;
 * everything else stays `pending` for admin review. Overridable per environment
 * via `CHARACTER_CONFIDENCE_THRESHOLD` (see {@link readConfidenceThreshold}).
 */
export const DEFAULT_CONFIDENCE_THRESHOLD = 0.7;

/**
 * Read + parse the effective confidence threshold from the
 * `CHARACTER_CONFIDENCE_THRESHOLD` environment variable, falling back to
 * {@link DEFAULT_CONFIDENCE_THRESHOLD} when unset, empty, or non-numeric (NaN),
 * and clamping any out-of-range value into the inclusive `[0, 1]` range so the
 * partition into `confirmed`/`pending` is always well defined.
 */
function readConfidenceThreshold(): number {
  const raw = process.env.CHARACTER_CONFIDENCE_THRESHOLD;
  if (raw === undefined || raw.trim() === '') {
    return DEFAULT_CONFIDENCE_THRESHOLD;
  }
  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) {
    return DEFAULT_CONFIDENCE_THRESHOLD;
  }
  return Math.min(1, Math.max(0, parsed));
}

/**
 * Derive the stored `review_state` for a freshly produced extraction (R6.1,
 * R6.2): `'confirmed'` only when the confidence is at or above `threshold` AND a
 * real (non-`null`) character was found; otherwise `'pending'`. A `null`
 * character — even with high confidence — stays `'pending'` so an admin still
 * reviews it (it carries no character to confirm).
 */
function deriveReviewState(
  confidence: number,
  characterName: string | null,
  threshold: number,
): ReviewState {
  if (characterName !== null && confidence >= threshold) {
    return 'confirmed';
  }
  return 'pending';
}

/* ---- Write-capable structural client (the read client is read-only) ---- */

/** Result envelope of a write to `character_extractions`. */
interface CharacterWriteResult {
  error: { message: string } | null;
}

/**
 * A thenable UPDATE chain over `character_extractions` used by
 * {@link applyAdminReview}. Mirrors the Supabase `update(patch).eq(col, value)`
 * builder: `.eq(...)` narrows the affected rows and is chainable, and the chain
 * itself is awaitable (extends `PromiseLike`) and resolves to a
 * {@link CharacterWriteResult}. Kept structural so the same real service-role
 * client (which supports both `.upsert` and `.update().eq()`) satisfies it and
 * an in-memory fake can model it for tests.
 */
interface CharacterUpdateChain extends PromiseLike<CharacterWriteResult> {
  eq(column: string, value: string | number | boolean): CharacterUpdateChain;
}

/**
 * The narrow WRITE surface of `character_extractions`. The shared
 * {@link MinimalStreamerClient} only exposes read chains (`select(...)`), so
 * this module defines its own write-capable structural client (adapted from the
 * service-role client at one boundary, the same pattern the read client uses)
 * and keeps it injectable so tests can supply a deterministic in-memory fake.
 *
 * Two write shapes are exposed because the real service-role client supports
 * both: `.upsert(...)` (used by {@link processStreamerTitles}) and an
 * UPDATE-by-id chain `.update(patch).eq('id', value)` (used by
 * {@link applyAdminReview}). Keeping `upsert` intact means the processing path
 * still compiles against the same `CharacterWriteClient`.
 */
interface CharacterUpsertTable {
  upsert(
    values: Record<string, unknown>,
    options?: { onConflict?: string },
  ): PromiseLike<CharacterWriteResult>;
  update(patch: Record<string, unknown>): CharacterUpdateChain;
}

/** Injectable write client over `character_extractions` (see above). */
export interface CharacterWriteClient {
  from(table: string): CharacterUpsertTable;
}

/** Build the default service-role-backed {@link CharacterWriteClient}. */
function defaultWriteClient(): CharacterWriteClient {
  return createServiceRoleClient() as unknown as CharacterWriteClient;
}

/** The unique index that backs the `(streamer, title)` idempotency key. */
const STREAMER_TITLE_CONFLICT_TARGET = 'lower(streamer_name), source_title';

/**
 * Best-effort detection of a Postgres unique-constraint violation from the
 * narrow `{ message }` error shape the write client surfaces. The idempotency
 * index `uq_char_extractions_streamer_title` raises SQLSTATE `23505`
 * ("duplicate key value violates unique constraint"); a conflict means the
 * `(streamer, title)` was already processed (e.g. by a concurrent run), so the
 * caller treats it as a reuse rather than an error (R2.8/R9.3).
 */
function isUniqueConstraintConflict(error: { message: string } | null): boolean {
  if (!error) return false;
  const message = error.message.toLowerCase();
  return (
    message.includes('23505') ||
    message.includes('duplicate key') ||
    message.includes('unique constraint')
  );
}

/**
 * Backfill / incremental title processor (R9.1, R9.2, R9.3, R9.4). Processes the
 * distinct `(streamer, title)` pairs for one streamer:
 *
 *  1. Load the streamer's existing {@link CHARACTER_EXTRACTIONS_TABLE} rows
 *     (same matching as every other read: wildcard-escaped `ilike` then
 *     {@link namesEqual} re-filter, R8.3) and build the set of already-processed
 *     `source_title` values keyed by exact title text — this cache table doubles
 *     as the "processed" ledger (R9.1).
 *  2. Read the distinct non-empty `stream_title` values from
 *     {@link STREAMS_TABLE} for the streamer (same matching).
 *  3. For each distinct title:
 *     - already processed (unchanged title text) → REUSE: no AI call,
 *       `reused += 1` (R2.8/R9.3, Property 7/22).
 *     - new/changed → call {@link extractCharacterFromTitle} (`aiCalls += 1`),
 *       then UPSERT a row with the extractor output and a `review_state` derived
 *       from {@link readConfidenceThreshold} (R6.1/R6.2). On success
 *       `processed += 1`. A unique-constraint conflict on the idempotency key is
 *       tolerated as "already processed" → `reused += 1` (no throw).
 *
 * Error handling (R8.4): per-title extraction/upsert failures are logged and
 * SKIPPED so the batch continues; the returned counts reflect only what actually
 * succeeded. A catastrophic read failure (cannot load extractions or titles, or
 * an empty/whitespace username) logs and returns `{ processed: 0, reused: 0,
 * aiCalls: 0 }`. The function never throws.
 *
 * Idempotency (R9.4): a second run over unchanged titles finds every title in
 * the processed ledger, issues zero AI calls, and performs zero writes —
 * `{ processed: 0, reused: N, aiCalls: 0 }`.
 *
 * @param opts.aiClient injectable {@link CharacterAiClient} (passed straight to
 *   {@link extractCharacterFromTitle}; defaults to the gateway-backed client).
 * @param opts.writeClient injectable {@link CharacterWriteClient} for the
 *   upserts (defaults to the service-role-backed client). The read `client`
 *   (titles + extractions) stays the read-only {@link MinimalStreamerClient},
 *   so the design's 4-argument signature is preserved by carrying the write
 *   client inside `opts`.
 * @param now accepted for signature consistency / deterministic tests; bounds
 *   the title history scanned for processing (see
 *   {@link CHARACTER_TITLE_LOOKBACK_MS}).
 */
export async function processStreamerTitles(
  username: string,
  opts?: { aiClient?: CharacterAiClient; writeClient?: CharacterWriteClient },
  client?: MinimalStreamerClient,
  now: Date = new Date(),
): Promise<ProcessResult> {
  const empty: ProcessResult = { processed: 0, reused: 0, aiCalls: 0 };

  const normalized = username.trim();
  if (normalized.length === 0) return empty;

  const readClient = client ?? defaultClient();
  const writeClient = opts?.writeClient ?? defaultWriteClient();
  const threshold = readConfidenceThreshold();
  const escaped = escapeLikePattern(normalized);

  // ---- Step 1+2: load the processed ledger and the distinct titles. A failure
  // here is catastrophic (we cannot know what to process) → log + safe zeros.
  let processedTitles: Set<string>;
  let distinctTitles: Set<string>;
  try {
    // Existing extractions = the "already processed" ledger (keyed by exact
    // title text, R9.1). Same matching as every other read (R8.3).
    const { data: extractionData, error: extractionError } = await readClient
      .from<CharacterExtractionRow>(CHARACTER_EXTRACTIONS_TABLE)
      .select(
        'id, streamer_name, source_title, character_name, confidence, extraction_method, review_state, override_name, reviewed_by, reviewed_at',
      )
      .ilike('streamer_name', escaped);
    if (extractionError) {
      console.error('Error loading character extractions for processing:', extractionError);
      return empty;
    }

    processedTitles = new Set<string>();
    for (const row of extractionData ?? []) {
      if (!namesEqual(row.streamer_name, normalized)) continue;
      // mapExtractionRow keeps the read pattern consistent even though only the
      // source_title is needed for the ledger.
      processedTitles.add(mapExtractionRow(row).sourceTitle);
    }

    // Distinct non-empty titles from the single stream table (both platforms).
    // Bounded by `created_at` + ordered most-recent first + hard row cap so a
    // busy streamer's full history is never scanned (same fix as the on-read
    // path; this admin-triggered read had the same unbounded-scan risk).
    const { data: titleData, error: titleError } = await readClient
      .from<StreamTitleRow>(STREAMS_TABLE)
      .select('id, streamer_name, stream_title, created_at')
      .ilike('streamer_name', escaped)
      .gte('created_at', new Date(now.getTime() - CHARACTER_TITLE_LOOKBACK_MS).toISOString())
      .order('created_at', { ascending: false })
      .limit(MAX_TITLE_ROWS);
    if (titleError) {
      console.error('Error loading streamer titles for processing:', titleError);
      return empty;
    }

    distinctTitles = new Set<string>();
    for (const row of titleData ?? []) {
      if (!namesEqual(row.streamer_name, normalized)) continue;
      const title = row.stream_title ?? '';
      if (title === '') continue; // non-empty titles only
      distinctTitles.add(title);
    }
  } catch (err) {
    // A thrown read failure is equally catastrophic → safe zeros (R8.4).
    console.error('Error loading data for title processing:', err);
    return empty;
  }

  // ---- Step 3: process each distinct title with per-title error isolation.
  let processed = 0;
  let reused = 0;
  let aiCalls = 0;

  for (const title of distinctTitles) {
    // Unchanged/already-processed title → reuse the stored result, no AI call
    // (R2.8/R9.3, Property 7/22).
    if (processedTitles.has(title)) {
      reused += 1;
      continue;
    }

    try {
      // New/changed title → one extraction (the injected client keeps this
      // deterministic + network-free in tests).
      const result = await extractCharacterFromTitle(title, opts?.aiClient);
      aiCalls += 1;

      const reviewState = deriveReviewState(result.confidence, result.characterName, threshold);
      const payload: Record<string, unknown> = {
        streamer_name: normalized,
        source_title: title,
        character_name: result.characterName,
        confidence: result.confidence,
        extraction_method: result.method,
        review_state: reviewState,
      };

      const writeResult = await writeClient
        .from(CHARACTER_EXTRACTIONS_TABLE)
        .upsert(payload, { onConflict: STREAMER_TITLE_CONFLICT_TARGET });

      if (writeResult.error) {
        // A unique-constraint conflict means a concurrent run already processed
        // this (streamer, title): tolerate it as a reuse rather than throwing
        // (R2.8/R9.3). Any other write error is logged + skipped.
        if (isUniqueConstraintConflict(writeResult.error)) {
          reused += 1;
        } else {
          console.error(`Error upserting extraction for title "${title}":`, writeResult.error);
        }
        continue;
      }

      processed += 1;
    } catch (err) {
      // Per-title failure (extraction or upsert): log + skip so the batch
      // continues; counts reflect only what actually succeeded (R8.4).
      console.error(`Error processing title "${title}":`, err);
    }
  }

  return { processed, reused, aiCalls };
}

/* -------------------------------------------------------------------------- */
/* Admin actions (confirm / override / no-character)                          */
/* -------------------------------------------------------------------------- */

/**
 * An admin correction applied to a single stored extraction (R6.3, R6.4, R6.5).
 * Each variant targets exactly one extraction by `extractionId` and records the
 * acting `reviewer`:
 *
 *  - `confirm`      → accept the extractor's character as-is.
 *  - `override`     → replace the character with the admin-supplied `name`.
 *  - `no-character` → mark the title as having no character (rejected).
 */
export type AdminAction =
  | { kind: 'confirm'; extractionId: number; reviewer: string }
  | { kind: 'override'; extractionId: number; name: string; reviewer: string }
  | { kind: 'no-character'; extractionId: number; reviewer: string };

/**
 * Apply an admin correction to a single `character_extractions` row (R6.3,
 * R6.4, R6.5). The mutation targets ONLY the row with `id === extractionId`
 * (`.eq('id', extractionId)`), setting the new `review_state`, the acting
 * `reviewed_by`, and a fresh `reviewed_at` ISO timestamp:
 *
 *  - `confirm`      → `review_state = 'confirmed'` (R6.3).
 *  - `override`     → `review_state = 'overridden'`, `override_name =
 *    normalizeCharacterName(name)` (R6.4). An override MUST supply a real name:
 *    when the normalized name is empty there is nothing to override to, so this
 *    is treated as a failure and returns `{ success: false }` WITHOUT writing.
 *  - `no-character` → `review_state = 'rejected'` (R6.5).
 *
 * Because sessions, the catalog, and clip associations are derived ON READ from
 * the stored state (never persisted), the next Data_Layer read automatically
 * re-derives them from this new row — no extra recompute is needed here (R6.6).
 *
 * Unknown id / no-op note: a Supabase `.update().eq('id', ...)` that matches no
 * row does NOT report an error by default, so an unknown `extractionId` resolves
 * to `{ success: true }` at the DB level even though it mutates NOTHING. That
 * still satisfies "without mutating other rows" — the `.eq('id', ...)` filter
 * guarantees only the single targeted row could ever change — and the route/UI
 * layer surfaces the real outcome to the admin. We deliberately keep this simple
 * and `.error`-driven rather than chaining a returning `.select()` (which the
 * narrow structural write client does not expose).
 *
 * Error handling (R8.4-style): the function NEVER throws. On any thrown error or
 * a returned `.error` it logs via `console.error(...)` and returns
 * `{ success: false }`; on a clean write it returns `{ success: true }`.
 */
export async function applyAdminReview(
  action: AdminAction,
  client?: CharacterWriteClient,
): Promise<{ success: boolean }> {
  try {
    const c = client ?? defaultWriteClient();

    // Build the column patch for the action. `reviewed_at` is a fresh ISO
    // timestamp; `reviewed_by` records the acting admin.
    const reviewedAt = new Date().toISOString();
    const patch: Record<string, unknown> = {
      reviewed_by: action.reviewer,
      reviewed_at: reviewedAt,
    };

    let reviewState: ReviewState;
    if (action.kind === 'confirm') {
      reviewState = 'confirmed';
    } else if (action.kind === 'no-character') {
      reviewState = 'rejected';
    } else {
      // override: must supply a real (non-empty after normalization) name.
      const overrideName = normalizeCharacterName(action.name);
      if (overrideName === '') {
        // Nothing to override to — treat as a failure without writing.
        return { success: false };
      }
      reviewState = 'overridden';
      patch.override_name = overrideName;
    }
    patch.review_state = reviewState;

    // UPDATE-by-id: only the row with this id can change (.eq('id', ...)).
    const { error } = await c
      .from(CHARACTER_EXTRACTIONS_TABLE)
      .update(patch)
      .eq('id', action.extractionId);

    if (error) {
      console.error('Error applying admin review:', error);
      return { success: false };
    }

    return { success: true };
  } catch (err) {
    // The function as a whole must never throw.
    console.error('Error applying admin review:', err);
    return { success: false };
  }
}
