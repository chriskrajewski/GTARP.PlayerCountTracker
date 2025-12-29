-- Enhanced Visitor Tracking System - Comprehensive Schema
-- Extends the basic visitor_sessions table with detailed analytics

-- ============================================================================
-- Enhanced visitor_sessions table with comprehensive tracking
-- ============================================================================
-- Captures detailed information about each visitor session

ALTER TABLE public.visitor_sessions ADD COLUMN IF NOT EXISTS
  device_type TEXT; -- 'desktop', 'mobile', 'tablet'

ALTER TABLE public.visitor_sessions ADD COLUMN IF NOT EXISTS
  browser_name TEXT; -- 'Chrome', 'Firefox', 'Safari', etc.

ALTER TABLE public.visitor_sessions ADD COLUMN IF NOT EXISTS
  browser_version TEXT; -- Browser version

ALTER TABLE public.visitor_sessions ADD COLUMN IF NOT EXISTS
  os_name TEXT; -- 'Windows', 'macOS', 'Linux', 'iOS', 'Android'

ALTER TABLE public.visitor_sessions ADD COLUMN IF NOT EXISTS
  os_version TEXT; -- OS version

ALTER TABLE public.visitor_sessions ADD COLUMN IF NOT EXISTS
  country TEXT; -- Country code (if available)

ALTER TABLE public.visitor_sessions ADD COLUMN IF NOT EXISTS
  region TEXT; -- Region/State (if available)

ALTER TABLE public.visitor_sessions ADD COLUMN IF NOT EXISTS
  city TEXT; -- City (if available)

ALTER TABLE public.visitor_sessions ADD COLUMN IF NOT EXISTS
  referrer TEXT; -- HTTP referrer

ALTER TABLE public.visitor_sessions ADD COLUMN IF NOT EXISTS
  landing_page TEXT; -- First page visited

ALTER TABLE public.visitor_sessions ADD COLUMN IF NOT EXISTS
  current_page TEXT; -- Last known page

ALTER TABLE public.visitor_sessions ADD COLUMN IF NOT EXISTS
  pages_visited INTEGER DEFAULT 0; -- Total pages visited in session

ALTER TABLE public.visitor_sessions ADD COLUMN IF NOT EXISTS
  session_duration_seconds INTEGER DEFAULT 0; -- Total session duration

ALTER TABLE public.visitor_sessions ADD COLUMN IF NOT EXISTS
  last_activity TIMESTAMP WITH TIME ZONE; -- Last activity timestamp

ALTER TABLE public.visitor_sessions ADD COLUMN IF NOT EXISTS
  bounce_rate DECIMAL(5,2) DEFAULT 0; -- Bounce rate percentage

ALTER TABLE public.visitor_sessions ADD COLUMN IF NOT EXISTS
  engagement_score INTEGER DEFAULT 0; -- 0-100 engagement score

ALTER TABLE public.visitor_sessions ADD COLUMN IF NOT EXISTS
  is_returning BOOLEAN DEFAULT false; -- Is returning visitor

ALTER TABLE public.visitor_sessions ADD COLUMN IF NOT EXISTS
  previous_visit_count INTEGER DEFAULT 0; -- Number of previous visits

ALTER TABLE public.visitor_sessions ADD COLUMN IF NOT EXISTS
  time_on_site_seconds INTEGER DEFAULT 0; -- Time spent on site

ALTER TABLE public.visitor_sessions ADD COLUMN IF NOT EXISTS
  scroll_depth_percent INTEGER DEFAULT 0; -- How far down page scrolled

ALTER TABLE public.visitor_sessions ADD COLUMN IF NOT EXISTS
  clicks_count INTEGER DEFAULT 0; -- Number of clicks

ALTER TABLE public.visitor_sessions ADD COLUMN IF NOT EXISTS
  form_interactions INTEGER DEFAULT 0; -- Form interactions

