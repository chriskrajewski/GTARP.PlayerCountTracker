import { createServiceRoleClient } from '@/lib/supabase-service-role';

export interface MonitoringAlert {
  alert_type: string;
  severity: 'info' | 'warning' | 'critical';
  title: string;
  message: string;
  server_id?: string;
  details?: Record<string, any>;
}

export interface MonitoringResult {
  alerts: MonitoringAlert[];
  checks_run: number;
  timestamp: string;
  config: MonitoringConfig;
}

export interface MonitoringConfig {
  stale_threshold_minutes: number;
  anomaly_threshold_percent: number;
  anomaly_min_change: number;
  checks_enabled: {
    data_staleness: boolean;
    data_gaps: boolean;
    anomaly_detection: boolean;
    api_reachability: boolean;
  };
  dedup_window_minutes: number;
  excluded_servers: string[];
}

export const DEFAULT_MONITORING_CONFIG: MonitoringConfig = {
  stale_threshold_minutes: 10,
  anomaly_threshold_percent: 50,
  anomaly_min_change: 20,
  checks_enabled: {
    data_staleness: true,
    data_gaps: true,
    anomaly_detection: true,
    api_reachability: true,
  },
  dedup_window_minutes: 30,
  excluded_servers: [],
};

export async function loadMonitoringConfig(): Promise<MonitoringConfig> {
  try {
    const supabase = createServiceRoleClient();
    const { data: setting } = await supabase
      .from('system_settings')
      .select('value')
      .eq('key', 'monitoring_config')
      .single();

    if (setting?.value) {
      const parsed = JSON.parse(setting.value);
      return {
        ...DEFAULT_MONITORING_CONFIG,
        ...parsed,
        checks_enabled: { ...DEFAULT_MONITORING_CONFIG.checks_enabled, ...parsed.checks_enabled },
      };
    }
  } catch {
    // Use defaults
  }
  return DEFAULT_MONITORING_CONFIG;
}

export async function runMonitoringChecks(): Promise<MonitoringResult> {
  const alerts: MonitoringAlert[] = [];
  let checksRun = 0;
  const config = await loadMonitoringConfig();
  const supabase = createServiceRoleClient();

  if (config.checks_enabled.data_staleness) {
    checksRun++;
    try {
      const { data: servers } = await supabase
        .from('server_xref')
        .select('server_id, server_name');

      if (servers) {
        const monitoredServers = servers.filter(s => !config.excluded_servers.includes(s.server_id));
        const staleServers: string[] = [];
        const now = Date.now();

        for (const server of monitoredServers) {
          const { data: latest } = await supabase
            .from('player_counts')
            .select('created_at')
            .eq('server_id', server.server_id)
            .order('created_at', { ascending: false })
            .limit(1)
            .single();

          if (latest) {
            const minutesAgo = (now - new Date(latest.created_at).getTime()) / 60000;
            if (minutesAgo > config.stale_threshold_minutes) {
              staleServers.push(server.server_name);
            }
          }
        }

        if (staleServers.length === monitoredServers.length && monitoredServers.length > 0) {
          alerts.push({
            alert_type: 'all_servers_down',
            severity: 'critical',
            title: 'Data Collection Stopped',
            message: `No data received from any server in the last ${config.stale_threshold_minutes} minutes.`,
            details: { stale_servers: staleServers, threshold_minutes: config.stale_threshold_minutes },
          });
        } else if (staleServers.length > 0) {
          alerts.push({
            alert_type: 'collection_stale',
            severity: 'warning',
            title: `${staleServers.length} Server(s) Not Reporting`,
            message: `Servers with stale data: ${staleServers.join(', ')}`,
            details: { stale_servers: staleServers, threshold_minutes: config.stale_threshold_minutes },
          });
        }
      }
    } catch (error) {
      alerts.push({
        alert_type: 'database_error',
        severity: 'critical',
        title: 'Database Check Failed',
        message: `Could not query player_counts: ${error instanceof Error ? error.message : 'Unknown error'}`,
      });
    }
  }

  if (config.checks_enabled.data_gaps) {
    checksRun++;
    try {
      const { data: recentData } = await supabase
        .from('player_counts')
        .select('created_at')
        .gte('created_at', new Date(Date.now() - 3600000).toISOString())
        .order('created_at', { ascending: true });

      if (recentData && recentData.length > 1) {
        for (let i = 1; i < recentData.length; i++) {
          const gap = (new Date(recentData[i].created_at).getTime() - new Date(recentData[i - 1].created_at).getTime()) / 60000;
          if (gap > config.stale_threshold_minutes) {
            alerts.push({
              alert_type: 'data_gap',
              severity: 'warning',
              title: 'Data Gap Detected',
              message: `${Math.round(gap)} minute gap detected in the last hour`,
              details: { gap_minutes: Math.round(gap), gap_start: recentData[i - 1].created_at, gap_end: recentData[i].created_at },
            });
            break;
          }
        }
      }
    } catch {
      // Covered by staleness check
    }
  }

  if (config.checks_enabled.anomaly_detection) {
    checksRun++;
    try {
      const { data: servers } = await supabase
        .from('server_xref')
        .select('server_id, server_name');

      if (servers) {
        const monitoredServers = servers.filter(s => !config.excluded_servers.includes(s.server_id));
        for (const server of monitoredServers) {
          const { data: recent } = await supabase
            .from('player_counts')
            .select('player_count, created_at')
            .eq('server_id', server.server_id)
            .order('created_at', { ascending: false })
            .limit(3);

          if (recent && recent.length >= 2) {
            const current = recent[0].player_count;
            const previous = recent[1].player_count;

            if (previous > 10) {
              const changePercent = Math.abs(current - previous) / previous * 100;
              if (changePercent > config.anomaly_threshold_percent && Math.abs(current - previous) > config.anomaly_min_change) {
                const direction = current > previous ? 'spike' : 'drop';
                alerts.push({
                  alert_type: direction === 'spike' ? 'anomaly_spike' : 'anomaly_drop',
                  severity: 'info',
                  title: `Player Count ${direction === 'spike' ? 'Spike' : 'Drop'}: ${server.server_name}`,
                  message: `${server.server_name}: ${previous} → ${current} players (${Math.round(changePercent)}% ${direction})`,
                  server_id: server.server_id,
                  details: { previous, current, change_percent: Math.round(changePercent) },
                });
              }
            }
          }
        }
      }
    } catch {
      // Non-critical
    }
  }

  if (config.checks_enabled.api_reachability) {
    checksRun++;
    try {
      const response = await fetch('https://frontend.cfx-services.net/api/servers/single/6j7je6', {
        headers: { 'User-Agent': 'Mozilla/5.0', 'Accept': 'application/json' },
        signal: AbortSignal.timeout(10000),
      });

      if (!response.ok) {
        alerts.push({
          alert_type: 'api_failure',
          severity: 'critical',
          title: 'FiveM API Unreachable',
          message: `FiveM API returned HTTP ${response.status}. Data collection will fail.`,
          details: { status_code: response.status },
        });
      }
    } catch (error) {
      alerts.push({
        alert_type: 'api_failure',
        severity: 'critical',
        title: 'FiveM API Unreachable',
        message: `Cannot reach FiveM API: ${error instanceof Error ? error.message : 'timeout'}`,
        details: { error: error instanceof Error ? error.message : 'Unknown' },
      });
    }
  }

  return { alerts, checks_run: checksRun, timestamp: new Date().toISOString(), config };
}


