import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

/**
 * Public API endpoint for fetching feature flags
 * This is used by the client-side FeatureFlagProvider
 */
export async function GET() {
  try {
    const supabase = createClient(supabaseUrl, supabaseAnonKey);
    
    const { data: flags, error } = await supabase
      .from('feature_flags')
      .select('*')
      .order('category', { ascending: true })
      .order('name', { ascending: true });

    if (error) {
      console.error('Error fetching feature flags:', error);
      return NextResponse.json(
        { success: false, error: 'Failed to fetch feature flags' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      flags: flags || [],
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Feature flags API error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
