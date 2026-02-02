# Implementation Plan: Supabase to Prisma/RDS Migration

## Overview

This implementation plan covers the migration from Supabase to AWS RDS PostgreSQL with Prisma ORM and NextAuth.js. Tasks are organized in phases to ensure incremental progress with validation at each step.

## Tasks

- [ ] 1. Project Setup and Prisma Configuration
  - [ ] 1.1 Install Prisma dependencies and initialize
    - Install `prisma`, `@prisma/client`, and dev dependencies
    - Run `npx prisma init` to create prisma directory
    - Configure `prisma/schema.prisma` with PostgreSQL provider
    - _Requirements: 1.1, 6.1_

  - [ ] 1.2 Create Prisma schema from existing Supabase types
    - Translate `lib/supabase.types.ts` to Prisma models
    - Add all models: PlayerCount, ServerCapacity, ServerXref, TwitchStream, NotificationBanner, etc.
    - Define proper field mappings with `@map` for snake_case columns
    - Add indexes for frequently queried fields (serverId + timestamp)
    - _Requirements: 1.1, 1.2, 1.3_

  - [ ] 1.3 Add NextAuth.js models to Prisma schema
    - Add User, Account, Session, VerificationToken models per NextAuth spec
    - Add relations between User and AppUser, AdminUser
    - Configure cascade delete behaviors
    - _Requirements: 3.1_

  - [ ] 1.4 Create Prisma client singleton
    - Create `lib/prisma.ts` with singleton pattern for connection reuse
    - Configure logging for development vs production
    - Add connection pooling configuration via DATABASE_URL params
    - _Requirements: 2.1, 2.5_

  - [ ]* 1.5 Write property test for schema relationship preservation
    - **Property 2: Schema Relationship Preservation**
    - Test that foreign key relationships are correctly defined
    - Verify cascade behaviors match expected RLS behavior
    - **Validates: Requirements 1.3**

- [ ] 2. Checkpoint - Verify Prisma setup
  - Ensure `npx prisma generate` succeeds
  - Ensure `npx prisma validate` passes
  - Ask the user if questions arise

- [ ] 3. NextAuth.js Authentication Setup
  - [ ] 3.1 Install NextAuth.js dependencies
    - Install `next-auth`, `@auth/prisma-adapter`
    - Install provider packages if needed
    - _Requirements: 3.1_

  - [ ] 3.2 Create NextAuth.js configuration
    - Create `lib/auth.ts` with authOptions
    - Configure PrismaAdapter with prisma client
    - Add DiscordProvider and TwitchProvider
    - Add CredentialsProvider for admin login
    - Configure JWT session strategy
    - _Requirements: 3.1, 3.2_

  - [ ] 3.3 Create NextAuth.js API route
    - Create `app/api/auth/[...nextauth]/route.ts`
    - Export GET and POST handlers
    - _Requirements: 3.1_

  - [ ] 3.4 Create auth session hooks and utilities
    - Create client-side `useSession` wrapper if needed
    - Create server-side `getServerSession` utilities
    - Update `lib/user-auth-supabase.ts` to use NextAuth
    - _Requirements: 3.5_

  - [ ] 3.5 Implement signIn callback for user record management
    - Create/update AppUser record on OAuth sign-in
    - Store provider-specific metadata (discordId, etc.)
    - Update lastLoginAt timestamp
    - _Requirements: 3.3_

  - [ ]* 3.6 Write property test for user record consistency
    - **Property 6: User Record Consistency**
    - Test that authentication creates user records
    - Test that re-authentication retrieves existing records
    - **Validates: Requirements 3.3**

