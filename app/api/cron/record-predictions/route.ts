import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase-service-role';
import { getPlayerCounts, type PlayerCountData } from '@/lib/data';
import { recordPrediction, matchDetectedRestarts } from '@/lib/prediction-accuracy';

/**
 * GET /api/cron/record-predictions
 *
 * Cron-friendly endpoint for the Prediction_Accuracy_Tracker (R6). Call this on
 * a schedule (cron-job.org, Checkly, Vercel Cron, etc.) from an external
 * scheduler. It performs two jobs and keeps all real logic in
 * `lib/prediction-accuracy.ts` (R9.1) — this route is pure orchestration:
 *
 *   1. SNAPSHOT (R6.1): read the current cached Restart_Predictor output from
 *      `server_restart_predictions` (the same table `GET /api/restart-prediction`
 *      reads) and call `recordPrediction` for each server whose
 *      `next_restart_time` is non-null. To avoid inflating the table with an
 *      identical row every run, a snapshot is only recorded when the current
 *      predicted time DIFFERS from the most recently recorded prediction for
 *      that server (compared by parsed epoch ms so timestamptz re-formatting
 *      does not cause a spurious mismatch), or when none has been recorded yet.
 *
 *   2. MATCH (R6.2): fetch recent player-count data (reusing `getPlayerCounts`
 *      from `lib/data.ts`, R9.3) and call `matchDetectedRestarts` per server,
 *      which reuses `detectRestartEvents` and matches each detected restart to
 *      the most recent applicable recorded prediction. Re-running over an
 *      overlapping window is safe: `matchRestartToPrediction` /
 *      `selectMostRecentApplicablePrediction` only consider UNMATCHED
 *      predictions, so an already-matched restart is never double-counted.
 *
 * Requires the `CRON_SECRET` env var to match the `?secret=` query param,
 * exactly like `/api/cron/monitoring`.
 */

/** A row from `server_restart_predictions` (the cached Restart_Predictor output). */
interface CachedPredictionRow {
  server_id: string;
  next_restart_time: string | null;
  confidence: number | null;
}

/** The latest recorded snapshot for a server, used for snapshot de-duplication. */
interface LatestRecordedRow {
  predicted_restart_time: string;
}

/**
 * Minimal structural surface of the service-role client for reading
 * `recorded_restart_predictions`. That table is not in the generated `Database`
 * type yet, so it is adapted at this single boundary (same approach as
 * `lib/prediction-accuracy.ts` / `lib/owner-scoped.ts`).
 */
interface RecordedReadClient {
  from(table: string): {
    select(columns: string): {
      eq(
        column: string,
        value: string,
      ): {
        order(
          column: string,
          opts: { ascending: boolean },
        ): {
          limit(
            n: number,
          ): PromiseLike<{ data: LatestRecordedRow[] | null; error: { message: string } | null }>;
        };
      };
    };
  };
}

/** Two ISO timestamps refer to the same instant (tolerant of timestamptz re-formatting). */
function sameInstant(a: string, b: string): boolean {
  const aMs = Date.parse(a);
  const bMs = Date.parse(b);
  if (Number.isNaN(aMs) || Number.isNaN(bMs)) return a === b;
  return aMs === bMs;
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const secret = searchParams.get('secret');
    const cronSecret = process.env.CRON_SECRET;

    if (!cronSecret || secret !== cronSecret) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = createServiceRoleClient();

    // --- Source the current predictions (R6.1) -----------------------------
    // Reading every row from `server_restart_predictions` covers every tracked
    // server (each has exactly one row) without a second server-list query.
    const { data: cachedRows, error: cachedError } = await supabase
      .from('server_restart_predictions')
      .select('server_id, next_restart_time, confidence');

    if (cachedError) {
      console.error('[Cron RecordPredictions] Error reading cached predictions:', cachedError);
      return NextResponse.json(
        { success: false, error: 'Failed to read predictions' },
        { status: 500 },
      );
    }

    const cachedPredictions = (cachedRows ?? []) as CachedPredictionRow[];
    const serverIds = cachedPredictions.map((row) => row.server_id);

    // --- Snapshot current predictions, de-duplicated (R6.1) -----------------
    const recordedReadClient = supabase as unknown as RecordedReadClient;
    let recorded = 0;

    for (const prediction of cachedPredictions) {
      const predictedRestartTime = prediction.next_restart_time;
      // Only snapshot servers that actually have a predicted next restart.
      if (!predictedRestartTime) continue;

      // Dedup: skip if the most recently recorded snapshot for this server
      // already captured the same predicted instant.
      const { data: latestRows, error: latestError } = await recordedReadClient
        .from('recorded_restart_predictions')
        .select('predicted_restart_time')
        .eq('server_id', prediction.server_id)
        .order('prediction_made_at', { ascending: false })
        .limit(1);

      if (latestError) {
        console.error(
          `[Cron RecordPredictions] Error reading latest snapshot for ${prediction.server_id}:`,
          latestError,
        );
        continue;
      }

      const latest = latestRows?.[0];
      if (latest && sameInstant(latest.predicted_restart_time, predictedRestartTime)) {
        continue;
      }

      await recordPrediction({
        serverId: prediction.server_id,
        predictedRestartTime,
        confidence: prediction.confidence ?? 0,
      });
      recorded += 1;
    }

    // --- Match newly observed restarts (R6.2) -------------------------------
    // Reuse the existing `getPlayerCounts` reader (R9.3) over a recent window
    // wide enough to catch restarts observed since the last run. A single fetch
    // for all servers is filtered per-server inside `matchDetectedRestarts`.
    let matched = 0;
    if (serverIds.length > 0) {
      const playerData: PlayerCountData[] = await getPlayerCounts(serverIds, '7d');

      for (const serverId of serverIds) {
        const matches = await matchDetectedRestarts(serverId, playerData);
        matched += matches.length;
      }
    }

    return NextResponse.json({
      success: true,
      recorded,
      matched,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[Cron RecordPredictions] Error:', error);
    return NextResponse.json(
      { success: false, error: 'Record predictions failed' },
      { status: 500 },
    );
  }
}
