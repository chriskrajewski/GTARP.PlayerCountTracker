-- Function to migrate a server_id across all tables while preserving historical data
-- Processes large tables in batches to avoid statement timeouts
-- Usage: SELECT migrate_server_id('old_server_id', 'new_server_id');

DROP FUNCTION IF EXISTS migrate_server_id(TEXT, TEXT);

CREATE OR REPLACE FUNCTION migrate_server_id(old_id TEXT, new_id TEXT)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET statement_timeout = '300s'
AS $$
DECLARE
  result JSON;
  xref_count INT;
  player_count INT := 0;
  capacity_count INT := 0;
  snapshots_count INT;
  changes_count INT;
  predictions_count INT;
  data_start_count INT;
  colors_count INT;
  stream_config_count INT;
  batch_size INT := 50000;
  rows_affected INT;
BEGIN
  -- Validate inputs
  IF old_id IS NULL OR old_id = '' THEN
    RAISE EXCEPTION 'old_id cannot be null or empty';
  END IF;
  IF new_id IS NULL OR new_id = '' THEN
    RAISE EXCEPTION 'new_id cannot be null or empty';
  END IF;
  IF old_id = new_id THEN
    RAISE EXCEPTION 'old_id and new_id cannot be the same';
  END IF;

  -- Check that old server exists
  SELECT COUNT(*) INTO xref_count FROM server_xref WHERE server_id = old_id;
  IF xref_count = 0 THEN
    RAISE EXCEPTION 'Server with id "%" not found in server_xref', old_id;
  END IF;

  -- Check that new_id doesn't already exist
  SELECT COUNT(*) INTO xref_count FROM server_xref WHERE server_id = new_id;
  IF xref_count > 0 THEN
    RAISE EXCEPTION 'Server with id "%" already exists in server_xref', new_id;
  END IF;

  -- Migrate server_xref
  UPDATE server_xref SET server_id = new_id WHERE server_id = old_id;
  GET DIAGNOSTICS xref_count = ROW_COUNT;

  -- Migrate player_counts in batches
  LOOP
    UPDATE player_counts SET server_id = new_id
    WHERE ctid IN (
      SELECT ctid FROM player_counts WHERE server_id = old_id LIMIT batch_size
    );
    GET DIAGNOSTICS rows_affected = ROW_COUNT;
    player_count := player_count + rows_affected;
    EXIT WHEN rows_affected = 0;
  END LOOP;

  -- Migrate server_capacity in batches
  LOOP
    UPDATE server_capacity SET server_id = new_id
    WHERE ctid IN (
      SELECT ctid FROM server_capacity WHERE server_id = old_id LIMIT batch_size
    );
    GET DIAGNOSTICS rows_affected = ROW_COUNT;
    capacity_count := capacity_count + rows_affected;
    EXIT WHEN rows_affected = 0;
  END LOOP;

  -- Migrate smaller tables directly
  UPDATE server_resource_snapshots SET server_id = new_id WHERE server_id = old_id;
  GET DIAGNOSTICS snapshots_count = ROW_COUNT;

  UPDATE server_resource_changes SET server_id = new_id WHERE server_id = old_id;
  GET DIAGNOSTICS changes_count = ROW_COUNT;

  UPDATE server_restart_predictions SET server_id = new_id WHERE server_id = old_id;
  GET DIAGNOSTICS predictions_count = ROW_COUNT;

  UPDATE data_start SET server_id = new_id WHERE server_id = old_id;
  GET DIAGNOSTICS data_start_count = ROW_COUNT;

  UPDATE server_colors SET server_id = new_id WHERE server_id = old_id;
  GET DIAGNOSTICS colors_count = ROW_COUNT;

  UPDATE stream_search_config SET server_id = new_id WHERE server_id = old_id;
  GET DIAGNOSTICS stream_config_count = ROW_COUNT;

  -- Return summary
  result := json_build_object(
    'success', true,
    'old_id', old_id,
    'new_id', new_id,
    'migrated', json_build_object(
      'server_xref', xref_count,
      'player_counts', player_count,
      'server_capacity', capacity_count,
      'server_resource_snapshots', snapshots_count,
      'server_resource_changes', changes_count,
      'server_restart_predictions', predictions_count,
      'data_start', data_start_count,
      'server_colors', colors_count,
      'stream_search_config', stream_config_count
    )
  );

  RETURN result;
END;
$$;
