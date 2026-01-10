# GTA RP Player and Viewer Count Tracker

A Next.js application for tracking and visualizing player counts and viewer statistics for GTA RP servers.

Check it out at https://fivemstats.krtech.io

## Features

- Real-time player count tracking for multiple GTA RP servers
- Viewer and streamer statistics
- Interactive charts with different time ranges
- Dark mode support
- Responsive design for all devices
- Changelog displaying recent updates
- **Multi-stream viewer** supporting Twitch and Kick streams simultaneously
- **Customizable notification banner system** for site-wide announcements
- Admin panel for banner management with real-time preview
- User dismissal tracking and analytics

## Monitoring

- Synthetic monitoring is configured with Checkly definitions under `__checks__`.
- HTTP checks cover the public changelog and notification banner APIs.
- Refresh latency API (`/api/status/refresh`) verifies all servers updated within the configured threshold.
- Browser checks exercise the homepage, changelog navigation, and multi-stream viewer.
- Set `PLAYER_TRACKER_BASE_URL` (defaults to `https://fivemstats.krtech.io`) when running `npx checkly test`.
- Optional `PLAYER_TRACKER_REFRESH_THRESHOLD_MINUTES` controls the staleness threshold (default 20).

## How to Build and Run

### Prerequisites

- Node.js 18+ and npm/pnpm
- Supabase account for database
- Twitch API credentials (for streamer data)
- GitHub token (optional, for changelog features)

### Setup

1. **Database Setup**:
   - Create your Supabase schema using the SQL in `api2db/sql/sqlSetup.sql`
   - Set up notification banner tables using `api2db/sql/notification_banners_schema.sql`
   - Configure Supabase Edge Functions to ingest data on a schedule using `api2db/edgeFunction`

2. **Environment Configuration**:
   - Copy `.env.example` to `.env.local` and fill in the required values:
     ```
     NEXT_PUBLIC_SUPABASE_URL=your-supabase-url
     NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
     SUPABASE_URL=your-supabase-url
     SUPABASE_ANON_KEY=your-service-role-key
     TWITCH_CLIENT=your-twitch-client-id
     TWITCH_CLIENT_SECRET=your-twitch-client-secret
     GITHUB_REPO_OWNER=your-github-username
     GITHUB_REPO_NAME=your-repo-name
     GITHUB_TOKEN=your-github-token
     ```

3. **Development**:
   ```bash
   npm install
   npm run dev
   ```

4. **Production Build**:
   ```bash
   npm run build
   npm start
   ```

## Security Considerations for Production

This application includes several security measures for production deployment:

1. **Content Security Policy**: Restricts resource loading to trusted sources
2. **Rate Limiting**: Prevents API abuse and brute force attacks
3. **Secure Headers**: Protection against XSS, clickjacking, and other common attacks
4. **Anonymized Data**: GitHub commit data is anonymized for changelog display
5. **Error Handling**: Safe error responses that don't leak sensitive information
6. **Input Validation**: All user inputs and API responses are validated

### Additional Deployment Recommendations

1. Set up proper monitoring and logging
2. Regularly update dependencies
3. Configure a Web Application Firewall (WAF)
4. Implement DDoS protection (Cloudflare or similar)
5. Use environment-specific configurations

## Deployment

This project is optimized for deployment on Azure App Services. Review the full walkthrough in `docs/AZURE_DEPLOYMENT.md`, or run the provided GitHub Actions workflow (`.github/workflows/azure-deploy.yml`) to deploy from the `main` branch.

## Multi-Stream Viewer

The multi-stream viewer allows you to watch multiple Twitch and Kick streams simultaneously in a customizable grid layout.

### URL Format

The multi-stream viewer supports two URL parameter formats:

**New format (recommended)** - `streams=` with platform prefixes:
```
/multi-stream?streams=twitch:shroud,kick:trainwreckstv,twitch:summit1g
```

**Legacy format** - `streamers=` (Twitch-only, backward compatible):
```
/multi-stream?streamers=shroud,summit1g,pokimane
```

### Features

- **Mixed platform support**: Watch Twitch and Kick streams together
- **Customizable layouts**: 11 preset layouts (Grid, Feature, Theater, Cascade, etc.)
- **Drag & resize**: Freely position and resize stream panels
- **Chat integration**: Twitch chat available for Twitch streams (Kick streams show "Open on Kick" links)
- **Manual input**: Enter stream names directly with support for:
  - Platform prefixes: `twitch:username`, `kick:slug`
  - URLs: `https://www.twitch.tv/username`, `https://kick.com/slug`
  - Bare usernames (defaults to Twitch for backward compatibility)
- **Kick embedding**: Best-effort iframe embedding with automatic fallback to "Open on Kick" button if embedding is blocked

### Usage Examples

1. **From server stream list**: Select multiple streams (Twitch + Kick) and click "Launch Multi-Stream"
2. **Manual entry**: Visit `/multi-stream` and use the manual input form
3. **Direct link**: Share links using the `streams=` format

### Kick Stream Behavior

- Kick streams attempt to embed via iframe to `https://kick.com/<slug>`
- If embedding fails or is blocked (X-Frame-Options/CSP), a fallback overlay appears after 5 seconds
- Fallback overlay includes an "Open on Kick" button to view the stream in a new tab
- Chat is only available for Twitch streams; Kick-only selections show a chat unavailable message with links to open Kick streams

