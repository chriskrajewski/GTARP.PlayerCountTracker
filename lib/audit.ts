/**
 * Audit Trail Module
 * 
 * Provides comprehensive audit logging for admin actions and security events.
 * Tracks who did what, when, and from where.
 * 
 * Features:
 * - Admin action logging
 * - Security event tracking
 * - Request metadata capture
 * - Structured audit entries
 * - In-memory buffer with async persistence
 * 
 * @module lib/audit
 */

import { NextRequest } from 'next/server';
import { logger, redactSensitiveData } from './logger';
import { getClientIP } from './rate-limiter';

/**
 * Audit action categories
 */
export type AuditCategory = 
  | 'auth'           // Authentication events
  | 'admin'          // Admin panel actions
  | 'data'           // Data modifications
  | 'config'         // Configuration changes
  | 'security'       // Security events
  | 'system'         // System events
  | 'api';           // API access

/**
 * Audit action types
 */
export type AuditAction =
  // Auth actions
  | 'login'
  | 'logout'
  | 'login_failed'
  | 'session_expired'
  | 'password_change'
  | 'token_refresh'
  
  // Admin actions
  | 'admin_access'
  | 'admin_action'
  | 'user_create'
  | 'user_update'
  | 'user_delete'
  | 'role_change'
  
  // Data actions
  | 'data_create'
  | 'data_read'
  | 'data_update'
  | 'data_delete'
  | 'data_export'
  | 'data_import'
  
  // Config actions
  | 'config_update'
  | 'feature_toggle'
  | 'banner_create'
  | 'banner_update'
  | 'banner_delete'
  | 'server_enable'
  | 'server_disable'
  
  // Security actions
  | 'rate_limit_exceeded'
  | 'unauthorized_access'
  | 'suspicious_activity'
  | 'cors_violation'
  | 'csp_violation'
  
  // System actions
  | 'system_start'
  | 'system_stop'
  | 'backup_create'
  | 'backup_restore'
  | 'maintenance_start'
  | 'maintenance_end'
  
  // API actions
  | 'api_call'
  | 'api_error';

/**
 * Audit severity levels
 */
export type AuditSeverity = 'low' | 'medium' | 'high' | 'critical';

/**
 * Audit entry interface
 */
export interface AuditEntry {
  /** Unique identifier for the audit entry */
  id: string;
  /** Timestamp of the event */
  timestamp: string;
  /** Category of the action */
  category: AuditCategory;
  /** Specific action performed */
  action: AuditAction;
  /** Severity level */
  severity: AuditSeverity;
  /** User who performed the action (if known) */
  userId?: string;
  /** User email or username */
  userIdentifier?: string;
  /** IP address of the request */
  ipAddress: string;
  /** User agent string */
  userAgent?: string;
  /** Request path */
  path?: string;
  /** HTTP method */
  method?: string;
  /** Resource affected */
  resource?: string;
  /** Resource ID if applicable */
  resourceId?: string;
  /** Description of the action */
  description: string;
  /** Additional metadata (redacted) */
  metadata?: Record<string, unknown>;
  /** Whether the action was successful */
  success: boolean;
  /** Error message if action failed */
  errorMessage?: string;
  /** Request ID for correlation */
  requestId?: string;
  /** Session ID if available */
  sessionId?: string;
  /** Geographic location (from IP) */
  geoLocation?: string;
}

/**
 * Audit configuration
 */
interface AuditConfig {
  /** Enable audit logging */
  enabled: boolean;
  /** Buffer size before flushing */
  bufferSize: number;
  /** Flush interval in milliseconds */
  flushInterval: number;
  /** Include request metadata */
  includeMetadata: boolean;
  /** Log to console */
  logToConsole: boolean;
}

/**
 * Default audit configuration
 */
const DEFAULT_CONFIG: AuditConfig = {
  enabled: true,
  bufferSize: 100,
  flushInterval: 30000, // 30 seconds
  includeMetadata: true,
  logToConsole: process.env.NODE_ENV === 'development',
};

/**
 * In-memory audit buffer
 */
let auditBuffer: AuditEntry[] = [];
let lastFlush = Date.now();

/**
 * Generate unique audit entry ID
 */
function generateAuditId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 10);
  return `audit_${timestamp}_${random}`;
}

/**
 * Determine severity based on action
 */
