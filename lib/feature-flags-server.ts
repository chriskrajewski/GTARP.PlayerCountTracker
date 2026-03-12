import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

/**
 * Server-side feature flag check.
 * Queries the database directly to check if a flag is enabled.
 */
export async function isFeatureFlagEnabled(key: string): Promise<boolean> {
  try {
    const supabase = createClient(supabaseUrl, supabaseAnonKey);
    const { data, error } = await supabase
      .from('feature_flags')
      .select('is_enabled')
      .eq('key', key)
      .single();

    if (error || !data) return false;
    return data.is_enabled;
  } catch {
    return false;
  }
}
