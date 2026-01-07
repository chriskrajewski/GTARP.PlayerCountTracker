import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase-server';
import { logApiRequest } from '@/lib/apiLogger';
import { extractClientIp, getGeoLocation } from '@/lib/geolocation';

/**
 * POST /api/visitors/session
 * 
 * Create a new visitor session
 * Source: PRD §4.1 FR-6, FR-11; Blueprint §7.1
 */
export async function POST(request: NextRequest) {
  const startTime = Date.now();
  const requestId = crypto.randomUUID();

  try {
    // Parse request body for detailed visitor data
    let body = {};
    try {
      body = await request.json();
    } catch {
      // Body is optional
    }

    // BotID verification has been removed now that we're running exclusively on Azure
    const isBot = false;

    // Create Supabase client
    // Source: Blueprint §6.1 (Database operations)
    const supabase = createServerClient();

    // Extract client IP for geolocation and hashing
    const clientIp = extractClientIp(request.headers);
    const ipForHash = clientIp || request.headers.get('x-forwarded-for') || 'unknown';
    
    // Perform server-side IP geolocation
    // This provides accurate location data based on the visitor's IP address
    const geoLocation = await getGeoLocation(clientIp);

    // Insert visitor session with detailed data
    // Source: PRD §8.2 SL-1 (Session creation)
    const bodyData = body as Record<string, any>;
    
    const { data, error } = await supabase
      .from('visitor_sessions')
      .insert({
        is_bot: isBot,
        user_agent: request.headers.get('user-agent') || undefined,
        ip_hash: hashIp(ipForHash),
        // Device & Browser data
        device_type: bodyData.device_type || null,
        browser_name: bodyData.browser_name || null,
        browser_version: bodyData.browser_version || null,
        os_name: bodyData.os_name || null,
        os_version: bodyData.os_version || null,
        // Geographic data from server-side IP geolocation
        // Falls back to client-provided data if geolocation fails
        country: geoLocation.country || bodyData.country || null,
        region: geoLocation.region || bodyData.region || null,
        city: geoLocation.city || bodyData.city || null,
        // Traffic source
        referrer: bodyData.referrer || null,
        landing_page: bodyData.landing_page || null,
        utm_source: bodyData.utm_source || null,
        utm_medium: bodyData.utm_medium || null,
        utm_campaign: bodyData.utm_campaign || null,
        utm_content: bodyData.utm_content || null,
        utm_term: bodyData.utm_term || null,
        // Browser info
        language: bodyData.language || null,
        // Use server geolocation timezone as fallback
        timezone: bodyData.timezone || geoLocation.timezone || null,
        screen_resolution: bodyData.screen_resolution || null,
        viewport_size: bodyData.viewport_size || null,
        connection_type: bodyData.connection_type || null,
        connection_speed_mbps: bodyData.connection_speed_mbps || null,
      })
      .select('session_id')
      .single();

    if (error) {
      throw new Error(`Database error: ${error.message}`);
    }

    if (!data) {
      throw new Error('Failed to create session');
    }

    // Log API request
    // Source: PRD §4.1 FR-10 (API logging)
    await logApiRequest({
      endpoint: '/api/visitors/session',
      method: 'POST',
      statusCode: 201,
      responseTime: Date.now() - startTime,
      requestId,
      level: 'info',
      message: 'Session created successfully',
      metadata: {
        session_id: data.session_id,
        is_bot: isBot,
        geo_country: geoLocation.country,
        geo_city: geoLocation.city,
        has_geolocation: Boolean(geoLocation.country)
      }
    });

    // Return session ID
    // Source: PRD §6.1 V-1 (User does NOT see: Session creation details)
    return NextResponse.json(
      {
        session_id: data.session_id,
        is_bot: isBot
      },
      { status: 201 }
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    // Log error
    await logApiRequest({
      endpoint: '/api/visitors/session',
      method: 'POST',
      statusCode: 500,
      responseTime: Date.now() - startTime,
      requestId,
      level: 'error',
      message: errorMessage
    });

    console.error('[/api/visitors/session] Error:', errorMessage);

    return NextResponse.json(
      { error: 'Failed to create visitor session' },
      { status: 500 }
    );
  }
}

/**
 * Hash IP address for privacy
 * Source: PRD §9.3 (Security constraints - no PII)
 * 
 * @param ip IP address to hash
 * @returns Hashed IP for deduplication
 */
function hashIp(ip: string): string {
  // Simple hash - in production, use crypto.subtle.digest
  let hash = 0;
  for (let i = 0; i < ip.length; i++) {
    const char = ip.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash).toString(16);
}
