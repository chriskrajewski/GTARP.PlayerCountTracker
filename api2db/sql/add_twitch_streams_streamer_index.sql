-- Indexes supporting Streamer Character Tracking reads over twitch_streams.
-- The character catalog/sessions and viewer-trend reads filter by
-- streamer_name and bound by created_at; twitch_streams previously had only
-- its primary key, forcing full scans (statement timeouts on busy streamers).
--
-- IMPORTANT: those reads match streamer_name case-insensitively with `ILIKE`
-- (the `~~*` operator) — e.g. `streamer_name ILIKE 'penta'`. A PLAIN B-TREE
-- index CANNOT satisfy an ILIKE predicate, so the b-tree indexes below are
-- ignored by the planner for those queries and the scan falls back to a full
-- table scan (this is what kept tripping the Postgres statement timeout,
-- SQLSTATE 57014, e.g. /streamers/twitch/penta taking ~50s).
--
-- The fix is a trigram GIN index (pg_trgm), which is the index type Postgres
-- CAN use to serve LIKE/ILIKE predicates — including the wildcard-escaped exact
-- match these reads perform. It narrows the scan from "every row in
-- twitch_streams" down to just the target streamer's rows before the created_at
-- bound + ordering are applied.
--
-- All statements are SAFE and ADDITIVE on the EXISTING `twitch_streams` table:
-- they add no columns, change no data, and `if not exists` makes the migration
-- idempotent (re-running it is a no-op).

-- Trigram matching support (no-op if already installed). Required by the GIN
-- index below; available on Supabase/standard Postgres.
create extension if not exists pg_trgm;

-- Serves the case-insensitive `streamer_name ILIKE '<name>'` filter used by the
-- character catalog/sessions reads and by lib/streamers.ts
-- (getStreamerViewerTrend, recent live rows). THIS is the index that actually
-- eliminates the full scan / statement timeout.
create index if not exists idx_twitch_streams_streamer_name_trgm
  on public.twitch_streams using gin (streamer_name gin_trgm_ops);

-- Retained, additive b-tree indexes. NOTE: these do NOT serve the ILIKE reads
-- above (see header); they remain useful for any case-SENSITIVE equality /
-- range access on these columns (e.g. created_at bounds, exact streamer_name
-- joins) and are kept to avoid a destructive drop.
create index if not exists idx_twitch_streams_streamer_name
  on public.twitch_streams (streamer_name);

create index if not exists idx_twitch_streams_created_at
  on public.twitch_streams (created_at);

create index if not exists idx_twitch_streams_streamer_created
  on public.twitch_streams (streamer_name, created_at desc);
