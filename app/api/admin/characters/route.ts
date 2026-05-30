import { NextRequest, NextResponse } from 'next/server';
import { validateAdminRequest } from '@/lib/admin-auth-server';
import { z } from 'zod';
import {
  getCharacterReviewQueue,
  applyAdminReview,
  processStreamerTitles,
  type AdminAction,
} from '@/lib/streamer-characters';

/**
 * Admin character review API (R6.1, R6.3, R6.4, R6.5, R9.1). Modeled on
 * `app/api/admin/data/backfill/route.ts`: admin auth is enforced FIRST via
 * `validateAdminRequest` before any read or mutation (R8.1-style gating),
 * request bodies are validated with zod, and every handler funnels unexpected
 * failures into a generic `500` after a `console.error`.
 *
 * Reads/writes route ONLY through the Data_Layer (`lib/streamer-characters.ts`);
 * this route never constructs a DB client itself (R8.1).
 */

/**
 * The acting reviewer is recorded on every correction. `validateAdminRequest`
 * only returns a boolean (no admin identity), so the reviewer is taken from the
 * request body and defaults to `'admin'` when absent (R6.3/R6.4/R6.5 only
 * require an attribution string).
 */
const reviewerSchema = z.string().min(1).optional().default('admin');

/**
 * Discriminated union over `kind` for the admin actions this route accepts:
 *
 *  - `confirm` / `override` / `no-character` → a {@link AdminAction} applied via
 *    {@link applyAdminReview} against a single extraction (R6.3, R6.4, R6.5).
 *  - `backfill` → trigger {@link processStreamerTitles} for a streamer (R9.1).
 *
 * On a parse failure the route returns `400` with the first zod error message.
 */
const AdminActionSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('confirm'),
    extractionId: z.number(),
    reviewer: reviewerSchema,
  }),
  z.object({
    kind: z.literal('override'),
    extractionId: z.number(),
    name: z.string().min(1),
    reviewer: reviewerSchema,
  }),
  z.object({
    kind: z.literal('no-character'),
    extractionId: z.number(),
    reviewer: reviewerSchema,
  }),
  z.object({
    kind: z.literal('backfill'),
    username: z.string().min(1),
    reviewer: reviewerSchema,
  }),
]);

/**
 * GET /api/admin/characters
 *
 * Returns the pending-extraction review queue (R6.1). Admin auth is enforced
 * first; on success the queue is read through the Data_Layer.
 */
export async function GET(request: NextRequest) {
  try {
    if (!validateAdminRequest(request)) {
      return NextResponse.json(
        { success: false, error: 'Admin authentication required' },
        { status: 401 }
      );
    }

    const items = await getCharacterReviewQueue();
    return NextResponse.json({ success: true, items });
  } catch (error) {
    console.error('Character review queue error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/characters
 *
 * Applies an admin correction (confirm / override / no-character) or triggers a
 * backfill. Admin auth is enforced first, then the body is zod-validated.
 *
 * Status choices:
 *  - Unauthenticated → `401`.
 *  - Invalid body → `400` with the first zod error message.
 *  - A review action returns `200` with `{ success: result.success }` so the
 *    client always reads the real outcome from the body. (Note: the Data_Layer
 *    treats an unknown `extractionId` as a clean no-op `{ success: true }`, since
 *    the `.eq('id', ...)` filter guarantees no other row is mutated.)
 *  - A backfill returns `200` with `{ success: true, result }`.
 *  - Unexpected failure → `500`.
 */
export async function POST(request: NextRequest) {
  try {
    if (!validateAdminRequest(request)) {
      return NextResponse.json(
        { success: false, error: 'Admin authentication required' },
        { status: 401 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const parsed = AdminActionSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: parsed.error.errors[0].message },
        { status: 400 }
      );
    }

    const action = parsed.data;

    if (action.kind === 'backfill') {
      const result = await processStreamerTitles(action.username);
      return NextResponse.json({ success: true, result });
    }

    // Review action (confirm / override / no-character): build the typed
    // AdminAction and apply it through the Data_Layer.
    let reviewAction: AdminAction;
    if (action.kind === 'override') {
      reviewAction = {
        kind: 'override',
        extractionId: action.extractionId,
        name: action.name,
        reviewer: action.reviewer,
      };
    } else {
      reviewAction = {
        kind: action.kind,
        extractionId: action.extractionId,
        reviewer: action.reviewer,
      };
    }

    const result = await applyAdminReview(reviewAction);
    return NextResponse.json({ success: result.success });
  } catch (error) {
    console.error('Character admin action error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export const dynamic = 'force-dynamic';
