/**
 * Per-user alert subscription persistence for the Alert_System (R3).
 *
 * This module owns the subscription CRUD surface backing the alerts feature:
 * creating, listing, editing, and deleting an App_User's own
 * {@link AlertSubscription}s. Two rule types are supported (R3.1, R3.2):
 *
 * - `player_count_below` — alert when a target server's player count drops
 *   below a user-chosen integer threshold.
 * - `streamer_live`      — alert when a tracked streamer goes live on Twitch or
 *   Kick.
 *
 * Ownership (R9.4): EVERY database operation routes through the shared
 * owner-scoped accessor in `lib/owner-scoped.ts` — there is no direct
 * `.from('alert_subscriptions')` call here — so each row stays scoped to its
 * owning `app_users.id` and the guarantee survives the in-flight Supabase ->
 * Prisma/RDS migration (R9.1). The core functions take a PRE-RESOLVED owner id;
 * the `*ForUser` wrappers resolve it from a Supabase auth `User` first and
 * return an authentication-required failure when no identity can be resolved
 * (R3.3 / Property 10).
 *
 * Scope: this is the CRUD layer only. The edge-triggered evaluation engine
 * (`evaluateAlertSubscriptions`, R3.5–R3.7) is implemented separately; the
 * shared row/type definitions it reuses (e.g. {@link AlertSubscriptionRow},
 * {@link ConditionState}) are exported from here.
 *
 * Requirement mapping:
 * - R3.1 create "player count below" rule  -> {@link createSubscription}
 * - R3.2 create "streamer live" rule        -> {@link createSubscription}
 * - R3.3 create requires authentication     -> {@link createSubscriptionForUser}
 * - R3.8 view / edit / delete own rules      -> {@link listSubscriptions},
 *        {@link updateSubscription}, {@link deleteSubscription}
 * - R9.4 per-user rows owner-scoped          -> all access via owner-scoped accessor
 */
import type { SupabaseClient, User } from '@supabase/supabase-js';
import {
  createSupabaseOwnerScopedAccessor,
  createOwnerScopedAccessorForUser,
  type OwnerInsert,
  type OwnerScopedRow,
  type OwnerUpdate,
} from '@/lib/owner-scoped';
import type { Database } from '@/lib/supabase.types';
import { supabase } from '@/lib/supabase';
import { createServerClient } from '@/lib/supabase-server';
import { createServiceRoleClient } from '@/lib/supabase-service-role';
import {
  deliverToUser,
  type NotificationPayload,
  type DeliverToUserSummary,
} from '@/lib/web-push';

/* -------------------------------------------------------------------------- */
/* Shared types (reused by the evaluation engine, task 7.9)                   */
/* -------------------------------------------------------------------------- */

/** The two supported alert rule types (R3.1, R3.2). */
export type AlertSubscriptionType = 'player_count_below' | 'streamer_live';

/** Streaming platform for `streamer_live` rules. */
export type StreamerPlatform = 'twitch' | 'kick';

/**
 * Edge-trigger state carried by each subscription (R3.7). A notification fires
 * only on a `cleared -> met` transition; the evaluation engine (task 7.9) reads
 * and advances this state.
 */
export type ConditionState = 'met' | 'cleared';

/** The `alert_subscriptions` table name. All access goes through the accessor. */
const ALERT_SUBSCRIPTIONS_TABLE = 'alert_subscriptions';

/** Sentinel value persisted for a freshly created subscription's trigger state. */
const INITIAL_CONDITION_STATE: ConditionState = 'cleared';

/** Error surfaced when a create/edit/delete is attempted with no resolved owner (R3.3). */
export const AUTH_REQUIRED_ERROR = 'You must be signed in to manage alert subscriptions.';

/**
 * The persisted `alert_subscriptions` row shape (snake_case), mirroring
 * `api2db/sql/alert_subscriptions_schema.sql`. Extends {@link OwnerScopedRow}
 * so it plugs directly into the owner-scoped accessor. Defined here as the
 * single source of truth shared with the evaluation engine (task 7.9).
 */
export interface AlertSubscriptionRow extends OwnerScopedRow {
  type: AlertSubscriptionType;
  /** Target FiveM server id for `player_count_below` rules; null otherwise. */
  server_id: string | null;
  /** Player-count threshold for `player_count_below` rules; null otherwise. */
  threshold: number | null;
  /** Tracked streamer username for `streamer_live` rules; null otherwise. */
  streamer_username: string | null;
  /** Streamer platform for `streamer_live` rules; null otherwise. */
  streamer_platform: StreamerPlatform | null;
  is_enabled: boolean;
  last_condition_state: ConditionState;
  last_triggered_at: string | null;
  created_at: string;
  updated_at: string;
}

/* -------------------------------------------------------------------------- */
/* Client-facing representations (camelCase, discriminated by `type`)         */
/* -------------------------------------------------------------------------- */

/** Fields common to every client-facing {@link AlertSubscription}. */
interface AlertSubscriptionBase {
  id: number;
  userId: number;
  isEnabled: boolean;
  lastConditionState: ConditionState;
  lastTriggeredAt: string | null;
  createdAt: string;
  updatedAt: string;
}

