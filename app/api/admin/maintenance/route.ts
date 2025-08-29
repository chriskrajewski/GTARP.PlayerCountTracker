import { NextRequest, NextResponse } from 'next/server';
import { validateAdminRequest } from '@/lib/admin-auth-server';
import { createServerClient } from '@/lib/supabase-server';

export async function GET(request: NextRequest) {
  try {
    if (!validateAdminRequest(request)) {
      return NextResponse.json(
        { success: false, error: 'Admin authentication required' },
        { status: 401 }
      );
    }

    // Since you're using Vercel + Supabase, most maintenance is handled automatically
    const maintenanceStatus = {
      system_status: 'operational', // operational, maintenance, degraded
      scheduled_maintenance: null,
      last_maintenance: null,
      uptime_percent: 99.9, // Vercel + Supabase uptime
      available_operations: [],
      recent_maintenance_logs: [],
      note: 'Maintenance is handled automatically by Vercel and Supabase. No manual maintenance operations are available.',
    };

    return NextResponse.json({
      success: true,
      data: maintenanceStatus,
      timestamp: new Date().toISOString(),
    });

  } catch (error) {
    console.error('Maintenance API error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  return NextResponse.json({
    success: false,
    error: 'Manual maintenance operations are not supported. System maintenance is handled automatically by Vercel and Supabase.',
  }, { status: 400 });
}