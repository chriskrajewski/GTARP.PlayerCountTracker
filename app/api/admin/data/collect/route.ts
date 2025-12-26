import { NextRequest, NextResponse } from 'next/server';
import { validateAdminRequest } from '@/lib/admin-auth-server';
import { createServerClient } from '@/lib/supabase-server';
import { z } from 'zod';

const CollectDataSchema = z.object({
  server_id: z.string().optional(),
});

export async function POST(request: NextRequest) {
  try {
    if (!validateAdminRequest(request)) {
      return NextResponse.json(
        { success: false, error: 'Admin authentication required' },
        { status: 401 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const { server_id } = CollectDataSchema.parse(body);

    const supabase = createServerClient();

    // If server_id is specified, trigger collection for that server only
    // Otherwise trigger for all servers
    let servers;
    if (server_id) {
      const { data } = await supabase
        .from('server_xref')
        .select('server_id, server_name')
        .eq('server_id', server_id)
        .single();
      servers = data ? [data] : [];
    } else {
      const { data } = await supabase
        .from('server_xref')
        .select('server_id, server_name')
        .order('order', { ascending: true });
      servers = data || [];
    }

    if (servers.length === 0) {
      return NextResponse.json(
        { success: false, error: 'No servers found' },
        { status: 404 }
      );
    }

    // This would trigger your actual data collection process
    // Since this is a manual trigger, we'll just check when the last collection happened
    const collectionResults = [];

    for (const server of servers) {
      try {
        // Get the latest data collection timestamp for this server
        // @ts-ignore - Supabase type inference issue with server_xref table
        const { data: latestData } = await supabase
          .from('player_counts')
          .select('timestamp, player_count')
          // @ts-ignore
          .eq('server_id', server.server_id)
          .order('timestamp', { ascending: false })
          .limit(1)
          .single();

        // @ts-ignore
        const lastCollection = latestData ? new Date(latestData.timestamp) : null;
        const now = new Date();
        const timeSinceLastCollection = lastCollection 
          ? (now.getTime() - lastCollection.getTime()) / (1000 * 60) // minutes
          : null;

        collectionResults.push({
          // @ts-ignore
          server_id: server.server_id,
          // @ts-ignore
          server_name: server.server_name,
          status: 'checked',
          last_collection: lastCollection?.toISOString() || 'Never',
          minutes_since_last: timeSinceLastCollection ? Math.floor(timeSinceLastCollection) : null,
          // @ts-ignore
          last_player_count: latestData?.player_count || 0,
        });
      } catch (serverError) {
        // @ts-ignore
        console.error(`Collection check error for ${server.server_id}:`, serverError);
        collectionResults.push({
          // @ts-ignore
          server_id: server.server_id,
          // @ts-ignore
          server_name: server.server_name,
          status: 'error',
          error: serverError instanceof Error ? serverError.message : 'Unknown error',
        });
      }
    }

    const checkedCount = collectionResults.filter(r => r.status === 'checked').length;
    const errorCount = collectionResults.filter(r => r.status === 'error').length;

    return NextResponse.json({
      success: true,
      data: {
        message: `Data collection status checked for ${servers.length} server(s)`,
        summary: {
          total_servers: servers.length,
          checked: checkedCount,
          errors: errorCount,
        },
        results: collectionResults,
        note: 'This endpoint checks collection status. Actual data collection happens via scheduled jobs.',
      },
      timestamp: new Date().toISOString(),
    });

  } catch (error) {
    console.error('Data collection API error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}