'use client';

/**
 * Alert_System — create-subscription form (R3.1, R3.2, task 7.14).
 *
 * Lets a signed-in user create either:
 *   - a "player count below threshold" rule — a target server (`Select` from
 *     `getServers()`) + an integer threshold (R3.1); or
 *   - a "streamer live" rule — a streamer username + a platform ('twitch' |
 *     'kick') (R3.2).
 *
 * On submit it POSTs the discriminated body to `/api/alerts/subscriptions`
 * (via the shared `createSubscription` helper, which carries the Bearer token).
 * Validation errors returned by the API (HTTP 400) are displayed inline; on
 * success the form resets and notifies its parent via `onCreated` so the list
 * refreshes (R3.8).
 */
import { useEffect, useState } from 'react';
import { Loader2, Plus, AlertCircle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { getServers, type ServerData } from '@/lib/data';
import type { StreamerPlatform } from '@/lib/alerts';
import { createSubscription, type NewAlertSubscription } from './alerts-api';

type AlertType = 'player_count_below' | 'streamer_live';

interface AlertSubscriptionFormProps {
  /** Called after a subscription is successfully created so the list can refresh. */
  onCreated: () => void;
  /** Called when a request comes back 401 so the page can prompt sign-in. */
  onUnauthorized?: () => void;
}

export function AlertSubscriptionForm({ onCreated, onUnauthorized }: AlertSubscriptionFormProps) {
  const [alertType, setAlertType] = useState<AlertType>('player_count_below');

  // player_count_below fields
  const [servers, setServers] = useState<ServerData[]>([]);
  const [serverId, setServerId] = useState('');
  const [threshold, setThreshold] = useState('');

  // streamer_live fields
  const [streamerUsername, setStreamerUsername] = useState('');
  const [streamerPlatform, setStreamerPlatform] = useState<StreamerPlatform>('twitch');

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load the selectable server list for the player-count picker.
  useEffect(() => {
    let active = true;
    getServers()
      .then((list) => {
        if (active) setServers(list);
      })
      .catch((err) => {
        console.error('[alerts] Error loading servers:', err);
      });
    return () => {
      active = false;
    };
  }, []);

  const resetFields = () => {
    setServerId('');
    setThreshold('');
    setStreamerUsername('');
    setStreamerPlatform('twitch');
  };

  /** Build the discriminated request body, or return an error message. */
  const buildBody = (): { ok: true; body: NewAlertSubscription } | { ok: false; error: string } => {
    if (alertType === 'player_count_below') {
      if (!serverId) {
        return { ok: false, error: 'Select a server to watch.' };
      }
      const parsed = Number(threshold);
      if (!threshold.trim() || !Number.isInteger(parsed) || parsed < 0) {
        return { ok: false, error: 'Enter a whole number threshold of 0 or more.' };
      }
      return { ok: true, body: { type: 'player_count_below', serverId, threshold: parsed } };
    }

    const username = streamerUsername.trim();
    if (!username) {
      return { ok: false, error: 'Enter a streamer username.' };
    }
    return {
      ok: true,
      body: { type: 'streamer_live', streamerUsername: username, streamerPlatform },
    };
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);

    const built = buildBody();
    if (!built.ok) {
      setError(built.error);
      return;
    }

    setSubmitting(true);
    const result = await createSubscription(built.body);
    setSubmitting(false);

    if (!result.ok) {
      if (result.status === 401) {
        onUnauthorized?.();
        setError('Your session expired. Please sign in again.');
        return;
      }
      setError(result.error);
      return;
    }

    resetFields();
    onCreated();
  };

  return (
    <Card variant="glass">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Plus className="h-5 w-5 text-cyan-400" />
          Create an alert
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Alert type selector */}
          <div className="space-y-2">
            <Label htmlFor="alert-type">Alert type</Label>
            <Select
              value={alertType}
              onValueChange={(v) => {
                setAlertType(v as AlertType);
                setError(null);
              }}
            >
              <SelectTrigger id="alert-type" aria-label="Alert type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="player_count_below">Player count below threshold</SelectItem>
                <SelectItem value="streamer_live">Streamer goes live</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {alertType === 'player_count_below' ? (
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="alert-server">Server</Label>
                <Select value={serverId} onValueChange={setServerId}>
                  <SelectTrigger id="alert-server" aria-label="Server to watch">
                    <SelectValue placeholder="Choose a server" />
                  </SelectTrigger>
                  <SelectContent>
                    {servers.map((server) => (
                      <SelectItem key={server.server_id} value={server.server_id}>
                        {server.server_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="alert-threshold">Player count threshold</Label>
                <Input
                  id="alert-threshold"
                  type="number"
                  inputMode="numeric"
                  min={0}
                  step={1}
                  placeholder="e.g. 50"
                  value={threshold}
                  onChange={(e) => setThreshold(e.target.value)}
                />
              </div>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="alert-streamer">Streamer username</Label>
                <Input
                  id="alert-streamer"
                  type="text"
                  placeholder="e.g. summit1g"
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                  value={streamerUsername}
                  onChange={(e) => setStreamerUsername(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="alert-platform">Platform</Label>
                <Select
                  value={streamerPlatform}
                  onValueChange={(v) => setStreamerPlatform(v as StreamerPlatform)}
                >
                  <SelectTrigger id="alert-platform" aria-label="Streamer platform">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="twitch">Twitch</SelectItem>
                    <SelectItem value="kick">Kick</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          {error && (
            <Alert className="border-red-500/30 bg-red-900/20 text-red-200">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <Button type="submit" disabled={submitting}>
            {submitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Creating…
              </>
            ) : (
              <>
                <Plus className="h-4 w-4" />
                Create alert
              </>
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

export default AlertSubscriptionForm;
