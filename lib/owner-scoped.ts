/**
 * Shared owner-scoping data-access utility (R9.1, R9.4).
 *
 * Per-user tables introduced by the site-feature-enhancements spec
 * (comparison_preferences, alert_subscriptions, push_subscriptions, ...) follow
 * the existing `user_favorites` pattern: every row carries a
 * `user_id BIGINT REFERENCES app_users(id) ON DELETE CASCADE`, and an App_User
 * may read or modify only their own rows.
 *
 * Supabase enforces this with row-level security, but the platform is mid-
 * migration from Supabase to Prisma/RDS. To make the ownership guarantee
 * survive the client swap (R9.4), the same rule is enforced here in the `lib/`
 * layer: an {@link OwnerScopedAccessor} ALWAYS injects `user_id = ownerId` into
 * every read, update, and delete, and forces `user_id = ownerId` on every
 * insert. Cross-user reads return `null` (existence is not leaked) and
 * cross-user mutations change nothing.
 *
 * Design notes
 * ------------
 * - The owner-scoping logic lives in {@link createOwnerScopedAccessor}, which
 *   is backed by a low-level, owner-agnostic {@link RowStore}. Because the rule
 *   is enforced in the accessor (not the store), the Supabase-backed store and
 *   the in-memory fake share *identical* semantics — the fake is therefore a
 *   faithful stand-in for deterministic / property tests.
 * - The core factory accepts a PRE-RESOLVED `app_users.id`. This keeps it
 *   decoupled from auth and trivially testable. Route handlers that hold a
 *   Supabase auth user can use {@link createOwnerScopedAccessorForUser}, which
 *   resolves the owner id via `getOrCreateAppUser` first.
 * - Everything is generic over the row shape so it can be reused for every
 *   per-user table without re-deriving the table types here (the new tables are
 *   added to `supabase.types.ts` by later tasks).
 */
import type { SupabaseClient, User } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase.types';
import { getOrCreateAppUser } from '@/lib/app-users';

/**
 * The minimum shape every owner-scoped row must have: an identity primary key
 * and the owning `app_users.id`.
 */
export interface OwnerScopedRow {
  id: number;
  user_id: number;
}

/**
 * Insert payload for an owner-scoped row. The caller never supplies `id`
 * (generated) or `user_id` (forced to the owner by the accessor).
 */
export type OwnerInsert<TRow extends OwnerScopedRow> = Omit<TRow, 'id' | 'user_id'>;

/**
 * Update payload for an owner-scoped row. `id` and `user_id` can never be
 * changed; any attempt to include them is stripped at runtime as well.
 */
export type OwnerUpdate<TRow extends OwnerScopedRow> = Partial<Omit<TRow, 'id' | 'user_id'>>;

/**
 * Result envelope mirroring the existing `{ data, error }` data-access
 * convention used across `lib/`.
 */
export interface OwnerScopedResult<T> {
  data: T;
  error: Error | null;
}

/**
 * Typed, owner-only accessor for a single per-user table. Every method is
 * scoped to {@link OwnerScopedAccessor.ownerId}:
 *
 * - `list`   — only the owner's rows.
 * - `get`    — the row if it belongs to the owner, otherwise `null` (a row
 *              owned by a different user is indistinguishable from a missing
 *              row, so existence is not leaked).
 * - `insert` — forces `user_id = ownerId`.
 * - `update` — mutates only when the target row belongs to the owner; otherwise
 *              `null` and nothing changes.
 * - `delete` — removes only when the target row belongs to the owner; returns
 *              whether a row was actually removed.
 */
export interface OwnerScopedAccessor<
  TRow extends OwnerScopedRow,
  TInsert = OwnerInsert<TRow>,
  TPatch = OwnerUpdate<TRow>,
> {
  /** The resolved `app_users.id` every operation is scoped to. */
  readonly ownerId: number;
  list(): Promise<OwnerScopedResult<TRow[]>>;
  get(id: number): Promise<OwnerScopedResult<TRow | null>>;
  insert(payload: TInsert): Promise<OwnerScopedResult<TRow | null>>;
  update(id: number, patch: TPatch): Promise<OwnerScopedResult<TRow | null>>;
  delete(id: number): Promise<OwnerScopedResult<boolean>>;
}

/** Equality filter conditions: column name → value. */
export type FilterValue = string | number | boolean;
export type RowFilter = Record<string, FilterValue>;

