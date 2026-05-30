/**
 * Web-push delivery for the Alert_System (R3.4, R3.9, R3.10).
 *
 * This module owns everything related to browser web-push: persisting a
 * browser PushSubscription per user (R3.4), VAPID-signed delivery via the
 * `web-push` library (we do NOT hand-roll VAPID), deactivating endpoints the
 * push service reports as gone (R3.9), and logging every delivery attempt
 * (R3.10). The edge-triggered evaluation engine (`evaluateAlertSubscriptions`,
 * task 7.9) consumes these functions to fan a notification out to a user's
 * active endpoints.
 *
 * Layering / migration safety (R9.1)
 * ----------------------------------
 * All database access routes through this `lib/` module. Both backing tables
 * are written by the server-side delivery worker, so every DB operation goes
 * through the **service-role** client (`createServiceRoleClient`):
 *   - `push_subscriptions` is owner-only RLS for clients, but the worker reads
 *     *all* active rows when fanning out, so it must bypass RLS (R3.9).
 *   - `notification_deliveries` is service-role-only (no client policy, R3.10).
 *
 * Neither table is part of the generated `Database` type yet, so the Supabase
 * client is adapted to a minimal structural surface at a single boundary —
 * the same approach used by `lib/prediction-accuracy.ts` and
 * `lib/owner-scoped.ts`.
 *
 * Testability
 * -----------
 * The persistence functions accept an optional {@link PushSubscriptionStore} so
 * the property tests (tasks 7.6-7.8) can inject the deterministic
 * {@link InMemoryPushStore} instead of a live database, and {@link deliver} /
 * {@link deliverToUser} accept an optional {@link PushSender} so delivery can be
 * exercised without contacting a real push service. The default store is the
 * service-role-backed Supabase store and the default sender is `web-push`.
 *
 * VAPID configuration
 * -------------------
 * `VAPID_SUBJECT`, `VAPID_PUBLIC_KEY`, and `VAPID_PRIVATE_KEY` are read from
 * `process.env`. `web-push.setVapidDetails` is invoked once, lazily and safely
 * ({@link ensureVapidConfigured}); if any key is missing, {@link deliver} fails
 * gracefully (returns a `'failed'` outcome with an error and logs a clear
 * server error) rather than throwing.
 */
import * as webpush from 'web-push';
import { createServiceRoleClient } from './supabase-service-role';

/* -------------------------------------------------------------------------- */
/* Constants                                                                  */
/* -------------------------------------------------------------------------- */

/** Per-user browser push endpoints (R3.4/R3.9). */
const PUSH_SUBSCRIPTIONS_TABLE = 'push_subscriptions';
/** Append-only delivery log (R3.10). */
const NOTIFICATION_DELIVERIES_TABLE = 'notification_deliveries';

/** HTTP statuses from the push service that mean the endpoint is gone (R3.9). */
const GONE_STATUS_CODES: ReadonlySet<number> = new Set([404, 410]);

/* -------------------------------------------------------------------------- */
/* Public types                                                               */
/* -------------------------------------------------------------------------- */

/**
 * The browser-provided PushSubscription shape accepted by
 * {@link savePushSubscription}. This mirrors the standard DOM
 * `PushSubscriptionJSON` (`registration.pushManager.subscribe().toJSON()`), so
 * a value of the global `PushSubscriptionJSON` type is assignable here. Only
 * `endpoint` and `keys.p256dh` / `keys.auth` are required for delivery.
 */
export interface PushSubscriptionInput {
  endpoint?: string;
  expirationTime?: number | null;
  keys?: { p256dh?: string; auth?: string };
}

/**
 * A persisted `push_subscriptions` row. Mirrors
 * `api2db/sql/push_subscriptions_schema.sql` (client-agnostic so it stays
 * expressible in both Supabase and Prisma, R9.2).
 */
export interface PushSubscriptionRow {
  id: number;
  user_id: number;
  endpoint: string;
  p256dh: string;
  auth: string;
  is_active: boolean;
  user_agent: string | null;
  created_at: string;
  last_used_at: string | null;
}

/**
 * The slim view of a stored push subscription the delivery path needs: identity
 * + owner + the endpoint/keys required to sign a push, plus its active flag.
 * Returned by {@link getActivePushSubscriptionsForUser} and accepted by
 * {@link deliver}.
 */
