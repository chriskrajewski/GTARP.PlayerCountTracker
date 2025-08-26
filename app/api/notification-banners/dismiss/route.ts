import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { z } from 'zod';

// Validation schema
const DismissBannerSchema = z.object({
  banner_id: z.number().int().positive(),
});

// Helper function to get user ID from request
function getUserId(request: NextRequest): string {
  // In a real application, this would come from authentication
  // For now, we'll use a combination of IP and user agent
  const forwarded = request.headers.get('x-forwarded-for');
  const ip = forwarded ? forwarded.split(',')[0] : '127.0.0.1';
  const userAgent = request.headers.get('user-agent') || 'unknown';
  return `guest_${Buffer.from(ip + userAgent).toString('base64').slice(0, 16)}`;
}

// POST - Dismiss a banner for a user
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { banner_id } = DismissBannerSchema.parse(body);
    const userId = getUserId(request);

    // Check if banner exists and is dismissible
    const { data: banner, error: bannerError } = await supabase
      .from('notification_banners')
      .select('id, is_dismissible, dismiss_count')
      .eq('id', banner_id)
      .single();

    if (bannerError || !banner) {
      return NextResponse.json(
        { error: 'Banner not found' },
        { status: 404 }
      );
    }

    if (!banner.is_dismissible) {
      return NextResponse.json(
        { error: 'This banner cannot be dismissed' },
        { status: 400 }
      );
    }

    // Insert dismissal record (will handle duplicates via unique constraint)
    const { error: dismissError } = await supabase
      .from('notification_banner_dismissals')
      .insert({
        banner_id,
        user_id: userId,
      });

    // If it's a duplicate dismissal, that's fine - just return success
    if (dismissError && dismissError.code !== '23505') {
      console.error('Error recording dismissal:', dismissError);
      return NextResponse.json(
        { error: 'Failed to dismiss banner' },
        { status: 500 }
      );
    }

    // Increment dismiss count (only if this was a new dismissal)
    if (!dismissError) {
      await supabase
        .from('notification_banners')
        .update({ dismiss_count: (banner.dismiss_count || 0) + 1 })
        .eq('id', banner_id);
    }

    return NextResponse.json({
      message: 'Banner dismissed successfully',
      banner_id,
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

// GET - Get user's dismissed banners
export async function GET(request: NextRequest) {
  try {
    const userId = getUserId(request);

    const { data: dismissals, error } = await supabase
      .from('notification_banner_dismissals')
      .select('banner_id, dismissed_at')
      .eq('user_id', userId)
      .order('dismissed_at', { ascending: false });

    if (error) {
      console.error('Error fetching dismissals:', error);
      return NextResponse.json(
        { error: 'Failed to fetch dismissals' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      dismissals: dismissals || [],
      user_id: userId,
    });

  } catch (error) {
    console.error('Unexpected error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// DELETE - Clear user's dismissals (useful for testing)
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const bannerId = searchParams.get('banner_id');
    const userId = getUserId(request);

    let query = supabase
      .from('notification_banner_dismissals')
      .delete()
      .eq('user_id', userId);

    if (bannerId) {
      query = query.eq('banner_id', parseInt(bannerId));
    }

    const { error } = await query;

    if (error) {
      console.error('Error clearing dismissals:', error);
      return NextResponse.json(
        { error: 'Failed to clear dismissals' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      message: bannerId 
        ? `Dismissal for banner ${bannerId} cleared` 
        : 'All dismissals cleared',
    });

  } catch (error) {
    console.error('Unexpected error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
