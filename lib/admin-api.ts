"use client";

import { 
  AdminAPIResponse, 
  PaginatedResponse, 
  SystemMetrics,
  ServerConfiguration,
  DataCollectionStatus,
  APIUsageMetrics,
  SystemConfiguration,
  AuditLog,
  BackupRecord,
  DatabaseHealth,
  AdminDashboardData,
  StreamAnalytics,
  ServerFormData,
  ConfigurationFormData,
  NotificationTemplate,
  FeatureFlag,
  SystemAlert
} from '@/lib/admin-types';
import { getStoredAdminToken } from '@/lib/admin-auth';

class AdminAPI {
  private baseURL: string = '/api/admin';

  private async request<T = any>(
    endpoint: string, 
    options: RequestInit = {}
  ): Promise<AdminAPIResponse<T>> {
    const token = getStoredAdminToken();
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

  // ==================== DATA MANAGEMENT ====================
  async getDataCollectionStatus(): Promise<AdminAPIResponse<DataCollectionStatus[]>> {
    return this.get<DataCollectionStatus[]>('/data/collection-status');
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
    return this.get<APIUsageMetrics[]>('/analytics/api-usage', { time_range: timeRange });
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

  // ==================== DATABASE MANAGEMENT ====================
  async getDatabaseHealth(): Promise<AdminAPIResponse<DatabaseHealth[]>> {
    return this.get<DatabaseHealth[]>('/database/health');
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
    return this.put<FeatureFlag>(`/features/${flagId}`, data);
  }

  async createFeatureFlag(data: Omit<FeatureFlag, 'id' | 'created_at' | 'updated_at' | 'created_by'>): Promise<AdminAPIResponse<FeatureFlag>> {
    return this.post<FeatureFlag>('/features', data);
  }

  // ==================== SYSTEM ALERTS ====================
  async getSystemAlerts(resolved?: boolean): Promise<AdminAPIResponse<SystemAlert[]>> {
    const params = resolved !== undefined ? { resolved: resolved.toString() } : undefined;
    return this.get<SystemAlert[]>('/alerts', params);
  }

  async resolveAlert(alertId: string): Promise<AdminAPIResponse<SystemAlert>> {
    return this.put<SystemAlert>(`/alerts/${alertId}/resolve`);
  }

  async dismissAlert(alertId: string): Promise<AdminAPIResponse<void>> {
    return this.delete(`/alerts/${alertId}`);
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