export interface StoredPushSubscription {
  id: number;
  user_id: number;
  endpoint: string;
  p256dh: string;
  auth: string;
  is_active: boolean;
}

/** The JSON payload delivered to the service worker's `push` handler. */
export interface NotificationPayload {
  title: string;
  body: string;
  url?: string;
  icon?: string;
}

/** The three terminal outcomes of a delivery attempt (matches the DB check). */
export type DeliveryOutcomeKind = 'delivered' | 'failed' | 'expired';

/**
 * The result of a single {@link deliver} call.
 * - `'delivered'` — the push service accepted the message.
 * - `'expired'`   — the endpoint is gone (404/410, R3.9); caller should
 *   deactivate it via {@link markInactiveIfGone}.
 * - `'failed'`    — any other error (network, VAPID misconfig, 4xx/5xx).
 */
export interface DeliveryOutcome {
  outcome: DeliveryOutcomeKind;
  /** HTTP status from the push service when one is available. */
  statusCode?: number;
  /** Human-readable error detail for `'failed'` / `'expired'`. */
  error?: string;
}

/**
 * Input to {@link recordDelivery} (R3.10). Every delivery attempt produces one
 * `notification_deliveries` row.
 */
export interface DeliveryRecord {
  /** The alert subscription that produced the notification (R3.10). */
  subscriptionId: number;
  /** The push endpoint used, if any. */
  pushSubscriptionId?: number | null;
  outcome: DeliveryOutcomeKind;
  /** Optional JSON detail (e.g. status code / error). */
  detail?: Record<string, unknown> | null;
  /** Defaults to `new Date().toISOString()` when omitted. */
  deliveredAt?: string;
}

/** The endpoint + keys subset {@link deliver} needs to sign a push. */
export type DeliverablePushSubscription = Pick<
  StoredPushSubscription,
  'endpoint' | 'p256dh' | 'auth'
>;

/**
 * A pluggable push transport. The default wraps `web-push.sendNotification`
 * (VAPID-signed). Tests inject a fake to exercise the delivery pipeline without
 * a real push service. It MUST throw a `WebPushError` (or an object carrying a
 * numeric `statusCode`) on failure so {@link deliver} can map gone endpoints.
 */
export type PushSender = (
  subscription: { endpoint: string; keys: { p256dh: string; auth: string } },
  payload: string,
) => Promise<{ statusCode: number }>;

/** Summary returned by {@link deliverToUser}. */
export interface DeliverToUserSummary {
  userId: number;
  subscriptionId: number;
  /** Active endpoints the notification was attempted against. */
  attempted: number;
  delivered: number;
  expired: number;
  failed: number;
  outcomes: Array<{
    pushSubscriptionId: number;
    outcome: DeliveryOutcomeKind;
    statusCode?: number;
  }>;
}

/* -------------------------------------------------------------------------- */
/* Data-access store (injectable for tests)                                   */
/* -------------------------------------------------------------------------- */

/** Insert/update payload for an upsert on the unique `endpoint`. */
interface PushSubscriptionUpsert {
  user_id: number;
  endpoint: string;
  p256dh: string;
  auth: string;
  is_active: boolean;
  user_agent: string | null;
  last_used_at: string | null;
}

/** A row inserted into the delivery log (R3.10). */
interface NotificationDeliveryInsert {
  subscription_id: number;
  push_subscription_id: number | null;
  delivered_at: string;
  outcome: DeliveryOutcomeKind;
  detail: Record<string, unknown> | null;
}

/**
 * The persistence surface this module relies on. The same interface is
 * implemented by the Supabase-backed store (service-role client) and the
 * in-memory fake, so they are interchangeable in tests.
 */
export interface PushSubscriptionStore {
  /**
   * UPSERT a push subscription on the unique `endpoint` (R3.4): insert when new,
   * otherwise update its `user_id`/keys/`is_active`/`last_used_at`.
   */
  upsertByEndpoint(
    row: PushSubscriptionUpsert,
  ): Promise<{ row: PushSubscriptionRow | null; error: Error | null }>;
  /** Active (`is_active = true`) push subscriptions for a user (R3.9 skip). */
  listActiveByUser(
    userId: number,
  ): Promise<{ rows: PushSubscriptionRow[]; error: Error | null }>;
  /** Set a push subscription's `is_active` flag (R3.9 deactivation). */
  setActive(id: number, isActive: boolean): Promise<{ error: Error | null }>;
  /** Append a delivery-log row (R3.10). */
  insertDelivery(record: NotificationDeliveryInsert): Promise<{ error: Error | null }>;
}

