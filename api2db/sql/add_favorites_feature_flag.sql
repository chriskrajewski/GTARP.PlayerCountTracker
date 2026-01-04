-- Add Favorites feature flag
-- This flag controls the visibility and access to the Favorites feature
-- allowing users to save and manage their favorite clips

INSERT INTO public.feature_flags (key, name, description, is_enabled, category)
VALUES
  ('favorites', 'Favorites', 'Enable the Favorites feature allowing users to save and manage their favorite clips', true, 'site')
ON CONFLICT (key) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  is_enabled = EXCLUDED.is_enabled,
  category = EXCLUDED.category;
