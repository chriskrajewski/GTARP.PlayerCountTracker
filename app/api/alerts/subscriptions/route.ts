import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import type { NextRequest } from 'next/server';
import type { User } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase.types';
import { rateLimiter } from '@/lib/rateLimiter';
import {
  createSubscriptionForUser,
  listSubscriptionsForUser,
  type AlertSubscriptionType,
  type NewAlertSubscription,
} from '@/lib/alerts';

/**
 * Alert_System — per-user subscription collection API (R3.1, R3.2, R3.3, R3.8).
 *
 * Thin route handlers that delegate ALL validation, ownership, and persistence
 * to the owner-scoped `lib/alerts.ts` functions (`createSubscriptionForUser` /
 * `listSubscriptionsForUser`), which force `user_id = <resolved app_users.id>`
 * so a signed-in App_User only ever touches their own rows (R9.4).
 *
 * Auth handling mirrors `app/api/favorites/*` and
 * `app/api/comparison-preferences`: a `Bearer` access token is resolved to a
 * Supabase `User` and a token-scoped client is handed to the `lib/` layer. An
 * unauthenticated caller is rejected with 401 at this boundary (R3.3 /
 * Property 10).
 */

interface AuthedContext {
  supabase: ReturnType<typeof createClient<Database>>;
  user: User;
}

/** The two supported alert rule types, used to validate the request `type`. */
const VALID_SUBSCRIPTION_TYPES: readonly AlertSubscriptionType[] = [
  'player_count_below',
  'streamer_live',
];

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
 * POST /api/alerts/subscriptions
 *
 * Create an Alert_Subscription for the authenticated user (R3.1, R3.2). An
 * unauthenticated caller is rejected with 401 (R3.3). The request `type` must
 * be one of the two supported rule types; per-field validation (serverId +
 * threshold, or streamerUsername + streamerPlatform) is left to the `lib/`
 * layer, which returns a UI-displayable error surfaced here as 400.
 */
export async function POST(request: NextRequest) {
  try {
    const rateLimitResponse = await rateLimiter(request);
    if (rateLimitResponse) {
      return rateLimitResponse;
    }

    const auth = await authenticate(request);
    if ('response' in auth) return auth.response;

    const body = (await request.json()) as { type?: unknown };

    if (
      typeof body?.type !== 'string' ||
      !VALID_SUBSCRIPTION_TYPES.includes(body.type as AlertSubscriptionType)
    ) {
      return NextResponse.json(
        { success: false, error: 'Invalid alert subscription type' },
        { status: 400 },
      );
    }

    const result = await createSubscriptionForUser(
      auth.ctx.supabase,
      auth.ctx.user,
      body as NewAlertSubscription,
    );

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

/**
 * GET /api/alerts/subscriptions
 *
 * Return the authenticated user's own Alert_Subscriptions (R3.8). An
 * unauthenticated caller is rejected with 401.
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await authenticate(request);
    if ('response' in auth) return auth.response;

    const subscriptions = await listSubscriptionsForUser(auth.ctx.supabase, auth.ctx.user);

    return NextResponse.json({ success: true, data: subscriptions });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Server error' },
      { status: 500 },
    );
  }
}