/* --- Supabase-backed store ------------------------------------------------ */

type PgError = { message: string };

interface SelectChain<T> extends PromiseLike<{ data: T[] | null; error: PgError | null }> {
  eq(column: string, value: string | number | boolean): SelectChain<T>;
}
type SingleResult<T> = PromiseLike<{ data: T | null; error: PgError | null }>;
interface UpsertChain<T> {
  select(columns?: string): { single(): SingleResult<T> };
}
interface UpdateChain extends PromiseLike<{ error: PgError | null }> {
  eq(column: string, value: string | number | boolean): UpdateChain;
}
interface PushTable<T> {
  upsert(values: Partial<T>, options?: { onConflict?: string }): UpsertChain<T>;
  select(columns?: string): SelectChain<T>;
  update(patch: Partial<T>): UpdateChain;
  insert(rows: ReadonlyArray<Record<string, unknown>>): PromiseLike<{ error: PgError | null }>;
}
/**
 * The narrow structural surface of the Supabase client this store uses. The
 * `push_subscriptions` / `notification_deliveries` tables are not in the
 * generated `Database` type, so the client is adapted here at a single boundary
 * rather than threaded through the fully-typed `from(<known table>)` overloads
 * (same approach as `lib/owner-scoped.ts`).
 */
interface MinimalClient {
  from<T>(table: string): PushTable<T>;
}

function toError(error: PgError | null): Error | null {
  return error ? new Error(error.message) : null;
}

/**
 * Build a {@link PushSubscriptionStore} backed by a Supabase client. The caller
 * supplies the client; production uses the service-role client so the worker
 * can read every user's active endpoints and write the (service-role-only)
 * delivery log.
 */
export function createSupabasePushStore(client: MinimalClient): PushSubscriptionStore {
  const pushTable = () => client.from<PushSubscriptionRow>(PUSH_SUBSCRIPTIONS_TABLE);

  return {
    async upsertByEndpoint(row) {
      const { data, error } = await pushTable()
        .upsert(row as Partial<PushSubscriptionRow>, { onConflict: 'endpoint' })
        .select()
        .single();
      return { row: data ?? null, error: toError(error) };
    },

    async listActiveByUser(userId) {
      const { data, error } = await pushTable()
        .select('*')
        .eq('user_id', userId)
        .eq('is_active', true);
      return { rows: data ?? [], error: toError(error) };
    },

    async setActive(id, isActive) {
      const { error } = await pushTable().update({ is_active: isActive }).eq('id', id);
      return { error: toError(error) };
    },

    async insertDelivery(record) {
      const { error } = await client
        .from<NotificationDeliveryInsert>(NOTIFICATION_DELIVERIES_TABLE)
        .insert([record as unknown as Record<string, unknown>]);
      return { error: toError(error) };
    },
  };
}

/** Default store: service-role client (server-side only, bypasses RLS). */
function createDefaultStore(): PushSubscriptionStore {
  const client = createServiceRoleClient() as unknown as MinimalClient;
  return createSupabasePushStore(client);
}

/* --- In-memory store (deterministic tests) -------------------------------- */

/**
 * Dependency-free {@link PushSubscriptionStore} backed by plain arrays, with
 * the same semantics as the Supabase store (UPSERT on `endpoint`, active-only
 * reads, append-only delivery log). A faithful stand-in for the storage
 * round-trip / deactivation / delivery-log property tests (tasks 7.6-7.8).
 */
export class InMemoryPushStore implements PushSubscriptionStore {
  private subscriptions: PushSubscriptionRow[] = [];
  private deliveries: Array<NotificationDeliveryInsert & { id: number }> = [];
  private nextSubId: number;
  private nextDeliveryId = 1;

  constructor(options?: { seed?: PushSubscriptionRow[]; startId?: number }) {
    if (options?.seed) {
      this.subscriptions = options.seed.map((r) => ({ ...r }));
    }
    const maxSeededId = this.subscriptions.reduce((max, r) => Math.max(max, r.id), 0);
    this.nextSubId = options?.startId ?? maxSeededId + 1;
  }

