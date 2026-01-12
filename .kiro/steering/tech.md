# Tech Stack

## Framework & Runtime

- Next.js 16+ with App Router (React 18)
- TypeScript (strict mode)
- Node.js 20+

## Database & Backend

- Supabase (PostgreSQL, Auth, Edge Functions)
- Separate browser/server Supabase clients in `lib/supabase-*.ts`
- Service role client for admin operations

## UI & Styling

- Tailwind CSS with `tailwindcss-animate`
- Radix UI primitives (via shadcn/ui pattern in `components/ui/`)
- Framer Motion (`motion/react`) for animations
- Dark theme enforced globally
- Custom cyber/neon aesthetic with cyan (#00D9FF) accent

## Key Libraries

- `@supabase/supabase-js` - Database client
- `recharts`, `lightweight-charts`, `apexcharts` - Charting
- `lucide-react` - Icons
- `zod` - Schema validation
- `date-fns` - Date utilities
- `ai` + `@ai-sdk/xai` - AI/Grok integration
- `hls.js` - Video streaming

## Build & Development

```bash
# Install dependencies
npm install

# Development server
npm run dev

# Production build
npm run build
npm start

# Linting
npm run lint

# Type checking
npm run check-types

# Full verification (lint + types + security audit)
npm run verify

# Pre-deployment check
npm run prepare-deploy
```

## Deployment Targets

- AWS Elastic Beanstalk (primary) - see `.ebextensions/`
- Azure App Services - see `docs/AZURE_DEPLOYMENT.md`
- Vercel compatible

## Monitoring

- Checkly synthetic monitoring (`__checks__/`)
- CloudWatch alarms for EB deployments
- Health endpoint: `/api/health`

## Environment Variables

Required (see `env.sample`):
- `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Browser client
- `SUPABASE_URL`, `SUPABASE_ANON_KEY` - Server client
- `SUPABASE_SERVICE_ROLE_KEY` - Admin operations
- `TWITCH_CLIENT`, `TWITCH_CLIENT_SECRET` - Twitch API
- `GITHUB_TOKEN` - Changelog features
- `NEXT_PUBLIC_GA_TRACKING_ID` - Google Analytics
