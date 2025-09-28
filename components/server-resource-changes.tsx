"use client";

import { useEffect, useMemo, useState } from "react";
import { RefreshCw, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import {
  type ServerData,
  type ServerResourceChange,
  getServerResourceChanges
} from "@/lib/data";

type ServerResourceChangesProps = {
  isOpen: boolean;
  servers: ServerData[];
  selectedServers: string[];
};

const dateFormatter = new Intl.DateTimeFormat(undefined, {
  year: "numeric",
  month: "short",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit"
});

function formatTimestamp(timestamp: string) {
  try {
    return dateFormatter.format(new Date(timestamp));
  } catch (_err) {
    return timestamp;
  }
}

export function ServerResourceChanges({
  isOpen,
  servers,
  selectedServers
}: ServerResourceChangesProps) {
  const [changes, setChanges] = useState<ServerResourceChange[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const serverNameMap = useMemo(() => {
    return servers.reduce<Record<string, string>>((acc, server) => {
      acc[server.server_id] = server.server_name;
      return acc;
    }, {});
  }, [servers]);

  const fetchChanges = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getServerResourceChanges(selectedServers ?? [], 100);
      setChanges(data);
    } catch (err) {
      console.error("Error loading server resource changes:", err);
      setError("Failed to load server changes. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!isOpen) return;
    fetchChanges();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, JSON.stringify(selectedServers)]);

  const hasSelectedServers = Array.isArray(selectedServers) && selectedServers.length > 0;

  return (
    <div className="space-y-4 text-white">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <div>
          <h2 className="text-lg font-semibold">Server Resource Changes</h2>
          <p className="text-xs text-[#ADADB8]">
            Tracking updates to the FiveM resource list{hasSelectedServers ? " for selected servers. This can provide insights into whether a server has added or changed a feature." : "."}
          </p>
        </div>
        <Button
          onClick={fetchChanges}
          variant="secondary"
          size="sm"
          className="bg-[#18181b] hover:bg-[#26262c] text-white"
          disabled={loading}
        >
          {loading ? (
            <Loader2 className="mr-1 h-4 w-4 animate-spin" />
          ) : (
            <RefreshCw className="mr-1 h-4 w-4" />
          )}
          Refresh
        </Button>
      </div>

      {error && <div className="rounded-md border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-200">{error}</div>}

      {!loading && changes.length === 0 && !error && (
        <div className="rounded-md border border-[#26262c] bg-[#18181b] p-4 text-sm text-[#ADADB8]">
          No resource changes have been recorded yet{hasSelectedServers ? " for the selected servers." : "."}
        </div>
      )}

      <ScrollArea className="max-h-[420px] pr-2">
        <div className="space-y-3">
          {changes.map((change) => {
            const added = change.added_resources ?? [];
            const removed = change.removed_resources ?? [];
            return (
              <div
                key={change.id}
                className="rounded-md border border-[#26262c] bg-[#18181b] p-3"
              >
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 text-xs text-[#ADADB8]">
                  <span className="font-medium text-white">
                    {serverNameMap[change.server_id] || `Server ${change.server_id}`}
                  </span>
                  <span>{formatTimestamp(change.timestamp)}</span>
                </div>

                {added.length > 0 && (
                  <div className="mt-3">
                    <p className="text-[11px] uppercase tracking-wide text-emerald-400">Added</p>
                    <div className="mt-1 flex flex-wrap gap-1">
                      {added.map((resource) => (
                        <Badge
                          key={`added-${change.id}-${resource}`}
                          className="bg-emerald-500/20 text-emerald-100 border border-emerald-500/40"
                        >
                          {resource}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                {removed.length > 0 && (
                  <div className="mt-3">
                    <p className="text-[11px] uppercase tracking-wide text-rose-400">Removed</p>
                    <div className="mt-1 flex flex-wrap gap-1">
                      {removed.map((resource) => (
                        <Badge
                          key={`removed-${change.id}-${resource}`}
                          className="bg-rose-500/20 text-rose-100 border border-rose-500/40"
                        >
                          {resource}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                {added.length === 0 && removed.length === 0 && (
                  <p className="mt-3 text-xs text-[#ADADB8]">
                    Resource list changed but no specific additions or removals were detected.
                  </p>
                )}
              </div>
            );
          })}
        </div>
      </ScrollArea>
    </div>
  );
}

export default ServerResourceChanges;