/** A "player count below threshold" subscription (R3.1). */
export interface PlayerCountBelowSubscription extends AlertSubscriptionBase {
  type: 'player_count_below';
  serverId: string;
  threshold: number;
}

/** A "streamer live" subscription (R3.2). */
export interface StreamerLiveSubscription extends AlertSubscriptionBase {
  type: 'streamer_live';
  streamerUsername: string;
  streamerPlatform: StreamerPlatform;
}

/**
 * The client-facing subscription, discriminated by `type`. Either a
 * {@link PlayerCountBelowSubscription} or a {@link StreamerLiveSubscription}.
 */
export type AlertSubscription = PlayerCountBelowSubscription | StreamerLiveSubscription;

/**
 * Input accepted by {@link createSubscription}, discriminated by `type` so the
 * required fields for each rule are enforced at compile time. Runtime
 * validation in {@link validateNewSubscription} guards against bad values that
 * slip past the type (e.g. from JSON request bodies).
 */
export type NewAlertSubscription =
  | { type: 'player_count_below'; serverId: string; threshold: number }
  | { type: 'streamer_live'; streamerUsername: string; streamerPlatform: StreamerPlatform };

/**
 * The editable subset of a subscription (R3.8). `type` is immutable (it would
 * change which fields are meaningful), and identity/ownership/trigger-state
 * columns are never client-writable. Unknown fields are ignored by the mapping.
 */
export interface AlertSubscriptionUpdate {
  isEnabled?: boolean;
  serverId?: string;
  threshold?: number;
  streamerUsername?: string;
  streamerPlatform?: StreamerPlatform;
}

/** Discriminated result of {@link createSubscription} / {@link updateSubscription}. */
export type SubscriptionMutationResult =
  | { ok: true; data: AlertSubscription }
  | { ok: false; error: string };

/* -------------------------------------------------------------------------- */
/* Internal helpers                                                           */
/* -------------------------------------------------------------------------- */

/**
 * Select the Supabase client following the convention used across `lib/data.ts`
 * and `lib/comparison-prefs.ts`: a caller-supplied client wins (e.g. an authed
 * route-handler client); otherwise the browser singleton is used in the browser
 * and a fresh server client on the server.
 */
function resolveClient(supabaseClient?: SupabaseClient<Database>): SupabaseClient<Database> {
  if (supabaseClient) return supabaseClient;
  return (
    typeof window !== 'undefined' ? supabase : createServerClient()
  ) as unknown as SupabaseClient<Database>;
}

/** All valid {@link StreamerPlatform} literals, used to validate input. */
const VALID_STREAMER_PLATFORMS: readonly StreamerPlatform[] = ['twitch', 'kick'];

/**
 * Validate a {@link NewAlertSubscription} by type (R3.1, R3.2):
 *
 * - `player_count_below` requires a non-empty `serverId` and an integer
 *   `threshold`.
 * - `streamer_live` requires a non-empty `streamerUsername` and a valid
 *   `streamerPlatform` ('twitch' | 'kick').
 *
 * Returns the normalized (trimmed) input on success, or a UI-displayable error
 * message on failure.
 */
function validateNewSubscription(
  sub: NewAlertSubscription,
): { ok: true; value: NewAlertSubscription } | { ok: false; error: string } {
  if (sub.type === 'player_count_below') {
    const serverId = typeof sub.serverId === 'string' ? sub.serverId.trim() : '';
    if (serverId.length === 0) {
      return { ok: false, error: 'A target server is required for a player-count alert.' };
    }
    if (!Number.isInteger(sub.threshold)) {
      return { ok: false, error: 'Threshold must be a whole number.' };
    }
    return { ok: true, value: { type: 'player_count_below', serverId, threshold: sub.threshold } };
  }

  if (sub.type === 'streamer_live') {
    const streamerUsername =
      typeof sub.streamerUsername === 'string' ? sub.streamerUsername.trim() : '';
    if (streamerUsername.length === 0) {
      return { ok: false, error: 'A streamer username is required for a streamer-live alert.' };
    }
    if (!VALID_STREAMER_PLATFORMS.includes(sub.streamerPlatform)) {
      return { ok: false, error: "Platform must be either 'twitch' or 'kick'." };
    }
    return {
      ok: true,
      value: {
        type: 'streamer_live',
        streamerUsername,
        streamerPlatform: sub.streamerPlatform,
      },
    };
  }

  // Exhaustiveness guard: an unrecognized type never produces a valid payload.
  return { ok: false, error: 'Unsupported alert subscription type.' };
}

/**
 * Map a VALIDATED {@link NewAlertSubscription} to the owner-scoped insert
 * payload. The accessor forces `user_id`, so the owner id is intentionally
 * absent here. Unused columns are left null; `is_enabled` defaults true and the
 * edge-trigger state starts `cleared` (R3.7).
 */
function toInsertPayload(sub: NewAlertSubscription): OwnerInsert<AlertSubscriptionRow> {
  const nowIso = new Date().toISOString();
  const base: OwnerInsert<AlertSubscriptionRow> = {
    type: sub.type,
    server_id: null,
    threshold: null,
    streamer_username: null,
    streamer_platform: null,
    is_enabled: true,
    last_condition_state: INITIAL_CONDITION_STATE,
    last_triggered_at: null,
    created_at: nowIso,
    updated_at: nowIso,
  };

  if (sub.type === 'player_count_below') {
    return { ...base, server_id: sub.serverId, threshold: sub.threshold };
  }
  return { ...base, streamer_username: sub.streamerUsername, streamer_platform: sub.streamerPlatform };
}

