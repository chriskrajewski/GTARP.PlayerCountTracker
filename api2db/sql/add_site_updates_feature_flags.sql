-- Add Site Updates and Roadmap feature flags
-- These flags control the visibility of the new Site Updates feature

INSERT INTO public.feature_flags (key, name, description, is_enabled, category)
VALUES
  ('site_updates', 'Site Updates', 'Enable the new Site Updates feature with Recent Changes, Roadmap, and Git Commits tabs', true, 'site'),
  ('roadmap', 'Roadmap', 'Enable the Roadmap tab in Site Updates with voting support', true, 'site')
ON CONFLICT (key) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  is_enabled = EXCLUDED.is_enabled,
  category = EXCLUDED.category;
