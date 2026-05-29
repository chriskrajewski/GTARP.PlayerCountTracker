import { NextRequest, NextResponse } from 'next/server';
import { runMonitoringChecks, processAlerts } from '@/lib/monitoring';
import { createServiceRoleClient } from '@/lib/supabase-service-role';

/**
 * GET /api/cron/monitoring
 * 
 * Cron-friendly monitoring endpoint. Call this every 5 minutes from an external
 * scheduler (cron-job.org, Checkly, Vercel Cron, etc.)
 * 
 * Requires CRON_SECRET env var to match the ?secret= query param.
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const secret = searchParams.get('secret');
    const cronSecret = process.env.CRON_SECRET;

    if (!cronSecret || secret !== cronSecret) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if monitoring is enabled
    try {
      const supabase = createServiceRoleClient();
      const { data: setting } = await supabase
        .from('system_settings')
        .select('value')
        .eq('key', 'monitoring_enabled')
        .single();
      if (setting?.value === 'false') {
        return NextResponse.json({ success: true, message: 'Monitoring disabled', alerts: [] });
      }
    } catch {
      // Continue if system_settings doesn't exist
    }

    const result = await runMonitoringChecks();
    const { stored, notified } = await processAlerts(result.alerts);

    return NextResponse.json({
      success: true,
      checks_run: result.checks_run,
      alerts_found: result.alerts.length,
      alerts_stored: stored,
      alerts_notified: notified,
      timestamp: result.timestamp,
    });
  } catch (error) {
    console.error('[Cron Monitoring] Error:', error);
    return NextResponse.json(
      { success: false, error: 'Monitoring check failed' },
      { status: 500 }
    );
  }
}
