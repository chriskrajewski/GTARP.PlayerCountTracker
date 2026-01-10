# Azure App Services Configuration – File Changes

This reference captures every file that was created, updated, or removed while migrating the project to run exclusively on Azure App Services.

## New/Existing Azure Assets

- `.github/workflows/azure-deploy.yml` – CI/CD workflow that builds the standalone Next.js bundle and pushes it directly to the configured App Service.
- `scripts/azure-startup.sh` – Startup script executed by Azure to boot the compiled server (`node server.js`) with additional logging and validation.
- `docs/AZURE_DEPLOYMENT.md` – End-to-end deployment runbook.
- `docs/AZURE_CONFIGURATION_SUMMARY.md` – Operational checklist and quick-reference guide.

## Key Modifications

| File | Purpose |
|------|---------|
| `next.config.mjs` | Builds with `output: 'standalone'`, keeps strict security headers, and no longer wraps the config with any BotID helper. |
| `package.json` / `package-lock.json` | Require Node.js 20+ and drop the unused analytics, BotID, and CLI packages that were tied to the previous hosting provider. |
| `app/layout.tsx` | Removes the conditional BotID provider and legacy preview checks while keeping analytics, PWA, and tracking providers intact. |
| `app/api/visitors/session/route.ts` | Session creation now assumes human visitors (server-side geolocation is still applied) since BotID headers are no longer emitted on Azure. |
| `app/api/admin/maintenance/route.ts` | Messaging updated to describe Azure + Supabase as the managed platform. |
| `README.md` | Development instructions simplified to `npm run dev`, and deployment guidance now points to the Azure workflow/runbook. |

## Files Removed

| File | Reason |
|------|--------|
| `components/botid-provider.tsx` | Client-side BotID challenges are no longer available, so the provider was removed entirely. |
| `lib/botid.ts` | Server helpers for BotID verification are obsolete without the client integration. |
| `middleware.ts` | Middleware that only logged BotID headers is unnecessary on Azure. |
| `lib/platform.ts` | The platform detection helpers existed solely to toggle legacy hosting behavior and have been removed. |

All remaining source files are now provider-agnostic and rely on Azure-native configuration plus Supabase for data storage.
