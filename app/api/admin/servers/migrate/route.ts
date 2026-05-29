import { NextRequest, NextResponse } from 'next/server';
import { validateAdminRequest } from '@/lib/admin-auth-server';
import { createServiceRoleClient } from '@/lib/supabase-service-role';
import { z } from 'zod';

const MigrateSchema = z.object({
  old_server_id: z.string().min(1, 'old_server_id is required'),
  new_server_id: z.string().min(1, 'new_server_id is required'),
});

/**
 * POST /api/admin/servers/migrate
 * 
 * Migrates a server_id across all tables while preserving historical data.
 * Uses the migrate_server_id database function for atomic execution.
 */
export async function POST(request: NextRequest) {
  try {
    if (!validateAdminRequest(request)) {
      return NextResponse.json(
        { success: false, error: 'Admin authentication required' },
        { status: 401 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const parsed = MigrateSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: parsed.error.errors[0].message },
        { status: 400 }
      );
    }

    const { old_server_id, new_server_id } = parsed.data;

    if (old_server_id === new_server_id) {
      return NextResponse.json(
        { success: false, error: 'old_server_id and new_server_id cannot be the same' },
        { status: 400 }
      );
    }

    const supabase = createServiceRoleClient();

    // Call the database function for atomic migration
    const { data, error } = await supabase.rpc('migrate_server_id', {
      old_id: old_server_id,
      new_id: new_server_id,
    });

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
    console.error('Server migration error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
