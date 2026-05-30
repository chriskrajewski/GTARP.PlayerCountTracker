/**
 * Streamer-Centric Pages data access (R4).
 *
 * This module is the migration-safe `lib/` surface backing the Streamer_Profile
 * page (`app/streamers/[platform]/[username]/page.tsx`, task 10.6). Every read
 * the page needs lives here so pages/components never touch a database client
 * directly (R9.1) and the underlying client can change with the in-flight
 * Supabase -> Prisma/RDS migration without altering feature logic.
 *
 * Functions:
 * - {@link getStreamerProfile}      display name / platform / live status + no-data state (R4.1, R4.6)
 * - {@link getStreamerServers}      servers a streamer played on, from `streamer_server_history` (R4.2)
 * - {@link getStreamerClips}        clip history from `twitch_clips` / `kick_clips` (R4.3)
 * - {@link getStreamerLiveStatus}   current live status + viewer count (R4.1, R4.4)
 * - {@link getStreamerViewerTrend}  historical viewer-count trend over a range (R4.5)
 * - {@link linkPlatformIdentities}  per-platform Twitch + Kick identities (R4.7)
 *
 * Data sources & access style (R9.1, R9.3)
 * -----------------------------------------
 * `streamer_server_history`, `twitch_clips`, `kick_clips`, `twitch_streams`,
 * and `kick_streams` all have row-level security enabled with NO public SELECT
 * policy, so the anon browser/server clients cannot read them — the existing
 * clips API (`app/api/clips/[serverId]/route.ts`) reads them through the
 * service-role client. This module follows that same established access style:
 * the privileged streamer-scoped reads use the service-role client and run
 * SERVER-SIDE only (the Streamer_Profile page is a server component). Server
 * id -> name mapping reuses {@link getServers} from `lib/data.ts` rather than
 * opening a parallel `server_xref` query path (R9.3).
 *
 * Viewer trend scoping (Property 17 — R4.5)
 * -----------------------------------------
 * Viewer counts are NOT stored per streamer in the aggregate `viewer_count`
 * view consumed by `getViewerCounts` — that view sums viewers per SERVER, so it
 * could never yield a per-streamer trend (Property 17 would not hold). The
 * `twitch_streams` / `kick_streams` tables, however, record one row per matched
 * live stream with `streamer_name`, `viewer_count`, and `created_at`. We derive
 * the trend from those tables FILTERED BY `streamer_name` within the selected
 * range, which is genuinely streamer-scoped: every returned point both belongs
 * to the streamer (matched on `streamer_name`) and falls within the range
 * (bounded by `created_at`). This satisfies Property 17 precisely.
 *
 * Live status heuristic & limitation (R4.1, R4.4, R4.7)
 * -----------------------------------------------------
 * Neither stream table carries an explicit `is_live` flag. Mirroring
 * `lib/alerts.ts` (`createDefaultReadStreamerLive`), a streamer counts as
 * "currently live" when a row exists in the platform's stream table whose
 * `streamer_name` matches and whose `created_at` falls within a freshness
 * window ending at `now` ({@link STREAMER_LIVE_FRESHNESS_MS}); the current
 * viewer count is that most-recent row's `viewer_count`. This is best-effort:
 * it depends on the stream ETL having inserted a recent row, and a streamer who
 * stopped streaming within the window is briefly reported as live until the
 * window elapses.
 *
 * Matching & casing
 * -----------------
 * Streamer usernames are case-insensitive on both platforms and are stored with
 * inconsistent casing (clips lowercase the username; history preserves it). All
 * matching therefore narrows at the database with a wildcard-escaped `ilike`
 * (like `lib/alerts.ts`) AND re-filters in memory by exact case-insensitive
 * equality, so a row is attributed to a streamer only when its name equals the
 * requested name — no over-matching from `_`/`%` wildcards. This keeps
 * Properties 15/16/18 exact ("no extras, no omissions").
 *
 * Testability
 * -----------
 * Each function accepts an optional {@link MinimalStreamerClient} so the
 * property tests (tasks 10.2-10.5) can inject a deterministic fake instead of a
 * live database; the default builds from the service-role client. `now` is also
 * injectable on the time-sensitive functions so live-status / range scoping are
 * deterministic in tests.
 *
 * Error handling: every read logs and returns a safe empty value (`[]` /
 * `null`), mirroring `lib/data.ts`.
 */