  /** Snapshot of all push-subscription rows (test inspection only). */
  allSubscriptions(): PushSubscriptionRow[] {
    return this.subscriptions.map((r) => ({ ...r }));
  }

  /** Snapshot of all delivery-log rows (test inspection only). */
  allDeliveries(): Array<NotificationDeliveryInsert & { id: number }> {
    return this.deliveries.map((r) => ({ ...r }));
  }

  async upsertByEndpoint(
    row: PushSubscriptionUpsert,
  ): Promise<{ row: PushSubscriptionRow | null; error: Error | null }> {
    const existing = this.subscriptions.find((r) => r.endpoint === row.endpoint);
    if (existing) {
      existing.user_id = row.user_id;
      existing.p256dh = row.p256dh;
      existing.auth = row.auth;
      existing.is_active = row.is_active;
      existing.user_agent = row.user_agent;
      existing.last_used_at = row.last_used_at;
      return { row: { ...existing }, error: null };
    }
    const created: PushSubscriptionRow = {
      id: this.nextSubId++,
      user_id: row.user_id,
      endpoint: row.endpoint,
      p256dh: row.p256dh,
      auth: row.auth,
      is_active: row.is_active,
      user_agent: row.user_agent,
      created_at: new Date().toISOString(),
      last_used_at: row.last_used_at,
    };
    this.subscriptions.push(created);
    return { row: { ...created }, error: null };
  }

  async listActiveByUser(
    userId: number,
  ): Promise<{ rows: PushSubscriptionRow[]; error: Error | null }> {
    const rows = this.subscriptions
      .filter((r) => r.user_id === userId && r.is_active)
      .map((r) => ({ ...r }));
    return { rows, error: null };
  }

  async setActive(id: number, isActive: boolean): Promise<{ error: Error | null }> {
    const found = this.subscriptions.find((r) => r.id === id);
    if (found) found.is_active = isActive;
    return { error: null };
  }

  async insertDelivery(record: NotificationDeliveryInsert): Promise<{ error: Error | null }> {
    this.deliveries.push({ ...record, id: this.nextDeliveryId++ });
    return { error: null };
  }
}

/* -------------------------------------------------------------------------- */
/* VAPID configuration + default sender                                       */
/* -------------------------------------------------------------------------- */

/** Memoizes a successful `setVapidDetails` so it is called at most once. */
let vapidConfigured = false;

/**
 * Lazily and safely configure `web-push` VAPID details from the environment.
 * Returns `{ ok: false, error }` (never throws) when any of `VAPID_SUBJECT`,
 * `VAPID_PUBLIC_KEY`, or `VAPID_PRIVATE_KEY` is missing or invalid, so
 * {@link deliver} can degrade gracefully instead of crashing the worker.
 */
function ensureVapidConfigured(): { ok: true } | { ok: false; error: string } {
  if (vapidConfigured) return { ok: true };

  const subject = process.env.VAPID_SUBJECT;
  const publicKey = process.env.VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;

  if (!subject || !publicKey || !privateKey) {
    return {
      ok: false,
      error:
        'Web-push is not configured: VAPID_SUBJECT, VAPID_PUBLIC_KEY, and VAPID_PRIVATE_KEY must all be set.',
    };
  }

  try {
    webpush.setVapidDetails(subject, publicKey, privateKey);
    vapidConfigured = true;
    return { ok: true };
  } catch (err) {
    return { ok: false, error: `Invalid VAPID configuration: ${errorMessage(err)}` };
  }
}

/** Default transport: VAPID-signed `web-push.sendNotification`. */
const defaultSender: PushSender = async (subscription, payload) => {
  const result = await webpush.sendNotification(subscription, payload);
  return { statusCode: result.statusCode };
};

/** Extract a numeric HTTP status from a thrown push error, if present. */
function extractStatusCode(err: unknown): number | undefined {
  if (err instanceof webpush.WebPushError) return err.statusCode;
  if (err && typeof err === 'object' && 'statusCode' in err) {
    const code = (err as { statusCode?: unknown }).statusCode;
    if (typeof code === 'number') return code;
  }
  return undefined;
}

function errorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  return String(err);
}

/* -------------------------------------------------------------------------- */
/* Persistence / delivery functions                                           */
/* -------------------------------------------------------------------------- */