- [ ] 4. Authorization Middleware
  - [ ] 4.1 Create authorization middleware module
    - Create `lib/auth-middleware.ts`
    - Implement `requireAuth()` function
    - Implement `requireAdmin()` function
    - Create `withAuth()` and `withAdmin()` wrapper functions
    - _Requirements: 7.1, 7.2, 7.3_

  - [ ] 4.2 Define authorization rules for existing RLS policies
    - Document current RLS policies from Supabase
    - Map each policy to application-level check
    - Implement checks in middleware
    - _Requirements: 7.1_

  - [ ]* 4.3 Write property test for authorization correctness
    - **Property 4: Authorization Correctness**
    - Test authorized users receive data
    - Test unauthorized users receive 403
    - Test admin access to admin resources
    - **Validates: Requirements 7.1, 7.2, 7.4**

- [ ] 5. Checkpoint - Verify auth setup
  - Test NextAuth sign-in flow manually
  - Verify session persistence
  - Ask the user if questions arise

- [ ] 6. Data Layer Migration
  - [ ] 6.1 Create Prisma-based data layer module
    - Create `lib/data-prisma.ts` as new data layer
    - Implement `getServers()` using Prisma
    - Implement `getServerName()` using Prisma
    - _Requirements: 2.3, 2.4_

  - [ ] 6.2 Migrate player count queries
    - Implement `getPlayerCounts()` with Prisma
    - Implement `getPlayerCountsWithTimeBasedSampling()` with Prisma
    - Implement `getPlayerCountsSmart()` with Prisma
    - Preserve time range filtering logic
    - _Requirements: 2.3, 2.4_

  - [ ] 6.3 Migrate server capacity queries
    - Implement `getServerCapacities()` with Prisma
    - Implement `getLatestServerCapacity()` with Prisma
    - Implement `calculateTimeAtMaxCapacity()` (pure function, no changes needed)
    - _Requirements: 2.3, 2.4_

  - [ ] 6.4 Migrate stream and viewer count queries
    - Implement `getStreamCounts()` with Prisma
    - Implement `getViewerCounts()` with Prisma
    - Implement stats calculation functions
    - _Requirements: 2.3, 2.4_

  - [ ] 6.5 Migrate resource change queries
    - Implement `getServerResourceChanges()` with Prisma
    - Implement `getServerResourceSnapshot()` with Prisma
    - Implement `getServerResourceChangesBulk()` with Prisma
    - Implement `getLatestServerResourceSnapshots()` with Prisma
    - _Requirements: 2.3, 2.4_

  - [ ] 6.6 Migrate utility queries
    - Implement `getDataStartTimes()` with Prisma
    - Implement `getLastRefreshTimes()` with Prisma
    - Implement `getServerColors()` with Prisma
    - _Requirements: 2.3, 2.4_

  - [ ]* 6.7 Write property test for behavioral equivalence
    - **Property 3: Behavioral Equivalence**
    - Generate random query parameters
    - Compare Prisma results with expected Supabase results
    - Test filters, ordering, pagination
    - **Validates: Requirements 2.4, 4.2, 5.2**

- [ ] 7. Checkpoint - Verify data layer
  - Run unit tests for data layer functions
  - Compare sample queries between Supabase and Prisma
  - Ask the user if questions arise

- [ ] 8. API Route Migration
  - [ ] 8.1 Update live data API routes
    - Update `app/api/live/fivem/route.ts` to use Prisma
    - Update `app/api/live/twitch/route.ts` to use Prisma
    - Update `app/api/live/kick/route.ts` to use Prisma
    - Update `app/api/live/queue/route.ts` to use Prisma
    - _Requirements: 4.1, 4.2_

  - [ ] 8.2 Update clips API routes
    - Update `app/api/clips/[serverId]/route.ts` to use Prisma
    - Update `app/api/clips/all/route.ts` to use Prisma
    - _Requirements: 4.1, 4.2_

  - [ ] 8.3 Update streams API routes
    - Update `app/api/streams/[serverId]/route.ts` to use Prisma
    - _Requirements: 4.1, 4.2_

  - [ ] 8.4 Update notification banner API routes
    - Update `app/api/notification-banners/route.ts` to use Prisma
    - Update `app/api/notification-banners/dismiss/route.ts` to use Prisma
    - Add authorization middleware for dismiss endpoint
    - _Requirements: 4.1, 4.2, 7.2_

  - [ ] 8.5 Update roadmap and site updates API routes
    - Update `app/api/roadmap/route.ts` to use Prisma
    - Update `app/api/roadmap/vote/route.ts` to use Prisma with auth
    - Update `app/api/site-updates/route.ts` to use Prisma
    - _Requirements: 4.1, 4.2_

  - [ ] 8.6 Update favorites API routes
    - Update `app/api/favorites/list/route.ts` to use Prisma with auth
    - Update `app/api/favorites/save/route.ts` to use Prisma with auth
    - Update `app/api/favorites/remove/route.ts` to use Prisma with auth
    - _Requirements: 4.1, 4.2, 7.2_

  - [ ] 8.7 Update feature flags API route
    - Update `app/api/feature-flags/route.ts` to use Prisma
    - _Requirements: 4.1, 4.2_

  - [ ] 8.8 Update restart prediction API route
    - Update `app/api/restart-prediction/route.ts` to use Prisma
    - _Requirements: 4.1, 4.2_

