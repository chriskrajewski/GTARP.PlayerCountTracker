---
name: Supabase to Prisma RDS Migration
overview: Migrate the GTA RP Player Count Tracker from Supabase (database + auth) to AWS RDS PostgreSQL with Prisma ORM and NextAuth.js for authentication. This is a significant architectural change affecting 112+ files across the codebase.
todos:
  - id: setup-rds
    content: Provision AWS RDS PostgreSQL db.t3.small instance with security groups and backups
    status: pending
  - id: setup-prisma
    content: Install Prisma, create schema.prisma with all 20+ models from existing SQL schemas
    status: pending
  - id: setup-nextauth
    content: Install and configure NextAuth.js with Discord OAuth and Credentials providers
    status: pending
  - id: migrate-auth-lib
    content: Rewrite lib/admin-auth-supabase.ts and lib/user-auth-supabase.ts for NextAuth
    status: pending
  - id: migrate-data-lib
    content: Rewrite lib/data.ts (1183 lines) to use Prisma queries instead of Supabase
    status: pending
  - id: migrate-api-routes
    content: Update 30+ API routes in app/api/ to use Prisma client
    status: pending
  - id: migrate-components
    content: Update auth components (AdminAuthGuard, login forms, auth hooks)
    status: pending
  - id: migrate-python-scripts
    content: Update api2db/python scripts to use psycopg2 instead of supabase-py
    status: pending
  - id: data-migration
    content: Export Supabase data via pg_dump and import to AWS RDS
    status: pending
  - id: testing-validation
    content: Run integration tests, verify data integrity, performance benchmarking
    status: pending
---

# Supabase to Prisma/AWS RDS Migration Plan

## Current Architecture Analysis

The application currently uses Supabase for:

- **Database**: PostgreSQL with 20+ tables including `player_counts`, `server_xref`, `twitch_streams`, `visitor_sessions`, `admin_users`, `app_users`, `notification_banners`, `roadmap_items`, `feature_flags`, etc.
- **Authentication**: Supabase Auth with Discord OAuth for users and email/password for admins
- **Row Level Security (RLS)**: Policies for access control
- **Real-time**: Not heavily used (polling-based updates)
- **Edge Functions**: Data ingestion scripts in `api2db/`

**Files Affected**: 112+ files reference Supabase across `lib/`, `app/api/`, `components/`, `hooks/`, and `api2db/`

---

## Target Architecture

```mermaid
flowchart TB
    subgraph client [Client Layer]
        NextApp[Next.js App]
        AdminPanel[Admin Panel]
    end
    
    subgraph auth [Authentication]
        NextAuth[NextAuth.js]
        DiscordOAuth[Discord OAuth]
        CredentialsAuth[Credentials Provider]
    end
    
    subgraph data [Data Layer]
        PrismaClient[Prisma Client]
        PrismaSchema[Prisma Schema]
    end
    
    subgraph aws [AWS Infrastructure]
        RDS[(AWS RDS PostgreSQL)]
    end
    
    NextApp --> NextAuth
    AdminPanel --> NextAuth
    NextAuth --> DiscordOAuth
    NextAuth --> CredentialsAuth
    NextApp --> PrismaClient
    AdminPanel --> PrismaClient
    PrismaClient --> PrismaSchema
    PrismaSchema --> RDS
```

---

## Phase 1: Infrastructure Setup

### 1.1 AWS RDS PostgreSQL Setup

- Provision RDS `db.t3.small` instance in your preferred AWS region
- Configure security groups to allow connections from your application
- Set up parameter groups for PostgreSQL optimization
- Enable automated backups and encryption at rest

### 1.2 Prisma Setup

- Install Prisma dependencies: `prisma`, `@prisma/client`
- Create `prisma/schema.prisma` with all models derived from existing SQL schemas
- Configure connection pooling (consider PgBouncer or Prisma Accelerate for serverless)

**Key Models to Define** (from [lib/supabase.types.ts](lib/supabase.types.ts)):