/**
 * Map an editable patch (camelCase) to the owner-scoped update payload
 * (snake_case), including only the fields the caller actually supplied so a
 * partial edit never clears untouched columns. Always bumps `updated_at`.
 */
function toUpdatePatch(patch: AlertSubscriptionUpdate): OwnerUpdate<AlertSubscriptionRow> {
  const out: OwnerUpdate<AlertSubscriptionRow> = {};
  if (patch.isEnabled !== undefined) out.is_enabled = patch.isEnabled;
  if (patch.serverId !== undefined) out.server_id = patch.serverId;
  if (patch.threshold !== undefined) out.threshold = patch.threshold;
  if (patch.streamerUsername !== undefined) out.streamer_username = patch.streamerUsername;
  if (patch.streamerPlatform !== undefined) out.streamer_platform = patch.streamerPlatform;
  out.updated_at = new Date().toISOString();
  return out;
}

/**
 * Map a persisted {@link AlertSubscriptionRow} to the client-facing,
 * type-discriminated {@link AlertSubscription}. Rows created through this module
 * always carry the type-appropriate columns; the `??` fallbacks are purely
 * defensive against a malformed row so mapping never throws.
 */
function mapRowToSubscription(row: AlertSubscriptionRow): AlertSubscription {
  const base: AlertSubscriptionBase = {
    id: row.id,
    userId: row.user_id,
    isEnabled: row.is_enabled,
    lastConditionState: row.last_condition_state,
    lastTriggeredAt: row.last_triggered_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };

  if (row.type === 'streamer_live') {
    return {
      ...base,
      type: 'streamer_live',
      streamerUsername: row.streamer_username ?? '',
      streamerPlatform: row.streamer_platform ?? 'twitch',
    };
  }

  return {
    ...base,
    type: 'player_count_below',
    serverId: row.server_id ?? '',
    threshold: row.threshold ?? 0,
  };
}

/* -------------------------------------------------------------------------- */
/* Create (R3.1, R3.2, R3.3)                                                  */
/* -------------------------------------------------------------------------- */

/**
 * Create an {@link AlertSubscription} for a PRE-RESOLVED owner (`app_users.id`).
 *
 * The input is validated by type (R3.1, R3.2); an invalid input returns
 * `{ ok: false, error }` and writes nothing. On success the validated input is
 * mapped to the snake_case insert payload (unused columns null, `is_enabled`
 * true, `last_condition_state` 'cleared') and inserted via the owner-scoped
 * accessor, which forces `user_id = ownerId` (R9.4). The created row is mapped
 * back to {@link AlertSubscription} for a faithful round trip (Property 9).
 *
 * Callers holding a Supabase auth `User` (e.g. API route handlers) should use
 * {@link createSubscriptionForUser}, which enforces the authentication
 * requirement (R3.3).
 *
 * @param ownerId the resolved `app_users.id` to scope the insert to.
 * @param sub the new subscription input (discriminated by `type`).
 * @param supabaseClient optional client override (defaults per `resolveClient`).
 */
export async function createSubscription(
  ownerId: number,
  sub: NewAlertSubscription,
  supabaseClient?: SupabaseClient<Database>,
): Promise<SubscriptionMutationResult> {
  const validation = validateNewSubscription(sub);
  if (!validation.ok) {
    return { ok: false, error: validation.error };
  }

  const accessor = createSupabaseOwnerScopedAccessor<AlertSubscriptionRow>(
    resolveClient(supabaseClient),
    ALERT_SUBSCRIPTIONS_TABLE,
    ownerId,
  );

  const { data, error } = await accessor.insert(toInsertPayload(validation.value));
  if (error || !data) {
    console.error('Error creating alert subscription:', error);
    return { ok: false, error: 'Failed to create alert subscription.' };
  }

  return { ok: true, data: mapRowToSubscription(data) };
}

/**
 * Convenience wrapper around {@link createSubscription} for callers that hold a
 * Supabase auth `User`. Validates the input BEFORE resolving the owner (so an
 * invalid input never triggers user creation), then resolves the owning
 * `app_users.id` via `getOrCreateAppUser` (through
 * `createOwnerScopedAccessorForUser`).
 *
 * When no `app_users` identity can be resolved, the create is denied with
 * {@link AUTH_REQUIRED_ERROR} and nothing is persisted, satisfying the
 * authentication requirement (R3.3 / Property 10).
 */
