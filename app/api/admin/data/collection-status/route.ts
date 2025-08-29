import { NextRequest, NextResponse } from 'next/server';
import { validateAdminRequest } from '@/lib/admin-auth-server';
import { createServerClient } from '@/lib/supabase-server';
import { DataCollectionStatus } from '@/lib/admin-types';

export async function GET(request: NextRequest) {
  try {
    if (!validateAdminRequest(request)) {
      return NextResponse.json(
        { success: false, error: 'Admin authentication required' },
        { status: 401 }
      );
    }

    const supabase = createServerClient();

    // Get all servers from server_xref
    const { data: servers, error: serverError } = await supabase
      .from('server_xref')
      .select('server_id, server_name')
      .order('order', { ascending: true });

    if (serverError) {
      console.error('Error fetching servers:', serverError);
      return NextResponse.json(
        { success: false, error: 'Failed to fetch servers' },
        { status: 500 }
      );
    }

    const collectionStatuses: DataCollectionStatus[] = [];

    // For each server, get collection status
    for (const server of servers || []) {
      // Get latest data collection timestamp
      const { data: latestData } = await supabase
        .from('player_counts')
        .select('timestamp, created_at')
        .eq('server_id', server.server_id)
        .order('timestamp', { ascending: false })
        .limit(1)
        .single();

      // Get total record count
      const { count: totalRecords } = await supabase
        .from('player_counts')
        .select('*', { count: 'exact', head: true })
        .eq('server_id', server.server_id);

      // Get earliest record to determine data start date
      const { data: earliestData } = await supabase
        .from('player_counts')
        .select('timestamp')
        .eq('server_id', server.server_id)
        .order('timestamp', { ascending: true })
        .limit(1)
        .single();

      // Determine collection status
      const now = new Date();
      const lastCollection = latestData ? new Date(latestData.timestamp) : null;
      const timeSinceLastCollection = lastCollection 
        ? (now.getTime() - lastCollection.getTime()) / (1000 * 60) // minutes
        : null;

      let status: 'active' | 'inactive' | 'error';
      if (!lastCollection) {
        status = 'inactive';
      } else if (timeSinceLastCollection && timeSinceLastCollection > 60) { // More than 1 hour
        status = 'error';
      } else {
        status = 'active';
      }

      const collectionStatus: DataCollectionStatus = {
        server_id: server.server_id,
        server_name: server.server_name || server.server_id,
        last_collection: lastCollection?.toISOString() || 'Never',
        status,
        total_records: totalRecords || 0,
        data_start_date: earliestData?.timestamp || 'N/A',
        collection_frequency: 'Every 5 minutes',
        errors: [] // No error tracking table yet
      };

      collectionStatuses.push(collectionStatus);
    }

    return NextResponse.json({
      success: true,
      data: collectionStatuses,
      timestamp: new Date().toISOString(),
    });

  } catch (error) {
    console.error('Collection status API error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}