- `PlayerCount`, `ServerCapacity`, `ServerXref`, `ServerResourceSnapshot`, `ServerResourceChange`
- `TwitchStream`, `KickStream`, `StreamerCount`, `ViewerCount`
- `NotificationBanner`, `NotificationBannerDismissal`
- `SystemSetting`, `FeatureFlag`
- `SiteUpdate`, `RoadmapItem`, `RoadmapVote`, `UpdateCategory`
- `VisitorSession`, `AdminUser`, `AppUser`, `UserFavorite`
- `ServerRestartPrediction`, `ServerRestartEvent`
- `ApiCacheConfig`, `ApiCacheData`

---

## Phase 2: Authentication Migration

### 2.1 NextAuth.js Setup

- Install: `next-auth`, `@auth/prisma-adapter`
- Create `app/api/auth/[...nextauth]/route.ts`
- Configure providers:
  - **Discord OAuth** for regular users (replacing Supabase Discord OAuth)
  - **Credentials Provider** for admin email/password login

### 2.2 Auth Files to Migrate

| Current File | Action |

|-------------|--------|

| [lib/supabase-browser.ts](lib/supabase-browser.ts) | Delete - replaced by NextAuth client |

| [lib/supabase-server.ts](lib/supabase-server.ts) | Delete - replaced by Prisma |

| [lib/supabase-service-role.ts](lib/supabase-service-role.ts) | Delete - replaced by Prisma |

| [lib/admin-auth-supabase.ts](lib/admin-auth-supabase.ts) | Rewrite for NextAuth |

| [lib/user-auth-supabase.ts](lib/user-auth-supabase.ts) | Rewrite for NextAuth |

| [lib/admin-auth-supabase-enhanced.ts](lib/admin-auth-supabase-enhanced.ts) | Rewrite for NextAuth |

| [components/admin-login-supabase.tsx](components/admin-login-supabase.tsx) | Rewrite for NextAuth |

| [app/auth/callback/page.tsx](app/auth/callback/page.tsx) | Update for NextAuth callback |

| [app/admin/auth/callback/page.tsx](app/admin/auth/callback/page.tsx) | Update for NextAuth callback |

### 2.3 Session Management

- Replace Supabase session checks with NextAuth `getServerSession()` / `useSession()`
- Update `AdminAuthGuard` component to use NextAuth
- Update `use-auth-guard.ts` hook

---

## Phase 3: Database Access Layer Migration

### 3.1 Create Prisma Client Singleton

```typescript
// lib/prisma.ts
import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient }

export const prisma = globalForPrisma.prisma || new PrismaClient()

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma
```

### 3.2 Data Access Files to Migrate

| Current File | Changes Required |

|-------------|------------------|

| [lib/data.ts](lib/data.ts) | Major rewrite - 1183 lines, all Supabase queries to Prisma |

| [lib/api-cache.ts](lib/api-cache.ts) | Rewrite cache operations with Prisma |

| [lib/system-settings.ts](lib/system-settings.ts) | Rewrite settings queries |

| [lib/app-users.ts](lib/app-users.ts) | Rewrite user operations |

| [lib/feature-flags.ts](lib/feature-flags.ts) | Rewrite feature flag queries |

### 3.3 API Routes to Migrate (30+ routes)

High-priority routes in `app/api/`:

- `admin/servers/route.ts`, `admin/servers/[serverId]/route.ts`
- `admin/features/route.ts`, `admin/features/[id]/route.ts`
- `favorites/save/route.ts`, `favorites/list/route.ts`, `favorites/remove/route.ts`
- `visitors/*` routes (session, heartbeat, count, etc.)
- `notification-banners/route.ts`
- `roadmap/route.ts`, `roadmap/vote/route.ts`
- `site-updates/route.ts`, `changelog/route.ts`
- `live/fivem/route.ts`, `live/twitch/route.ts`, `live/kick/route.ts`
- `clips/[serverId]/route.ts`, `clips/all/route.ts`
- `streams/[serverId]/route.ts`
- `restart-prediction/route.ts`

---

## Phase 4: Database Migration

### 4.1 Schema Migration Strategy

1. Generate Prisma schema from existing Supabase database using `prisma db pull`
2. Review and refine the generated schema
3. Create initial migration: `prisma migrate dev --name init`

### 4.2 Data Migration

