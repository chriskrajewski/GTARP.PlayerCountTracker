# Project Structure

## Directory Layout

```
├── app/                    # Next.js App Router pages and API routes
│   ├── api/               # API route handlers
│   │   ├── admin/         # Admin-only endpoints (auth, config, data)
│   │   ├── clips/         # Twitch/Kick clip endpoints
│   │   ├── live/          # Real-time data (fivem, kick, twitch, queue)
│   │   ├── visitors/      # Visitor tracking endpoints
│   │   └── ...            # Other API routes
│   ├── admin/             # Admin panel pages
│   ├── auth/              # User authentication pages
│   ├── clips/             # Clips viewer pages
│   ├── streams/           # Stream viewer pages
│   ├── multi-stream/      # Multi-stream viewer
│   └── ...                # Other pages
├── components/            # React components
│   ├── ui/                # Base UI components (shadcn/ui pattern)
│   ├── admin/             # Admin-specific components
│   ├── multi-stream/      # Multi-stream viewer components
│   ├── site-updates/      # Site updates/roadmap components
│   └── ...                # Feature components
├── lib/                   # Shared utilities and services
│   ├── supabase*.ts       # Supabase client configurations
│   ├── data.ts            # Data fetching functions
│   ├── api-cache.ts       # API caching layer
│   ├── admin-*.ts         # Admin utilities
│   └── ...                # Other utilities
├── hooks/                 # Custom React hooks
├── api2db/                # Data ingestion scripts
│   ├── edgeFunction/      # Supabase Edge Functions
│   ├── sql/               # Database schema and migrations
│   └── python/            # Python ingestion scripts
├── __checks__/            # Checkly monitoring definitions
├── __tests__/             # Test files
├── scripts/               # Deployment and utility scripts
├── docs/                  # Documentation
├── public/                # Static assets (icons, manifest, sw.js)
└── styles/                # Global CSS
```

## Key Patterns

### API Routes
- Located in `app/api/[endpoint]/route.ts`
- Use `NextRequest`/`NextResponse` from `next/server`
- Server-side Supabase client via `createServerClient()`
- Return JSON with appropriate cache headers

### Components
- UI primitives in `components/ui/` follow shadcn/ui conventions
- Feature components use `"use client"` directive when needed
- Motion animations via `motion/react` and `@/lib/motion`

### Data Flow
- `lib/data.ts` - Main data fetching functions
- `hooks/use-live-*.ts` - Real-time data hooks with polling
- `lib/api-cache.ts` - Database-backed caching layer

### Supabase Clients
- `lib/supabase-browser.ts` - Client-side (uses `NEXT_PUBLIC_*` vars)
- `lib/supabase-server.ts` - Server-side (uses `SUPABASE_*` vars)
- `lib/supabase-service-role.ts` - Admin operations
- `lib/supabase.ts` - Auto-selects based on environment

### Path Aliases
- `@/*` maps to project root (configured in `tsconfig.json`)
- Example: `import { Button } from "@/components/ui/button"`
