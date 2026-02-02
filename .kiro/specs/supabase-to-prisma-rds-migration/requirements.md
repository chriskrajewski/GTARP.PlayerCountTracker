# Requirements Document

## Introduction

This document defines the requirements for migrating RPStats.com from Supabase (PostgreSQL, Auth, Edge Functions) to AWS RDS PostgreSQL with Prisma ORM. The migration aims to consolidate the database layer on AWS infrastructure while maintaining all existing functionality and improving type safety through Prisma's generated types.

## Glossary

- **Migration_System**: The tooling and processes that handle the database schema and data migration
- **Prisma_Client**: The auto-generated, type-safe database client that replaces Supabase client calls
- **RDS_Instance**: The AWS RDS PostgreSQL database that will replace Supabase's hosted PostgreSQL
- **Auth_System**: NextAuth.js with Prisma adapter, replacing Supabase Auth
- **Data_Layer**: The abstraction layer in `lib/` that handles all database operations
- **Edge_Functions**: Supabase serverless functions currently used for data ingestion

## Requirements

### Requirement 1: Database Schema Migration

**User Story:** As a developer, I want to migrate the existing Supabase PostgreSQL schema to AWS RDS PostgreSQL via Prisma, so that all tables, relationships, and constraints are preserved.

#### Acceptance Criteria

1. THE Migration_System SHALL generate a Prisma schema that accurately represents all existing Supabase tables
2. WHEN the Prisma schema is applied to RDS, THE Migration_System SHALL create all tables with matching column types, constraints, and indexes
3. THE Migration_System SHALL preserve all foreign key relationships between tables
4. THE Migration_System SHALL migrate all existing data from Supabase to RDS without data loss
5. IF a schema migration fails, THEN THE Migration_System SHALL rollback changes and report the specific failure

### Requirement 2: Prisma Client Integration

**User Story:** As a developer, I want to replace all Supabase client calls with Prisma client calls, so that database operations use the new ORM with full type safety.

#### Acceptance Criteria

1. THE Prisma_Client SHALL provide type-safe access to all database tables
2. WHEN a database query is executed, THE Prisma_Client SHALL return properly typed results matching the schema
3. THE Data_Layer SHALL replace all `supabase.from()` calls with equivalent Prisma queries
4. THE Data_Layer SHALL maintain the same query semantics (filters, ordering, pagination) as existing Supabase queries
5. WHEN Prisma queries are executed, THE Prisma_Client SHALL connect to the RDS_Instance using connection pooling

### Requirement 3: Authentication Migration to NextAuth.js

**User Story:** As a user, I want to continue using authentication features after migration, so that my login sessions and user data are preserved.

#### Acceptance Criteria

1. THE Auth_System SHALL use NextAuth.js with Prisma adapter for authentication
2. THE Auth_System SHALL support the same OAuth providers currently configured (Discord, Twitch)
3. WHEN a user authenticates, THE Auth_System SHALL create or retrieve user records from the RDS database via Prisma
4. THE Auth_System SHALL migrate existing user records from Supabase Auth to NextAuth.js user tables
5. THE Auth_System SHALL maintain session management compatible with Next.js App Router using NextAuth.js sessions
6. IF authentication fails, THEN THE Auth_System SHALL return appropriate error messages

### Requirement 4: API Route Migration

**User Story:** As a developer, I want all API routes to use Prisma instead of Supabase client, so that the application functions correctly with the new database.

#### Acceptance Criteria

1. WHEN an API route handles a request, THE Data_Layer SHALL use Prisma_Client for all database operations
2. THE API routes SHALL maintain the same request/response contracts after migration
3. THE API routes SHALL preserve existing caching behavior using the api-cache layer
4. WHEN multiple concurrent requests occur, THE Prisma_Client SHALL handle connection pooling efficiently
5. THE API routes SHALL maintain existing rate limiting and error handling behavior

### Requirement 5: Edge Function Replacement

**User Story:** As a developer, I want to replace Supabase Edge Functions with equivalent AWS-compatible solutions, so that data ingestion continues to work.

#### Acceptance Criteria

1. THE Migration_System SHALL identify all Supabase Edge Functions in `api2db/edgeFunction/`
2. WHEN data ingestion is triggered, THE replacement functions SHALL perform the same operations as existing Edge Functions
3. THE replacement functions SHALL connect to RDS_Instance using Prisma_Client
4. THE replacement functions SHALL be deployable as Next.js API routes or AWS Lambda functions
5. WHEN Edge Function replacement is complete, THE system SHALL maintain the same data ingestion schedule

### Requirement 6: Environment Configuration

**User Story:** As a developer, I want clear environment variable configuration for the new database setup, so that deployment across environments is straightforward.

#### Acceptance Criteria

1. THE Migration_System SHALL define new environment variables for RDS connection (DATABASE_URL, connection pool settings)
2. THE Migration_System SHALL document the removal of Supabase-specific environment variables
3. WHEN the application starts, THE Prisma_Client SHALL validate database connectivity
4. THE configuration SHALL support separate connection strings for development, staging, and production
5. THE configuration SHALL support SSL/TLS connections to RDS

### Requirement 7: Row-Level Security Replacement

**User Story:** As a developer, I want to implement application-level authorization to replace Supabase RLS policies, so that data access remains secure.

#### Acceptance Criteria

1. THE Data_Layer SHALL implement authorization checks equivalent to existing RLS policies
2. WHEN a user requests data, THE Data_Layer SHALL verify the user has permission before returning results
3. THE authorization logic SHALL be centralized and reusable across API routes
4. WHEN unauthorized access is attempted, THE Data_Layer SHALL return appropriate 403 responses
5. THE authorization system SHALL support admin-level access for administrative operations

### Requirement 8: Testing and Validation

**User Story:** As a developer, I want comprehensive tests to validate the migration, so that I can be confident the application works correctly after migration.

#### Acceptance Criteria

1. THE Migration_System SHALL include tests comparing query results between Supabase and Prisma implementations
2. WHEN tests are run, THE test suite SHALL validate all critical data operations
3. THE test suite SHALL verify authentication flows work correctly
4. THE test suite SHALL validate API response contracts remain unchanged
5. IF any test fails, THEN THE test suite SHALL provide clear failure messages indicating the discrepancy

