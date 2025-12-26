import { NextRequest, NextResponse } from 'next/server';
import { validateAdminRequest } from '@/lib/admin-auth-server';
import { createServerClient } from '@/lib/supabase-server';
import { ServerConfiguration, ServerFormData, PaginatedResponse } from '@/lib/admin-types';
import { z } from 'zod';
import { rateLimit, RATE_LIMIT_TIERS } from '@/lib/rate-limiter';
import { createCachedResponse, parsePaginationParams, createErrorResponse } from '@/lib/api-utils';
import { auditAdminAction, auditConfigChange } from '@/lib/audit';
import { logger } from '@/lib/logger';

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
  const reqLogger = logger.child({ endpoint: '/api/admin/servers', method: 'GET' });
  
  try {
    reqLogger.debug('Admin servers API called');
    
    // Apply rate limiting
    const rateLimitResponse = await rateLimit(request, {
      ...RATE_LIMIT_TIERS.standard,
      identifier: 'admin-servers',
    });
    if (rateLimitResponse) return rateLimitResponse;
    
    if (!validateAdminRequest(request)) {
      reqLogger.warn('Admin authentication failed');
      await auditAdminAction(request, 'unauthorized_access', 'Failed admin authentication attempt on servers endpoint', {
        success: false,
      });
      return createErrorResponse('Admin authentication required', 401);
    }
    
    reqLogger.debug('Admin authentication successful');
    
    // Audit the access
    await auditAdminAction(request, 'admin_access', 'Admin accessed servers list');

    const { searchParams } = new URL(request.url);
    const pagination = parsePaginationParams(request, { limit: 20, maxLimit: 100 });
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
    query = query
      .order('"order"', { ascending: true })
      .range(pagination.offset, pagination.offset + pagination.limit - 1);

    const { data: servers, error } = await query;
    
    reqLogger.debug('Database query result', { count: servers?.length, error: error?.message });

    if (error) {
      reqLogger.error('Error fetching servers', error);
      return createErrorResponse('Failed to fetch servers', 500);
    }

    // Transform server data to match ServerConfiguration interface
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
      page: pagination.page,
      limit: pagination.limit,
      totalPages: Math.ceil((totalCount || 0) / pagination.limit),
    };

    const responseData = {
      success: true,
      data: response,
      timestamp: new Date().toISOString(),
    };

    // Return cached response with ETag support
    return createCachedResponse(responseData, request, {
      maxAge: 30, // Cache for 30 seconds
      staleWhileRevalidate: 60,
    });

  } catch (error) {
    reqLogger.error('Servers API error', error);
    return createErrorResponse('Internal server error', 500);
  }
}

// POST - Create new server
export async function POST(request: NextRequest) {
  const reqLogger = logger.child({ endpoint: '/api/admin/servers', method: 'POST' });
  
  try {
    // Apply stricter rate limiting for write operations
    const rateLimitResponse = await rateLimit(request, {
      ...RATE_LIMIT_TIERS.strict,
      identifier: 'admin-servers-create',
    });
    if (rateLimitResponse) return rateLimitResponse;
    
    if (!validateAdminRequest(request)) {
      await auditAdminAction(request, 'unauthorized_access', 'Failed admin authentication attempt on server creation', {
        success: false,
      });
      return createErrorResponse('Admin authentication required', 401);
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
      await auditConfigChange(request, 'data_create', 'Attempted to create server with duplicate ID', {
        resource: 'server',
        resourceId: validatedData.server_id,
        success: false,
      });
      return createErrorResponse('Server ID already exists', 400);
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
      reqLogger.error('Error creating server', error);
      await auditConfigChange(request, 'data_create', `Failed to create server: ${error.message}`, {
        resource: 'server',
        resourceId: validatedData.server_id,
        success: false,
        errorMessage: error.message,
      });
      return createErrorResponse('Failed to create server', 500);
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

    // Audit the successful creation
    await auditConfigChange(request, 'data_create', `Created new server: ${validatedData.server_name}`, {
      resource: 'server',
      resourceId: validatedData.server_id,
      metadata: {
        serverName: validatedData.server_name,
        isActive: validatedData.is_active,
        dataCollectionEnabled: validatedData.data_collection_enabled,
      },
    });

    // Transform response to match ServerConfiguration interface
    // @ts-ignore
    const transformedServer: ServerConfiguration = {
      // @ts-ignore
      id: newServer.id,
      // @ts-ignore
      server_id: newServer.server_id,
      // @ts-ignore
      server_name: newServer.server_name,
      // @ts-ignore
      display_order: newServer.order,
      // @ts-ignore
      is_active: newServer.is_active,
      // @ts-ignore
      data_collection_enabled: newServer.data_collection_enabled,
      // @ts-ignore
      api_endpoint: newServer.api_endpoint,
      // @ts-ignore
      color_scheme: newServer.color_scheme,
      metadata: {
        // @ts-ignore
        description: newServer.description,
        // @ts-ignore
        category: newServer.category,
        // @ts-ignore
        tags: newServer.tags || [],
        // @ts-ignore
        owner: newServer.owner,
        // @ts-ignore
        contact_info: newServer.contact_info,
      },
      // @ts-ignore
      created_at: newServer.created_at,
      // @ts-ignore
      updated_at: newServer.updated_at,
    };

    reqLogger.info('Server created successfully', { serverId: validatedData.server_id });

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

    reqLogger.error('Server creation error', error);
    return createErrorResponse('Internal server error', 500);
  }
}