ALTER TABLE public.visitor_sessions ADD COLUMN IF NOT EXISTS
  video_plays INTEGER DEFAULT 0; -- Video plays

ALTER TABLE public.visitor_sessions ADD COLUMN IF NOT EXISTS
  downloads_count INTEGER DEFAULT 0; -- File downloads

ALTER TABLE public.visitor_sessions ADD COLUMN IF NOT EXISTS
  search_queries TEXT[]; -- Search queries performed

ALTER TABLE public.visitor_sessions ADD COLUMN IF NOT EXISTS
  conversion_events TEXT[]; -- Conversion events triggered

ALTER TABLE public.visitor_sessions ADD COLUMN IF NOT EXISTS
  custom_properties JSONB; -- Custom tracking properties

ALTER TABLE public.visitor_sessions ADD COLUMN IF NOT EXISTS
  utm_source TEXT; -- UTM source

ALTER TABLE public.visitor_sessions ADD COLUMN IF NOT EXISTS
  utm_medium TEXT; -- UTM medium

ALTER TABLE public.visitor_sessions ADD COLUMN IF NOT EXISTS
  utm_campaign TEXT; -- UTM campaign

ALTER TABLE public.visitor_sessions ADD COLUMN IF NOT EXISTS
  utm_content TEXT; -- UTM content

ALTER TABLE public.visitor_sessions ADD COLUMN IF NOT EXISTS
  utm_term TEXT; -- UTM term

ALTER TABLE public.visitor_sessions ADD COLUMN IF NOT EXISTS
  language TEXT; -- Browser language

ALTER TABLE public.visitor_sessions ADD COLUMN IF NOT EXISTS
  timezone TEXT; -- Browser timezone

ALTER TABLE public.visitor_sessions ADD COLUMN IF NOT EXISTS
  screen_resolution TEXT; -- Screen resolution (e.g., '1920x1080')

ALTER TABLE public.visitor_sessions ADD COLUMN IF NOT EXISTS
  viewport_size TEXT; -- Viewport size

ALTER TABLE public.visitor_sessions ADD COLUMN IF NOT EXISTS
  connection_type TEXT; -- Connection type (4g, wifi, etc.)

ALTER TABLE public.visitor_sessions ADD COLUMN IF NOT EXISTS
  connection_speed_mbps DECIMAL(10,2); -- Connection speed

ALTER TABLE public.visitor_sessions ADD COLUMN IF NOT EXISTS
  page_load_time_ms INTEGER; -- Page load time in milliseconds

ALTER TABLE public.visitor_sessions ADD COLUMN IF NOT EXISTS
  first_contentful_paint_ms INTEGER; -- FCP metric

ALTER TABLE public.visitor_sessions ADD COLUMN IF NOT EXISTS
  largest_contentful_paint_ms INTEGER; -- LCP metric

ALTER TABLE public.visitor_sessions ADD COLUMN IF NOT EXISTS
  cumulative_layout_shift DECIMAL(5,3); -- CLS metric

ALTER TABLE public.visitor_sessions ADD COLUMN IF NOT EXISTS
  time_to_interactive_ms INTEGER; -- TTI metric

ALTER TABLE public.visitor_sessions ADD COLUMN IF NOT EXISTS
  error_count INTEGER DEFAULT 0; -- JavaScript errors

ALTER TABLE public.visitor_sessions ADD COLUMN IF NOT EXISTS
  error_messages TEXT[]; -- Error messages

ALTER TABLE public.visitor_sessions ADD COLUMN IF NOT EXISTS
  console_logs TEXT[]; -- Console log messages

ALTER TABLE public.visitor_sessions ADD COLUMN IF NOT EXISTS
  session_notes TEXT; -- Admin notes

