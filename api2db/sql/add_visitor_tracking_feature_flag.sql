-- Add visitor_tracking feature flag
-- When disabled, all visitor tracking (sessions, page views, events, heartbeats, errors, performance, conversions) is stopped.

INSERT INTO feature_flags (key, name, description, is_enabled, category)
VALUES (
  'visitor_tracking',
  'Visitor Tracking',
  'Controls all visitor/user tracking including sessions, page views, events, performance metrics, and error tracking. When disabled, no tracking data is collected and all tracking API calls are rejected.',
  true,
  'site'
)
ON CONFLICT (key) DO NOTHING;
