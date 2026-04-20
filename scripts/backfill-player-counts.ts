/**
 * Backfill Missing Player Count Data
 * 
 * This script fills a gap in player_counts data by using historical patterns
 * from the same day-of-week in previous weeks. It averages data from the
 * past 4 weeks (same weekday, same time-of-day) to produce realistic estimates.
 * 
 * Usage:
 *   npx tsx scripts/backfill-player-counts.ts [--dry-run] [--gap-hours 16]
 * 
 * Environment variables required:
 *   SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 * 
 * The script will:
 *   1. Auto-detect the data gap by finding the last record before the gap
 *   2. Query historical data from the same weekday/time across past weeks
 *   3. Average those values to produce estimated counts
 *   4. Insert records at the same interval the ETL normally uses (~5 min)
 *   5. Print a summary of what was inserted
 */

import { createClient } from '@supabase/supabase-js';

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const DRY_RUN = process.argv.includes('--dry-run');
const GAP_HOURS_FLAG = process.argv.indexOf('--gap-hours');
const GAP_HOURS = GAP_HOURS_FLAG !== -1 ? Number(process.argv[GAP_HOURS_FLAG + 1]) : 24;
const HISTORICAL_WEEKS = 4;       // How many past weeks to average
const INSERT_INTERVAL_MIN = 5;    // Minutes between synthetic data points
const BATCH_SIZE = 500;           // Rows per insert batch

// ---------------------------------------------------------------------------
// Supabase client
// ---------------------------------------------------------------------------

const supabaseUrl = "";
const supabaseKey = "";

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables.');
  console.error('Run with: SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... npx tsx scripts/backfill-player-counts.ts');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface PlayerCountRow {
  timestamp: string;
  player_count: number;
  server_id: string;
}

