import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import type { Database } from '@/lib/supabase.types';
import { validateAdminRequest } from '@/lib/admin-auth-server';
import { z } from 'zod';

// Type definitions
type NotificationBanner = Database['public']['Tables']['notification_banners']['Row'];
type NotificationBannerInsert = Database['public']['Tables']['notification_banners']['Insert'];
type NotificationBannerUpdate = Partial<NotificationBannerInsert>;

// Much simpler approach - preprocess data to clean empty strings
function cleanBannerData(data: any) {
  const cleanData = { ...data };
  
  // Convert empty strings to undefined for optional fields
  const optionalFields = [
    'start_date', 'end_date', 'action_text', 'action_url', 
    'background_color', 'text_color', 'border_color', 'created_by'
  ];
  
  optionalFields.forEach(field => {
    if (cleanData[field] === '' || cleanData[field] === null) {
      cleanData[field] = undefined;
    }
  });
  
  return cleanData;
}

// Simple validation schema
const CreateBannerSchema = z.object({
  title: z.string().min(1).max(100),
  message: z.string().min(1).max(500),
  type: z.enum(['info', 'warning', 'success', 'announcement', 'urgent']).default('info'),
  priority: z.number().int().min(1).max(10).default(1),
  is_active: z.boolean().default(true),
  is_dismissible: z.boolean().default(true),
  start_date: z.string().datetime().optional(),
  end_date: z.string().datetime().optional(),
  action_text: z.string().max(50).optional(),
  action_url: z.string().url().optional(),
  action_target: z.enum(['_self', '_blank']).default('_self').optional(),
  background_color: z.string().regex(/^#[0-9A-F]{6}$/i).optional(),
  text_color: z.string().regex(/^#[0-9A-F]{6}$/i).optional(),
  border_color: z.string().regex(/^#[0-9A-F]{6}$/i).optional(),
  created_by: z.string().optional(),
});

const UpdateBannerSchema = CreateBannerSchema.partial();

// Helper function to get user ID from request
function getUserId(request: NextRequest): string {
  // In a real application, this would come from authentication
  // For now, we'll use a combination of IP and user agent
  const forwarded = request.headers.get('x-forwarded-for');
  const ip = forwarded ? forwarded.split(',')[0] : '127.0.0.1';
  const userAgent = request.headers.get('user-agent') || 'unknown';
  return `guest_${Buffer.from(ip + userAgent).toString('base64').slice(0, 16)}`;
}

// GET - Fetch active banners
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const includeInactive = searchParams.get('include_inactive') === 'true';
    const userId = getUserId(request);

    // Admin-only features require authentication
    if (includeInactive && !validateAdminRequest(request)) {
      return NextResponse.json(
        { error: 'Admin authentication required' },
        { status: 401 }
      );
    }

    let query = supabase
      .from('notification_banners')
      .select('*');

    if (!includeInactive) {
      const now = new Date().toISOString();
      query = query
        .eq('is_active', true)
        .or(`start_date.is.null,start_date.lte.${now}`)
        .or(`end_date.is.null,end_date.gte.${now}`);
    }

    const { data: banners, error } = await query.order('priority', { ascending: false });

    if (error) {
      console.error('Error fetching banners:', error);
      return NextResponse.json(
        { error: 'Failed to fetch banners' },
        { status: 500 }
      );
    }

    // Get user dismissals to filter out dismissed banners
    const { data: dismissals } = await supabase
      .from('notification_banner_dismissals')
      .select('banner_id')
      .eq('user_id', userId);

    const dismissedBannerIds = new Set(dismissals?.map(d => d.banner_id) || []);

    // Filter out dismissed banners (unless they're not dismissible)
    const visibleBanners = banners?.filter(banner => 
      !banner.is_dismissible || !dismissedBannerIds.has(banner.id)
    ) || [];

    return NextResponse.json({
      banners: visibleBanners,
      total: visibleBanners.length,
    });

  } catch (error) {
    console.error('Unexpected error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// POST - Create new banner
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
    const cleanedData = cleanBannerData(body);
    const validated = CreateBannerSchema.parse(cleanedData);

    // Validate date logic
    if (validated.start_date && validated.end_date) {
      if (new Date(validated.start_date) >= new Date(validated.end_date)) {
        return NextResponse.json(
          { error: 'End date must be after start date' },
          { status: 400 }
        );
      }
    }

    const bannerData: NotificationBannerInsert = {
      ...validated,
      created_by: validated.created_by || getUserId(request),
    };

    const { data, error } = await supabase
      .from('notification_banners')
      .insert(bannerData)
      .select()
      .single();

    if (error) {
      console.error('Error creating banner:', error);
      return NextResponse.json(
        { error: 'Failed to create banner' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      banner: data,
      message: 'Banner created successfully',
    }, { status: 201 });

  } catch (error) {
    if (error instanceof z.ZodError) {
      console.error('Banner creation validation error:', error.errors);
      return NextResponse.json(
        { 
          error: 'Validation failed', 
          details: error.errors,
          message: 'Please check the form data and try again'
        },
        { status: 400 }
      );
    }

    console.error('Unexpected error creating banner:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// PUT - Update banner
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
    const bannerId = searchParams.get('id');

    if (!bannerId) {
      return NextResponse.json(
        { error: 'Banner ID is required' },
        { status: 400 }
      );
    }

    const body = await request.json();
    const cleanedData = cleanBannerData(body);
    const validated = UpdateBannerSchema.parse(cleanedData);

    // Validate date logic if both dates are provided
    if (validated.start_date && validated.end_date) {
      if (new Date(validated.start_date) >= new Date(validated.end_date)) {
        return NextResponse.json(
          { error: 'End date must be after start date' },
          { status: 400 }
        );
      }
    }

    const { data, error } = await supabase
      .from('notification_banners')
      .update(validated)
      .eq('id', bannerId)
      .select()
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json(
          { error: 'Banner not found' },
          { status: 404 }
        );
      }

      console.error('Error updating banner:', error);
      return NextResponse.json(
        { error: 'Failed to update banner' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      banner: data,
      message: 'Banner updated successfully',
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

// DELETE - Delete banner
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
    const bannerId = searchParams.get('id');

    if (!bannerId) {
      return NextResponse.json(
        { error: 'Banner ID is required' },
        { status: 400 }
      );
    }

    const { error } = await supabase
      .from('notification_banners')
      .delete()
      .eq('id', bannerId);

    if (error) {
      console.error('Error deleting banner:', error);
      return NextResponse.json(
        { error: 'Failed to delete banner' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      message: 'Banner deleted successfully',
    });

  } catch (error) {
    console.error('Unexpected error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