1. Export data from Supabase using `pg_dump` or Supabase dashboard
2. Import into AWS RDS using `pg_restore` or `psql`
3. Verify data integrity with row counts and spot checks

### 4.3 Stored Functions Migration

The following PL/pgSQL functions need to be recreated or converted to application logic:

- `detect_restart_events()` - Server restart detection
- `analyze_restart_pattern()` - Pattern analysis
- `calculate_server_restart_predictions()` - Prediction calculation
- `refresh_all_restart_predictions()` - Batch refresh
- `cleanup_old_visitor_sessions()` - Session cleanup
- `update_updated_at_column()` - Timestamp trigger

**Recommendation**: Keep these as PostgreSQL functions in RDS for performance, or convert to Prisma middleware/application logic if simpler.

---

## Phase 5: External Integrations

### 5.1 Python Ingestion Scripts

Update `api2db/python/` scripts:

- [api_ingest.py](api2db/python/api_ingest.py) - Replace `supabase-py` with `psycopg2` or `asyncpg`
- [twitch_stream_ingest.py](api2db/python/twitch_stream_ingest.py) - Same changes

### 5.2 Edge Functions (if still needed)

The TypeScript edge functions in `api2db/edgeFunction/` can be:

- Converted to Next.js API routes
- Deployed as AWS Lambda functions
- Run as scheduled tasks via AWS EventBridge

---

## Phase 6: Environment Variables Update

### Current Variables to Remove

```
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_URL
SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
```

### New Variables to Add

```
DATABASE_URL=postgresql://user:password@your-rds-endpoint:5432/dbname
DIRECT_URL=postgresql://user:password@your-rds-endpoint:5432/dbname
NEXTAUTH_URL=https://your-domain.com
NEXTAUTH_SECRET=your-generated-secret
DISCORD_CLIENT_ID=your-discord-client-id
DISCORD_CLIENT_SECRET=your-discord-client-secret
```

---

## Phase 7: Testing and Validation

### 7.1 Test Categories

- Unit tests for Prisma queries
- Integration tests for API routes
- Auth flow testing (Discord OAuth, admin login)
- Data integrity verification
- Performance benchmarking

### 7.2 Rollback Plan

- Keep Supabase instance running during migration
- Implement feature flag to switch between backends
- Maintain database sync during transition period

---

## Implementation Order

1. **Week 1**: Infrastructure setup (RDS, Prisma schema, NextAuth config)
2. **Week 2**: Auth migration (NextAuth providers, session management)
3. **Week 3**: Core data layer (`lib/data.ts`, `lib/prisma.ts`)
4. **Week 4**: API routes migration (prioritize by usage)
5. **Week 5**: Components and hooks updates
6. **Week 6**: Python scripts and edge functions
7. **Week 7**: Testing, data migration, and cutover

---

## Risk Mitigation

- **Data Loss**: Full backup before migration, parallel running during transition
- **Downtime**: Blue-green deployment strategy
- **Auth Issues**: Maintain session compatibility, gradual user migration
- **Performance**: Load testing before cutover, connection pooling setup

---

## Files Summary

**Delete** (7 files):

- `lib/supabase.ts`, `lib/supabase-browser.ts`, `lib/supabase-server.ts`
- `lib/supabase-service-role.ts`, `lib/supabase.types.ts`
- `lib/admin-auth-supabase.ts`, `lib/admin-auth-supabase-enhanced.ts`

**Create** (5+ files):

- `prisma/schema.prisma`
- `lib/prisma.ts`
- `app/api/auth/[...nextauth]/route.ts`
- `lib/auth.ts` (NextAuth config)
- `types/next-auth.d.ts` (type extensions)

**Major Rewrites** (10+ files):

- `lib/data.ts`, `lib/api-cache.ts`, `lib/user-auth-supabase.ts`
- `lib/app-users.ts`, `lib/feature-flags.ts`, `lib/system-settings.ts`
- `components/AdminAuthGuard.tsx`, `hooks/use-auth-guard.ts`
- `api2db/python/*.py`

**Updates Required** (90+ files):

- All API routes in `app/api/`
- Components using Supabase client
- Hooks with auth dependencies