/**
 * Custom `fast-check` arbitraries shared across property-based tests.
 *
 * Feature-specific arbitraries (player-count series, pinned-server selections,
 * alert subscriptions, multi-user stores, etc.) will be added here as the
 * corresponding feature tasks are implemented, so generators are written once
 * and reused across suites.
 *
 * This module is intentionally excluded from Jest's test matching (see
 * jest.config.mjs) because it exports helpers, not test suites.
 */
import fc from 'fast-check'

/**
 * A non-empty, trimmed identifier string suitable for server ids, usernames,
 * and similar keys. Kept generic for now; specialize per feature as needed.
 */
export const idArbitrary: fc.Arbitrary<string> = fc
  .string({ minLength: 1, maxLength: 24 })
  .map((s) => s.trim())
  .filter((s) => s.length > 0)