export async function createSubscriptionForUser(
  supabaseClient: SupabaseClient<Database>,
  user: User,
  sub: NewAlertSubscription,
): Promise<SubscriptionMutationResult> {
  const validation = validateNewSubscription(sub);
  if (!validation.ok) {
    return { ok: false, error: validation.error };
  }

  const { accessor, error } = await createOwnerScopedAccessorForUser<AlertSubscriptionRow>(
    supabaseClient,
    user,
    ALERT_SUBSCRIPTIONS_TABLE,
  );
  if (error || !accessor) {
    console.error('Error resolving owner for alert subscription:', error);
    return { ok: false, error: AUTH_REQUIRED_ERROR };
  }

  const { data, error: insertError } = await accessor.insert(toInsertPayload(validation.value));
  if (insertError || !data) {
    console.error('Error creating alert subscription:', insertError);
    return { ok: false, error: 'Failed to create alert subscription.' };
  }

  return { ok: true, data: mapRowToSubscription(data) };
}

/* -------------------------------------------------------------------------- */
/* List (R3.8)                                                                */
/* -------------------------------------------------------------------------- */

/**
 * List the owner's alert subscriptions (R3.8) by a PRE-RESOLVED `app_users.id`,
 * via the owner-scoped `accessor.list()` (returns only the owner's rows, R9.4).
 * Each row is mapped to the client-facing {@link AlertSubscription}. Returns an
 * empty array on any read error (logged like `lib/data.ts`).
 */
export async function listSubscriptions(
  ownerId: number,
  supabaseClient?: SupabaseClient<Database>,
): Promise<AlertSubscription[]> {
  const accessor = createSupabaseOwnerScopedAccessor<AlertSubscriptionRow>(
    resolveClient(supabaseClient),
    ALERT_SUBSCRIPTIONS_TABLE,
    ownerId,
  );

  const { data, error } = await accessor.list();
  if (error) {
    console.error('Error listing alert subscriptions:', error);
    return [];
  }

  return data.map(mapRowToSubscription);
}

/**
 * Convenience wrapper around {@link listSubscriptions} for callers that hold a
 * Supabase auth `User`. Resolves the owning `app_users.id` first; returns an
 * empty array when the owner cannot be resolved or on a read error.
 */
export async function listSubscriptionsForUser(
  supabaseClient: SupabaseClient<Database>,
  user: User,
): Promise<AlertSubscription[]> {
  const { accessor, error } = await createOwnerScopedAccessorForUser<AlertSubscriptionRow>(
    supabaseClient,
    user,
    ALERT_SUBSCRIPTIONS_TABLE,
  );
  if (error || !accessor) {
    console.error('Error resolving owner for alert subscriptions:', error);
    return [];
  }

  const { data, error: listError } = await accessor.list();
  if (listError) {
    console.error('Error listing alert subscriptions:', listError);
    return [];
  }

  return data.map(mapRowToSubscription);
}

/* -------------------------------------------------------------------------- */
/* Update (R3.8 own-only)                                                     */
/* -------------------------------------------------------------------------- */

/**
 * Edit one of the owner's subscriptions (R3.8) by a PRE-RESOLVED
 * `app_users.id`. Only the safe, editable fields are mapped (R3.8); identity,
 * ownership, `type`, and trigger-state columns are never client-writable, and
 * `updated_at` is bumped. The update goes through the owner-scoped
 * `accessor.update(id, patch)`, which mutates only when the target row belongs
 * to the owner (R9.4); when it doesn't (cross-user or missing id), the accessor
 * returns `null` and this maps to `{ ok: false }`.
 */
export async function updateSubscription(
  ownerId: number,
  id: number,
  patch: AlertSubscriptionUpdate,
  supabaseClient?: SupabaseClient<Database>,
): Promise<SubscriptionMutationResult> {
  const accessor = createSupabaseOwnerScopedAccessor<AlertSubscriptionRow>(
    resolveClient(supabaseClient),
    ALERT_SUBSCRIPTIONS_TABLE,
    ownerId,
  );

  const { data, error } = await accessor.update(id, toUpdatePatch(patch));
  if (error) {
    console.error('Error updating alert subscription:', error);
    return { ok: false, error: 'Failed to update alert subscription.' };
  }
  if (!data) {
    return { ok: false, error: 'Alert subscription not found.' };
  }

  return { ok: true, data: mapRowToSubscription(data) };
}

/**
 * Convenience wrapper around {@link updateSubscription} for callers that hold a
 * Supabase auth `User`. Resolves the owning `app_users.id` first; returns an
 * authentication-required failure when the owner cannot be resolved.
 */
export async function updateSubscriptionForUser(
  supabaseClient: SupabaseClient<Database>,
  user: User,
  id: number,
  patch: AlertSubscriptionUpdate,
): Promise<SubscriptionMutationResult> {
  const { accessor, error } = await createOwnerScopedAccessorForUser<AlertSubscriptionRow>(
    supabaseClient,
    user,
    ALERT_SUBSCRIPTIONS_TABLE,
  );
  if (error || !accessor) {
    console.error('Error resolving owner for alert subscription:', error);
    return { ok: false, error: AUTH_REQUIRED_ERROR };
  }

  const { data, error: updateError } = await accessor.update(id, toUpdatePatch(patch));
  if (updateError) {
    console.error('Error updating alert subscription:', updateError);
    return { ok: false, error: 'Failed to update alert subscription.' };
  }
  if (!data) {
    return { ok: false, error: 'Alert subscription not found.' };
  }

  return { ok: true, data: mapRowToSubscription(data) };
}

/* -------------------------------------------------------------------------- */
/* Delete (R3.8 own-only)                                                     */
/* -------------------------------------------------------------------------- */

