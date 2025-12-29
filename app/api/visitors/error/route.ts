import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase-server';
import { apiLogger } from '@/lib/apiLogger';

/**
 * POST /api/visitors/error
 * Track JavaScript errors
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      session_id,
      error_type,
      error_message,
      error_stack,
      page_url,
      user_agent
    } = body;

    if (!session_id || !error_message) {
      return NextResponse.json(
        { error: 'Missing required fields: session_id, error_message' },
        { status: 400 }
      );
    }

    const supabase = createServerClient();

    const { data, error } = await supabase
      .from('visitor_errors')
      .insert([
        {
          session_id,
          error_type: error_type || 'error',
          error_message,
          error_stack: error_stack || null,
          page_url: page_url || null,
          user_agent: user_agent || null,
        }
      ])
      .select()
      .single();

    if (error) {
      console.error('Error tracking error:', error);
      apiLogger.error('visitor_error_tracking_error', {
        session_id,
        error_message,
        error: error.message
      });
      return NextResponse.json(
        { error: 'Failed to track error' },
        { status: 500 }
      );
    }

    // Also update the session error count
    const { data: sessionData } = await supabase
      .from('visitor_sessions')
      .select('error_count')
      .eq('session_id', session_id)
      .single();

    await supabase
      .from('visitor_sessions')
      .update({ 
        error_count: (sessionData?.error_count || 0) + 1,
        last_activity: new Date().toISOString()
      })
      .eq('session_id', session_id);

    apiLogger.info('visitor_error_tracked', {
      session_id,
      error_message,
      error_type
    });

    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error('Error tracking exception:', error);
    apiLogger.error('visitor_error_exception', {
      error: error instanceof Error ? error.message : String(error)
    });
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