- [ ] 9. Admin API Routes Migration
  - [ ] 9.1 Update admin authentication
    - Update `app/api/admin/validate/route.ts` to use NextAuth
    - Update `lib/admin-auth-supabase.ts` to use NextAuth
    - _Requirements: 3.1, 4.1_

  - [ ] 9.2 Update admin data routes
    - Update `app/api/admin/analytics/route.ts` to use Prisma
    - Update `app/api/admin/dashboard/route.ts` to use Prisma
    - Add admin authorization middleware
    - _Requirements: 4.1, 7.5_

  - [ ] 9.3 Update admin feature management routes
    - Update `app/api/admin/features/route.ts` to use Prisma
    - Update `app/api/admin/features/[id]/route.ts` to use Prisma
    - _Requirements: 4.1, 7.5_

  - [ ] 9.4 Update admin server management routes
    - Update `app/api/admin/servers/route.ts` to use Prisma
    - Update related server management routes
    - _Requirements: 4.1, 7.5_

  - [ ] 9.5 Update admin settings routes
    - Update `app/api/admin/settings/route.ts` to use Prisma
    - _Requirements: 4.1, 7.5_

- [ ] 10. Checkpoint - Verify API routes
  - Run API integration tests
  - Verify response contracts match original
  - Ask the user if questions arise

- [ ] 11. Edge Function Replacement
  - [ ] 11.1 Convert FiveM player count ingestion
    - Create `app/api/ingest/fivem/route.ts` from `api2db/edgeFunction/GetFivemPlayerCount.ts`
    - Use Prisma for database operations
    - Maintain same data processing logic
    - _Requirements: 5.1, 5.2, 5.3_

  - [ ] 11.2 Convert Twitch stream data ingestion
    - Create `app/api/ingest/twitch/route.ts` from `api2db/edgeFunction/getTwitchStreamData.ts`
    - Use Prisma for database operations
    - _Requirements: 5.1, 5.2, 5.3_

  - [ ] 11.3 Convert clips data ingestion
    - Create `app/api/ingest/clips/route.ts` from `api2db/edgeFunction/getClipsData.ts`
    - Create `app/api/ingest/kick-clips/route.ts` from `api2db/edgeFunction/getKickClipsData.ts`
    - Use Prisma for database operations
    - _Requirements: 5.1, 5.2, 5.3_

  - [ ] 11.4 Convert clips validation
    - Create `app/api/ingest/validate-clips/route.ts` from `api2db/edgeFunction/validateClips.ts`
    - Use Prisma for database operations
    - _Requirements: 5.1, 5.2, 5.3_

  - [ ] 11.5 Document ingestion scheduling
    - Document how to trigger ingestion endpoints (cron, CloudWatch Events, etc.)
    - Update any existing scheduling configuration
    - _Requirements: 5.5_

