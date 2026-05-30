import nextJest from 'next/jest.js'

// next/jest wires up SWC-based transforms, next.config + .env loading,
// and CSS/asset mocks so tests run against the same toolchain as the app.
const createJestConfig = nextJest({
  // Path to the Next.js app to load next.config and .env files from.
  dir: './',
})

/** @type {import('jest').Config} */
const config = {
  // jsdom gives tests access to browser-like globals (window, document, fetch
  // shims) that several existing suites under __tests__ rely on.
  testEnvironment: 'jest-environment-jsdom',

  // Optional global setup (custom matchers, polyfills) lives here.
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],

  // Only treat files under __tests__ ending in .test.ts(x) as Jest suites.
  // This deliberately excludes the Playwright/Checkly specs in __checks__
  // (which use a `.spec.ts` suffix and the @playwright/test runner).
  testMatch: ['<rootDir>/__tests__/**/*.test.{ts,tsx}'],

  // Mirror the tsconfig `@/*` -> project root path alias so imports like
  // `@/lib/restart-prediction` resolve in tests exactly as in the app.
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1',
  },

  // Helper/arbitrary modules are shared utilities, not standalone suites.
  modulePathIgnorePatterns: [
    '<rootDir>/__tests__/arbitraries.ts',
    '<rootDir>/__tests__/pbt-helpers.ts',
  ],

  clearMocks: true,
}

// Exported as the awaited factory result because next/jest must load the
// (async) Next.js config before the test run starts.
export default createJestConfig(config)
