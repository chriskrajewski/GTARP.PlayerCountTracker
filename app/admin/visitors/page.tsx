"use client";

import { useState, useEffect } from 'react';
import { AdminProtected } from '@/components/admin-login-supabase';
import { AdminSidebarMobile } from '@/components/admin/admin-sidebar-mobile';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { VisitorDetailModal } from '@/components/admin/visitor-detail-modal';
import { 
  Users, 
  TrendingUp, 
  Download,
  Filter,
  Calendar,
  Clock,
  Activity,
  Bot,
  User as UserIcon,
  Globe,
  Smartphone,
  Monitor,
  Zap,
  AlertCircle,
  RefreshCw,
  BarChart3,
  PieChart,
  Gauge,
  ChevronRight,
  Menu,
  X
} from 'lucide-react';
import { createBrowserClient } from '@/lib/supabase-browser';
import { useToast } from '@/hooks/use-toast';
import { format, subDays } from 'date-fns';

/**
 * Enhanced Visitor Analytics Page
 * 
 * Comprehensive visitor tracking with detailed analytics
 * Source: PRD §4.1 FR-2, FR-8; Blueprint §5.1
 */

interface VisitorSession {
  session_id: string;
  created_at: string;
  last_heartbeat: string;
  is_active: boolean;
  is_bot: boolean;
  device_type?: string;
  browser_name?: string;
  browser_version?: string;
  os_name?: string;
  os_version?: string;
  country?: string;
  region?: string;
  city?: string;
  timezone?: string;
  language?: string;
  referrer?: string;
  landing_page?: string;
  current_page?: string;
  pages_visited?: number;
  session_duration_seconds?: number;
  engagement_score?: number;
  is_returning?: boolean;
  previous_visit_count?: number;
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  utm_content?: string;
  utm_term?: string;
  screen_resolution?: string;
  viewport_size?: string;
  connection_type?: string;
  connection_speed_mbps?: number;
  page_load_time_ms?: number;
  first_contentful_paint_ms?: number;
  largest_contentful_paint_ms?: number;
  cumulative_layout_shift?: number;
  time_to_interactive_ms?: number;
  error_count?: number;
  time_on_site_seconds?: number;
  scroll_depth_percent?: number;
  clicks_count?: number;
  form_interactions?: number;
  user_agent?: string;
}

interface AnalyticsMetrics {
  totalVisitors: number;
  activeVisitors: number;
  humanVisitors: number;
  botVisitors: number;
  returningVisitors: number;
  avgEngagementScore: number;
  avgSessionDuration: number;
  avgPageLoadTime: number;
  totalErrors: number;
}

