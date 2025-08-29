"use client";

import { useState, useEffect } from 'react';
import { AdminProtected } from '@/components/admin-login';
import { AdminSidebar } from '@/components/admin/admin-sidebar';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  BarChart3, 
  Users, 
  Activity, 
  TrendingUp, 
  TrendingDown, 
  RefreshCw, 
  Download, 
  Calendar,
  Server,
  Eye,
  Clock,
  Zap,
  Globe,
  AlertTriangle
} from 'lucide-react';
import { adminAPI } from '@/lib/admin-api';
import { StreamAnalytics, APIUsageMetrics } from '@/lib/admin-types';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

export default function AdminAnalyticsPage() {
  const [streamAnalytics, setStreamAnalytics] = useState<StreamAnalytics[]>([]);
  const [apiMetrics, setApiMetrics] = useState<APIUsageMetrics[]>([]);
  const [userActivity, setUserActivity] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [selectedTimeRange, setSelectedTimeRange] = useState('7d');
  const [selectedServer, setSelectedServer] = useState<string>('all');
  const { toast } = useToast();

  const fetchAnalytics = async () => {
    try {
      setLoading(true);

      // Fetch stream analytics
      const streamResponse = await adminAPI.getStreamAnalytics(
        selectedServer === 'all' ? undefined : selectedServer, 
        selectedTimeRange
      );
      if (streamResponse.success && streamResponse.data) {
        setStreamAnalytics(streamResponse.data);
      }

      // Fetch API metrics
      const apiResponse = await adminAPI.getAPIUsageMetrics(selectedTimeRange);
      if (apiResponse.success && apiResponse.data) {
        setApiMetrics(apiResponse.data);
      }

      // Fetch user activity
      const userResponse = await adminAPI.getUserActivityMetrics(selectedTimeRange);
      if (userResponse.success && userResponse.data) {
        setUserActivity(userResponse.data);
      }

    } catch (error) {
      console.error('Error fetching analytics:', error);
      toast({
        title: "Error",
        description: "Failed to load analytics data. Please try again.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAnalytics();
  }, [selectedTimeRange, selectedServer]);

  const getChangeColor = (change: number) => {
    if (change > 0) return 'text-emerald-400';
    if (change < 0) return 'text-red-400';
    return 'text-[#ADADB8]';
  };

  const getChangeIcon = (change: number) => {
    if (change > 0) return <TrendingUp className="h-4 w-4" />;
    if (change < 0) return <TrendingDown className="h-4 w-4" />;
    return <Activity className="h-4 w-4" />;
  };

  const formatNumber = (num: number) => {
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
    if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
    return num.toString();
  };

  const getTotalViewers = () => streamAnalytics.reduce((sum, s) => sum + s.total_viewers, 0);
  const getTotalStreamers = () => streamAnalytics.reduce((sum, s) => sum + s.total_streamers, 0);
  const getAverageViewers = () => {
    const total = streamAnalytics.reduce((sum, s) => sum + s.average_viewers, 0);
    return streamAnalytics.length > 0 ? Math.round(total / streamAnalytics.length) : 0;
  };

  const getTopServer = () => {
    if (streamAnalytics.length === 0) return null;
    return streamAnalytics.reduce((prev, current) => 
      prev.total_viewers > current.total_viewers ? prev : current
    );
  };

  if (loading) {
    return (
      <AdminProtected>
        <div className="flex h-screen bg-[#0e0e10]">
          <AdminSidebar />
          <div className="flex-1 flex items-center justify-center">
            <div className="flex items-center space-x-2 text-white">
              <RefreshCw className="h-6 w-6 animate-spin" />
              <span>Loading analytics...</span>
            </div>
          </div>
        </div>
      </AdminProtected>
    );
  }

  return (
    <AdminProtected>
      <div className="flex h-screen bg-[#0e0e10]">
        <AdminSidebar />
        
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Header */}
          <div className="bg-[#1a1a1e] border-b border-[#26262c] px-6 py-4">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-bold text-white flex items-center">
                  <BarChart3 className="mr-3 h-6 w-6" />
                  Analytics Dashboard
                </h1>
                <p className="text-[#ADADB8] text-sm">
                  Monitor streaming metrics, API usage, and user activity
                </p>
              </div>
              
              <div className="flex items-center space-x-3">
                <Select value={selectedServer} onValueChange={setSelectedServer}>
                  <SelectTrigger className="w-48 bg-[#26262c] border-[#40404a] text-white">
                    <SelectValue placeholder="Select server" />
                  </SelectTrigger>
                  <SelectContent className="bg-[#26262c] border-[#40404a]">
                    <SelectItem value="all">All Servers</SelectItem>
                    {streamAnalytics.map((server) => (
                      <SelectItem key={server.server_id} value={server.server_id}>
                        {server.server_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select value={selectedTimeRange} onValueChange={setSelectedTimeRange}>
                  <SelectTrigger className="w-32 bg-[#26262c] border-[#40404a] text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-[#26262c] border-[#40404a]">
                    <SelectItem value="24h">24 Hours</SelectItem>
                    <SelectItem value="7d">7 Days</SelectItem>
                    <SelectItem value="30d">30 Days</SelectItem>
                    <SelectItem value="90d">90 Days</SelectItem>
                  </SelectContent>
                </Select>

                <Button
                  variant="outline"
                  onClick={fetchAnalytics}
                  className="bg-[#26262c] border-[#40404a] text-white hover:bg-[#333339]"
                >
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Refresh
                </Button>
              </div>
            </div>
          </div>

          {/* Main Content */}
          <div className="flex-1 overflow-auto p-6">
            <div className="max-w-7xl mx-auto space-y-6">
              
              {/* Key Metrics Overview */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <Card className="bg-[#1a1a1e] border-[#26262c]">
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-[#ADADB8]">Total Viewers</p>
                        <p className="text-2xl font-bold text-white">
                          {formatNumber(getTotalViewers())}
                        </p>
                      </div>
                      <Users className="h-8 w-8 text-[#9147ff]" />
                    </div>
                  </CardContent>
                </Card>

                <Card className="bg-[#1a1a1e] border-[#26262c]">
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-[#ADADB8]">Active Streamers</p>
                        <p className="text-2xl font-bold text-emerald-400">
                          {getTotalStreamers()}
                        </p>
                      </div>
                      <Activity className="h-8 w-8 text-emerald-400" />
                    </div>
                  </CardContent>
                </Card>

                <Card className="bg-[#1a1a1e] border-[#26262c]">
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-[#ADADB8]">Avg Viewers</p>
                        <p className="text-2xl font-bold text-blue-400">
                          {formatNumber(getAverageViewers())}
                        </p>
                      </div>
                      <Eye className="h-8 w-8 text-blue-400" />
                    </div>
                  </CardContent>
                </Card>

                <Card className="bg-[#1a1a1e] border-[#26262c]">
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-[#ADADB8]">API Requests</p>
                        <p className="text-2xl font-bold text-amber-400">
                          {formatNumber(apiMetrics.reduce((sum, m) => sum + m.total_requests, 0))}
                        </p>
                      </div>
                      <Zap className="h-8 w-8 text-amber-400" />
                    </div>
                  </CardContent>
                </Card>
              </div>

              <Tabs defaultValue="streaming" className="w-full">
                <TabsList className="grid w-full grid-cols-3 bg-[#26262c]">
                  <TabsTrigger value="streaming" className="text-white">Streaming Analytics</TabsTrigger>
                  <TabsTrigger value="api" className="text-white">API Performance</TabsTrigger>
                  <TabsTrigger value="users" className="text-white">User Activity</TabsTrigger>
                </TabsList>

                {/* Streaming Analytics */}
                <TabsContent value="streaming" className="space-y-6">
                  {/* Server Performance */}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {streamAnalytics.map((server) => (
                      <Card key={server.server_id} className="bg-[#1a1a1e] border-[#26262c]">
                        <CardHeader>
                          <div className="flex items-center justify-between">
                            <div>
                              <CardTitle className="text-white">{server.server_name}</CardTitle>
                              <CardDescription className="text-[#ADADB8]">
                                Stream performance metrics
                              </CardDescription>
                            </div>
                            {getTopServer()?.server_id === server.server_id && (
                              <Badge className="bg-[#9147ff] text-white">Top Server</Badge>
                            )}
                          </div>
                        </CardHeader>
                        <CardContent className="space-y-4">
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <p className="text-sm text-[#ADADB8]">Total Streamers</p>
                              <div className="flex items-center space-x-2">
                                <p className="text-lg font-bold text-white">{server.total_streamers}</p>
                                <div className={cn("flex items-center text-xs", getChangeColor(server.growth_metrics.streamers_change))}>
                                  {getChangeIcon(server.growth_metrics.streamers_change)}
                                  <span className="ml-1">
                                    {server.growth_metrics.streamers_change > 0 ? '+' : ''}
                                    {server.growth_metrics.streamers_change}%
                                  </span>
                                </div>
                              </div>
                            </div>
                            
                            <div>
                              <p className="text-sm text-[#ADADB8]">Total Viewers</p>
                              <div className="flex items-center space-x-2">
                                <p className="text-lg font-bold text-white">{server.total_viewers.toLocaleString()}</p>
                                <div className={cn("flex items-center text-xs", getChangeColor(server.growth_metrics.viewers_change))}>
                                  {getChangeIcon(server.growth_metrics.viewers_change)}
                                  <span className="ml-1">
                                    {server.growth_metrics.viewers_change > 0 ? '+' : ''}
                                    {server.growth_metrics.viewers_change}%
                                  </span>
                                </div>
                              </div>
                            </div>
                            
                            <div>
                              <p className="text-sm text-[#ADADB8]">Peak Viewers</p>
                              <p className="text-lg font-bold text-emerald-400">{server.peak_viewers.toLocaleString()}</p>
                            </div>
                            
                            <div>
                              <p className="text-sm text-[#ADADB8]">Avg Viewers</p>
                              <p className="text-lg font-bold text-blue-400">{server.average_viewers.toLocaleString()}</p>
                            </div>
                          </div>

                          {/* Top Streamers */}
                          {server.top_streamers.length > 0 && (
                            <div>
                              <p className="text-sm text-[#ADADB8] mb-2">Top Streamers</p>
                              <div className="space-y-2">
                                {server.top_streamers.slice(0, 3).map((streamer, idx) => (
                                  <div key={idx} className="flex items-center justify-between text-sm">
                                    <span className="text-white">{streamer.name}</span>
                                    <div className="flex items-center space-x-2">
                                      <span className="text-[#ADADB8]">{streamer.viewers.toLocaleString()}</span>
                                      <span className="text-[#ADADB8]">viewers</span>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </TabsContent>

                {/* API Performance */}
                <TabsContent value="api" className="space-y-6">
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {apiMetrics.map((metric) => (
                      <Card key={`${metric.endpoint}-${metric.method}`} className="bg-[#1a1a1e] border-[#26262c]">
                        <CardHeader>
                          <div className="flex items-center justify-between">
                            <div>
                              <CardTitle className="text-sm text-white">
                                {metric.method} {metric.endpoint}
                              </CardTitle>
                              <CardDescription className="text-[#ADADB8]">
                                API endpoint performance metrics
                              </CardDescription>
                            </div>
                            <Badge 
                              variant="outline" 
                              className={cn(
                                "border",
                                metric.success_rate >= 95 ? "border-emerald-400/30 text-emerald-400 bg-emerald-400/10" :
                                metric.success_rate >= 90 ? "border-amber-400/30 text-amber-400 bg-amber-400/10" :
                                "border-red-400/30 text-red-400 bg-red-400/10"
                              )}
                            >
                              {metric.success_rate}% Success
                            </Badge>
                          </div>
                        </CardHeader>
                        <CardContent className="space-y-4">
                          <div className="grid grid-cols-2 gap-4 text-sm">
                            <div>
                              <p className="text-[#ADADB8]">Total Requests</p>
                              <p className="text-lg font-bold text-white">{metric.total_requests.toLocaleString()}</p>
                            </div>
                            
                            <div>
                              <p className="text-[#ADADB8]">Avg Response Time</p>
                              <p className="text-lg font-bold text-blue-400">{metric.average_response_time}ms</p>
                            </div>
                            
                            <div>
                              <p className="text-[#ADADB8]">Errors (24h)</p>
                              <p className="text-lg font-bold text-red-400">{metric.errors_24h}</p>
                            </div>
                            
                            <div>
                              <p className="text-[#ADADB8]">Last Accessed</p>
                              <p className="text-sm text-[#ADADB8]">
                                {new Date(metric.last_accessed).toLocaleString()}
                              </p>
                            </div>
                          </div>

                          <div>
                            <div className="flex items-center justify-between text-sm mb-1">
                              <span className="text-[#ADADB8]">Success Rate</span>
                              <span className="text-white">{metric.success_rate}%</span>
                            </div>
                            <Progress 
                              value={metric.success_rate} 
                              className="h-2 bg-[#26262c]"
                            />
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </TabsContent>

                {/* User Activity */}
                <TabsContent value="users" className="space-y-6">
                  {userActivity ? (
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                      <Card className="bg-[#1a1a1e] border-[#26262c]">
                        <CardHeader>
                          <CardTitle className="text-white flex items-center">
                            <Globe className="mr-2 h-5 w-5" />
                            Page Views
                          </CardTitle>
                          <CardDescription className="text-[#ADADB8]">
                            Website traffic and engagement
                          </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                          <div>
                            <p className="text-2xl font-bold text-white">
                              {userActivity.page_views?.toLocaleString() || '0'}
                            </p>
                            <p className="text-sm text-[#ADADB8]">Total page views</p>
                          </div>
                          <div>
                            <p className="text-lg font-bold text-blue-400">
                              {userActivity.unique_visitors?.toLocaleString() || '0'}
                            </p>
                            <p className="text-sm text-[#ADADB8]">Unique visitors</p>
                          </div>
                          <div>
                            <p className="text-lg font-bold text-emerald-400">
                              {userActivity.bounce_rate ? `${userActivity.bounce_rate}%` : 'N/A'}
                            </p>
                            <p className="text-sm text-[#ADADB8]">Bounce rate</p>
                          </div>
                        </CardContent>
                      </Card>

                      <Card className="bg-[#1a1a1e] border-[#26262c]">
                        <CardHeader>
                          <CardTitle className="text-white flex items-center">
                            <Clock className="mr-2 h-5 w-5" />
                            Engagement
                          </CardTitle>
                          <CardDescription className="text-[#ADADB8]">
                            User interaction metrics
                          </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                          <div>
                            <p className="text-2xl font-bold text-white">
                              {userActivity.avg_session_duration || '0m'}
                            </p>
                            <p className="text-sm text-[#ADADB8]">Avg session duration</p>
                          </div>
                          <div>
                            <p className="text-lg font-bold text-amber-400">
                              {userActivity.pages_per_session?.toFixed(1) || '0'}
                            </p>
                            <p className="text-sm text-[#ADADB8]">Pages per session</p>
                          </div>
                          <div>
                            <p className="text-lg font-bold text-purple-400">
                              {userActivity.return_visitors_rate ? `${userActivity.return_visitors_rate}%` : 'N/A'}
                            </p>
                            <p className="text-sm text-[#ADADB8]">Return visitor rate</p>
                          </div>
                        </CardContent>
                      </Card>

                      <Card className="bg-[#1a1a1e] border-[#26262c]">
                        <CardHeader>
                          <CardTitle className="text-white flex items-center">
                            <TrendingUp className="mr-2 h-5 w-5" />
                            Growth
                          </CardTitle>
                          <CardDescription className="text-[#ADADB8]">
                            Growth metrics and trends
                          </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                          <div>
                            <div className="flex items-center space-x-2">
                              <p className="text-2xl font-bold text-white">
                                {userActivity.growth_rate ? `${userActivity.growth_rate > 0 ? '+' : ''}${userActivity.growth_rate}%` : '0%'}
                              </p>
                              {userActivity.growth_rate && (
                                <div className={getChangeColor(userActivity.growth_rate)}>
                                  {getChangeIcon(userActivity.growth_rate)}
                                </div>
                              )}
                            </div>
                            <p className="text-sm text-[#ADADB8]">User growth rate</p>
                          </div>
                          <div>
                            <p className="text-lg font-bold text-emerald-400">
                              {userActivity.new_users_rate ? `${userActivity.new_users_rate}%` : 'N/A'}
                            </p>
                            <p className="text-sm text-[#ADADB8]">New users rate</p>
                          </div>
                        </CardContent>
                      </Card>
                    </div>
                  ) : (
                    <Card className="bg-[#1a1a1e] border-[#26262c]">
                      <CardContent className="p-8">
                        <div className="text-center">
                          <AlertTriangle className="h-12 w-12 text-[#ADADB8] mx-auto mb-4" />
                          <h3 className="text-lg font-medium text-white mb-2">No User Activity Data</h3>
                          <p className="text-[#ADADB8] mb-4">
                            User activity tracking is not configured or no data is available for the selected time period.
                          </p>
                          <Button
                            variant="outline"
                            onClick={fetchAnalytics}
                            className="bg-[#26262c] border-[#40404a] text-white hover:bg-[#333339]"
                          >
                            <RefreshCw className="h-4 w-4 mr-2" />
                            Retry Loading
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
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