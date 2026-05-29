-- Function to detect data gaps in player_counts from the last 48 hours
-- Returns all gaps > 10 minutes sorted by duration
-- Usage: SELECT detect_data_gaps();

DROP FUNCTION IF EXISTS detect_data_gaps();

CREATE OR REPLACE FUNCTION detect_data_gaps()
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET statement_timeout = '30s'
AS $$
DECLARE
  result JSON;
BEGIN
  WITH recent_records AS (
    SELECT created_at,
           LEAD(created_at) OVER (ORDER BY created_at) AS next_created_at
    FROM player_counts
    WHERE created_at > NOW() - INTERVAL '48 hours'
  ),
  gaps AS (
    SELECT
      created_at AS gap_start,
      next_created_at AS gap_end,
      EXTRACT(EPOCH FROM (next_created_at - created_at))::INT AS gap_seconds
    FROM recent_records
    WHERE next_created_at IS NOT NULL
      AND EXTRACT(EPOCH FROM (next_created_at - created_at)) > 600
  )
  SELECT json_build_object(
    'success', true,
    'gaps', COALESCE(json_agg(
      json_build_object(
        'gap_start', gap_start,
        'gap_end', gap_end,
        'duration_seconds', gap_seconds,
        'duration_human', 
          CASE
            WHEN gap_seconds >= 3600 THEN ROUND(gap_seconds / 3600.0, 1) || ' hours'
            ELSE ROUND(gap_seconds / 60.0, 0) || ' minutes'
          END
      ) ORDER BY gap_seconds DESC
    ), '[]'::json),
    'total_gaps', (SELECT COUNT(*) FROM gaps)
  ) INTO result
  FROM gaps;

  RETURN result;
END;
$$;
