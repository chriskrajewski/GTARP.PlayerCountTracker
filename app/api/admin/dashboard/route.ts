import { NextRequest, NextResponse } from 'next/server';
import { validateAdminRequest } from '@/lib/admin-auth-server';
import { createServerClient } from '@/lib/supabase-server';
import { AdminDashboardData, SystemMetrics, AuditLog, SystemAlert } from '@/lib/admin-types';

export async function GET(request: NextRequest) {
  try {
    // Validate admin authentication
    if (!validateAdminRequest(request)) {
      return NextResponse.json(
        { success: false, error: 'Admin authentication required' },
        { status: 401 }
      );
    }

    const supabase = createServerClient();
    
    // Fetch system metrics
    const metrics = await getSystemMetrics(supabase);
    
    // Fetch recent activities (audit logs)
    const recentActivities = await getRecentActivities(supabase);
    
    // Get system health status
    const systemHealth = await getSystemHealth(supabase);
    
    // Get active alerts
    const alerts = await getSystemAlerts(supabase);

    const dashboardData: AdminDashboardData = {
      metrics,
      recent_activities: recentActivities,
      system_health: systemHealth,
      alerts,
    };

    return NextResponse.json({
      success: true,
      data: dashboardData,
      timestamp: new Date().toISOString(),
    });

  } catch (error) {
    console.error('Dashboard API error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

async function getSystemMetrics(supabase: any): Promise<SystemMetrics> {
  try {
    // Get total servers
    const { count: totalServers } = await supabase
      .from('server_xref')
      .select('*', { count: 'exact', head: true });

    // Get total players today
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const { data: playerCountsToday } = await supabase
      .from('player_counts')
      .select('player_count')
      .gte('timestamp', today.toISOString());

    const totalPlayersToday = playerCountsToday?.reduce((sum: number, record: any) => 
      sum + record.player_count, 0) || 0;

    // Get total data points
    const { count: totalDataPoints } = await supabase
      .from('player_counts')
      .select('*', { count: 'exact', head: true });

    // Get active banners
    const { count: activeBanners } = await supabase
      .from('notification_banners')
      .select('*', { count: 'exact', head: true })
      .eq('is_active', true);

    // Mock other metrics (in real implementation, these would come from monitoring systems)
    const systemUptime = '15d 7h 23m';
    const databaseSize = '2.4 GB';
    const apiRequestsToday = Math.floor(Math.random() * 50000) + 25000;
    const errorRate = Math.random() * 2; // 0-2% error rate

    return {
      total_servers: totalServers || 0,
      total_players_today: totalPlayersToday,
      total_data_points: totalDataPoints || 0,
      active_banners: activeBanners || 0,
      system_uptime: systemUptime,
      database_size: databaseSize,
      api_requests_today: apiRequestsToday,
      error_rate: Math.round(errorRate * 100) / 100,
    };
  } catch (error) {
    console.error('Error fetching system metrics:', error);
    // Return default values on error
    return {
      total_servers: 0,
      total_players_today: 0,
      total_data_points: 0,
      active_banners: 0,
      system_uptime: 'Unknown',
      database_size: 'Unknown',
      api_requests_today: 0,
      error_rate: 0,
    };
  }
}

async function getRecentActivities(supabase: any): Promise<AuditLog[]> {
  // Mock recent activities (in real implementation, this would come from an audit_logs table)
  const mockActivities: AuditLog[] = [
    {
      id: '1',
      user_id: 'admin',
      user_email: 'admin@example.com',
      action: 'server_created',
      resource_type: 'server',
      resource_id: 'new_server_123',
      details: { server_name: 'New Test Server', server_id: 'abc123' },
      ip_address: '192.168.1.1',
      user_agent: 'Admin Console',
      timestamp: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
      severity: 'low',
    },
    {
      id: '2',
      user_id: 'admin',
      user_email: 'admin@example.com',
      action: 'banner_updated',
      resource_type: 'notification_banner',
      resource_id: '45',
      details: { title: 'System Maintenance', type: 'warning' },
      ip_address: '192.168.1.1',
      user_agent: 'Admin Console',
      timestamp: new Date(Date.now() - 15 * 60 * 1000).toISOString(),
      severity: 'medium',
    },
    {
      id: '3',
      user_id: 'system',
      action: 'data_collection_completed',
      resource_type: 'data_collection',
      details: { server_count: 4, records_collected: 156 },
      ip_address: 'localhost',
      user_agent: 'System Process',
      timestamp: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
      severity: 'low',
    },
  ];

  return mockActivities;
}

async function getSystemHealth(supabase: any) {
  try {
    // Test database connection
    const { data: dbTest } = await supabase
      .from('server_xref')
      .select('id')
      .limit(1);
    
    const databaseHealth: 'healthy' | 'warning' | 'critical' = dbTest ? 'healthy' : 'critical';

    // Mock API and data collection health
    // In real implementation, these would check actual service status
    const apiHealth: 'healthy' | 'warning' | 'critical' = 'healthy';
    const dataCollectionHealth: 'healthy' | 'warning' | 'critical' = 'healthy';

    return {
      database: databaseHealth,
      api: apiHealth,
      data_collection: dataCollectionHealth,
    };
  } catch (error) {
    return {
      database: 'critical' as const,
      api: 'critical' as const, 
      data_collection: 'critical' as const,
    };
  }
}

async function getSystemAlerts(supabase: any): Promise<SystemAlert[]> {
  // Mock system alerts (in real implementation, these would come from monitoring systems)
  const mockAlerts: SystemAlert[] = [
    {
      id: '1',
      type: 'warning',
      title: 'High Memory Usage',
      message: 'Database memory usage is at 85%. Consider optimization.',
      timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
      resolved: false,
      severity: 'medium',
    },
    {
      id: '2', 
      type: 'info',
      title: 'Scheduled Maintenance',
      message: 'System maintenance is scheduled for tomorrow at 2 AM UTC.',
      timestamp: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
      resolved: false,
      severity: 'low',
    },
  ];

  return mockAlerts;
}