"use client";

import { Suspense, useEffect, useState } from "react"
import Dashboard from "@/components/dashboard"
import { DashboardSkeleton } from "@/components/dashboard-skeleton"
import "@/styles/globals.css"
import { CommonLayout } from "@/components/common-layout"
import mixpanel from "mixpanel-browser";

// Create an instance of the Mixpanel object, your token is already added to this snippet
      mixpanel.init('13440c630224bb2155944bc8de971af7', {
      autocapture: true,
      record_sessions_percent: 100,
    })

declare global {
  interface Window {
    dataLayer: any[] | undefined;
  }
}

interface LiveDataStatus {
  isStreaming: boolean;
  lastFetch: Date | null;
  loading: boolean;
  activeServerCount: number;
  pollingInterval: number;
}

export default function Home() {
  const [serversData, setServersData] = useState<any[]>([]);
  const [selectedServersData, setSelectedServersData] = useState<string[]>([]);
  const [timeRange, setTimeRange] = useState<string>("8h");
  const [liveDataStatus, setLiveDataStatus] = useState<LiveDataStatus>({
    isStreaming: false,
    lastFetch: null,
    loading: false,
    activeServerCount: 0,
    pollingInterval: 30000
  });

  // Listen for the dashboard data loaded event
  useEffect(() => {
    const handleDashboardDataLoaded = (event: any) => {
      if (event.detail) {
        setServersData(event.detail.servers || []);
        setSelectedServersData(event.detail.selectedServers || []);
        if (event.detail.timeRange) {
          setTimeRange(event.detail.timeRange);
        }
        if (event.detail.liveDataStatus) {
          setLiveDataStatus(event.detail.liveDataStatus);
        }
      }
    };

    window.addEventListener('dashboardDataLoaded', handleDashboardDataLoaded);
    
    return () => {
      window.removeEventListener('dashboardDataLoaded', handleDashboardDataLoaded);
    };
  }, []);

  return (
    <CommonLayout 
      servers={serversData}
      selectedServers={selectedServersData}
      timeRange={timeRange}
      liveDataStatus={liveDataStatus}
    >
      <div>
        <Suspense fallback={<DashboardSkeleton />}>
          <Dashboard />
        </Suspense>
      </div>
    </CommonLayout>
  )
}