/**
 * Low-level, OWNER-AGNOSTIC row storage primitive. Implementations translate
 * generic equality-filtered CRUD into their backing store (Supabase queries,
 * an in-memory array, a future Prisma client, ...).
 *
 * Implementations MUST NOT add any owner scoping of their own — owner scoping
 * is the responsibility of {@link createOwnerScopedAccessor}, which always
 * passes the `user_id` filter. This separation is what lets the same accessor
 * enforce R9.4 regardless of the backing store.
 */
export interface RowStore<TRow extends OwnerScopedRow> {
  /** Return every row matching all equality conditions in `filter`. */
  select(filter: RowFilter): Promise<{ rows: TRow[]; error: Error | null }>;
  /** Return the single row matching `filter`, or `null` when none match. */
  selectOne(filter: RowFilter): Promise<{ row: TRow | null; error: Error | null }>;
  /** Insert a fully-formed row (already carrying `user_id`) and return it. */
  insert(row: Omit<TRow, 'id'>): Promise<{ row: TRow | null; error: Error | null }>;
  /** Apply `patch` to every row matching `filter`; return the updated rows. */
  update(
    filter: RowFilter,
    patch: Partial<TRow>,
  ): Promise<{ rows: TRow[]; error: Error | null }>;
  /** Delete every row matching `filter`; return how many rows were removed. */
  delete(filter: RowFilter): Promise<{ count: number; error: Error | null }>;
}

const PROTECTED_FIELDS = ['id', 'user_id'] as const;

/**
 * Remove `id` / `user_id` from a patch at runtime so a caller can never reassign
 * a row's identity or owner, even if it bypasses the compile-time
 * {@link OwnerUpdate} type.
 */
function stripProtectedFields<TRow extends OwnerScopedRow>(patch: unknown): Partial<TRow> {
  const source = (patch ?? {}) as Record<string, unknown>;
  const safe: Record<string, unknown> = {};
  for (const key of Object.keys(source)) {
    if ((PROTECTED_FIELDS as readonly string[]).includes(key)) continue;
    safe[key] = source[key];
  }
  return safe as Partial<TRow>;
}

/**
 * Core factory: wrap an owner-agnostic {@link RowStore} with owner-only
 * semantics for a single resolved owner. This is where R9.4 is enforced, so
 * both the Supabase-backed and in-memory stores behave identically.
 */
export function createOwnerScopedAccessor<
  TRow extends OwnerScopedRow,
  TInsert = OwnerInsert<TRow>,
  TPatch = OwnerUpdate<TRow>,
>(store: RowStore<TRow>, ownerId: number): OwnerScopedAccessor<TRow, TInsert, TPatch> {
  return {
    ownerId,

    async list() {
      const { rows, error } = await store.select({ user_id: ownerId });
      return { data: error ? [] : rows, error };
    },

    async get(id) {
      const { row, error } = await store.selectOne({ id, user_id: ownerId });
      return { data: error ? null : row, error };
    },

    async insert(payload) {
      const row = {
        ...(payload as Record<string, unknown>),
        user_id: ownerId,
      } as Omit<TRow, 'id'>;
      const { row: inserted, error } = await store.insert(row);
      return { data: inserted, error };
    },

    async update(id, patch) {
      const safePatch = stripProtectedFields<TRow>(patch);
      const { rows, error } = await store.update({ id, user_id: ownerId }, safePatch);
      return { data: rows[0] ?? null, error };
    },

    async delete(id) {
      const { count, error } = await store.delete({ id, user_id: ownerId });
      return { data: !error && count > 0, error };
    },
  };
}

/* -------------------------------------------------------------------------- */
/* Supabase-backed RowStore                                                   */
/* -------------------------------------------------------------------------- */

type PostgrestError = { message: string };
interface ListResponse<T> {
  data: T[] | null;
  error: PostgrestError | null;
}
interface SingleResponse<T> {
  data: T | null;
  error: PostgrestError | null;
}

/** Read filter chain: awaitable list result, `eq` narrowing, `maybeSingle`. */
interface ReadChain<TRow> extends PromiseLike<ListResponse<TRow>> {
  eq(column: string, value: FilterValue): ReadChain<TRow>;
  maybeSingle(): PromiseLike<SingleResponse<TRow>>;
}

/** Mutation filter chain (post `update`/`delete`): `eq` narrowing then `select`. */
interface MutationChain<TRow> {
  eq(column: string, value: FilterValue): MutationChain<TRow>;
  select(columns?: string): PromiseLike<ListResponse<TRow>>;
}

