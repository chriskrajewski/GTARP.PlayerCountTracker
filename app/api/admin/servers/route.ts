import { NextRequest, NextResponse } from 'next/server';
import { validateAdminRequest } from '@/lib/admin-auth-server';
import { createServerClient } from '@/lib/supabase-server';
import { ServerConfiguration, ServerFormData, PaginatedResponse } from '@/lib/admin-types';
import { z } from 'zod';

// Validation schema for server data
const ServerFormSchema = z.object({
  server_name: z.string().min(1).max(100),
  server_id: z.string().min(1).max(50).regex(/^[a-zA-Z0-9_-]+$/),
  is_active: z.boolean().default(true),
  data_collection_enabled: z.boolean().default(true),
  display_order: z.number().int().min(1).default(1),
  api_endpoint: z.string().url().optional().or(z.literal('')),
  description: z.string().optional(),
  category: z.string().optional(),
  tags: z.array(z.string()).default([]),
  owner: z.string().optional(),
  contact_info: z.string().optional(),
  color_primary: z.string().regex(/^#[0-9A-F]{6}$/i).optional(),
  color_secondary: z.string().regex(/^#[0-9A-F]{6}$/i).optional(),
  color_accent: z.string().regex(/^#[0-9A-F]{6}$/i).optional(),
});

// GET - Fetch servers with pagination and filtering
export async function GET(request: NextRequest) {
  try {
    console.log('Admin servers API called');
    
    if (!validateAdminRequest(request)) {
      console.log('Admin authentication failed');
      return NextResponse.json(
        { success: false, error: 'Admin authentication required' },
        { status: 401 }
      );
    }
    
    console.log('Admin authentication successful');

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const search = searchParams.get('search');
    const status = searchParams.get('status');

    const supabase = createServerClient();
    
    let query = supabase
      .from('server_xref')
      .select('*');

    // Apply search filter
    if (search) {
      query = query.or(`server_name.ilike.%${search}%,server_id.ilike.%${search}%`);
    }

    // Apply status filter
    if (status === 'active') {
      query = query.eq('is_active', true);
    } else if (status === 'inactive') {
      query = query.eq('is_active', false);
    }

    // Get total count for pagination
    const { count: totalCount } = await supabase
      .from('server_xref')
      .select('*', { count: 'exact', head: true });

    // Apply pagination and ordering
    const offset = (page - 1) * limit;
    query = query
      .order('"order"', { ascending: true })
      .range(offset, offset + limit - 1);

    const { data: servers, error } = await query;
    
    console.log('Database query result:', { servers, error, count: servers?.length });

    if (error) {
      console.error('Error fetching servers:', error);
      return NextResponse.json(
        { success: false, error: 'Failed to fetch servers' },
        { status: 500 }
      );
    }

    // Transform server data to match ServerConfiguration interface
    console.log('Raw server data sample:', servers?.[0]);
    const transformedServers: ServerConfiguration[] = (servers || []).map(server => ({
      id: server.id,
      server_id: server.server_id || '',
      server_name: server.server_name || 'Unknown Server',
      display_order: server["order"] || 1,
      is_active: true, // Default to true (no is_active column in current schema)
      data_collection_enabled: true, // Default to true (no column in current schema)
      api_endpoint: '', // Not in current schema
      color_scheme: {
        primary: '#9147ff',
        secondary: '#772ce8', 
        accent: '#5a1fb8',
      },
      metadata: {
        description: `${server.server_name || 'Unknown Server'} - GTA RP Server`,
        category: 'GTA RP',
        tags: [],
        owner: '',
        contact_info: '',
      },
      created_at: server.created_at || new Date().toISOString(),
      updated_at: server.created_at || new Date().toISOString(), // Use created_at as fallback
    }));

    const response: PaginatedResponse<ServerConfiguration> = {
      items: transformedServers,
      total: totalCount || 0,
      page,
      limit,
      totalPages: Math.ceil((totalCount || 0) / limit),
    };

    return NextResponse.json({
      success: true,
      data: response,
      timestamp: new Date().toISOString(),
    });

  } catch (error) {
    console.error('Servers API error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// POST - Create new server
export async function POST(request: NextRequest) {
  try {
    if (!validateAdminRequest(request)) {
      return NextResponse.json(
        { success: false, error: 'Admin authentication required' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const validatedData = ServerFormSchema.parse(body);

    const supabase = createServerClient();

    // Check if server_id already exists
    const { data: existingServer } = await supabase
      .from('server_xref')
      .select('server_id')
      .eq('server_id', validatedData.server_id)
      .single();

    if (existingServer) {
      return NextResponse.json(
        { success: false, error: 'Server ID already exists' },
        { status: 400 }
      );
    }

    // Prepare server data for insertion
    const serverData = {
      server_id: validatedData.server_id,
      server_name: validatedData.server_name,
      order: validatedData.display_order,
      is_active: validatedData.is_active,
      data_collection_enabled: validatedData.data_collection_enabled,
      api_endpoint: validatedData.api_endpoint || null,
      description: validatedData.description || null,
      category: validatedData.category || null,
      tags: validatedData.tags,
      owner: validatedData.owner || null,
      contact_info: validatedData.contact_info || null,
      color_scheme: validatedData.color_primary ? {
        primary: validatedData.color_primary,
        secondary: validatedData.color_secondary || validatedData.color_primary,
        accent: validatedData.color_accent || validatedData.color_primary,
      } : null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const { data: newServer, error } = await supabase
      .from('server_xref')
      .insert(serverData)
      .select()
      .single();

    if (error) {
      console.error('Error creating server:', error);
      return NextResponse.json(
        { success: false, error: 'Failed to create server' },
        { status: 500 }
      );
    }

    // Also create a server_colors entry if colors were provided
    if (validatedData.color_primary) {
      await supabase
        .from('server_colors')
        .upsert({
          server_id: validatedData.server_id,
          color_hsl: validatedData.color_primary,
        });
    }

    // Create data_start entry to track when data collection begins
    await supabase
      .from('data_start')
      .upsert({
        server_id: validatedData.server_id,
        start_date: new Date().toISOString(),
      });

    // Transform response to match ServerConfiguration interface
    const transformedServer: ServerConfiguration = {
      id: newServer.id,
      server_id: newServer.server_id,
      server_name: newServer.server_name,
      display_order: newServer.order,
      is_active: newServer.is_active,
      data_collection_enabled: newServer.data_collection_enabled,
      api_endpoint: newServer.api_endpoint,
      color_scheme: newServer.color_scheme,
      metadata: {
        description: newServer.description,
        category: newServer.category,
        tags: newServer.tags || [],
        owner: newServer.owner,
        contact_info: newServer.contact_info,
      },
      created_at: newServer.created_at,
      updated_at: newServer.updated_at,
    };

    return NextResponse.json({
      success: true,
      data: transformedServer,
      message: 'Server created successfully',
      timestamp: new Date().toISOString(),
    }, { status: 201 });

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

    console.error('Server creation error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}