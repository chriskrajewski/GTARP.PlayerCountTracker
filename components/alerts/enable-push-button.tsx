'use client';

/**
 * Alert_System — web-push opt-in control (R3.4, task 7.14).
 *
 * On click this:
 *   1. Verifies the browser supports Notifications + Service Workers + Push.
 *   2. Requests notification permission (`Notification.requestPermission`).
 *   3. Obtains the existing service-worker registration (the PWA already
 *      registers `/sw.js` via `lib/service-worker.ts` / `hooks/use-service-worker.ts`,
 *      so we await `navigator.serviceWorker.ready`).
 *   4. Subscribes through `registration.pushManager.subscribe` using the
 *      `NEXT_PUBLIC_VAPID_PUBLIC_KEY` as the `applicationServerKey`.
 *   5. POSTs the resulting `subscription.toJSON()` to `/api/alerts/push-subscribe`.
 *
 * The button reflects state on mount (already-granted + an existing push
 * subscription => "Notifications enabled") and disables itself with an
 * explanatory message when the VAPID public key is not configured.
 */
import { useCallback, useEffect, useState } from 'react';
import { Bell, BellRing, Loader2, BellOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { savePushSubscription } from './alerts-api';

/** The client-exposed VAPID public key (non-secret by design). */
const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;

type PushState = 'idle' | 'working' | 'enabled';

type FeedbackTone = 'info' | 'error' | 'success';

interface Feedback {
  tone: FeedbackTone;
  message: string;
}

/**
 * Convert a base64url-encoded VAPID public key into the `Uint8Array` that
 * `pushManager.subscribe` expects for `applicationServerKey`. This is the
 * well-known web-push client conversion: restore standard base64 padding, swap
 * the URL-safe alphabet, then decode each byte.
 */
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');

  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i += 1) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

/** Feature-detect the APIs required for web-push. */
function isPushSupported(): boolean {
  return (
    typeof window !== 'undefined' &&
    'Notification' in window &&
    'serviceWorker' in navigator &&
    'PushManager' in window
  );
}

export function EnablePushButton() {
  const [state, setState] = useState<PushState>('idle');
  const [supported, setSupported] = useState(true);
  const [feedback, setFeedback] = useState<Feedback | null>(null);

  const vapidConfigured = Boolean(VAPID_PUBLIC_KEY && VAPID_PUBLIC_KEY.length > 0);

  // Reflect existing permission + push subscription on mount (R3.4).
  useEffect(() => {
    if (!isPushSupported()) {
      setSupported(false);
      return;
    }

    let active = true;
    const checkExisting = async () => {
      try {
        if (Notification.permission !== 'granted') return;
        const registration = await navigator.serviceWorker.ready;
        const existing = await registration.pushManager.getSubscription();
        if (active && existing) {
          setState('enabled');
        }
      } catch (error) {
        console.error('[alerts] Error checking existing push subscription:', error);
      }
    };

    checkExisting();
    return () => {
      active = false;
    };
  }, []);

  const handleEnable = useCallback(async () => {
    setFeedback(null);

    if (!isPushSupported()) {
      setSupported(false);
      setFeedback({
        tone: 'error',
        message: 'Your browser does not support web-push notifications.',
      });
      return;
    }

    if (!vapidConfigured || !VAPID_PUBLIC_KEY) {
      setFeedback({
        tone: 'error',
        message: 'Push notifications are not configured on this server yet.',
      });
      return;
    }

    setState('working');

    try {
      // 1. Request notification permission (R3.4).
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        setState('idle');
        setFeedback({
          tone: 'info',
          message:
            permission === 'denied'
              ? 'Notifications are blocked. Enable them in your browser settings to receive alerts.'
              : 'Notification permission was not granted.',
        });
        return;
      }

      // 2. Use the already-registered service worker (PWA registers /sw.js).
      const registration = await navigator.serviceWorker.ready;

      // 3. Reuse an existing subscription or create a new one with the VAPID key.
      let subscription = await registration.pushManager.getSubscription();
      if (!subscription) {
        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
        });
      }

      // 4. Store the subscription server-side against the signed-in user (R3.4).
      const result = await savePushSubscription(subscription.toJSON());
      if (!result.ok) {
        setState('idle');
        setFeedback({
          tone: 'error',
          message:
            result.status === 401
              ? 'Your session expired. Please sign in again to enable notifications.'
              : result.error,
        });
        return;
      }

      setState('enabled');
      setFeedback({ tone: 'success', message: 'Notifications enabled on this device.' });
    } catch (error) {
      console.error('[alerts] Error enabling push notifications:', error);
      setState('idle');
      setFeedback({
        tone: 'error',
        message: 'Something went wrong while enabling notifications. Please try again.',
      });
    }
  }, [vapidConfigured]);

  // Unsupported browser: explain and render a disabled control.
  if (!supported) {
    return (
      <Alert className="border-amber-500/30 bg-amber-900/20 text-amber-200">
        <BellOff className="h-4 w-4" />
        <AlertDescription>
          This browser does not support web-push notifications, so device alerts are unavailable.
        </AlertDescription>
      </Alert>
    );
  }

  const enabled = state === 'enabled';
  const working = state === 'working';

  return (
    <div className="space-y-2">
      <Button
        type="button"
        variant={enabled ? 'secondary' : 'default'}
        onClick={handleEnable}
        disabled={working || enabled || !vapidConfigured}
        aria-live="polite"
      >
        {working ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Enabling…
          </>
        ) : enabled ? (
          <>
            <BellRing className="h-4 w-4" />
            Notifications enabled
          </>
        ) : (
          <>
            <Bell className="h-4 w-4" />
            Enable notifications
          </>
        )}
      </Button>

      {!vapidConfigured && (
        <p className="text-xs text-amber-300/80">
          Web-push is not configured (missing VAPID public key), so notifications can&apos;t be
          enabled right now.
        </p>
      )}

      {feedback && (
        <p
          className={
            feedback.tone === 'error'
              ? 'text-xs text-red-300'
              : feedback.tone === 'success'
                ? 'text-xs text-emerald-300'
                : 'text-xs text-[#ADADB8]'
          }
        >
          {feedback.message}
        </p>
      )}
    </div>
  );
}

export default EnablePushButton;