interface InsertChain<TRow> {
  select(columns?: string): { single(): PromiseLike<SingleResponse<TRow>> };
}

interface TableApi<TRow> {
  select(columns?: string): ReadChain<TRow>;
  insert(rows: ReadonlyArray<Partial<TRow>>): InsertChain<TRow>;
  update(patch: Partial<TRow>): MutationChain<TRow>;
  delete(): MutationChain<TRow>;
}

/** The narrow slice of the Supabase client surface this module relies on. */
interface MinimalSupabaseClient {
  from<TRow>(table: string): TableApi<TRow>;
}

function toError(error: PostgrestError | null): Error | null {
  return error ? new Error(error.message) : null;
}

function applyEq<C extends { eq(column: string, value: FilterValue): C }>(
  chain: C,
  filter: RowFilter,
): C {
  let next = chain;
  for (const [column, value] of Object.entries(filter)) {
    next = next.eq(column, value);
  }
  return next;
}

/**
 * Build a {@link RowStore} backed by a Supabase table. Owner scoping is NOT
 * applied here; it is added by {@link createOwnerScopedAccessor}.
 *
 * The new per-user tables are not part of the generated `Database` type yet, so
 * the client is adapted to a minimal structural surface at this single boundary
 * rather than threaded through the fully-typed `from(<known table>)` overloads.
 */
export function createSupabaseRowStore<TRow extends OwnerScopedRow>(
  supabase: SupabaseClient<Database>,
  table: string,
): RowStore<TRow> {
  const db = supabase as unknown as MinimalSupabaseClient;

  return {
    async select(filter) {
      const { data, error } = await applyEq(db.from<TRow>(table).select('*'), filter);
      return { rows: data ?? [], error: toError(error) };
    },

    async selectOne(filter) {
      const { data, error } = await applyEq(
        db.from<TRow>(table).select('*'),
        filter,
      ).maybeSingle();
      return { row: data ?? null, error: toError(error) };
    },

    async insert(row) {
      const { data, error } = await db
        .from<TRow>(table)
        .insert([row as Partial<TRow>])
        .select()
        .single();
      return { row: data ?? null, error: toError(error) };
    },

    async update(filter, patch) {
      const { data, error } = await applyEq(
        db.from<TRow>(table).update(patch),
        filter,
      ).select();
      return { rows: data ?? [], error: toError(error) };
    },

    async delete(filter) {
      const { data, error } = await applyEq(db.from<TRow>(table).delete(), filter).select();
      return { count: data?.length ?? 0, error: toError(error) };
    },
  };
}

/**
 * Convenience factory: owner-scoped accessor for a Supabase table given a
 * pre-resolved `app_users.id`.
 */
export function createSupabaseOwnerScopedAccessor<
  TRow extends OwnerScopedRow,
  TInsert = OwnerInsert<TRow>,
  TPatch = OwnerUpdate<TRow>,
>(
  supabase: SupabaseClient<Database>,
  table: string,
  ownerId: number,
): OwnerScopedAccessor<TRow, TInsert, TPatch> {
  return createOwnerScopedAccessor<TRow, TInsert, TPatch>(
    createSupabaseRowStore<TRow>(supabase, table),
    ownerId,
  );
}

/**
 * Resolve the owning `app_users.id` for a Supabase auth user and return an
 * owner-scoped accessor for the given table. Use this from API route handlers
 * that hold an authenticated `User`; everything else should prefer the
 * pre-resolved-id factories above.
 */
export async function createOwnerScopedAccessorForUser<
  TRow extends OwnerScopedRow,
  TInsert = OwnerInsert<TRow>,
  TPatch = OwnerUpdate<TRow>,
>(
  supabase: SupabaseClient<Database>,
  user: User,
  table: string,
): Promise<{ accessor: OwnerScopedAccessor<TRow, TInsert, TPatch> | null; error: Error | null }> {
  const { appUser, error } = await getOrCreateAppUser(supabase, user);
  if (error || !appUser) {
    return { accessor: null, error: error ?? new Error('Unable to resolve app user') };
  }
  return {
    accessor: createSupabaseOwnerScopedAccessor<TRow, TInsert, TPatch>(
      supabase,
      table,
      appUser.id,
    ),
    error: null,
  };
}

