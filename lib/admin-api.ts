"use client";

import { 
  AdminAPIResponse, 
  PaginatedResponse, 
  SystemMetrics,
  ServerConfiguration,
  DataCollectionStatus,
  APIUsageMetrics,
  SystemConfiguration,
  SystemSetting,
  AuditLog,
  BackupRecord,
  DatabaseHealth,
  DatabaseBackup,
  DatabaseStatus,
  DatabaseTable,
  AdminDashboardData,
  StreamAnalytics,
  ServerFormData,
  ConfigurationFormData,
  NotificationTemplate,
  FeatureFlag,
  SystemAlert,
  MaintenanceTask,
} from '@/lib/admin-types';
import { getStoredAdminToken } from '@/lib/admin-auth';
import { createBrowserClient } from '@/lib/supabase-browser';
import type { ReviewQueueItem } from '@/lib/streamer-characters';

// Streamer Character Tracking admin responses. The admin route returns the
// payload directly (`{ success, items }` for the queue, `{ success }` /
// `{ success, result }` for an action), not wrapped in `AdminAPIResponse.data`.
export interface CharacterReviewQueueResponse {
  success: boolean;
  items?: ReviewQueueItem[];
  error?: string;
}

export interface CharacterActionResponse {
  success: boolean;
  result?: unknown;
  error?: string;
}

class AdminAPI {
  private baseURL: string = '/api/admin';

  private async getAuthToken(): Promise<string | null> {
    // First try to get stored admin token (for legacy auth)
    const storedToken = getStoredAdminToken();
    if (storedToken) {
      return storedToken;
    }

    // Otherwise try to get Supabase session token
    try {
      const supabase = createBrowserClient();
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.access_token) {
        return session.access_token;
      }
    } catch (error) {
      console.error('Error getting Supabase session:', error);
    }

