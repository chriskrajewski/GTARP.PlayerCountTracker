-- ============================================================================
-- System Settings Table
-- ============================================================================
-- Centralized storage for operational settings that need runtime updates
-- without redeploying the Next.js app (e.g., Twitch pagination limits).
-- Source: Admin dashboard settings feature.

-- Ensure pgcrypto is available for gen_random_uuid (already enabled on Supabase,
-- but kept here for completeness when running locally).
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS public.system_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT UNIQUE NOT NULL,
  value TEXT NOT NULL,
  data_type TEXT NOT NULL DEFAULT 'string',
  description TEXT,
  category TEXT,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_by TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  CONSTRAINT system_settings_data_type_check
    CHECK (data_type IN ('string', 'number', 'boolean', 'json'))
);

CREATE INDEX IF NOT EXISTS idx_system_settings_category
  ON public.system_settings USING BTREE (category);

-- ============================================================================
-- Row Level Security
-- ============================================================================
ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;

-- Allow the Supabase service role (used by server-side API routes) to manage settings.
CREATE POLICY "Service role can manage system_settings"
  ON public.system_settings
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- Allow authenticated admin users (mapped in public.admin_users) to read settings.
CREATE POLICY "Admins can read system_settings"
  ON public.system_settings
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.admin_users
      WHERE admin_users.auth_user_id = auth.uid()
    )
  );

GRANT SELECT, INSERT, UPDATE, DELETE ON public.system_settings TO service_role;

-- ============================================================================
-- Seed Default Settings
-- ============================================================================
INSERT INTO public.system_settings (key, value, data_type, description, category, updated_by)
VALUES (
  'twitch_stream_page_limit',
  '35',
  'number',
  'Maximum number of Twitch pagination pages to fetch per game (100 streams per page).',
  'streams',
  'migration'
)
ON CONFLICT (key) DO UPDATE SET
  value = EXCLUDED.value,
  data_type = EXCLUDED.data_type,
  description = EXCLUDED.description,
  category = EXCLUDED.category;
