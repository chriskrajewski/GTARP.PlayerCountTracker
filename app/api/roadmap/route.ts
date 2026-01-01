import { NextRequest, NextResponse } from 'next/server';
import { createBrowserClient } from '@/lib/supabase-browser';
import { createServiceRoleClient } from '@/lib/supabase-service-role';
import type { Database } from '@/lib/supabase.types';
import { validateAdminRequest } from '@/lib/admin-auth-server';
import { z } from 'zod';

// Type definitions
type RoadmapItem = Database['public']['Tables']['roadmap_items']['Row'];
type RoadmapItemInsert = Database['public']['Tables']['roadmap_items']['Insert'];
type RoadmapItemUpdate = Partial<RoadmapItemInsert>;

// Preprocess data to clean empty strings
function cleanRoadmapData(data: any) {
  const cleanData = { ...data };
  
  // Convert empty strings to undefined for optional fields
  const optionalFields = [
    'description_markdown', 'category', 'created_by'
  ];
  
  optionalFields.forEach(field => {
    if (cleanData[field] === '' || cleanData[field] === null) {
      cleanData[field] = undefined;
    }
  });
  
  return cleanData;
}

// Validation schema
const CreateRoadmapSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().min(1).max(5000),
  description_markdown: z.string().max(10000).optional(),
  status: z.enum(['planned', 'in_progress', 'completed', 'cancelled']).default('planned'),
  priority: z.number().int().min(1).max(10).default(1),
  category: z.string().max(100).optional(),
  is_published: z.boolean().default(false),
  display_order: z.number().int().default(0),
  created_by: z.string().optional(),
});

const UpdateRoadmapSchema = CreateRoadmapSchema.partial();

// Helper function to get user ID from request
function getUserId(request: NextRequest): string {
  const forwarded = request.headers.get('x-forwarded-for');
  const ip = forwarded ? forwarded.split(',')[0] : '127.0.0.1';
  const userAgent = request.headers.get('user-agent') || 'unknown';
  return `guest_${Buffer.from(ip + userAgent).toString('base64').slice(0, 16)}`;
}

// GET - Fetch published roadmap items or all for admin
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const includeUnpublished = searchParams.get('include_unpublished') === 'true';
    const status = searchParams.get('status');
    const category = searchParams.get('category');
    const sortBy = searchParams.get('sort_by') || 'display_order'; // display_order, vote_count, priority
    const limit = parseInt(searchParams.get('limit') || '100');
    const offset = parseInt(searchParams.get('offset') || '0');

    // Admin-only features require authentication
    if (includeUnpublished && !validateAdminRequest(request)) {
      return NextResponse.json(
        { error: 'Admin authentication required' },
        { status: 401 }
      );
    }

    // Use browser client for public reads (RLS will handle permissions)
    const supabase = createBrowserClient();

    let query = supabase
      .from('roadmap_items')
      .select('*', { count: 'exact' });

    if (!includeUnpublished) {
      query = query.eq('is_published', true);
    }

    if (status) {
      query = query.eq('status', status);
    }

    if (category) {
      query = query.eq('category', category);
    }

    // Determine sort order
    let orderBy = 'display_order';
    let ascending = true;
    if (sortBy === 'vote_count') {
      orderBy = 'vote_count';
      ascending = false;
    } else if (sortBy === 'priority') {
      orderBy = 'priority';
      ascending = false;
    }

    const { data: items, error, count } = await query
      .order(orderBy, { ascending })
      .range(offset, offset + limit - 1);

    if (error) {
      console.error('Error fetching roadmap items:', error);
      return NextResponse.json(
        { error: 'Failed to fetch roadmap items' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      items: items || [],
      total: count || 0,
      limit,
      offset,
    });

  } catch (error) {
    console.error('Unexpected error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// POST - Create new roadmap item
export async function POST(request: NextRequest) {
  try {
    // Require admin authentication
    if (!validateAdminRequest(request)) {
      return NextResponse.json(
        { error: 'Admin authentication required' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const cleanedData = cleanRoadmapData(body);
    const validated = CreateRoadmapSchema.parse(cleanedData);

    const itemData: RoadmapItemInsert = {
      ...validated,
      created_by: validated.created_by || getUserId(request),
    };

    // Use service role client for admin writes
    const supabase = createServiceRoleClient();

    const { data, error } = await supabase
      .from('roadmap_items')
      .insert(itemData)
      .select()
      .single();

    if (error) {
      console.error('Error creating roadmap item:', error);
      return NextResponse.json(
        { error: 'Failed to create roadmap item' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      item: data,
      message: 'Roadmap item created successfully',
    }, { status: 201 });

  } catch (error) {
    if (error instanceof z.ZodError) {
      console.error('Roadmap creation validation error:', error.errors);
      return NextResponse.json(
        { 
          error: 'Validation failed', 
          details: error.errors,
          message: 'Please check the form data and try again'
        },
        { status: 400 }
      );
    }

    console.error('Unexpected error creating roadmap item:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// PUT - Update existing roadmap item
export async function PUT(request: NextRequest) {
  try {
    // Require admin authentication
    if (!validateAdminRequest(request)) {
      return NextResponse.json(
        { error: 'Admin authentication required' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const itemId = searchParams.get('id');

    if (!itemId) {
      return NextResponse.json(
        { error: 'Roadmap item ID is required' },
        { status: 400 }
      );
    }

    const body = await request.json();
    const cleanedData = cleanRoadmapData(body);
    const validated = UpdateRoadmapSchema.parse(cleanedData);

    // Use service role client for admin writes
    const supabase = createServiceRoleClient();

    const { data, error } = await supabase
      .from('roadmap_items')
      .update(validated)
      .eq('id', parseInt(itemId))
      .select()
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json(
          { error: 'Roadmap item not found' },
          { status: 404 }
        );
      }

      console.error('Error updating roadmap item:', error);
      return NextResponse.json(
        { error: 'Failed to update roadmap item' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      item: data,
      message: 'Roadmap item updated successfully',
    });

  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation failed', details: error.errors },
        { status: 400 }
      );
    }

    console.error('Unexpected error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// DELETE - Delete roadmap item
export async function DELETE(request: NextRequest) {
  try {
    // Require admin authentication
    if (!validateAdminRequest(request)) {
      return NextResponse.json(
        { error: 'Admin authentication required' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const itemId = searchParams.get('id');

    if (!itemId) {
      return NextResponse.json(
        { error: 'Roadmap item ID is required' },
        { status: 400 }
      );
    }

    // Use service role client for admin writes
    const supabase = createServiceRoleClient();

    const { error } = await supabase
      .from('roadmap_items')
      .delete()
      .eq('id', parseInt(itemId));

    if (error) {
      console.error('Error deleting roadmap item:', error);
      return NextResponse.json(
        { error: 'Failed to delete roadmap item' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      message: 'Roadmap item deleted successfully',
    });

  } catch (error) {
    console.error('Unexpected error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
