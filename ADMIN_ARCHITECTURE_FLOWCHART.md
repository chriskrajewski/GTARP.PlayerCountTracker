# Admin Portal Architecture Flow Chart

## System Overview Diagram

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                            GTA RP PLAYER COUNT TRACKER                          │
│                                 ADMIN PORTAL                                    │
└─────────────────────────────────────────────────────────────────────────────────┘

┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Admin User    │    │  Authentication │    │   Authorization │    │   Admin Panel   │
│                 │───▶│     System      │───▶│     & Roles     │───▶│   Dashboard     │
│ Email/Password  │    │   JWT Tokens    │    │ Role-Based Perms│    │  /admin         │
└─────────────────┘    └─────────────────┘    └─────────────────┘    └─────────────────┘
```

## Component Architecture Flow

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                            ADMIN PORTAL COMPONENTS                              │
└─────────────────────────────────────────────────────────────────────────────────┘

┌─────────────────┐
│   Admin Layout  │ ◄──────────────────┐
│  /components/   │                    │
│  admin/         │                    │
│  admin-layout   │                    │
└─────────┬───────┘                    │
          │                            │
          ▼                            │
┌─────────────────┐                    │
│  Admin Sidebar  │                    │
│  Navigation     │                    │
│  Menu System    │                    │
└─────────┬───────┘                    │
          │                            │
          ▼                            │
┌─────────────────────────────────────────────────┐
│              PAGE COMPONENTS                    │
├─────────────┬─────────────┬─────────────┬──────┤
│  Dashboard  │   Servers   │    Data     │Users │
│   /admin/   │ /admin/     │ /admin/     │/admin│
│             │ servers     │ data        │/users│
└─────────────┴─────────────┴─────────────┴──────┘
                    │
                    ▼
          ┌─────────────────┐
          │   API Routes    │
          │  /api/admin/*   │
          └─────────┬───────┘
                    │
                    ▼
          ┌─────────────────┐
          │   Database      │
          │   Supabase      │
          │   PostgreSQL    │
          └─────────────────┘
```

## Authentication Flow

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                            AUTHENTICATION FLOW                                 │
└─────────────────────────────────────────────────────────────────────────────────┘

┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   User Login    │    │   Credentials   │    │   Token Store   │
│   /admin/login  │───▶│   Validation    │───▶│   localStorage  │
│                 │    │                 │    │   + httpOnly    │
└─────────────────┘    └─────────────────┘    └─────────┬───────┘
                                                        │
                                                        ▼
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   API Request   │    │   Token Check   │    │  Route Access   │
│   Headers       │◄───│  Middleware     │◄───│   Authorization │
│   Authorization │    │  validateAdmin  │    │   Role Check    │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