- [ ] 12. Data Migration
  - [ ] 12.1 Create data migration script
    - Create `scripts/migrate-data.ts`
    - Implement batch migration for each table
    - Add progress logging and error handling
    - _Requirements: 1.4_

  - [ ] 12.2 Create user migration script
    - Create `scripts/migrate-users.ts`
    - Migrate Supabase Auth users to NextAuth User table
    - Migrate app_users and admin_users with new foreign keys
    - _Requirements: 3.4_

  - [ ] 12.3 Create migration verification script
    - Create `scripts/verify-migration.ts`
    - Compare row counts between Supabase and RDS
    - Sample and compare random records
    - _Requirements: 1.4, 8.1_

  - [ ]* 12.4 Write property test for data migration round trip
    - **Property 1: Data Migration Round Trip**
    - Test that migrated records match original records
    - Test across all table types
    - **Validates: Requirements 1.4, 3.4**

- [ ] 13. Checkpoint - Verify data migration
  - Run migration verification script
  - Manually spot-check critical data
  - Ask the user if questions arise

- [ ] 14. Environment Configuration
  - [ ] 14.1 Update environment variables
    - Add DATABASE_URL for RDS connection
    - Add NEXTAUTH_SECRET and NEXTAUTH_URL
    - Add DISCORD_CLIENT_ID and DISCORD_CLIENT_SECRET
    - Document in env.sample
    - _Requirements: 6.1, 6.4_

  - [ ] 14.2 Configure SSL for RDS connection
    - Add SSL parameters to DATABASE_URL
    - Test SSL connection
    - _Requirements: 6.5_

  - [ ] 14.3 Update deployment configurations
    - Update `.ebextensions/` for new environment variables
    - Update any CI/CD configurations
    - _Requirements: 6.1, 6.4_

  - [ ] 14.4 Document removed Supabase variables
    - List all removed SUPABASE_* variables
    - Update env.sample with comments
    - Update README if needed
    - _Requirements: 6.2_

- [ ] 15. Connection Pool Testing
  - [ ]* 15.1 Write property test for connection pool resilience
    - **Property 5: Connection Pool Resilience**
    - Test concurrent requests complete successfully
    - Test pool handles load without errors
    - **Validates: Requirements 4.4**

- [ ] 16. Client Component Updates
  - [ ] 16.1 Update auth-related components
    - Update `components/login-modal.tsx` to use NextAuth
    - Update `components/AdminAuthGuard.tsx` to use NextAuth
    - Update `app/auth/page.tsx` for NextAuth flow
    - _Requirements: 3.5_

  - [ ] 16.2 Update admin components
    - Update `components/admin-login-supabase.tsx` to use NextAuth
    - Update admin pages to use new auth hooks
    - _Requirements: 3.5_

- [ ] 17. Cleanup and Finalization
  - [ ] 17.1 Remove Supabase dependencies
    - Remove `@supabase/supabase-js` from package.json
    - Delete `lib/supabase*.ts` files
    - Delete `lib/supabase.types.ts`
    - _Requirements: 2.3_

  - [ ] 17.2 Update imports across codebase
    - Replace Supabase imports with Prisma imports
    - Update data layer imports to use new module
    - _Requirements: 2.3_

  - [ ] 17.3 Remove Edge Functions
    - Archive `api2db/edgeFunction/` directory
    - Update documentation
    - _Requirements: 5.1_

  - [ ] 17.4 Update steering files
    - Update `.kiro/steering/tech.md` with new stack
    - Update `.kiro/steering/structure.md` with new file locations
    - _Requirements: 6.2_

- [ ] 18. Final Checkpoint - Full verification
  - Run full test suite
  - Verify all API endpoints work
  - Verify authentication flows
  - Verify admin functionality
  - Ask the user if questions arise

## Notes

- Tasks marked with `*` are optional property-based tests that can be skipped for faster MVP
- Each checkpoint ensures incremental validation before proceeding
- Property tests validate universal correctness properties from the design document
- The migration can be paused and resumed at any checkpoint
- Keep Supabase running in parallel until final verification is complete

