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

export default function Home() {
  const [serversData, setServersData] = useState<any[]>([]);
  const [selectedServersData, setSelectedServersData] = useState<string[]>([]);

  // Listen for the dashboard data loaded event
  useEffect(() => {
    const handleDashboardDataLoaded = (event: any) => {
      if (event.detail) {
        setServersData(event.detail.servers || []);
        setSelectedServersData(event.detail.selectedServers || []);
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
    >
      <div>
        <Suspense fallback={<DashboardSkeleton />}>
          <Dashboard />
        </Suspense>
      </div>
    </CommonLayout>
  )
}
