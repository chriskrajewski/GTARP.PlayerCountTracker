/**
 * API Cache Management System
 * 
 * Provides a unified caching layer for external API calls with configurable TTL.
 * Supports on-the-fly configuration changes without server restart.
 * 
 * Features:
 * - Database-backed persistent cache
 * - Configurable TTL per API endpoint
 * - Automatic cache expiration
 * - Real-time configuration updates
 * - Cache statistics and monitoring
 */

import { createClient } from '@supabase/supabase-js';

interface CacheConfig {
  api_name: string;
  cache_enabled: boolean;
  cache_ttl_seconds: number;
  last_cache_clear?: string;
  description?: string;
}

interface CacheEntry {
  api_name: string;
  cache_key: string;
  cache_value: Record<string, unknown>;
  expires_at: string;
}

interface CacheStats {
  api_name: string;
  cache_enabled: boolean;
  cache_ttl_seconds: number;
  total_entries: number;
  expired_entries: number;
  last_cache_clear?: string;
}

class APICache {
  private supabase: ReturnType<typeof createClient>;
  private configCache: Map<string, CacheConfig> = new Map();
  private configCacheExpiry: number = 0;
  private CONFIG_CACHE_TTL = 60000; // 1 minute

  constructor() {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!url || !key) {
      throw new Error('Supabase credentials not configured');
    }

