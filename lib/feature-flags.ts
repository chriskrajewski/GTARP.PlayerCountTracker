"use client";

import { createContext, useContext, useEffect, useState, ReactNode, createElement } from 'react';
import {
  FEATURE_FLAGS,
  FAIL_CLOSED_FLAGS,
  isFailClosedFlag,
  isGatedFeatureEnabled,
  type FeatureFlagKey,
} from './feature-flags-constants';

// Re-export the server/client-safe constants & pure helpers so existing
// imports from `@/lib/feature-flags` keep working. NOTE: server components and
// route handlers should import these from `@/lib/feature-flags-constants`
// directly — importing them from THIS client module yields client-reference
// proxies (resolving to `undefined`) on the server.
export {
  FEATURE_FLAGS,
  FAIL_CLOSED_FLAGS,
  isFailClosedFlag,
  isGatedFeatureEnabled,
};
export type { FeatureFlagKey };

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

interface FeatureFlagContextValue {
  flags: Record<string, boolean>;
  loading: boolean;
  isEnabled: (key: string) => boolean;
  refresh: () => Promise<void>;
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

/**
 * Fail-closed feature gating that also exposes the provider's `loading` state.
 *
 * Use this on full-page surfaces that REDIRECT when a feature is disabled
 * (e.g. `/compare`, `/alerts`). Those pages must NOT redirect while the flags
 * are still loading — otherwise the initial `enabled === false` (which is the
 * correct fail-closed default during load) would bounce the user away before
 * the real flag value arrives. Gate the redirect on `!loading`:
 *
 *   const { enabled, loading } = useFailClosedFeatureFlagState(key);
 *   useEffect(() => { if (!loading && !enabled) router.replace('/'); }, [...]);
 *
 * Components that simply render nothing while disabled can keep using
 * {@link useFailClosedFeatureFlag}.
 *
 * Must be used within a {@link FeatureFlagProvider}.
 */
export function useFailClosedFeatureFlagState(key: string): {
  enabled: boolean;
  loading: boolean;
} {
  const context = useContext(FeatureFlagContext);

  if (context === undefined) {
    throw new Error('useFailClosedFeatureFlagState must be used within a FeatureFlagProvider');
  }

  return {
    enabled: isGatedFeatureEnabled(context.flags, key, context.loading),
    loading: context.loading,
  };
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
