"use client";

import { useState, useEffect } from 'react';
import { AdminProtected } from '@/components/admin-login';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Activity, 
  AlertTriangle, 
  Database, 
  Server, 
  Users, 
  BarChart3, 
  Shield, 
  RefreshCw,
  TrendingUp,
  Clock,
  AlertCircle,
  CheckCircle2,
  XCircle
} from 'lucide-react';
import { AdminSidebar } from '@/components/admin/admin-sidebar';
import { SystemMetricsCard } from '@/components/admin/system-metrics-card';
import { RecentActivitiesCard } from '@/components/admin/recent-activities-card';
import { SystemHealthCard } from '@/components/admin/system-health-card';
import { QuickActionsCard } from '@/components/admin/quick-actions-card';
import { AlertsCard } from '@/components/admin/alerts-card';
import { adminAPI } from '@/lib/admin-api';
import { AdminDashboardData, SystemAlert } from '@/lib/admin-types';
import { useToast } from '@/hooks/use-toast';

export default function AdminDashboard() {
  const [dashboardData, setDashboardData] = useState<AdminDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const { toast } = useToast();

  const fetchDashboardData = async () => {
    try {
      const response = await adminAPI.getDashboardData();
      if (response.success && response.data) {
        setDashboardData(response.data);
      } else {
        throw new Error(response.error || 'Failed to fetch dashboard data');
      }
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
      toast({
        title: "Error",
        description: "Failed to load dashboard data. Please try again.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
    
    // Set up auto-refresh every 30 seconds
    const interval = setInterval(fetchDashboardData, 30000);
    return () => clearInterval(interval);
  }, []);

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchDashboardData();
  };

  if (loading) {
    return (
      <AdminProtected>
        <div className="flex h-screen bg-[#0e0e10]">
          <AdminSidebar />
          <div className="flex-1 flex items-center justify-center">
            <div className="flex items-center space-x-2 text-white">
              <RefreshCw className="h-6 w-6 animate-spin" />
              <span>Loading admin dashboard...</span>
            </div>
          </div>
        </div>
      </AdminProtected>
    );
  }

  const criticalAlerts = dashboardData?.alerts.filter(alert => 
    alert.severity === 'critical' && !alert.resolved
  ) || [];

  const systemHealthStatus = dashboardData?.system_health || {
    database: 'healthy',
    api: 'healthy',
    data_collection: 'healthy'
  };

  const getHealthIcon = (status: string) => {
    switch (status) {
      case 'healthy': return <CheckCircle2 className="h-4 w-4 text-emerald-400" />;
      case 'warning': return <AlertTriangle className="h-4 w-4 text-amber-400" />;
      case 'critical': return <XCircle className="h-4 w-4 text-red-400" />;
      default: return <AlertCircle className="h-4 w-4 text-gray-400" />;
    }
  };

  const getHealthColor = (status: string) => {
    switch (status) {
      case 'healthy': return 'text-emerald-400';
      case 'warning': return 'text-amber-400';
      case 'critical': return 'text-red-400';
      default: return 'text-gray-400';
    }
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
                <h1 className="text-2xl font-bold text-white">Admin Dashboard</h1>
                <p className="text-[#ADADB8] text-sm">
                  System overview and management console
                </p>
              </div>
              
              <div className="flex items-center space-x-3">
                {/* Critical Alerts Indicator */}
                {criticalAlerts.length > 0 && (
                  <Badge variant="destructive" className="flex items-center space-x-1">
                    <AlertTriangle className="h-3 w-3" />
                    <span>{criticalAlerts.length} Critical Alert{criticalAlerts.length !== 1 ? 's' : ''}</span>
                  </Badge>
                )}
                
                {/* System Health Indicator */}
                <div className="flex items-center space-x-2 bg-[#26262c] px-3 py-2 rounded-lg">
                  <div className="flex items-center space-x-1">
                    {getHealthIcon(systemHealthStatus.database)}
                    <span className="text-xs text-[#ADADB8]">DB</span>
                  </div>
                  <div className="flex items-center space-x-1">
                    {getHealthIcon(systemHealthStatus.api)}
                    <span className="text-xs text-[#ADADB8]">API</span>
                  </div>
                  <div className="flex items-center space-x-1">
                    {getHealthIcon(systemHealthStatus.data_collection)}
                    <span className="text-xs text-[#ADADB8]">Data</span>
                  </div>
                </div>
                
                {/* Refresh Button */}
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
          </div>

          {/* Main Content */}
          <div className="flex-1 overflow-auto p-6">
            <div className="max-w-7xl mx-auto space-y-6">
              
              {/* Critical Alerts Banner */}
              {criticalAlerts.length > 0 && (
                <div className="bg-red-900/20 border border-red-800/50 rounded-lg p-4">
                  <div className="flex items-center space-x-2 mb-2">
                    <AlertTriangle className="h-5 w-5 text-red-400" />
                    <h3 className="text-red-400 font-semibold">Critical System Alerts</h3>
                  </div>
                  <div className="space-y-2">
                    {criticalAlerts.slice(0, 3).map((alert) => (
                      <div key={alert.id} className="text-sm text-red-300">
                        <span className="font-medium">{alert.title}</span>: {alert.message}
                      </div>
                    ))}
                    {criticalAlerts.length > 3 && (
                      <div className="text-sm text-red-400">
                        ...and {criticalAlerts.length - 3} more alerts
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* System Metrics Overview */}
              {dashboardData?.metrics && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                  <Card className="bg-[#1a1a1e] border-[#26262c]">
                    <CardHeader className="flex flex-row items-center justify-between pb-3">
                      <CardTitle className="text-sm font-medium text-[#ADADB8]">
                        Total Servers
                      </CardTitle>
                      <Server className="h-4 w-4 text-[#ADADB8]" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold text-white">
                        {dashboardData.metrics.total_servers}
                      </div>
                      <p className="text-xs text-[#ADADB8] mt-1">
                        Active monitoring targets
                      </p>
                    </CardContent>
                  </Card>

                  <Card className="bg-[#1a1a1e] border-[#26262c]">
                    <CardHeader className="flex flex-row items-center justify-between pb-3">
                      <CardTitle className="text-sm font-medium text-[#ADADB8]">
                        Players Today
                      </CardTitle>
                      <Users className="h-4 w-4 text-[#ADADB8]" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold text-white">
                        {dashboardData.metrics.total_players_today.toLocaleString()}
                      </div>
                      <p className="text-xs text-emerald-400 mt-1">
                        <TrendingUp className="inline h-3 w-3 mr-1" />
                        Active player sessions
                      </p>
                    </CardContent>
                  </Card>

                  <Card className="bg-[#1a1a1e] border-[#26262c]">
                    <CardHeader className="flex flex-row items-center justify-between pb-3">
                      <CardTitle className="text-sm font-medium text-[#ADADB8]">
                        API Requests
                      </CardTitle>
                      <Activity className="h-4 w-4 text-[#ADADB8]" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold text-white">
                        {dashboardData.metrics.api_requests_today.toLocaleString()}
                      </div>
                      <p className="text-xs text-[#ADADB8] mt-1">
                        {dashboardData.metrics.error_rate}% error rate
                      </p>
                    </CardContent>
                  </Card>

                  <Card className="bg-[#1a1a1e] border-[#26262c]">
                    <CardHeader className="flex flex-row items-center justify-between pb-3">
                      <CardTitle className="text-sm font-medium text-[#ADADB8]">
                        Data Points
                      </CardTitle>
                      <Database className="h-4 w-4 text-[#ADADB8]" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold text-white">
                        {(dashboardData.metrics.total_data_points / 1000000).toFixed(1)}M
                      </div>
                      <p className="text-xs text-[#ADADB8] mt-1">
                        Historical records
                      </p>
                    </CardContent>
                  </Card>
                </div>
              )}

              {/* Main Dashboard Sections */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                
                {/* System Health */}
                <Card className="bg-[#1a1a1e] border-[#26262c]">
                  <CardHeader>
                    <CardTitle className="flex items-center space-x-2 text-white">
                      <Shield className="h-5 w-5" />
                      <span>System Health</span>
                    </CardTitle>
                    <CardDescription className="text-[#ADADB8]">
                      Real-time system status monitoring
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-2">
                          {getHealthIcon(systemHealthStatus.database)}
                          <span className="text-sm text-white">Database</span>
                        </div>
                        <Badge 
                          variant="outline" 
                          className={`${getHealthColor(systemHealthStatus.database)} border-current`}
                        >
                          {systemHealthStatus.database}
                        </Badge>
                      </div>

                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-2">
                          {getHealthIcon(systemHealthStatus.api)}
                          <span className="text-sm text-white">API Services</span>
                        </div>
                        <Badge 
                          variant="outline" 
                          className={`${getHealthColor(systemHealthStatus.api)} border-current`}
                        >
                          {systemHealthStatus.api}
                        </Badge>
                      </div>

                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-2">
                          {getHealthIcon(systemHealthStatus.data_collection)}
                          <span className="text-sm text-white">Data Collection</span>
                        </div>
                        <Badge 
                          variant="outline" 
                          className={`${getHealthColor(systemHealthStatus.data_collection)} border-current`}
                        >
                          {systemHealthStatus.data_collection}
                        </Badge>
                      </div>
                    </div>

                    {dashboardData?.metrics && (
                      <div className="pt-4 border-t border-[#26262c]">
                        <div className="space-y-2">
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-[#ADADB8]">System Uptime</span>
                            <span className="text-white">{dashboardData.metrics.system_uptime}</span>
                          </div>
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-[#ADADB8]">Database Size</span>
                            <span className="text-white">{dashboardData.metrics.database_size}</span>
                          </div>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Quick Actions */}
                <Card className="bg-[#1a1a1e] border-[#26262c]">
                  <CardHeader>
                    <CardTitle className="flex items-center space-x-2 text-white">
                      <Activity className="h-5 w-5" />
                      <span>Quick Actions</span>
                    </CardTitle>
                    <CardDescription className="text-[#ADADB8]">
                      Common administrative tasks
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <QuickActionsCard onAction={fetchDashboardData} />
                  </CardContent>
                </Card>

                {/* Recent Activities */}
                <Card className="bg-[#1a1a1e] border-[#26262c]">
                  <CardHeader>
                    <CardTitle className="flex items-center space-x-2 text-white">
                      <Clock className="h-5 w-5" />
                      <span>Recent Activities</span>
                    </CardTitle>
                    <CardDescription className="text-[#ADADB8]">
                      Latest system events and admin actions
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <RecentActivitiesCard activities={dashboardData?.recent_activities || []} />
                  </CardContent>
                </Card>
              </div>

              {/* System Alerts */}
              {dashboardData?.alerts && dashboardData.alerts.length > 0 && (
                <AlertsCard 
                  alerts={dashboardData.alerts} 
                  onAlertUpdate={fetchDashboardData}
                />
              )}

            </div>
          </div>
        </div>
      </div>
    </AdminProtected>
  );
}