    return null;
  }

  private async request<T = any>(
    endpoint: string, 
    options: RequestInit = {}
  ): Promise<AdminAPIResponse<T>> {
    const token = await this.getAuthToken();
    if (!token) {
      throw new Error('Admin authentication required');
    }

    const url = `${this.baseURL}${endpoint}`;
    const config: RequestInit = {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
        ...options.headers,
      },
    };

    try {
      const response = await fetch(url, config);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || `HTTP ${response.status}: ${response.statusText}`);
      }

      return data;
    } catch (error) {
      console.error(`Admin API Error [${endpoint}]:`, error);
      throw error;
    }
  }

  private async get<T = any>(endpoint: string, params?: Record<string, string>): Promise<AdminAPIResponse<T>> {
    let url = endpoint;
    if (params) {
      const searchParams = new URLSearchParams(params);
      url += `?${searchParams.toString()}`;
    }
    return this.request<T>(url, { method: 'GET' });
  }

  private async post<T = any>(endpoint: string, data?: any): Promise<AdminAPIResponse<T>> {
    return this.request<T>(endpoint, {
      method: 'POST',
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  private async put<T = any>(endpoint: string, data?: any): Promise<AdminAPIResponse<T>> {
    return this.request<T>(endpoint, {
      method: 'PUT',
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  private async patch<T = any>(endpoint: string, data?: any): Promise<AdminAPIResponse<T>> {
    return this.request<T>(endpoint, {
      method: 'PATCH',
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  private async delete<T = any>(endpoint: string): Promise<AdminAPIResponse<T>> {
    return this.request<T>(endpoint, { method: 'DELETE' });
  }

  // ==================== DASHBOARD ====================
  async getDashboardData(): Promise<AdminAPIResponse<AdminDashboardData>> {
    return this.get<AdminDashboardData>('/dashboard');
  }

  async getSystemMetrics(): Promise<AdminAPIResponse<SystemMetrics>> {
    return this.get<SystemMetrics>('/metrics');
  }

  async getSystemHealth(): Promise<AdminAPIResponse<any>> {
    return this.get('/health');
  }

  // ==================== SERVERS ====================
  async getServers(params?: {
    page?: number;
    limit?: number;
    search?: string;
    status?: string;
  }): Promise<AdminAPIResponse<PaginatedResponse<ServerConfiguration>>> {
    return this.get<PaginatedResponse<ServerConfiguration>>('/servers', params as Record<string, string>);
  }

  async getServer(serverId: string): Promise<AdminAPIResponse<ServerConfiguration>> {
    return this.get<ServerConfiguration>(`/servers/${serverId}`);
  }

  async createServer(data: ServerFormData): Promise<AdminAPIResponse<ServerConfiguration>> {
    return this.post<ServerConfiguration>('/servers', data);
  }

  async updateServer(serverId: string, data: Partial<ServerFormData>): Promise<AdminAPIResponse<ServerConfiguration>> {
    return this.put<ServerConfiguration>(`/servers/${serverId}`, data);
  }

  async deleteServer(serverId: string): Promise<AdminAPIResponse<void>> {
    return this.delete(`/servers/${serverId}`);
  }

  async toggleServerStatus(serverId: string, isActive: boolean): Promise<AdminAPIResponse<ServerConfiguration>> {
    return this.put<ServerConfiguration>(`/servers/${serverId}/status`, { is_active: isActive });
  }

  async updateServerOrder(serverOrders: { server_id: string; order: number }[]): Promise<AdminAPIResponse<void>> {
    return this.put('/servers/reorder', { orders: serverOrders });
  }

  async getServerManagementData(): Promise<AdminAPIResponse<any[]>> {
    return this.get<any[]>('/servers/management');
  }

  async updateServerManagementData(data: {
    server_id: string;
    data_start_date?: string;
    server_colors?: { color_hsl: string };
    stream_search_config?: Array<{
      platform: 'twitch' | 'kick';
      search_keyword: string;
      search_type: 'title' | 'category' | 'tag';
      is_active: boolean;
      priority: number;
    }>;
  }): Promise<AdminAPIResponse<void>> {
    return this.put('/servers/management', data);
  }

  async migrateServerId(oldServerId: string, newServerId: string): Promise<AdminAPIResponse<any>> {
    return this.post('/servers/migrate', { old_server_id: oldServerId, new_server_id: newServerId });
  }

  // ==================== DATA MANAGEMENT ====================
  async getDataCollectionStatus(): Promise<AdminAPIResponse<DataCollectionStatus[]>> {
    return this.get<DataCollectionStatus[]>('/data/collection-status');
  }

  async backfillPlayerCounts(params: {
    gap_start?: string;
    gap_end?: string;
    interval_seconds?: number;
    lookback_days?: number;
  }): Promise<AdminAPIResponse<any>> {
    return this.post('/data/backfill', params);
  }

  async detectDataGaps(): Promise<AdminAPIResponse<any>> {
    return this.get('/data/gaps');
  }

  // ==================== MONITORING ====================
  async runMonitoringChecks(): Promise<AdminAPIResponse<any>> {
    return this.post('/monitoring/run');
  }

  async getAlertHistory(params?: { limit?: number; unresolved?: boolean }): Promise<AdminAPIResponse<any[]>> {
    const queryParams: Record<string, string> = {};
    if (params?.limit) queryParams.limit = String(params.limit);
    if (params?.unresolved) queryParams.unresolved = 'true';
    return this.get('/monitoring/alerts', queryParams);
  }

  async resolveAlert(id: number): Promise<AdminAPIResponse<void>> {
    return this.put('/monitoring/alerts', { id, resolved: true });
  }

  async getMonitoringConfig(): Promise<AdminAPIResponse<any>> {
    return this.get('/monitoring/config');
  }

  async updateMonitoringConfig(config: { discord_webhook_url?: string; monitoring_enabled?: boolean; monitoring_config?: any }): Promise<AdminAPIResponse<void>> {
    return this.put('/monitoring/config', config);
  }

  async testDiscordWebhook(webhookUrl: string): Promise<AdminAPIResponse<void>> {
    return this.post('/monitoring/config', { webhook_url: webhookUrl });
  }

  // ==================== ANOMALY DETECTION ====================
  async getAnomalies(params?: { limit?: number; active?: boolean }): Promise<AdminAPIResponse<any[]>> {
    const queryParams: Record<string, string> = {};
    if (params?.limit) queryParams.limit = String(params.limit);
    if (params?.active) queryParams.active = 'true';
    return this.get<any[]>('/monitoring/anomalies', queryParams);
  }

  async getAnomalyConfig(): Promise<AdminAPIResponse<{
    thresholdPercent: number;
    minChange: number;
    dedupWindowMinutes: number;
  }>> {
    return this.get('/monitoring/anomaly-config');
  }

  async updateAnomalyConfig(config: {
    thresholdPercent?: number;
    minChange?: number;
    dedupWindowMinutes?: number;
  }): Promise<AdminAPIResponse<{
    thresholdPercent: number;
    minChange: number;
    dedupWindowMinutes: number;
  }>> {
    return this.patch('/monitoring/anomaly-config', config);
  }

  async triggerDataCollection(serverId?: string): Promise<AdminAPIResponse<void>> {
    return this.post('/data/collect', serverId ? { server_id: serverId } : undefined);
  }

  async exportData(params: {
    server_ids?: string[];
    start_date: string;
    end_date: string;
    format: 'csv' | 'json';
    data_types: ('player_counts' | 'stream_data' | 'viewer_data')[];
  }): Promise<AdminAPIResponse<{ download_url: string }>> {
    return this.post('/data/export', params);
  }

  async importData(file: File, dataType: string): Promise<AdminAPIResponse<{ imported_records: number }>> {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('data_type', dataType);

    const token = getStoredAdminToken();
    const response = await fetch(`${this.baseURL}/data/import`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
      body: formData,
    });

    return response.json();
  }

  async deleteDataRange(params: {
    server_ids?: string[];
    start_date: string;
    end_date: string;
    data_types: string[];
  }): Promise<AdminAPIResponse<{ deleted_records: number }>> {
    const searchParams = new URLSearchParams();
    if (params.server_ids) searchParams.set('server_ids', params.server_ids.join(','));
    searchParams.set('start_date', params.start_date);
    searchParams.set('end_date', params.end_date);
    searchParams.set('data_types', params.data_types.join(','));
    
    return this.delete(`/data/range?${searchParams.toString()}`);
  }

  // ==================== ANALYTICS ====================
  async getAPIUsageMetrics(timeRange: string = '24h'): Promise<AdminAPIResponse<APIUsageMetrics[]>> {
    return this.get<APIUsageMetrics[]>('/analytics', { time_range: timeRange });
  }

  async getStreamAnalytics(serverId?: string, timeRange: string = '7d'): Promise<AdminAPIResponse<StreamAnalytics[]>> {
    const params: Record<string, string> = { time_range: timeRange };
    if (serverId) params.server_id = serverId;
    return this.get<StreamAnalytics[]>('/analytics/streams', params);
  }

  async getUserActivityMetrics(timeRange: string = '7d'): Promise<AdminAPIResponse<any>> {
    return this.get('/analytics/user-activity', { time_range: timeRange });
  }

  // ==================== SYSTEM CONFIGURATION ====================
  async getSystemConfigurations(category?: string): Promise<AdminAPIResponse<SystemConfiguration[]>> {
    const params = category ? { category } : undefined;
    return this.get<SystemConfiguration[]>('/config', params);
  }

  async updateSystemConfiguration(
    configId: string, 
    data: Partial<ConfigurationFormData>
  ): Promise<AdminAPIResponse<SystemConfiguration>> {
    return this.put<SystemConfiguration>(`/config/${configId}`, data);
  }

  async createSystemConfiguration(data: ConfigurationFormData): Promise<AdminAPIResponse<SystemConfiguration>> {
    return this.post<SystemConfiguration>('/config', data);
  }

  async deleteSystemConfiguration(configId: string): Promise<AdminAPIResponse<void>> {
    return this.delete(`/config/${configId}`);
  }

  async getSystemSettings(params?: { category?: string }): Promise<AdminAPIResponse<SystemSetting[]>> {
    const query = params?.category ? { category: params.category } : undefined;
    return this.get<SystemSetting[]>('/settings', query);
  }

  async updateSystemSetting(data: {
    key: string;
    value: string | number | boolean | Record<string, unknown>;
    data_type?: 'string' | 'number' | 'boolean' | 'json';
    description?: string;
    category?: string;
  }): Promise<AdminAPIResponse<SystemSetting>> {
    return this.post<SystemSetting>('/settings', data);
  }

  // ==================== MAINTENANCE ====================
  async getMaintenanceTasks(): Promise<AdminAPIResponse<MaintenanceTask[]>> {
    return this.get<MaintenanceTask[]>('/maintenance/tasks');
  }

  async getMaintenanceMode(): Promise<AdminAPIResponse<{ enabled: boolean; message?: string }>> {
    return this.get<{ enabled: boolean; message?: string }>('/maintenance/mode');
  }

  async setMaintenanceMode(payload: boolean | { enabled: boolean; message?: string }): Promise<AdminAPIResponse<{ enabled: boolean; message?: string }>> {
    const body = typeof payload === 'boolean' ? { enabled: payload } : payload;
    return this.put<{ enabled: boolean; message?: string }>('/maintenance/mode', body);
  }

  async runMaintenanceTask(taskId: string): Promise<AdminAPIResponse<{ status: string }>> {
    return this.post<{ status: string }>(`/maintenance/tasks/${taskId}/run`);
  }

  // ==================== AUDIT & SECURITY ====================
  async getAuditLogs(params?: {
    page?: number;
    limit?: number;
    user_id?: string;
    action?: string;
    resource_type?: string;
    start_date?: string;
    end_date?: string;
    severity?: string;
  }): Promise<AdminAPIResponse<PaginatedResponse<AuditLog>>> {
    return this.get<PaginatedResponse<AuditLog>>('/audit/logs', params as Record<string, string>);
  }

  async getSecurityEvents(params?: {
    page?: number;
    limit?: number;
    event_type?: string;
    severity?: string;
  }): Promise<AdminAPIResponse<PaginatedResponse<any>>> {
    return this.get<PaginatedResponse<any>>('/security/events', params as Record<string, string>);
  }

  // ==================== BACKUPS ====================
  async getBackups(): Promise<AdminAPIResponse<BackupRecord[]>> {
    return this.get<BackupRecord[]>('/backups');
  }

  async createBackup(type: 'full' | 'incremental' | 'config'): Promise<AdminAPIResponse<BackupRecord>> {
    return this.post<BackupRecord>('/backups', { backup_type: type });
  }

  async restoreBackup(backupId: string): Promise<AdminAPIResponse<void>> {
    return this.post('/backups/restore', { backup_id: backupId });
  }

  async deleteBackup(backupId: string): Promise<AdminAPIResponse<void>> {
    return this.delete(`/backups/${backupId}`);
  }

  async getDatabaseBackups(): Promise<AdminAPIResponse<DatabaseBackup[]>> {
    return this.get<DatabaseBackup[]>('/database/backups');
  }

  async createDatabaseBackup(type: 'full' | 'incremental' | 'config' = 'full'): Promise<AdminAPIResponse<DatabaseBackup>> {
    return this.post<DatabaseBackup>('/database/backups', { backup_type: type });
  }

  // ==================== DATABASE MANAGEMENT ====================
  async getDatabaseHealth(): Promise<AdminAPIResponse<DatabaseHealth[]>> {
    return this.get<DatabaseHealth[]>('/database/health');
  }

  async getDatabaseStatus(): Promise<AdminAPIResponse<DatabaseStatus>> {
    return this.get<DatabaseStatus>('/database/status');
  }

  async getDatabaseTables(): Promise<AdminAPIResponse<DatabaseTable[]>> {
    return this.get<DatabaseTable[]>('/database/tables');
  }

  async optimizeDatabase(): Promise<AdminAPIResponse<{ message: string }>> {
    return this.post('/database/optimize');
  }

  async vacuumDatabase(): Promise<AdminAPIResponse<{ message: string }>> {
    return this.post('/database/vacuum');
  }

  // ==================== NOTIFICATIONS ====================
  async getNotificationTemplates(): Promise<AdminAPIResponse<NotificationTemplate[]>> {
    return this.get<NotificationTemplate[]>('/notifications/templates');
  }

  async createNotificationTemplate(data: Omit<NotificationTemplate, 'id' | 'created_at' | 'created_by'>): Promise<AdminAPIResponse<NotificationTemplate>> {
    return this.post<NotificationTemplate>('/notifications/templates', data);
  }

  async sendBulkNotification(data: {
    template_id?: string;
    banner: any;
    target_users?: string[];
    schedule_time?: string;
  }): Promise<AdminAPIResponse<{ sent_count: number }>> {
    return this.post('/notifications/send-bulk', data);
  }

  // ==================== FEATURE FLAGS ====================
  async getFeatureFlags(): Promise<AdminAPIResponse<FeatureFlag[]>> {
    return this.get<FeatureFlag[]>('/features');
  }

  async updateFeatureFlag(flagId: string, data: Partial<FeatureFlag>): Promise<AdminAPIResponse<FeatureFlag>> {
    return this.patch<FeatureFlag>(`/features/${flagId}`, data);
  }

  async createFeatureFlag(data: Omit<FeatureFlag, 'id' | 'created_at' | 'updated_at' | 'created_by'>): Promise<AdminAPIResponse<FeatureFlag>> {
    return this.post<FeatureFlag>('/features', data);
  }

  // ==================== SYSTEM ALERTS ====================
  async getSystemAlerts(resolved?: boolean): Promise<AdminAPIResponse<SystemAlert[]>> {
    const params = resolved !== undefined ? { resolved: resolved.toString() } : undefined;
    return this.get<SystemAlert[]>('/alerts', params);
  }

  async dismissAlert(alertId: string): Promise<AdminAPIResponse<void>> {
    return this.delete(`/alerts/${alertId}`);
  }

  // ==================== CHARACTER TRACKING ====================
  // Streamer Character Tracking review queue + corrections. The admin route
  // returns the payload directly (`{ success, items }` / `{ success }`), not
  // wrapped in `data`, and `request` returns the raw parsed JSON, so callers
  // read `response.items` / `response.success` straight off the result.
  async getCharacterReviewQueue(): Promise<CharacterReviewQueueResponse> {
    return this.get('/characters') as unknown as Promise<CharacterReviewQueueResponse>;
  }

  async postCharacterAction(action: Record<string, unknown>): Promise<CharacterActionResponse> {
    return this.post('/characters', action) as unknown as Promise<CharacterActionResponse>;
  }

  // ==================== UTILITIES ====================
  async testConnection(): Promise<AdminAPIResponse<{ status: string; response_time: number }>> {
    return this.get('/test-connection');
  }

  async clearCache(cacheType?: string): Promise<AdminAPIResponse<{ message: string }>> {
    return this.post('/cache/clear', cacheType ? { cache_type: cacheType } : undefined);
  }

  async getSystemLogs(params?: {
    level?: string;
    component?: string;
    limit?: number;
  }): Promise<AdminAPIResponse<any[]>> {
    return this.get('/logs', params as Record<string, string>);
  }
}

// Export singleton instance
export const adminAPI = new AdminAPI();
export default adminAPI;
