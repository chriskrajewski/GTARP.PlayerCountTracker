import { NextRequest, NextResponse } from 'next/server';
import { getServers, getPlayerCounts, type PlayerCountData } from '@/lib/data';
import {
  loadAnomalyConfig,
  evaluatePointForAnomaly,
  recordAnomaly,
} from '@/lib/anomaly';

/**
 * GET /api/cron/anomaly
 *
 * Cron-friendly endpoint for the Anomaly_Detector (R7.1-R7.3). Call this on a
 * schedule (cron-job.org, Checkly, Vercel Cron, etc.) from an external
 * scheduler. All detection/recording logic lives in `lib/anomaly.ts` (R9.1) so
 * this route is pure orchestration:
 *
 *   1. Load the admin-adjustable detection thresholds via `loadAnomalyConfig`
 *      (R7.7) — these feed `classifyPoint` (threshold/minChange) and the
 *      `recordAnomaly` dedup window.
 *   2. Read the tracked servers (`getServers`) and a recent player-count window
 *      (`getPlayerCounts`, reused — no new query path, R9.3). A 7-day window is
 *      wide enough to build the hour-of-week baseline that `expectedValueFor`
 *      uses while still including the newest points.
 *   3. For each server, evaluate its NEWEST in-range player-count point against
 *      that baseline with `evaluatePointForAnomaly`. When anomalous, persist it
 *      via `recordAnomaly` (which suppresses duplicates inside the configured
 *      dedup window, R7.6).
 *
 * Requires the `CRON_SECRET` env var to match the `?secret=` query param,
 * exactly like `/api/cron/monitoring` and `/api/cron/record-predictions`.
 */

/** Player-count window read for evaluation. 7 days gives a usable hour-of-week baseline. */
const EVALUATION_TIME_RANGE = '7d' as const;

/** Return the newest (latest timestamp) point in a server's series, or null when empty. */
function newestPoint(series: PlayerCountData[]): PlayerCountData | null {
  let newest: PlayerCountData | null = null;
  let newestMs = Number.NEGATIVE_INFINITY;
  for (const point of series) {
    const ms = Date.parse(point.timestamp);
    if (Number.isNaN(ms)) continue;
    if (ms > newestMs) {
      newestMs = ms;
      newest = point;
    }
  }
  return newest;
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const secret = searchParams.get('secret');
    const cronSecret = process.env.CRON_SECRET;

    if (!cronSecret || secret !== cronSecret) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // --- Load admin-adjustable thresholds (R7.7) ----------------------------
    const config = await loadAnomalyConfig();

    // --- Source servers + a recent player-count window (R9.3 reuse) ---------
    const servers = await getServers();
    const serverIds = servers.map((s) => s.server_id);

    if (serverIds.length === 0) {
      return NextResponse.json({
        success: true,
        evaluated: 0,
        recorded: 0,
        suppressed: 0,
        timestamp: new Date().toISOString(),
      });
    }

    const playerData: PlayerCountData[] = await getPlayerCounts(serverIds, EVALUATION_TIME_RANGE);

    // Group points by server once so each server's baseline + newest point are
    // derived from a single fetch (no per-server query path).
    const seriesByServer = new Map<string, PlayerCountData[]>();
    for (const point of playerData) {
      const list = seriesByServer.get(point.server_id);
      if (list) {
        list.push(point);
      } else {
        seriesByServer.set(point.server_id, [point]);
      }
    }

    let evaluated = 0;
    let recorded = 0;
    let suppressed = 0;

    // --- Evaluate the newest point per server (R7.1-R7.3) -------------------
    for (const serverId of serverIds) {
      const series = seriesByServer.get(serverId);
      if (!series || series.length === 0) continue;

      const latest = newestPoint(series);
      if (!latest) continue;

      evaluated += 1;

      const result = evaluatePointForAnomaly(
        series,
        {
          serverId,
          timestamp: latest.timestamp,
          observed: latest.player_count,
        },
        config,
      );

      if (!result.anomalous) continue;

      const { recorded: wasRecorded } = await recordAnomaly(result.record, { config });
      if (wasRecorded) {
        recorded += 1;
      } else {
        suppressed += 1;
      }
    }

    return NextResponse.json({
      success: true,
      evaluated,
      recorded,
      suppressed,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[Cron Anomaly] Error:', error);
    return NextResponse.json(
      { success: false, error: 'Anomaly evaluation failed' },
      { status: 500 },
    );
  }
}
