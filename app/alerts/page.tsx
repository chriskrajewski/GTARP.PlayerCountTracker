'use client';

/**
 * Alerts page (R3.1, R3.2, R3.3, R3.4, R3.8 — task 7.14).
 *
 * Gated by the fail-closed `alerts` feature flag (R1.2/R1.4): the surface is
 * shown only when the flag is explicitly enabled; otherwise the page redirects
 * to `/`, matching `app/compare/page.tsx`.
 *
 * REQUIRES authentication (R3.3): when the visitor is not signed in, the page
 * renders a sign-in prompt + `LoginModal` and does NOT render the management
 * UI. When signed in, it renders the page header, the `EnablePushButton`
 * (web-push opt-in, R3.4), the `AlertSubscriptionForm` (create, R3.1/R3.2), and
 * the `AlertSubscriptionList` (view/edit/delete, R3.8).
 */
import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Bell, Sparkles, LogIn } from 'lucide-react';
import { CommonLayout } from '@/components/common-layout';
import { useFailClosedFeatureFlag, FEATURE_FLAGS } from '@/lib/feature-flags';
import { motion } from '@/components/ui/motion';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { LoginModal } from '@/components/login-modal';
import { getCurrentUser } from '@/lib/user-auth-supabase';
import { onUserAuthStateChange } from '@/lib/user-auth-supabase';
import { EnablePushButton } from '@/components/alerts/enable-push-button';
import { AlertSubscriptionForm } from '@/components/alerts/alert-subscription-form';
import { AlertSubscriptionList } from '@/components/alerts/alert-subscription-list';

/** Page header matching the cyber/neon aesthetic used across the app. */
function PageHeader() {
  return (
    <motion.div
      className="mb-6"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
    >
      <div className="mb-2 flex items-center gap-3">
        <motion.div
          className="flex h-10 w-10 items-center justify-center rounded-lg"
          style={{
            background:
              'linear-gradient(135deg, rgba(0, 217, 255, 0.2) 0%, rgba(20, 184, 166, 0.1) 100%)',
            border: '1px solid rgba(0, 217, 255, 0.3)',
          }}
          whileHover={{ scale: 1.05, rotate: 5 }}
        >
          <Bell className="h-5 w-5 text-cyan-400" />
        </motion.div>
        <div>
          <p className="flex items-center gap-1.5 text-sm text-gray-400">
            <Sparkles className="h-3.5 w-3.5 text-cyan-400" />
            Alerts
          </p>
        </div>
      </div>
      <p className="leading-relaxed text-gray-400">
        Get notified when a server&apos;s player count{' '}
        <span className="font-medium text-cyan-300">drops below a threshold</span> or when a{' '}
        <span className="font-medium text-purple-300">streamer goes live</span>. Enable web-push to
        receive alerts on this device.
      </p>
    </motion.div>
  );
}

/** Signed-out state: explain the gate and offer to sign in (R3.3). */
function SignInPrompt({ onSignIn }: { onSignIn: () => void }) {
  return (
    <Card variant="elevated">
      <CardContent className="flex flex-col items-center justify-center gap-3 py-16 text-center">
        <div
          className="flex h-12 w-12 items-center justify-center rounded-xl"
          style={{
            background:
              'linear-gradient(135deg, rgba(0, 217, 255, 0.2) 0%, rgba(20, 184, 166, 0.1) 100%)',
            border: '1px solid rgba(0, 217, 255, 0.3)',
          }}
        >
          <Bell className="h-6 w-6 text-cyan-400" />
        </div>
        <h3 className="text-lg font-semibold text-white">Sign in to manage alerts</h3>
        <p className="max-w-md text-sm text-[#ADADB8]">
          Alerts are tied to your account so we can notify you about the servers and streamers you
          care about. Sign in to create and manage your alert subscriptions.
        </p>
        <Button type="button" onClick={onSignIn} className="mt-2">
          <LogIn className="h-4 w-4" />
          Sign in
        </Button>
      </CardContent>
    </Card>
  );
}

export default function AlertsPage() {
  const router = useRouter();
  const isAlertsEnabled = useFailClosedFeatureFlag(FEATURE_FLAGS.ALERTS);

  const [authChecked, setAuthChecked] = useState(false);
  const [isAuthed, setIsAuthed] = useState(false);
  const [loginOpen, setLoginOpen] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  // Redirect away when the feature is disabled (fail-closed).
  useEffect(() => {
    if (!isAlertsEnabled) {
      router.replace('/');
    }
  }, [isAlertsEnabled, router]);

  // Resolve the current auth state and keep it in sync with sign-in/out.
  useEffect(() => {
    let active = true;

    getCurrentUser()
      .then((user) => {
        if (!active) return;
        setIsAuthed(Boolean(user));
        setAuthChecked(true);
      })
      .catch(() => {
        if (!active) return;
        setIsAuthed(false);
        setAuthChecked(true);
      });

    const subscription = onUserAuthStateChange((user) => {
      setIsAuthed(Boolean(user));
      setAuthChecked(true);
    });

    return () => {
      active = false;
      subscription?.unsubscribe();
    };
  }, []);

  const handleCreated = useCallback(() => {
    setRefreshKey((key) => key + 1);
  }, []);

  const handleUnauthorized = useCallback(() => {
    setIsAuthed(false);
    setLoginOpen(true);
  }, []);

  // Render nothing while disabled to avoid flashing gated content.
  if (!isAlertsEnabled) {
    return null;
  }

  return (
    <CommonLayout showBackButton pageTitle="Alerts">
      <PageHeader />

      {!authChecked ? (
        <div className="py-12 text-center text-[#ADADB8]">Loading…</div>
      ) : !isAuthed ? (
        <SignInPrompt onSignIn={() => setLoginOpen(true)} />
      ) : (
        <div className="space-y-6">
          {/* Web-push opt-in (R3.4) */}
          <Card variant="glass">
            <CardContent className="flex flex-col gap-3 py-5 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h3 className="text-sm font-semibold text-white">Device notifications</h3>
                <p className="text-xs text-[#ADADB8]">
                  Allow this device to receive your alerts via web-push.
                </p>
              </div>
              <EnablePushButton />
            </CardContent>
          </Card>

          {/* Create (R3.1, R3.2) */}
          <AlertSubscriptionForm onCreated={handleCreated} onUnauthorized={handleUnauthorized} />

          {/* List / edit / delete (R3.8) */}
          <AlertSubscriptionList refreshKey={refreshKey} onUnauthorized={handleUnauthorized} />
        </div>
      )}

      <LoginModal
        isOpen={loginOpen}
        onOpenChange={setLoginOpen}
        title="Sign in to manage alerts"
        description="Log in with Discord to create and manage your alert subscriptions."
      />
    </CommonLayout>
  );
}
