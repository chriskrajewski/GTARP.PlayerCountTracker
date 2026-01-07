# Azure App Services Configuration – Summary

The project now targets Azure App Services as the only hosting platform. This document summarizes the moving parts so you can audit or extend the deployment quickly.

## Implementation Status

- ✅ Next.js builds in `output: 'standalone'` mode (see `next.config.mjs`)
- ✅ Node.js 20+ enforced through the `engines` field in `package.json`
- ✅ Azure deployment workflow (`.github/workflows/azure-deploy.yml`) builds, publishes, and restarts the App Service
- ✅ Startup script (`scripts/azure-startup.sh`) boots `server.js` and logs health information
- ✅ BotID, legacy analytics packages, and related middleware/provider files removed
- ✅ Documentation refreshed (`docs/AZURE_DEPLOYMENT.md`, `docs/AZURE_FILE_CHANGES.md`, this summary)

## Deployment Architecture

```
git push main
   ↓
GitHub Actions (azure-deploy.yml)
   ├─ Setup Node 20.x
   ├─ npm ci
   ├─ npm run lint (non-blocking)
   ├─ npm run check-types (non-blocking)
   ├─ npm run build  # produces .next/standalone + server.js
   └─ Deploy package to Azure App Services and restart site
        ↓
Azure App Service
   ├─ Uses Node 20 runtime
   ├─ Executes scripts/azure-startup.sh → node server.js
   └─ Loads environment variables configured in the portal
```

## Required Configuration

### GitHub Secrets (Actions → Secrets and variables → Actions)

| Secret | Purpose |
| ------ | ------- |
| `AZURE_WEBAPP_PUBLISH_PROFILE` | Publish profile XML exported from the App Service |
| `AZURE_WEBAPP_NAME` | App Service name used by the workflow |
| `AZURE_SUBSCRIPTION_ID` | Azure subscription identifier |
| `AZURE_RESOURCE_GROUP` | Resource group containing the App Service |
| Application secrets | `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_URL`, API keys, etc. (mirror `.env.sample`) |

### Azure Portal → App Service → Configuration

- Add every application secret from `.env.sample`
- Set `WEBSITE_NODE_DEFAULT_VERSION` to `~20`
- Enable “Always On”
- Startup command: `bash scripts/azure-startup.sh`

## Validation Checklist

- [ ] `npm run build` succeeds locally (standalone output verified)
- [ ] GitHub Action finishes successfully after pushing to `main`
- [ ] Azure deployment logs show the startup script running without errors
- [ ] `/` responds over HTTPS and `app/admin` authenticates via Supabase
- [ ] Visitor session creation (`/api/visitors/session`) stores country/city data again

## Next Steps

1. Monitor Application Insights / log stream for a few deployments to ensure warm starts look healthy.
2. Rotate the Azure publish profile and GitHub secrets on a regular cadence.
3. Extend the workflow with smoke tests if you need automated verification post-deploy.
