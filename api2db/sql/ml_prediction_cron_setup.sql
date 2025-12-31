-- ============================================================================
-- ML Restart Predictions - Cron Job Setup
-- ============================================================================
-- This script provides setup instructions for cron jobs.
-- 
-- NOTE: pg_cron with database secrets is NOT recommended for Supabase.
-- Use one of the external options below instead.
-- ============================================================================

-- ============================================================================
-- ⚠️ DO NOT USE pg_cron - Use External Options Instead
-- ============================================================================
-- 
-- Supabase does not reliably support pg_cron for calling external APIs.
-- The vault extension may not be available or may not work as expected.
-- 
-- Instead, use ONE of these proven options:
-- 1. Supabase Dashboard Cron Jobs (Easiest)
-- 2. cron-job.org (Free, no Supabase plan required)
-- 3. GitHub Actions (If using GitHub)
-- 
-- See docs/ML_SETUP_QUICK_START.md for step-by-step instructions.
-- ============================================================================

-- ============================================================================
-- HELPER: View Prediction Refresh Status
-- ============================================================================

-- Create a view to monitor prediction freshness
CREATE OR REPLACE VIEW public.ml_prediction_status AS
SELECT 
  server_id,
  detected_pattern,
  confidence,
  next_restart_time,
  updated_at,
  EXTRACT(EPOCH FROM (NOW() - updated_at)) / 60 as minutes_since_update,
  CASE 
    WHEN updated_at < NOW() - INTERVAL '30 minutes' THEN 'STALE'
    WHEN updated_at < NOW() - INTERVAL '15 minutes' THEN 'AGING'
    ELSE 'FRESH'
  END as status
FROM public.server_restart_predictions
ORDER BY updated_at DESC;

-- Grant access
GRANT SELECT ON public.ml_prediction_status TO authenticated;
GRANT SELECT ON public.ml_prediction_status TO anon;

-- Usage: SELECT * FROM ml_prediction_status;

-- ============================================================================
-- HELPER: Manual Refresh Trigger
-- ============================================================================

-- Function to manually trigger a refresh (for testing)
-- Call via: SELECT trigger_ml_prediction_refresh();
CREATE OR REPLACE FUNCTION trigger_ml_prediction_refresh()
RETURNS TEXT AS $$
BEGIN
  -- This returns instructions for manually triggering a refresh
  RETURN 'To manually trigger refresh, call the Edge Function:
  
  curl -X POST "https://YOUR_PROJECT.supabase.co/functions/v1/predict-server-restart" \
    -H "Authorization: Bearer YOUR_SERVICE_ROLE_KEY" \
    -H "Content-Type: application/json" \
    -d ''{"cron": true}''
  
  Or use the Supabase Dashboard > Edge Functions > predict-server-restart > Invoke';
END;
$$ LANGUAGE plpgsql;

GRANT EXECUTE ON FUNCTION trigger_ml_prediction_refresh TO authenticated;

-- ============================================================================
-- SETUP INSTRUCTIONS
-- ============================================================================
-- 
-- Choose ONE of these options:
-- 
-- OPTION 1: Supabase Dashboard Cron (Recommended - Easiest)
-- ─────────────────────────────────────────────────────────
-- 1. Go to Supabase Dashboard > Database > Cron Jobs
-- 2. Click "Create a new cron job"
-- 3. Configure:
--    - Name: ml-prediction-refresh
--    - Schedule: */15 * * * * (every 15 minutes)
--    - Method: POST
--    - URL: https://YOUR_PROJECT.supabase.co/functions/v1/predict-server-restart
--    - Headers:
--      Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpndXl6ZG94dXdoYnlpem5wb3NlIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0NjM3MDg2OCwiZXhwIjoyMDYxOTQ2ODY4fQ.hivS8pXjdCN5mKOX_1UMt7oyuQTntP8DYU637ramm0Q
--      Content-Type: application/json
--    - Body: {"cron": true}
-- 
-- OPTION 2: cron-job.org (Free, No Supabase Plan Required)
-- ──────────────────────────────────────────────────────────
-- 1. Go to https://cron-job.org
-- 2. Click "Create Cron Job"
-- 3. Configure:
--    - URL: https://YOUR_PROJECT.supabase.co/functions/v1/predict-server-restart
--    - Method: POST
--    - Schedule: Every 15 minutes
--    - Headers:
--      Authorization: Bearer YOUR_SERVICE_ROLE_KEY
--      Content-Type: application/json
--    - Body: {"cron": true}
-- 
-- OPTION 3: GitHub Actions (If Using GitHub)
-- ────────────────────────────────────────────
-- 1. Create .github/workflows/ml-predictions-cron.yml with:
--    
--    name: ML Predictions Cron
--    on:
--      schedule:
--        - cron: '*/15 * * * *'
--      workflow_dispatch:
--    
--    jobs:
--      refresh-predictions:
--        runs-on: ubuntu-latest
--        steps:
--          - name: Trigger ML Prediction Refresh
--            run: |
--              curl -X POST "${{ secrets.SUPABASE_URL }}/functions/v1/predict-server-restart" \
--                -H "Authorization: Bearer ${{ secrets.SUPABASE_SERVICE_ROLE_KEY }}" \
--                -H "Content-Type: application/json" \
--                -d '{"cron": true}'
-- 
-- 2. Add GitHub secrets:
--    - SUPABASE_URL: Your Supabase project URL
--    - SUPABASE_SERVICE_ROLE_KEY: Your service role key
-- 
-- ============================================================================
-- WHERE TO FIND YOUR CREDENTIALS
-- ============================================================================
-- 
-- Supabase URL:
--   Supabase Dashboard > Settings > General > Project URL
--   (looks like: https://xxxxx.supabase.co)
-- 
-- Service Role Key:
--   Supabase Dashboard > Settings > API > Service Role
--   (starts with: eyJ...)
--   ⚠️ KEEP THIS SECRET - Never commit to git
-- 
-- ============================================================================
-- TESTING
-- ============================================================================
-- 
-- Manual trigger:
--   curl -X POST "https://YOUR_PROJECT.supabase.co/functions/v1/predict-server-restart" \
--     -H "Authorization: Bearer YOUR_SERVICE_ROLE_KEY" \
--     -H "Content-Type: application/json" \
--     -d '{"cron": true}'
-- 
-- Check status:
--   SELECT * FROM ml_prediction_status;
-- 
-- View logs:
--   supabase functions logs predict-server-restart --tail
-- 
-- ============================================================================
