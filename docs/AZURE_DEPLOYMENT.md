# Azure App Services Deployment Guide

This document provides complete instructions for deploying the GTARP Player Count Tracker application to Azure App Services using GitHub Actions CI/CD.

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Initial Setup](#initial-setup)
3. [Environment Variables](#environment-variables)
4. [GitHub Secrets Configuration](#github-secrets-configuration)
5. [Azure Portal Configuration](#azure-portal-configuration)
6. [Deployment Process](#deployment-process)
7. [Verification & Testing](#verification--testing)
8. [Troubleshooting](#troubleshooting)
9. [Rollback Procedures](#rollback-procedures)

---

## Prerequisites

### Required Services
- **Azure Subscription** - Active Azure subscription with App Services enabled
- **GitHub Repository** - Repository with configured Actions access
- **Azure App Service Plan** - Minimum B1 (Basic) tier for production
- **Node.js Runtime** - Linux-based App Service with Node.js 20 LTS

### Required Skills
- Basic Git and GitHub knowledge
- Azure Portal navigation
- Environment variable management

---

## Initial Setup

### Step 1: Create Azure App Service

1. **Sign in to Azure Portal**
   - Navigate to [portal.azure.com](https://portal.azure.com)

2. **Create Resource**
   - Click "Create a resource"
   - Search for "App Service"
   - Click "Create"

3. **Configure App Service**
   - **Subscription**: Select your subscription
   - **Resource Group**: Create new or select existing
   - **Name**: `gtarp-player-tracker` (or your preferred name)
   - **Publish**: Code
   - **Runtime stack**: Node.js 20 LTS
   - **Operating System**: Linux
   - **Region**: Select your preferred region
   - **App Service Plan**: Select B1 (Basic) or higher
   - Click "Review + create"

4. **Complete Creation**
   - Review settings
   - Click "Create"
   - Wait for deployment to complete

### Step 2: Configure App Service Settings

1. **Navigate to your App Service**
   - Go to your newly created App Service in Azure Portal

2. **Access Configuration**
   - Left sidebar: Click "Configuration"
   - You'll add environment variables here in later steps

3. **Access Startup Command**
   - Left sidebar: Click "Configuration"
   - Scroll to "General settings"
   - Set **Startup Command** to: `node server.js`
   - Click "Save"

---

## Environment Variables

### Required Environment Variables

The following environment variables must be set in Azure Portal:

| Variable | Type | Description | Required |
|----------|------|-------------|----------|
| `NEXT_PUBLIC_SUPABASE_URL` | Public | Supabase project URL | ✅ Yes |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Public | Supabase anonymous key | ✅ Yes |
| `SUPABASE_URL` | Secret | Supabase project URL (server-side) | ✅ Yes |
| `SUPABASE_ANON_KEY` | Secret | Supabase service role key | ✅ Yes |
| `TWITCH_CLIENT_ID` | Secret | Twitch API client ID | ✅ Yes |
| `TWITCH_CLIENT_SECRET` | Secret | Twitch API client secret | ✅ Yes |
| `TWITCH_STREAM_PAGE_LIMIT` | Public | Stream pagination limit (default: 35) | ⚪ No |
| `GITHUB_REPO_OWNER` | Public | GitHub repository owner | ⚪ No |
| `GITHUB_REPO_NAME` | Public | GitHub repository name | ⚪ No |
| `GITHUB_TOKEN` | Secret | GitHub personal access token | ⚪ No |
| `GITHUB_ACCESS_TOKEN` | Secret | GitHub PAT for feedback issues | ⚪ No |
| `GITHUB_OWNER` | Public | GitHub account username | ⚪ No |
| `GITHUB_REPO` | Public | GitHub repository name | ⚪ No |
| `NODE_ENV` | Public | Should be `production` | ✅ Yes |
| `ADMIN_TOKEN` | Secret | Secure admin authentication token | ⚪ No |
| `GROK_API_KEY` | Secret | Grok AI API key | ⚪ No |
| `GROK_API_BASE_URL` | Public | Grok API endpoint | ⚪ No |
| `GROK_MODEL` | Public | Grok model name (default: grok-1) | ⚪ No |

### Azure App Service Specific Variables

These should be set automatically but verify:

| Variable | Value | Purpose |
|----------|-------|---------|
| `WEBSITE_NODE_DEFAULT_VERSION` | `~20` | Node.js version |
| `SCM_DO_BUILD_DURING_DEPLOYMENT` | `false` | Build already done in GitHub Actions |
| `NEXT_TELEMETRY_DISABLED` | `1` | Disable Next.js telemetry |

---

## GitHub Secrets Configuration

### Prerequisites
- Repository owner/admin access
- Azure credentials (see below)

### Step 1: Get Azure Publish Profile

1. **In Azure Portal**
   - Go to your App Service
   - Click "Get publish profile" (top toolbar)
   - Save the downloaded `.PublishSettings` file

2. **Extract Credentials**
   - Open the file in a text editor
   - Copy the entire contents
   - You'll paste this as a secret

### Step 2: Get Azure Service Principal Credentials

1. **Create Service Principal**
   ```bash
   az ad sp create-for-rbac --name gtarp-player-tracker-deploy \
     --role contributor \
     --scopes /subscriptions/{subscription-id}/resourceGroups/{resource-group-name}
   ```

2. **Copy the Output**
   - Note: `appId`, `password`, `tenant`
   - You'll need these for GitHub secrets

### Step 3: Add GitHub Secrets

1. **Navigate to Repository Settings**
   - Go to your GitHub repository
   - Click "Settings" (top navigation)
   - Click "Secrets and variables" > "Actions"

2. **Add Each Secret**
   - Click "New repository secret"
   - Add the following secrets:

   | Secret Name | Value |
   |-------------|-------|
   | `AZURE_WEBAPP_PUBLISH_PROFILE` | Contents of the `.PublishSettings` file |
   | `AZURE_WEBAPP_NAME` | Your App Service name (e.g., `gtarp-player-tracker`) |
   | `AZURE_SUBSCRIPTION_ID` | Azure Subscription ID |
   | `AZURE_RESOURCE_GROUP` | Resource group name |
   | `AZURE_ACCESS_TOKEN` | Service principal password/token |
   | `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anonymous key |

3. **Verify All Secrets Added**
   - You should see all secrets listed
   - They should show masked values

---

## Azure Portal Configuration

### Step 1: Set Environment Variables

1. **Navigate to Configuration**
   - Go to your App Service in Azure Portal
   - Left sidebar: Click "Configuration"

2. **Add Application Settings**
   - Click "New application setting"
   - For each required environment variable:
     - **Name**: Variable name (e.g., `NEXT_PUBLIC_SUPABASE_URL`)
     - **Value**: Variable value
     - Click "OK"
   - Click "Save" when done

3. **Add Secret Settings**
   - For sensitive variables (marked as "Secret" in the table above):
     - During creation, check the "Deployment slot setting" checkbox
     - Click "Save"
     - Add to slot-specific settings if using slots

### Step 2: Configure Startup Command

1. **Access General Settings**
   - In Configuration page, scroll to "General settings"
   - **Startup Command**: `node server.js`
   - Click "Save"

### Step 3: Enable Always On (Recommended)

1. **Go to App Service Plan**
   - Left sidebar: Click "Scale up (App Service plan)"
   - Ensure at least B1 (Basic) tier is selected
   - Scroll to "Always On"
   - Toggle "On"
   - Click "Apply"

### Step 4: Configure CORS (If Needed)

1. **CORS Settings** (if API is called from other domains)
   - Left sidebar: Click "CORS"
   - Add allowed origins:
     - `https://yourdomain.com` (production)
     - `http://localhost:3000` (development, if needed)
   - Click "Save"

---

## Deployment Process

### Automatic Deployment via GitHub Actions

The application automatically deploys when you push to the `main` branch:

1. **Push to Main Branch**
   ```bash
   git add .
   git commit -m "feat: your feature description"
   git push origin main
   ```

2. **GitHub Actions Workflow Runs**
   - Navigate to "Actions" tab in GitHub
   - Watch the "Deploy to Azure App Service" workflow
   - Stages:
     - Checkout code
     - Setup Node.js
     - Install dependencies
     - Run linting
     - Build application
     - Deploy to Azure
     - Restart service

3. **Monitor Deployment**
   - Green checkmark: Deployment successful
   - Red X: Deployment failed (check logs)

### Manual Deployment

If needed, manually trigger the workflow:

1. **Go to Actions**
   - GitHub repository > Actions tab
   - Click "Deploy to Azure App Service"
   - Click "Run workflow"
   - Select branch (usually `main`)
   - Click "Run workflow"

---

## Verification & Testing

### Step 1: Verify Deployment

1. **Check App Service Status**
   - Go to your App Service in Azure Portal
   - Check "Overview" for status (should be "Running")

2. **Test Application Health**
   ```bash
   curl https://your-app-name.azurewebsites.net/api/health
   ```
   - Expected response: `200 OK` with health status

### Step 2: Verify API Endpoints

1. **Test Status Endpoint**
   ```bash
   curl https://your-app-name.azurewebsites.net/api/status
   ```

2. **Test Public Endpoints**
   - Homepage: `https://your-app-name.azurewebsites.net/`
   - Changelog: `https://your-app-name.azurewebsites.net/changelog`
   - Multi-stream: `https://your-app-name.azurewebsites.net/multi-stream`

### Step 3: Check Application Logs

1. **In Azure Portal**
   - Go to your App Service
   - Left sidebar: Click "Log stream"
   - Watch real-time application logs

2. **Via Azure CLI**
   ```bash
   az webapp log tail --resource-group <group-name> --name <app-name>
   ```

### Step 4: Monitor Performance

1. **View Metrics**
   - Left sidebar: Click "Metrics"
   - Monitor:
     - CPU Percentage
     - Memory Percentage
     - HTTP Requests
     - Response Time

2. **Set Up Alerts** (Optional)
   - Click "New alert rule"
   - Configure threshold
   - Set notification email

---

## Troubleshooting

### Deployment Fails in GitHub Actions

**Error**: Workflow shows red X

**Solution**:
1. Check workflow logs:
   - Go to Actions > Deploy to Azure App Service > Last run
   - Click "Build and Deploy" job
   - Check error messages

2. Common issues:
   - **Auth failed**: Verify `AZURE_WEBAPP_PUBLISH_PROFILE` secret
   - **Build failed**: Check `npm run build` output
   - **Node modules**: Delete `.next/standalone/node_modules` and rebuild

### Application Won't Start

**Error**: App Service status shows "Stopped" or "Error"

**Solution**:
1. Check application logs:
   ```bash
   az webapp log tail --resource-group <group> --name <app-name>
   ```

2. Verify startup command:
   - Go to Configuration > General settings
   - Ensure `Startup Command` is set to `node server.js`

3. Verify environment variables:
   - All required secrets set in Configuration
   - No typos in variable names

4. Restart the app:
   - Overview > Click "Restart"

### Application Starts but Shows Errors

**Error**: 500 errors or blank page

**Solution**:
1. Check logs for detailed errors
2. Verify all required environment variables are set
3. Verify Supabase connectivity:
   ```bash
   curl https://your-supabase-url/rest/v1/
   ```

4. Check Next.js build output:
   - Look for TypeScript or module errors in logs

### High CPU/Memory Usage

**Error**: App Service plan limits exceeded

**Solution**:
1. Scale up App Service Plan:
   - Go to "Scale up (App Service plan)"
   - Select higher tier (S1, S2, etc.)
   - Click "Apply"

2. Check for memory leaks:
   - Review application logs
   - Check for infinite loops or large data structures

---

## Rollback Procedures

### Rollback to Previous Deployment

1. **Via Azure Deployment Center**
   - Left sidebar: Click "Deployment Center"
   - Click on previous successful deployment
   - Click "Redeploy"

2. **Via Git Revert**
   ```bash
   git log --oneline -10
   git revert <commit-hash>
   git push origin main
   ```

3. **Manual Deployment**
   - Keep previous `.next/standalone` backup
   - Deploy previous version via FTP or portal

---

## Database Migrations

If you need to run database migrations:

1. **Before Deployment**
   - Run migrations locally first:
   ```bash
   npm run migrate
   ```

2. **Post-Deployment**
   - Migrations can be triggered via API endpoint
   - Or run via Azure CLI:
   ```bash
   az webapp remote-debugging enable --resource-group <group> --name <app-name>
   ```

---

## Security Considerations

### Environment Variables

- ✅ **Do**: Use Azure Key Vault for production secrets
- ✅ **Do**: Rotate secrets regularly
- ✅ **Do**: Use least-privilege access tokens
- ❌ **Don't**: Commit secrets to Git
- ❌ **Don't**: Use test credentials in production

### Network Security

- ✅ **Do**: Configure CORS properly
- ✅ **Do**: Enable HTTPS only
- ✅ **Do**: Use managed identities instead of connection strings
- ✅ **Do**: Enable Azure DDoS Protection

### Monitoring

- ✅ **Do**: Enable Application Insights
- ✅ **Do**: Set up monitoring alerts
- ✅ **Do**: Review logs regularly
- ✅ **Do**: Monitor for unusual access patterns

---

## Support & Additional Resources

### Useful Links
- [Azure App Service Documentation](https://docs.microsoft.com/azure/app-service/)
- [Next.js Deployment Guide](https://nextjs.org/docs/deployment)
- [GitHub Actions Documentation](https://docs.github.com/en/actions)
- [Azure CLI Reference](https://docs.microsoft.com/cli/azure/)

### Getting Help
1. Check application logs in Azure Portal
2. Review GitHub Actions workflow logs
3. Consult Azure documentation
4. Contact Azure support for infrastructure issues

---

## Maintenance Tasks

### Weekly
- Monitor application metrics
- Check error logs
- Verify backups

### Monthly
- Review and update dependencies
- Check for security vulnerabilities
- Review cost usage

### Quarterly
- Review and update security policies
- Perform disaster recovery testing
- Update documentation

---

**Last Updated**: January 2025  
**Version**: 1.0  
**Author**: Development Team
