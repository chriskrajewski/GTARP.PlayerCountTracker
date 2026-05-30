import { NextRequest, NextResponse } from 'next/server';
import { evaluateAlertSubscriptions } from '@/lib/alerts';

/**
 * GET /api/cron/alerts
 *
 * Cron-friendly endpoint for the Alert_System (R3.5–R3.7, R3.10). Call this on
 * a schedule (cron-job.org, Checkly, Vercel Cron, etc.) from an external
 * scheduler — every ~2 minutes is a reasonable cadence.
 *
 * All real work is delegated to `evaluateAlertSubscriptions` in `lib/alerts.ts`
 * (R9.1): it loads enabled subscriptions, detects `cleared -> met` transitions
 * (player count crossing below threshold, streamer offline -> live), delivers
 * at most once per trigger via web-push, logs every delivery attempt, and
 * advances each subscription's edge-trigger state only after delivery is logged.
 *
 * Requires the `CRON_SECRET` env var to match the `?secret=` query param,
 * exactly like `/api/cron/monitoring` and `/api/cron/record-predictions`.
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const secret = searchParams.get('secret');
    const cronSecret = process.env.CRON_SECRET;

    if (!cronSecret || secret !== cronSecret) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const summary = await evaluateAlertSubscriptions(new Date());

    return NextResponse.json({
      success: true,
      evaluated: summary.evaluated,
      delivered: summary.delivered,
      endpointsDelivered: summary.endpointsDelivered,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[Cron Alerts] Error:', error);
    return NextResponse.json(
      { success: false, error: 'Alert evaluation failed' },
      { status: 500 }
    );
  }
}
