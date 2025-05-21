"use client";

import { ReactNode, useEffect } from 'react';
import { initializeStatsig } from '@/lib/statsig';

interface StatsigProviderProps {
  children: ReactNode;
}

export default function StatsigProvider({ children }: StatsigProviderProps) {
  useEffect(() => {
    // Initialize Statsig when the component mounts
    try {
      initializeStatsig();
    } catch (error) {
    }
    
    // Make sure Statsig feature gates are initialized properly
    const interval = setInterval(() => {
      if (window.statsig) {
        clearInterval(interval);
      } else {
        try {
          initializeStatsig();
        } catch (e) {
        }
      }
    }, 2000);

    return () => {
      clearInterval(interval);
    };
  }, []);

  return <>{children}</>;
} 