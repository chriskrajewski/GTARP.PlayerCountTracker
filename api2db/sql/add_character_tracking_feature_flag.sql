-- Add Streamer Character Tracking feature flag
-- Registers the single flag that gates the Streamer Character Tracking feature,
-- which derives the in-character personas a streamer plays from their historical
-- stream titles and surfaces them (and their associated clips) on the
-- Streamer_Profile.
-- The flag ships disabled by default because this is a gated, fail-closed
-- rollout (R1.1, R1.4): if the flag is missing or cannot be retrieved the
-- feature stays off for App_User-facing surfaces.

INSERT INTO public.feature_flags (key, name, description, is_enabled, category)
VALUES
  ('character_tracking', 'Streamer Character Tracking', 'Derives the characters a streamer plays from their stream titles and surfaces them on the streamer profile, letting viewers browse the clips captured while the streamer was playing each character', false, 'site')
-- On conflict, refresh the display metadata but intentionally DO NOT overwrite
-- is_enabled. Re-running this seed must never silently disable a flag an admin
-- has already turned on (or re-enable one they turned off).
ON CONFLICT (key) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  category = EXCLUDED.category;
