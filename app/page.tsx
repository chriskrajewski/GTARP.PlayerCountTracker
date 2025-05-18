"use client";

import { Suspense, useEffect, useState } from "react"
import Dashboard from "@/components/dashboard"
import { DashboardSkeleton } from "@/components/dashboard-skeleton"
import "@/styles/globals.css"
import { CommonLayout } from "@/components/common-layout"

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
