-- Materialized view: pre-computed daily average player counts per server.
-- This eliminates the need to scan millions of raw rows for 7d+ chart queries.
--
-- Refresh strategy: call REFRESH MATERIALIZED VIEW CONCURRENTLY at the end of
-- each data-ingestion cycle (or on a pg_cron schedule, e.g. every 15 minutes).
-- CONCURRENTLY allows reads while the refresh is running.

-- Create the materialized view
CREATE MATERIALIZED VIEW IF NOT EXISTS public.player_counts_daily AS
SELECT
  server_id,
  date_trunc('day', "timestamp")::date AS day,
  round(avg(player_count))::integer   AS avg_player_count,
  max(player_count)                    AS max_player_count,
  min(player_count)                    AS min_player_count,
  count(*)::integer                    AS sample_count
FROM public.player_counts
GROUP BY server_id, date_trunc('day', "timestamp")
ORDER BY server_id, day;

-- Unique index required for CONCURRENTLY refresh
CREATE UNIQUE INDEX IF NOT EXISTS player_counts_daily_uniq
  ON public.player_counts_daily (server_id, day);

-- Index for time-range queries
CREATE INDEX IF NOT EXISTS player_counts_daily_day_idx
  ON public.player_counts_daily (day);

-- Grant read access (anon role used by the browser/server clients)
GRANT SELECT ON public.player_counts_daily TO anon;
GRANT SELECT ON public.player_counts_daily TO authenticated;

-- Initial refresh
REFRESH MATERIALIZED VIEW public.player_counts_daily;

-- Optional: set up pg_cron to auto-refresh every 15 minutes.
-- Uncomment if pg_cron is enabled on your Supabase project:
--
-- SELECT cron.schedule(
--   'refresh_player_counts_daily',
--   '*/15 * * * *',
--   $$REFRESH MATERIALIZED VIEW CONCURRENTLY public.player_counts_daily$$
-- );
