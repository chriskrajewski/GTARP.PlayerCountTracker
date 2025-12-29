import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase-server';
import { apiLogger } from '@/lib/apiLogger';

/**
 * POST /api/visitors/conversion
 * Track conversion events
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      session_id,
      conversion_type,
      conversion_value,
      conversion_currency,
      page_url,
      conversion_details
    } = body;

    if (!session_id || !conversion_type) {
      return NextResponse.json(
        { error: 'Missing required fields: session_id, conversion_type' },
        { status: 400 }
      );
    }

    const supabase = createServerClient();

    const { data, error } = await supabase
      .from('visitor_conversions')
      .insert([
        {
          session_id,
          conversion_type,
          conversion_value: conversion_value || null,
          conversion_currency: conversion_currency || 'USD',
          page_url: page_url || null,
          conversion_details: conversion_details || null,
        }
      ])
      .select()
      .single();

    if (error) {
      console.error('Error tracking conversion:', error);
      apiLogger.error('visitor_conversion_error', {
        session_id,
        conversion_type,
        error: error.message
      });
      return NextResponse.json(
        { error: 'Failed to track conversion' },
        { status: 500 }
      );
    }

    apiLogger.info('visitor_conversion_tracked', {
      session_id,
      conversion_type,
      conversion_value
    });

    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error('Conversion tracking error:', error);
    apiLogger.error('visitor_conversion_exception', {
      error: error instanceof Error ? error.message : String(error)
    });
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