interface BackfillRecord {
  timestamp: string;
  player_count: number;
  server_id: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function roundToInterval(date: Date, intervalMin: number): Date {
  const ms = intervalMin * 60 * 1000;
  return new Date(Math.round(date.getTime() / ms) * ms);
}

function formatTimestamp(date: Date): string {
  return date.toISOString();
}

/** Build a map of "HH:MM" -> player_count[] from historical rows */
function buildTimeOfDayMap(rows: PlayerCountRow[]): Map<string, number[]> {
  const map = new Map<string, number[]>();
  for (const row of rows) {
    const d = new Date(row.timestamp);
    // Round to nearest INSERT_INTERVAL_MIN
    const rounded = roundToInterval(d, INSERT_INTERVAL_MIN);
    const key = `${String(rounded.getUTCHours()).padStart(2, '0')}:${String(rounded.getUTCMinutes()).padStart(2, '0')}`;
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(row.player_count);
  }
  return map;
}

function average(nums: number[]): number {
  if (nums.length === 0) return 0;
  return Math.round(nums.reduce((a, b) => a + b, 0) / nums.length);
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  console.log('=== Player Count Backfill Script ===');
  console.log(`Mode: ${DRY_RUN ? 'DRY RUN (no writes)' : 'LIVE'}`);
  console.log(`Gap duration: ${GAP_HOURS} hours`);
  console.log(`Historical weeks to average: ${HISTORICAL_WEEKS}`);
  console.log(`Insert interval: ${INSERT_INTERVAL_MIN} minutes`);
  console.log('');

  // 1. Get all tracked servers
  const { data: servers, error: serverError } = await supabase
    .from('server_xref')
    .select('server_id, server_name')
    .order('order', { ascending: true });

  if (serverError || !servers?.length) {
    console.error('Failed to fetch servers:', serverError?.message ?? 'No servers found');
    process.exit(1);
  }

  console.log(`Found ${servers.length} tracked servers:`);
  for (const s of servers) {
    console.log(`  - ${s.server_id} (${s.server_name})`);
  }
  console.log('');

  // 2. Detect the gap for each server
  const now = new Date();
  const gapEnd = now; // gap ends now (edge function is back up)
  const gapStart = new Date(now.getTime() - GAP_HOURS * 60 * 60 * 1000);

  console.log(`Expected gap window: ${gapStart.toISOString()} → ${gapEnd.toISOString()}`);
  console.log('');

  // Verify the gap actually exists by checking for data in the window
  const allBackfillRecords: BackfillRecord[] = [];

  for (const server of servers) {
    const serverId = server.server_id;
    console.log(`--- Processing server: ${serverId} (${server.server_name}) ---`);

    // Check how many records exist in the gap window
    const { count: existingCount, error: countError } = await supabase
      .from('player_counts')
      .select('*', { count: 'exact', head: true })
      .eq('server_id', serverId)
      .gte('timestamp', gapStart.toISOString())
      .lte('timestamp', gapEnd.toISOString());

    if (countError) {
      console.error(`  Error checking existing data: ${countError.message}`);
      continue;
    }

    const expectedRecords = Math.floor(GAP_HOURS * 60 / INSERT_INTERVAL_MIN);
    console.log(`  Existing records in gap window: ${existingCount ?? 0} (expected ~${expectedRecords})`);

    if ((existingCount ?? 0) > expectedRecords * 0.5) {
      console.log(`  Sufficient data exists, skipping backfill for this server.`);
      continue;
    }

    // Find the last record before the gap to anchor our start
    const { data: lastBefore, error: lastBeforeError } = await supabase
      .from('player_counts')
      .select('timestamp, player_count')
      .eq('server_id', serverId)
      .lt('timestamp', gapStart.toISOString())
      .order('timestamp', { ascending: false })
      .limit(1);

    if (lastBeforeError) {
      console.error(`  Error finding last record before gap: ${lastBeforeError.message}`);
      continue;
    }

    // Find the first record after the gap
    const { data: firstAfter, error: firstAfterError } = await supabase
      .from('player_counts')
      .select('timestamp, player_count')
      .eq('server_id', serverId)
      .gt('timestamp', gapEnd.toISOString())
      .order('timestamp', { ascending: true })
      .limit(1);

    const actualGapStart = lastBefore?.[0]
      ? new Date(new Date(lastBefore[0].timestamp).getTime() + INSERT_INTERVAL_MIN * 60 * 1000)
      : gapStart;
    const actualGapEnd = firstAfter?.[0]
      ? new Date(firstAfter[0].timestamp)
      : gapEnd;

    console.log(`  Actual gap: ${actualGapStart.toISOString()} → ${actualGapEnd.toISOString()}`);

    const anchorBefore = lastBefore?.[0]?.player_count ?? null;
    const anchorAfter = firstAfter?.[0]?.player_count ?? null;
    console.log(`  Anchor before gap: ${anchorBefore ?? 'N/A'} players`);
    console.log(`  Anchor after gap: ${anchorAfter ?? 'N/A'} players`);

    // 3. Fetch historical data from same weekday across past weeks
    const dayOfWeek = actualGapStart.getUTCDay();
    const historicalRows: PlayerCountRow[] = [];

    for (let w = 1; w <= HISTORICAL_WEEKS; w++) {
      const weekOffset = w * 7 * 24 * 60 * 60 * 1000;
      const histStart = new Date(actualGapStart.getTime() - weekOffset);
      const histEnd = new Date(actualGapEnd.getTime() - weekOffset);

      // Widen the window slightly to capture the full day-of-week match
      histStart.setUTCHours(actualGapStart.getUTCHours(), 0, 0, 0);
      histEnd.setUTCHours(actualGapEnd.getUTCHours(), 59, 59, 999);

      const { data: histData, error: histError } = await supabase
        .from('player_counts')
        .select('timestamp, player_count, server_id')
        .eq('server_id', serverId)
        .gte('timestamp', histStart.toISOString())
        .lte('timestamp', histEnd.toISOString())
        .order('timestamp', { ascending: true });

      if (histError) {
        console.warn(`  Warning: Failed to fetch week -${w} data: ${histError.message}`);
        continue;
      }

      if (histData && histData.length > 0) {
        historicalRows.push(...histData);
        console.log(`  Week -${w}: Found ${histData.length} records`);
      } else {
        console.log(`  Week -${w}: No data found`);
      }
    }

    if (historicalRows.length === 0) {
      console.warn(`  No historical data found for any week. Cannot backfill this server.`);
      continue;
    }

    // 4. Build time-of-day averages
    const timeMap = buildTimeOfDayMap(historicalRows);
    console.log(`  Built time-of-day map with ${timeMap.size} time slots`);

    // 5. Generate synthetic records
    const serverRecords: BackfillRecord[] = [];
    let cursor = roundToInterval(actualGapStart, INSERT_INTERVAL_MIN);

    // Get existing timestamps in the gap to avoid duplicates
    const { data: existingInGap } = await supabase
      .from('player_counts')
      .select('timestamp')
      .eq('server_id', serverId)
      .gte('timestamp', actualGapStart.toISOString())
      .lte('timestamp', actualGapEnd.toISOString());

    const existingTimestamps = new Set(
      (existingInGap ?? []).map(r => new Date(r.timestamp).getTime())
    );

    while (cursor < actualGapEnd) {
      // Skip if a record already exists at this timestamp
      if (existingTimestamps.has(cursor.getTime())) {
        cursor = new Date(cursor.getTime() + INSERT_INTERVAL_MIN * 60 * 1000);
        continue;
      }

      const timeKey = `${String(cursor.getUTCHours()).padStart(2, '0')}:${String(cursor.getUTCMinutes()).padStart(2, '0')}`;
      const historicalValues = timeMap.get(timeKey);

      let estimatedCount: number;
      if (historicalValues && historicalValues.length > 0) {
        estimatedCount = average(historicalValues);
      } else {
        // Fallback: interpolate from nearest available time slots
        const allKeys = Array.from(timeMap.keys()).sort();
        const cursorMinutes = cursor.getUTCHours() * 60 + cursor.getUTCMinutes();
        let closestKey = allKeys[0];
        let closestDiff = Infinity;
        for (const k of allKeys) {
          const [h, m] = k.split(':').map(Number);
          const diff = Math.abs(h * 60 + m - cursorMinutes);
          if (diff < closestDiff) {
            closestDiff = diff;
            closestKey = k;
          }
        }
        estimatedCount = average(timeMap.get(closestKey) ?? [0]);
      }

      // Smooth toward anchor points at the edges of the gap
      const totalGapMs = actualGapEnd.getTime() - actualGapStart.getTime();
      const positionMs = cursor.getTime() - actualGapStart.getTime();
      const progress = totalGapMs > 0 ? positionMs / totalGapMs : 0.5;

      if (anchorBefore !== null && progress < 0.15) {
        // Blend toward the "before" anchor at the start of the gap
        const blendFactor = progress / 0.15; // 0 at start, 1 at 15%
        estimatedCount = Math.round(
          anchorBefore * (1 - blendFactor) + estimatedCount * blendFactor
        );
      }
      if (anchorAfter !== null && progress > 0.85) {
        // Blend toward the "after" anchor at the end of the gap
        const blendFactor = (progress - 0.85) / 0.15; // 0 at 85%, 1 at end
        estimatedCount = Math.round(
          estimatedCount * (1 - blendFactor) + anchorAfter * blendFactor
        );
      }

      // Ensure non-negative
      estimatedCount = Math.max(0, estimatedCount);

      serverRecords.push({
        timestamp: formatTimestamp(cursor),
        player_count: estimatedCount,
        server_id: serverId,
      });

      cursor = new Date(cursor.getTime() + INSERT_INTERVAL_MIN * 60 * 1000);
    }

    console.log(`  Generated ${serverRecords.length} synthetic records`);

    if (serverRecords.length > 0) {
      // Show a sample
      const sample = serverRecords.slice(0, 3);
      for (const r of sample) {
        console.log(`    ${r.timestamp} → ${r.player_count} players`);
      }
      if (serverRecords.length > 3) {
        console.log(`    ... and ${serverRecords.length - 3} more`);
      }
    }

    allBackfillRecords.push(...serverRecords);
    console.log('');
  }

  // 6. Insert all records
  console.log('=== Summary ===');
  console.log(`Total records to insert: ${allBackfillRecords.length}`);

  if (allBackfillRecords.length === 0) {
    console.log('Nothing to backfill.');
    return;
  }

  if (DRY_RUN) {
    console.log('DRY RUN — no records were inserted.');
    console.log('Run without --dry-run to actually insert the data.');

    // Print per-server breakdown
    const perServer = new Map<string, number>();
    for (const r of allBackfillRecords) {
      perServer.set(r.server_id, (perServer.get(r.server_id) ?? 0) + 1);
    }
    for (const [sid, count] of perServer) {
      console.log(`  ${sid}: ${count} records`);
    }
    return;
  }

  // Insert in batches
  let inserted = 0;
  for (let i = 0; i < allBackfillRecords.length; i += BATCH_SIZE) {
    const batch = allBackfillRecords.slice(i, i + BATCH_SIZE);
    const { error: insertError } = await supabase
      .from('player_counts')
      .insert(batch);

    if (insertError) {
      console.error(`Error inserting batch at offset ${i}: ${insertError.message}`);
      console.error('Stopping to avoid partial data. Records inserted so far:', inserted);
      process.exit(1);
    }

    inserted += batch.length;
    console.log(`  Inserted ${inserted}/${allBackfillRecords.length} records...`);
  }

  console.log(`\nDone! Successfully inserted ${inserted} backfill records.`);
}

main().catch((err) => {
  console.error('Unhandled error:', err);
  process.exit(1);
});