/**
 * Delete one of the owner's subscriptions (R3.8) by a PRE-RESOLVED
 * `app_users.id`, via the owner-scoped `accessor.delete(id)` (removes only when
 * the row belongs to the owner, R9.4). Returns `{ ok: true }` only when a row
 * was actually removed; a cross-user or missing id yields `{ ok: false }`.
 */
export async function deleteSubscription(
  ownerId: number,
  id: number,
  supabaseClient?: SupabaseClient<Database>,
): Promise<{ ok: boolean }> {
  const accessor = createSupabaseOwnerScopedAccessor<AlertSubscriptionRow>(
    resolveClient(supabaseClient),
    ALERT_SUBSCRIPTIONS_TABLE,
    ownerId,
  );

  const { data, error } = await accessor.delete(id);
  if (error) {
    console.error('Error deleting alert subscription:', error);
    return { ok: false };
  }

  return { ok: data };
}

/**
 * Convenience wrapper around {@link deleteSubscription} for callers that hold a
 * Supabase auth `User`. Resolves the owning `app_users.id` first; returns
 * `{ ok: false }` when the owner cannot be resolved.
 */
export async function deleteSubscriptionForUser(
  supabaseClient: SupabaseClient<Database>,
  user: User,
  id: number,
): Promise<{ ok: boolean }> {
  const { accessor, error } = await createOwnerScopedAccessorForUser<AlertSubscriptionRow>(
    supabaseClient,
    user,
    ALERT_SUBSCRIPTIONS_TABLE,
  );
  if (error || !accessor) {
    console.error('Error resolving owner for alert subscription:', error);
    return { ok: false };
  }

  const { data, error: deleteError } = await accessor.delete(id);
  if (deleteError) {
    console.error('Error deleting alert subscription:', deleteError);
    return { ok: false };
  }

  return { ok: data };
}

/* ========================================================================== */
/* Edge-triggered evaluation engine (task 7.9 — R3.5, R3.6, R3.7, R3.10, R9.3) */
/* ========================================================================== */
/*
 * This section ADDS the evaluation engine on top of the CRUD surface above. It
 * is the server-side worker the `/api/cron/alerts` route (task 7.12) invokes on
 * each scheduled tick. The CRUD functions are untouched; only the shared row /
 * state types are reused.
 *
 * Design — edge-triggered delivery (R3.7 / Property 12)
 * -----------------------------------------------------
 * Each subscription carries a `last_condition_state` ('met' | 'cleared'). A
 * notification fires ONLY on a `cleared -> met` transition. While the condition
 * stays 'met' no repeat fires; it re-arms when the condition clears. This is
 * captured by the PURE {@link evaluateTransition} state machine plus the PURE
 * per-type predicates {@link playerCountBelowMet} / {@link streamerLiveMet}, so
 * Property 12 is testable over a sequence of observed states without any I/O.
 *
 * Ordering — notify, then log, then advance state (R3.7 / R3.10)
 * --------------------------------------------------------------
 * On a firing transition the engine calls {@link deliverToUser} (which delivers
 * to every active endpoint AND writes one `notification_deliveries` row per
 * attempt — R3.10) and only AFTER that resolves does it persist the new
 * `last_condition_state` / `last_triggered_at`. Advancing the trigger state only
 * after the delivery has been logged means a crash before logging leaves the
 * subscription still 'cleared', so the notification is retried on the next tick
 * rather than being silently skipped (at-least-once on the trigger, at-most-once
 * per sustained 'met' run).
 *
 * Migration safety / layering (R9.1, R9.3)
 * ----------------------------------------
 * All reads/writes stay in this `lib/` module. The latest-player-count read
 * mirrors the single-latest-row read already used by `lib/monitoring.ts` and
 * `lib/data.ts` (`getLatestServerCapacity`) — there is no existing `lib/` helper
 * that returns a single latest player count (the `getPlayerCounts*` helpers
 * fetch a whole time range), so this targeted latest read is the minimal
 * addition rather than a parallel bulk query path (R9.3). `alert_subscriptions`
 * and `kick_streams` are not in the generated `Database` type, so the
 * service-role client is adapted to a minimal structural surface at a single
 * boundary — the same approach used by `lib/web-push.ts`,
 * `lib/prediction-accuracy.ts`, and `lib/owner-scoped.ts`.
 */

/** Table names read/written by the evaluation engine. */
const PLAYER_COUNTS_TABLE = 'player_counts';
const TWITCH_STREAMS_TABLE = 'twitch_streams';
const KICK_STREAMS_TABLE = 'kick_streams';

/**
 * How recently a streamer must have been observed (a row in
 * `twitch_streams`/`kick_streams`) to count as "currently live".
 *
 * LIMITATION (documented): neither stream table carries an explicit `is_live`
 * flag — the stream ETL inserts a row for every matched live stream on each
 * tick (a few minutes apart). So "currently live" is best-effort: a row for the
 * streamer dated within this freshness window relative to `now`. The window is
 * generous enough to tolerate ETL jitter while still detecting an offline->live
 * crossing on the next evaluation tick (combined with the edge-trigger, R3.6).
 */
const STREAMER_LIVE_FRESHNESS_MS = 10 * 60 * 1000;

