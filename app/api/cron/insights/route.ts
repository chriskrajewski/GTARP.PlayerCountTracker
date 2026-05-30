import { NextRequest, NextResponse } from 'next/server';
import { generateMonthlyReport, previousMonth, isValidMonth } from '@/lib/insights';

/**
 * GET /api/cron/insights
 *
 * Cron-friendly endpoint for the Historical Wrapped / Insights_Report feature
 * (R5.1, R5.6). Call this on a schedule (cron-job.org, Checkly, Vercel Cron,
 * etc.) from an external scheduler — a daily cadence is sufficient.
 *
 * By default it generates the just-completed calendar month (the month BEFORE
 * the current one). Pass `?month=YYYY-MM` to generate a SPECIFIC month on
 * demand (useful for backfilling / a one-off preview). All real work is
 * delegated to `generateMonthlyReport` in `lib/insights.ts` (R9.1), which is
 * IDEMPOTENT: an already-generated month is returned unchanged rather than
 * regenerated (R5.6), so this is safe to re-run.
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

    // Optional explicit month override (?month=YYYY-MM) for one-off generation.
    const monthParam = searchParams.get('month');
    let targetMonth: string | null;

    if (monthParam) {
      if (!isValidMonth(monthParam)) {
        return NextResponse.json(
          { success: false, error: "Invalid 'month' (expected YYYY-MM)" },
          { status: 400 }
        );
      }
      targetMonth = monthParam;
    } else {
      const now = new Date();
      // The just-completed calendar month = the month before the current one.
      const currentMonthKey = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`;
      targetMonth = previousMonth(currentMonthKey);
    }

    if (!targetMonth) {
      return NextResponse.json(
        { success: false, error: 'Could not resolve the target month' },
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
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[Cron Insights] Error:', error);
    return NextResponse.json(
      { success: false, error: 'Insights report generation failed' },
      { status: 500 }
    );
  }
}
