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
  FAVORITES: 'favorites',
  // Server card features
  SERVER_CARD_STREAMS: 'server_card_streams',
  SERVER_CARD_CHANGES: 'server_card_changes',
  SERVER_CARD_RESTART: 'server_card_restart',
  SERVER_CARD_CAPACITY: 'server_card_capacity',
  SERVER_CARD_CLIPS: 'server_card_clips',
  // Tracking
  VISITOR_TRACKING: 'visitor_tracking',
  // Site feature enhancements (fail-closed gated — see FAIL_CLOSED_FLAGS)
  COMPARISON_VIEW: 'comparison_view',
  ALERTS: 'alerts',
  STREAMER_PAGES: 'streamer_pages',
  INSIGHTS_WRAPPED: 'insights_wrapped',
  PREDICTION_ACCURACY: 'prediction_accuracy',
  ANOMALY_PUBLIC: 'anomaly_public',
  CAPACITY_ADVISOR: 'capacity_advisor',
} as const;

// ═══════════════════════════════════════════════════════════════════════════
// FAIL-CLOSED FLAGS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * The seven site-feature-enhancement flags that MUST fail closed (R1.4).
 *
 * Unlike the legacy flags — for which the provider intentionally fails *open*
 * (defaulting to enabled while loading or on fetch error to avoid breaking the
 * existing site) — these flags are treated as DISABLED whenever their value is
 * `undefined`, missing, errored, or still loading. A surface gated by one of
 * these keys is only shown when the flag is explicitly `true`.
 *
 * Use {@link useFailClosedFeatureFlag} (React) or {@link isGatedFeatureEnabled}
 * (pure) to gate these surfaces — do NOT use the legacy `useFeatureFlag` hook,
 * which fails open while loading.
 */
export const FAIL_CLOSED_FLAGS = new Set<string>([
  FEATURE_FLAGS.COMPARISON_VIEW,
  FEATURE_FLAGS.ALERTS,
  FEATURE_FLAGS.STREAMER_PAGES,
  FEATURE_FLAGS.INSIGHTS_WRAPPED,
  FEATURE_FLAGS.PREDICTION_ACCURACY,
  FEATURE_FLAGS.ANOMALY_PUBLIC,
  FEATURE_FLAGS.CAPACITY_ADVISOR,
]);

/**
 * Returns true if the given flag key is one of the fail-closed
 * site-feature-enhancement flags.
 */
export function isFailClosedFlag(key: string): boolean {
  return FAIL_CLOSED_FLAGS.has(key);
}

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
        [FEATURE_FLAGS.FAVORITES]: true,
        [FEATURE_FLAGS.SERVER_CARD_STREAMS]: true,
        [FEATURE_FLAGS.SERVER_CARD_CHANGES]: true,
        [FEATURE_FLAGS.SERVER_CARD_RESTART]: true,
        [FEATURE_FLAGS.SERVER_CARD_CAPACITY]: true,
        [FEATURE_FLAGS.SERVER_CARD_CLIPS]: true,
        [FEATURE_FLAGS.VISITOR_TRACKING]: true,
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
// FAIL-CLOSED GATING HELPERS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Pure fail-closed gating decision (R1.4).
 *
 * Returns `true` ONLY when the flag is explicitly `true` in the resolved flag
 * map. Any other condition — value `undefined`/missing, an errored fetch (which
 * leaves these keys absent from the map), or the provider still `loading` —
 * resolves to `false`. This is intentionally the opposite of the legacy
 * `useFeatureFlag`/provider behavior, which fails open while loading and on
 * error.
 *
 * @param flags   the resolved flag map (e.g. the provider's `flags`)
 * @param key     the flag key to evaluate
 * @param loading whether the flag map is still loading (defaults to false)
 */
export function isGatedFeatureEnabled(
  flags: Record<string, boolean>,
  key: string,
  loading: boolean = false
): boolean {
  if (loading) {
    return false;
  }
  return flags[key] === true;
}

/**
 * React hook for fail-closed feature gating of the seven site-feature-
 * enhancement flags (R1.4).
 *
 * Use this for App_User-facing surfaces gated by a {@link FAIL_CLOSED_FLAGS}
 * key. It returns `false` while loading, on fetch error, or when the flag value
 * is `undefined`/missing — the surface is shown only when the flag is
 * explicitly enabled. Unlike {@link useFeatureFlag}, it never fails open.
 *
 * Must be used within a {@link FeatureFlagProvider}.
 */
export function useFailClosedFeatureFlag(key: string): boolean {
  const context = useContext(FeatureFlagContext);

  if (context === undefined) {
    throw new Error('useFailClosedFeatureFlag must be used within a FeatureFlagProvider');
  }

  return isGatedFeatureEnabled(context.flags, key, context.loading);
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
