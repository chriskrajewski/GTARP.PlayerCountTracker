import { NextRequest, NextResponse } from 'next/server';
import { validateAdminRequest } from '@/lib/admin-auth-server';
import { createServerClient } from '@/lib/supabase-server';
import { ServerConfiguration, ServerFormData } from '@/lib/admin-types';
import { z } from 'zod';

const ServerUpdateSchema = z.object({
  server_name: z.string().min(1).max(100).optional(),
  is_active: z.boolean().optional(),
  data_collection_enabled: z.boolean().optional(),
  display_order: z.number().int().min(1).optional(),
  api_endpoint: z.string().url().optional().or(z.literal('')),
  description: z.string().optional(),
  category: z.string().optional(),
  tags: z.array(z.string()).optional(),
  owner: z.string().optional(),
  contact_info: z.string().optional(),
  color_primary: z.string().regex(/^#[0-9A-F]{6}$/i).optional(),
  color_secondary: z.string().regex(/^#[0-9A-F]{6}$/i).optional(),
  color_accent: z.string().regex(/^#[0-9A-F]{6}$/i).optional(),
});

// GET - Fetch single server
export async function GET(
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
    const supabase = createServerClient();

    const { data: server, error } = await supabase
      .from('server_xref')
      .select('*')
      .eq('server_id', serverId)
      .single();

    if (error || !server) {
      return NextResponse.json(
        { success: false, error: 'Server not found' },
        { status: 404 }
      );
    }

    // Transform to ServerConfiguration interface
    const transformedServer: ServerConfiguration = {
      id: server.id,
      server_id: server.server_id,
      server_name: server.server_name,
      display_order: server.order || 1,
      is_active: server.is_active !== false,
      data_collection_enabled: server.data_collection_enabled !== false,
      api_endpoint: server.api_endpoint,
      color_scheme: server.color_scheme,
      metadata: {
        description: server.description,
        category: server.category,
        tags: server.tags || [],
        owner: server.owner,
        contact_info: server.contact_info,
      },
      created_at: server.created_at || new Date().toISOString(),
      updated_at: server.updated_at || new Date().toISOString(),
    };

    return NextResponse.json({
      success: true,
      data: transformedServer,
      timestamp: new Date().toISOString(),
    });

  } catch (error) {
    console.error('Server fetch error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// PUT - Update server
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
    const validatedData = ServerUpdateSchema.parse(body);

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

    // Prepare update data
    const updateData: any = {
      updated_at: new Date().toISOString(),
    };

    if (validatedData.server_name) updateData.server_name = validatedData.server_name;
    if (validatedData.is_active !== undefined) updateData.is_active = validatedData.is_active;
    if (validatedData.data_collection_enabled !== undefined) {
      updateData.data_collection_enabled = validatedData.data_collection_enabled;
    }
    if (validatedData.display_order) updateData.order = validatedData.display_order;
    if (validatedData.api_endpoint !== undefined) {
      updateData.api_endpoint = validatedData.api_endpoint || null;
    }
    if (validatedData.description !== undefined) updateData.description = validatedData.description;
    if (validatedData.category !== undefined) updateData.category = validatedData.category;
    if (validatedData.tags !== undefined) updateData.tags = validatedData.tags;
    if (validatedData.owner !== undefined) updateData.owner = validatedData.owner;
    if (validatedData.contact_info !== undefined) updateData.contact_info = validatedData.contact_info;

    // Handle color scheme updates
    if (validatedData.color_primary || validatedData.color_secondary || validatedData.color_accent) {
      updateData.color_scheme = {
        primary: validatedData.color_primary || existingServer.color_scheme?.primary || '#9147ff',
        secondary: validatedData.color_secondary || existingServer.color_scheme?.secondary || '#772ce8',
        accent: validatedData.color_accent || existingServer.color_scheme?.accent || '#5a1fb8',
      };
    }

    const { data: updatedServer, error } = await supabase
      .from('server_xref')
      .update(updateData)
      .eq('server_id', serverId)
      .select()
      .single();

    if (error) {
      console.error('Error updating server:', error);
      return NextResponse.json(
        { success: false, error: 'Failed to update server' },
        { status: 500 }
      );
    }

    // Update server_colors table if colors were provided
    if (validatedData.color_primary) {
      await supabase
        .from('server_colors')
        .upsert({
          server_id: serverId,
          color_hsl: validatedData.color_primary,
        });
    }

    // Transform response
    const transformedServer: ServerConfiguration = {
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
      message: 'Server updated successfully',
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

    console.error('Server update error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// DELETE - Delete server
export async function DELETE(
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

    // Delete associated data first (to maintain referential integrity)
    
    // Delete player counts
    await supabase
      .from('player_counts')
      .delete()
      .eq('server_id', serverId);

    // Delete twitch streams
    await supabase
      .from('twitch_streams')
      .delete()
      .eq('serverId', serverId);

    // Delete server colors
    await supabase
      .from('server_colors')
      .delete()
      .eq('server_id', serverId);

    // Delete data start record
    await supabase
      .from('data_start')
      .delete()
      .eq('server_id', serverId);

    // Finally delete the server itself
    const { error: deleteError } = await supabase
      .from('server_xref')
      .delete()
      .eq('server_id', serverId);

    if (deleteError) {
      console.error('Error deleting server:', deleteError);
      return NextResponse.json(
        { success: false, error: 'Failed to delete server' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Server deleted successfully',
      timestamp: new Date().toISOString(),
    });

  } catch (error) {
    console.error('Server deletion error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}