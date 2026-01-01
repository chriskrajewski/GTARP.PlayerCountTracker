import { NextRequest, NextResponse } from 'next/server';
import { validateAdminRequest } from '@/lib/admin-auth-server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

/**
 * Admin API endpoint for managing individual feature flags
 * Requires admin authentication
 */

export async function PATCH(
  request: NextRequest,
  context: any
) {
  try {
    if (!validateAdminRequest(request)) {
      return NextResponse.json(
        { success: false, error: 'Admin authentication required' },
        { status: 401 }
      );
    }

    // Handle both Promise and direct params
    let params = context.params;
    if (params instanceof Promise) {
      params = await params;
    }

    const flagId = params?.id;
    const body = await request.json();
    const { is_enabled, name, description, category } = body;

    if (!flagId) {
      console.error('Missing flagId. Params:', params, 'Context:', context);
      return NextResponse.json(
        { success: false, error: 'Feature flag ID is required' },
        { status: 400 }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    const updateData: any = { updated_at: new Date().toISOString() };
    if (is_enabled !== undefined) updateData.is_enabled = is_enabled;
    if (name !== undefined) updateData.name = name;
    if (description !== undefined) updateData.description = description;
    if (category !== undefined) updateData.category = category;

    const { data: updatedFlag, error } = await supabase
      .from('feature_flags')
      .update(updateData)
      .eq('id', flagId)
      .select()
      .single();

    if (error) {
      console.error('Error updating feature flag:', error);
      return NextResponse.json(
        { success: false, error: 'Failed to update feature flag' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: updatedFlag,
      message: 'Feature flag updated successfully',
      timestamp: new Date().toISOString(),
    });

  } catch (error) {
    console.error('Feature flag update error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  context: any
) {
  try {
    if (!validateAdminRequest(request)) {
      return NextResponse.json(
        { success: false, error: 'Admin authentication required' },
        { status: 401 }
      );
    }

    // Handle both Promise and direct params
    let params = context.params;
    if (params instanceof Promise) {
      params = await params;
    }

    const flagId = params?.id;

    if (!flagId) {
      return NextResponse.json(
        { success: false, error: 'Feature flag ID is required' },
        { status: 400 }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    const { error } = await supabase
      .from('feature_flags')
      .delete()
      .eq('id', flagId);

    if (error) {
      console.error('Error deleting feature flag:', error);
      return NextResponse.json(
        { success: false, error: 'Failed to delete feature flag' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Feature flag deleted successfully',
      timestamp: new Date().toISOString(),
    });

  } catch (error) {
    console.error('Feature flag deletion error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