/* -------------------------------------------------------------------------- */
/* In-memory fake RowStore + table (for deterministic / property tests)       */
/* -------------------------------------------------------------------------- */

function matchesFilter<TRow extends OwnerScopedRow>(row: TRow, filter: RowFilter): boolean {
  const record = row as unknown as Record<string, unknown>;
  return Object.entries(filter).every(([column, value]) => record[column] === value);
}

/**
 * Deterministic, dependency-free {@link RowStore} backed by a plain array.
 *
 * It performs honest equality-filtered CRUD with NO owner awareness — exactly
 * like the Supabase store — so wrapping it with {@link createOwnerScopedAccessor}
 * yields the same owner-only semantics. Ids are assigned by a monotonically
 * increasing counter (starting at `1` by default) for reproducible tests.
 */
export class InMemoryRowStore<TRow extends OwnerScopedRow> implements RowStore<TRow> {
  private rows: TRow[] = [];
  private nextId: number;

  constructor(options?: { seed?: TRow[]; startId?: number }) {
    if (options?.seed) {
      this.rows = options.seed.map((r) => ({ ...r }));
    }
    const maxSeededId = this.rows.reduce((max, r) => Math.max(max, r.id), 0);
    this.nextId = options?.startId ?? maxSeededId + 1;
  }

  /** Snapshot of all stored rows (test inspection only; not owner-scoped). */
  all(): TRow[] {
    return this.rows.map((r) => ({ ...r }));
  }

  async select(filter: RowFilter): Promise<{ rows: TRow[]; error: Error | null }> {
    const rows = this.rows.filter((r) => matchesFilter(r, filter)).map((r) => ({ ...r }));
    return { rows, error: null };
  }

  async selectOne(filter: RowFilter): Promise<{ row: TRow | null; error: Error | null }> {
    const found = this.rows.find((r) => matchesFilter(r, filter));
    return { row: found ? { ...found } : null, error: null };
  }

  async insert(row: Omit<TRow, 'id'>): Promise<{ row: TRow | null; error: Error | null }> {
    const created = { ...(row as object), id: this.nextId++ } as TRow;
    this.rows.push(created);
    return { row: { ...created }, error: null };
  }

  async update(
    filter: RowFilter,
    patch: Partial<TRow>,
  ): Promise<{ rows: TRow[]; error: Error | null }> {
    const updated: TRow[] = [];
    this.rows = this.rows.map((r) => {
      if (!matchesFilter(r, filter)) return r;
      const next = { ...r, ...patch } as TRow;
      updated.push({ ...next });
      return next;
    });
    return { rows: updated, error: null };
  }

  async delete(filter: RowFilter): Promise<{ count: number; error: Error | null }> {
    const before = this.rows.length;
    this.rows = this.rows.filter((r) => !matchesFilter(r, filter));
    return { count: before - this.rows.length, error: null };
  }
}

/**
 * An in-memory per-user table that can mint owner-scoped accessors for any
 * number of owners over a SHARED backing store. Ideal for multi-user property
 * tests (e.g. proving user B cannot read or mutate user A's rows): both
 * accessors are produced by the same {@link createOwnerScopedAccessor} factory,
 * so they share identical owner-only semantics.
 */
export interface InMemoryOwnerScopedTable<
  TRow extends OwnerScopedRow,
  TInsert = OwnerInsert<TRow>,
  TPatch = OwnerUpdate<TRow>,
> {
  /** Owner-scoped accessor for `ownerId` over the shared store. */
  forOwner(ownerId: number): OwnerScopedAccessor<TRow, TInsert, TPatch>;
  /** The shared, owner-agnostic backing store (test inspection). */
  readonly store: InMemoryRowStore<TRow>;
}

/**
 * Build an {@link InMemoryOwnerScopedTable}. Pass `seed` rows and/or a
 * `startId` for fully deterministic fixtures.
 */
export function createInMemoryOwnerScopedTable<
  TRow extends OwnerScopedRow,
  TInsert = OwnerInsert<TRow>,
  TPatch = OwnerUpdate<TRow>,
>(options?: { seed?: TRow[]; startId?: number }): InMemoryOwnerScopedTable<TRow, TInsert, TPatch> {
  const store = new InMemoryRowStore<TRow>(options);
  return {
    store,
    forOwner(ownerId: number) {
      return createOwnerScopedAccessor<TRow, TInsert, TPatch>(store, ownerId);
    },
  };
}
