import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase-server';
import { apiLogger } from '@/lib/apiLogger';
import { isFeatureFlagEnabled } from '@/lib/feature-flags-server';

/**
 * POST /api/visitors/event
 * Track custom events (clicks, form submissions, etc.)
 */
export async function POST(request: NextRequest) {
  try {
    if (!await isFeatureFlagEnabled('visitor_tracking')) {
      return NextResponse.json({ success: false, error: 'Visitor tracking is disabled' }, { status: 403 });
    }

    const body = await request.json();
    const {
      session_id,
      event_type,
      event_name,
      event_value,
      event_category,
      event_label,
      page_url,
      custom_data
    } = body;

    if (!session_id || !event_type) {
      return NextResponse.json(
        { error: 'Missing required fields: session_id, event_type' },
        { status: 400 }
      );
    }

    const supabase = createServerClient();

    const { data, error } = await supabase
      .from('visitor_events')
      .insert([
        {
          session_id,
          event_type,
          event_name: event_name || null,
          event_value: event_value || null,
          event_category: event_category || null,
          event_label: event_label || null,
          page_url: page_url || null,
          custom_data: custom_data || null,
        }
      ])
      .select()
      .single();

    if (error) {
      console.error('Error tracking event:', error);
      apiLogger.error('visitor_event_error', {
        session_id,
        event_type,
        error: error.message
      });
      return NextResponse.json(
        { error: 'Failed to track event' },
        { status: 500 }
      );
    }

    apiLogger.info('visitor_event_tracked', {
      session_id,
      event_type,
      event_name
    });

    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error('Event tracking error:', error);
    apiLogger.error('visitor_event_exception', {
      error: error instanceof Error ? error.message : String(error)
    });
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