## Admin Panel

The admin panel provides comprehensive management and monitoring capabilities for the application.

### Quick Start
- Visit `/admin/login` to access the admin panel
- Sign in with your Supabase admin credentials (email/password or OAuth)
- Access real-time visitor tracking, analytics, and management tools

### Authentication
The admin panel supports **dynamic OAuth authentication** with automatic provider detection:
- **Email/Password**: Traditional authentication method
- **OAuth Providers**: Automatically detects all enabled providers in Supabase (Discord, Google, GitHub, etc.)
- **Zero Code Changes**: Add new providers in Supabase, they appear instantly on the login page
- **Secure**: Admin-only access with database verification

See [Dynamic OAuth Authentication](./docs/DYNAMIC_OAUTH_AUTH.md) for complete details.

### Features
- **Real-time Visitor Tracking**: Live monitoring of active site visitors with human/bot classification
- **Visitor Analytics**: Detailed visitor statistics, hourly breakdowns, and export capabilities
- **System Analytics**: API performance metrics, endpoint monitoring, and health tracking
- **Notification Management**: Create and manage site-wide notification banners
- **Data Management**: Export data, trigger collection, and manage data retention
- **System Settings**: Configure tracking parameters and system behavior

### Documentation
- [🚀 Admin Setup Guide](./docs/ADMIN_SETUP.md) - Complete setup and configuration instructions
- [📋 Admin Quick Reference](./docs/ADMIN_QUICK_REFERENCE.md) - Quick reference for common tasks
- [📝 Admin Panel Rewrite](./docs/ADMIN_PANEL_REWRITE.md) - Technical details of the rewrite
- [🔐 Dynamic OAuth Authentication](./docs/DYNAMIC_OAUTH_AUTH.md) - OAuth provider system and configuration
- [⚙️ OAuth Configuration Guide](./docs/OAUTH_CONFIGURATION.md) - How to configure OAuth providers
- [🏗️ OAuth Architecture](./docs/OAUTH_ARCHITECTURE.md) - Technical architecture and data flows
- [🧪 OAuth Setup & Testing](./docs/OAUTH_SETUP_TESTING.md) - Setup guide and comprehensive testing procedures
- [📱 Mobile & PWA Guide](./docs/MOBILE_PWA_GUIDE.md) - Mobile and PWA setup and usage
- [🏛️ Mobile & PWA Architecture](./docs/MOBILE_PWA_ARCHITECTURE.md) - Technical architecture and diagrams
- [✅ Mobile & PWA Testing](./docs/MOBILE_PWA_TESTING.md) - Comprehensive testing checklist
- [📊 Implementation Summary](./docs/MOBILE_PWA_IMPLEMENTATION_SUMMARY.md) - Complete implementation summary

### Admin Routes
| Route | Purpose |
|-------|---------|
| `/admin/login` | Authentication |
| `/admin` | Main dashboard with live visitor tracking |
| `/admin/visitors` | Detailed visitor analytics |
| `/admin/notifications` | Notification banner management |
| `/admin/data` | Data collection and export |
| `/admin/analytics` | System and API performance metrics |
| `/admin/settings` | System configuration |

## Notification Banner System

This application includes a comprehensive notification banner system for displaying important updates and announcements to users. 

### Quick Start
- Visit `/admin/notifications` to access the notification management panel
- Create, edit, and manage notification banners
- Support for different banner types (info, warning, success, announcement, urgent)
- Real-time preview and user dismissal tracking

### Documentation
- [📚 Complete Documentation](./docs/NOTIFICATION_BANNERS.md) - Comprehensive guide with API reference, component details, and deployment instructions
- [🚀 Quick Start Guide](./docs/NOTIFICATION_BANNERS_QUICKSTART.md) - Get started in 5 minutes with common examples

## Mobile & PWA Support

The admin panel is fully optimized for mobile devices and PWA (Progressive Web App) functionality:

### Features
- ✅ **Responsive Design** - Optimized for all screen sizes (mobile, tablet, desktop)
- ✅ **Mobile Navigation** - Hamburger menu drawer on mobile devices
- ✅ **PWA Installation** - Install as standalone app on iOS, Android, and Desktop
- ✅ **Offline Support** - Service Worker caching for offline access
- ✅ **Fast Performance** - Intelligent caching strategies for optimal load times
- ✅ **Touch Optimized** - 44x44px minimum touch targets
- ✅ **Safe Area Support** - Proper handling of notched devices

### Installation
- **iOS**: Open in Safari → Share → Add to Home Screen
- **Android**: Open in Chrome → Menu → Install app
- **Desktop**: Click install icon in address bar

### Documentation
- [📱 Mobile & PWA Guide](./docs/MOBILE_PWA_GUIDE.md) - Setup and usage instructions
- [🏛️ Architecture](./docs/MOBILE_PWA_ARCHITECTURE.md) - Technical architecture and diagrams
- [✅ Testing Guide](./docs/MOBILE_PWA_TESTING.md) - Comprehensive testing checklist

### Features
- Multiple banner types with customizable styling
- Priority-based display ordering
- Scheduling support for future banners
- User dismissal tracking and analytics
- Responsive design matching site theme
- Admin interface with real-time preview
- RESTful API for programmatic management

## License

This project is licensed under the GPL-2.0 License - see the LICENSE file for details.
 
