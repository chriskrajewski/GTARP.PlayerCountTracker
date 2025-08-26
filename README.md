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
- **Customizable notification banner system** for site-wide announcements
- Admin panel for banner management with real-time preview
- User dismissal tracking and analytics

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
   or with Vercel CLI:
   ```bash
   vercel dev
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

## Deployment with Vercel

This project is optimized for deployment on Vercel:

```bash
vercel
```

For production:

```bash
vercel --prod
```

## Notification Banner System

This application includes a comprehensive notification banner system for displaying important updates and announcements to users. 

### Quick Start
- Visit `/admin/banners` to access the admin panel
- Create, edit, and manage notification banners
- Support for different banner types (info, warning, success, announcement, urgent)
- Real-time preview and user dismissal tracking

### Documentation
- [📚 Complete Documentation](./docs/NOTIFICATION_BANNERS.md) - Comprehensive guide with API reference, component details, and deployment instructions
- [🚀 Quick Start Guide](./docs/NOTIFICATION_BANNERS_QUICKSTART.md) - Get started in 5 minutes with common examples

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
 
