import { NextRequest, NextResponse } from 'next/server';
import { validateAdminRequest } from '@/lib/admin-auth-server';
import { createServerClient } from '@/lib/supabase-server';

export async function GET(request: NextRequest) {
  try {
    if (!validateAdminRequest(request)) {
      return NextResponse.json(
        { success: false, error: 'Admin authentication required' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const timeRange = searchParams.get('time_range') || '7d';
    const serverId = searchParams.get('server_id');

    const supabase = createServerClient();

    // Calculate date range based on time_range parameter
    const now = new Date();
    let startDate: Date;

    switch (timeRange) {
      case '24h':
        startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        break;
      case '7d':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case '30d':
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      case '90d':
        startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
        break;
      default:
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    }

    // Build analytics data
    const analytics = {
      summary: {
        time_range: timeRange,
        start_date: startDate.toISOString(),
        end_date: now.toISOString(),
        server_filter: serverId || 'all',
      },
      player_analytics: {},
      stream_analytics: {},
      system_analytics: {},
    };

    // Player count analytics
    let playerQuery = supabase
      .from('player_counts')
      .select('server_id, player_count, timestamp')
      .gte('timestamp', startDate.toISOString())
      .lte('timestamp', now.toISOString())
      .order('timestamp', { ascending: true });

    if (serverId) {
      playerQuery = playerQuery.eq('server_id', serverId);
    }

    const { data: playerData, error: playerError } = await playerQuery;

    if (!playerError && playerData) {
      // Calculate player statistics
      const totalDataPoints = playerData.length;
      const uniqueServers = [...new Set(playerData.map(d => d.server_id))];
      
      const playerCounts = playerData.map(d => d.player_count);
      const avgPlayerCount = playerCounts.length > 0 
        ? Math.round(playerCounts.reduce((a, b) => a + b, 0) / playerCounts.length) 
        : 0;
      const maxPlayerCount = playerCounts.length > 0 ? Math.max(...playerCounts) : 0;
      const minPlayerCount = playerCounts.length > 0 ? Math.min(...playerCounts) : 0;

      // Peak hours analysis
      const hourlyData = new Map();
      playerData.forEach(record => {
        const hour = new Date(record.timestamp).getHours();
        if (!hourlyData.has(hour)) {
          hourlyData.set(hour, []);
        }
        hourlyData.get(hour).push(record.player_count);
      });

      const hourlyAverages = Array.from(hourlyData.entries()).map(([hour, counts]) => ({
        hour,
        average_players: Math.round(counts.reduce((a: number, b: number) => a + b, 0) / counts.length),
        data_points: counts.length,
      })).sort((a, b) => b.average_players - a.average_players);

      analytics.player_analytics = {
        total_data_points: totalDataPoints,
        unique_servers: uniqueServers.length,
        average_player_count: avgPlayerCount,
        max_player_count: maxPlayerCount,
        min_player_count: minPlayerCount,
        peak_hour: hourlyAverages[0]?.hour || 0,
        peak_hour_average: hourlyAverages[0]?.average_players || 0,
        hourly_breakdown: hourlyAverages.slice(0, 24), // All 24 hours
        server_breakdown: uniqueServers.map(server => {
          const serverData = playerData.filter(d => d.server_id === server);
          const serverCounts = serverData.map(d => d.player_count);
          return {
            server_id: server,
            data_points: serverData.length,
            average_players: serverCounts.length > 0 
              ? Math.round(serverCounts.reduce((a, b) => a + b, 0) / serverCounts.length) 
              : 0,
            max_players: serverCounts.length > 0 ? Math.max(...serverCounts) : 0,
          };
        }),
      };
    } else {
      analytics.player_analytics = {
        total_data_points: 0,
        unique_servers: 0,
        average_player_count: 0,
        max_player_count: 0,
        min_player_count: 0,
        peak_hour: 0,
        peak_hour_average: 0,
        hourly_breakdown: [],
        server_breakdown: [],
      };
    }

    // Stream analytics
    let streamQuery = supabase
      .from('twitch_streams')
      .select('serverId, viewer_count, streamer_name, created_at')
      .gte('created_at', startDate.toISOString())
      .lte('created_at', now.toISOString());

    if (serverId) {
      streamQuery = streamQuery.eq('serverId', serverId);
    }

    const { data: streamData, error: streamError } = await streamQuery;

    if (!streamError && streamData) {
      const totalStreams = streamData.length;
      const uniqueStreamers = [...new Set(streamData.map(d => d.streamer_name))];
      const totalViewers = streamData.reduce((sum, stream) => sum + stream.viewer_count, 0);
      const avgViewerCount = totalStreams > 0 ? Math.round(totalViewers / totalStreams) : 0;

      analytics.stream_analytics = {
        total_streams: totalStreams,
        unique_streamers: uniqueStreamers.length,
        total_viewer_hours: totalViewers, // Simplified calculation
        average_viewer_count: avgViewerCount,
        top_streamers: uniqueStreamers.slice(0, 10).map(streamer => {
          const streamerData = streamData.filter(d => d.streamer_name === streamer);
          return {
            streamer_name: streamer,
            stream_count: streamerData.length,
            total_viewers: streamerData.reduce((sum, stream) => sum + stream.viewer_count, 0),
            average_viewers: Math.round(streamerData.reduce((sum, stream) => sum + stream.viewer_count, 0) / streamerData.length),
          };
        }).sort((a, b) => b.total_viewers - a.total_viewers),
      };
    } else {
      analytics.stream_analytics = {
        total_streams: 0,
        unique_streamers: 0,
        total_viewer_hours: 0,
        average_viewer_count: 0,
        top_streamers: [],
      };
    }

    // System analytics (mock data for now)
    analytics.system_analytics = {
      api_requests: Math.floor(Math.random() * 10000) + 5000, // Mock data
      data_collection_success_rate: 98.5,
      average_response_time_ms: 125,
      error_rate_percent: 1.5,
      uptime_percent: 99.8,
      database_size_mb: 1024 + Math.floor(Math.random() * 512),
    };

    return NextResponse.json({
      success: true,
      data: analytics,
      timestamp: new Date().toISOString(),
    });

  } catch (error) {
    console.error('Analytics API error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}