## Data Flow Architecture

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                               DATA FLOW                                        │
└─────────────────────────────────────────────────────────────────────────────────┘

                    ┌─────────────────┐
                    │   Admin UI      │
                    │   React/Next    │
                    └─────────┬───────┘
                              │
                              ▼
                    ┌─────────────────┐
                    │   Admin API     │
                    │   lib/admin-api │
                    └─────────┬───────┘
                              │
                              ▼
                    ┌─────────────────┐
                    │  API Routes     │
                    │  /api/admin/*   │
                    └─────────┬───────┘
                              │
              ┌───────────────┼───────────────┐
              │               │               │
              ▼               ▼               ▼
    ┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐
    │   Database      │ │   Validation    │ │   Auth Check    │
    │   Queries       │ │   Zod Schemas   │ │   JWT Verify    │
    │   Supabase      │ │   Input/Output  │ │   Role Check    │
    └─────────────────┘ └─────────────────┘ └─────────────────┘
```

## Server Management Flow

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                         SERVER MANAGEMENT FLOW                                 │
└─────────────────────────────────────────────────────────────────────────────────┘

┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│  Server List    │    │   Create/Edit   │    │  API Endpoint   │
│  /admin/servers │───▶│    Dialog       │───▶│  POST/PUT       │
│                 │    │   Form Fields   │    │  /servers       │
└─────────────────┘    └─────────────────┘    └─────────┬───────┘
          │                                             │
          ▼                                             ▼
┌─────────────────┐                           ┌─────────────────┐
│  Server Actions │                           │   Database      │
│  Toggle Status  │──────────────────────────▶│   Updates       │
│  Delete Server  │                           │   server_xref   │
│  Reorder List   │                           │   Table         │
└─────────────────┘                           └─────────────────┘
```

## Data Management Flow

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                          DATA MANAGEMENT FLOW                                  │
└─────────────────────────────────────────────────────────────────────────────────┘

┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│Collection Status│    │  Export Data    │    │  Import Data    │
│  Monitor Jobs   │    │  CSV/JSON       │    │  File Upload    │
│  View Progress  │    │  Date Ranges    │    │  Validation     │
└─────────┬───────┘    └─────────┬───────┘    └─────────┬───────┘
          │                      │                      │
          ▼                      ▼                      ▼
┌─────────────────────────────────────────────────────────────┐
│                    DATA OPERATIONS                         │
├─────────────────┬─────────────────┬─────────────────┬──────┤
│  Trigger        │   Generate      │   Process       │Delete│
│  Collection     │   Export File   │   Import        │Range │
│  Manual/Auto    │   Background    │   Validate      │Bulk  │
└─────────────────┴─────────────────┴─────────────────┴──────┘
          │                      │                      │
          ▼                      ▼                      ▼
┌─────────────────────────────────────────────────────────────┐
│                     DATABASE TABLES                        │
├─────────────────┬─────────────────┬─────────────────┬──────┤
│  player_counts  │ twitch_streams  │ notification_   │audit │
│                 │                 │   banners       │logs  │
│  Real-time data │ Stream metrics  │ System notices  │Trail │
└─────────────────┴─────────────────┴─────────────────┴──────┘
```

## Security & Audit Flow

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                           SECURITY & AUDIT FLOW                                │
└─────────────────────────────────────────────────────────────────────────────────┘

┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   User Action   │    │   Audit Logger  │    │   Audit Store   │
│   Any Operation │───▶│   Middleware    │───▶│   Database      │
│   Create/Update │    │   Track Event   │    │   audit_logs    │
└─────────────────┘    └─────────────────┘    └─────────┬───────┘
                                                        │
                                                        ▼
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│Security Events  │    │   Log Viewer    │    │   Analytics     │
│Failed Logins    │───▶│   Filter/Search │───▶│   Reports       │
│Suspicious Access│    │   Time Ranges   │    │   Patterns      │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

## User Management Flow

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                          USER MANAGEMENT FLOW                                  │
└─────────────────────────────────────────────────────────────────────────────────┘

┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   User List     │    │  Create/Edit    │    │  Role & Perms   │
│   /admin/users  │───▶│   User Form     │───▶│   Assignment    │
│   Filter/Search │    │   Validation    │    │   RBAC System   │
└─────────────────┘    └─────────────────┘    └─────────┬───────┘
          │                                             │
          ▼                                             ▼
┌─────────────────┐                           ┌─────────────────┐
│  User Actions   │                           │   Database      │
│  Activate/      │──────────────────────────▶│   admin_users   │
│  Deactivate     │                           │   admin_roles   │
│  Reset Password │                           │   user_sessions │
│  Delete Account │                           │   Tables        │
└─────────────────┘                           └─────────────────┘
```

## API Route Structure

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                            API ROUTE STRUCTURE                                 │
└─────────────────────────────────────────────────────────────────────────────────┘

/api/admin/
├── dashboard/
│   └── route.ts                 # Dashboard metrics & health
├── servers/
│   ├── route.ts                 # List/Create servers
│   └── [serverId]/
│       ├── route.ts             # Get/Update/Delete server
│       └── status/
│           └── route.ts         # Toggle server status
├── data/
│   ├── collection-status/
│   │   └── route.ts             # Data collection status
│   ├── export/
│   │   └── route.ts             # Export data
│   ├── import/
│   │   └── route.ts             # Import data
│   └── range/
│       └── route.ts             # Delete data range
├── users/
│   ├── route.ts                 # List/Create users
│   └── [userId]/
│       ├── route.ts             # Get/Update/Delete user
│       └── reset-password/
│           └── route.ts         # Reset user password
├── security/
│   ├── audit-logs/
│   │   └── route.ts             # Audit trail
│   └── events/
│       └── route.ts             # Security events
└── validate/
    └── route.ts                 # Token validation
```

## Component Hierarchy

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                          COMPONENT HIERARCHY                                   │
└─────────────────────────────────────────────────────────────────────────────────┘

AdminLayout
├── AdminSidebar
│   ├── Navigation Items
│   ├── System Status
│   └── User Profile
└── Main Content
    ├── Dashboard Page
    │   ├── SystemHealthCard
    │   ├── MetricsCards
    │   ├── RecentActivity
    │   └── QuickActions
    ├── Servers Page
    │   ├── ServerList
    │   ├── CreateServerDialog
    │   ├── EditServerDialog
    │   └── ServerActions
    ├── Data Page
    │   ├── CollectionStatus
    │   ├── ExportDialog
    │   ├── ImportDialog
    │   └── DeleteRangeDialog
    ├── Users Page
    │   ├── UserList
    │   ├── CreateUserDialog
    │   ├── RoleManager
    │   └── SessionMonitor
    └── Security Page
        ├── AuditLogViewer
        ├── SecurityEvents
        ├── FilterControls
        └── ExportOptions
```

## Database Schema Relationships

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                        DATABASE SCHEMA RELATIONSHIPS                           │
└─────────────────────────────────────────────────────────────────────────────────┘

┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   admin_users   │    │  admin_roles    │    │  user_sessions  │
│                 │───▶│                 │◄───│                 │
│ - id            │    │ - id            │    │ - user_id (FK)  │
│ - email         │    │ - name          │    │ - ip_address    │
│ - role_id (FK)  │    │ - permissions   │    │ - expires_at    │
└─────────────────┘    └─────────────────┘    └─────────────────┘
          │
          ▼
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   audit_logs    │    │  server_xref    │    │  player_counts  │
│                 │    │                 │    │                 │
│ - user_id (FK)  │    │ - server_id     │◄───│ - server_id     │
│ - action        │    │ - server_name   │    │ - player_count  │
│ - resource      │    │ - is_active     │    │ - timestamp     │
│ - timestamp     │    │ - api_endpoint  │    │                 │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                                │
                                ▼
                       ┌─────────────────┐
                       │ twitch_streams  │
                       │                 │
                       │ - server_id     │
                       │ - stream_data   │
                       │ - viewer_count  │
                       │ - timestamp     │
                       └─────────────────┘
```

## Security Model

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                              SECURITY MODEL                                    │
└─────────────────────────────────────────────────────────────────────────────────┘

┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│  Authentication │    │  Authorization  │    │   Audit Trail   │
│                 │    │                 │    │                 │
│ JWT Tokens      │───▶│ Role-Based      │───▶│ Complete        │
│ Session Mgmt    │    │ Permissions     │    │ Activity Log    │
│ Token Refresh   │    │ Resource Access │    │ Security Events │
└─────────────────┘    └─────────────────┘    └─────────────────┘
          │                      │                      │
          ▼                      ▼                      ▼
┌─────────────────────────────────────────────────────────────┐
│                    SECURITY LAYERS                         │
├─────────────────┬─────────────────┬─────────────────┬──────┤
│  Input          │   Data          │   API           │Access│
│  Validation     │   Protection    │   Security      │Logs  │
│  Zod Schemas    │   SQL Injection │   Rate Limiting │Event │
│  Type Safety    │   XSS Prevention│   CORS Config   │Track │
└─────────────────┴─────────────────┴─────────────────┴──────┘
```

---

*This flowchart documentation provides a comprehensive visual representation of the admin portal architecture, data flows, and system relationships. Each component is designed to work together as part of a cohesive administrative system.*