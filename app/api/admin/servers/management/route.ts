import { NextRequest, NextResponse } from 'next/server';
import { validateAdminRequest } from '@/lib/admin-auth-server';
import { createServiceRoleClient } from '@/lib/supabase-service-role';

/**
 * Enhanced server management endpoint that fetches servers with all related data
 * including data_start dates, server_colors, and stream_search_config
 */

export interface ServerManagementData {
  id: number;
  server_id: string;
  server_name: string;
  order: number | null;
  created_at: string;
  data_start_date: string | null;
  server_colors: {
    color_hsl: string;
  } | null;
  stream_search_config: Array<{
    id: string;
    platform: 'twitch' | 'kick';
    search_keyword: string;
    search_type: 'title' | 'category' | 'tag';
    is_active: boolean;
    priority: number;
  }>;
}

// GET - Fetch all servers with related data
export async function GET(request: NextRequest) {
  try {
    if (!validateAdminRequest(request)) {
      return NextResponse.json(
        { success: false, error: 'Admin authentication required' },
        { status: 401 }
      );
    }

    const supabase = createServiceRoleClient();

    // Fetch all servers from server_xref
    const { data: servers, error: serversError } = await supabase
      .from('server_xref')
      .select('*')
      .order('order', { ascending: true });

    if (serversError) {
      console.error('Error fetching servers:', serversError);
      return NextResponse.json(
        { success: false, error: 'Failed to fetch servers' },
        { status: 500 }
      );
    }

    if (!servers || servers.length === 0) {
      return NextResponse.json({
        success: true,
        data: [],
        timestamp: new Date().toISOString(),
      });
    }

    // Fetch data_start dates for all servers
    const { data: dataStartDates } = await supabase
      .from('data_start')
      .select('server_id, start_date');

    // Fetch server colors for all servers
    const { data: serverColors } = await supabase
      .from('server_colors')
      .select('server_id, color_hsl');

    // Fetch stream search config for all servers
    const { data: streamConfigs } = await supabase
      .from('stream_search_config')
      .select('id, server_id, platform, search_keyword, search_type, is_active, priority');

    // Create lookup maps for efficient data joining
    const dataStartMap = new Map(
      (dataStartDates || []).map(d => [d.server_id, d.start_date])
    );

    const serverColorsMap = new Map(
      (serverColors || []).map(c => [c.server_id, { color_hsl: c.color_hsl }])
    );

    const streamConfigMap = new Map<string, any[]>();
    (streamConfigs || []).forEach(config => {
      if (!streamConfigMap.has(config.server_id)) {
        streamConfigMap.set(config.server_id, []);
      }
      streamConfigMap.get(config.server_id)!.push({
        id: config.id,
        platform: config.platform,
        search_keyword: config.search_keyword,
        search_type: config.search_type,
        is_active: config.is_active,
        priority: config.priority,
      });
    });

    // Combine all data
    const managementData: ServerManagementData[] = servers.map(server => ({
      id: server.id,
      server_id: server.server_id,
      server_name: server.server_name,
      order: server.order,
      created_at: server.created_at,
      data_start_date: dataStartMap.get(server.server_id) || null,
      server_colors: serverColorsMap.get(server.server_id) || null,
      stream_search_config: streamConfigMap.get(server.server_id) || [],
    }));

    return NextResponse.json({
      success: true,
      data: managementData,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Server management API error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// PUT - Update server management data (data_start, colors, stream_search_config)
export async function PUT(request: NextRequest) {
  try {
    if (!validateAdminRequest(request)) {
      return NextResponse.json(
        { success: false, error: 'Admin authentication required' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const {
      server_id,
      data_start_date,
      server_colors,
      stream_search_config,
    } = body;

    if (!server_id) {
      return NextResponse.json(
        { success: false, error: 'server_id is required' },
        { status: 400 }
      );
    }

    const supabase = createServiceRoleClient();

    // Update data_start if provided
    if (data_start_date !== undefined) {
      const { error: dataStartError } = await supabase
        .from('data_start')
        .upsert({
          server_id,
          start_date: data_start_date,
        });

      if (dataStartError) {
        console.error('Error updating data_start:', dataStartError);
        return NextResponse.json(
          { success: false, error: 'Failed to update data_start_date' },
          { status: 500 }
        );
      }
    }

    // Update server_colors if provided
    if (server_colors !== undefined) {
      const { error: colorsError } = await supabase
        .from('server_colors')
        .upsert({
          server_id,
          color_hsl: server_colors.color_hsl,
        });

      if (colorsError) {
        console.error('Error updating server_colors:', colorsError);
        return NextResponse.json(
          { success: false, error: 'Failed to update server_colors' },
          { status: 500 }
        );
      }
    }

    // Update stream_search_config if provided
    if (stream_search_config !== undefined && Array.isArray(stream_search_config)) {
      // Delete existing configs for this server
      await supabase
        .from('stream_search_config')
        .delete()
        .eq('server_id', server_id);

      // Insert new configs
      if (stream_search_config.length > 0) {
        const { error: configError } = await supabase
          .from('stream_search_config')
          .insert(
            stream_search_config.map(config => ({
              server_id,
              platform: config.platform,
              search_keyword: config.search_keyword,
              search_type: config.search_type,
              is_active: config.is_active,
              priority: config.priority,
            }))
          );

        if (configError) {
          console.error('Error updating stream_search_config:', configError);
          return NextResponse.json(
            { success: false, error: 'Failed to update stream_search_config' },
            { status: 500 }
          );
        }
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Server management data updated successfully',
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Server management update error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

