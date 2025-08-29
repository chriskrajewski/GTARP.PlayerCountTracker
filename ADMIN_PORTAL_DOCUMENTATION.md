# GTA RP Player Count Tracker - Admin Portal Documentation

## Overview

The Admin Portal is a comprehensive administrative interface for managing all aspects of the GTA RP Player Count Tracker application. It provides secure access to system management, server configuration, data analytics, user management, and system monitoring capabilities.

## Architecture

### Frontend Architecture
- **Framework**: Next.js 15 with App Router
- **UI Components**: shadcn/ui component library
- **Styling**: Tailwind CSS with custom design system
- **Type Safety**: TypeScript with strict mode
- **Authentication**: Token-based admin authentication
- **State Management**: React hooks (useState, useEffect)

### Backend Architecture
- **API Layer**: Next.js API routes with RESTful design
- **Database**: Supabase PostgreSQL
- **Authentication**: Server-side validation with JWT tokens
- **Validation**: Zod schemas for request validation
- **Error Handling**: Comprehensive error responses

## Core Features

### 1. Dashboard (`/admin`)
**Purpose**: Central hub providing system overview and quick access to key metrics

**Key Components**:
- System health monitoring
- Real-time metrics display
- Recent activity feed
- Quick action buttons
- Alert notifications

**Files**:
- `app/admin/page.tsx` - Main dashboard component
- `app/api/admin/dashboard/route.ts` - Dashboard API endpoint
- `components/admin/system-health-card.tsx` - Health monitoring widget

### 2. Server Management (`/admin/servers`)
**Purpose**: Complete CRUD operations for server configurations

**Features**:
- Server listing with search and filtering
- Create new server configurations
- Edit existing server settings
- Toggle server active/inactive status
- Delete server configurations
- Drag-and-drop reordering

**Files**:
- `app/admin/servers/page.tsx` - Server management interface
- `app/api/admin/servers/route.ts` - Server CRUD operations
- `app/api/admin/servers/[serverId]/route.ts` - Individual server operations
- `app/api/admin/servers/[serverId]/status/route.ts` - Status toggle endpoint

**Data Fields**:
- Server ID, Name, Description
- API endpoints and authentication
- Display settings (colors, ordering)
- Data collection configuration
- Contact information and metadata

### 3. Data Management (`/admin/data`)
**Purpose**: Monitor and manage data collection processes

**Features**:
- Data collection status monitoring
- Manual data collection triggers
- Data export (CSV/JSON formats)
- Data import capabilities
- Bulk data deletion with date ranges
- Analytics and reporting

**Files**:
- `app/admin/data/page.tsx` - Data management interface
- Data collection status monitoring
- Export/import functionality

**Supported Data Types**:
- Player count statistics
- Stream data and metrics
- Viewer analytics

### 4. Security & Audit (`/admin/security`)
**Purpose**: Security monitoring and audit trail management

**Features**:
- Audit log viewer with advanced filtering
- Security event monitoring
- Failed login attempt tracking
- System access reporting
- User activity analysis

**Files**:
- `app/admin/security/page.tsx` - Security dashboard
- Comprehensive audit logging
- Security event correlation

**Audit Log Fields**:
- User identification
- Action performed
- Resource affected
- Timestamp and IP address
- Request details and outcomes

### 5. User Management (`/admin/users`)
**Purpose**: Manage admin users, roles, and permissions

**Features**:
- User account creation and management
- Role-based permission system
- Active session monitoring
- Password reset capabilities
- Two-factor authentication support

**Files**:
- `app/admin/users/page.tsx` - User management interface
- Role and permission management
- Session monitoring

**User Roles**:
- Super Admin: Full system access
- Administrator: Most administrative functions
- Moderator: Limited administrative access
- Viewer: Read-only access

### 6. System Configuration (`/admin/system`)
**Purpose**: Manage system-wide settings and configurations

**Features**:
- Application settings management
- Feature flag controls
- System maintenance tools
- Backup and restore operations
- Performance tuning options

## API Architecture

### Authentication
All admin API endpoints require authentication via Bearer token:
```
Authorization: Bearer <admin_token>
```

### Request/Response Format
**Standard Response Structure**:
```typescript
{
  success: boolean;
  data?: any;
  error?: string;
  timestamp: string;
}
```

### Core API Endpoints

#### Dashboard API
- `GET /api/admin/dashboard` - Get dashboard data
- `GET /api/admin/metrics` - Get system metrics
- `GET /api/admin/health` - Get system health status

#### Server Management API
- `GET /api/admin/servers` - List servers (with pagination)
- `POST /api/admin/servers` - Create new server
- `GET /api/admin/servers/[id]` - Get server details
- `PUT /api/admin/servers/[id]` - Update server
- `DELETE /api/admin/servers/[id]` - Delete server
- `PUT /api/admin/servers/[id]/status` - Toggle server status

#### Data Management API
- `GET /api/admin/data/collection-status` - Get collection status
- `POST /api/admin/data/collect` - Trigger data collection
- `POST /api/admin/data/export` - Export data
- `POST /api/admin/data/import` - Import data
- `DELETE /api/admin/data/range` - Delete data range

