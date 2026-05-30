-- Trigram (pg_trgm) indexes for the case-insensitive streamer lookups used by
-- the Streamer Profile page and Streamer Character Tracking reads.
--
-- WHY THIS EXISTS
-- ---------------
-- Every per-streamer read in lib/streamers.ts and lib/streamer-characters.ts
-- matches the streamer with a wildcard-escaped `ILIKE` (the `~~*` operator),
-- e.g. `streamer_name ILIKE 'penta'` / `streamer_username ILIKE 'penta'`, then
-- re-filters in memory for an exact case-insensitive match. This is the
-- established matching pattern in the codebase.
--
-- A PLAIN B-TREE INDEX CANNOT SERVE AN `ILIKE` PREDICATE. That includes the
-- `lower(streamer_name)` b-tree indexes already on character_extractions — the
-- planner ignores them for `~~*` and falls back to a FULL TABLE SCAN. On busy
-- streamers and accumulating tables this is what makes the page horrendously
-- slow / time out (SQLSTATE 57014). The companion file
-- add_twitch_streams_streamer_index.sql already fixed `twitch_streams`; this
-- file covers the REMAINING tables read with `ILIKE` on the same page:
--
--   * character_extractions.streamer_name   (readResolvedTitleRecords — the
--                                             read that was throwing 57014; it
--                                             has NO created_at bound, so the
--                                             seq scan reads the whole table)
--   * twitch_clips.streamer_username        (getStreamerClips / clip association)
--   * kick_clips.streamer_username          (getStreamerClips / clip association)
--   * streamer_server_history.streamer_username
--                                           (getStreamerServers, getStreamerProfile,
--                                            linkPlatformIdentities)
--
-- A trigram GIN index is the index type Postgres CAN use for LIKE/ILIKE, so
-- each lookup narrows to just the target streamer's rows instead of scanning
-- the whole table.
--
-- All statements are SAFE and ADDITIVE: no columns added, no data changed, and
-- `if not exists` makes the migration idempotent (re-running is a no-op). The
-- existing plain b-tree indexes on these columns are LEFT IN PLACE (they still
-- help case-sensitive equality / joins); nothing is dropped.

-- Required by the GIN indexes below (no-op if already installed).
create extension if not exists pg_trgm;

-- Character extraction cache lookups (the 57014 source). This is the highest
-- impact index here because that read has no time bound.
create index if not exists idx_char_extractions_streamer_trgm
  on public.character_extractions using gin (streamer_name gin_trgm_ops);

-- Clip reads for the profile page + per-character clip association.
create index if not exists idx_twitch_clips_streamer_trgm
  on public.twitch_clips using gin (streamer_username gin_trgm_ops);

create index if not exists idx_kick_clips_streamer_trgm
  on public.kick_clips using gin (streamer_username gin_trgm_ops);

-- Streamer/server history: servers list, profile display name, identities.
create index if not exists idx_streamer_history_username_trgm
  on public.streamer_server_history using gin (streamer_username gin_trgm_ops);
