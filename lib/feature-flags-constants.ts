/**
 * Feature-flag constants and PURE helpers — server- AND client-safe.
 *
 * This module intentionally has NO `"use client"` directive and NO React/DOM
 * dependencies, so it can be imported from BOTH server components/route
 * handlers and client components and yield the REAL values.
 *
 * Why this exists: `lib/feature-flags.ts` is a `"use client"` module (it holds
 * the provider + hooks). When a Server Component imports a value from a client
 * module, Next.js/Turbopack returns a client-reference proxy rather than the
 * actual object — so `FEATURE_FLAGS.SOME_KEY` resolves to `undefined` on the
 * server. Server-side code must therefore import these constants from HERE.
 * `lib/feature-flags.ts` re-exports them for backward compatibility with
 * existing client imports.
 */

// ═══════════════════════════════════════════════════════════════════════════
// FLAG KEYS
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
  CHARACTER_TRACKING: 'character_tracking',
} as const;

export type FeatureFlagKey = typeof FEATURE_FLAGS[keyof typeof FEATURE_FLAGS];

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
 */
export const FAIL_CLOSED_FLAGS = new Set<string>([
  FEATURE_FLAGS.COMPARISON_VIEW,
  FEATURE_FLAGS.ALERTS,
  FEATURE_FLAGS.STREAMER_PAGES,
  FEATURE_FLAGS.INSIGHTS_WRAPPED,
  FEATURE_FLAGS.PREDICTION_ACCURACY,
  FEATURE_FLAGS.ANOMALY_PUBLIC,
  FEATURE_FLAGS.CAPACITY_ADVISOR,
  FEATURE_FLAGS.CHARACTER_TRACKING,
]);

/**
 * Returns true if the given flag key is one of the fail-closed
 * site-feature-enhancement flags.
 */
export function isFailClosedFlag(key: string): boolean {
  return FAIL_CLOSED_FLAGS.has(key);
}

/**
 * Pure fail-closed gating decision (R1.4).
 *
 * Returns `true` ONLY when the flag is explicitly `true` in the resolved flag
 * map. Any other condition — value `undefined`/missing, an errored fetch (which
 * leaves these keys absent from the map), or the provider still `loading` —
 * resolves to `false`. This is intentionally the opposite of the legacy
 * fail-open behavior.
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
