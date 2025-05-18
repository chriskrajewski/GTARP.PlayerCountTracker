"use client";

import { ReactNode, useEffect } from 'react';
import { initializeStatsig } from '@/lib/statsig';

interface StatsigProviderProps {
  children: ReactNode;
}

export default function StatsigProvider({ children }: StatsigProviderProps) {
  useEffect(() => {
    // Initialize Statsig when the component mounts
    console.log("StatsigProvider: Initializing...");
    try {
      initializeStatsig();
      console.log("StatsigProvider: Initialization completed successfully");
    } catch (error) {
      console.error("StatsigProvider: Initialization failed", error);
    }
    
    // Make sure Statsig feature gates are initialized properly
    const interval = setInterval(() => {
      if (window.statsig) {
        console.log("StatsigProvider: Statsig is available in window object");
        clearInterval(interval);
      } else {
        console.warn("StatsigProvider: Statsig not available yet, retrying...");
        try {
          initializeStatsig();
        } catch (e) {
          console.error("StatsigProvider: Retry initialization failed", e);
        }
      }
    }, 2000);

    return () => {
      clearInterval(interval);
    };
  }, []);

  return <>{children}</>;
} 