import type { ServerData, TimeRange } from './data';
import { getServers } from './data';
import { createServiceRoleClient } from './supabase-service-role';
import type { StreamerPlatform } from './alerts';

// Re-export so consumers can import the platform literal type from one place.
export type { StreamerPlatform };

/* -------------------------------------------------------------------------- */
/* Table names                                                                */
/* -------------------------------------------------------------------------- */

const STREAMER_SERVER_HISTORY_TABLE = 'streamer_server_history';
const TWITCH_CLIPS_TABLE = 'twitch_clips';
const KICK_CLIPS_TABLE = 'kick_clips';
const TWITCH_STREAMS_TABLE = 'twitch_streams';
const KICK_STREAMS_TABLE = 'kick_streams';

/** All platform literals, in a stable display order (Twitch first). */
const ALL_PLATFORMS: readonly StreamerPlatform[] = ['twitch', 'kick'];

/**
 * How recently a streamer must have been observed (a row in
 * `twitch_streams` / `kick_streams`) to count as "currently live". Aligned with
 * `lib/alerts.ts`'s `STREAMER_LIVE_FRESHNESS_MS` so both subsystems share the
 * same best-effort definition of "live".
 */
export const STREAMER_LIVE_FRESHNESS_MS = 10 * 60 * 1000;

/* -------------------------------------------------------------------------- */
/* Public types                                                               */
/* -------------------------------------------------------------------------- */

/**
 * A unified clip shape covering both Twitch and Kick (R4.3). `url` is the
 * platform's playable link (Twitch `embed_url`, Kick `clip_url`); `channelSlug`
 * is Kick-only. `createdAt` is the platform's own creation timestamp
 * (`twitch_created_at` / `kick_created_at`).
 */
export interface Clip {
  clipId: string;
  streamerUsername: string;
  title: string;
  viewCount: number;
  durationSeconds: number;
  thumbnailUrl: string;
  url: string;
  createdAt: string;
  platform: StreamerPlatform;
  channelSlug?: string;
}

/** Current live status for a streamer on a single platform (R4.1, R4.4). */
export interface LiveStatus {
  isLive: boolean;
  /** Present only while live; the most recent observed viewer count (R4.4). */
  viewerCount?: number;
  platform: StreamerPlatform;
}

/** A single point in a streamer's historical viewer-count trend (R4.5). */
export interface ViewerTrendPoint {
  timestamp: string;
  viewerCount: number;
}

/**
 * One platform identity for a streamer (R4.7). A streamer present on both
 * Twitch and Kick yields one of these per platform, each with its own live
 * status (Property 18).
 */
export interface PlatformIdentity {
  platform: StreamerPlatform;
  username: string;
  isLive: boolean;
  viewerCount?: number;
}

/**
 * Assembled streamer profile (R4.1, R4.6). Carries the display name, the
 * requested platform, the current live status for that platform, every linked
 * platform identity, and (when known) the profile image. `getStreamerProfile`
 * returns `null` when the streamer has no recorded history at all (R4.6).
 */
export interface StreamerProfile {
  /** Normalized (trimmed) username the profile was requested for. */
  username: string;
  /** Best-effort display name (recorded username casing, falls back to input). */
  displayName: string;
  /** The platform this profile view is scoped to. */
  platform: StreamerPlatform;
  /** Current live status on {@link platform} (R4.1, R4.4). */
  liveStatus: LiveStatus;
  /** Every platform the streamer is recorded on, each with live status (R4.7). */
  identities: PlatformIdentity[];
  /** Profile image, when recorded in `streamer_server_history`. */
  profileImageUrl?: string;
}

/* -------------------------------------------------------------------------- */
/* Minimal structural client (untyped tables adapted at one boundary)         */
/* -------------------------------------------------------------------------- */

type PgError = { message: string };

/** A read chain supporting the filters/ordering these reads use. */
interface StreamerReadChain<T> extends PromiseLike<{ data: T[] | null; error: PgError | null }> {
  eq(column: string, value: string | number | boolean): StreamerReadChain<T>;
  ilike(column: string, value: string): StreamerReadChain<T>;
  gte(column: string, value: string): StreamerReadChain<T>;
  lte(column: string, value: string): StreamerReadChain<T>;
  order(column: string, options: { ascending: boolean }): StreamerReadChain<T>;
  limit(count: number): StreamerReadChain<T>;
}

interface StreamerTable<T> {
  select(columns?: string): StreamerReadChain<T>;
}