export async function sendDiscordAlert(alert: MonitoringAlert, webhookUrl: string): Promise<boolean> {
  const colorMap: Record<string, number> = {
    info: 0x00D9FF,
    warning: 0xFFAA00,
    critical: 0xFF0040,
  };

  const severityEmoji = alert.severity === 'critical' ? '🚨' : alert.severity === 'warning' ? '⚠️' : 'ℹ️';
  const typeLabels: Record<string, string> = {
    all_servers_down: 'Collection Outage',
    collection_stale: 'Stale Data',
    data_gap: 'Data Gap',
    api_failure: 'API Down',
    anomaly_spike: 'Player Spike',
    anomaly_drop: 'Player Drop',
    database_error: 'Database Error',
    server_down: 'Server Down',
  };

  const fields: Array<{ name: string; value: string; inline: boolean }> = [];

  // Add type-specific detailed fields
  if (alert.alert_type === 'all_servers_down' || alert.alert_type === 'collection_stale') {
    if (alert.details?.stale_servers) {
      fields.push({
        name: '🖥️ Affected Servers',
        value: alert.details.stale_servers.join('\n') || 'Unknown',
        inline: false,
      });
    }
    if (alert.details?.threshold_minutes) {
      fields.push({
        name: '⏱️ Threshold',
        value: `${alert.details.threshold_minutes} minutes`,
        inline: true,
      });
    }
    fields.push({
      name: '🔧 Likely Cause',
      value: alert.alert_type === 'all_servers_down'
        ? 'FiveM API changed/down, Edge Function crashed, or Supabase cron stopped'
        : 'Individual server may be offline or ID changed',
      inline: false,
    });
    fields.push({
      name: '🛠️ Action',
      value: '1. Check [FiveM API](https://frontend.cfx-services.net/api/servers/single/6j7je6)\n2. Check Supabase Edge Function logs\n3. Run monitoring from admin panel',
      inline: false,
    });
  }

  if (alert.alert_type === 'data_gap') {
    if (alert.details?.gap_minutes) {
      fields.push({ name: '⏱️ Gap Duration', value: `${alert.details.gap_minutes} minutes`, inline: true });
    }
    if (alert.details?.gap_start) {
      fields.push({ name: '📅 Gap Start', value: new Date(alert.details.gap_start).toLocaleString('en-US', { timeZone: 'America/New_York' }), inline: true });
    }
    if (alert.details?.gap_end) {
      fields.push({ name: '📅 Gap End', value: new Date(alert.details.gap_end).toLocaleString('en-US', { timeZone: 'America/New_York' }), inline: true });
    }
    fields.push({
      name: '🛠️ Action',
      value: 'Use Admin → Settings → System → Backfill to fill the gap with estimated data',
      inline: false,
    });
  }

  if (alert.alert_type === 'api_failure') {
    if (alert.details?.status_code) {
      fields.push({ name: '📡 HTTP Status', value: String(alert.details.status_code), inline: true });
    }
    if (alert.details?.error) {
      fields.push({ name: '❌ Error', value: alert.details.error, inline: true });
    }
    fields.push({
      name: '🔧 Likely Cause',
      value: 'FiveM/Cfx.re may have changed their API endpoint again, or their servers are down',
      inline: false,
    });
    fields.push({
      name: '🛠️ Action',
      value: '1. Test: `curl https://frontend.cfx-services.net/api/servers/single/6j7je6`\n2. Check https://status.cfx.re\n3. If 404, find new endpoint from https://servers.fivem.net JS bundle',
      inline: false,
    });
  }

  if (alert.alert_type === 'anomaly_spike' || alert.alert_type === 'anomaly_drop') {
    if (alert.details?.previous !== undefined) {
      fields.push({ name: '📊 Previous Count', value: String(alert.details.previous), inline: true });
    }
    if (alert.details?.current !== undefined) {
      fields.push({ name: '📊 Current Count', value: String(alert.details.current), inline: true });
    }
    if (alert.details?.change_percent) {
      fields.push({ name: '📈 Change', value: `${alert.details.change_percent}%`, inline: true });
    }
    if (alert.server_id) {
      fields.push({ name: '🖥️ Server ID', value: alert.server_id, inline: true });
    }
    fields.push({
      name: '🔧 Likely Cause',
      value: alert.alert_type === 'anomaly_drop'
        ? 'Server restart, crash, or API returning stale/zero data'
        : 'Server came back online, event started, or data correction',
      inline: false,
    });
  }

  if (alert.alert_type === 'database_error') {
    fields.push({
      name: '🛠️ Action',
      value: '1. Check Supabase dashboard for outages\n2. Verify service role key is valid\n3. Check connection limits',
      inline: false,
    });
  }

  // Always add timestamp
  fields.push({
    name: '🕐 Detected At',
    value: new Date().toLocaleString('en-US', { timeZone: 'America/New_York', dateStyle: 'short', timeStyle: 'long' }),
    inline: true,
  });

  const embed = {
    title: `${severityEmoji} ${alert.title}`,
    description: alert.message,
    color: colorMap[alert.severity] || 0x808080,
    timestamp: new Date().toISOString(),
    footer: { text: `RPStats Monitoring • ${typeLabels[alert.alert_type] || alert.alert_type} • ${alert.severity.toUpperCase()}` },
    fields,
  };

  try {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: 'RPStats Monitor',
        embeds: [embed],
      }),
    });
    return response.ok;
  } catch (error) {
    console.error('[Monitoring] Discord webhook failed:', error);
    return false;
  }
}

