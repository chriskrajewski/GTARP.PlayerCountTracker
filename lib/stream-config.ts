/**
 * Stream Search Configuration
 * 
 * Manages the configuration for searching streams on Twitch and Kick.
 * Configuration is stored in Supabase and cached for performance.
 */

import { createServerClient } from '@/lib/supabase-server';

export type StreamPlatform = 'twitch' | 'kick';
export type SearchType = 'title' | 'category' | 'tag';

export interface StreamSearchConfig {
  id: string;
  server_id: string;
  platform: StreamPlatform;
  search_keyword: string;
  search_type: SearchType;
  is_active: boolean;
  priority: number;
  created_at: string;
  updated_at: string;
}

// In-memory cache for stream search config
interface CacheEntry {
  data: StreamSearchConfig[];
  timestamp: number;
}

const configCache = new Map<string, CacheEntry>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

// IMPORTANT:
// Config comes from Supabase `stream_search_config` only.
// We intentionally do not keep any hardcoded per-server fallback mappings.

/**
 * Get stream search configuration for a specific server
 */
export async function getStreamSearchConfig(serverId: string): Promise<StreamSearchConfig[]> {
  const cacheKey = `config_${serverId}`;
  
  // Check cache first
  const cached = configCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.data;
  }

  try {
    const supabase = createServerClient();
    
    const { data, error } = await supabase
      .from('stream_search_config')
      .select('*')
      .eq('server_id', serverId)
      .eq('is_active', true)
      .order('priority', { ascending: false });

    if (error) {
      console.error('[StreamConfig] Supabase error:', error);
      return [];
    }

    if (!data || data.length === 0) {
      return [];
    }

    // Cache the result
    configCache.set(cacheKey, {
      data: data as StreamSearchConfig[],
      timestamp: Date.now()
    });

    return data as StreamSearchConfig[];
  } catch (error) {
    console.error('[StreamConfig] Error fetching config:', error);
    return [];
  }
}

/**
 * Get stream search configuration for a specific server and platform
 */
export async function getStreamSearchConfigByPlatform(
  serverId: string, 
  platform: StreamPlatform
): Promise<StreamSearchConfig[]> {
  const allConfig = await getStreamSearchConfig(serverId);
  return allConfig.filter(c => c.platform === platform);
}

/**
 * Get all active stream search configurations
 */
export async function getAllStreamSearchConfig(): Promise<StreamSearchConfig[]> {
  const cacheKey = 'config_all';
  
  // Check cache first
  const cached = configCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.data;
  }

  try {
    const supabase = createServerClient();
    
    const { data, error } = await supabase
      .from('stream_search_config')
      .select('*')
      .eq('is_active', true)
      .order('server_id')
      .order('priority', { ascending: false });

    if (error) {
      console.error('[StreamConfig] Supabase error:', error);
      return [];
    }

    if (!data || data.length === 0) {
      return [];
    }

    // Cache the result
    configCache.set(cacheKey, {
      data: data as StreamSearchConfig[],
      timestamp: Date.now()
    });

    return data as StreamSearchConfig[];
  } catch (error) {
    console.error('[StreamConfig] Error fetching all config:', error);
    return [];
  }
}

/**
 * Get search keywords for a server on a specific platform
 */
export async function getSearchKeywords(
  serverId: string, 
  platform: StreamPlatform
): Promise<string[]> {
  const config = await getStreamSearchConfigByPlatform(serverId, platform);
  return config.map(c => c.search_keyword.toLowerCase());
}

/**
 * Get active stream search configuration for multiple servers (optionally scoped by platform).
 * Returns a map keyed by server_id. Servers with no config will map to an empty array.
 */
export async function getStreamSearchConfigMap(
  serverIds: string[],
  platform?: StreamPlatform
): Promise<Map<string, StreamSearchConfig[]>> {
  const map = new Map<string, StreamSearchConfig[]>();
  if (!serverIds || serverIds.length === 0) {
    return map;
  }

  // Initialize empty arrays so callers can safely read map.get(serverId)
  for (const id of serverIds) {
    map.set(id, []);
  }

  try {
    const supabase = createServerClient();
    let query = supabase
      .from('stream_search_config')
      .select('*')
      .eq('is_active', true)
      .in('server_id', serverIds);

    if (platform) {
      query = query.eq('platform', platform);
    }

    query = query.order('priority', { ascending: false });

    const { data, error } = await query;

    if (error) {
      console.error('[StreamConfig] Supabase error (map):', error);
      return map;
    }

    for (const row of (data || []) as StreamSearchConfig[]) {
      const current = map.get(row.server_id) ?? [];
      current.push(row);
      map.set(row.server_id, current);
    }
  } catch (error) {
    console.error('[StreamConfig] Error fetching config map:', error);
  }

  return map;
}

/**
 * Check if a stream title matches any of the server's search keywords
 */
export function matchesSearchKeywords(
  title: string, 
  keywords: string[]
): boolean {
  const lowerTitle = title.toLowerCase();
  return keywords.some(keyword => lowerTitle.includes(keyword));
}

/**
 * Clear the configuration cache
 */
export function clearStreamConfigCache(): void {
  configCache.clear();
  console.log('[StreamConfig] Cache cleared');
}

/**
 * Get unique server IDs that have Kick support
 */
export async function getKickSupportedServers(): Promise<string[]> {
  const allConfig = await getAllStreamSearchConfig();
  const kickServers = allConfig
    .filter(c => c.platform === 'kick')
    .map(c => c.server_id);
  return [...new Set(kickServers)];
}
