import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase-server';
import { logApiRequest } from '@/lib/apiLogger';

/**
 * GET /api/visitors/count
 * 
 * Get current active visitor count (humans and bots separately)
 * Source: PRD §4.1 FR-2, FR-11; Blueprint §7.1
 * Implements: Query current visitor counts with human/bot distinction
 */
export async function GET(request: NextRequest) {
  const startTime = Date.now();
  const requestId = crypto.randomUUID();

  try {
    // Create Supabase client
    const supabase = createServerClient();

    // Query active visitor counts
    // Source: PRD §5.1 Story §5.1 (Get current count)
    // Source: PRD §8.2 SL-2 (is_active = true)
    const { data, error } = await supabase
      .from('visitor_sessions')
      .select('is_bot', { count: 'exact' })
      .eq('is_active', true);

    if (error) {
      throw new Error(`Database error: ${error.message}`);
    }

    // Calculate counts
    // Source: PRD §4.1 FR-2 (Separate human/bot counts)
    // Source: PRD §4.1 FR-11 (Display exact numbers)
    const humans = data?.filter(row => !row.is_bot).length || 0;
    const bots = data?.filter(row => row.is_bot).length || 0;
    const total = humans + bots;

    // Log API request
    // Source: PRD §4.1 FR-10 (API logging)
    await logApiRequest({
      endpoint: '/api/visitors/count',
      method: 'GET',
      statusCode: 200,
      responseTime: Date.now() - startTime,
      requestId,
      level: 'info',
      message: 'Visitor count retrieved successfully',
      metadata: {
        total,
        humans,
        bots
      }
    });

    // Return counts
    // Source: PRD §6.1 V-1 (User sees: Exact visitor count)
    return NextResponse.json(
      {
        total,
        humans,
        bots,
        timestamp: new Date().toISOString()
      },
      { status: 200 }
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    // Log error
    await logApiRequest({
      endpoint: '/api/visitors/count',
      method: 'GET',
      statusCode: 500,
      responseTime: Date.now() - startTime,
      requestId,
      level: 'error',
      message: errorMessage
    });

    console.error('[/api/visitors/count] Error:', errorMessage);

    return NextResponse.json(
      { error: 'Failed to fetch visitor count' },
      { status: 500 }
    );
  }
}
