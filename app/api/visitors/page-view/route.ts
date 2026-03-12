import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase-server';
import { apiLogger } from '@/lib/apiLogger';
import { isFeatureFlagEnabled } from '@/lib/feature-flags-server';

/**
 * POST /api/visitors/page-view
 * Track individual page views
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
      page_title,
      referrer,
      time_on_page_seconds,
      scroll_depth_percent,
      clicks_on_page,
      form_interactions,
      video_plays,
      downloads,
      exit_page,
      bounce
    } = body;

    if (!session_id || !page_url) {
      return NextResponse.json(
        { error: 'Missing required fields: session_id, page_url' },
        { status: 400 }
      );
    }

    const supabase = createServerClient();

    const { data, error } = await supabase
      .from('visitor_page_views')
      .insert([
        {
          session_id,
          page_url,
          page_title: page_title || null,
          referrer: referrer || null,
          time_on_page_seconds: time_on_page_seconds || null,
          scroll_depth_percent: scroll_depth_percent || null,
          clicks_on_page: clicks_on_page || 0,
          form_interactions: form_interactions || 0,
          video_plays: video_plays || 0,
          downloads: downloads || 0,
          exit_page: exit_page || false,
          bounce: bounce || false,
        }
      ])
      .select()
      .single();

    if (error) {
      console.error('Error tracking page view:', error);
      apiLogger.error('visitor_page_view_error', {
        session_id,
        page_url,
        error: error.message
      });
      return NextResponse.json(
        { error: 'Failed to track page view' },
        { status: 500 }
      );
    }

    // Update session with page information
    const { data: sessionData } = await supabase
      .from('visitor_sessions')
      .select('landing_page, pages_visited')
      .eq('session_id', session_id)
      .single();

    await supabase
      .from('visitor_sessions')
      .update({
        current_page: page_url,
        landing_page: sessionData?.landing_page || page_url,
        pages_visited: (sessionData?.pages_visited || 0) + 1,
        last_activity: new Date().toISOString()
      })
      .eq('session_id', session_id);

    apiLogger.info('visitor_page_view_tracked', {
      session_id,
      page_url,
      time_on_page_seconds
    });

    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error('Page view tracking error:', error);
    apiLogger.error('visitor_page_view_exception', {
      error: error instanceof Error ? error.message : String(error)
    });
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
