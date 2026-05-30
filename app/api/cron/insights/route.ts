import { NextRequest, NextResponse } from 'next/server';
import { generateMonthlyReport, previousMonth } from '@/lib/insights';

/**
 * GET /api/cron/insights
 *
 * Cron-friendly endpoint for the Historical Wrapped / Insights_Report feature
 * (R5.1, R5.6). Call this on a schedule (cron-job.org, Checkly, Vercel Cron,
 * etc.) from an external scheduler — a daily cadence is sufficient.
 *
 * Once a calendar month has completed, this generates that month's report
 * (the month BEFORE the current one). All real work is delegated to
 * `generateMonthlyReport` in `lib/insights.ts` (R9.1), which is IDEMPOTENT:
 * if the previous month's report already exists it is returned unchanged rather
 * than regenerated (R5.6), so running this daily only generates a report once
 * per month and is safe to re-run.
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

    const now = new Date();
    // The just-completed calendar month = the month before the current one.
    const currentMonthKey = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`;
    const targetMonth = previousMonth(currentMonthKey);

    if (!targetMonth) {
      return NextResponse.json(
        { success: false, error: 'Could not resolve the previous month' },
        { status: 500 }
      );
    }

    // Idempotent: returns the existing report unchanged when already generated (R5.6).
    const report = await generateMonthlyReport(targetMonth);

    return NextResponse.json({
      success: true,
      month: report.month,
      shareSlug: report.shareSlug,
      generatedAt: report.generatedAt,
      timestamp: now.toISOString(),
    });
  } catch (error) {
    console.error('[Cron Insights] Error:', error);
    return NextResponse.json(
      { success: false, error: 'Insights report generation failed' },
      { status: 500 }
    );
  }
}
