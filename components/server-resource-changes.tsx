"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { RefreshCw, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger
} from "@/components/ui/accordion";
import {
  type ServerData,
  type ServerResourceChange,
  type ServerResourceSnapshot,
  getServerResourceChanges,
  getLatestServerResourceSnapshots
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
  const [latestSnapshots, setLatestSnapshots] = useState<Record<string, ServerResourceSnapshot>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedServers, setExpandedServers] = useState<string[]>([]);
  const sectionRefs = useRef<Record<string, HTMLElement | null>>({});

  const serverNameMap = useMemo(() => {
    return servers.reduce<Record<string, string>>((acc, server) => {
      acc[server.server_id] = server.server_name;
      return acc;
    }, {});
  }, [servers]);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [changesResult, snapshotsResult] = await Promise.allSettled([
        getServerResourceChanges(selectedServers ?? [], 100),
        getLatestServerResourceSnapshots(selectedServers ?? [], 200)
      ]);

      let message: string | null = null;

      if (changesResult.status === "fulfilled") {
        setChanges(changesResult.value);
      } else {
        console.error("Error loading server resource changes:", changesResult.reason);
        setChanges([]);
        message = "Failed to load server changes.";
      }

      if (snapshotsResult.status === "fulfilled") {
        const snapshotMap: Record<string, ServerResourceSnapshot> = {};
        for (const snapshot of snapshotsResult.value) {
          snapshotMap[snapshot.server_id] = snapshot;
        }
        setLatestSnapshots(snapshotMap);
      } else {
        console.error("Error loading server resource snapshots:", snapshotsResult.reason);
        setLatestSnapshots({});
        message = message
          ? `${message} Current resource lists unavailable.`
          : "Failed to load current resource lists.";
      }

      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const handleServerBadgeClick = (serverId: string) => {
    setExpandedServers((prev) => {
      if (prev.includes(serverId)) return prev;
      return [...prev, serverId];
    });

    // Allow accordion state update to render before scrolling
    setTimeout(() => {
      const target = sectionRefs.current[serverId];
      if (target) {
        target.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    }, 75);
  };

  useEffect(() => {
    if (!isOpen) return;
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, JSON.stringify(selectedServers)]);

  useEffect(() => {
    if (isOpen) {
      setExpandedServers([]);
    }
  }, [isOpen, JSON.stringify(selectedServers)]);

  const hasSelectedServers = Array.isArray(selectedServers) && selectedServers.length > 0;

  const serverIdsToDisplay = useMemo(() => {
    if (hasSelectedServers) {
      return selectedServers;
    }

    const ids = new Set<string>();
    Object.keys(latestSnapshots).forEach((id) => ids.add(id));
    changes.forEach((change) => ids.add(change.server_id));

    if (ids.size === 0) {
      servers.forEach((server) => ids.add(server.server_id));
    }

    return Array.from(ids);
  }, [hasSelectedServers, selectedServers, latestSnapshots, changes, servers]);

  return (
    <div className="space-y-4 text-white">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <div>
          <h2 className="text-lg font-semibold">Server Resource Changes</h2>
          <p className="text-xs text-[#ADADB8]">
            Tracking updates to the FiveM resource list
            {hasSelectedServers
              ? " for selected servers. This can highlight newly added or updated features."
              : "."}
          </p>
        </div>
        <Button
          onClick={loadData}
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

      {hasSelectedServers ? (
        <div className="flex flex-wrap gap-1 text-xs">
          {selectedServers.map((serverId) => (
            <button
              key={`selected-${serverId}`}
              type="button"
              onClick={() => handleServerBadgeClick(serverId)}
              className="rounded-full border border-[#3b3b44] bg-[#26262c] px-2.5 py-1 text-[#EFEFF1] transition-colors hover:border-[#4b4b55] hover:bg-[#2f2f39]"
            >
              {serverNameMap[serverId] || `Server ${serverId}`}
            </button>
          ))}
        </div>
      ) : (
        <p className="text-xs text-[#ADADB8]">
          No servers selected. Showing data for all tracked servers.
        </p>
      )}

      {error && (
        <div className="rounded-md border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-200">
          {error}
        </div>
      )}

      <ScrollArea className="h-[60vh] min-h-[280px] pr-2">
        <div className="space-y-4 pb-2">
          <div className="rounded-md border border-[#26262c] bg-[#18181b] p-3">
            <h3 className="text-sm font-semibold text-white">Change History</h3>
            <p className="text-xs text-[#ADADB8]">
              Logged differences between consecutive snapshots.
            </p>

            {!loading && changes.length === 0 && !error && (
              <div className="mt-3 rounded-md border border-[#26262c] bg-[#141417] p-3 text-sm text-[#ADADB8]">
                No resource changes have been recorded yet
                {hasSelectedServers ? " for the selected servers." : "."}
              </div>
            )}

            <div className="mt-3 space-y-3">
              {changes.map((change) => {
                const added = change.added_resources ?? [];
                const removed = change.removed_resources ?? [];
                return (
                  <div
                    key={change.id}
                    className="rounded-md border border-[#26262c] bg-[#141417] p-3"
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
          </div>

          <div className="rounded-md border border-[#26262c] bg-[#18181b] p-3">
            <h3 className="text-sm font-semibold text-white">Current Resource Lists</h3>
            <p className="text-xs text-[#ADADB8]">
              Latest snapshot pulled from the FiveM API for each server.
            </p>

            {serverIdsToDisplay.length === 0 && (
              <div className="mt-3 rounded-md border border-[#26262c] bg-[#141417] p-3 text-xs text-[#ADADB8]">
                No servers available to display.
              </div>
            )}

            <div className="mt-3">
              <Accordion
                type="multiple"
                value={expandedServers}
                onValueChange={(value) =>
                  setExpandedServers(Array.isArray(value) ? value : [])
                }
                className="space-y-2"
              >
                {serverIdsToDisplay.map((serverId) => {
                  const snapshot = latestSnapshots[serverId];
                  const resources = Array.isArray(snapshot?.resources) ? snapshot.resources : [];

                  return (
                    <AccordionItem
                      key={`snapshot-${serverId}`}
                      value={serverId}
                      ref={(el) => {
                        sectionRefs.current[serverId] = el;
                      }}
                      className="scroll-mt-20 overflow-hidden rounded-md border border-[#26262c] bg-[#141417]"
                    >
                      <AccordionTrigger className="px-3">
                        <div className="flex flex-1 flex-col items-start gap-1 text-left">
                          <span className="text-sm font-semibold text-white">
                            {serverNameMap[serverId] || `Server ${serverId}`}
                          </span>
                          <span className="text-[11px] text-[#ADADB8]">
                            {snapshot
                              ? `Last updated ${formatTimestamp(snapshot.timestamp)} • ${resources.length} resources`
                              : "No snapshot yet"}
                          </span>
                        </div>
                      </AccordionTrigger>
                      <AccordionContent className="px-3">
                        {resources.length > 0 ? (
                          <div className="flex flex-wrap gap-1">
                            {resources.map((resource) => (
                              <Badge
                                key={`snapshot-${serverId}-${resource}`}
                                className="bg-[#1f1f24] text-[#EFEFF1] border border-[#2e2e36]"
                              >
                                {resource}
                              </Badge>
                            ))}
                          </div>
                        ) : (
                          <p className="text-xs text-[#ADADB8]">
                            No resource data captured yet for this server.
                          </p>
                        )}
                      </AccordionContent>
                    </AccordionItem>
                  );
                })}
              </Accordion>
            </div>
          </div>
        </div>
      </ScrollArea>
    </div>
  );
}

export default ServerResourceChanges;
