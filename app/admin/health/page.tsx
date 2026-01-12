"use client";

import { useEffect, useMemo, useState } from 'react';
import { AdminProtected } from '@/components/admin-login-supabase';
import { AdminSidebarMobile } from '@/components/admin/admin-sidebar-mobile';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Database,
  Gauge,
  HardDrive,
  RefreshCw,
  Server,
  Zap
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { createBrowserClient } from '@/lib/supabase-browser';
import { getStoredAdminToken } from '@/lib/admin-auth';
import type { DatabaseHealth, SystemAlert, SystemMetrics } from '@/lib/admin-types';
import type { MemoryUsageSnapshot } from '@/lib/memory-usage';

type HealthResponse = {
  status: string;
  timestamp: string;
  uptime: number;
  memory_mb?: MemoryUsageSnapshot | null;
};

type DatabaseHealthResponse = {
  overall_status: 'healthy' | 'warning' | 'critical';
  total_checks: number;
  healthy_count: number;
  warning_count: number;
  critical_count: number;
  last_updated: string;
  checks: DatabaseHealth[];
};

export default function SiteHealthPage() {
  const { toast } = useToast();
  const [metrics, setMetrics] = useState<SystemMetrics | null>(null);
  const [alerts, setAlerts] = useState<SystemAlert[]>([]);
  const [systemHealth, setSystemHealth] = useState<{
    database: 'healthy' | 'warning' | 'critical';
    api: 'healthy' | 'warning' | 'critical';
    data_collection: 'healthy' | 'warning' | 'critical';
  } | null>(null);
  const [databaseHealth, setDatabaseHealth] = useState<DatabaseHealthResponse | null>(null);
  const [healthStatus, setHealthStatus] = useState<HealthResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const getAuthToken = async (): Promise<string | null> => {
    const storedToken = getStoredAdminToken();
    if (storedToken) {
      return storedToken;
    }

    try {
      const supabase = createBrowserClient();
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.access_token) {
        return session.access_token;
      }
    } catch (error) {
      console.error('Error getting Supabase session:', error);
    }

    return null;
  };

  const fetchSiteHealth = async (isRefresh = false) => {
    if (isRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    try {
      const token = await getAuthToken();
      if (!token) {
        throw new Error('Admin authentication required');
      }

      const [dashboardResponse, databaseResponse, healthResponse] = await Promise.all([
        fetch('/api/admin/dashboard', {
          headers: { Authorization: `Bearer ${token}` },
        }),
        fetch('/api/admin/database/health', {
          headers: { Authorization: `Bearer ${token}` },
        }),
        fetch('/api/health', { cache: 'no-store' }),
      ]);

      if (dashboardResponse.ok) {
        const dashboardPayload = await dashboardResponse.json();
        setMetrics(dashboardPayload.data?.metrics ?? null);
        setAlerts(dashboardPayload.data?.alerts ?? []);
        setSystemHealth(dashboardPayload.data?.system_health ?? null);
      } else {
        toast({
          title: 'Error',
          description: 'Failed to load system metrics.',
          variant: 'destructive',
        });
      }

      if (databaseResponse.ok) {
        const databasePayload = await databaseResponse.json();
        setDatabaseHealth(databasePayload.data ?? null);
      } else {
        toast({
          title: 'Error',
          description: 'Failed to load database diagnostics.',
          variant: 'destructive',
        });
      }

      if (healthResponse.ok) {
        const healthPayload = await healthResponse.json();
        setHealthStatus(healthPayload);
      }
    } catch (error) {
      console.error('Error loading site health data:', error);
      toast({
        title: 'Error',
        description: 'Failed to load site health data.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchSiteHealth();
    const interval = setInterval(() => fetchSiteHealth(true), 60000);
    return () => clearInterval(interval);
  }, []);

  const memoryUsage = metrics?.memory_usage_mb ?? healthStatus?.memory_mb ?? null;
  const memoryUsagePercent = useMemo(() => {
    if (!memoryUsage || !memoryUsage.heap_total_mb) return null;
    return Math.round((memoryUsage.heap_used_mb / memoryUsage.heap_total_mb) * 100);
  }, [memoryUsage]);

  const getStatusBadge = (status?: string) => {
    const color = status === 'healthy'
      ? 'bg-emerald-400/20 text-emerald-400 border-emerald-400/30'
      : status === 'warning'
        ? 'bg-amber-400/20 text-amber-400 border-amber-400/30'
        : status === 'critical'
          ? 'bg-red-400/20 text-red-400 border-red-400/30'
          : 'bg-[#26262c] text-[#ADADB8] border-[#40404a]';
    return (
      <Badge variant="outline" className={`${color} text-xs`}>
        {status || 'unknown'}
      </Badge>
    );
  };

  return (
    <AdminProtected>
      <div className="flex flex-col md:flex-row h-screen bg-[#0e0e10]">
        <AdminSidebarMobile />

        <div
          className="flex-1 flex flex-col overflow-hidden md:ml-64 mt-16 md:mt-0"
          style={{ marginTop: 'max(4rem, calc(3.5rem + env(safe-area-inset-top)))' }}
        >
          <div className="bg-[#1a1a1e] border-b border-[#26262c] px-4 md:px-6 py-4">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div>
                <h1 className="text-xl md:text-2xl font-bold text-white">Site Health</h1>
                <p className="text-[#ADADB8] text-xs md:text-sm">
                  Detailed system metrics, memory insights, and diagnostics
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => fetchSiteHealth(true)}
                disabled={refreshing}
                className="bg-[#26262c] border-[#40404a] hover:bg-[#333339] text-white w-full md:w-auto"
              >
                <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
              </Button>
            </div>
          </div>

          <div
            className="flex-1 overflow-auto p-4 md:p-6"
            style={{
              paddingLeft: 'max(1rem, calc(1rem + env(safe-area-inset-left)))',
              paddingRight: 'max(1rem, calc(1rem + env(safe-area-inset-right)))',
              paddingBottom: 'max(1.5rem, calc(1.5rem + env(safe-area-inset-bottom)))',
            }}
          >
            <div className="max-w-7xl mx-auto space-y-6">
              <Tabs defaultValue="metrics" className="w-full">
                <TabsList className="grid w-full grid-cols-3 bg-[#26262c]">
                  <TabsTrigger value="metrics" className="text-white text-xs md:text-sm">
                    Metrics
                  </TabsTrigger>
                  <TabsTrigger value="memory" className="text-white text-xs md:text-sm">
                    Memory
                  </TabsTrigger>
                  <TabsTrigger value="diagnostics" className="text-white text-xs md:text-sm">
                    Health/Diag
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="metrics" className="space-y-6 mt-4">
                  {loading ? (
                    <Card className="bg-[#1a1a1e] border-[#26262c]">
                      <CardContent className="p-6 text-sm text-[#ADADB8]">
                        Loading metrics...
                      </CardContent>
                    </Card>
                  ) : (
                    <>
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                        <Card className="bg-[#1a1a1e] border-[#26262c]">
                          <CardContent className="p-5">
                            <div className="flex items-center justify-between">
                              <div>
                                <p className="text-xs text-[#ADADB8]">Total Servers</p>
                                <p className="text-lg font-bold text-white">
                                  {metrics?.total_servers?.toLocaleString() ?? '—'}
                                </p>
                              </div>
                              <Server className="h-6 w-6 text-[#9147ff]" />
                            </div>
                          </CardContent>
                        </Card>
                        <Card className="bg-[#1a1a1e] border-[#26262c]">
                          <CardContent className="p-5">
                            <div className="flex items-center justify-between">
                              <div>
                                <p className="text-xs text-[#ADADB8]">Players Today</p>
                                <p className="text-lg font-bold text-emerald-400">
                                  {metrics?.total_players_today?.toLocaleString() ?? '—'}
                                </p>
                              </div>
                              <Activity className="h-6 w-6 text-emerald-400" />
                            </div>
                          </CardContent>
                        </Card>
                        <Card className="bg-[#1a1a1e] border-[#26262c]">
                          <CardContent className="p-5">
                            <div className="flex items-center justify-between">
                              <div>
                                <p className="text-xs text-[#ADADB8]">Data Points</p>
                                <p className="text-lg font-bold text-white">
                                  {metrics?.total_data_points?.toLocaleString() ?? '—'}
                                </p>
                              </div>
                              <Database className="h-6 w-6 text-blue-400" />
                            </div>
                          </CardContent>
                        </Card>
                        <Card className="bg-[#1a1a1e] border-[#26262c]">
                          <CardContent className="p-5">
                            <div className="flex items-center justify-between">
                              <div>
                                <p className="text-xs text-[#ADADB8]">API Requests</p>
                                <p className="text-lg font-bold text-white">
                                  {metrics?.api_requests_today?.toLocaleString() ?? '—'}
                                </p>
                              </div>
                              <Zap className="h-6 w-6 text-amber-400" />
                            </div>
                          </CardContent>
                        </Card>
                      </div>

                      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                        <Card className="bg-[#1a1a1e] border-[#26262c] lg:col-span-2">
                          <CardHeader>
                            <CardTitle className="text-white text-base">System Health</CardTitle>
                            <CardDescription className="text-[#ADADB8] text-xs">
                              Snapshot of core services
                            </CardDescription>
                          </CardHeader>
                          <CardContent className="space-y-4">
                            <div className="flex items-center justify-between text-sm">
                              <span className="text-[#ADADB8]">Database</span>
                              {getStatusBadge(systemHealth?.database)}
                            </div>
                            <div className="flex items-center justify-between text-sm">
                              <span className="text-[#ADADB8]">API</span>
                              {getStatusBadge(systemHealth?.api)}
                            </div>
                            <div className="flex items-center justify-between text-sm">
                              <span className="text-[#ADADB8]">Data Collection</span>
                              {getStatusBadge(systemHealth?.data_collection)}
                            </div>
                          </CardContent>
                        </Card>

                        <Card className="bg-[#1a1a1e] border-[#26262c]">
                          <CardHeader>
                            <CardTitle className="text-white text-base">System Stats</CardTitle>
                            <CardDescription className="text-[#ADADB8] text-xs">
                              Platform overview
                            </CardDescription>
                          </CardHeader>
                          <CardContent className="space-y-3 text-sm">
                            <div className="flex items-center justify-between">
                              <span className="text-[#ADADB8]">Uptime</span>
                              <span className="text-white">{metrics?.system_uptime ?? '—'}</span>
                            </div>
                            <div className="flex items-center justify-between">
                              <span className="text-[#ADADB8]">Database Size</span>
                              <span className="text-white">{metrics?.database_size ?? '—'}</span>
                            </div>
                            <div className="flex items-center justify-between">
                              <span className="text-[#ADADB8]">Error Rate</span>
                              <span className="text-white">
                                {metrics?.error_rate !== undefined ? `${metrics.error_rate}%` : '—'}
                              </span>
                            </div>
                            <div className="flex items-center justify-between">
                              <span className="text-[#ADADB8]">Active Banners</span>
                              <span className="text-white">{metrics?.active_banners ?? '—'}</span>
                            </div>
                          </CardContent>
                        </Card>
                      </div>

                      <Card className="bg-[#1a1a1e] border-[#26262c]">
                        <CardHeader>
                          <CardTitle className="text-white text-base">Active Alerts</CardTitle>
                          <CardDescription className="text-[#ADADB8] text-xs">
                            Recent system notifications
                          </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-3">
                          {alerts.length === 0 ? (
                            <div className="text-sm text-[#ADADB8]">No active alerts.</div>
                          ) : (
                            alerts.map(alert => (
                              <div
                                key={alert.id}
                                className="flex items-start justify-between gap-3 border border-[#26262c] rounded-lg p-3"
                              >
                                <div className="space-y-1">
                                  <div className="flex items-center gap-2">
                                    {alert.type === 'warning' ? (
                                      <AlertTriangle className="h-4 w-4 text-amber-400" />
                                    ) : (
                                      <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                                    )}
                                    <span className="text-sm text-white">{alert.title}</span>
                                  </div>
                                  <p className="text-xs text-[#ADADB8]">{alert.message}</p>
                                </div>
                                <Badge variant="outline" className="border-[#40404a] text-[#ADADB8] text-xs">
                                  {alert.severity}
                                </Badge>
                              </div>
                            ))
                          )}
                        </CardContent>
                      </Card>
                    </>
                  )}
                </TabsContent>

                <TabsContent value="memory" className="space-y-6 mt-4">
                  {loading ? (
                    <Card className="bg-[#1a1a1e] border-[#26262c]">
                      <CardContent className="p-6 text-sm text-[#ADADB8]">
                        Loading memory metrics...
                      </CardContent>
                    </Card>
                  ) : (
                    <>
                      <Card className="bg-[#1a1a1e] border-[#26262c]">
                        <CardHeader>
                          <CardTitle className="text-white text-base">Heap Usage</CardTitle>
                          <CardDescription className="text-[#ADADB8] text-xs">
                            Current Node.js heap utilization
                          </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-[#ADADB8]">Heap Used</span>
                            <span className="text-white">
                              {memoryUsage ? `${memoryUsage.heap_used_mb.toFixed(1)} MB` : '—'}
                            </span>
                          </div>
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-[#ADADB8]">Heap Total</span>
                            <span className="text-white">
                              {memoryUsage ? `${memoryUsage.heap_total_mb.toFixed(1)} MB` : '—'}
                            </span>
                          </div>
                          <Progress
                            value={memoryUsagePercent ?? 0}
                            className="h-2 bg-[#26262c]"
                          />
                          <div className="text-xs text-[#ADADB8]">
                            {memoryUsagePercent !== null ? `${memoryUsagePercent}% of heap used` : 'Heap usage unavailable'}
                          </div>
                        </CardContent>
                      </Card>

                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                        <Card className="bg-[#1a1a1e] border-[#26262c]">
                          <CardContent className="p-5">
                            <div className="flex items-center justify-between">
                              <div>
                                <p className="text-xs text-[#ADADB8]">RSS</p>
                                <p className="text-lg font-bold text-white">
                                  {memoryUsage ? `${memoryUsage.rss_mb.toFixed(1)} MB` : '—'}
                                </p>
                              </div>
                              <Gauge className="h-6 w-6 text-[#9147ff]" />
                            </div>
                          </CardContent>
                        </Card>
                        <Card className="bg-[#1a1a1e] border-[#26262c]">
                          <CardContent className="p-5">
                            <div className="flex items-center justify-between">
                              <div>
                                <p className="text-xs text-[#ADADB8]">External</p>
                                <p className="text-lg font-bold text-white">
                                  {memoryUsage ? `${memoryUsage.external_mb.toFixed(1)} MB` : '—'}
                                </p>
                              </div>
                              <HardDrive className="h-6 w-6 text-emerald-400" />
                            </div>
                          </CardContent>
                        </Card>
                        <Card className="bg-[#1a1a1e] border-[#26262c]">
                          <CardContent className="p-5">
                            <div className="flex items-center justify-between">
                              <div>
                                <p className="text-xs text-[#ADADB8]">Array Buffers</p>
                                <p className="text-lg font-bold text-white">
                                  {memoryUsage ? `${memoryUsage.array_buffers_mb.toFixed(1)} MB` : '—'}
                                </p>
                              </div>
                              <Database className="h-6 w-6 text-blue-400" />
                            </div>
                          </CardContent>
                        </Card>
                        <Card className="bg-[#1a1a1e] border-[#26262c]">
                          <CardContent className="p-5">
                            <div className="flex items-center justify-between">
                              <div>
                                <p className="text-xs text-[#ADADB8]">Health Status</p>
                                <p className="text-lg font-bold text-white">
                                  {healthStatus?.status ?? '—'}
                                </p>
                              </div>
                              <CheckCircle2 className="h-6 w-6 text-emerald-400" />
                            </div>
                          </CardContent>
                        </Card>
                      </div>
                    </>
                  )}
                </TabsContent>

                <TabsContent value="diagnostics" className="space-y-6 mt-4">
                  {loading ? (
                    <Card className="bg-[#1a1a1e] border-[#26262c]">
                      <CardContent className="p-6 text-sm text-[#ADADB8]">
                        Loading diagnostics...
                      </CardContent>
                    </Card>
                  ) : (
                    <>
                      <Card className="bg-[#1a1a1e] border-[#26262c]">
                        <CardHeader>
                          <CardTitle className="text-white text-base">Database Health</CardTitle>
                          <CardDescription className="text-[#ADADB8] text-xs">
                            {databaseHealth?.last_updated
                              ? `Last updated ${new Date(databaseHealth.last_updated).toLocaleString()}`
                              : 'Latest diagnostics'}
                          </CardDescription>
                        </CardHeader>
                        <CardContent className="grid grid-cols-2 md:grid-cols-4 gap-4">
                          <div className="space-y-1">
                            <p className="text-xs text-[#ADADB8]">Overall Status</p>
                            {getStatusBadge(databaseHealth?.overall_status)}
                          </div>
                          <div className="space-y-1">
                            <p className="text-xs text-[#ADADB8]">Total Checks</p>
                            <p className="text-white text-sm">{databaseHealth?.total_checks ?? '—'}</p>
                          </div>
                          <div className="space-y-1">
                            <p className="text-xs text-[#ADADB8]">Warnings</p>
                            <p className="text-amber-400 text-sm">{databaseHealth?.warning_count ?? '—'}</p>
                          </div>
                          <div className="space-y-1">
                            <p className="text-xs text-[#ADADB8]">Critical</p>
                            <p className="text-red-400 text-sm">{databaseHealth?.critical_count ?? '—'}</p>
                          </div>
                        </CardContent>
                      </Card>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {(databaseHealth?.checks || []).map(check => (
                          <Card key={check.component} className="bg-[#1a1a1e] border-[#26262c]">
                            <CardHeader>
                              <div className="flex items-center justify-between">
                                <CardTitle className="text-white text-sm">{check.component}</CardTitle>
                                {getStatusBadge(check.status)}
                              </div>
                              <CardDescription className="text-[#ADADB8] text-xs">
                                {check.message}
                              </CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-2 text-xs text-[#ADADB8]">
                              <div className="flex items-center justify-between">
                                <span>Response Time</span>
                                <span className="text-white">
                                  {check.response_time_ms !== null && check.response_time_ms !== undefined
                                    ? `${check.response_time_ms} ms`
                                    : '—'}
                                </span>
                              </div>
                              {check.details && (
                                <pre className="bg-[#141416] border border-[#26262c] rounded-md p-2 overflow-auto">
                                  {JSON.stringify(check.details, null, 2)}
                                </pre>
                              )}
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    </>
                  )}
                </TabsContent>
              </Tabs>
            </div>
          </div>
        </div>
      </div>
    </AdminProtected>
  );
}
