-- Add Git Commits feature flag
-- This flag controls the visibility of the Git Commits tab in Site Updates

INSERT INTO public.feature_flags (key, name, description, is_enabled, category)
VALUES
  ('git_commits', 'Git Commits', 'Enable the Git Commits tab in Site Updates to display recent repository commits', true, 'site')
ON CONFLICT (key) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  is_enabled = EXCLUDED.is_enabled,
  category = EXCLUDED.category;
