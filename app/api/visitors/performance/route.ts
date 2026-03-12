import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase-server';
import { apiLogger } from '@/lib/apiLogger';
import { isFeatureFlagEnabled } from '@/lib/feature-flags-server';

/**
 * POST /api/visitors/performance
 * Track performance metrics (Web Vitals)
 */
export async function POST(request: NextRequest) {
  try {
    if (!await isFeatureFlagEnabled('visitor_tracking')) {
      return NextResponse.json({ success: false, error: 'Visitor tracking is disabled' }, { status: 403 });
    }

    const body = await request.json();
    const {
      session_id,
      page_url,
      page_load_time_ms,
      first_contentful_paint_ms,
      largest_contentful_paint_ms,
      cumulative_layout_shift,
      time_to_interactive_ms,
      first_input_delay_ms,
      total_blocking_time_ms,
      dom_content_loaded_ms,
      window_load_ms,
      resource_timing
    } = body;

    if (!session_id) {
      return NextResponse.json(
        { error: 'Missing required field: session_id' },
        { status: 400 }
      );
    }

    const supabase = createServerClient();

    const { data, error } = await supabase
      .from('visitor_performance')
      .insert([
        {
          session_id,
          page_url: page_url || null,
          page_load_time_ms: page_load_time_ms || null,
          first_contentful_paint_ms: first_contentful_paint_ms || null,
          largest_contentful_paint_ms: largest_contentful_paint_ms || null,
          cumulative_layout_shift: cumulative_layout_shift || null,
          time_to_interactive_ms: time_to_interactive_ms || null,
          first_input_delay_ms: first_input_delay_ms || null,
          total_blocking_time_ms: total_blocking_time_ms || null,
          dom_content_loaded_ms: dom_content_loaded_ms || null,
          window_load_ms: window_load_ms || null,
          resource_timing: resource_timing || null,
        }
      ])
      .select()
      .single();

    if (error) {
      console.error('Error tracking performance:', error);
      apiLogger.error('visitor_performance_error', {
        session_id,
        page_url,
        error: error.message
      });
      return NextResponse.json(
        { error: 'Failed to track performance' },
        { status: 500 }
      );
    }

    // Update session with performance data
    await supabase
      .from('visitor_sessions')
      .update({
        page_load_time_ms: page_load_time_ms || null,
        first_contentful_paint_ms: first_contentful_paint_ms || null,
        largest_contentful_paint_ms: largest_contentful_paint_ms || null,
        cumulative_layout_shift: cumulative_layout_shift || null,
        time_to_interactive_ms: time_to_interactive_ms || null,
      })
      .eq('session_id', session_id);

    apiLogger.info('visitor_performance_tracked', {
      session_id,
      page_load_time_ms,
      first_contentful_paint_ms,
      largest_contentful_paint_ms
    });

    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error('Performance tracking error:', error);
    apiLogger.error('visitor_performance_exception', {
      error: error instanceof Error ? error.message : String(error)
    });
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
