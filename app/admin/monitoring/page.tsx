"use client";

import { useState, useEffect } from 'react';
import { AdminProtected } from '@/components/admin-login-supabase';
import { AdminSidebarMobile } from '@/components/admin/admin-sidebar-mobile';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Activity,
  Bell,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  RefreshCw,
  Send,
  Shield,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { adminAPI } from '@/lib/admin-api';

interface Alert {
  id: number;
  created_at: string;
  alert_type: string;
  severity: string;
  title: string;
  message: string;
  server_id: string | null;
  details: any;
  resolved: boolean;
  resolved_at: string | null;
  discord_sent: boolean;
}

interface ChecksEnabled {
  data_staleness: boolean;
  data_gaps: boolean;
  anomaly_detection: boolean;
  api_reachability: boolean;
}

interface MonitoringConfig {
  stale_threshold_minutes: number;
  anomaly_threshold_percent: number;
  anomaly_min_change: number;
  checks_enabled: ChecksEnabled;
  dedup_window_minutes: number;
}

export default function MonitoringPage() {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [webhookUrl, setWebhookUrl] = useState('');
  const [monitoringEnabled, setMonitoringEnabled] = useState(true);
  const [monitoringConfig, setMonitoringConfig] = useState<MonitoringConfig>({
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
  });
  const [testingSend, setTestingSend] = useState(false);
  const [savingConfig, setSavingConfig] = useState(false);
  const [showResolved, setShowResolved] = useState(false);
  const { toast } = useToast();

  const loadAlerts = async () => {
    try {
      setLoading(true);
      const response = await adminAPI.getAlertHistory({ limit: 50, unresolved: !showResolved });
      setAlerts(response.data || []);
    } catch (error) {
      console.error('Failed to load alerts:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadConfig = async () => {
    try {
      const response = await adminAPI.getMonitoringConfig();
      if (response.data) {
        setMonitoringEnabled(response.data.monitoring_enabled);
        if (response.data.monitoring_config) {
          setMonitoringConfig(response.data.monitoring_config);
        }
      }
    } catch (error) {
      console.error('Failed to load config:', error);
    }
  };

  useEffect(() => {
    loadAlerts();
    loadConfig();
  }, [showResolved]);

  const handleRunChecks = async () => {
    setRunning(true);
    try {
      const response = await adminAPI.runMonitoringChecks();
      const data = response.data;
      toast({
        title: 'Monitoring checks complete',
        description: `${data.checks_run} checks run, ${data.alerts?.length || 0} alerts found, ${data.alerts_notified || 0} notifications sent`,
      });
      loadAlerts();
    } catch (error) {
      toast({
        title: 'Check failed',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive',
      });
    } finally {
      setRunning(false);
    }
  };

  const handleResolve = async (id: number) => {
    try {
      await adminAPI.resolveAlert(id);
      setAlerts(prev => prev.filter(a => a.id !== id));
      toast({ title: 'Alert resolved' });
    } catch (error) {
      toast({ title: 'Failed to resolve', variant: 'destructive' });
    }
  };

  const handleTestWebhook = async () => {
    if (!webhookUrl) return;
    setTestingSend(true);
    try {
      const response = await adminAPI.testDiscordWebhook(webhookUrl);
      if (response.success) {
        toast({ title: 'Test sent', description: 'Check your Discord channel' });
      } else {
        toast({ title: 'Test failed', description: 'Webhook URL may be invalid', variant: 'destructive' });
      }
    } catch (error) {
      toast({ title: 'Test failed', variant: 'destructive' });
    } finally {
      setTestingSend(false);
    }
  };

  const handleSaveConfig = async () => {
    setSavingConfig(true);
    try {
      await adminAPI.updateMonitoringConfig({
        discord_webhook_url: webhookUrl || undefined,
        monitoring_enabled: monitoringEnabled,
        monitoring_config: monitoringConfig,
      });
      toast({ title: 'Config saved' });
    } catch (error) {
      toast({ title: 'Save failed', variant: 'destructive' });
    } finally {
      setSavingConfig(false);
    }
  };

  const severityIcon = (severity: string) => {
    switch (severity) {
      case 'critical': return <XCircle className="h-4 w-4 text-red-400" />;
      case 'warning': return <AlertTriangle className="h-4 w-4 text-yellow-400" />;
      default: return <Bell className="h-4 w-4 text-cyan-400" />;
    }
  };

  const severityBadge = (severity: string) => {
    const variants: Record<string, string> = {
      critical: 'border-red-500/30 text-red-300 bg-red-500/10',
      warning: 'border-yellow-500/30 text-yellow-300 bg-yellow-500/10',
      info: 'border-cyan-500/30 text-cyan-300 bg-cyan-500/10',
    };
    return variants[severity] || variants.info;
  };

  return (
    <AdminProtected>
      <div className="flex flex-col md:flex-row h-screen bg-[#0e0e10]">
        <AdminSidebarMobile />

        <div className="flex-1 flex flex-col overflow-hidden md:ml-64 mt-16 md:mt-0">
          <div className="bg-[#1a1a1e] border-b border-[#26262c] px-4 md:px-6 py-4">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-xl md:text-2xl font-bold text-white flex items-center gap-2">
                  <Activity className="h-5 md:h-6 w-5 md:w-6" />
                  Monitoring
                </h1>
                <p className="text-[#ADADB8] text-xs md:text-sm">
                  Data health alerts and Discord notifications
                </p>
              </div>
              <Button
                onClick={handleRunChecks}
                disabled={running}
                className="bg-[#9147ff] hover:bg-[#772ce8] text-white"
              >
                {running ? <RefreshCw className="h-4 w-4 mr-2 animate-spin" /> : <Activity className="h-4 w-4 mr-2" />}
                Run Checks
              </Button>
            </div>
          </div>

          <div className="flex-1 overflow-auto p-4 md:p-6">
            <div className="max-w-4xl mx-auto space-y-6">

              {/* Discord Config */}
              <Card className="bg-[#1a1a1e] border-[#26262c]">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-white">
                    <Shield className="h-5 w-5" />
                    Notification Settings
                  </CardTitle>
                  <CardDescription className="text-[#ADADB8]">
                    Configure Discord webhook for real-time alerts
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between p-3 bg-[#26262c]/30 rounded-lg border border-[#40404a]/30">
                    <div>
                      <Label className="text-white font-medium">Enable Monitoring</Label>
                      <p className="text-xs text-[#ADADB8] mt-0.5">Send alerts when issues are detected</p>
                    </div>
                    <Switch checked={monitoringEnabled} onCheckedChange={setMonitoringEnabled} />
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-white text-sm">Discord Webhook URL</Label>
                    <div className="flex gap-2">
                      <Input
                        value={webhookUrl}
                        onChange={(e) => setWebhookUrl(e.target.value)}
                        placeholder="https://discord.com/api/webhooks/..."
                        className="bg-[#26262c] border-[#40404a] text-white flex-1"
                      />
                      <Button
                        variant="outline"
                        onClick={handleTestWebhook}
                        disabled={!webhookUrl || testingSend}
                        className="border-[#40404a] text-white hover:bg-[#26262c]"
                      >
                        {testingSend ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                      </Button>
                    </div>
                    <p className="text-xs text-[#ADADB8]">
                      Create a webhook in your Discord server settings → Integrations → Webhooks
                    </p>
                  </div>

                  <Button
                    onClick={handleSaveConfig}
                    disabled={savingConfig}
                    className="bg-[#9147ff] hover:bg-[#772ce8] text-white"
                  >
                    {savingConfig ? 'Saving...' : 'Save Config'}
                  </Button>

                  <div className="p-3 bg-[#26262c]/30 rounded-lg border border-[#40404a]/30">
                    <p className="text-xs text-[#ADADB8]">
                      <span className="text-white font-medium">Cron Setup:</span> To run checks automatically, set up an external cron to hit:<br />
                      <code className="text-cyan-400">GET /api/cron/monitoring?secret=YOUR_CRON_SECRET</code><br />
                      Set <code className="text-cyan-400">CRON_SECRET</code> in your environment variables. Recommended: every 5 minutes.
                    </p>
                  </div>
                </CardContent>
              </Card>

              {/* Check Configuration */}
              <Card className="bg-[#1a1a1e] border-[#26262c]">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-white">
                    <Activity className="h-5 w-5" />
                    Alert Configuration
                  </CardTitle>
                  <CardDescription className="text-[#ADADB8]">
                    Choose which checks to run and configure thresholds
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-3">
                    <div className="flex items-center justify-between p-3 bg-[#26262c]/30 rounded-lg border border-[#40404a]/30">
                      <div>
                        <Label className="text-white font-medium">Data Staleness</Label>
                        <p className="text-xs text-[#ADADB8] mt-0.5">Alert when servers stop reporting data</p>
                      </div>
                      <Switch
                        checked={monitoringConfig.checks_enabled.data_staleness}
                        onCheckedChange={(v) => setMonitoringConfig(c => ({ ...c, checks_enabled: { ...c.checks_enabled, data_staleness: v } }))}
                      />
                    </div>
                    <div className="flex items-center justify-between p-3 bg-[#26262c]/30 rounded-lg border border-[#40404a]/30">
                      <div>
                        <Label className="text-white font-medium">Data Gaps</Label>
                        <p className="text-xs text-[#ADADB8] mt-0.5">Detect gaps in recent data collection</p>
                      </div>
                      <Switch
                        checked={monitoringConfig.checks_enabled.data_gaps}
                        onCheckedChange={(v) => setMonitoringConfig(c => ({ ...c, checks_enabled: { ...c.checks_enabled, data_gaps: v } }))}
                      />
                    </div>
                    <div className="flex items-center justify-between p-3 bg-[#26262c]/30 rounded-lg border border-[#40404a]/30">
                      <div>
                        <Label className="text-white font-medium">Anomaly Detection</Label>
                        <p className="text-xs text-[#ADADB8] mt-0.5">Alert on unusual player count spikes or drops</p>
                      </div>
                      <Switch
                        checked={monitoringConfig.checks_enabled.anomaly_detection}
                        onCheckedChange={(v) => setMonitoringConfig(c => ({ ...c, checks_enabled: { ...c.checks_enabled, anomaly_detection: v } }))}
                      />
                    </div>
                    <div className="flex items-center justify-between p-3 bg-[#26262c]/30 rounded-lg border border-[#40404a]/30">
                      <div>
                        <Label className="text-white font-medium">API Reachability</Label>
                        <p className="text-xs text-[#ADADB8] mt-0.5">Check if FiveM API is responding</p>
                      </div>
                      <Switch
                        checked={monitoringConfig.checks_enabled.api_reachability}
                        onCheckedChange={(v) => setMonitoringConfig(c => ({ ...c, checks_enabled: { ...c.checks_enabled, api_reachability: v } }))}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
                    <div className="space-y-1.5">
                      <Label className="text-white text-sm">Stale Threshold (min)</Label>
                      <Input
                        type="number"
                        value={monitoringConfig.stale_threshold_minutes}
                        onChange={(e) => setMonitoringConfig(c => ({ ...c, stale_threshold_minutes: Number(e.target.value) }))}
                        min={5}
                        max={60}
                        className="bg-[#26262c] border-[#40404a] text-white"
                      />
                      <p className="text-xs text-[#ADADB8]">Alert after no data for this long</p>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-white text-sm">Anomaly Threshold (%)</Label>
                      <Input
                        type="number"
                        value={monitoringConfig.anomaly_threshold_percent}
                        onChange={(e) => setMonitoringConfig(c => ({ ...c, anomaly_threshold_percent: Number(e.target.value) }))}
                        min={10}
                        max={200}
                        className="bg-[#26262c] border-[#40404a] text-white"
                      />
                      <p className="text-xs text-[#ADADB8]">% change to trigger alert</p>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-white text-sm">Dedup Window (min)</Label>
                      <Input
                        type="number"
                        value={monitoringConfig.dedup_window_minutes}
                        onChange={(e) => setMonitoringConfig(c => ({ ...c, dedup_window_minutes: Number(e.target.value) }))}
                        min={5}
                        max={120}
                        className="bg-[#26262c] border-[#40404a] text-white"
                      />
                      <p className="text-xs text-[#ADADB8]">Suppress duplicate alerts</p>
                    </div>
                  </div>

                  <Button
                    onClick={handleSaveConfig}
                    disabled={savingConfig}
                    className="bg-[#9147ff] hover:bg-[#772ce8] text-white"
                  >
                    {savingConfig ? 'Saving...' : 'Save Configuration'}
                  </Button>
                </CardContent>
              </Card>

              {/* Alert History */}
              <Card className="bg-[#1a1a1e] border-[#26262c]">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="flex items-center gap-2 text-white">
                        <Bell className="h-5 w-5" />
                        Alert History
                      </CardTitle>
                      <CardDescription className="text-[#ADADB8]">
                        Recent monitoring alerts
                      </CardDescription>
                    </div>
                    <div className="flex items-center gap-2">
                      <Label className="text-xs text-[#ADADB8]">Show resolved</Label>
                      <Switch checked={showResolved} onCheckedChange={setShowResolved} />
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  {loading ? (
                    <div className="text-center text-[#ADADB8] py-8">Loading...</div>
                  ) : alerts.length === 0 ? (
                    <div className="text-center py-8">
                      <CheckCircle2 className="h-8 w-8 text-emerald-400 mx-auto mb-2" />
                      <p className="text-[#ADADB8]">No active alerts</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {alerts.map((alert) => (
                        <div
                          key={alert.id}
                          className={`p-3 rounded-lg border flex items-start justify-between gap-3 ${
                            alert.resolved
                              ? 'bg-[#26262c]/20 border-[#40404a]/20 opacity-60'
                              : 'bg-[#26262c]/30 border-[#40404a]/30'
                          }`}
                        >
                          <div className="flex items-start gap-3 flex-1 min-w-0">
                            {severityIcon(alert.severity)}
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-sm text-white font-medium">{alert.title}</span>
                                <Badge variant="outline" className={`text-xs ${severityBadge(alert.severity)}`}>
                                  {alert.severity}
                                </Badge>
                                {alert.discord_sent && (
                                  <Badge variant="outline" className="text-xs border-[#5865F2]/30 text-[#5865F2]">
                                    Discord
                                  </Badge>
                                )}
                              </div>
                              <p className="text-xs text-[#ADADB8] mt-0.5 truncate">{alert.message}</p>
                              <p className="text-xs text-[#ADADB8]/60 mt-0.5">
                                {new Date(alert.created_at).toLocaleString()}
                              </p>
                            </div>
                          </div>
                          {!alert.resolved && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleResolve(alert.id)}
                              className="text-emerald-400 hover:text-emerald-300 h-7 px-2 text-xs flex-shrink-0"
                            >
                              Resolve
                            </Button>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

            </div>
          </div>
        </div>
      </div>
    </AdminProtected>
  );
}
