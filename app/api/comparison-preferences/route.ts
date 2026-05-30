import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import type { NextRequest } from 'next/server';
import type { User } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase.types';
import {
  getComparisonPreferencesForUser,
  saveComparisonPreferencesForUser,
} from '@/lib/comparison-prefs';

/**
 * Server Comparison View — per-user preference persistence (R2.6, R9.1, R9.4).
 *
 * Thin route handlers that delegate ALL data access to the owner-scoped `lib/`
 * functions (`getComparisonPreferencesForUser` / `saveComparisonPreferencesForUser`),
 * which force `user_id = <resolved app_users.id>` so a signed-in App_User can
 * only read and write their own pinned set. Anonymous users never reach here —
 * the client persists their selection to the URL + localStorage instead.
 *
 * Auth handling mirrors `app/api/favorites/*`: a `Bearer` access token is
 * resolved to a Supabase `User`, and a token-scoped client is handed to the
 * `lib/` layer.
 */

interface AuthedContext {
  supabase: ReturnType<typeof createClient<Database>>;
  user: User;
}

/**
 * Resolve the bearer-token authenticated Supabase user, or return an
 * appropriate error response. Returns a discriminated result so callers can
 * branch without re-implementing the 401/500 handling.
 */
async function authenticate(
  request: NextRequest,
): Promise<{ ctx: AuthedContext } | { response: NextResponse }> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    return {
      response: NextResponse.json(
        { success: false, error: 'Supabase credentials not configured' },
        { status: 500 },
      ),
    };
  }

  const authHeader = request.headers.get('authorization') || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;

  if (!token) {
    return {
      response: NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 }),
    };
  }

  const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser(token);

  if (authError || !user) {
    return {
      response: NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 }),
    };
  }

  return { ctx: { supabase, user } };
}

/**
 * GET /api/comparison-preferences
 *
 * Returns the authenticated user's saved comparison preferences (pinned set +
 * last time range), or `null` when none are stored.
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await authenticate(request);
    if ('response' in auth) return auth.response;

    const preferences = await getComparisonPreferencesForUser(auth.ctx.supabase, auth.ctx.user);

    return NextResponse.json({ success: true, data: preferences });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Server error' },
      { status: 500 },
    );
  }
}

/**
 * POST /api/comparison-preferences
 *
 * Persists the authenticated user's pinned set + selected time range. The
 * 2..4 bound (R2.2/R2.3) is enforced by the `lib/` layer, which returns a
 * UI-displayable error for an out-of-bounds selection (surfaced here as 400).
 */
export async function POST(request: NextRequest) {
  try {
    const auth = await authenticate(request);
    if ('response' in auth) return auth.response;

    const body = (await request.json()) as {
      pinnedServerIds?: unknown;
      timeRange?: unknown;
    };

    if (
      !Array.isArray(body?.pinnedServerIds) ||
      !body.pinnedServerIds.every((id) => typeof id === 'string') ||
      typeof body?.timeRange !== 'string'
    ) {
      return NextResponse.json(
        { success: false, error: 'Invalid request body' },
        { status: 400 },
      );
    }

    const result = await saveComparisonPreferencesForUser(auth.ctx.supabase, auth.ctx.user, {
      pinnedServerIds: body.pinnedServerIds,
      timeRange: body.timeRange as Parameters<
        typeof saveComparisonPreferencesForUser
      >[2]['timeRange'],
    });

    if (!result.ok) {
      return NextResponse.json({ success: false, error: result.error }, { status: 400 });
    }

    return NextResponse.json({ success: true, data: result.data });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Server error' },
      { status: 500 },
    );
  }
}