export default function EnhancedVisitorAnalyticsPage() {
  const [visitors, setVisitors] = useState<VisitorSession[]>([]);
  const [metrics, setMetrics] = useState<AnalyticsMetrics>({
    totalVisitors: 0,
    activeVisitors: 0,
    humanVisitors: 0,
    botVisitors: 0,
    returningVisitors: 0,
    avgEngagementScore: 0,
    avgSessionDuration: 0,
    avgPageLoadTime: 0,
    totalErrors: 0
  });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [timeRange, setTimeRange] = useState('24h');
  const [filterDevice, setFilterDevice] = useState('all');
  const [filterBrowser, setFilterBrowser] = useState('all');
  const [filterCountry, setFilterCountry] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [selectedSession, setSelectedSession] = useState<VisitorSession | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const { toast } = useToast();

  const fetchVisitorData = async () => {
    try {
      const supabase = createBrowserClient();
      
      // Calculate date range
      let startDate = new Date();
      if (timeRange === '24h') startDate = subDays(new Date(), 1);
      else if (timeRange === '7d') startDate = subDays(new Date(), 7);
      else if (timeRange === '30d') startDate = subDays(new Date(), 30);

      // Fetch visitor sessions with all details
      const { data: sessions, error: sessionsError } = await supabase
        .from('visitor_sessions')
        .select('*')
        .gte('created_at', startDate.toISOString())
        .order('created_at', { ascending: false });

      if (sessionsError) {
        throw sessionsError;
      }

      if (sessions) {
        setVisitors(sessions);

        // Calculate metrics
        const activeCount = sessions.filter(s => s.is_active).length;
        const humanCount = sessions.filter(s => !s.is_bot).length;
        const botCount = sessions.filter(s => s.is_bot).length;
        const returningCount = sessions.filter(s => s.is_returning).length;
        const avgEngagement = sessions.length > 0 
          ? Math.round(sessions.reduce((sum, s) => sum + (s.engagement_score || 0), 0) / sessions.length)
          : 0;
        const avgDuration = sessions.length > 0
          ? Math.round(sessions.reduce((sum, s) => sum + (s.session_duration_seconds || 0), 0) / sessions.length)
          : 0;
        const avgLoadTime = sessions.filter(s => s.page_load_time_ms).length > 0
          ? Math.round(sessions.filter(s => s.page_load_time_ms).reduce((sum, s) => sum + (s.page_load_time_ms || 0), 0) / sessions.filter(s => s.page_load_time_ms).length)
          : 0;
        const totalErrors = sessions.reduce((sum, s) => sum + (s.error_count || 0), 0);

        setMetrics({
          totalVisitors: sessions.length,
          activeVisitors: activeCount,
          humanVisitors: humanCount,
          botVisitors: botCount,
          returningVisitors: returningCount,
          avgEngagementScore: avgEngagement,
          avgSessionDuration: avgDuration,
          avgPageLoadTime: avgLoadTime,
          totalErrors: totalErrors
        });
      }
    } catch (error) {
      console.error('Error fetching visitor data:', error);
      toast({
        title: "Error",
        description: "Failed to load visitor analytics.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchVisitorData();
  }, [timeRange]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchVisitorData();
  };

  const handleExport = async () => {
    try {
      const csvContent = [
        ['Session ID', 'Created', 'Device', 'Browser', 'OS', 'Country', 'Pages', 'Duration (s)', 'Engagement', 'Returning', 'Load Time (ms)', 'Errors'],
        ...visitors.map(v => [
          v.session_id,
          format(new Date(v.created_at), 'yyyy-MM-dd HH:mm:ss'),
          v.device_type || 'N/A',
          v.browser_name || 'N/A',
          v.os_name || 'N/A',
          v.country || 'N/A',
          v.pages_visited || 0,
          v.session_duration_seconds || 0,
          v.engagement_score || 0,
          v.is_returning ? 'Yes' : 'No',
          v.page_load_time_ms || 'N/A',
          v.error_count || 0
        ])
      ]
        .map(row => row.join(','))
        .join('\n');

      const blob = new Blob([csvContent], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `visitor-analytics-detailed-${format(new Date(), 'yyyy-MM-dd')}.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast({
        title: "Success",
        description: "Visitor data exported successfully.",
      });
    } catch (error) {
      console.error('Export error:', error);
      toast({
        title: "Error",
        description: "Failed to export visitor data.",
        variant: "destructive"
      });
    }
  };

  // Get unique values for filters
  const uniqueDevices = [...new Set(visitors.map(v => v.device_type).filter(Boolean))];
  const uniqueBrowsers = [...new Set(visitors.map(v => v.browser_name).filter(Boolean))];
  const uniqueCountries = [...new Set(visitors.map(v => v.country).filter(Boolean))];

  // Filter visitors
  const filteredVisitors = visitors.filter(v => {
    const matchesDevice = filterDevice === 'all' || v.device_type === filterDevice;
    const matchesBrowser = filterBrowser === 'all' || v.browser_name === filterBrowser;
    const matchesCountry = filterCountry === 'all' || v.country === filterCountry;
    const matchesSearch = searchQuery === '' || 
      v.session_id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      v.browser_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      v.country?.toLowerCase().includes(searchQuery.toLowerCase());
    
    return matchesDevice && matchesBrowser && matchesCountry && matchesSearch;
  });

  return (
    <AdminProtected>
      <div className="flex h-screen bg-[#0e0e10] flex-col md:flex-row">
        {/* Mobile Sidebar Overlay */}
        {sidebarOpen && (
          <div 
            className="fixed inset-0 bg-black/50 z-40 md:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}
        
        {/* Sidebar */}
        <div className={`fixed md:relative w-64 h-screen z-50 md:z-auto transition-transform duration-300 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
        }`}>
          <AdminSidebarMobile />
        </div>
        
        <div className="flex-1 flex flex-col overflow-hidden w-full">
          {/* Header */}
          <div className="bg-[#1a1a1e] border-b border-[#26262c] px-4 md:px-6 py-4">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3 min-w-0">
                <Button
                  onClick={() => setSidebarOpen(!sidebarOpen)}
                  variant="ghost"
                  size="icon"
                  className="md:hidden text-white hover:bg-[#26262c]"
                >
                  {sidebarOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
                </Button>
                <div className="min-w-0">
                  <h1 className="text-lg md:text-2xl font-bold text-white flex items-center gap-2 truncate">
                    <Users className="h-5 md:h-6 w-5 md:w-6 flex-shrink-0" />
                    <span className="truncate">Visitor Analytics</span>
                  </h1>
                  <p className="text-[#ADADB8] text-xs md:text-sm hidden sm:block">
                    Comprehensive visitor tracking
                  </p>
                </div>
              </div>
              
              <div className="flex items-center space-x-2">
                <Button
                  onClick={handleExport}
                  variant="outline"
                  size="sm"
                  className="bg-[#26262c] border-[#40404a] text-white hover:bg-[#333339] hidden sm:flex"
                >
                  <Download className="h-4 w-4 mr-2" />
                  Export
                </Button>
                <Button
                  onClick={handleExport}
                  variant="outline"
                  size="icon"
                  className="bg-[#26262c] border-[#40404a] text-white hover:bg-[#333339] sm:hidden"
                  title="Export"
                >
                  <Download className="h-4 w-4" />
                </Button>
                <Button
                  onClick={handleRefresh}
                  disabled={refreshing}
                  variant="outline"
                  size="icon"
                  className="bg-[#26262c] border-[#40404a] text-white hover:bg-[#333339]"
                >
                  <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
                </Button>
              </div>
            </div>
          </div>

          {/* Main Content */}
          <div className="flex-1 overflow-auto p-3 md:p-6">
            <div className="max-w-7xl mx-auto space-y-4 md:space-y-6">
              
              {/* Key Metrics */}
              <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-4 gap-2 md:gap-4">
                <Card className="bg-[#1a1a1e] border-[#26262c]">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-xs font-medium text-[#ADADB8]">
                      Total Visitors
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-xl md:text-2xl font-bold text-white">
                      {metrics.totalVisitors.toLocaleString()}
                    </div>
                  </CardContent>
                </Card>

                <Card className="bg-[#1a1a1e] border-[#26262c]">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-xs font-medium text-[#ADADB8]">
                      Avg Engagement
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-xl md:text-2xl font-bold text-emerald-400">
                      {metrics.avgEngagementScore}/100
                    </div>
                  </CardContent>
                </Card>

                <Card className="bg-[#1a1a1e] border-[#26262c]">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-xs font-medium text-[#ADADB8]">
                      Avg Duration
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-xl md:text-2xl font-bold text-blue-400">
                      {Math.floor(metrics.avgSessionDuration / 60)}m
                    </div>
                  </CardContent>
                </Card>

                <Card className="bg-[#1a1a1e] border-[#26262c]">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-xs font-medium text-[#ADADB8]">
                      Avg Load
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-xl md:text-2xl font-bold text-purple-400">
                      {metrics.avgPageLoadTime}ms
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Additional Metrics */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-2 md:gap-4">
                <Card className="bg-[#1a1a1e] border-[#26262c]">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-xs font-medium text-[#ADADB8]">
                      Active Visitors
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-xl md:text-2xl font-bold text-emerald-400">
                      {metrics.activeVisitors}
                    </div>
                    <p className="text-xs text-[#ADADB8] mt-1">
                      {metrics.humanVisitors} humans, {metrics.botVisitors} bots
                    </p>
                  </CardContent>
                </Card>

                <Card className="bg-[#1a1a1e] border-[#26262c]">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-xs font-medium text-[#ADADB8]">
                      Returning Visitors
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-xl md:text-2xl font-bold text-blue-400">
                      {metrics.returningVisitors}
                    </div>
                    <p className="text-xs text-[#ADADB8] mt-1">
                      {metrics.totalVisitors > 0 ? Math.round((metrics.returningVisitors / metrics.totalVisitors) * 100) : 0}% of total
                    </p>
                  </CardContent>
                </Card>

                <Card className="bg-[#1a1a1e] border-[#26262c]">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-xs font-medium text-[#ADADB8]">
                      Total Errors
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-xl md:text-2xl font-bold text-red-400">
                      {metrics.totalErrors}
                    </div>
                    <p className="text-xs text-[#ADADB8] mt-1">
                      JavaScript errors tracked
                    </p>
                  </CardContent>
                </Card>
              </div>

              {/* Filters */}
              <div className="bg-[#1a1a1e] border border-[#26262c] rounded-lg p-3 md:p-4">
                <div className="flex items-center justify-between mb-3 md:mb-0">
                  <div className="flex items-center gap-2">
                    <Filter className="h-4 w-4 text-[#ADADB8]" />
                    <Label className="text-white text-sm md:text-base">Filters:</Label>
                  </div>
                  <Button
                    onClick={() => setShowFilters(!showFilters)}
                    variant="ghost"
                    size="sm"
                    className="md:hidden text-[#ADADB8] hover:text-white"
                  >
                    {showFilters ? 'Hide' : 'Show'}
                  </Button>
                </div>

                <div className={`grid grid-cols-1 md:grid-cols-5 gap-2 md:gap-3 ${showFilters ? 'block' : 'hidden md:grid'}`}>
                  <Select value={timeRange} onValueChange={setTimeRange}>
                    <SelectTrigger className="w-full bg-[#26262c] border-[#40404a] text-white text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-[#26262c] border-[#40404a]">
                      <SelectItem value="24h">Last 24 Hours</SelectItem>
                      <SelectItem value="7d">Last 7 Days</SelectItem>
                      <SelectItem value="30d">Last 30 Days</SelectItem>
                    </SelectContent>
                  </Select>

                  <Select value={filterDevice} onValueChange={setFilterDevice}>
                    <SelectTrigger className="w-full bg-[#26262c] border-[#40404a] text-white text-sm">
                      <SelectValue placeholder="Device" />
                    </SelectTrigger>
                    <SelectContent className="bg-[#26262c] border-[#40404a]">
                      <SelectItem value="all">All Devices</SelectItem>
                      {uniqueDevices.map(device => (
                        <SelectItem key={device} value={device || 'unknown'}>
                          {device || 'Unknown'}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <Select value={filterBrowser} onValueChange={setFilterBrowser}>
                    <SelectTrigger className="w-full bg-[#26262c] border-[#40404a] text-white text-sm">
                      <SelectValue placeholder="Browser" />
                    </SelectTrigger>
                    <SelectContent className="bg-[#26262c] border-[#40404a]">
                      <SelectItem value="all">All Browsers</SelectItem>
                      {uniqueBrowsers.map(browser => (
                        <SelectItem key={browser} value={browser || 'unknown'}>
                          {browser || 'Unknown'}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <Select value={filterCountry} onValueChange={setFilterCountry}>
                    <SelectTrigger className="w-full bg-[#26262c] border-[#40404a] text-white text-sm">
                      <SelectValue placeholder="Country" />
                    </SelectTrigger>
                    <SelectContent className="bg-[#26262c] border-[#40404a]">
                      <SelectItem value="all">All Countries</SelectItem>
                      {uniqueCountries.map(country => (
                        <SelectItem key={country} value={country || 'unknown'}>
                          {country || 'Unknown'}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <Input
                    placeholder="Search session ID..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full bg-[#26262c] border-[#40404a] text-white text-sm"
                  />
                </div>
              </div>

              {/* Detailed Visitor List */}
              <Card className="bg-[#1a1a1e] border-[#26262c]">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-white text-base md:text-lg">
                    <Activity className="h-5 w-5" />
                    Visitor Sessions ({filteredVisitors.length})
                  </CardTitle>
                  <CardDescription className="text-[#ADADB8] text-xs md:text-sm">
                    Complete visitor information with engagement metrics
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {loading ? (
                    <div className="flex items-center justify-center py-8">
                      <RefreshCw className="h-6 w-6 animate-spin text-[#9147ff] mr-2" />
                      <span className="text-[#ADADB8] text-sm">Loading analytics...</span>
                    </div>
                  ) : filteredVisitors.length === 0 ? (
                    <div className="text-center py-8">
                      <Users className="h-12 w-12 text-[#ADADB8] mx-auto mb-4" />
                      <p className="text-[#ADADB8] text-sm">No visitor data available for this period</p>
                    </div>
                  ) : (
                    <div className="space-y-3 max-h-96 overflow-y-auto">
                      {filteredVisitors.map((visitor) => (
                        <div 
                          key={visitor.session_id} 
                          className="p-3 md:p-4 bg-[#26262c]/30 rounded-lg border border-[#40404a]/30 hover:bg-[#26262c]/50 cursor-pointer transition-colors"
                          onClick={() => {
                            setSelectedSessionId(visitor.session_id);
                            setSelectedSession(visitor);
                            setIsDetailModalOpen(true);
                          }}
                        >
                          {/* Mobile Layout */}
                          <div className="md:hidden space-y-3">
                            <div className="flex items-start justify-between gap-2">
                              <div className="min-w-0 flex-1">
                                <p className="text-xs text-[#ADADB8]">Session ID</p>
                                <p className="text-sm font-mono text-white truncate">{visitor.session_id.substring(0, 12)}...</p>
                              </div>
                              <ChevronRight className="h-4 w-4 text-[#ADADB8] flex-shrink-0 mt-1" />
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                              <div>
                                <p className="text-xs text-[#ADADB8]">Device / Browser</p>
                                <p className="text-sm text-white truncate">
                                  {visitor.device_type || 'N/A'} / {visitor.browser_name || 'N/A'}
                                </p>
                              </div>

                              <div>
                                <p className="text-xs text-[#ADADB8]">Location</p>
                                <p className="text-sm text-white truncate">
                                  {visitor.city || visitor.region || visitor.country || 'N/A'}
                                </p>
                              </div>

                              <div>
                                <p className="text-xs text-[#ADADB8]">Pages</p>
                                <p className="text-sm text-white">{visitor.pages_visited || 0}</p>
                              </div>

                              <div>
                                <p className="text-xs text-[#ADADB8]">Duration</p>
                                <p className="text-sm text-white">
                                  {Math.floor((visitor.session_duration_seconds || 0) / 60)}m
                                </p>
                              </div>
                            </div>

                            <div className="flex gap-2 flex-wrap items-center">
                              {visitor.is_bot && (
                                <Badge className="bg-amber-400/20 text-amber-400 border-amber-400/30 text-xs">
                                  <Bot className="h-3 w-3 mr-1" />
                                  Bot
                                </Badge>
                              )}
                              {visitor.is_returning && (
                                <Badge className="bg-blue-400/20 text-blue-400 border-blue-400/30 text-xs">
                                  Returning
                                </Badge>
                              )}
                              {visitor.error_count && visitor.error_count > 0 && (
                                <Badge className="bg-red-400/20 text-red-400 border-red-400/30 text-xs">
                                  {visitor.error_count} Errors
                                </Badge>
                              )}
                            </div>
                          </div>

                          {/* Desktop Layout */}
                          <div className="hidden md:grid grid-cols-1 lg:grid-cols-4 gap-4">
                            {/* Session Info */}
                            <div>
                              <p className="text-xs text-[#ADADB8]">Session ID</p>
                              <p className="text-sm font-mono text-white truncate">{visitor.session_id.substring(0, 12)}...</p>
                            </div>

                            {/* Device Info */}
                            <div>
                              <p className="text-xs text-[#ADADB8]">Device / Browser</p>
                              <p className="text-sm text-white">
                                {visitor.device_type || 'N/A'} / {visitor.browser_name || 'N/A'}
                              </p>
                            </div>

                            {/* Location */}
                            <div>
                              <p className="text-xs text-[#ADADB8]">Location</p>
                              <p className="text-sm text-white">
                                {visitor.city && visitor.region 
                                  ? `${visitor.city}, ${visitor.region}`
                                  : visitor.city || visitor.region || visitor.country || 'N/A'}
                              </p>
                              {visitor.country && (visitor.city || visitor.region) && (
                                <p className="text-xs text-[#ADADB8]">{visitor.country}</p>
                              )}
                            </div>

                            {/* Engagement */}
                            <div>
                              <p className="text-xs text-[#ADADB8]">Engagement Score</p>
                              <div className="flex items-center gap-2">
                                <div className="w-full bg-[#40404a]/30 rounded-full h-2">
                                  <div 
                                    className="bg-emerald-400 h-2 rounded-full" 
                                    style={{ width: `${visitor.engagement_score || 0}%` }}
                                  />
                                </div>
                                <span className="text-sm text-white font-medium">{visitor.engagement_score || 0}</span>
                              </div>
                            </div>

                            {/* Pages Visited */}
                            <div>
                              <p className="text-xs text-[#ADADB8]">Pages Visited</p>
                              <p className="text-sm text-white">{visitor.pages_visited || 0}</p>
                            </div>

                            {/* Session Duration */}
                            <div>
                              <p className="text-xs text-[#ADADB8]">Duration</p>
                              <p className="text-sm text-white">
                                {Math.floor((visitor.session_duration_seconds || 0) / 60)}m {(visitor.session_duration_seconds || 0) % 60}s
                              </p>
                            </div>

                            {/* Page Load Time */}
                            <div>
                              <p className="text-xs text-[#ADADB8]">Page Load Time</p>
                              <p className="text-sm text-white">{visitor.page_load_time_ms || 'N/A'}ms</p>
                            </div>

                            {/* Status Badges */}
                            <div className="flex gap-2 flex-wrap items-center">
                              {visitor.is_bot && (
                                <Badge className="bg-amber-400/20 text-amber-400 border-amber-400/30">
                                  <Bot className="h-3 w-3 mr-1" />
                                  Bot
                                </Badge>
                              )}
                              {visitor.is_returning && (
                                <Badge className="bg-blue-400/20 text-blue-400 border-blue-400/30">
                                  Returning
                                </Badge>
                              )}
                              {visitor.error_count && visitor.error_count > 0 && (
                                <Badge className="bg-red-400/20 text-red-400 border-red-400/30">
                                  {visitor.error_count} Errors
                                </Badge>
                              )}
                              <ChevronRight className="h-4 w-4 text-[#ADADB8] ml-auto" />
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Information */}
              <div className="bg-[#004D61]/20 border border-[#004D61]/30 rounded-lg p-3 md:p-4">
                <h3 className="text-sm font-semibold text-white mb-2">About Detailed Visitor Tracking</h3>
                <p className="text-xs md:text-sm text-[#ADADB8]">
                  This enhanced analytics system tracks comprehensive visitor data including device type, browser, operating system, 
                  geographic location, engagement metrics, page load performance, and error tracking. Click on any visitor row to see detailed 
                  page views, performance metrics, errors, and events. All data is collected in real-time and stored securely.
                </p>
              </div>

            </div>
          </div>
        </div>

        {/* Visitor Detail Modal */}
        <VisitorDetailModal 
          sessionId={selectedSessionId}
          isOpen={isDetailModalOpen}
          onClose={() => {
            setIsDetailModalOpen(false);
            setSelectedSession(null);
          }}
          sessionData={selectedSession}
        />
      </div>
    </AdminProtected>
  );
}
