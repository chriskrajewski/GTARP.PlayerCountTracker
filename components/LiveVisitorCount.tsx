'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useLiveVisitorData, type LiveVisitorData } from '@/hooks/use-live-visitor-data';
import { useEffect, useState } from 'react';

/**
 * LiveVisitorCount Component
 * 
 * Displays real-time visitor count for admin dashboard
 * Source: PRD §4.1 FR-8; Blueprint §5.1
 * Implements: Admin-only live visitor monitoring
 */
export function LiveVisitorCount() {
  const { visitorData, loading, error, isConnected } = useLiveVisitorData({
    enabled: true,
    pollingInterval: 30000 // 30 seconds fallback
  });

  const [mounted, setMounted] = useState(false);

  // Prevent hydration mismatch
  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return null;
  }

  // Source: PRD §6.1 V-1 (User sees: Visitor count display)
  return (
    <Card className="w-full">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-lg">Live Visitors</CardTitle>
            <CardDescription>
              Real-time site visitor count
            </CardDescription>
          </div>
          {/* Connection status indicator */}
          {/* Source: PRD §6.1 V-1 (User sees: Connection status) */}
          <div className="flex items-center gap-2">
            <div
              className={`h-2 w-2 rounded-full ${
                isConnected ? 'bg-green-500' : 'bg-yellow-500'
              }`}
              title={isConnected ? 'Connected to live updates' : 'Using polling fallback'}
            />
            <span className="text-xs text-muted-foreground">
              {isConnected ? 'Live' : 'Polling'}
            </span>
          </div>
        </div>
      </CardHeader>

      <CardContent>
        {loading ? (
          // Loading state
          // Source: PRD §6.2 T-1 (Expected timing: < 100ms)
          <div className="space-y-4">
            <div className="h-12 bg-muted animate-pulse rounded" />
            <div className="grid grid-cols-2 gap-4">
              <div className="h-8 bg-muted animate-pulse rounded" />
              <div className="h-8 bg-muted animate-pulse rounded" />
            </div>
          </div>
        ) : error ? (
          // Error state
          // Source: PRD §6.2 T-7 (Failure feedback)
          <div className="text-sm text-destructive">
            <p className="font-semibold">Unable to load visitor data</p>
            <p className="text-xs mt-1">{error.message}</p>
          </div>
        ) : (
          // Success state
          // Source: PRD §6.1 V-1 (User sees: Exact visitor count)
          <div className="space-y-4">
            {/* Total count - large display */}
            <div className="flex items-baseline gap-2">
              <span className="text-4xl font-bold">
                {visitorData.total.toLocaleString()}
              </span>
              <span className="text-sm text-muted-foreground">
                active visitors
              </span>
            </div>

            {/* Human and bot breakdown */}
            {/* Source: PRD §4.1 FR-2 (Separate human/bot counts) */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">Humans</p>
                <div className="flex items-center gap-2">
                  <span className="text-2xl font-semibold">
                    {visitorData.humans.toLocaleString()}
                  </span>
                  <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                    Real
                  </Badge>
                </div>
              </div>

              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">Bots</p>
                <div className="flex items-center gap-2">
                  <span className="text-2xl font-semibold">
                    {visitorData.bots.toLocaleString()}
                  </span>
                  <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">
                    Automated
                  </Badge>
                </div>
              </div>
            </div>

            {/* Last updated timestamp */}
            {/* Source: PRD §6.1 V-1 (User sees: Last update time) */}
            <div className="pt-2 border-t">
              <p className="text-xs text-muted-foreground">
                Last updated: {new Date(visitorData.lastUpdated).toLocaleTimeString()}
              </p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/**
 * Skeleton loader for LiveVisitorCount
 * Used during initial page load
 */
export function LiveVisitorCountSkeleton() {
  return (
    <Card className="w-full">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-lg">Live Visitors</CardTitle>
            <CardDescription>
              Real-time site visitor count
            </CardDescription>
          </div>
          <div className="h-2 w-2 rounded-full bg-muted animate-pulse" />
        </div>
      </CardHeader>

      <CardContent>
        <div className="space-y-4">
          <div className="h-12 bg-muted animate-pulse rounded" />
          <div className="grid grid-cols-2 gap-4">
            <div className="h-8 bg-muted animate-pulse rounded" />
            <div className="h-8 bg-muted animate-pulse rounded" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
