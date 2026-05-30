'use client';

/**
 * Alert_System — list/manage subscriptions (R3.8, task 7.14).
 *
 * Fetches the signed-in user's own subscriptions (`GET /api/alerts/subscriptions`
 * with the Bearer token) on mount and whenever `refreshKey` changes. Each row
 * renders a human-readable description, an enable/disable toggle
 * (`PATCH { isEnabled }`), and a delete button (`DELETE`). It shows a loading
 * state, an empty state, and an error state, and refreshes after any change.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Loader2, Trash2, Users, Radio, BellRing } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { getServers, type ServerData } from '@/lib/data';
import {
  fetchSubscriptions,
  updateSubscription,
  deleteSubscription,
  type AlertSubscription,
} from './alerts-api';

interface AlertSubscriptionListProps {
  /** Bumping this value triggers a refetch (e.g. after a create). */
  refreshKey: number;
  /** Called when a request comes back 401 so the page can prompt sign-in. */
  onUnauthorized?: () => void;
}

/** Build a friendly platform label. */
function platformLabel(platform: string): string {
  return platform === 'kick' ? 'Kick' : 'Twitch';
}

export function AlertSubscriptionList({ refreshKey, onUnauthorized }: AlertSubscriptionListProps) {
  const [subscriptions, setSubscriptions] = useState<AlertSubscription[]>([]);
  const [serverNames, setServerNames] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pendingId, setPendingId] = useState<number | null>(null);

  // Server-id → name map so player-count rules read naturally.
  useEffect(() => {
    let active = true;
    getServers()
      .then((list: ServerData[]) => {
        if (!active) return;
        const map: Record<string, string> = {};
        list.forEach((s) => {
          map[s.server_id] = s.server_name;
        });
        setServerNames(map);
      })
      .catch((err) => console.error('[alerts] Error loading server names:', err));
    return () => {
      active = false;
    };
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const result = await fetchSubscriptions();
    if (!result.ok) {
      setLoading(false);
      if (result.status === 401) {
        onUnauthorized?.();
        setError('Your session expired. Please sign in again.');
        return;
      }
      setError(result.error);
      return;
    }
    setSubscriptions(result.data);
    setLoading(false);
  }, [onUnauthorized]);

  useEffect(() => {
    load();
  }, [load, refreshKey]);

  const handleToggle = useCallback(
    async (subscription: AlertSubscription) => {
      setPendingId(subscription.id);
      setError(null);
      const result = await updateSubscription(subscription.id, {
        isEnabled: !subscription.isEnabled,
      });
      setPendingId(null);

      if (!result.ok) {
        if (result.status === 401) onUnauthorized?.();
        setError(result.error);
        return;
      }
      setSubscriptions((prev) =>
        prev.map((s) => (s.id === result.data.id ? result.data : s)),
      );
    },
    [onUnauthorized],
  );

  const handleDelete = useCallback(
    async (id: number) => {
      setPendingId(id);
      setError(null);
      const result = await deleteSubscription(id);
      setPendingId(null);

      if (!result.ok) {
        if (result.status === 401) onUnauthorized?.();
        setError(result.error);
        return;
      }
      setSubscriptions((prev) => prev.filter((s) => s.id !== id));
    },
    [onUnauthorized],
  );

  const describe = useCallback(
    (subscription: AlertSubscription): string => {
      if (subscription.type === 'player_count_below') {
        const name = serverNames[subscription.serverId] || subscription.serverId;
        return `Alert when ${name} drops below ${subscription.threshold} players`;
      }
      return `Alert when ${subscription.streamerUsername} goes live on ${platformLabel(
        subscription.streamerPlatform,
      )}`;
    },
    [serverNames],
  );

  const hasSubscriptions = subscriptions.length > 0;
  const content = useMemo(() => {
    if (loading) {
      return (
        <div className="flex items-center justify-center gap-2 py-12 text-[#ADADB8]">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading your alerts…
        </div>
      );
    }

    if (!hasSubscriptions) {
      return (
        <div className="flex flex-col items-center justify-center gap-3 py-12 text-center">
          <div
            className="flex h-12 w-12 items-center justify-center rounded-xl"
            style={{
              background:
                'linear-gradient(135deg, rgba(0, 217, 255, 0.2) 0%, rgba(20, 184, 166, 0.1) 100%)',
              border: '1px solid rgba(0, 217, 255, 0.3)',
            }}
          >
            <BellRing className="h-6 w-6 text-cyan-400" />
          </div>
          <h3 className="text-lg font-semibold text-white">No alerts yet</h3>
          <p className="max-w-md text-sm text-[#ADADB8]">
            Create your first alert above to get notified when a server empties out or a streamer
            goes live.
          </p>
        </div>
      );
    }

    return (
      <ul className="space-y-3">
        {subscriptions.map((subscription) => {
          const isPending = pendingId === subscription.id;
          const isPlayerCount = subscription.type === 'player_count_below';
          const toggleId = `alert-enabled-${subscription.id}`;
          return (
            <li
              key={subscription.id}
              className="flex flex-col gap-3 rounded-lg border border-[#26262c] bg-[#18181b]/60 p-4 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="flex items-start gap-3">
                <span
                  className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg"
                  style={{
                    background: isPlayerCount
                      ? 'rgba(0, 217, 255, 0.12)'
                      : 'rgba(168, 85, 247, 0.14)',
                    border: `1px solid ${isPlayerCount ? 'rgba(0, 217, 255, 0.3)' : 'rgba(168, 85, 247, 0.3)'}`,
                  }}
                >
                  {isPlayerCount ? (
                    <Users className="h-4 w-4 text-cyan-400" />
                  ) : (
                    <Radio className="h-4 w-4 text-purple-400" />
                  )}
                </span>
                <div>
                  <p className="text-sm font-medium text-white">{describe(subscription)}</p>
                  <p className="text-xs text-[#ADADB8]">
                    {subscription.isEnabled ? 'Active' : 'Paused'}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-4 sm:gap-3">
                <div className="flex items-center gap-2">
                  <Switch
                    id={toggleId}
                    checked={subscription.isEnabled}
                    disabled={isPending}
                    onCheckedChange={() => handleToggle(subscription)}
                    aria-label={
                      subscription.isEnabled ? 'Disable this alert' : 'Enable this alert'
                    }
                  />
                  <Label htmlFor={toggleId} className="text-xs text-[#ADADB8]">
                    {subscription.isEnabled ? 'On' : 'Off'}
                  </Label>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  disabled={isPending}
                  onClick={() => handleDelete(subscription.id)}
                  aria-label="Delete this alert"
                >
                  {isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Trash2 className="h-4 w-4 text-red-400" />
                  )}
                </Button>
              </div>
            </li>
          );
        })}
      </ul>
    );
  }, [loading, hasSubscriptions, subscriptions, pendingId, describe, handleToggle, handleDelete]);

  return (
    <Card variant="elevated">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <BellRing className="h-5 w-5 text-cyan-400" />
          Your alerts
        </CardTitle>
      </CardHeader>
      <CardContent>
        {error && (
          <Alert className="mb-4 border-red-500/30 bg-red-900/20 text-red-200">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        {content}
      </CardContent>
    </Card>
  );
}

export default AlertSubscriptionList;
