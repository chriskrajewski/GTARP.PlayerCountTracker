/**
 * Shared property-based-testing helpers built on top of `fast-check`.
 *
 * All property tests for this project should run a sufficient number of
 * iterations to be meaningful. This module centralizes that policy so every
 * suite gets a consistent `numRuns` floor (>= 100) without repeating config.
 *
 * Usage:
 *   import fc from 'fast-check'
 *   import { assertProperty } from './pbt-helpers'
 *
 *   assertProperty(
 *     fc.property(fc.integer(), (n) => n + 0 === n),
 *   )
 */
import fc from 'fast-check'

/**
 * Minimum number of runs every property test must perform. Property tests in
 * the design call for at least 100 iterations; keep this as the shared floor.
 */
export const MIN_NUM_RUNS = 100

/**
 * Run a synchronous fast-check property with the project-wide run-count floor
 * applied. Any caller-provided parameters are respected, except `numRuns`
 * which is clamped up to at least {@link MIN_NUM_RUNS}.
 */
export function assertProperty<Ts extends unknown[]>(
  property: fc.IProperty<Ts>,
  params?: fc.Parameters<Ts>,
): void {
  fc.assert(property, withMinRuns(params))
}

/**
 * Run an asynchronous fast-check property with the project-wide run-count
 * floor applied. Mirrors {@link assertProperty} for async predicates.
 */
export async function assertPropertyAsync<Ts extends unknown[]>(
  property: fc.IAsyncProperty<Ts>,
  params?: fc.Parameters<Ts>,
): Promise<void> {
  await fc.assert(property, withMinRuns(params))
}

/**
 * Merge caller parameters with the enforced run-count floor. Exposed for tests
 * or callers that need the resolved parameter object directly.
 */
export function withMinRuns<Ts extends unknown[]>(
  params?: fc.Parameters<Ts>,
): fc.Parameters<Ts> {
  const requested = params?.numRuns ?? 0
  return {
    ...params,
    numRuns: Math.max(MIN_NUM_RUNS, requested),
  }
}