/**
 * Store a browser PushSubscription for a user (R3.4 / Property 11).
 *
 * UPSERTs on the unique `endpoint`: a brand-new endpoint is inserted; an
 * existing endpoint is re-pointed at `userId` with refreshed keys,
 * `is_active = true`, and a new `last_used_at`. Reading the user's active
 * subscriptions afterwards therefore returns an entry with the same endpoint
 * and keys (storage round trip).
 *
 * @throws when `endpoint`, `keys.p256dh`, or `keys.auth` is missing — a
 *   subscription without them cannot be delivered to.
 */
export async function savePushSubscription(
  userId: number,
  sub: PushSubscriptionInput,
  userAgent?: string,
  options?: { store?: PushSubscriptionStore },
): Promise<void> {
  const endpoint = sub.endpoint?.trim();
  const p256dh = sub.keys?.p256dh;
  const auth = sub.keys?.auth;

  if (!endpoint) {
    throw new Error('Cannot save a push subscription without an endpoint.');
  }
  if (!p256dh || !auth) {
    throw new Error('Cannot save a push subscription without p256dh and auth keys.');
  }

  const store = options?.store ?? createDefaultStore();
  const { error } = await store.upsertByEndpoint({
    user_id: userId,
    endpoint,
    p256dh,
    auth,
    is_active: true,
    user_agent: userAgent ?? null,
    last_used_at: new Date().toISOString(),
  });

  if (error) {
    console.error('Error saving push subscription:', error);
    throw error;
  }
}

/**
 * Read a user's ACTIVE push subscriptions (R3.9 / Property 13).
 *
 * Only `is_active = true` rows are returned, so a subscription deactivated by
 * {@link markInactiveIfGone} is excluded from subsequent delivery selection.
 * Returns an empty array on a read error (logged like `lib/data.ts`).
 */
export async function getActivePushSubscriptionsForUser(
  userId: number,
  options?: { store?: PushSubscriptionStore },
): Promise<StoredPushSubscription[]> {
  const store = options?.store ?? createDefaultStore();
  const { rows, error } = await store.listActiveByUser(userId);
  if (error) {
    console.error('Error loading active push subscriptions:', error);
    return [];
  }
  return rows.map((r) => ({
    id: r.id,
    user_id: r.user_id,
    endpoint: r.endpoint,
    p256dh: r.p256dh,
    auth: r.auth,
    is_active: r.is_active,
  }));
}

/**
 * Deliver a VAPID-signed web-push notification to a single endpoint.
 *
 * Signs via `web-push.sendNotification` (the default sender) using VAPID
 * details from the environment ({@link ensureVapidConfigured}). The `payload`
 * is JSON-serialized for the service worker's `push` handler. Outcome mapping:
 *   - success            -> `'delivered'` (with the push service status code);
 *   - 404 / 410 (gone)   -> `'expired'`  (caller should {@link markInactiveIfGone});
 *   - any other error    -> `'failed'`.
 *
 * Never throws: a missing/invalid VAPID config or a transport error is reported
 * as a `'failed'` (or `'expired'`) {@link DeliveryOutcome} and logged, so the
 * delivery worker keeps running (R3.9/R3.10).
 *
 * @param options.sender inject a transport (tests); defaults to `web-push`.
 */
export async function deliver(
  pushSub: DeliverablePushSubscription,
  payload: NotificationPayload,
  options?: { sender?: PushSender },
): Promise<DeliveryOutcome> {
  // Only the real transport needs VAPID configured; an injected sender does not.
  if (!options?.sender) {
    const configured = ensureVapidConfigured();
    if (!configured.ok) {
      console.error(`Web-push delivery skipped: ${configured.error}`);
      return { outcome: 'failed', error: configured.error };
    }
  }

  const send = options?.sender ?? defaultSender;

  try {
    const result = await send(
      { endpoint: pushSub.endpoint, keys: { p256dh: pushSub.p256dh, auth: pushSub.auth } },
      JSON.stringify(payload),
    );
    return { outcome: 'delivered', statusCode: result.statusCode };
  } catch (err) {
    const statusCode = extractStatusCode(err);
    const message = errorMessage(err);
    if (statusCode !== undefined && GONE_STATUS_CODES.has(statusCode)) {
      return { outcome: 'expired', statusCode, error: message };
    }
    console.error('Web-push delivery failed:', message);
    return { outcome: 'failed', statusCode, error: message };
  }
}