-- ============================================================================
-- visitor_page_views table - Track individual page views
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.visitor_page_views (
  id BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
  session_id UUID NOT NULL REFERENCES public.visitor_sessions(session_id) ON DELETE CASCADE,
  page_url TEXT NOT NULL,
  page_title TEXT,
  referrer TEXT,
  view_timestamp TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  time_on_page_seconds INTEGER,
  scroll_depth_percent INTEGER,
  clicks_on_page INTEGER,
  form_interactions INTEGER,
  video_plays INTEGER,
  downloads INTEGER,
  exit_page BOOLEAN DEFAULT false,
  bounce BOOLEAN DEFAULT false,
  CONSTRAINT visitor_page_views_pkey PRIMARY KEY (id)
);

CREATE INDEX IF NOT EXISTS idx_visitor_page_views_session_id 
  ON public.visitor_page_views USING BTREE (session_id);

CREATE INDEX IF NOT EXISTS idx_visitor_page_views_timestamp 
  ON public.visitor_page_views USING BTREE (view_timestamp);

CREATE INDEX IF NOT EXISTS idx_visitor_page_views_page_url 
  ON public.visitor_page_views USING BTREE (page_url);

-- ============================================================================
-- visitor_events table - Track custom events
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.visitor_events (
  id BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
  session_id UUID NOT NULL REFERENCES public.visitor_sessions(session_id) ON DELETE CASCADE,
  event_type TEXT NOT NULL, -- 'click', 'form_submit', 'video_play', 'download', etc.
  event_name TEXT,
  event_value TEXT,
  event_category TEXT,
  event_label TEXT,
  event_timestamp TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  page_url TEXT,
  custom_data JSONB,
  CONSTRAINT visitor_events_pkey PRIMARY KEY (id)
);

CREATE INDEX IF NOT EXISTS idx_visitor_events_session_id 
  ON public.visitor_events USING BTREE (session_id);

CREATE INDEX IF NOT EXISTS idx_visitor_events_event_type 
  ON public.visitor_events USING BTREE (event_type);

CREATE INDEX IF NOT EXISTS idx_visitor_events_timestamp 
  ON public.visitor_events USING BTREE (event_timestamp);

-- ============================================================================
-- visitor_conversions table - Track conversion events
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.visitor_conversions (
  id BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
  session_id UUID NOT NULL REFERENCES public.visitor_sessions(session_id) ON DELETE CASCADE,
  conversion_type TEXT NOT NULL, -- 'signup', 'purchase', 'download', etc.
  conversion_value DECIMAL(10,2),
  conversion_currency TEXT DEFAULT 'USD',
  conversion_timestamp TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  page_url TEXT,
  conversion_details JSONB,
  CONSTRAINT visitor_conversions_pkey PRIMARY KEY (id)
);

CREATE INDEX IF NOT EXISTS idx_visitor_conversions_session_id 
  ON public.visitor_conversions USING BTREE (session_id);

CREATE INDEX IF NOT EXISTS idx_visitor_conversions_type 
  ON public.visitor_conversions USING BTREE (conversion_type);

CREATE INDEX IF NOT EXISTS idx_visitor_conversions_timestamp 
  ON public.visitor_conversions USING BTREE (conversion_timestamp);

-- ============================================================================
-- visitor_errors table - Track JavaScript errors
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.visitor_errors (
  id BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
  session_id UUID NOT NULL REFERENCES public.visitor_sessions(session_id) ON DELETE CASCADE,
  error_type TEXT, -- 'error', 'warning', 'info'
  error_message TEXT,
  error_stack TEXT,
  page_url TEXT,
  error_timestamp TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  user_agent TEXT,
  CONSTRAINT visitor_errors_pkey PRIMARY KEY (id)
);

CREATE INDEX IF NOT EXISTS idx_visitor_errors_session_id 
  ON public.visitor_errors USING BTREE (session_id);

CREATE INDEX IF NOT EXISTS idx_visitor_errors_timestamp 
  ON public.visitor_errors USING BTREE (error_timestamp);

