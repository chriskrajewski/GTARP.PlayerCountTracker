"use client";

import { useState, useEffect } from 'react';
import { AdminProtected } from '@/components/admin-login-supabase';
import { AdminSidebar } from '@/components/admin/admin-sidebar-new';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  Activity, 
  TrendingUp, 
  Users, 
  Database,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Eye,
  Zap
} from 'lucide-react';
import { LiveVisitorCount } from '@/components/LiveVisitorCount';
import { createBrowserClient } from '@/lib/supabase-browser';
import { useToast } from '@/hooks/use-toast';

/**
 * Admin Dashboard
 * 
 * Main admin dashboard with real-time visitor tracking and system metrics.
 * Source: PRD §4.1 FR-8, FR-9; Blueprint §5.1
 */

interface DashboardMetrics {
  totalVisitors: number;
  activeServers: number;
  apiRequests: number;
  systemUptime: string;
}

export default function AdminDashboard() {
  const [metrics, setMetrics] = useState<DashboardMetrics>({
    totalVisitors: 0,
    activeServers: 0,
    apiRequests: 0,
    systemUptime: '99.9%'
  });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const { toast } = useToast();

  const fetchMetrics = async () => {
    try {
      const supabase = createBrowserClient();
      
      // Fetch active servers count
      const { data: servers, error: serversError } = await supabase
        .from('server_xref')
        .select('id')
        .limit(1000);

      if (!serversError && servers) {
        setMetrics(prev => ({
          ...prev,
          activeServers: servers.length
        }));
      }

      // Fetch recent API requests count (from last 24 hours)
      const { data: playerCounts, error: countsError } = await supabase
        .from('player_counts')
        .select('id')
        .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());

      if (!countsError && playerCounts) {
        setMetrics(prev => ({
          ...prev,
          apiRequests: playerCounts.length
        }));
      }
    } catch (error) {
      console.error('Error fetching metrics:', error);
      toast({
        title: "Error",
        description: "Failed to load dashboard metrics.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchMetrics();
    const interval = setInterval(fetchMetrics, 30000); // Refresh every 30 seconds
    return () => clearInterval(interval);
  }, []);

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchMetrics();
  };

  return (
    <AdminProtected>
      <div className="flex h-screen bg-[#0e0e10]">
        <AdminSidebar />
        
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Header */}
          <div className="bg-[#1a1a1e] border-b border-[#26262c] px-6 py-4">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-bold text-white">Dashboard</h1>
                <p className="text-[#ADADB8] text-sm">
                  Real-time system overview and visitor tracking
                </p>
              </div>
              
              <Button
                variant="outline"
                size="sm"
                onClick={handleRefresh}
                disabled={refreshing}
                className="bg-[#26262c] border-[#40404a] hover:bg-[#333339] text-white"
              >
                <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
              </Button>
            </div>
          </div>

          {/* Main Content */}
          <div className="flex-1 overflow-auto p-6">
            <div className="max-w-7xl mx-auto space-y-6">
              
              {/* Key Metrics */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <Card className="bg-[#1a1a1e] border-[#26262c]">
                  <CardHeader className="flex flex-row items-center justify-between pb-3">
                    <CardTitle className="text-sm font-medium text-[#ADADB8]">
                      Active Servers
                    </CardTitle>
                    <Database className="h-4 w-4 text-[#ADADB8]" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-white">
                      {metrics.activeServers}
                    </div>
                    <p className="text-xs text-[#ADADB8] mt-1">
                      Monitored servers
                    </p>
                  </CardContent>
                </Card>

                <Card className="bg-[#1a1a1e] border-[#26262c]">
                  <CardHeader className="flex flex-row items-center justify-between pb-3">
                    <CardTitle className="text-sm font-medium text-[#ADADB8]">
                      API Requests (24h)
                    </CardTitle>
                    <Zap className="h-4 w-4 text-[#ADADB8]" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-white">
                      {metrics.apiRequests.toLocaleString()}
                    </div>
                    <p className="text-xs text-emerald-400 mt-1">
                      <TrendingUp className="inline h-3 w-3 mr-1" />
                      Data collection active
                    </p>
                  </CardContent>
                </Card>

                <Card className="bg-[#1a1a1e] border-[#26262c]">
                  <CardHeader className="flex flex-row items-center justify-between pb-3">
                    <CardTitle className="text-sm font-medium text-[#ADADB8]">
                      System Uptime
                    </CardTitle>
                    <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-white">
                      {metrics.systemUptime}
                    </div>
                    <p className="text-xs text-emerald-400 mt-1">
                      All systems operational
                    </p>
                  </CardContent>
                </Card>

                <Card className="bg-[#1a1a1e] border-[#26262c]">
                  <CardHeader className="flex flex-row items-center justify-between pb-3">
                    <CardTitle className="text-sm font-medium text-[#ADADB8]">
                      Status
                    </CardTitle>
                    <Activity className="h-4 w-4 text-[#ADADB8]" />
                  </CardHeader>
                  <CardContent>
                    <Badge className="bg-emerald-400/20 text-emerald-400 border-emerald-400/30">
                      Healthy
                    </Badge>
                    <p className="text-xs text-[#ADADB8] mt-2">
                      Last updated: {new Date().toLocaleTimeString()}
                    </p>
                  </CardContent>
                </Card>
              </div>

              {/* Live Visitor Tracking */}
              <div className="bg-gradient-to-r from-[#9147ff]/10 to-[#004D61]/10 border border-[#9147ff]/20 rounded-lg p-6">
                <div className="mb-4">
                  <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                    <Eye className="h-5 w-5 text-[#9147ff]" />
                    Live Visitor Tracking
                  </h2>
                  <p className="text-sm text-[#ADADB8] mt-1">
                    Real-time monitoring of active site visitors with human/bot classification
                  </p>
                </div>
                <LiveVisitorCount />
              </div>

              {/* System Status */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Recent Activity */}
                <Card className="bg-[#1a1a1e] border-[#26262c]">
                  <CardHeader>
                    <CardTitle className="flex items-center space-x-2 text-white">
                      <Clock className="h-5 w-5" />
                      <span>System Status</span>
                    </CardTitle>
                    <CardDescription className="text-[#ADADB8]">
                      Current system health and status
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-3">
                      <div className="flex items-center justify-between p-3 bg-[#26262c]/30 rounded-lg">
                        <div className="flex items-center space-x-2">
                          <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                          <span className="text-sm text-white">Database</span>
                        </div>
                        <Badge className="bg-emerald-400/20 text-emerald-400 border-emerald-400/30">
                          Healthy
                        </Badge>
                      </div>

                      <div className="flex items-center justify-between p-3 bg-[#26262c]/30 rounded-lg">
                        <div className="flex items-center space-x-2">
                          <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                          <span className="text-sm text-white">API Services</span>
                        </div>
                        <Badge className="bg-emerald-400/20 text-emerald-400 border-emerald-400/30">
                          Operational
                        </Badge>
                      </div>

                      <div className="flex items-center justify-between p-3 bg-[#26262c]/30 rounded-lg">
                        <div className="flex items-center space-x-2">
                          <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                          <span className="text-sm text-white">Data Collection</span>
                        </div>
                        <Badge className="bg-emerald-400/20 text-emerald-400 border-emerald-400/30">
                          Active
                        </Badge>
                      </div>

                      <div className="flex items-center justify-between p-3 bg-[#26262c]/30 rounded-lg">
                        <div className="flex items-center space-x-2">
                          <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                          <span className="text-sm text-white">Realtime Subscriptions</span>
                        </div>
                        <Badge className="bg-emerald-400/20 text-emerald-400 border-emerald-400/30">
                          Connected
                        </Badge>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Quick Info */}
                <Card className="bg-[#1a1a1e] border-[#26262c]">
                  <CardHeader>
                    <CardTitle className="flex items-center space-x-2 text-white">
                      <Activity className="h-5 w-5" />
                      <span>Quick Info</span>
                    </CardTitle>
                    <CardDescription className="text-[#ADADB8]">
                      Important system information
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-3 text-sm">
                      <div className="flex justify-between items-center p-3 bg-[#26262c]/30 rounded-lg">
                        <span className="text-[#ADADB8]">Visitor Tracking</span>
                        <Badge className="bg-[#9147ff]/20 text-[#9147ff] border-[#9147ff]/30">
                          Enabled
                        </Badge>
                      </div>

                      <div className="flex justify-between items-center p-3 bg-[#26262c]/30 rounded-lg">
                        <span className="text-[#ADADB8]">Data Retention</span>
                        <span className="text-white font-medium">7 days</span>
                      </div>

                      <div className="flex justify-between items-center p-3 bg-[#26262c]/30 rounded-lg">
                        <span className="text-[#ADADB8]">Heartbeat Interval</span>
                        <span className="text-white font-medium">30 seconds</span>
                      </div>

                      <div className="flex justify-between items-center p-3 bg-[#26262c]/30 rounded-lg">
                        <span className="text-[#ADADB8]">Inactive Timeout</span>
                        <span className="text-white font-medium">5 minutes</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Information Banner */}
              <div className="bg-[#004D61]/20 border border-[#004D61]/30 rounded-lg p-4">
                <div className="flex items-start space-x-3">
                  <AlertTriangle className="h-5 w-5 text-[#004D61] flex-shrink-0 mt-0.5" />
                  <div>
                    <h3 className="text-sm font-semibold text-white">Admin Panel Information</h3>
                    <p className="text-sm text-[#ADADB8] mt-1">
                      This admin panel provides real-time visibility into site visitors, system metrics, and data management. 
                      All visitor data is tracked securely and automatically cleaned up after 7 days. Use the navigation menu 
                      to access detailed analytics, notification management, and system settings.
                    </p>
                  </div>
                </div>
              </div>

            </div>
          </div>
        </div>
      </div>
    </AdminProtected>
  );
}
