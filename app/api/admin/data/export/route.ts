import { NextRequest, NextResponse } from 'next/server';
import { validateAdminRequest } from '@/lib/admin-auth-server';
import { createServerClient } from '@/lib/supabase-server';
import { z } from 'zod';

const ExportDataSchema = z.object({
  server_ids: z.array(z.string()).optional(),
  start_date: z.string(),
  end_date: z.string(),
  format: z.enum(['csv', 'json']),
  data_types: z.array(z.enum(['player_counts', 'stream_data', 'viewer_data'])),
});

export async function POST(request: NextRequest) {
  try {
    if (!validateAdminRequest(request)) {
      return NextResponse.json(
        { success: false, error: 'Admin authentication required' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { server_ids, start_date, end_date, format, data_types } = ExportDataSchema.parse(body);

    const supabase = createServerClient();
    const exportData: any = {};

    // Export player counts data
    if (data_types.includes('player_counts')) {
      let query = supabase
        .from('player_counts')
        .select('*')
        .gte('timestamp', start_date)
        .lte('timestamp', end_date)
        .order('timestamp', { ascending: true });

      if (server_ids && server_ids.length > 0) {
        query = query.in('server_id', server_ids);
      }

      const { data: playerCounts, error: playerCountsError } = await query;

      if (playerCountsError) {
        console.error('Error fetching player counts:', playerCountsError);
        return NextResponse.json(
          { success: false, error: 'Failed to fetch player counts data' },
          { status: 500 }
        );
      }

      exportData.player_counts = playerCounts || [];
    }

    // Export stream data
    if (data_types.includes('stream_data')) {
      let streamQuery = supabase
        .from('twitch_streams')
        .select('*')
        .gte('created_at', start_date)
        .lte('created_at', end_date)
        .order('created_at', { ascending: true });

      if (server_ids && server_ids.length > 0) {
        streamQuery = streamQuery.in('serverId', server_ids);
      }

      const { data: streamData, error: streamError } = await streamQuery;

      if (streamError) {
        console.error('Error fetching stream data:', streamError);
        // Don't fail the entire export if streams fail
        exportData.stream_data = [];
      } else {
        exportData.stream_data = streamData || [];
      }
    }

    // Viewer data would come from a separate table if you have it
    if (data_types.includes('viewer_data')) {
      // Placeholder - you'd implement this based on your viewer tracking
      exportData.viewer_data = [];
    }

    // Format the data based on requested format
    let exportContent: string;
    let contentType: string;
    let filename: string;

    if (format === 'json') {
      exportContent = JSON.stringify(exportData, null, 2);
      contentType = 'application/json';
      filename = `data_export_${new Date().toISOString().split('T')[0]}.json`;
    } else {
      // CSV format - combine all data into a single CSV
      let csvContent = '';
      
      if (exportData.player_counts && exportData.player_counts.length > 0) {
        csvContent += 'Data Type,Server ID,Timestamp,Player Count,Created At\n';
        exportData.player_counts.forEach((record: any) => {
          csvContent += `player_counts,${record.server_id},${record.timestamp},${record.player_count},${record.created_at}\n`;
        });
        csvContent += '\n';
      }

      if (exportData.stream_data && exportData.stream_data.length > 0) {
        csvContent += 'Data Type,Server ID,Streamer Name,Stream Title,Viewer Count,Game Name,Created At\n';
        exportData.stream_data.forEach((record: any) => {
          csvContent += `stream_data,${record.serverId},${record.streamer_name},"${record.stream_title}",${record.viewer_count},${record.game_name},${record.created_at}\n`;
        });
      }

      exportContent = csvContent;
      contentType = 'text/csv';
      filename = `data_export_${new Date().toISOString().split('T')[0]}.csv`;
    }

    // In a real implementation, you might want to save this to a file storage service
    // and return a download URL instead of returning the content directly
    
    // For now, we'll return the content as a base64 encoded string
    const base64Content = Buffer.from(exportContent).toString('base64');
    
    // Calculate some statistics
    const totalRecords = Object.values(exportData).reduce((sum: number, dataArray: any) => {
      return sum + (Array.isArray(dataArray) ? dataArray.length : 0);
    }, 0);

    return NextResponse.json({
      success: true,
      data: {
        download_url: `data:${contentType};base64,${base64Content}`,
        filename,
        format,
        size_bytes: Buffer.from(exportContent).length,
        total_records: totalRecords,
        data_types_included: data_types,
        date_range: {
          start_date,
          end_date,
        },
        server_count: server_ids ? server_ids.length : 'all',
        generated_at: new Date().toISOString(),
      },
      timestamp: new Date().toISOString(),
    });

  } catch (error) {
    console.error('Data export API error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}