/**
 * The narrow structural surface of the Supabase client this module uses. The
 * clips/history/stream tables (except `twitch_streams`) are not in the
 * generated `Database` type, so the service-role client is adapted here at a
 * single boundary — the same approach used by `lib/alerts.ts`,
 * `lib/web-push.ts`, and `lib/owner-scoped.ts`. Injectable so tests can supply
 * a deterministic fake.
 */
export interface MinimalStreamerClient {
  from<T>(table: string): StreamerTable<T>;
}

/** Build the default service-role-backed client (server-side reads only). */
function defaultClient(): MinimalStreamerClient {
  return createServiceRoleClient() as unknown as MinimalStreamerClient;
}

/* -------------------------------------------------------------------------- */
/* Persisted row shapes                                                       */
/* -------------------------------------------------------------------------- */

interface StreamerHistoryRow {
  serverId: string;
  platform: string;
  streamer_username: string;
  profile_image_url?: string | null;
}

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

interface StreamLiveRow {
  streamer_name: string;
  viewer_count: number;
  created_at: string | null;
}

interface StreamTrendRow {
  streamer_name: string;
  viewer_count: number;
  created_at: string | null;
}

interface ExistenceRow {
  id: number;
}

/* -------------------------------------------------------------------------- */
/* Internal helpers                                                           */
/* -------------------------------------------------------------------------- */

/**
 * Escape SQL LIKE/ILIKE wildcards (`\`, `%`, `_`) so a username containing an
 * underscore is matched literally rather than as a single-character wildcard.
 */
function escapeLikePattern(value: string): string {
  return value.replace(/[\\%_]/g, (ch) => `\\${ch}`);
}

/** Case-insensitive exact match used to re-filter loose `ilike` results. */
function namesEqual(a: string, b: string): boolean {
  return a.toLowerCase() === b.toLowerCase();
}

/**
 * Compute the inclusive lower bound for a time range relative to `now`, or
 * `null` for an unbounded ("all") range. Mirrors the range durations used
 * across `lib/data.ts`. `live` is treated as the most recent hour.
 */
