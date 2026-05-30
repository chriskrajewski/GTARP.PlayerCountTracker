import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

/**
 * Server-side feature flag check.
 *
 * Queries the `feature_flags` table directly to check if a flag is enabled.
 *
 * IMPORTANT: this read must be LIVE on every request. Next.js patches the
 * global `fetch` (which the Supabase client uses) and caches responses by
 * default, which on a statically-rendered route would freeze a flag at its
 * build-time value — causing a `notFound()` gate to keep firing even after an
 * admin enables the flag. We therefore force `cache: 'no-store'` on the
 * client's fetch so the flag is always read fresh. Pages that gate on this
 * should also export `dynamic = 'force-dynamic'`.
 */
export async function isFeatureFlagEnabled(key: string): Promise<boolean> {
  try {
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      auth: { persistSession: false },
      global: {
        // Opt out of Next.js fetch caching so the flag value is always live.
        fetch: (input: RequestInfo | URL, init?: RequestInit) =>
          fetch(input, { ...init, cache: 'no-store' }),
      },
    });

    // Use limit(1) instead of single() so a missing OR duplicate row is handled
    // gracefully (single() throws on 0 or >1 matches).
    const { data, error } = await supabase
      .from('feature_flags')
      .select('is_enabled')
      .eq('key', key)
      .limit(1);

    if (error || !data || data.length === 0) return false;
    return data[0].is_enabled === true;
  } catch {
    return false;
  }
}
