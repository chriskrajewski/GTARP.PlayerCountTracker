-- ============================================================================
-- DEBUGGING AND TESTING SCRIPT
-- ============================================================================
-- Use this script to test and debug the restart prediction functions

-- ============================================================================
-- 1. TEST RESTART EVENT DETECTION
-- ============================================================================

-- Check if restart events are being detected for a specific server
-- Replace 'nopixel' with your server ID
SELECT 
  event_timestamp,
  player_count_before,
  player_count_after,
  downtime_minutes
FROM detect_restart_events('nopixel', 14)
ORDER BY event_timestamp DESC;

-- Count restart events per server
SELECT 
  server_id,
  COUNT(*) as restart_count
FROM (
  SELECT DISTINCT server_id FROM player_counts WHERE timestamp >= NOW() - INTERVAL '14 days'
) servers
CROSS JOIN LATERAL detect_restart_events(servers.server_id, 14) events
GROUP BY server_id
ORDER BY restart_count DESC;

-- ============================================================================
-- 2. TEST PATTERN ANALYSIS
-- ============================================================================

-- Check pattern analysis for a specific server
SELECT 
  pattern_type,
  pattern_interval,
  pattern_time_of_day,
  pattern_variance,
  pattern_occurrences,
  confidence
FROM analyze_restart_pattern('nopixel', 14);

-- ============================================================================
-- 3. TEST FULL PREDICTION CALCULATION
-- ============================================================================

-- Get predictions for a specific server
SELECT 
  server_id,
  next_restart_time,
  confidence,
  detected_pattern,
  last_restart_time,
  average_downtime,
  pattern_type,
  pattern_occurrences
FROM calculate_server_restart_predictions('nopixel', 14);

-- Get predictions for all servers
SELECT 
  server_id,
  next_restart_time,
  confidence,
  detected_pattern,
  last_restart_time,
  average_downtime,
  pattern_type,
  pattern_occurrences
FROM calculate_server_restart_predictions(NULL, 14)
ORDER BY confidence DESC;

-- ============================================================================
-- 4. CHECK PLAYER COUNT DATA QUALITY
-- ============================================================================

-- Check if player count data exists for a server
SELECT 
  server_id,
  COUNT(*) as data_points,
  MIN(timestamp) as earliest,
  MAX(timestamp) as latest,
  ROUND(EXTRACT(EPOCH FROM (MAX(timestamp) - MIN(timestamp))) / 3600 / 24, 1) as days_of_data
FROM player_counts
WHERE server_id = 'nopixel'
  AND timestamp >= NOW() - INTERVAL '14 days'
GROUP BY server_id;

-- Check for rapid drops in player count (potential restarts)
SELECT 
  server_id,
  timestamp,
  player_count,
  LAG(player_count) OVER (PARTITION BY server_id ORDER BY timestamp) as prev_count,
  CASE 
    WHEN LAG(player_count) OVER (PARTITION BY server_id ORDER BY timestamp) > 0
    THEN ROUND(((LAG(player_count) OVER (PARTITION BY server_id ORDER BY timestamp) - player_count) / 
                LAG(player_count) OVER (PARTITION BY server_id ORDER BY timestamp)::NUMERIC) * 100, 1)
    ELSE 0
  END as drop_percentage
FROM player_counts
WHERE server_id = 'nopixel'
  AND timestamp >= NOW() - INTERVAL '14 days'
ORDER BY timestamp DESC
LIMIT 100;

-- ============================================================================
-- 5. REFRESH PREDICTIONS AND CHECK RESULTS
-- ============================================================================

-- Manually refresh all predictions
SELECT * FROM refresh_all_restart_predictions();

-- Check the predictions table
SELECT 
  server_id,
  next_restart_time,
  confidence,
  detected_pattern,
  pattern_type,
  pattern_occurrences,
  updated_at
FROM server_restart_predictions
ORDER BY updated_at DESC
LIMIT 20;

-- ============================================================================
-- 6. TROUBLESHOOTING QUERIES
-- ============================================================================

-- Check if there are any servers with data
SELECT COUNT(DISTINCT server_id) as total_servers
FROM player_counts
WHERE timestamp >= NOW() - INTERVAL '14 days';

-- Check data collection frequency
SELECT 
  server_id,
  ROUND(AVG(EXTRACT(EPOCH FROM (timestamp - LAG(timestamp) OVER (PARTITION BY server_id ORDER BY timestamp))) / 60), 1) as avg_minutes_between_samples
FROM player_counts
WHERE timestamp >= NOW() - INTERVAL '1 day'
GROUP BY server_id
ORDER BY avg_minutes_between_samples DESC;

-- Check for servers with very low player counts (potential restarts)
SELECT 
  server_id,
  timestamp,
  player_count
FROM player_counts
WHERE player_count < 5
  AND timestamp >= NOW() - INTERVAL '14 days'
ORDER BY timestamp DESC
LIMIT 50;

-- ============================================================================
-- 7. PERFORMANCE MONITORING
-- ============================================================================

-- Check how long functions take to execute
-- Run this before and after to measure performance
SELECT NOW() as start_time;

-- Run the calculation
SELECT * FROM calculate_server_restart_predictions(NULL, 14) LIMIT 1;

SELECT NOW() as end_time;

-- Check table sizes
SELECT 
  schemaname,
  tablename,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as size
FROM pg_tables
WHERE tablename IN ('player_counts', 'server_restart_predictions', 'server_restart_events')
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;