function rangeStartDate(timeRange: TimeRange, now: Date): Date | null {
  const MINUTE = 60 * 1000;
  const HOUR = 60 * MINUTE;
  const DAY = 24 * HOUR;
  const t = now.getTime();

  switch (timeRange) {
    case 'live':
    case '1h':
      return new Date(t - HOUR);
    case '2h':
      return new Date(t - 2 * HOUR);
    case '4h':
      return new Date(t - 4 * HOUR);
    case '6h':
      return new Date(t - 6 * HOUR);
    case '8h':
      return new Date(t - 8 * HOUR);
    case '24h':
      return new Date(t - 24 * HOUR);
    case '7d':
      return new Date(t - 7 * DAY);
    case '30d':
      return new Date(t - 30 * DAY);
    case '90d':
      return new Date(t - 90 * DAY);
    case '180d':
      return new Date(t - 180 * DAY);
    case '365d':
      return new Date(t - 365 * DAY);
    case 'all':
    default:
      return null;
  }
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
 * Existence check used only by the {@link getStreamerProfile} empty-state path
 * (R4.6): does the streamer have ANY clip or stream row on either platform?
 * Returns `true` on the first hit; swallows per-table errors so a single
 * missing/locked table never blocks the others.
 */
async function streamerHasClipsOrStreams(
  username: string,
  client: MinimalStreamerClient,
): Promise<boolean> {
  const escaped = escapeLikePattern(username);
  const sources: Array<{ table: string; column: string }> = [
    { table: TWITCH_CLIPS_TABLE, column: 'streamer_username' },
    { table: KICK_CLIPS_TABLE, column: 'streamer_username' },
    { table: TWITCH_STREAMS_TABLE, column: 'streamer_name' },
    { table: KICK_STREAMS_TABLE, column: 'streamer_name' },
  ];

  for (const { table, column } of sources) {
    const { data, error } = await client
      .from<ExistenceRow>(table)
      .select('id')
      .ilike(column, escaped)
      .limit(1);
    if (!error && data && data.length > 0) {
      return true;
    }
  }
  return false;
}

/* -------------------------------------------------------------------------- */
/* getStreamerServers (R4.2 — Property 15)                                    */
/* -------------------------------------------------------------------------- */

/**
 * Return EXACTLY the set of distinct servers a streamer is recorded as having
 * played on, derived from `streamer_server_history` (R4.2 / Property 15).
 *
 * Rows are narrowed at the database with a wildcard-escaped `ilike` then
 * re-filtered in memory to an exact case-insensitive username match, so no
 * other streamer's servers leak in. Distinct `"serverId"` values are mapped to
 * {@link ServerData} via the reused {@link getServers} (R9.3); a server with no
 * `server_xref` entry falls back to a `Server <id>` name but is still included,
 * preserving "no omissions". Optionally restrict to a single `platform`.
 *
 * Returns `[]` on error or when the streamer has no history.
 */
export async function getStreamerServers(
  username: string,
  platform?: StreamerPlatform,
  client?: MinimalStreamerClient,
): Promise<ServerData[]> {
  const normalized = username.trim();
  if (normalized.length === 0) return [];

  const c = client ?? defaultClient();
  let chain = c
    .from<StreamerHistoryRow>(STREAMER_SERVER_HISTORY_TABLE)
    .select('serverId, platform, streamer_username')
    .ilike('streamer_username', escapeLikePattern(normalized));
  if (platform) {
    chain = chain.eq('platform', platform);
  }

  const { data, error } = await chain;
  if (error) {
    console.error('Error fetching streamer server history:', error);
    return [];
  }

  // Exact (case-insensitive) re-filter + distinct serverIds (no extras, no dupes).
  const distinctIds: string[] = [];
  const seen = new Set<string>();
  for (const row of data ?? []) {
    if (!namesEqual(row.streamer_username, normalized)) continue;
    if (platform && row.platform !== platform) continue;
    if (!row.serverId || seen.has(row.serverId)) continue;
    seen.add(row.serverId);
    distinctIds.push(row.serverId);
  }
  if (distinctIds.length === 0) return [];

  // Resolve display names via the shared reader; tolerate its failure so the
  // exact set of servers is still returned (Property 15 cares about the set).
  let nameById = new Map<string, string>();
  try {
    const servers = await getServers();
    nameById = new Map(servers.map((s) => [s.server_id, s.server_name]));
  } catch (err) {
    console.error('Error resolving server names for streamer servers:', err);
  }

  return distinctIds.map((id) => ({
    server_id: id,
    server_name: nameById.get(id) ?? `Server ${id}`,
  }));
}

/* -------------------------------------------------------------------------- */
/* getStreamerClips (R4.3 — Property 16)                                      */
/* -------------------------------------------------------------------------- */

/**
 * Return EXACTLY the valid clips attributed to a streamer on the given platform
 * (R4.3 / Property 16), sourced from `twitch_clips` (platform `'twitch'`) or
 * `kick_clips` (platform `'kick'`). Filters `is_valid = true` and matches the
 * streamer with a wildcard-escaped `ilike` plus an exact in-memory re-filter so
 * no other streamer's clips are included. Ordered by view count descending.
 *
 * Returns `[]` on error or when the streamer has no clips on that platform.
 */
export async function getStreamerClips(
  username: string,
  platform: StreamerPlatform,
  client?: MinimalStreamerClient,
): Promise<Clip[]> {
  const normalized = username.trim();
  if (normalized.length === 0) return [];

  const c = client ?? defaultClient();
  const escaped = escapeLikePattern(normalized);

  if (platform === 'kick') {
    const { data, error } = await c
      .from<KickClipRow>(KICK_CLIPS_TABLE)
      .select(
        'clip_id, streamer_username, clip_title, view_count, duration_seconds, thumbnail_url, clip_url, kick_created_at, channel_slug',
      )
      .ilike('streamer_username', escaped)
      .eq('is_valid', true)
      .order('view_count', { ascending: false });
    if (error) {
      console.error('Error fetching Kick clips for streamer:', error);
      return [];
    }
    return (data ?? [])
      .filter((row) => namesEqual(row.streamer_username, normalized))
      .map(mapKickClip);
  }

  const { data, error } = await c
    .from<TwitchClipRow>(TWITCH_CLIPS_TABLE)
    .select(
      'clip_id, streamer_username, clip_title, view_count, duration_seconds, thumbnail_url, embed_url, twitch_created_at',
    )
    .ilike('streamer_username', escaped)
    .eq('is_valid', true)
    .order('view_count', { ascending: false });
  if (error) {
    console.error('Error fetching Twitch clips for streamer:', error);
    return [];
  }
  return (data ?? [])
    .filter((row) => namesEqual(row.streamer_username, normalized))
    .map(mapTwitchClip);
}

/* -------------------------------------------------------------------------- */
/* getStreamerLiveStatus (R4.1, R4.4)                                         */
/* -------------------------------------------------------------------------- */

/**
 * Determine whether a streamer is currently live on a platform and, if so,
 * their current viewer count (R4.1, R4.4). Best-effort heuristic mirroring
 * `lib/alerts.ts`: the streamer is live when the platform's stream table holds
 * a row for them whose `created_at` is within {@link STREAMER_LIVE_FRESHNESS_MS}
 * of `now`; the viewer count is that most-recent row's `viewer_count`.
 *
 * Returns `{ isLive: false, platform }` on error, empty input, or when no recent
 * row exists.
 */
export async function getStreamerLiveStatus(
  platform: StreamerPlatform,
  username: string,
  client?: MinimalStreamerClient,
  now: Date = new Date(),
): Promise<LiveStatus> {
  const normalized = username.trim();
  if (normalized.length === 0) return { isLive: false, platform };

  const c = client ?? defaultClient();
  const table = platform === 'kick' ? KICK_STREAMS_TABLE : TWITCH_STREAMS_TABLE;
  const since = new Date(now.getTime() - STREAMER_LIVE_FRESHNESS_MS).toISOString();

  const { data, error } = await c
    .from<StreamLiveRow>(table)
    .select('streamer_name, viewer_count, created_at')
    .ilike('streamer_name', escapeLikePattern(normalized))
    .gte('created_at', since)
    .order('created_at', { ascending: false })
    .limit(1);
  if (error) {
    console.error('Error fetching streamer live status:', error);
    return { isLive: false, platform };
  }

  const row = (data ?? []).find((r) => namesEqual(r.streamer_name, normalized));
  if (!row) return { isLive: false, platform };

  return { isLive: true, viewerCount: row.viewer_count, platform };
}

/* -------------------------------------------------------------------------- */
/* getStreamerViewerTrend (R4.5 — Property 17)                                */
/* -------------------------------------------------------------------------- */

/**
 * Return a streamer's historical viewer-count trend over a selectable range
 * (R4.5 / Property 17). Derived from the per-stream rows in `twitch_streams` /
 * `kick_streams` filtered by `streamer_name` — NOT the server-keyed
 * `viewer_count` view (see the module header), so the result is genuinely
 * streamer-scoped: every returned point both belongs to the streamer and falls
 * within the selected range.
 *
 * Bounds are applied at the database (`gte`/`lte` on `created_at`) AND re-checked
 * in memory (exact streamer name + `since <= ts <= now`) so the scoping holds
 * regardless of wildcard/`ilike` looseness. When `platform` is omitted, both
 * platforms are combined; points are returned sorted by timestamp ascending.
 *
 * Returns `[]` on error or when the streamer has no stream rows in range.
 */
export async function getStreamerViewerTrend(
  username: string,
  timeRange: TimeRange,
  platform?: StreamerPlatform,
  client?: MinimalStreamerClient,
  now: Date = new Date(),
): Promise<ViewerTrendPoint[]> {
  const normalized = username.trim();
  if (normalized.length === 0) return [];

  const c = client ?? defaultClient();
  const escaped = escapeLikePattern(normalized);
  const since = rangeStartDate(timeRange, now);
  const sinceMs = since ? since.getTime() : null;
  const nowMs = now.getTime();
  const platforms = platform ? [platform] : ALL_PLATFORMS;

  const points: ViewerTrendPoint[] = [];

  for (const p of platforms) {
    const table = p === 'kick' ? KICK_STREAMS_TABLE : TWITCH_STREAMS_TABLE;
    let chain = c
      .from<StreamTrendRow>(table)
      .select('streamer_name, viewer_count, created_at')
      .ilike('streamer_name', escaped);
    if (since) {
      chain = chain.gte('created_at', since.toISOString());
    }
    chain = chain.lte('created_at', now.toISOString()).order('created_at', { ascending: true });

    const { data, error } = await chain;
    if (error) {
      console.error(`Error fetching ${p} viewer trend for streamer:`, error);
      continue;
    }

    for (const row of data ?? []) {
      if (!row.created_at) continue;
      if (!namesEqual(row.streamer_name, normalized)) continue;
      const ts = new Date(row.created_at).getTime();
      if (Number.isNaN(ts)) continue;
      if (sinceMs !== null && ts < sinceMs) continue;
      if (ts > nowMs) continue;
      points.push({ timestamp: row.created_at, viewerCount: row.viewer_count });
    }
  }

  points.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
  return points;
}

/* -------------------------------------------------------------------------- */
/* linkPlatformIdentities (R4.7 — Property 18)                                */
/* -------------------------------------------------------------------------- */

/**
 * Return every platform identity a streamer is recorded under (R4.7 /
 * Property 18). The set of platforms is derived from `streamer_server_history`
 * (the CHECK constraint guarantees each row is `'twitch'` or `'kick'`); a
 * streamer present on BOTH platforms yields both identities, each carrying its
 * own live status from {@link getStreamerLiveStatus}.
 *
 * Returns `[]` on error or when the streamer has no recorded history.
 */
export async function linkPlatformIdentities(
  username: string,
  client?: MinimalStreamerClient,
  now: Date = new Date(),
): Promise<PlatformIdentity[]> {
  const normalized = username.trim();
  if (normalized.length === 0) return [];

  const c = client ?? defaultClient();
  const { data, error } = await c
    .from<StreamerHistoryRow>(STREAMER_SERVER_HISTORY_TABLE)
    .select('platform, streamer_username')
    .ilike('streamer_username', escapeLikePattern(normalized));
  if (error) {
    console.error('Error fetching streamer platform identities:', error);
    return [];
  }

  const platforms = new Set<StreamerPlatform>();
  for (const row of data ?? []) {
    if (!namesEqual(row.streamer_username, normalized)) continue;
    if (row.platform === 'twitch' || row.platform === 'kick') {
      platforms.add(row.platform);
    }
  }

  const identities: PlatformIdentity[] = [];
  for (const p of ALL_PLATFORMS) {
    if (!platforms.has(p)) continue;
    const live = await getStreamerLiveStatus(p, normalized, c, now);
    identities.push({
      platform: p,
      username: normalized,
      isLive: live.isLive,
      viewerCount: live.viewerCount,
    });
  }
  return identities;
}

/* -------------------------------------------------------------------------- */
/* getStreamerProfile (R4.1, R4.6)                                            */
/* -------------------------------------------------------------------------- */

/**
 * Assemble a streamer's {@link StreamerProfile} for the requested platform
 * (R4.1): display name, platform, current live status, every linked platform
 * identity, and (when recorded) the profile image.
 *
 * Empty-state (R4.6): when the streamer has NO recorded history of any kind —
 * no `streamer_server_history` rows, no clips, and no stream rows — this returns
 * `null` so the page can render a "no data available" message rather than an
 * empty profile.
 *
 * Returns `null` on empty input.
 */
export async function getStreamerProfile(
  platform: StreamerPlatform,
  username: string,
  client?: MinimalStreamerClient,
  now: Date = new Date(),
): Promise<StreamerProfile | null> {
  const normalized = username.trim();
  if (normalized.length === 0) return null;

  const c = client ?? defaultClient();

  // Linked identities double as the primary "has history" signal (R4.6): the
  // CHECK constraint means a non-empty result implies at least one history row.
  const identities = await linkPlatformIdentities(normalized, c, now);
  const liveStatus = await getStreamerLiveStatus(platform, normalized, c, now);

  // Best-effort display name + profile image from the recorded history row.
  let displayName = normalized;
  let profileImageUrl: string | undefined;
  const { data: histRows, error: histError } = await c
    .from<StreamerHistoryRow>(STREAMER_SERVER_HISTORY_TABLE)
    .select('streamer_username, profile_image_url')
    .ilike('streamer_username', escapeLikePattern(normalized))
    .limit(5);
  if (!histError) {
    const match = (histRows ?? []).find((r) => namesEqual(r.streamer_username, normalized));
    if (match) {
      if (match.streamer_username) displayName = match.streamer_username;
      if (match.profile_image_url) profileImageUrl = match.profile_image_url;
    }
  }

  // Empty-state determination (R4.6): no history AND no clips AND no streams.
  let hasData = identities.length > 0 || liveStatus.isLive;
  if (!hasData) {
    hasData = await streamerHasClipsOrStreams(normalized, c);
  }
  if (!hasData) return null;

  return {
    username: normalized,
    displayName,
    platform,
    liveStatus,
    identities,
    profileImageUrl,
  };
}
