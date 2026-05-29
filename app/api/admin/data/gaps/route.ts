import { NextRequest, NextResponse } from 'next/server';
import { validateAdminRequest } from '@/lib/admin-auth-server';
import { createServiceRoleClient } from '@/lib/supabase-service-role';

/**
 * GET /api/admin/data/gaps
 * 
 * Detects data gaps in player_counts from the last 48 hours.
 * Returns all gaps > 10 minutes, sorted by duration descending.
 */
export async function GET(request: NextRequest) {
  try {
    if (!validateAdminRequest(request)) {
      return NextResponse.json(
        { success: false, error: 'Admin authentication required' },
        { status: 401 }
      );
    }

    const supabase = createServiceRoleClient();

    const { data, error } = await supabase.rpc('detect_data_gaps');

    if (error) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      data,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Gap detection error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
