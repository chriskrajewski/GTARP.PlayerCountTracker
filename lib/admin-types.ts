// Admin Portal Type Definitions
export interface AdminRole {
  id: string;
  name: string;
  description?: string;
  permissions: string[];
  created_at?: string;
  updated_at?: string;
  created_by?: string;
}

export interface AdminPermissionObject {
  id?: string;
  name?: string;
  description?: string;
  resource?: string;
  actions?: string[];
}

export type AdminPermission = string | AdminPermissionObject

export interface AdminUser {
  id: string;
  username: string;
  email?: string;
  full_name?: string;
  role?: AdminRole;
  role_id?: string;
  role_name?: string;
  permissions?: AdminPermission[];
  created_at?: string;
  updated_at?: string;
  last_login?: string;
  is_active: boolean;
  login_attempts?: number;
  phone?: string;
  department?: string;
  profile_image?: string;
  two_factor_enabled?: boolean;
  created_by?: string;
  updated_by?: string;
}

export interface UserSession {
  id: string;
  user_id: string;
  ip_address: string;
  user_agent: string;
  created_at: string;
  expires_at?: string;
  is_active: boolean;
  last_activity?: string;
}

export interface SystemMetrics {
  total_servers: number;
  total_players_today: number;
  total_data_points: number;
  active_banners: number;
  system_uptime: string;
  database_size: string;
  api_requests_today: number;
  error_rate: number;
}

export interface ServerConfiguration {
  id: number;
  server_id: string;
  server_name: string;
  display_order: number;
  is_active: boolean;
  data_collection_enabled: boolean;
  api_endpoint?: string;
  color_scheme?: {
    primary: string;
    secondary: string;
    accent: string;
  };
  metadata: {
    description?: string;
    category?: string;
    tags: string[];
    owner?: string;
    contact_info?: string;
  };
  created_at: string;
  updated_at: string;
}

export interface DataCollectionStatus {
  server_id: string;
  server_name: string;
  last_collection: string;
  status: 'active' | 'inactive' | 'error';
  total_records: number;
  data_start_date: string;
  collection_frequency: string;
  errors: DataCollectionError[];
}

export interface DataCollectionError {
  id: string;
  server_id: string;
  error_type: string;
  error_message: string;
  timestamp: string;
  resolved: boolean;
}

export interface APIUsageMetrics {
  endpoint: string;
  method: string;
  total_requests: number;
  success_rate: number;
  average_response_time: number;
  errors_24h: number;
  last_accessed: string;
}

export interface SystemConfiguration {
  id: string;
  category: string;
  key: string;
  value: string;
  data_type: 'string' | 'number' | 'boolean' | 'json';
  description: string;
  is_sensitive: boolean;
  requires_restart: boolean;
  updated_by?: string;
  updated_at?: string;
  is_readonly?: boolean;
  created_at?: string;
  validation_rules?: Record<string, any>;
}

export interface AuditLog {
  id: string;
  user_id?: string;
  user_email?: string;
  action: string;
  resource_type: string;
  resource_id?: string;
  details?: Record<string, any> | string;
  ip_address?: string;
  user_agent?: string;
  timestamp?: string;
  created_at?: string;
  severity?: 'low' | 'medium' | 'high' | 'critical';
  location?: string;
}

export interface BackupRecord {
  id: string;
  backup_type: 'full' | 'incremental' | 'config';
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  file_path?: string;
  file_size?: number;
  created_by: string;
  created_at: string;
  completed_at?: string;
  error_message?: string;
}

export interface DatabaseHealth {
  table_name?: string;
  row_count?: number;
  size_bytes?: number;
  last_vacuum?: string;
  last_analyze?: string;
  index_health?: 'good' | 'warning' | 'critical';
  performance_score?: number;
  component?: string;
  status?: 'healthy' | 'warning' | 'critical';
  message?: string;
  response_time_ms?: number | null;
  details?: Record<string, any>;
}

export interface NotificationTemplate {
  id: string;
  name: string;
  description: string;
  template: {
    title: string;
    message: string;
    type: 'info' | 'warning' | 'success' | 'announcement' | 'urgent';
    priority: number;
    is_dismissible: boolean;
    action_text?: string;
    action_url?: string;
  };
  is_default: boolean;
  created_by: string;
  created_at: string;
}

export interface FeatureFlag {
  id: string;
  name: string;
  key: string;
  description: string;
  is_enabled: boolean;
  rollout_percentage: number;
  conditions: Record<string, any>;
  created_by: string;
  created_at: string;
  updated_at: string;
  environment?: string | null;
}

