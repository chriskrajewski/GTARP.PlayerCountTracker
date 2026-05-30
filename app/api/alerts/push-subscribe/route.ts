import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import type { NextRequest } from 'next/server';
import type { User } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase.types';
import { rateLimiter } from '@/lib/rateLimiter';
import { getOrCreateAppUser } from '@/lib/app-users';
import { savePushSubscription, type PushSubscriptionInput } from '@/lib/web-push';

/**
 * Alert_System — store a browser Push_Subscription for the authenticated user
 * (R3.4).
 *
 * Thin route handler: it authenticates the bearer token, resolves the owning
 * `app_users.id` (the key `lib/web-push.savePushSubscription` persists against),
 * validates that the browser-provided PushSubscription JSON carries an endpoint
 * and keys, then delegates the UPSERT to the `lib/` layer. An unauthenticated
 * caller is rejected with 401.
 *
 * Auth handling mirrors `app/api/favorites/*` and
 * `app/api/comparison-preferences`.
 */

interface AuthedContext {
  supabase: ReturnType<typeof createClient<Database>>;
  user: User;
}

/** The browser PushSubscription JSON body accepted by this route. */
interface PushSubscribeBody extends PushSubscriptionInput {
  endpoint?: string;
  keys?: { p256dh?: string; auth?: string };
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
 * POST /api/alerts/push-subscribe
 *
 * Persist the browser-provided Push_Subscription for the authenticated user
 * (R3.4). 401 when unauthenticated, 404 when the owning `app_users` row cannot
 * be resolved, 400 when the endpoint or keys are missing.
 */
export async function POST(request: NextRequest) {
  try {
    const rateLimitResponse = await rateLimiter(request);
    if (rateLimitResponse) {
      return rateLimitResponse;
    }

    const auth = await authenticate(request);
    if ('response' in auth) return auth.response;

    const { appUser, error: appUserError } = await getOrCreateAppUser(
      auth.ctx.supabase,
      auth.ctx.user,
    );

    if (appUserError || !appUser) {
      return NextResponse.json({ success: false, error: 'User not found' }, { status: 404 });
    }

    const body = (await request.json()) as PushSubscribeBody;

    if (!body?.endpoint || !body?.keys?.p256dh || !body?.keys?.auth) {
      return NextResponse.json(
        { success: false, error: 'Invalid push subscription' },
        { status: 400 },
      );
    }

    const userAgent = request.headers.get('user-agent') ?? undefined;

    await savePushSubscription(appUser.id, body, userAgent);

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Server error' },
      { status: 500 },
    );
  }
}
