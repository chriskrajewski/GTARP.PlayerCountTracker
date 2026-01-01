"use client";

import { useState } from 'react';
import { ChevronDown, ChevronUp, TrendingDown, TrendingUp, Clock, Zap } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { RestartEvent } from '@/hooks/use-restart-predictions';

interface RestartEventsTimelineProps {
  events: RestartEvent[];
  className?: string;
}

/**
 * Formats a date for display
 */
function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    timeZone: 'UTC',
  });
}

/**
 * Formats time since for display
 */
function formatTimeSince(dateString: string): string {
  const pastDate = new Date(dateString);
  const now = new Date();
  const diff = now.getTime() - pastDate.getTime();

  if (diff <= 0) {
    return 'Just now';
  }

  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

  if (days > 0) {
    return `${days}d ${hours}h ago`;
  } else if (hours > 0) {
    return `${hours}h ${minutes}m ago`;
  } else {
    return `${minutes}m ago`;
  }
}

/**
 * Calculates player count change percentage
 */
function calculatePlayerDropPercentage(before: number, after: number): number {
  if (before === 0) return 0;
  return Math.round(((before - after) / before) * 100);
}

/**
 * Displays a timeline of actual restart events with real data
 */
export function RestartEventsTimeline({
  events,
  className,
}: RestartEventsTimelineProps) {
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);

  if (!events || events.length === 0) {
    return (
      <Card className="bg-[#1a1a1e] border-[#26262c]">
        <CardContent className="p-8 text-center">
          <Clock className="h-12 w-12 text-[#ADADB8] mx-auto mb-4" />
          <h3 className="text-lg font-medium text-white mb-2">No Restart Events</h3>
          <p className="text-[#ADADB8]">
            No restart events have been detected yet. Check back once the server has restarted.
          </p>
        </CardContent>
      </Card>
    );
  }

  // Sort events by timestamp (newest first)
  const sortedEvents = [...events].sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );

  return (
    <Card className="bg-[#1a1a1e] border-[#26262c]">
      <CardHeader>
        <CardTitle className="text-white flex items-center space-x-2">
          <Clock className="h-5 w-5 text-[#9147ff]" />
          <span>Restart Event History</span>
        </CardTitle>
        <CardDescription className="text-[#ADADB8]">
          {events.length} restart event{events.length !== 1 ? 's' : ''} detected in the last 14 days
        </CardDescription>
      </CardHeader>
      <CardContent className={cn('space-y-0', className)}>
        {/* Timeline */}
        <div className="relative">
          {/* Vertical line */}
          <div className="absolute left-6 top-0 bottom-0 w-0.5 bg-gradient-to-b from-[#9147ff] to-[#40404a]" />

          {/* Timeline items */}
          <div className="space-y-0">
            {sortedEvents.map((event, index) => {
              const isExpanded = expandedIndex === index;
              const playerDropPercentage = calculatePlayerDropPercentage(
                event.playerCountBefore,
                event.playerCountAfter
              );

              return (
                <div key={index} className="relative">
                  {/* Timeline dot */}
                  <div className="absolute left-0 top-4 w-4 h-4 rounded-full bg-[#9147ff] border-4 border-[#1a1a1e] shadow-lg" />

                  {/* Event card */}
                  <div className="ml-16 pb-6">
                    <button
                      onClick={() => setExpandedIndex(isExpanded ? null : index)}
                      className="w-full text-left"
                    >
                      <div className="bg-[#26262c]/50 hover:bg-[#26262c]/70 rounded-lg p-4 transition-colors border border-[#40404a]/30 hover:border-[#40404a]/60">
                        {/* Header row */}
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center space-x-3 flex-1">
                            <div className="flex-shrink-0">
                              <TrendingDown className="h-5 w-5 text-red-400" />
                            </div>
                            <div className="flex-1">
                              <p className="text-sm font-semibold text-white">
                                Restart Event #{sortedEvents.length - index}
                              </p>
                              <p className="text-xs text-[#ADADB8] mt-0.5">
                                {formatDate(event.timestamp)}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center space-x-3">
                            <Badge variant="outline" className="text-xs border-[#40404a] text-[#ADADB8]">
                              {formatTimeSince(event.timestamp)}
                            </Badge>
                            <button
                              className="p-1 hover:bg-[#40404a]/50 rounded transition-colors"
                              onClick={(e) => {
                                e.stopPropagation();
                                setExpandedIndex(isExpanded ? null : index);
                              }}
                            >
                              {isExpanded ? (
                                <ChevronUp className="h-4 w-4 text-[#ADADB8]" />
                              ) : (
                                <ChevronDown className="h-4 w-4 text-[#ADADB8]" />
                              )}
                            </button>
                          </div>
                        </div>

                        {/* Summary row */}
                        <div className="grid grid-cols-3 gap-3">
                          {/* Player count drop */}
                          <div className="bg-[#1a1a1e]/50 rounded p-2">
                            <p className="text-xs text-[#ADADB8] mb-1">Player Drop</p>
                            <div className="flex items-center space-x-1">
                              <TrendingDown className="h-4 w-4 text-red-400" />
                              <p className="text-sm font-semibold text-red-400">
                                {playerDropPercentage}%
                              </p>
                            </div>
                            <p className="text-xs text-[#ADADB8] mt-1">
                              {event.playerCountBefore} → {event.playerCountAfter}
                            </p>
                          </div>

                          {/* Downtime */}
                          <div className="bg-[#1a1a1e]/50 rounded p-2">
                            <p className="text-xs text-[#ADADB8] mb-1">Downtime</p>
                            <div className="flex items-center space-x-1">
                              <Zap className="h-4 w-4 text-yellow-400" />
                              <p className="text-sm font-semibold text-yellow-400">
                                {event.downtime}m
                              </p>
                            </div>
                          </div>

                          {/* Recovery */}
                          <div className="bg-[#1a1a1e]/50 rounded p-2">
                            <p className="text-xs text-[#ADADB8] mb-1">Recovery</p>
                            <div className="flex items-center space-x-1">
                              <TrendingUp className="h-4 w-4 text-green-400" />
                              <p className="text-sm font-semibold text-green-400">
                                {event.playerCountAfter > 0 ? 'Online' : 'Offline'}
                              </p>
                            </div>
                          </div>
                        </div>

                        {/* Expanded details */}
                        {isExpanded && (
                          <div className="mt-4 pt-4 border-t border-[#40404a]/30 space-y-3">
                            {/* Detailed stats */}
                            <div className="grid grid-cols-2 gap-3">
                              <div>
                                <p className="text-xs text-[#ADADB8] mb-1">Before Restart</p>
                                <div className="bg-[#1a1a1e]/50 rounded p-2">
                                  <p className="text-sm font-mono text-white">
                                    {event.playerCountBefore} players
                                  </p>
                                </div>
                              </div>
                              <div>
                                <p className="text-xs text-[#ADADB8] mb-1">After Restart</p>
                                <div className="bg-[#1a1a1e]/50 rounded p-2">
                                  <p className="text-sm font-mono text-white">
                                    {event.playerCountAfter} players
                                  </p>
                                </div>
                              </div>
                            </div>

                            {/* Timestamp details */}
                            <div>
                              <p className="text-xs text-[#ADADB8] mb-1">Exact Timestamp (UTC)</p>
                              <div className="bg-[#1a1a1e]/50 rounded p-2">
                                <p className="text-xs font-mono text-white break-all">
                                  {event.timestamp}
                                </p>
                              </div>
                            </div>

                            {/* Analysis */}
                            <div className="bg-[#26262c]/50 rounded p-3 border border-[#40404a]/30">
                              <p className="text-xs text-[#ADADB8] mb-2 font-semibold">Analysis</p>
                              <ul className="text-xs text-[#ADADB8] space-y-1">
                                <li>
                                  • Server went offline with{' '}
                                  <span className="text-white font-semibold">
                                    {event.playerCountBefore}
                                  </span>{' '}
                                  players connected
                                </li>
                                <li>
                                  • Restart took{' '}
                                  <span className="text-white font-semibold">{event.downtime}</span>{' '}
                                  minutes to complete
                                </li>
                                <li>
                                  • Server recovered with{' '}
                                  <span className="text-white font-semibold">
                                    {event.playerCountAfter}
                                  </span>{' '}
                                  players
                                </li>
                                <li>
                                  • Player loss:{' '}
                                  <span className="text-red-400 font-semibold">
                                    {event.playerCountBefore - event.playerCountAfter}
                                  </span>{' '}
                                  players ({playerDropPercentage}%)
                                </li>
                              </ul>
                            </div>
                          </div>
                        )}
                      </div>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Summary stats */}
        {events.length > 0 && (
          <div className="mt-8 pt-6 border-t border-[#40404a]/30">
            <p className="text-xs text-[#ADADB8] mb-3 font-semibold">Summary Statistics</p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="bg-[#26262c]/50 rounded p-3">
                <p className="text-xs text-[#ADADB8] mb-1">Total Events</p>
                <p className="text-lg font-semibold text-white">{events.length}</p>
              </div>
              <div className="bg-[#26262c]/50 rounded p-3">
                <p className="text-xs text-[#ADADB8] mb-1">Avg Downtime</p>
                <p className="text-lg font-semibold text-white">
                  {Math.round(events.reduce((sum, e) => sum + e.downtime, 0) / events.length)}m
                </p>
              </div>
              <div className="bg-[#26262c]/50 rounded p-3">
                <p className="text-xs text-[#ADADB8] mb-1">Max Downtime</p>
                <p className="text-lg font-semibold text-white">
                  {Math.max(...events.map(e => e.downtime))}m
                </p>
              </div>
              <div className="bg-[#26262c]/50 rounded p-3">
                <p className="text-xs text-[#ADADB8] mb-1">Avg Player Loss</p>
                <p className="text-lg font-semibold text-red-400">
                  {Math.round(
                    events.reduce((sum, e) => sum + (e.playerCountBefore - e.playerCountAfter), 0) /
                      events.length
                  )}
                </p>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
