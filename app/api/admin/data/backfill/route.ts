import { NextRequest, NextResponse } from 'next/server';
import { validateAdminRequest } from '@/lib/admin-auth-server';
import { createServiceRoleClient } from '@/lib/supabase-service-role';
import { z } from 'zod';

const BackfillSchema = z.object({
  gap_start: z.string().optional(),
  gap_end: z.string().optional(),
  interval_seconds: z.number().min(60).max(900).optional().default(180),
  lookback_days: z.number().min(1).max(30).optional().default(7),
});

/**
 * POST /api/admin/data/backfill
 * 
 * Backfills missing player_counts data using historical averages.
 * Averages the same time-of-day from previous days to estimate counts.
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
    const parsed = BackfillSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: parsed.error.errors[0].message },
        { status: 400 }
      );
    }

    const { gap_start, gap_end, interval_seconds, lookback_days } = parsed.data;

    // Build RPC params - pass null for auto-detection
    const rpcParams: any = {
      interval_seconds,
      lookback_days,
    };

    if (gap_start && gap_end) {
      const start = new Date(gap_start);
      const end = new Date(gap_end);
      if (isNaN(start.getTime()) || isNaN(end.getTime())) {
        return NextResponse.json(
          { success: false, error: 'Invalid date format. Use ISO 8601.' },
          { status: 400 }
        );
      }
      if (end <= start) {
        return NextResponse.json(
          { success: false, error: 'gap_end must be after gap_start' },
          { status: 400 }
        );
      }
      const gapHours = (end.getTime() - start.getTime()) / (1000 * 60 * 60);
      if (gapHours > 48) {
        return NextResponse.json(
          { success: false, error: 'Cannot backfill more than 48 hours at once' },
          { status: 400 }
        );
      }
      rpcParams.gap_start = start.toISOString();
      rpcParams.gap_end = end.toISOString();
    }

    const supabase = createServiceRoleClient();

    const { data, error } = await supabase.rpc('backfill_player_counts', rpcParams);

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
    console.error('Backfill error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