/**
 * Deactivate a push subscription when the push service reports it gone (R3.9 /
 * Property 13).
 *
 * Sets `is_active = false` ONLY for a 404 or 410 status (the "Gone" responses),
 * so the endpoint is skipped by every later
 * {@link getActivePushSubscriptionsForUser}. Other statuses are a no-op (the
 * endpoint may be transiently failing). Errors are logged, not thrown, to keep
 * the delivery worker resilient.
 */
export async function markInactiveIfGone(
  pushSubId: number,
  httpStatus: number,
  options?: { store?: PushSubscriptionStore },
): Promise<void> {
  if (!GONE_STATUS_CODES.has(httpStatus)) return;

  const store = options?.store ?? createDefaultStore();
  const { error } = await store.setActive(pushSubId, false);
  if (error) {
    console.error('Error deactivating gone push subscription:', error);
  }
}

/**
 * Append a delivery-log row for a single attempt (R3.10 / Property 14).
 *
 * Records `subscription_id`, the optional `push_subscription_id`,
 * `delivered_at` (now by default), the `outcome`, and optional `detail` JSON.
 * Exactly one row is written per call, so wiring one {@link recordDelivery} per
 * {@link deliver} attempt guarantees every attempt is logged. Errors are
 * logged, not thrown, to keep the worker resilient.
 */
export async function recordDelivery(
  d: DeliveryRecord,
  options?: { store?: PushSubscriptionStore },
): Promise<void> {
  const store = options?.store ?? createDefaultStore();
  const { error } = await store.insertDelivery({
    subscription_id: d.subscriptionId,
    push_subscription_id: d.pushSubscriptionId ?? null,
    delivered_at: d.deliveredAt ?? new Date().toISOString(),
    outcome: d.outcome,
    detail: d.detail ?? null,
  });
  if (error) {
    console.error('Error recording notification delivery:', error);
  }
}

/**
 * Convenience orchestration for the evaluation engine (task 7.9): fan a
 * triggered alert subscription's notification out to all of a user's active
 * push endpoints.
 *
 * For each active endpoint it: delivers ({@link deliver}), writes exactly one
 * delivery-log row ({@link recordDelivery}, so every attempt is logged —
 * R3.10/Property 14), and on a gone (404/410) outcome deactivates the endpoint
 * ({@link markInactiveIfGone}, so it is excluded thereafter — R3.9/Property 13).
 * Inactive endpoints are never attempted because selection uses
 * {@link getActivePushSubscriptionsForUser}.
 *
 * @param subscriptionId the alert subscription that triggered (for the log).
 * @param options.sender inject a transport (tests); defaults to `web-push`.
 * @param options.store  inject a store (tests); defaults to the service-role store.
 */
export async function deliverToUser(
  userId: number,
  subscriptionId: number,
  payload: NotificationPayload,
  options?: { store?: PushSubscriptionStore; sender?: PushSender },
): Promise<DeliverToUserSummary> {
  const store = options?.store ?? createDefaultStore();
  const subs = await getActivePushSubscriptionsForUser(userId, { store });

  const summary: DeliverToUserSummary = {
    userId,
    subscriptionId,
    attempted: subs.length,
    delivered: 0,
    expired: 0,
    failed: 0,
    outcomes: [],
  };

  for (const sub of subs) {
    const outcome = await deliver(sub, payload, { sender: options?.sender });

    // Exactly one log row per attempt (R3.10 / Property 14).
    await recordDelivery(
      {
        subscriptionId,
        pushSubscriptionId: sub.id,
        outcome: outcome.outcome,
        detail:
          outcome.statusCode !== undefined || outcome.error !== undefined
            ? { statusCode: outcome.statusCode ?? null, error: outcome.error ?? null }
            : null,
      },
      { store },
    );

    if (outcome.outcome === 'delivered') {
      summary.delivered += 1;
    } else if (outcome.outcome === 'expired') {
      summary.expired += 1;
      // Deactivate the gone endpoint so it is skipped thereafter (R3.9).
      if (outcome.statusCode !== undefined) {
        await markInactiveIfGone(sub.id, outcome.statusCode, { store });
      }
    } else {
      summary.failed += 1;
    }

    summary.outcomes.push({
      pushSubscriptionId: sub.id,
      outcome: outcome.outcome,
      statusCode: outcome.statusCode,
    });
  }

  return summary;
}
