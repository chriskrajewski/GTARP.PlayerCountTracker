-- Function to backfill missing player_counts data using historical averages
-- Automatically detects the gap or accepts manual override
-- Usage: SELECT backfill_player_counts();  -- auto-detect gap
-- Usage: SELECT backfill_player_counts('2026-05-29T06:45:00Z', '2026-05-29T19:33:00Z');

DROP FUNCTION IF EXISTS backfill_player_counts(TIMESTAMPTZ, TIMESTAMPTZ, INT, INT);

CREATE OR REPLACE FUNCTION backfill_player_counts(
  gap_start TIMESTAMPTZ DEFAULT NULL,
  gap_end TIMESTAMPTZ DEFAULT NULL,
  interval_seconds INT DEFAULT 180,
  lookback_days INT DEFAULT 7
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET statement_timeout = '300s'
AS $$
DECLARE
  result JSON;
  server RECORD;
  slot TIMESTAMPTZ;
  avg_count INT;
  total_inserted INT := 0;
  server_results JSON[] := '{}';
  server_inserted INT;
  detected_gap_start TIMESTAMPTZ;
  detected_gap_end TIMESTAMPTZ;
BEGIN
  -- Auto-detect gap if not provided
  IF gap_start IS NULL OR gap_end IS NULL THEN
    -- Find the largest gap in the last 48 hours
    -- by looking at consecutive records and finding the biggest time jump
    WITH recent_records AS (
      SELECT created_at,
             LEAD(created_at) OVER (ORDER BY created_at) AS next_created_at
      FROM player_counts
      WHERE created_at > NOW() - INTERVAL '48 hours'
      ORDER BY created_at
    ),
    gaps AS (
      SELECT created_at AS gap_start_time,
             next_created_at AS gap_end_time,
             EXTRACT(EPOCH FROM (next_created_at - created_at)) AS gap_seconds
      FROM recent_records
      WHERE next_created_at IS NOT NULL
    )
    SELECT gap_start_time, gap_end_time INTO detected_gap_start, detected_gap_end
    FROM gaps
    WHERE gap_seconds > 600  -- only consider gaps > 10 minutes
    ORDER BY gap_seconds DESC
    LIMIT 1;

    IF detected_gap_start IS NULL THEN
      RETURN json_build_object(
        'success', false,
        'error', 'No significant data gap detected in the last 48 hours'
      );
    END IF;

    gap_start := detected_gap_start;
    gap_end := detected_gap_end;
  END IF;

  -- Validate
  IF gap_end <= gap_start THEN
    RAISE EXCEPTION 'gap_end must be after gap_start';
  END IF;
  IF interval_seconds < 60 OR interval_seconds > 900 THEN
    RAISE EXCEPTION 'interval_seconds must be between 60 and 900';
  END IF;
  IF EXTRACT(EPOCH FROM (gap_end - gap_start)) > 172800 THEN
    RAISE EXCEPTION 'Cannot backfill more than 48 hours at once';
  END IF;

  -- Iterate through each active server
  FOR server IN SELECT server_id, server_name FROM server_xref ORDER BY "order"
  LOOP
    server_inserted := 0;
    slot := gap_start;

    WHILE slot < gap_end LOOP
      -- Get average player count for this time-of-day from previous days
      SELECT COALESCE(ROUND(AVG(pc.player_count)), 0)::INT INTO avg_count
      FROM player_counts pc
      WHERE pc.server_id = server.server_id
        AND pc.created_at >= gap_start - (lookback_days || ' days')::INTERVAL
        AND pc.created_at < gap_start
        AND EXTRACT(HOUR FROM pc.created_at) = EXTRACT(HOUR FROM slot)
        AND ABS(EXTRACT(MINUTE FROM pc.created_at) - EXTRACT(MINUTE FROM slot)) <= 2;

      -- Only insert if we got a meaningful average
      IF avg_count > 0 THEN
        INSERT INTO player_counts (timestamp, player_count, server_id, created_at)
        VALUES (slot, avg_count, server.server_id, slot)
        ON CONFLICT DO NOTHING;

        server_inserted := server_inserted + 1;
      END IF;

      slot := slot + (interval_seconds || ' seconds')::INTERVAL;
    END LOOP;

    total_inserted := total_inserted + server_inserted;
    server_results := server_results || json_build_object(
      'server_id', server.server_id,
      'server_name', server.server_name,
      'records_inserted', server_inserted
    )::JSON;
  END LOOP;

  result := json_build_object(
    'success', true,
    'gap_start', gap_start,
    'gap_end', gap_end,
    'auto_detected', (detected_gap_start IS NOT NULL),
    'interval_seconds', interval_seconds,
    'lookback_days', lookback_days,
    'total_inserted', total_inserted,
    'servers', to_json(server_results)
  );

  RETURN result;
END;
$$;