function getSeverityForAction(action: AuditAction, success: boolean): AuditSeverity {
  // Failed security actions are critical
  if (!success && ['login_failed', 'unauthorized_access', 'suspicious_activity'].includes(action)) {
    return 'critical';
  }
  
  // Security events
  if (['unauthorized_access', 'suspicious_activity', 'cors_violation', 'csp_violation'].includes(action)) {
    return 'high';
  }
  
  // Admin and config changes
  if (['user_delete', 'role_change', 'config_update', 'backup_restore'].includes(action)) {
    return 'high';
  }
  
  // Data modifications
  if (['data_delete', 'data_export', 'user_create', 'user_update'].includes(action)) {
    return 'medium';
  }
  
  // Standard actions
  return 'low';
}

/**
 * Extract request metadata for audit
 */
function extractRequestMetadata(request: NextRequest): Partial<AuditEntry> {
  return {
    ipAddress: getClientIP(request),
    userAgent: request.headers.get('user-agent') || undefined,
    path: request.nextUrl.pathname,
    method: request.method,
    requestId: request.headers.get('x-request-id') || undefined,
    sessionId: request.cookies.get('session')?.value || undefined,
  };
}

/**
 * Flush audit buffer to storage
 * In production, this would write to a database or external service
 */
async function flushAuditBuffer(): Promise<void> {
  if (auditBuffer.length === 0) {
    return;
  }
  
  const entries = [...auditBuffer];
  auditBuffer = [];
  lastFlush = Date.now();
  
  // Log to console in development
  if (DEFAULT_CONFIG.logToConsole) {
    entries.forEach(entry => {
      const level = entry.severity === 'critical' || entry.severity === 'high' ? 'warn' : 'info';
      logger[level](`[AUDIT] ${entry.action}`, {
        category: entry.category,
        severity: entry.severity,
        userId: entry.userId,
        resource: entry.resource,
        success: entry.success,
        description: entry.description,
      });
    });
  }
  
  // In production, persist to database
  // This is where you would add Supabase or other storage integration
  // Example:
  // await supabase.from('audit_log').insert(entries);
  
  // For now, we'll store in memory and log
  // The audit entries can be retrieved via getAuditLog()
}

/**
 * Check if buffer should be flushed
 */
function shouldFlush(): boolean {
  return (
    auditBuffer.length >= DEFAULT_CONFIG.bufferSize ||
    Date.now() - lastFlush >= DEFAULT_CONFIG.flushInterval
  );
}

/**
 * Create an audit entry
 * 
 * @param options - Audit entry options
 * @returns The created audit entry
 */
export async function createAuditEntry(options: {
  category: AuditCategory;
  action: AuditAction;
  description: string;
  request?: NextRequest;
  userId?: string;
  userIdentifier?: string;
  resource?: string;
  resourceId?: string;
  metadata?: Record<string, unknown>;
  success?: boolean;
  errorMessage?: string;
  severity?: AuditSeverity;
}): Promise<AuditEntry> {
  const {
    category,
    action,
    description,
    request,
    userId,
    userIdentifier,
    resource,
    resourceId,
    metadata,
    success = true,
    errorMessage,
    severity,
  } = options;
  
  // Build audit entry
  const entry: AuditEntry = {
    id: generateAuditId(),
    timestamp: new Date().toISOString(),
    category,
    action,
    severity: severity || getSeverityForAction(action, success),
    userId,
    userIdentifier,
    ipAddress: request ? getClientIP(request) : 'unknown',
    resource,
    resourceId,
    description,
    metadata: metadata ? (redactSensitiveData(metadata) as Record<string, unknown>) : undefined,
    success,
    errorMessage,
    ...(request ? extractRequestMetadata(request) : {}),
  };
  
  // Add to buffer
  auditBuffer.push(entry);
  
  // Check if we should flush
  if (shouldFlush()) {
    await flushAuditBuffer();
  }
  
  return entry;
}

/**
 * Audit helper for admin actions
 */
export async function auditAdminAction(
  request: NextRequest,
  action: AuditAction,
  description: string,
  options: {
    userId?: string;
    userIdentifier?: string;
    resource?: string;
    resourceId?: string;
    metadata?: Record<string, unknown>;
    success?: boolean;
    errorMessage?: string;
  } = {}
): Promise<AuditEntry> {
  return createAuditEntry({
    category: 'admin',
    action,
    description,
    request,
    ...options,
  });
}