export async function processAlerts(alerts: MonitoringAlert[]): Promise<{ stored: number; notified: number }> {
  if (alerts.length === 0) return { stored: 0, notified: 0 };

  const supabase = createServiceRoleClient();
  const config = await loadMonitoringConfig();
  let stored = 0;
  let notified = 0;

  let webhookUrl = process.env.DISCORD_WEBHOOK_URL || '';
  try {
    const { data: setting } = await supabase
      .from('system_settings')
      .select('value')
      .eq('key', 'discord_webhook_url')
      .single();
    if (setting?.value) webhookUrl = setting.value;
  } catch {
    // Use env var fallback
  }

  for (const alert of alerts) {
    const { data: existing } = await supabase
      .from('alert_history')
      .select('id')
      .eq('alert_type', alert.alert_type)
      .gte('created_at', new Date(Date.now() - config.dedup_window_minutes * 60000).toISOString())
      .limit(1);

    if (existing && existing.length > 0) continue;

    const { error: insertError } = await supabase
      .from('alert_history')
      .insert({
        alert_type: alert.alert_type,
        severity: alert.severity,
        title: alert.title,
        message: alert.message,
        server_id: alert.server_id || null,
        details: alert.details || null,
        discord_sent: false,
      });

    if (!insertError) stored++;

    if (webhookUrl && (alert.severity === 'warning' || alert.severity === 'critical')) {
      const sent = await sendDiscordAlert(alert, webhookUrl);
      if (sent) {
        notified++;
        await supabase
          .from('alert_history')
          .update({ discord_sent: true, discord_sent_at: new Date().toISOString() })
          .eq('alert_type', alert.alert_type)
          .order('created_at', { ascending: false })
          .limit(1);
      }
    }
  }

  return { stored, notified };
}
