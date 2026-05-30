-- Indexes supporting Streamer Character Tracking reads over twitch_streams.
-- The character catalog/sessions and viewer-trend reads filter by
-- streamer_name and bound by created_at; twitch_streams previously had only
-- its primary key, forcing full scans (statement timeouts on busy streamers).
--
-- These are SAFE, ADDITIVE indexes on the EXISTING `twitch_streams` table: they
-- add no columns, change no data, and `create index if not exists` makes the
-- migration idempotent (re-running it is a no-op). The composite
-- (streamer_name, created_at desc) index in particular directly serves the
-- bounded "most-recent titles for a streamer" read.
create index if not exists idx_twitch_streams_streamer_name
  on public.twitch_streams (streamer_name);

create index if not exists idx_twitch_streams_created_at
  on public.twitch_streams (created_at);

create index if not exists idx_twitch_streams_streamer_created
  on public.twitch_streams (streamer_name, created_at desc);