/* -------------------------------------------------------------------------- */
/* Pure edge-trigger core (Property 12 — R3.5, R3.6, R3.7)                    */
/* -------------------------------------------------------------------------- */

/**
 * The PURE edge-trigger state machine (R3.7). Given the previously persisted
 * {@link ConditionState} and whether the condition is met on the current tick,
 * decide whether to notify and what the next state is:
 *
 * - `cleared` + met now  -> `{ shouldNotify: true,  nextState: 'met' }`     (rising edge)
 * - `met`     + met now  -> `{ shouldNotify: false, nextState: 'met' }`     (still met: suppress)
 * - any state + not met  -> `{ shouldNotify: false, nextState: 'cleared' }` (re-arm)
 *
 * A notification therefore fires exactly once per `cleared -> met` transition
 * and never repeats until the condition clears and re-triggers (Property 12).
 */
export function evaluateTransition(
  prevState: ConditionState,
  conditionMetNow: boolean,
): { shouldNotify: boolean; nextState: ConditionState } {
  if (!conditionMetNow) {
    // Condition not met -> always end in 'cleared' so the next rising edge re-fires.
    return { shouldNotify: false, nextState: 'cleared' };
  }
  // Condition met now: fire only if we were previously cleared (rising edge).
  if (prevState === 'cleared') {
    return { shouldNotify: true, nextState: 'met' };
  }
  // Already 'met' and still met: suppress the repeat (R3.7).
  return { shouldNotify: false, nextState: 'met' };
}

/**
 * PURE predicate for a `player_count_below` rule (R3.5). Reports whether the
 * server's latest player count is currently BELOW the threshold.
 *
 * Returns `false` when the latest count is unknown (`null`). Strictly `<`
 * threshold: a value exactly AT the threshold is NOT below and so is not met.
 * R3.5 specifies the alert on a transition "from at or above the threshold to
 * below it"; this predicate only reports the current below/not-below state, and
 * {@link evaluateTransition} turns the `>= threshold` (cleared) -> `< threshold`
 * (met) crossing into the single firing edge (Property 12).
 */
export function playerCountBelowMet(
  latestPlayerCount: number | null,
  threshold: number,
): boolean {
  if (latestPlayerCount === null) return false;
  return latestPlayerCount < threshold;
}

/**
 * PURE predicate for a `streamer_live` rule (R3.6). The condition is met
 * exactly when the streamer is currently live; the offline->live crossing is
 * produced by {@link evaluateTransition} (Property 12). Kept as a named pure
 * function so the predicate is property-testable alongside the transition.
 */
export function streamerLiveMet(isLive: boolean): boolean {
  return isLive;
}

/* -------------------------------------------------------------------------- */
/* Injectable dependencies (deterministic tests)                             */
/* -------------------------------------------------------------------------- */

/** Counts returned by {@link evaluateAlertSubscriptions}. */
export interface EvaluationSummary {
  /** Enabled subscriptions examined on this tick. */
  evaluated: number;
  /** Subscriptions that fired (a `cleared -> met` transition) this tick. */
  delivered: number;
  /** Total endpoint deliveries that succeeded across all fired subscriptions. */
  endpointsDelivered: number;
}

/**
 * Persistence surface the engine needs: read all enabled subscriptions across
 * users (service-role read, bypasses RLS) and advance a subscription's
 * edge-trigger state. Injectable so the engine can be driven deterministically
 * in tests without a live database.
 */
export interface AlertEvaluationStore {
  /** All `is_enabled = true` subscriptions for every user (R3.5/R3.6). */
  listEnabledSubscriptions(): Promise<AlertSubscriptionRow[]>;
  /**
   * Persist a subscription's new edge-trigger state. `triggeredAt` is set only
   * when a notification fired (so `last_triggered_at` reflects real deliveries).
   */
  updateConditionState(
    id: number,
    nextState: ConditionState,
    triggeredAt: string | null,
  ): Promise<void>;
}

/** Reads a server's latest player count, or `null` when unknown (R3.5/R9.3). */
export type ReadLatestPlayerCount = (serverId: string) => Promise<number | null>;

/** Reads whether a streamer is currently live (R3.6). */
export type ReadStreamerLive = (
  username: string,
  platform: StreamerPlatform,
  now: Date,
) => Promise<boolean>;

/** Fans a fired alert out to a user's active push endpoints (defaults to web-push). */
export type AlertSender = (
  userId: number,
  subscriptionId: number,
  payload: NotificationPayload,
) => Promise<DeliverToUserSummary>;

/** Optional dependency overrides for {@link evaluateAlertSubscriptions}. */
export interface EvaluateAlertOptions {
  store?: AlertEvaluationStore;
  sender?: AlertSender;
  readLatestPlayerCount?: ReadLatestPlayerCount;
  readStreamerLive?: ReadStreamerLive;
}

/* -------------------------------------------------------------------------- */
/* Service-role-backed default dependencies                                  */
/* -------------------------------------------------------------------------- */

type PgError = { message: string };

