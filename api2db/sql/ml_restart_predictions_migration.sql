-- ============================================================================
-- Server Restart Predictions - ML Enhancement Migration
-- ============================================================================
-- This migration adds columns to support ML-based predictions with OpenAI
-- Run this AFTER the original server_restart_predictions.sql migration
-- ============================================================================

-- ============================================================================
-- 1. ADD ML-SPECIFIC COLUMNS TO PREDICTIONS TABLE
-- ============================================================================

-- Add ml_reasoning column to store OpenAI's explanation
ALTER TABLE public.server_restart_predictions 
ADD COLUMN IF NOT EXISTS ml_reasoning TEXT;

-- Add index on updated_at for efficient cache freshness checks
CREATE INDEX IF NOT EXISTS idx_server_restart_predictions_cache_freshness 
  ON public.server_restart_predictions(server_id, updated_at DESC);

-- ============================================================================
-- 2. CREATE VIEW FOR ML PREDICTION STATUS
-- ============================================================================

CREATE OR REPLACE VIEW public.server_restart_prediction_status AS
SELECT 
  server_id,
  next_restart_time,
  confidence,
  detected_pattern,
  pattern_type,
  ml_reasoning,
  last_restart_time,
  average_downtime,
  detected_events_count,
  updated_at,
  -- Calculate if prediction is stale (older than 15 minutes)
  CASE 
    WHEN updated_at < NOW() - INTERVAL '15 minutes' THEN TRUE 
    ELSE FALSE 
  END as is_stale,
  -- Calculate minutes until next restart
  CASE 
    WHEN next_restart_time IS NOT NULL AND next_restart_time > NOW() 
    THEN EXTRACT(EPOCH FROM (next_restart_time - NOW())) / 60
    ELSE NULL 
  END as minutes_until_restart,
  -- Calculate time since last update
  EXTRACT(EPOCH FROM (NOW() - updated_at)) / 60 as minutes_since_update
FROM public.server_restart_predictions;

-- Grant access to the view
GRANT SELECT ON public.server_restart_prediction_status TO authenticated;
GRANT SELECT ON public.server_restart_prediction_status TO anon;

-- ============================================================================
-- 3. CREATE FUNCTION TO GET PREDICTIONS WITH STALENESS INDICATOR
-- ============================================================================

CREATE OR REPLACE FUNCTION get_restart_predictions_with_status(
  p_server_ids TEXT[] DEFAULT NULL
)
RETURNS TABLE (
  server_id TEXT,
  next_restart_time TIMESTAMP WITH TIME ZONE,
  confidence INTEGER,
  detected_pattern TEXT,
  pattern_type TEXT,
  ml_reasoning TEXT,
  last_restart_time TIMESTAMP WITH TIME ZONE,
  average_downtime INTEGER,
  detected_events_count INTEGER,
  updated_at TIMESTAMP WITH TIME ZONE,
  is_stale BOOLEAN,
  minutes_until_restart NUMERIC,
  minutes_since_update NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    p.server_id,
    p.next_restart_time,
    p.confidence,
    p.detected_pattern,
    p.pattern_type,
    p.ml_reasoning,
    p.last_restart_time,
    p.average_downtime,
    p.detected_events_count,
    p.updated_at,
    CASE 
      WHEN p.updated_at < NOW() - INTERVAL '15 minutes' THEN TRUE 
      ELSE FALSE 
    END as is_stale,
    CASE 
      WHEN p.next_restart_time IS NOT NULL AND p.next_restart_time > NOW() 
      THEN EXTRACT(EPOCH FROM (p.next_restart_time - NOW())) / 60
      ELSE NULL 
    END as minutes_until_restart,
    EXTRACT(EPOCH FROM (NOW() - p.updated_at)) / 60 as minutes_since_update
  FROM public.server_restart_predictions p
  WHERE p_server_ids IS NULL OR p.server_id = ANY(p_server_ids);
END;
$$ LANGUAGE plpgsql STABLE;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION get_restart_predictions_with_status TO authenticated;
GRANT EXECUTE ON FUNCTION get_restart_predictions_with_status TO anon;

-- ============================================================================
-- 4. CREATE CLEANUP FUNCTION FOR OLD PREDICTIONS
-- ============================================================================

CREATE OR REPLACE FUNCTION cleanup_stale_predictions(
  p_max_age_hours INTEGER DEFAULT 24
)
RETURNS INTEGER AS $$
DECLARE
  v_deleted_count INTEGER;
BEGIN
  -- Delete predictions that haven't been updated in the specified time
  -- This helps clean up predictions for servers that are no longer active
  DELETE FROM public.server_restart_predictions
  WHERE updated_at < NOW() - (p_max_age_hours || ' hours')::INTERVAL
    AND server_id NOT IN (
      SELECT DISTINCT server_id 
      FROM player_counts 
      WHERE timestamp >= NOW() - INTERVAL '24 hours'
    );
  
  GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
  
  RETURN v_deleted_count;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 5. UPDATE RLS POLICIES
-- ============================================================================

-- Enable RLS on the predictions table if not already enabled
ALTER TABLE public.server_restart_predictions ENABLE ROW LEVEL SECURITY;

-- Allow anyone to read predictions
DROP POLICY IF EXISTS "Allow public read access to predictions" ON public.server_restart_predictions;
CREATE POLICY "Allow public read access to predictions" 
  ON public.server_restart_predictions 
  FOR SELECT 
  USING (true);

-- Only service role can insert/update predictions
DROP POLICY IF EXISTS "Allow service role to manage predictions" ON public.server_restart_predictions;
CREATE POLICY "Allow service role to manage predictions" 
  ON public.server_restart_predictions 
  FOR ALL 
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- ============================================================================
-- 6. COMMENTS FOR DOCUMENTATION
-- ============================================================================

COMMENT ON TABLE public.server_restart_predictions IS 
'Stores ML-generated server restart predictions. Predictions are cached and refreshed every 15 minutes by the predict-server-restart Edge Function.';

COMMENT ON COLUMN public.server_restart_predictions.ml_reasoning IS 
'OpenAI GPT-4o-mini reasoning explanation for the prediction pattern analysis.';

COMMENT ON COLUMN public.server_restart_predictions.pattern_type IS 
'Type of detected pattern: fixed-interval, fixed-time, irregular, or insufficient-data.';

COMMENT ON COLUMN public.server_restart_predictions.confidence IS 
'ML confidence score from 0-100 based on pattern consistency and data quality.';

COMMENT ON VIEW public.server_restart_prediction_status IS 
'View that adds computed staleness and time-until-restart fields to predictions.';

COMMENT ON FUNCTION get_restart_predictions_with_status IS 
'Returns predictions with computed staleness indicators. Pass NULL for all servers or an array of server IDs.';

