"use client";

import { createContext, useContext, useEffect, useState, ReactNode, createElement } from 'react';

// ═══════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════

export interface FeatureFlag {
  id: number;
  key: string;
  name: string;
  description: string | null;
  is_enabled: boolean;
  category: string;
  created_at: string;
  updated_at: string;
}

export type FeatureFlagKey = typeof FEATURE_FLAGS[keyof typeof FEATURE_FLAGS];

interface FeatureFlagContextValue {
  flags: Record<string, boolean>;
  loading: boolean;
  isEnabled: (key: string) => boolean;
  refresh: () => Promise<void>;
}

// ═══════════════════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════════════════

export const FEATURE_FLAGS = {
  // Site features
  FEEDBACK: 'feedback',
  CHANGELOG: 'changelog',
  SITE_UPDATES: 'site_updates',
  ROADMAP: 'roadmap',
  SERVER_CHANGES: 'server_changes',
  CSV_EXPORT: 'csv_export',
  MULTI_STREAM: 'multi_stream',
  GIT_COMMITS: 'git_commits',
  CLIPS_PAGE: 'clips_page',
  CLIPS_TIMELINE: 'clips_timeline',
  // Server card features
  SERVER_CARD_STREAMS: 'server_card_streams',
  SERVER_CARD_CHANGES: 'server_card_changes',
  SERVER_CARD_RESTART: 'server_card_restart',
  SERVER_CARD_CAPACITY: 'server_card_capacity',
  SERVER_CARD_CLIPS: 'server_card_clips',
} as const;

// ═══════════════════════════════════════════════════════════════════════════
// CONTEXT
// ═══════════════════════════════════════════════════════════════════════════

const FeatureFlagContext = createContext<FeatureFlagContextValue | undefined>(undefined);

// ═══════════════════════════════════════════════════════════════════════════
// PROVIDER
// ═══════════════════════════════════════════════════════════════════════════

interface FeatureFlagProviderProps {
  children: ReactNode;
}

export function FeatureFlagProvider({ children }: FeatureFlagProviderProps) {
  const [flags, setFlags] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);

  const fetchFlags = async () => {
    try {
      const response = await fetch('/api/feature-flags');
      if (!response.ok) {
        throw new Error('Failed to fetch feature flags');
      }
      const data = await response.json();
      
      // Convert array of flags to a key-value map
      const flagMap: Record<string, boolean> = {};
      if (data.success && Array.isArray(data.flags)) {
        data.flags.forEach((flag: FeatureFlag) => {
          flagMap[flag.key] = flag.is_enabled;
        });
      }
      
      setFlags(flagMap);
    } catch (error) {
      console.error('Error fetching feature flags:', error);
      // Default to all enabled on error to prevent breaking the site
      setFlags({
        [FEATURE_FLAGS.FEEDBACK]: true,
        [FEATURE_FLAGS.CHANGELOG]: true,
        [FEATURE_FLAGS.SITE_UPDATES]: true,
        [FEATURE_FLAGS.ROADMAP]: true,
        [FEATURE_FLAGS.SERVER_CHANGES]: true,
        [FEATURE_FLAGS.CSV_EXPORT]: true,
        [FEATURE_FLAGS.MULTI_STREAM]: true,
        [FEATURE_FLAGS.GIT_COMMITS]: true,
        [FEATURE_FLAGS.CLIPS_PAGE]: true,
        [FEATURE_FLAGS.CLIPS_TIMELINE]: true,
        [FEATURE_FLAGS.SERVER_CARD_STREAMS]: true,
        [FEATURE_FLAGS.SERVER_CARD_CHANGES]: true,
        [FEATURE_FLAGS.SERVER_CARD_RESTART]: true,
        [FEATURE_FLAGS.SERVER_CARD_CAPACITY]: true,
        [FEATURE_FLAGS.SERVER_CARD_CLIPS]: true,
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFlags();
    
    // Refresh flags every 30 seconds to pick up admin changes
    const interval = setInterval(fetchFlags, 30000);
    
    return () => clearInterval(interval);
  }, []);

  const isEnabled = (key: string): boolean => {
    // If still loading, default to true to prevent flashing
    if (loading) {
      return true;
    }
    // Return flag value, defaulting to false if not found
    return flags[key] ?? false;
  };

  const refresh = async () => {
    await fetchFlags();
  };

  const value: FeatureFlagContextValue = {
    flags,
    loading,
    isEnabled,
    refresh
  };

  return createElement(
    FeatureFlagContext.Provider,
    { value },
    children
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// HOOK
// ═══════════════════════════════════════════════════════════════════════════

export function useFeatureFlag(key?: string) {
  const context = useContext(FeatureFlagContext);
  
  if (context === undefined) {
    throw new Error('useFeatureFlag must be used within a FeatureFlagProvider');
  }

  // If a specific key is provided, return just that flag's status
  if (key) {
    return context.isEnabled(key);
  }

  // Otherwise return the full context
  return context;
}

// ═══════════════════════════════════════════════════════════════════════════
// UTILITY FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Check if a feature is enabled (for use outside of React components)
 * Note: This makes a synchronous check against cached flags
 */
export function checkFeatureEnabled(key: string): boolean {
  // This is a fallback for non-React contexts
  // In practice, always prefer using useFeatureFlag hook
  if (typeof window !== 'undefined' && (window as any).__featureFlags) {
    return (window as any).__featureFlags[key] ?? false;
  }
  return false;
}