/** A read chain supporting the filters/ordering the engine uses. */
interface AlertReadChain<T> extends PromiseLike<{ data: T[] | null; error: PgError | null }> {
  eq(column: string, value: string | number | boolean): AlertReadChain<T>;
  ilike(column: string, value: string): AlertReadChain<T>;
  gte(column: string, value: string): AlertReadChain<T>;
  order(column: string, options: { ascending: boolean }): AlertReadChain<T>;
  limit(count: number): AlertReadChain<T>;
}
interface AlertUpdateChain extends PromiseLike<{ error: PgError | null }> {
  eq(column: string, value: string | number | boolean): AlertUpdateChain;
}
interface AlertTable<T> {
  select(columns?: string): AlertReadChain<T>;
  update(patch: Record<string, unknown>): AlertUpdateChain;
}
/**
 * The narrow structural surface of the Supabase client the engine uses. The
 * `alert_subscriptions` and `kick_streams` tables are not in the generated
 * `Database` type, so the client is adapted here at a single boundary rather
 * than threaded through the fully-typed `from(<known table>)` overloads (same
 * approach as `lib/web-push.ts` / `lib/owner-scoped.ts`).
 */
interface MinimalAlertClient {
  from<T>(table: string): AlertTable<T>;
}

/** A latest player-count row (the only column the read needs). */
interface PlayerCountLatestRow {
  player_count: number;
}

/**
 * Build the default {@link AlertEvaluationStore} from a service-role client. The
 * worker reads every user's enabled rows and updates trigger state, both of
 * which require bypassing RLS, so the service-role client is used (R9.1).
 */
function createServiceRoleEvaluationStore(client: MinimalAlertClient): AlertEvaluationStore {
  return {
    async listEnabledSubscriptions() {
      const { data, error } = await client
        .from<AlertSubscriptionRow>(ALERT_SUBSCRIPTIONS_TABLE)
        .select('*')
        .eq('is_enabled', true);
      if (error) {
        console.error('Error loading enabled alert subscriptions:', error);
        return [];
      }
      return data ?? [];
    },

    async updateConditionState(id, nextState, triggeredAt) {
      const patch: Record<string, unknown> = {
        last_condition_state: nextState,
        updated_at: new Date().toISOString(),
      };
      if (triggeredAt !== null) {
        patch.last_triggered_at = triggeredAt;
      }
      const { error } = await client
        .from(ALERT_SUBSCRIPTIONS_TABLE)
        .update(patch)
        .eq('id', id);
      if (error) {
        console.error('Error updating alert subscription condition state:', error);
      }
    },
  };
}

/**
 * Default latest-player-count read (R3.5 / R9.3). Reads the single most recent
 * `player_count` row for a server via the service-role client, ordered by
 * `created_at` descending — mirroring the latest-row reads in `lib/monitoring.ts`
 * and `lib/data.ts` (`getLatestServerCapacity`). Returns `null` when there is no
 * data or on error so the predicate treats the count as unknown.
 */
function createDefaultReadLatestPlayerCount(client: MinimalAlertClient): ReadLatestPlayerCount {
  return async (serverId: string) => {
    const { data, error } = await client
      .from<PlayerCountLatestRow>(PLAYER_COUNTS_TABLE)
      .select('player_count')
      .eq('server_id', serverId)
      .order('created_at', { ascending: false })
      .limit(1);
    if (error) {
      console.error('Error reading latest player count for alert:', error);
      return null;
    }
    if (!data || data.length === 0) return null;
    return data[0].player_count;
  };
}

/**
 * Default streamer-live read (R3.6, best-effort — see
 * {@link STREAMER_LIVE_FRESHNESS_MS}). A streamer counts as currently live when
 * a row exists in the platform's stream table (`twitch_streams` / `kick_streams`)
 * whose `streamer_name` matches (case-insensitively, via `ilike`) and whose
 * `created_at` is within the freshness window ending at `now`. Returns `false`
 * on error or when no recent row exists.
 */
function createDefaultReadStreamerLive(client: MinimalAlertClient): ReadStreamerLive {
  return async (username: string, platform: StreamerPlatform, now: Date) => {
    const table = platform === 'kick' ? KICK_STREAMS_TABLE : TWITCH_STREAMS_TABLE;
    const since = new Date(now.getTime() - STREAMER_LIVE_FRESHNESS_MS).toISOString();
    const { data, error } = await client
      .from<{ id: number }>(table)
      .select('id')
      .ilike('streamer_name', username)
      .gte('created_at', since)
      .limit(1);
    if (error) {
      console.error('Error reading streamer live status for alert:', error);
      return false;
    }
    return !!data && data.length > 0;
  };
}

/* -------------------------------------------------------------------------- */
/* Notification payloads                                                      */
/* -------------------------------------------------------------------------- */

/**
 * Build the {@link NotificationPayload} for a fired `player_count_below` rule
 * (R3.5). Includes the crossing threshold and the observed count, plus a deep
 * link back to the dashboard.
 */
function buildPlayerCountBelowPayload(
  serverId: string,
  threshold: number,
  latest: number | null,
): NotificationPayload {
  const observed = latest === null ? 'fewer' : `${latest}`;
  return {
    title: 'Player count dropped',
    body: `Server ${serverId} fell below ${threshold} players (now ${observed}).`,
    url: `/?server=${encodeURIComponent(serverId)}`,
  };
}

