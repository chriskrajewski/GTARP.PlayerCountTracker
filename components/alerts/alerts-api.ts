'use client';

/**
 * Alert_System — client-side API helper (task 7.14).
 *
 * Centralizes Supabase access-token retrieval and the authenticated `fetch`
 * calls to the alert API routes so the form, list, and push-enable button all
 * share ONE token path and ONE error contract (R3.1–R3.4, R3.8).
 *
 * Every request carries `Authorization: Bearer <token>`; a missing token or a
 * 401 response is surfaced as `{ ok: false, status: 401 }` so callers can prompt
 * the visitor to sign in (R3.3). The API routes return `{ success, data }` on
 * success and `{ success: false, error }` (with an appropriate status) on
 * failure; these helpers normalize that into a discriminated {@link ApiResponse}.
 */
import { createBrowserClient } from '@/lib/supabase-browser';
import type {
  AlertSubscription,
  AlertSubscriptionUpdate,
  NewAlertSubscription,
} from '@/lib/alerts';

export type { AlertSubscription, AlertSubscriptionUpdate, NewAlertSubscription };

/** Discriminated result of an alert API call. */
export type ApiResponse<T> =
  | { ok: true; data: T }
  | { ok: false; error: string; status: number };

/** Result of a call that has no payload on success (e.g. delete). */
export type ApiVoidResponse =
  | { ok: true }
  | { ok: false; error: string; status: number };

/**
 * Read the current Supabase access token, or `null` when the visitor is not
 * signed in. Mirrors the token path used by `components/comparison/comparison-view.tsx`.
 */
export async function getAccessToken(): Promise<string | null> {
  try {
    const supabase = createBrowserClient();
    const {
      data: { session },
    } = await supabase.auth.getSession();
    return session?.access_token ?? null;
  } catch {
    return null;
  }
}

/** Sentinel returned when no token is available (treated like a 401). */
const UNAUTHENTICATED: { ok: false; error: string; status: number } = {
  ok: false,
  error: 'You must be signed in to manage alerts.',
  status: 401,
};

/** Safely parse a JSON response body; returns an empty object on failure. */
async function readJson(response: Response): Promise<Record<string, unknown>> {
  try {
    return (await response.json()) as Record<string, unknown>;
  } catch {
    return {};
  }
}

/**
 * GET the authenticated user's own alert subscriptions (R3.8).
 */
export async function fetchSubscriptions(): Promise<ApiResponse<AlertSubscription[]>> {
  const token = await getAccessToken();
  if (!token) return UNAUTHENTICATED;

  try {
    const response = await fetch('/api/alerts/subscriptions', {
      headers: { Authorization: `Bearer ${token}` },
    });
    const json = await readJson(response);
    if (!response.ok || json.success !== true) {
      return {
        ok: false,
        error: (json.error as string) ?? 'Failed to load alert subscriptions.',
        status: response.status,
      };
    }
    return { ok: true, data: (json.data as AlertSubscription[]) ?? [] };
  } catch {
    return { ok: false, error: 'Network error while loading subscriptions.', status: 0 };
  }
}

/**
 * Create a new alert subscription (R3.1, R3.2). Validation errors returned by
 * the API (HTTP 400) are surfaced verbatim so the form can display them.
 */
export async function createSubscription(
  body: NewAlertSubscription,
): Promise<ApiResponse<AlertSubscription>> {
  const token = await getAccessToken();
  if (!token) return UNAUTHENTICATED;

  try {
    const response = await fetch('/api/alerts/subscriptions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(body),
    });
    const json = await readJson(response);
    if (!response.ok || json.success !== true) {
      return {
        ok: false,
        error: (json.error as string) ?? 'Failed to create alert subscription.',
        status: response.status,
      };
    }
    return { ok: true, data: json.data as AlertSubscription };
  } catch {
    return { ok: false, error: 'Network error while creating the subscription.', status: 0 };
  }
}

/**
 * Edit one of the user's own subscriptions (R3.8) — e.g. enable/disable.
 */
export async function updateSubscription(
  id: number,
  patch: AlertSubscriptionUpdate,
): Promise<ApiResponse<AlertSubscription>> {
  const token = await getAccessToken();
  if (!token) return UNAUTHENTICATED;

  try {
    const response = await fetch(`/api/alerts/subscriptions/${id}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(patch),
    });
    const json = await readJson(response);
    if (!response.ok || json.success !== true) {
      return {
        ok: false,
        error: (json.error as string) ?? 'Failed to update alert subscription.',
        status: response.status,
      };
    }
    return { ok: true, data: json.data as AlertSubscription };
  } catch {
    return { ok: false, error: 'Network error while updating the subscription.', status: 0 };
  }
}

/**
 * Delete one of the user's own subscriptions (R3.8).
 */
export async function deleteSubscription(id: number): Promise<ApiVoidResponse> {
  const token = await getAccessToken();
  if (!token) return UNAUTHENTICATED;

  try {
    const response = await fetch(`/api/alerts/subscriptions/${id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    });
    const json = await readJson(response);
    if (!response.ok || json.success !== true) {
      return {
        ok: false,
        error: (json.error as string) ?? 'Failed to delete alert subscription.',
        status: response.status,
      };
    }
    return { ok: true };
  } catch {
    return { ok: false, error: 'Network error while deleting the subscription.', status: 0 };
  }
}

/**
 * Persist the browser-provided Push_Subscription for the authenticated user
 * (R3.4). Accepts the raw `PushSubscription.toJSON()` output.
 */
export async function savePushSubscription(
  subscription: PushSubscriptionJSON,
): Promise<ApiVoidResponse> {
  const token = await getAccessToken();
  if (!token) return UNAUTHENTICATED;

  try {
    const response = await fetch('/api/alerts/push-subscribe', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(subscription),
    });
    const json = await readJson(response);
    if (!response.ok || json.success !== true) {
      return {
        ok: false,
        error: (json.error as string) ?? 'Failed to enable push notifications.',
        status: response.status,
      };
    }
    return { ok: true };
  } catch {
    return { ok: false, error: 'Network error while enabling push notifications.', status: 0 };
  }
}