-- ============================================================================
-- visitor_performance table - Track performance metrics
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.visitor_performance (
  id BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
  session_id UUID NOT NULL REFERENCES public.visitor_sessions(session_id) ON DELETE CASCADE,
  page_url TEXT,
  page_load_time_ms INTEGER,
  first_contentful_paint_ms INTEGER,
  largest_contentful_paint_ms INTEGER,
  cumulative_layout_shift DECIMAL(5,3),
  time_to_interactive_ms INTEGER,
  first_input_delay_ms INTEGER,
  total_blocking_time_ms INTEGER,
  dom_content_loaded_ms INTEGER,
  window_load_ms INTEGER,
  resource_timing JSONB,
  measured_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  CONSTRAINT visitor_performance_pkey PRIMARY KEY (id)
);

CREATE INDEX IF NOT EXISTS idx_visitor_performance_session_id 
  ON public.visitor_performance USING BTREE (session_id);

CREATE INDEX IF NOT EXISTS idx_visitor_performance_measured_at 
  ON public.visitor_performance USING BTREE (measured_at);

-- ============================================================================
-- Enhanced Indexes for Performance
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_visitor_sessions_device_type 
  ON public.visitor_sessions USING BTREE (device_type);

CREATE INDEX IF NOT EXISTS idx_visitor_sessions_browser_name 
  ON public.visitor_sessions USING BTREE (browser_name);

CREATE INDEX IF NOT EXISTS idx_visitor_sessions_os_name 
  ON public.visitor_sessions USING BTREE (os_name);

CREATE INDEX IF NOT EXISTS idx_visitor_sessions_country 
  ON public.visitor_sessions USING BTREE (country);

CREATE INDEX IF NOT EXISTS idx_visitor_sessions_is_returning 
  ON public.visitor_sessions USING BTREE (is_returning);

CREATE INDEX IF NOT EXISTS idx_visitor_sessions_engagement_score 
  ON public.visitor_sessions USING BTREE (engagement_score);

CREATE INDEX IF NOT EXISTS idx_visitor_sessions_utm_source 
  ON public.visitor_sessions USING BTREE (utm_source);

-- ============================================================================
-- Enhanced Analytics Views
-- ============================================================================

-- Detailed visitor summary
CREATE OR REPLACE VIEW public.visitor_detailed_summary AS
SELECT
  session_id,
  created_at,
  last_heartbeat,
  is_active,
  is_bot,
  device_type,
  browser_name,
  os_name,
  country,
  pages_visited,
  session_duration_seconds,
  engagement_score,
  is_returning,
  utm_source,
  utm_campaign,
  page_load_time_ms,
  error_count
FROM public.visitor_sessions
ORDER BY created_at DESC;

-- Device breakdown
CREATE OR REPLACE VIEW public.visitor_device_breakdown AS
SELECT
  device_type,
  COUNT(*) as total_visitors,
  COUNT(*) FILTER (WHERE is_bot) as bot_count,
  COUNT(*) FILTER (WHERE NOT is_bot) as human_count,
  AVG(engagement_score) as avg_engagement,
  AVG(session_duration_seconds) as avg_session_duration
FROM public.visitor_sessions
WHERE created_at > NOW() - INTERVAL '24 hours'
GROUP BY device_type;

-- Browser breakdown
CREATE OR REPLACE VIEW public.visitor_browser_breakdown AS
SELECT
  browser_name,
  COUNT(*) as total_visitors,
  AVG(engagement_score) as avg_engagement,
  AVG(page_load_time_ms) as avg_load_time,
  COUNT(*) FILTER (WHERE error_count > 0) as sessions_with_errors
FROM public.visitor_sessions
WHERE created_at > NOW() - INTERVAL '24 hours'
GROUP BY browser_name;

-- Geographic breakdown
CREATE OR REPLACE VIEW public.visitor_geographic_breakdown AS
SELECT
  country,
  region,
  city,
  COUNT(*) as total_visitors,
  COUNT(*) FILTER (WHERE is_returning) as returning_visitors,
  AVG(engagement_score) as avg_engagement,
  AVG(session_duration_seconds) as avg_session_duration