/**
 * Build the {@link NotificationPayload} for a fired `streamer_live` rule (R3.6),
 * deep-linking to the multi-stream viewer for that streamer.
 */
function buildStreamerLivePayload(
  username: string,
  platform: StreamerPlatform,
): NotificationPayload {
  return {
    title: 'Streamer is live',
    body: `${username} just went live on ${platform === 'kick' ? 'Kick' : 'Twitch'}.`,
    url: `/multi-stream?streams=${platform}:${encodeURIComponent(username)}`,
  };
}

/* -------------------------------------------------------------------------- */
/* Orchestration (R3.5–R3.7, R3.10)                                           */
/* -------------------------------------------------------------------------- */

/**
 * Evaluate every enabled {@link AlertSubscription} against the current world
 * state and fire edge-triggered notifications (R3.5, R3.6, R3.7, R3.10).
 *
 * For each enabled subscription it:
 * 1. determines whether the condition is met NOW — via the latest player count
 *    + {@link playerCountBelowMet} (R3.5) or the streamer's live status +
 *    {@link streamerLiveMet} (R3.6);
 * 2. runs the pure {@link evaluateTransition} against the persisted
 *    `last_condition_state`;
 * 3. on a firing `cleared -> met` transition, fans the notification out to the
 *    user's active push endpoints via {@link deliverToUser} (which logs one
 *    delivery row per attempt — R3.10), then — and ONLY then — advances the
 *    persisted state and stamps `last_triggered_at` (notify -> log -> update
 *    ordering, R3.7/R3.10);
 * 4. on a non-firing transition whose `nextState` differs (a met -> cleared
 *    re-arm), persists the new state with no delivery and no log.
 *
 * Because {@link deliverToUser} is invoked once per firing transition and never
 * again while the subscription remains 'met', at most one notification is
 * delivered per condition-trigger (R3.7 / Property 12). A malformed row (a
 * `player_count_below` rule missing `server_id`/`threshold`, or a
 * `streamer_live` rule missing the streamer fields) is treated as not-met so it
 * never fires and simply re-arms.
 *
 * All dependencies default to the real service-role-backed implementations and
 * `web-push` delivery, but can be injected via {@link EvaluateAlertOptions} for
 * deterministic testing.
 *
 * @param now the evaluation instant (drives the streamer-live freshness window).
 */
export async function evaluateAlertSubscriptions(
  now: Date,
  options?: EvaluateAlertOptions,
): Promise<EvaluationSummary> {
  const client =
    options?.store && options?.readLatestPlayerCount && options?.readStreamerLive
      ? null
      : (createServiceRoleClient() as unknown as MinimalAlertClient);

  const store = options?.store ?? createServiceRoleEvaluationStore(client!);
  const sender = options?.sender ?? deliverToUser;
  const readLatestPlayerCount =
    options?.readLatestPlayerCount ?? createDefaultReadLatestPlayerCount(client!);
  const readStreamerLive =
    options?.readStreamerLive ?? createDefaultReadStreamerLive(client!);

  const subscriptions = await store.listEnabledSubscriptions();

  const summary: EvaluationSummary = {
    evaluated: subscriptions.length,
    delivered: 0,
    endpointsDelivered: 0,
  };

  for (const sub of subscriptions) {
    // 1) Determine whether the condition is met on this tick and build payload.
    let conditionMetNow = false;
    let payload: NotificationPayload | null = null;

    if (sub.type === 'player_count_below') {
      if (sub.server_id !== null && sub.threshold !== null) {
        const latest = await readLatestPlayerCount(sub.server_id);
        conditionMetNow = playerCountBelowMet(latest, sub.threshold);
        if (conditionMetNow) {
          payload = buildPlayerCountBelowPayload(sub.server_id, sub.threshold, latest);
        }
      }
    } else if (sub.type === 'streamer_live') {
      if (sub.streamer_username !== null && sub.streamer_platform !== null) {
        const isLive = await readStreamerLive(sub.streamer_username, sub.streamer_platform, now);
        conditionMetNow = streamerLiveMet(isLive);
        if (conditionMetNow) {
          payload = buildStreamerLivePayload(sub.streamer_username, sub.streamer_platform);
        }
      }
    }

    // 2) Pure edge-trigger decision.
    const { shouldNotify, nextState } = evaluateTransition(
      sub.last_condition_state,
      conditionMetNow,
    );

    // 3) Firing transition: notify -> (deliverToUser logs each attempt) -> THEN advance state.
    if (shouldNotify && payload) {
      const deliverySummary = await sender(sub.user_id, sub.id, payload);
      summary.delivered += 1;
      summary.endpointsDelivered += deliverySummary.delivered;
      // CRITICAL: advance trigger state only AFTER the delivery has been logged
      // (R3.7/R3.10) so a crash before logging retries rather than skips.
      await store.updateConditionState(sub.id, nextState, now.toISOString());
      continue;
    }

    // 4) Non-firing transition: persist a state change (e.g. met -> cleared re-arm)
    //    without delivering or logging. No-op when the state is unchanged.
    if (nextState !== sub.last_condition_state) {
      await store.updateConditionState(sub.id, nextState, null);
    }
  }

  return summary;
}
