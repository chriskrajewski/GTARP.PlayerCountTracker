/**
 * Smoke tests for the test harness foundation (task 1.1).
 *
 * Verifies that Jest runs TypeScript with the `@/*` alias, that `fast-check`
 * is available, and that the shared PBT helpers enforce the >= 100 run floor.
 */
import fc from 'fast-check'
import { MIN_NUM_RUNS, assertProperty, withMinRuns } from './pbt-helpers'
import { idArbitrary } from './arbitraries'
// Import via the @/* alias to confirm the moduleNameMapper is wired correctly.
import { detectRestartEvents } from '@/lib/restart-prediction'

describe('test harness foundation', () => {
  it('runs jest with the @/* path alias resolved', () => {
    expect(typeof detectRestartEvents).toBe('function')
  })

  it('has fast-check available', () => {
    expect(typeof fc.assert).toBe('function')
    expect(typeof fc.property).toBe('function')
  })

  it('enforces a minimum of at least 100 runs', () => {
    expect(MIN_NUM_RUNS).toBeGreaterThanOrEqual(100)
    expect(withMinRuns().numRuns).toBe(MIN_NUM_RUNS)
    // A smaller caller value is clamped up to the floor.
    expect(withMinRuns({ numRuns: 10 }).numRuns).toBe(MIN_NUM_RUNS)
    // A larger caller value is preserved.
    expect(withMinRuns({ numRuns: 250 }).numRuns).toBe(250)
  })

  it('runs a property through the shared helper', () => {
    assertProperty(
      fc.property(fc.integer(), (n) => n + 0 === n),
    )
  })

  it('exposes a working custom arbitrary', () => {
    assertProperty(
      fc.property(idArbitrary, (id) => id.length > 0 && id === id.trim()),
    )
  })
})
