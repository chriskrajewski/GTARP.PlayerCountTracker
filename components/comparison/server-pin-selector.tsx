'use client';

import { useMemo, useState } from 'react';
import { Plus, X, Server as ServerIcon } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { ServerData } from '@/lib/data';
import {
  MAX_PINNED_SERVERS,
  validatePinnedSelection,
  removePinnedServer,
} from '@/lib/comparison-prefs';

interface ServerPinSelectorProps {
  /** Full list of selectable servers (from `getServers()`). */
  servers: ServerData[];
  /** Currently pinned server ids, in display order. */
  pinned: string[];
  /** Called with the next pinned set whenever the user adds/removes a server. */
  onChange: (next: string[]) => void;
  /** Color assigned to each pinned server (for the chip accent, R2.8). */
  colorMap: Record<string, string>;
}

/**
 * Add/remove control for the pinned-server set (R2.2, R2.7).
 *
 * Adding is gated by {@link validatePinnedSelection}: attempting to pin a 5th
 * distinct server is PREVENTED and the "4-server maximum" message is shown
 * (R2.2). Removing a chip uses {@link removePinnedServer}, retaining the rest
 * (R2.7). All bound logic is delegated to the pure `lib/` helpers — this
 * component never re-implements validation.
 */
export function ServerPinSelector({
  servers,
  pinned,
  onChange,
  colorMap,
}: ServerPinSelectorProps) {
  const [maxMessage, setMaxMessage] = useState<string | null>(null);

  const serverNameMap = useMemo(() => {
    const map: Record<string, string> = {};
    servers.forEach((s) => {
      map[s.server_id] = s.server_name;
    });
    return map;
  }, [servers]);

  // Servers that are not yet pinned — candidates for the add dropdown.
  const available = useMemo(
    () => servers.filter((s) => !pinned.includes(s.server_id)),
    [servers, pinned],
  );

  const atMax = pinned.length >= MAX_PINNED_SERVERS;

  const handleAdd = (serverId: string) => {
    // Validate the prospective selection BEFORE applying it (R2.2).
    const candidate = [...pinned, serverId];
    const result = validatePinnedSelection(candidate);

    if (!result.valid && result.reason === 'too_many') {
      setMaxMessage(result.message ?? `You can pin a maximum of ${MAX_PINNED_SERVERS} servers.`);
      return;
    }

    setMaxMessage(null);
    onChange(candidate);
  };

  const handleRemove = (serverId: string) => {
    setMaxMessage(null);
    onChange(removePinnedServer(pinned, serverId));
  };

  return (
    <div className="space-y-3">
      {/* Pinned server chips with remove controls (R2.7). */}
      <div className="flex flex-wrap gap-2">
        {pinned.map((serverId) => {
          const accent = colorMap[serverId];
          return (
            <span
              key={serverId}
              className="inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm"
              style={{
                backgroundColor: 'rgba(24, 24, 27, 0.8)',
                borderColor: accent ? accent : 'rgba(0, 217, 255, 0.3)',
                color: '#EFEFF1',
              }}
            >
              <span
                className="inline-block h-2.5 w-2.5 rounded-full"
                style={{ backgroundColor: accent ?? '#00D9FF' }}
              />
              <span className="max-w-[160px] truncate">
                {serverNameMap[serverId] || `Server ${serverId}`}
              </span>
              <button
                type="button"
                onClick={() => handleRemove(serverId)}
                className="rounded-full p-0.5 text-[#ADADB8] transition-colors hover:text-white"
                aria-label={`Remove ${serverNameMap[serverId] || serverId}`}
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </span>
          );
        })}

        {pinned.length === 0 && (
          <span className="text-sm text-[#ADADB8]">No servers pinned yet.</span>
        )}
      </div>

      {/* Add control — disabled at the 4-server maximum (R2.2). */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="w-full sm:w-72">
          <Select
            // `value` is intentionally uncontrolled-as-empty: each pick is a
            // one-shot "add" action, so we reset after selecting.
            value=""
            onValueChange={handleAdd}
            disabled={atMax || available.length === 0}
          >
            <SelectTrigger aria-label="Add a server to compare">
              <span className="flex items-center gap-2 text-sm">
                <Plus className="h-4 w-4 text-cyan-400" />
                <SelectValue
                  placeholder={
                    atMax
                      ? `Maximum of ${MAX_PINNED_SERVERS} servers pinned`
                      : available.length === 0
                        ? 'All servers pinned'
                        : 'Add a server…'
                  }
                />
              </span>
            </SelectTrigger>
            <SelectContent>
              {available.map((s) => (
                <SelectItem key={s.server_id} value={s.server_id}>
                  <span className="flex items-center gap-2">
                    <ServerIcon className="h-3.5 w-3.5 text-cyan-400/70" />
                    {s.server_name}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <span className="text-xs text-[#ADADB8]">
          {pinned.length}/{MAX_PINNED_SERVERS} pinned
        </span>
      </div>

      {/* 4-server maximum message (R2.2). */}
      {maxMessage && (
        <p className="text-sm text-amber-400" role="alert">
          {maxMessage}
        </p>
      )}
    </div>
  );
}

export default ServerPinSelector;
