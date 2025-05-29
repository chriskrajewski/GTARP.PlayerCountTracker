"use client";

import { useEffect, useState } from 'react';

// Define feature gate names
export const FEATURE_GATES = {
  FEEDBACK_FORM: 'enable_feedback_form',
  CHANGELOG: 'enable_changelog',
  STREAM_VIEWER: 'enable_stream_viewer',
  CSV_EXPORT: 'enable_csv_export',
  MULTI_STREAM: 'enable_multi_stream',
};

// Type for Statsig window object
interface StatsigWindow extends Window {
  statsig?: {
    initialize: (options: { userID?: string }) => void;
    checkGate: (gateName: string) => boolean;
    updateUser: (options: { userID?: string, customIDs?: Record<string, string> }) => void;
    logEvent: (eventName: string, value?: string | number | object, metadata?: object) => void;
  };
}

declare global {
  interface Window {
    statsig?: {
      initialize: (options: { userID?: string }) => void;
      checkGate: (gateName: string) => boolean;
      updateUser: (options: { userID?: string, customIDs?: Record<string, string> }) => void;
      logEvent: (eventName: string, value?: string | number | object, metadata?: object) => void;
    };
  }
}

// Initialize Statsig with a user ID
export function initializeStatsig() {
  // Only run on client side
  if (typeof window === 'undefined') return;

  const statsigWindow = window as StatsigWindow;

  
  if (statsigWindow.statsig) {
    // Generate a user ID if none exists
    let userID = localStorage.getItem('statsig_user_id');
    if (!userID) {
      userID = `user_${Math.random().toString(36).substring(2, 15)}`;
      localStorage.setItem('statsig_user_id', userID);
    }

    // Initialize with user ID
    statsigWindow.statsig.initialize({
      userID,
    });
    
    // Verify initialization by checking a feature gate
    setTimeout(() => {
      if (statsigWindow.statsig) {
        for (const key in FEATURE_GATES) {
          const gateName = FEATURE_GATES[key as keyof typeof FEATURE_GATES];
          try {
            const isEnabled = statsigWindow.statsig.checkGate(gateName);
          } catch (err) {
          }
        }
      }
    }, 500);
  } else {
  }
}

// Hook to check if a feature is enabled
export function useFeatureGate(featureGate: string): boolean {
  const [isEnabled, setIsEnabled] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;


    
    // Initialize if not already done
    initializeStatsig();

    // Check the feature gate
    const checkGate = () => {
      if (window.statsig) {
        try {
          const enabled = window.statsig.checkGate(featureGate);
          setIsEnabled(enabled);
        } catch (err) {
          setIsEnabled(false);
        }
      } else {
      }
    };

    // Check initially
    checkGate();

    // Set up an interval to recheck (Statsig might update gates)
    const interval = setInterval(checkGate, 30000); // Check every 30 seconds

    return () => clearInterval(interval);
  }, [featureGate]);

  // OVERRIDE: Force all features to be enabled for debugging
  return true;
}

// Function to check if a feature is enabled (for non-React contexts)
export function checkFeatureEnabled(featureGate: string): boolean {
  if (typeof window === 'undefined') return false;
  
  // Debug log
  if (window.statsig) {
    try {
      const result = window.statsig?.checkGate(featureGate) ?? false;
      return result;
    } catch (err) {
      return false;
    }
  }
  
  
  // OVERRIDE: Return true for debugging
  return true;
}

// Log an event to Statsig
export function logEvent(eventName: string, value?: string | number | object, metadata?: object) {
  if (typeof window === 'undefined') return;
  
  window.statsig?.logEvent(eventName, value, metadata);
} 