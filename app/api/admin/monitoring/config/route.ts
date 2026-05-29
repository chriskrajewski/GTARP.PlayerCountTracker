import { NextRequest, NextResponse } from 'next/server';
import { validateAdminRequest } from '@/lib/admin-auth-server';
import { createServiceRoleClient } from '@/lib/supabase-service-role';
import { sendDiscordAlert, loadMonitoringConfig, MonitoringConfig } from '@/lib/monitoring';

/**
 * GET /api/admin/monitoring/config
 * Returns current monitoring configuration.
 */
export async function GET(request: NextRequest) {
  try {
    if (!validateAdminRequest(request)) {
      return NextResponse.json(
        { success: false, error: 'Admin authentication required' },
        { status: 401 }
      );
    }

    const supabase = createServiceRoleClient();

    const { data: settings } = await supabase
      .from('system_settings')
      .select('key, value')
      .in('key', ['discord_webhook_url', 'monitoring_enabled']);

    const config: Record<string, string> = {};
    settings?.forEach((s: any) => { config[s.key] = s.value; });

    const monitoringConfig = await loadMonitoringConfig();

    return NextResponse.json({
      success: true,
      data: {
        discord_webhook_configured: !!config.discord_webhook_url,
        monitoring_enabled: config.monitoring_enabled !== 'false',
        monitoring_config: monitoringConfig,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/admin/monitoring/config
 * Update monitoring configuration (Discord webhook, enable/disable).
 */
export async function PUT(request: NextRequest) {
  try {
    if (!validateAdminRequest(request)) {
      return NextResponse.json(
        { success: false, error: 'Admin authentication required' },
        { status: 401 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const { discord_webhook_url, monitoring_enabled, monitoring_config } = body;

    const supabase = createServiceRoleClient();

    if (discord_webhook_url !== undefined) {
      await supabase
        .from('system_settings')
        .upsert({
          key: 'discord_webhook_url',
          value: discord_webhook_url,
          data_type: 'string',
          description: 'Discord webhook URL for monitoring alerts',
          category: 'monitoring',
        });
    }

    if (monitoring_enabled !== undefined) {
      await supabase
        .from('system_settings')
        .upsert({
          key: 'monitoring_enabled',
          value: String(monitoring_enabled),
          data_type: 'boolean',
          description: 'Enable/disable monitoring alerts',
          category: 'monitoring',
        });
    }

    if (monitoring_config !== undefined) {
      await supabase
        .from('system_settings')
        .upsert({
          key: 'monitoring_config',
          value: JSON.stringify(monitoring_config),
          data_type: 'json',
          description: 'Monitoring check configuration (thresholds, enabled checks)',
          category: 'monitoring',
        });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/monitoring/config
 * Test the Discord webhook by sending a test alert.
 */
export async function POST(request: NextRequest) {
  try {
    if (!validateAdminRequest(request)) {
      return NextResponse.json(
        { success: false, error: 'Admin authentication required' },
        { status: 401 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const { webhook_url } = body;

    if (!webhook_url) {
      return NextResponse.json(
        { success: false, error: 'webhook_url is required' },
        { status: 400 }
      );
    }

    const sent = await sendDiscordAlert({
      alert_type: 'info',
      severity: 'info',
      title: 'Test Alert — RPStats Monitoring',
      message: 'This is a test notification. If you see this, your Discord webhook is configured correctly.',
    }, webhook_url);

    return NextResponse.json({
      success: sent,
      error: sent ? undefined : 'Failed to send test message',
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
