-- Add Site Feature Enhancement feature flags
-- Registers the seven flags that gate the batch of site feature enhancements
-- (comparison view, alerts, streamer pages, insights/wrapped, prediction
-- accuracy, public anomaly surfacing, and the capacity advisor).
-- All flags ship disabled by default because these are gated, independent
-- rollouts (R1.1).

INSERT INTO public.feature_flags (key, name, description, is_enabled, category)
VALUES
  ('comparison_view', 'Server Comparison View', 'Enable the side-by-side server comparison page where users pin 2-4 servers and compare overlaid charts and stats', false, 'site'),
  ('alerts', 'User Alerts & Notifications', 'Enable alert subscriptions and web-push notifications for player-count thresholds and streamer activity', false, 'site'),
  ('streamer_pages', 'Streamer Profile Pages', 'Enable dedicated streamer profile pages showing servers, clip history, live status, and viewer trends', false, 'site'),
  ('insights_wrapped', 'Historical Wrapped & Insights', 'Enable generated monthly recap ("wrapped") reports summarizing notable statistics', false, 'site'),
  ('prediction_accuracy', 'Restart Prediction Accuracy', 'Enable display of restart-prediction accuracy metrics and confidence levels', false, 'site'),
  ('anomaly_public', 'Public Anomaly Surfacing', 'Enable public display of detected player-count anomalies on server pages', false, 'site'),
  ('capacity_advisor', 'Capacity & Queue Advisor', 'Enable the best-time-to-join recommendation derived from historical capacity and queue data', false, 'site')
-- On conflict, refresh the display metadata but intentionally DO NOT overwrite
-- is_enabled. Re-running this seed must never silently disable a flag an admin
-- has already turned on (or re-enable one they turned off).
ON CONFLICT (key) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  category = EXCLUDED.category;