/**
 * Audit helper for security events
 */
export async function auditSecurityEvent(
  request: NextRequest,
  action: AuditAction,
  description: string,
  options: {
    userId?: string;
    metadata?: Record<string, unknown>;
    severity?: AuditSeverity;
  } = {}
): Promise<AuditEntry> {
  return createAuditEntry({
    category: 'security',
    action,
    description,
    request,
    success: false,
    ...options,
  });
}

/**
 * Audit helper for authentication events
 */
export async function auditAuthEvent(
  request: NextRequest,
  action: AuditAction,
  description: string,
  options: {
    userId?: string;
    userIdentifier?: string;
    success?: boolean;
    errorMessage?: string;
    metadata?: Record<string, unknown>;
  } = {}
): Promise<AuditEntry> {
  return createAuditEntry({
    category: 'auth',
    action,
    description,
    request,
    ...options,
  });
}

/**
 * Audit helper for data operations
 */
export async function auditDataOperation(
  request: NextRequest,
  action: AuditAction,
  resource: string,
  description: string,
  options: {
    userId?: string;
    resourceId?: string;
    metadata?: Record<string, unknown>;
    success?: boolean;
    errorMessage?: string;
  } = {}
): Promise<AuditEntry> {
  return createAuditEntry({
    category: 'data',
    action,
    description,
    request,
    resource,
    ...options,
  });
}

/**
 * Audit helper for configuration changes
 */
export async function auditConfigChange(
  request: NextRequest,
  action: AuditAction,
  description: string,
  options: {
    userId?: string;
    resource?: string;
    resourceId?: string;
    metadata?: Record<string, unknown>;
    success?: boolean;
  } = {}
): Promise<AuditEntry> {
  return createAuditEntry({
    category: 'config',
    action,
    description,
    request,
    ...options,
  });
}

/**
 * Get recent audit entries (for admin dashboard)
 * 
 * @param options - Query options
 * @returns Array of audit entries
 */
export function getAuditLog(options: {
  limit?: number;
  category?: AuditCategory;
  action?: AuditAction;
  userId?: string;
  severity?: AuditSeverity;
  startDate?: Date;
  endDate?: Date;
} = {}): AuditEntry[] {
  const {
    limit = 100,
    category,
    action,
    userId,
    severity,
    startDate,
    endDate,
  } = options;
  
  let entries = [...auditBuffer];
  
  // Apply filters
  if (category) {
    entries = entries.filter(e => e.category === category);
  }
  if (action) {
    entries = entries.filter(e => e.action === action);
  }
  if (userId) {
    entries = entries.filter(e => e.userId === userId);
  }
  if (severity) {
    entries = entries.filter(e => e.severity === severity);
  }
  if (startDate) {
    entries = entries.filter(e => new Date(e.timestamp) >= startDate);
  }
  if (endDate) {
    entries = entries.filter(e => new Date(e.timestamp) <= endDate);
  }
  
  // Sort by timestamp descending and limit
  return entries
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
    .slice(0, limit);
}

/**
 * Get audit statistics
 */
export function getAuditStats(): {
  totalEntries: number;
  byCategory: Record<AuditCategory, number>;
  bySeverity: Record<AuditSeverity, number>;
  failedActions: number;
  lastFlush: string;
} {
  const byCategory: Record<AuditCategory, number> = {
    auth: 0,
    admin: 0,
    data: 0,
    config: 0,
    security: 0,
    system: 0,
    api: 0,
  };
  
  const bySeverity: Record<AuditSeverity, number> = {
    low: 0,
    medium: 0,
    high: 0,
    critical: 0,
  };
  
  let failedActions = 0;
  
  for (const entry of auditBuffer) {
    byCategory[entry.category]++;
    bySeverity[entry.severity]++;
    if (!entry.success) {
      failedActions++;
    }
  }
  
  return {
    totalEntries: auditBuffer.length,
    byCategory,
    bySeverity,
    failedActions,
    lastFlush: new Date(lastFlush).toISOString(),
  };
}

/**
 * Force flush the audit buffer
 */
export async function forceFlushAudit(): Promise<void> {
  await flushAuditBuffer();
}

/**
 * Clear the audit buffer (use with caution)
 */
export function clearAuditBuffer(): void {
  auditBuffer = [];
  lastFlush = Date.now();
}
