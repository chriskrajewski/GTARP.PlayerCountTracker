import { NextRequest, NextResponse } from 'next/server';
import { validateAdminRequest } from '@/lib/admin-auth-server';
import { runMonitoringChecks, processAlerts } from '@/lib/monitoring';

/**
 * POST /api/admin/monitoring/run
 * 
 * Runs all monitoring checks, stores alerts, and sends Discord notifications.
 * Can be called manually from admin panel or via external cron (e.g., Checkly, cron-job.org).
 */
export async function POST(request: NextRequest) {
  try {
    // Allow cron access via secret header OR admin auth
    const cronSecret = request.headers.get('x-cron-secret');
    const isValidCron = cronSecret && cronSecret === process.env.CRON_SECRET;

    if (!isValidCron && !validateAdminRequest(request)) {
      return NextResponse.json(
        { success: false, error: 'Authentication required' },
        { status: 401 }
      );
    }

    const result = await runMonitoringChecks();
    const { stored, notified } = await processAlerts(result.alerts);

    return NextResponse.json({
      success: true,
      data: {
        ...result,
        alerts_stored: stored,
        alerts_notified: notified,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Monitoring run error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
