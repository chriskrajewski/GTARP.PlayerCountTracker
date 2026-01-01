'use client';

import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Clock, 
  Globe, 
  Smartphone, 
  Zap, 
  AlertCircle,
  Eye,
  BarChart3,
  Activity,
  MapPin,
  Monitor,
  Link2,
  Tag,
  User,
  ArrowRight
} from 'lucide-react';
import { createBrowserClient } from '@/lib/supabase-browser';
import { format } from 'date-fns';
import { formatToLocalTimezone } from '@/lib/timezone-utils';

interface VisitorDetailModalProps {
  sessionId: string | null;
  isOpen: boolean;
  onClose: () => void;
  sessionData?: VisitorSessionData | null;
}

interface VisitorSessionData {
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

interface PageView {
  id: number;
  page_url: string;
  page_title: string;
  view_timestamp: string;
  time_on_page_seconds: number;
  scroll_depth_percent: number;
  clicks_on_page: number;
  form_interactions: number;
}

interface PerformanceMetric {
  id: number;
  page_url: string;
  page_load_time_ms: number;
  first_contentful_paint_ms: number;
  largest_contentful_paint_ms: number;
  cumulative_layout_shift: number;
  time_to_interactive_ms: number;
  measured_at: string;
}

interface ErrorLog {
  id: number;
  error_type: string;
  error_message: string;
  error_stack: string;
  page_url: string;
  error_timestamp: string;
}

interface VisitorEvent {
  id: number;
  event_type: string;
  event_name: string;
  event_value: string;
  event_category: string;
  event_timestamp: string;
  page_url: string;
}

export function VisitorDetailModal({ sessionId, isOpen, onClose, sessionData }: VisitorDetailModalProps) {
  const [pageViews, setPageViews] = useState<PageView[]>([]);
  const [performance, setPerformance] = useState<PerformanceMetric[]>([]);
  const [errors, setErrors] = useState<ErrorLog[]>([]);
  const [events, setEvents] = useState<VisitorEvent[]>([]);
  const [session, setSession] = useState<VisitorSessionData | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen && sessionId) {
      fetchDetailedData();
    }
    // Use passed session data or fetch it
    if (sessionData) {
      setSession(sessionData);
    }
  }, [isOpen, sessionId, sessionData]);

  const fetchDetailedData = async () => {
    if (!sessionId) return;
    setLoading(true);

    try {
      const supabase = createBrowserClient();

      // Fetch session data if not provided
      if (!sessionData) {
        const { data: sessionResult } = await supabase
          .from('visitor_sessions')
          .select('*')
          .eq('session_id', sessionId)
          .single();
        
        if (sessionResult) {
          setSession(sessionResult);
        }
      }

      // Fetch page views
      const { data: pageViewsData } = await supabase
        .from('visitor_page_views')
        .select('*')
        .eq('session_id', sessionId)
        .order('view_timestamp', { ascending: false });

      // Fetch performance metrics
      const { data: performanceData } = await supabase
        .from('visitor_performance')
        .select('*')
        .eq('session_id', sessionId)
        .order('measured_at', { ascending: false });

      // Fetch errors
      const { data: errorsData } = await supabase
        .from('visitor_errors')
        .select('*')
        .eq('session_id', sessionId)
        .order('error_timestamp', { ascending: false });

      // Fetch events
      const { data: eventsData } = await supabase
        .from('visitor_events')
        .select('*')
        .eq('session_id', sessionId)
        .order('event_timestamp', { ascending: false });

      setPageViews(pageViewsData || []);
      setPerformance(performanceData || []);
      setErrors(errorsData || []);
      setEvents(eventsData || []);
    } catch (error) {
      console.error('Error fetching detailed data:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto bg-[#1a1a1e] border-[#26262c]">
        <DialogHeader>
          <DialogTitle className="text-white">Visitor Session Details</DialogTitle>
          <DialogDescription className="text-[#ADADB8]">
            Session ID: {sessionId?.substring(0, 12)}...
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="overview" className="w-full">
          <TabsList className="grid w-full grid-cols-6 bg-[#26262c]">
            <TabsTrigger value="overview" className="text-[#ADADB8]">
              <User className="h-4 w-4 mr-2" />
              Overview
            </TabsTrigger>
            <TabsTrigger value="location" className="text-[#ADADB8]">
              <MapPin className="h-4 w-4 mr-2" />
              Location
            </TabsTrigger>
            <TabsTrigger value="pages" className="text-[#ADADB8]">
              <Eye className="h-4 w-4 mr-2" />
              Pages ({pageViews.length})
            </TabsTrigger>
            <TabsTrigger value="performance" className="text-[#ADADB8]">
              <Zap className="h-4 w-4 mr-2" />
              Performance ({performance.length})
            </TabsTrigger>
            <TabsTrigger value="errors" className="text-[#ADADB8]">
              <AlertCircle className="h-4 w-4 mr-2" />
              Errors ({errors.length})
            </TabsTrigger>
            <TabsTrigger value="events" className="text-[#ADADB8]">
              <Activity className="h-4 w-4 mr-2" />
              Events ({events.length})
            </TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-4 mt-4">
            {loading ? (
              <p className="text-[#ADADB8] text-center py-4">Loading session data...</p>
            ) : !session ? (
              <p className="text-[#ADADB8] text-center py-4">No session data available</p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Session Info Card */}
                <Card className="bg-[#26262c]/50 border-[#40404a]/30">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm text-white flex items-center gap-2">
                      <User className="h-4 w-4" />
                      Session Information
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div>
                        <p className="text-[#ADADB8] text-xs">Status</p>
                        <Badge className={session.is_active ? 'bg-emerald-400/20 text-emerald-400' : 'bg-gray-400/20 text-gray-400'}>
                          {session.is_active ? 'Active' : 'Inactive'}
                        </Badge>
                      </div>
                      <div>
                        <p className="text-[#ADADB8] text-xs">Type</p>
                        <Badge className={session.is_bot ? 'bg-amber-400/20 text-amber-400' : 'bg-blue-400/20 text-blue-400'}>
                          {session.is_bot ? 'Bot' : 'Human'}
                        </Badge>
                      </div>
                      <div>
                        <p className="text-[#ADADB8] text-xs">Created</p>
                        <p className="text-white">{formatToLocalTimezone(session.created_at, 'full')}</p>
                      </div>
                      <div>
                        <p className="text-[#ADADB8] text-xs">Last Activity</p>
                        <p className="text-white">{formatToLocalTimezone(session.last_heartbeat, 'full')}</p>
                      </div>
                      <div>
                        <p className="text-[#ADADB8] text-xs">Returning Visitor</p>
                        <p className="text-white">{session.is_returning ? `Yes (${session.previous_visit_count || 0} previous visits)` : 'No'}</p>
                      </div>
                      <div>
                        <p className="text-[#ADADB8] text-xs">Engagement Score</p>
                        <p className="text-emerald-400 font-semibold">{session.engagement_score || 0}/100</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Device Info Card */}
                <Card className="bg-[#26262c]/50 border-[#40404a]/30">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm text-white flex items-center gap-2">
                      <Monitor className="h-4 w-4" />
                      Device & Browser
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div>
                        <p className="text-[#ADADB8] text-xs">Device Type</p>
                        <p className="text-white">{session.device_type || 'Unknown'}</p>
                      </div>
                      <div>
                        <p className="text-[#ADADB8] text-xs">Browser</p>
                        <p className="text-white">{session.browser_name || 'Unknown'} {session.browser_version || ''}</p>
                      </div>
                      <div>
                        <p className="text-[#ADADB8] text-xs">Operating System</p>
                        <p className="text-white">{session.os_name || 'Unknown'} {session.os_version || ''}</p>
                      </div>
                      <div>
                        <p className="text-[#ADADB8] text-xs">Screen Resolution</p>
                        <p className="text-white">{session.screen_resolution || 'Unknown'}</p>
                      </div>
                      <div>
                        <p className="text-[#ADADB8] text-xs">Viewport Size</p>
                        <p className="text-white">{session.viewport_size || 'Unknown'}</p>
                      </div>
                      <div>
                        <p className="text-[#ADADB8] text-xs">Language</p>
                        <p className="text-white">{session.language || 'Unknown'}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Engagement Metrics Card */}
                <Card className="bg-[#26262c]/50 border-[#40404a]/30">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm text-white flex items-center gap-2">
                      <BarChart3 className="h-4 w-4" />
                      Engagement Metrics
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div>
                        <p className="text-[#ADADB8] text-xs">Pages Visited</p>
                        <p className="text-white font-semibold">{session.pages_visited || 0}</p>
                      </div>
                      <div>
                        <p className="text-[#ADADB8] text-xs">Session Duration</p>
                        <p className="text-white font-semibold">
                          {Math.floor((session.session_duration_seconds || 0) / 60)}m {(session.session_duration_seconds || 0) % 60}s
                        </p>
                      </div>
                      <div>
                        <p className="text-[#ADADB8] text-xs">Time on Site</p>
                        <p className="text-white font-semibold">
                          {Math.floor((session.time_on_site_seconds || 0) / 60)}m {(session.time_on_site_seconds || 0) % 60}s
                        </p>
                      </div>
                      <div>
                        <p className="text-[#ADADB8] text-xs">Scroll Depth</p>
                        <p className="text-white font-semibold">{session.scroll_depth_percent || 0}%</p>
                      </div>
                      <div>
                        <p className="text-[#ADADB8] text-xs">Clicks</p>
                        <p className="text-white font-semibold">{session.clicks_count || 0}</p>
                      </div>
                      <div>
                        <p className="text-[#ADADB8] text-xs">Form Interactions</p>
                        <p className="text-white font-semibold">{session.form_interactions || 0}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Traffic Source Card */}
                <Card className="bg-[#26262c]/50 border-[#40404a]/30">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm text-white flex items-center gap-2">
                      <Link2 className="h-4 w-4" />
                      Traffic Source
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="space-y-2 text-sm">
                      <div>
                        <p className="text-[#ADADB8] text-xs">Referrer</p>
                        <p className="text-white truncate">{session.referrer || 'Direct'}</p>
                      </div>
                      <div>
                        <p className="text-[#ADADB8] text-xs">Landing Page</p>
                        <p className="text-white truncate">{session.landing_page || 'Unknown'}</p>
                      </div>
                      <div>
                        <p className="text-[#ADADB8] text-xs">Current Page</p>
                        <p className="text-white truncate">{session.current_page || session.landing_page || 'Unknown'}</p>
                      </div>
                      {(session.utm_source || session.utm_campaign) && (
                        <div className="pt-2 border-t border-[#40404a]/30">
                          <p className="text-[#ADADB8] text-xs mb-1">UTM Parameters</p>
                          <div className="flex flex-wrap gap-1">
                            {session.utm_source && <Badge className="bg-purple-400/20 text-purple-400 text-xs">source: {session.utm_source}</Badge>}
                            {session.utm_medium && <Badge className="bg-purple-400/20 text-purple-400 text-xs">medium: {session.utm_medium}</Badge>}
                            {session.utm_campaign && <Badge className="bg-purple-400/20 text-purple-400 text-xs">campaign: {session.utm_campaign}</Badge>}
                          </div>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}
          </TabsContent>

          {/* Location Tab */}
          <TabsContent value="location" className="space-y-4 mt-4">
            {loading ? (
              <p className="text-[#ADADB8] text-center py-4">Loading location data...</p>
            ) : !session ? (
              <p className="text-[#ADADB8] text-center py-4">No location data available</p>
            ) : (
              <div className="space-y-4">
                {/* Location Overview */}
                <Card className="bg-[#26262c]/50 border-[#40404a]/30">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm text-white flex items-center gap-2">
                      <MapPin className="h-4 w-4" />
                      Geographic Location
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {session.country || session.region || session.city ? (
                      <div className="space-y-4">
                        {/* Location Display */}
                        <div className="flex items-center gap-3">
                          <div className="w-12 h-12 rounded-full bg-blue-400/20 flex items-center justify-center">
                            <Globe className="h-6 w-6 text-blue-400" />
                          </div>
                          <div>
                            <p className="text-lg font-semibold text-white">
                              {[session.city, session.region, session.country].filter(Boolean).join(', ')}
                            </p>
                            <p className="text-sm text-[#ADADB8]">
                              {session.timezone ? `Timezone: ${session.timezone}` : 'Timezone not available'}
                            </p>
                          </div>
                        </div>

                        {/* Detailed Location Grid */}
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-4 border-t border-[#40404a]/30">
                          <div className="text-center p-3 bg-[#1a1a1e] rounded-lg">
                            <p className="text-xs text-[#ADADB8] mb-1">Country</p>
                            <p className="text-white font-semibold">{session.country || 'Unknown'}</p>
                          </div>
                          <div className="text-center p-3 bg-[#1a1a1e] rounded-lg">
                            <p className="text-xs text-[#ADADB8] mb-1">Region/State</p>
                            <p className="text-white font-semibold">{session.region || 'Unknown'}</p>
                          </div>
                          <div className="text-center p-3 bg-[#1a1a1e] rounded-lg">
                            <p className="text-xs text-[#ADADB8] mb-1">City</p>
                            <p className="text-white font-semibold">{session.city || 'Unknown'}</p>
                          </div>
                          <div className="text-center p-3 bg-[#1a1a1e] rounded-lg">
                            <p className="text-xs text-[#ADADB8] mb-1">Timezone</p>
                            <p className="text-white font-semibold text-xs">{session.timezone || 'Unknown'}</p>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="text-center py-8">
                        <MapPin className="h-12 w-12 text-[#ADADB8] mx-auto mb-4 opacity-50" />
                        <p className="text-[#ADADB8]">Location data not available for this session</p>
                        <p className="text-xs text-[#ADADB8] mt-2">
                          This may be due to a private IP address or geolocation service unavailability
                        </p>
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Connection Info */}
                <Card className="bg-[#26262c]/50 border-[#40404a]/30">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm text-white flex items-center gap-2">
                      <Zap className="h-4 w-4" />
                      Connection Details
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div className="text-center p-3 bg-[#1a1a1e] rounded-lg">
                        <p className="text-xs text-[#ADADB8] mb-1">Connection Type</p>
                        <p className="text-white font-semibold">{session.connection_type || 'Unknown'}</p>
                      </div>
                      <div className="text-center p-3 bg-[#1a1a1e] rounded-lg">
                        <p className="text-xs text-[#ADADB8] mb-1">Connection Speed</p>
                        <p className="text-white font-semibold">
                          {session.connection_speed_mbps ? `${session.connection_speed_mbps} Mbps` : 'Unknown'}
                        </p>
                      </div>
                      <div className="text-center p-3 bg-[#1a1a1e] rounded-lg">
                        <p className="text-xs text-[#ADADB8] mb-1">Language</p>
                        <p className="text-white font-semibold">{session.language || 'Unknown'}</p>
                      </div>
                      <div className="text-center p-3 bg-[#1a1a1e] rounded-lg">
                        <p className="text-xs text-[#ADADB8] mb-1">Page Load Time</p>
                        <p className="text-white font-semibold">
                          {session.page_load_time_ms ? `${session.page_load_time_ms}ms` : 'N/A'}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* User Agent */}
                {session.user_agent && (
                  <Card className="bg-[#26262c]/50 border-[#40404a]/30">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm text-white flex items-center gap-2">
                        <Monitor className="h-4 w-4" />
                        User Agent
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <pre className="text-xs bg-[#0e0e10] p-3 rounded overflow-x-auto text-[#ADADB8] whitespace-pre-wrap break-all">
                        {session.user_agent}
                      </pre>
                    </CardContent>
                  </Card>
                )}
              </div>
            )}
          </TabsContent>

          {/* Page Views Tab */}
          <TabsContent value="pages" className="space-y-3 mt-4">
            {pageViews.length === 0 ? (
              <p className="text-[#ADADB8] text-center py-4">No page views recorded</p>
            ) : (
              pageViews.map((view) => (
                <Card key={view.id} className="bg-[#26262c]/50 border-[#40404a]/30">
                  <CardContent className="pt-4">
                    <div className="space-y-2">
                      <p className="text-sm font-mono text-white truncate">{view.page_url}</p>
                      <p className="text-xs text-[#ADADB8]">{view.page_title}</p>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
                        <div>
                          <span className="text-[#ADADB8]">Time on Page:</span>
                          <p className="text-white">{view.time_on_page_seconds}s</p>
                        </div>
                        <div>
                          <span className="text-[#ADADB8]">Scroll Depth:</span>
                          <p className="text-white">{view.scroll_depth_percent}%</p>
                        </div>
                        <div>
                          <span className="text-[#ADADB8]">Clicks:</span>
                          <p className="text-white">{view.clicks_on_page}</p>
                        </div>
                        <div>
                          <span className="text-[#ADADB8]">Form Interactions:</span>
                          <p className="text-white">{view.form_interactions}</p>
                        </div>
                      </div>
                      <p className="text-xs text-[#ADADB8]">
                        {formatToLocalTimezone(view.view_timestamp, 'full')}
                      </p>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </TabsContent>

          {/* Performance Tab */}
          <TabsContent value="performance" className="space-y-3 mt-4">
            {performance.length === 0 ? (
              <p className="text-[#ADADB8] text-center py-4">No performance data recorded</p>
            ) : (
              performance.map((perf) => (
                <Card key={perf.id} className="bg-[#26262c]/50 border-[#40404a]/30">
                  <CardContent className="pt-4">
                    <div className="space-y-2">
                      <p className="text-sm font-mono text-white truncate">{perf.page_url}</p>
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-xs">
                        <div>
                          <span className="text-[#ADADB8]">Page Load:</span>
                          <p className="text-white font-mono">{perf.page_load_time_ms}ms</p>
                        </div>
                        <div>
                          <span className="text-[#ADADB8]">FCP:</span>
                          <p className="text-white font-mono">{perf.first_contentful_paint_ms}ms</p>
                        </div>
                        <div>
                          <span className="text-[#ADADB8]">LCP:</span>
                          <p className="text-white font-mono">{perf.largest_contentful_paint_ms}ms</p>
                        </div>
                        <div>
                          <span className="text-[#ADADB8]">CLS:</span>
                          <p className="text-white font-mono">{perf.cumulative_layout_shift}</p>
                        </div>
                        <div>
                          <span className="text-[#ADADB8]">TTI:</span>
                          <p className="text-white font-mono">{perf.time_to_interactive_ms}ms</p>
                        </div>
                      </div>
                      <p className="text-xs text-[#ADADB8]">
                        {formatToLocalTimezone(perf.measured_at, 'full')}
                      </p>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </TabsContent>

          {/* Errors Tab */}
          <TabsContent value="errors" className="space-y-3 mt-4">
            {errors.length === 0 ? (
              <p className="text-[#ADADB8] text-center py-4">No errors recorded</p>
            ) : (
              errors.map((error) => (
                <Card key={error.id} className="bg-red-400/10 border-red-400/20">
                  <CardContent className="pt-4">
                    <div className="space-y-2">
                      <div className="flex items-start justify-between">
                        <p className="text-sm font-mono text-red-400">{error.error_message}</p>
                        <Badge className="bg-red-400/20 text-red-400">{error.error_type}</Badge>
                      </div>
                      <p className="text-xs text-[#ADADB8]">{error.page_url}</p>
                      {error.error_stack && (
                        <pre className="text-xs bg-[#0e0e10] p-2 rounded overflow-x-auto text-[#ADADB8]">
                          {error.error_stack.substring(0, 200)}...
                        </pre>
                      )}
                      <p className="text-xs text-[#ADADB8]">
                        {formatToLocalTimezone(error.error_timestamp, 'full')}
                      </p>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </TabsContent>

          {/* Events Tab */}
          <TabsContent value="events" className="space-y-3 mt-4">
            {events.length === 0 ? (
              <p className="text-[#ADADB8] text-center py-4">No events recorded</p>
            ) : (
              events.map((event) => (
                <Card key={event.id} className="bg-[#26262c]/50 border-[#40404a]/30">
                  <CardContent className="pt-4">
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <Badge className="bg-blue-400/20 text-blue-400">{event.event_type}</Badge>
                        <p className="text-sm text-white">{event.event_name}</p>
                      </div>
                      {event.event_value && (
                        <p className="text-xs text-[#ADADB8]">Value: {event.event_value}</p>
                      )}
                      {event.event_category && (
                        <p className="text-xs text-[#ADADB8]">Category: {event.event_category}</p>
                      )}
                      <p className="text-xs text-[#ADADB8]">{event.page_url}</p>
                      <p className="text-xs text-[#ADADB8]">
                        {formatToLocalTimezone(event.event_timestamp, 'full')}
                      </p>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