FROM public.visitor_sessions
WHERE created_at > NOW() - INTERVAL '24 hours'
  AND country IS NOT NULL
GROUP BY country, region, city;

-- UTM source breakdown
CREATE OR REPLACE VIEW public.visitor_utm_breakdown AS
SELECT
  utm_source,
  utm_medium,
  utm_campaign,
  COUNT(*) as total_visitors,
  COUNT(*) FILTER (WHERE is_returning) as returning_visitors,
  AVG(engagement_score) as avg_engagement,
  COUNT(DISTINCT session_id) as unique_sessions
FROM public.visitor_sessions
WHERE created_at > NOW() - INTERVAL '24 hours'
  AND utm_source IS NOT NULL
GROUP BY utm_source, utm_medium, utm_campaign;

-- Performance metrics summary
CREATE OR REPLACE VIEW public.visitor_performance_summary AS
SELECT
  AVG(page_load_time_ms) as avg_page_load_ms,
  AVG(first_contentful_paint_ms) as avg_fcp_ms,
  AVG(largest_contentful_paint_ms) as avg_lcp_ms,
  AVG(cumulative_layout_shift) as avg_cls,
  AVG(time_to_interactive_ms) as avg_tti_ms,
  PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY page_load_time_ms) as p95_load_time,
  PERCENTILE_CONT(0.99) WITHIN GROUP (ORDER BY page_load_time_ms) as p99_load_time
FROM public.visitor_sessions
WHERE created_at > NOW() - INTERVAL '24 hours'
  AND page_load_time_ms IS NOT NULL;

-- ============================================================================
-- RLS Policies for new tables
-- ============================================================================

ALTER TABLE public.visitor_page_views ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.visitor_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.visitor_conversions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.visitor_errors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.visitor_performance ENABLE ROW LEVEL SECURITY;

-- Service role bypass
CREATE POLICY "Service role bypass" ON public.visitor_page_views
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "Service role bypass" ON public.visitor_events
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "Service role bypass" ON public.visitor_conversions
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "Service role bypass" ON public.visitor_errors
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "Service role bypass" ON public.visitor_performance
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- Anyone can insert
CREATE POLICY "Anyone can insert" ON public.visitor_page_views
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Anyone can insert" ON public.visitor_events
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Anyone can insert" ON public.visitor_conversions
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Anyone can insert" ON public.visitor_errors
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Anyone can insert" ON public.visitor_performance
  FOR INSERT WITH CHECK (true);

-- Admins can view
CREATE POLICY "Admins can view" ON public.visitor_page_views
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.admin_users
      WHERE admin_users.auth_user_id = auth.uid()
    )
  );

CREATE POLICY "Admins can view" ON public.visitor_events
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.admin_users
      WHERE admin_users.auth_user_id = auth.uid()
    )
  );

CREATE POLICY "Admins can view" ON public.visitor_conversions
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.admin_users
      WHERE admin_users.auth_user_id = auth.uid()
    )
  );

CREATE POLICY "Admins can view" ON public.visitor_errors
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.admin_users
      WHERE admin_users.auth_user_id = auth.uid()
    )
  );

CREATE POLICY "Admins can view" ON public.visitor_performance
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.admin_users
      WHERE admin_users.auth_user_id = auth.uid()
    )
  );

-- ============================================================================
-- Grants for Service Role
-- ============================================================================

GRANT SELECT, INSERT, UPDATE ON public.visitor_page_views TO service_role;
GRANT SELECT, INSERT, UPDATE ON public.visitor_events TO service_role;
GRANT SELECT, INSERT, UPDATE ON public.visitor_conversions TO service_role;
GRANT SELECT, INSERT, UPDATE ON public.visitor_errors TO service_role;
GRANT SELECT, INSERT, UPDATE ON public.visitor_performance TO service_role;