    this.supabase = createClient(url, key);
  }

  /**
   * Get cache configuration for an API
   * Uses in-memory cache with TTL to reduce database queries
   */
  private async getCacheConfig(apiName: string): Promise<CacheConfig | null> {
    const now = Date.now();

    // Check if in-memory cache is still valid
    if (this.configCache.has(apiName) && now < this.configCacheExpiry) {
      return this.configCache.get(apiName) || null;
    }

    try {
      const { data, error } = await this.supabase
        .from('api_cache_config')
        .select('*')
        .eq('api_name', apiName)
        .single();

      if (error) {
        console.warn(`[APICache] Failed to fetch config for ${apiName}:`, error);
        return null;
      }

      if (data) {
        this.configCache.set(apiName, data);
        this.configCacheExpiry = now + this.CONFIG_CACHE_TTL;
      }

      return data || null;
    } catch (error) {
      console.error(`[APICache] Error fetching cache config:`, error);
      return null;
    }
  }

  /**
   * Get cached value if it exists and hasn't expired
   */
  async get<T = Record<string, unknown>>(apiName: string, cacheKey: string): Promise<T | null> {
    try {
      const config = await this.getCacheConfig(apiName);

      if (!config || !config.cache_enabled) {
        return null;
      }

      const { data, error } = await this.supabase
        .from('api_cache_data')
        .select('cache_value, expires_at')
        .eq('api_name', apiName)
        .eq('cache_key', cacheKey)
        .gt('expires_at', new Date().toISOString())
        .single();

      if (error || !data) {
        return null;
      }

      return data.cache_value as T;
    } catch (error) {
      console.error(`[APICache] Error retrieving cache:`, error);
      return null;
    }
  }

  /**
   * Set cached value with TTL from configuration
   */
  async set(apiName: string, cacheKey: string, value: Record<string, unknown>): Promise<boolean> {
    try {
      const config = await this.getCacheConfig(apiName);

      if (!config || !config.cache_enabled) {
        return false;
      }

      const expiresAt = new Date(Date.now() + config.cache_ttl_seconds * 1000);

      const { error } = await this.supabase
        .from('api_cache_data')
        .upsert(
          {
            api_name: apiName,
            cache_key: cacheKey,
            cache_value: value,
            expires_at: expiresAt.toISOString(),
          },
          { onConflict: 'api_name,cache_key' }
        );

      if (error) {
        console.error(`[APICache] Error setting cache:`, error);
        return false;
      }

      return true;
    } catch (error) {
      console.error(`[APICache] Error setting cache:`, error);
      return false;
    }
  }

  /**
   * Clear all cache entries for an API
   */
  async clear(apiName: string): Promise<boolean> {
    try {
      const { error } = await this.supabase
        .from('api_cache_data')
        .delete()
        .eq('api_name', apiName);

      if (error) {
        console.error(`[APICache] Error clearing cache:`, error);
        return false;
      }

      // Update last_cache_clear timestamp
      await this.supabase
        .from('api_cache_config')
        .update({ last_cache_clear: new Date().toISOString() })
        .eq('api_name', apiName);

      // Invalidate config cache
      this.configCache.delete(apiName);

      return true;
    } catch (error) {
      console.error(`[APICache] Error clearing cache:`, error);
      return false;
    }
  }

  /**
   * Clear expired cache entries for an API
   */
  async clearExpired(apiName: string): Promise<number> {
    try {
      const { data, error } = await this.supabase
        .from('api_cache_data')
        .delete()
        .eq('api_name', apiName)
        .lt('expires_at', new Date().toISOString())
        .select('id', { count: 'exact' });

      if (error) {
        console.error(`[APICache] Error clearing expired cache:`, error);
        return 0;
      }

      return data?.length || 0;
    } catch (error) {
      console.error(`[APICache] Error clearing expired cache:`, error);
      return 0;
    }
  }

  /**
   * Update cache configuration
   */
  async updateConfig(
    apiName: string,
    updates: Partial<CacheConfig>
  ): Promise<CacheConfig | null> {
    try {
      const { data, error } = await this.supabase
        .from('api_cache_config')
        .update({
          ...updates,
          updated_at: new Date().toISOString(),
        })
        .eq('api_name', apiName)
        .select()
        .single();

      if (error) {
        console.error(`[APICache] Error updating config:`, error);
        return null;
      }

      // Invalidate config cache
      this.configCache.delete(apiName);

      return data || null;
    } catch (error) {
      console.error(`[APICache] Error updating config:`, error);
      return null;
    }
  }

  /**
   * Get cache statistics
   */
  async getStats(apiName: string): Promise<CacheStats | null> {
    try {
      const config = await this.getCacheConfig(apiName);

      if (!config) {
        return null;
      }

      const { data: allEntries, error: allError } = await this.supabase
        .from('api_cache_data')
        .select('id', { count: 'exact' })
        .eq('api_name', apiName);

      const { data: expiredEntries, error: expiredError } = await this.supabase
        .from('api_cache_data')
        .select('id', { count: 'exact' })
        .eq('api_name', apiName)
        .lt('expires_at', new Date().toISOString());

      if (allError || expiredError) {
        console.error(`[APICache] Error fetching stats:`, allError || expiredError);
        return null;
      }

      return {
        api_name: apiName,
        cache_enabled: config.cache_enabled,
        cache_ttl_seconds: config.cache_ttl_seconds,
        total_entries: allEntries?.length || 0,
        expired_entries: expiredEntries?.length || 0,
        last_cache_clear: config.last_cache_clear,
      };
    } catch (error) {
      console.error(`[APICache] Error getting stats:`, error);
      return null;
    }
  }

  /**
   * Get all cache configurations
   */
  async getAllConfigs(): Promise<CacheConfig[]> {
    try {
      const { data, error } = await this.supabase
        .from('api_cache_config')
        .select('*')
        .order('api_name');

      if (error) {
        console.error(`[APICache] Error fetching all configs:`, error);
        return [];
      }

      return data || [];
    } catch (error) {
      console.error(`[APICache] Error fetching all configs:`, error);
      return [];
    }
  }
}

// Singleton instance
let cacheInstance: APICache | null = null;

export function getAPICache(): APICache {
  if (!cacheInstance) {
    cacheInstance = new APICache();
  }
  return cacheInstance;
}

export type { CacheConfig, CacheEntry, CacheStats };
