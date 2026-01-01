import { NextRequest, NextResponse } from 'next/server';
import { createBrowserClient } from '@/lib/supabase-browser';
import { createServiceRoleClient } from '@/lib/supabase-service-role';
import type { Database } from '@/lib/supabase.types';
import { validateAdminRequest } from '@/lib/admin-auth-server';
import { z } from 'zod';

// Type definitions
type SiteUpdate = Database['public']['Tables']['site_updates']['Row'];
type SiteUpdateInsert = Database['public']['Tables']['site_updates']['Insert'];
type SiteUpdateUpdate = Partial<SiteUpdateInsert>;

// Preprocess data to clean empty strings and handle markdown
function cleanUpdateData(data: any) {
  const cleanData = { ...data };
  
  // Convert empty strings to undefined for optional fields
  const optionalFields = [
    'content_markdown', 'publish_date', 'created_by', 'tags'
  ];
  
  optionalFields.forEach(field => {
    if (cleanData[field] === '' || cleanData[field] === null) {
      cleanData[field] = undefined;
    }
  });
  
  return cleanData;
}

// Validation schema
const CreateUpdateSchema = z.object({
  title: z.string().min(1).max(200),
  content: z.string().min(1).max(5000),
  content_markdown: z.string().max(10000).optional(),
  type: z.enum(['feature', 'improvement', 'bugfix', 'announcement']).default('announcement'),
  priority: z.number().int().min(1).max(10).default(1),
  is_published: z.boolean().default(false),
  publish_date: z.string().datetime().optional(),
  tags: z.array(z.string()).optional(),
  created_by: z.string().optional(),
});

const UpdateUpdateSchema = CreateUpdateSchema.partial();

// Helper function to get user ID from request
function getUserId(request: NextRequest): string {
  const forwarded = request.headers.get('x-forwarded-for');
  const ip = forwarded ? forwarded.split(',')[0] : '127.0.0.1';
  const userAgent = request.headers.get('user-agent') || 'unknown';
  return `guest_${Buffer.from(ip + userAgent).toString('base64').slice(0, 16)}`;
}

// GET - Fetch published updates or all updates for admin
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const includeUnpublished = searchParams.get('include_unpublished') === 'true';
    const type = searchParams.get('type');
    const limit = parseInt(searchParams.get('limit') || '50');
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
      .from('site_updates')
      .select('*', { count: 'exact' });

    if (!includeUnpublished) {
      const now = new Date().toISOString();
      query = query
        .eq('is_published', true)
        .or(`publish_date.is.null,publish_date.lte.${now}`);
    }

    if (type) {
      query = query.eq('type', type);
    }

    const { data: updates, error, count } = await query
      .order('publish_date', { ascending: false })
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      console.error('Error fetching updates:', error);
      return NextResponse.json(
        { error: 'Failed to fetch updates' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      updates: updates || [],
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

// POST - Create new update
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
    const cleanedData = cleanUpdateData(body);
    const validated = CreateUpdateSchema.parse(cleanedData);

    // Validate date logic
    if (validated.publish_date) {
      const publishDate = new Date(validated.publish_date);
      if (isNaN(publishDate.getTime())) {
        return NextResponse.json(
          { error: 'Invalid publish date' },
          { status: 400 }
        );
      }
    }

    const updateData: SiteUpdateInsert = {
      ...validated,
      created_by: validated.created_by || getUserId(request),
    };

    // Use service role client for admin writes
    const supabase = createServiceRoleClient();

    const { data, error } = await supabase
      .from('site_updates')
      .insert(updateData)
      .select()
      .single();

    if (error) {
      console.error('Error creating update:', error);
      return NextResponse.json(
        { error: 'Failed to create update' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      update: data,
      message: 'Update created successfully',
    }, { status: 201 });

  } catch (error) {
    if (error instanceof z.ZodError) {
      console.error('Update creation validation error:', error.errors);
      return NextResponse.json(
        { 
          error: 'Validation failed', 
          details: error.errors,
          message: 'Please check the form data and try again'
        },
        { status: 400 }
      );
    }

    console.error('Unexpected error creating update:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// PUT - Update existing update
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
    const updateId = searchParams.get('id');

    if (!updateId) {
      return NextResponse.json(
        { error: 'Update ID is required' },
        { status: 400 }
      );
    }

    const body = await request.json();
    const cleanedData = cleanUpdateData(body);
    const validated = UpdateUpdateSchema.parse(cleanedData);

    // Validate date logic if provided
    if (validated.publish_date) {
      const publishDate = new Date(validated.publish_date);
      if (isNaN(publishDate.getTime())) {
        return NextResponse.json(
          { error: 'Invalid publish date' },
          { status: 400 }
        );
      }
    }

    // Use service role client for admin writes
    const supabase = createServiceRoleClient();

    const { data, error } = await supabase
      .from('site_updates')
      .update(validated)
      .eq('id', parseInt(updateId))
      .select()
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json(
          { error: 'Update not found' },
          { status: 404 }
        );
      }

      console.error('Error updating update:', error);
      return NextResponse.json(
        { error: 'Failed to update update' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      update: data,
      message: 'Update updated successfully',
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

// DELETE - Delete update
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
    const updateId = searchParams.get('id');

    if (!updateId) {
      return NextResponse.json(
        { error: 'Update ID is required' },
        { status: 400 }
      );
    }

    // Use service role client for admin writes
    const supabase = createServiceRoleClient();

    const { error } = await supabase
      .from('site_updates')
      .delete()
      .eq('id', parseInt(updateId));

    if (error) {
      console.error('Error deleting update:', error);
      return NextResponse.json(
        { error: 'Failed to delete update' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      message: 'Update deleted successfully',
    });

  } catch (error) {
    console.error('Unexpected error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