#### Security & Audit API
- `GET /api/admin/audit/logs` - Get audit logs
- `GET /api/admin/security/events` - Get security events

#### User Management API
- `GET /api/admin/users` - List users
- `POST /api/admin/users` - Create user
- `PUT /api/admin/users/[id]` - Update user
- `DELETE /api/admin/users/[id]` - Delete user
- `POST /api/admin/users/[id]/reset-password` - Reset password

## Database Schema

### Key Tables
- `server_xref` - Server configurations
- `player_counts` - Player count statistics
- `twitch_streams` - Stream data
- `notification_banners` - System notifications
- `admin_users` - Admin user accounts
- `admin_roles` - Role definitions
- `audit_logs` - System audit trail
- `user_sessions` - Active sessions

## Type System

### Core Types (`lib/admin-types.ts`)
```typescript
interface AdminUser {
  id: string;
  email: string;
  username: string;
  full_name: string;
  role_id: string;
  role_name: string;
  is_active: boolean;
  permissions: string[];
  // ... additional fields
}

interface ServerConfiguration {
  id: string;
  server_id: string;
  server_name: string;
  is_active: boolean;
  api_endpoint?: string;
  // ... additional fields
}

interface SystemMetrics {
  total_servers: number;
  total_players_today: number;
  total_data_points: number;
  active_banners: number;
  system_uptime: string;
  database_size: string;
  api_requests_today: number;
  error_rate: number;
}
```

## Security Features

### Authentication & Authorization
- Token-based authentication system
- Role-based access control (RBAC)
- Session management and timeout
- IP address tracking
- Failed login attempt monitoring

### Data Protection
- Input validation with Zod schemas
- SQL injection prevention
- XSS protection
- CSRF protection
- Secure API design patterns

### Audit & Compliance
- Comprehensive audit logging
- User activity tracking
- Security event monitoring
- Data access logging
- Compliance reporting

## UI/UX Design System

### Color Palette
- Primary: `#9147ff` (Purple)
- Background: `#1a1a1e` (Dark)
- Cards: `#26262c` (Medium Dark)
- Borders: `#40404a` (Border Gray)
- Text: `#ffffff` (White), `#ADADB8` (Light Gray)

### Component Library
- Cards for content organization
- Tables for data display
- Forms for data input
- Modals for actions
- Badges for status indicators
- Progress bars for metrics

### Responsive Design
- Mobile-first approach
- Collapsible sidebar navigation
- Responsive grid layouts
- Touch-friendly interface elements

## Development Guidelines

### Code Standards
- TypeScript strict mode enabled
- ESLint and Prettier configured
- Component-based architecture
- Separation of concerns
- Error boundary implementation

### Testing Strategy
- Unit tests for utility functions
- Integration tests for API endpoints
- Component testing for UI elements
- End-to-end testing for user flows

### Performance Optimization
- Server-side rendering
- Code splitting
- Image optimization
- Lazy loading
- Caching strategies

## Deployment & Maintenance

### Environment Configuration
- Development environment setup
- Production deployment process
- Environment variable management
- Database migrations
- Backup procedures

### Monitoring & Alerting
- Application performance monitoring
- Error tracking and reporting
- System health checks
- User activity monitoring
- Automated alerting systems

## Usage Instructions

### Initial Setup
1. Ensure admin authentication is configured
2. Create initial admin user account
3. Configure server connections
4. Set up monitoring and alerts
5. Test all major functions

### Daily Operations
1. Monitor system health dashboard
2. Review audit logs and security events
3. Check data collection status
4. Monitor user activity and sessions
5. Handle any system alerts

### Maintenance Tasks
1. Regular backup procedures
2. Database optimization
3. User account reviews
4. Security updates
5. Performance monitoring

## Troubleshooting

### Common Issues
- Authentication failures: Check token validity
- API errors: Verify server connections
- Performance issues: Check database health
- Permission errors: Review user roles
- Data sync problems: Check collection status

### Error Codes
- 401: Authentication required
- 403: Insufficient permissions
- 404: Resource not found
- 422: Validation error
- 500: Internal server error

## Future Enhancements

### Planned Features
- Real-time notifications system
- Advanced analytics dashboard
- Automated backup scheduling
- Multi-factor authentication
- API rate limiting
- Advanced user permission granularity
- System health alerting
- Data visualization improvements

### Technical Improvements
- WebSocket integration for real-time updates
- Advanced caching mechanisms
- Database query optimization
- API response optimization
- Enhanced error handling
- Automated testing coverage

## Support & Documentation

### Additional Resources
- API Reference Documentation
- Component Storybook
- Development Setup Guide
- Deployment Instructions
- Security Best Practices

### Contact Information
For technical support or questions about the admin portal, please refer to the development team or create an issue in the project repository.

---

*This documentation covers the comprehensive admin portal implementation for the GTA RP Player Count Tracker application. The system provides enterprise-grade administrative capabilities with full security, audit, and management features.*