export interface AdminDashboardData {
  metrics: SystemMetrics;
  recent_activities: AuditLog[];
  system_health: {
    database: 'healthy' | 'warning' | 'critical';
    api: 'healthy' | 'warning' | 'critical';
    data_collection: 'healthy' | 'warning' | 'critical';
  };
  alerts: SystemAlert[];
}

export interface SystemAlert {
  id: string;
  type: 'error' | 'warning' | 'info';
  title: string;
  message: string;
  timestamp: string;
  resolved: boolean;
  severity: 'low' | 'medium' | 'high' | 'critical';
}

export interface StreamAnalytics {
  server_id: string;
  server_name: string;
  total_streamers: number;
  total_viewers: number;
  peak_viewers: number;
  average_viewers: number;
  top_streamers: {
    name: string;
    viewers: number;
    duration: string;
  }[];
  growth_metrics: {
    streamers_change: number;
    viewers_change: number;
    period: string;
  };
}

// Admin API Response Types
export interface AdminAPIResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
  timestamp: string;
}

export interface PaginatedResponse<T = any> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

// Admin Form Types
export interface ServerFormData {
  server_name: string;
  server_id: string;
  is_active: boolean;
  data_collection_enabled: boolean;
  display_order: number;
  api_endpoint?: string;
  description?: string;
  category?: string;
  tags: string[];
  owner?: string;
  contact_info?: string;
  color_primary?: string;
  color_secondary?: string;
  color_accent?: string;
}

export interface ConfigurationFormData {
  category: string;
  key: string;
  value: string;
  data_type: 'string' | 'number' | 'boolean' | 'json';
  description: string;
  is_sensitive: boolean;
  requires_restart: boolean;
}

// Admin Navigation Types
export interface AdminMenuItem {
  id: string;
  label: string;
  icon: string;
  href: string;
  permissions: string[];
  children?: AdminMenuItem[];
  badge?: string;
}

// Admin Permission Constants
export const ADMIN_PERMISSIONS = {
  // System Management
  SYSTEM_MANAGE: 'system:manage',
  SYSTEM_BACKUP: 'system:backup',
  SYSTEM_CONFIG: 'system:config',
  
  // Server Management
  SERVERS_VIEW: 'servers:view',
  SERVERS_CREATE: 'servers:create',
  SERVERS_UPDATE: 'servers:update',
  SERVERS_DELETE: 'servers:delete',
  
  // Data Management
  DATA_VIEW: 'data:view',
  DATA_EXPORT: 'data:export',
  DATA_DELETE: 'data:delete',
  DATA_IMPORT: 'data:import',
  
  // User Management
  USERS_VIEW: 'users:view',
  USERS_CREATE: 'users:create',
  USERS_UPDATE: 'users:update',
  USERS_DELETE: 'users:delete',
  
  // Banner Management
  BANNERS_VIEW: 'banners:view',
  BANNERS_CREATE: 'banners:create',
  BANNERS_UPDATE: 'banners:update',
  BANNERS_DELETE: 'banners:delete',
  
  // Analytics
  ANALYTICS_VIEW: 'analytics:view',
  ANALYTICS_EXPORT: 'analytics:export',
  
  // Audit & Security
  AUDIT_VIEW: 'audit:view',
  SECURITY_MANAGE: 'security:manage',
} as const;

export type AdminPermissionType = typeof ADMIN_PERMISSIONS[keyof typeof ADMIN_PERMISSIONS];

// Additional missing types for admin pages
export interface DatabaseStatus {
  size_bytes: number;
  active_connections: number;
  version: string;
  status: string;
}

export interface DatabaseTable {
  name: string;
  row_count?: number;
  size_bytes?: number;
  last_vacuum?: string;
}

export interface DatabaseBackup {
  id: string;
  name: string;
  status: 'completed' | 'in_progress' | 'failed';
  size_bytes?: number;
  backup_type: string;
  download_url?: string;
  created_at: string;
}

export interface MaintenanceTask {
  id: string;
  name: string;
  description: string;
  status: string;
  last_run?: string;
}

export interface SystemHealth {
  overall_status: 'healthy' | 'warning' | 'critical';
  database_status: 'healthy' | 'warning' | 'critical';
  api_status: 'healthy' | 'warning' | 'critical';
  uptime: string;
}

export interface SecurityEvent {
  id: string;
  event_type: string;
  description: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  source_ip: string;
  location?: string;
  created_at: string;
}
