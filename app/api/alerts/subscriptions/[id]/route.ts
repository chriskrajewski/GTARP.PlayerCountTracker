import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import type { NextRequest } from 'next/server';
import type { User } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase.types';
import {
  deleteSubscriptionForUser,
  updateSubscriptionForUser,
  type AlertSubscriptionUpdate,
  type StreamerPlatform,
} from '@/lib/alerts';

/**
 * Alert_System — single-subscription edit/delete API (R3.8 own-only).
 *
 * Thin route handlers that delegate ALL ownership and persistence to the
 * owner-scoped `lib/alerts.ts` functions (`updateSubscriptionForUser` /
 * `deleteSubscriptionForUser`), which only mutate a row when it belongs to the
 * resolved `app_users.id` (R9.4). A cross-user or missing id surfaces here as
 * 404. An unauthenticated caller is rejected with 401 (Property 10).
 *
 * Auth handling mirrors `app/api/favorites/*` and
 * `app/api/comparison-preferences`. The dynamic `params` handling mirrors the
 * existing `app/api/admin/features/[id]/route.ts` (Next.js 16 App Router: the
 * route segment `params` may be a Promise, so it is awaited).
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
 * Resolve the numeric subscription id from the (possibly async) route params.
 * Mirrors the Promise/direct-params handling in
 * `app/api/admin/features/[id]/route.ts`.
 */
async function resolveId(context: any): Promise<number | null> {
  let params = context?.params;
  if (params instanceof Promise) {
    params = await params;
  }
  const id = Number(params?.id);
  return Number.isInteger(id) ? id : null;
}

/**
 * Map a `lib/` mutation error to an HTTP status: a "not found" / not-owned
 * result is a 404, any other (validation/failure) message is a 400.
 */
function statusForMutationError(error: string): number {
  return /not found/i.test(error) ? 404 : 400;
}

/**
 * Build the editable patch from the request body, allowing ONLY the fields the
 * `lib/` layer treats as editable (R3.8). `type` and ownership/trigger columns
 * are intentionally never accepted here.
 */
function toUpdatePatch(body: Record<string, unknown>): AlertSubscriptionUpdate {
  const patch: AlertSubscriptionUpdate = {};
  if (typeof body.isEnabled === 'boolean') patch.isEnabled = body.isEnabled;
  if (typeof body.serverId === 'string') patch.serverId = body.serverId;
  if (typeof body.threshold === 'number') patch.threshold = body.threshold;
  if (typeof body.streamerUsername === 'string') patch.streamerUsername = body.streamerUsername;
  if (body.streamerPlatform === 'twitch' || body.streamerPlatform === 'kick') {
    patch.streamerPlatform = body.streamerPlatform as StreamerPlatform;
  }
  return patch;
}

/**
 * PATCH /api/alerts/subscriptions/[id]
 *
 * Edit one of the authenticated user's own subscriptions (R3.8). 401 when
 * unauthenticated, 400 for a non-numeric id, 404 when the row is not found /
 * not owned.
 */
export async function PATCH(request: NextRequest, context: any) {
  try {
    const auth = await authenticate(request);
    if ('response' in auth) return auth.response;

    const id = await resolveId(context);
    if (id === null) {
      return NextResponse.json(
        { success: false, error: 'Invalid subscription id' },
        { status: 400 },
      );
    }

    const body = (await request.json()) as Record<string, unknown>;
    const patch = toUpdatePatch(body);

    const result = await updateSubscriptionForUser(auth.ctx.supabase, auth.ctx.user, id, patch);

    if (!result.ok) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: statusForMutationError(result.error) },
      );
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
 * DELETE /api/alerts/subscriptions/[id]
 *
 * Delete one of the authenticated user's own subscriptions (R3.8). 401 when
 * unauthenticated, 400 for a non-numeric id, 404 when the row is not found /
 * not owned.
 */
export async function DELETE(request: NextRequest, context: any) {
  try {
    const auth = await authenticate(request);
    if ('response' in auth) return auth.response;

    const id = await resolveId(context);
    if (id === null) {
      return NextResponse.json(
        { success: false, error: 'Invalid subscription id' },
        { status: 400 },
      );
    }

    const result = await deleteSubscriptionForUser(auth.ctx.supabase, auth.ctx.user, id);

    if (!result.ok) {
      return NextResponse.json({ success: false, error: 'Not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Server error' },
      { status: 500 },
    );
  }
}
