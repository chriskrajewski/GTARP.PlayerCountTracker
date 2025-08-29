import { NextRequest, NextResponse } from 'next/server';
import { validateAdminRequest } from '@/lib/admin-auth-server';
import { createServerClient } from '@/lib/supabase-server';
import { z } from 'zod';

const StatusUpdateSchema = z.object({
  is_active: z.boolean(),
});

// PUT - Toggle server status (active/inactive)
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ serverId: string }> }
) {
  try {
    if (!validateAdminRequest(request)) {
      return NextResponse.json(
        { success: false, error: 'Admin authentication required' },
        { status: 401 }
      );
    }

    const { serverId } = await params;
    const body = await request.json();
    const { is_active } = StatusUpdateSchema.parse(body);

    const supabase = createServerClient();

    // Check if server exists
    const { data: existingServer, error: fetchError } = await supabase
      .from('server_xref')
      .select('*')
      .eq('server_id', serverId)
      .single();

    if (fetchError || !existingServer) {
      return NextResponse.json(
        { success: false, error: 'Server not found' },
        { status: 404 }
      );
    }

    // Update server status
    const { data: updatedServer, error } = await supabase
      .from('server_xref')
      .update({ 
        is_active,
        updated_at: new Date().toISOString()
      })
      .eq('server_id', serverId)
      .select()
      .single();

    if (error) {
      console.error('Error updating server status:', error);
      return NextResponse.json(
        { success: false, error: 'Failed to update server status' },
        { status: 500 }
      );
    }

    // Transform response
    const transformedServer = {
      id: updatedServer.id,
      server_id: updatedServer.server_id,
      server_name: updatedServer.server_name,
      display_order: updatedServer.order,
      is_active: updatedServer.is_active,
      data_collection_enabled: updatedServer.data_collection_enabled,
      api_endpoint: updatedServer.api_endpoint,
      color_scheme: updatedServer.color_scheme,
      metadata: {
        description: updatedServer.description,
        category: updatedServer.category,
        tags: updatedServer.tags || [],
        owner: updatedServer.owner,
        contact_info: updatedServer.contact_info,
      },
      created_at: updatedServer.created_at,
      updated_at: updatedServer.updated_at,
    };

    return NextResponse.json({
      success: true,
      data: transformedServer,
      message: `Server ${is_active ? 'activated' : 'deactivated'} successfully`,
      timestamp: new Date().toISOString(),
    });

  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Validation failed', 
          details: error.errors 
        },
        { status: 400 }
      );
    }

    console.error('Server status update error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}