import { NextRequest, NextResponse } from 'next/server';
import { validateAdminRequest } from '@/lib/admin-auth-server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

/**
 * Admin API endpoint for managing feature flags
 * Requires admin authentication
 */

export async function GET(request: NextRequest) {
  try {
    if (!validateAdminRequest(request)) {
      return NextResponse.json(
        { success: false, error: 'Admin authentication required' },
        { status: 401 }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    const { data: flags, error } = await supabase
      .from('feature_flags')
      .select('*')
      .order('category', { ascending: true })
      .order('name', { ascending: true });

    if (error) {
      console.error('Error fetching feature flags:', error);
      return NextResponse.json(
        { success: false, error: 'Failed to fetch feature flags' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: flags || [],
      timestamp: new Date().toISOString(),
    });

  } catch (error) {
    console.error('Feature flags API error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    if (!validateAdminRequest(request)) {
      return NextResponse.json(
        { success: false, error: 'Admin authentication required' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    const { data: newFlag, error } = await supabase
      .from('feature_flags')
      .insert({
        key: body.key,
        name: body.name,
        description: body.description || null,
        is_enabled: body.is_enabled ?? false,
        category: body.category || 'general',
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating feature flag:', error);
      return NextResponse.json(
        { success: false, error: 'Failed to create feature flag' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: newFlag,
      message: 'Feature flag created successfully',
      timestamp: new Date().toISOString(),
    });

  } catch (error) {
    console.error('Feature flag creation error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    if (!validateAdminRequest(request)) {
      return NextResponse.json(
        { success: false, error: 'Admin authentication required' },
        { status: 401 }
      );
    }

    return NextResponse.json(
      { success: false, error: 'Use PATCH /api/admin/features/{id} instead' },
      { status: 400 }
    );

  } catch (error) {
    console.error('Feature flag update error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    if (!validateAdminRequest(request)) {
      return NextResponse.json(
        { success: false, error: 'Admin authentication required' },
        { status: 401 }
      );
    }

    return NextResponse.json(
      { success: false, error: 'Use DELETE /api/admin/features/{id} instead' },
      { status: 400 }
    );

  } catch (error) {
    console.error('Feature flag deletion error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
