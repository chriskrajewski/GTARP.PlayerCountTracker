import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase-server';
import { logApiRequest } from '@/lib/apiLogger';

/**
 * POST /api/visitors/heartbeat
 * 
 * Update visitor session activity (heartbeat)
 * Source: PRD §4.1 FR-5; Blueprint §7.1
 * Implements: Keep session active with periodic updates
 * 
 * This endpoint also serves to validate and reactivate sessions.
 * If a session exists but is inactive, it will be reactivated.
 * 
 * NOTE: No rate limiting on this endpoint - heartbeats are expected to be
 * called frequently (every 30 seconds) and on every page load for session validation.
 */
export async function POST(request: NextRequest) {
  const startTime = Date.now();
  const requestId = crypto.randomUUID();

  try {

    // Parse request body
    const body = await request.json();
    const { session_id } = body;

    if (!session_id) {
      return NextResponse.json(
        { error: 'session_id is required' },
        { status: 400 }
      );
    }

    // Create Supabase client
    const supabase = createServerClient();

    // First, check if the session exists
    const { data: existingSession, error: selectError } = await supabase
      .from('visitor_sessions')
      .select('session_id, is_active')
      .eq('session_id', session_id)
      .single();

    if (selectError || !existingSession) {
      // Session doesn't exist
      await logApiRequest({
        endpoint: '/api/visitors/heartbeat',
        method: 'POST',
        statusCode: 404,
        responseTime: Date.now() - startTime,
        requestId,
        level: 'warn',
        message: 'Session not found',
        metadata: { session_id }
      });

      return NextResponse.json(
        { error: 'Session not found', valid: false },
        { status: 404 }
      );
    }

    // Update last_heartbeat timestamp and reactivate if needed
    // Source: PRD §8.2 SL-4 (last_heartbeat updated)
    const { error: updateError } = await supabase
      .from('visitor_sessions')
      .update({
        last_heartbeat: new Date().toISOString(),
        is_active: true, // Reactivate session if it was inactive
        last_activity: new Date().toISOString()
      })
      .eq('session_id', session_id);

    if (updateError) {
      throw new Error(`Database error: ${updateError.message}`);
    }

    // Log API request
    // Source: PRD §4.1 FR-10 (API logging)
    await logApiRequest({
      endpoint: '/api/visitors/heartbeat',
      method: 'POST',
      statusCode: 200,
      responseTime: Date.now() - startTime,
      requestId,
      level: 'info',
      message: existingSession.is_active 
        ? 'Heartbeat updated successfully' 
        : 'Session reactivated successfully',
      metadata: {
        session_id,
        was_inactive: !existingSession.is_active
      }
    });

    // Return success
    // Source: PRD §6.1 V-3 (User does NOT see: Heartbeat signals)
    return NextResponse.json(
      {
        success: true,
        valid: true,
        last_heartbeat: new Date().toISOString(),
        reactivated: !existingSession.is_active
      },
      { status: 200 }
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    // Log error
    await logApiRequest({
      endpoint: '/api/visitors/heartbeat',
      method: 'POST',
      statusCode: 500,
      responseTime: Date.now() - startTime,
      requestId,
      level: 'error',
      message: errorMessage
    });

    console.error('[/api/visitors/heartbeat] Error:', errorMessage);

    return NextResponse.json(
      { error: 'Failed to update heartbeat', valid: false },
      { status: 500 }
    );
  }
}
