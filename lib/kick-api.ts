/**
 * Kick.com API Integration
 *
 * This module provides a server-side API for fetching stream data from Kick.com.
 * It uses the @nekiro/kick-api package for authenticated API access.
 *
 * IMPORTANT: All stream filtering MUST use the stream_search_config from Supabase.
 * No hardcoded search keywords or server mappings are allowed.
 */

import { client as KickClient, type Livestream, type Category } from '@nekiro/kick-api';

/**
 * Stream data structure returned by our API
 */
export interface KickStreamData {
  channel_slug: string;
  user_name: string;
  title: string;
  viewer_count: number;
  started_at: string;
  thumbnail_url: string;
  category_name: string;
  category_id: number;
  language: string;
}

// Cache for Kick API responses
interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

const streamCache = new Map<string, CacheEntry<KickStreamData[]>>();
const categoryCache = new Map<string, CacheEntry<number>>();
const STREAM_CACHE_TTL = 30 * 1000; // 30 seconds
const CATEGORY_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

// Kick API client singleton
let kickClient: InstanceType<typeof KickClient> | null = null;

/**
 * Check if Kick API credentials are configured
 */
export function isKickApiConfigured(): boolean {
  return !!(process.env.KICK_CLIENT_ID && process.env.KICK_CLIENT_SECRET);
}

/**
 * Get or create the Kick API client
 */
function getKickClient(): InstanceType<typeof KickClient> | null {
  if (!isKickApiConfigured()) {
    return null;
  }

  if (!kickClient) {
    try {
      kickClient = new KickClient({
        clientId: process.env.KICK_CLIENT_ID!,
        clientSecret: process.env.KICK_CLIENT_SECRET!,
        debug: process.env.NODE_ENV === 'development',
      });
    } catch (error) {
      console.error('[KickAPI] Failed to initialize client:', error);
      return null;
    }
  }

  return kickClient;
}

/**
 * Transform Kick API livestream response to our standard format
 */
function transformLivestream(stream: Livestream): KickStreamData {
  return {
    channel_slug: stream.slug || '',
    user_name: stream.slug || '', // Kick uses slug as identifier
    title: stream.stream_title || '',
    viewer_count: stream.viewer_count || 0,
    started_at: stream.started_at || new Date().toISOString(),
    thumbnail_url: stream.thumbnail || '',
    category_name: stream.category?.name || '',
    category_id: stream.category?.id || 0,
    language: stream.language || 'en',
  };
}

/**
 * Get category ID by name/keyword from Kick API
 */
export async function getCategoryIdByName(categoryName: string): Promise<number | null> {
  const cacheKey = categoryName.toLowerCase().trim();
  const cached = categoryCache.get(cacheKey);

  if (cached && Date.now() - cached.timestamp < CATEGORY_CACHE_TTL) {
    return cached.data;
  }

  const client = getKickClient();
  if (!client) {
    console.error('[KickAPI] Client not configured');
    return null;
  }

  try {
    const categories = await client.categories.getCategories({ q: categoryName });

    if (!categories || categories.length === 0) {
      console.warn(`[KickAPI] No category found for "${categoryName}"`);
      return null;
    }

    // Find exact or best match
    const lowerName = categoryName.toLowerCase();
    const exactMatch = categories.find(
      (c: Category) => c.name.toLowerCase() === lowerName
    );
    const categoryId = exactMatch?.id || categories[0]?.id || null;

    if (categoryId) {
      categoryCache.set(cacheKey, { data: categoryId, timestamp: Date.now() });
    }

    return categoryId;
  } catch (error) {
    console.error(`[KickAPI] Error fetching category "${categoryName}":`, error);
    return null;
  }
}

/**
 * Fetch livestreams by category ID
 */
export async function getKickStreamsByCategoryId(
  categoryId: number,
  limit: number = 100
): Promise<KickStreamData[]> {
  const cacheKey = `category_${categoryId}_${limit}`;
  const cached = streamCache.get(cacheKey);

  if (cached && Date.now() - cached.timestamp < STREAM_CACHE_TTL) {
    return cached.data;
  }

  const client = getKickClient();
  if (!client) {
    console.error('[KickAPI] Client not configured');
    return [];
  }

  try {
    const streams = await client.livestreams.getLivestreams({
      category_id: categoryId,
      limit: Math.min(limit, 100), // API max is 100
      sort: 'viewer_count',
    });

    if (!streams || !Array.isArray(streams)) {
      return [];
    }

    const transformed = streams.map(transformLivestream);

    streamCache.set(cacheKey, { data: transformed, timestamp: Date.now() });
    return transformed;
  } catch (error) {
    console.error(`[KickAPI] Error fetching streams for category ${categoryId}:`, error);
    return [];
  }
}

/**
 * Fetch livestreams by category name/query
 * First resolves the category name to an ID, then fetches streams
 */
export async function getKickStreamsByCategoryQuery(
  categoryQuery: string,
  limit: number = 100
): Promise<KickStreamData[]> {
  const categoryId = await getCategoryIdByName(categoryQuery);

  if (!categoryId) {
    console.warn(`[KickAPI] Could not resolve category "${categoryQuery}" to ID`);
    return [];
  }

  return getKickStreamsByCategoryId(categoryId, limit);
}

// NOTE: We intentionally do NOT have hardcoded category helpers like "getKickNoPixelStreams"
// All category lookups should be driven by stream_search_config from Supabase.
// The getKickStreamsByCategoryQuery function handles caching for any category.

/**
 * Get top streams from Kick (sorted by viewer count)
 * This is a fallback when no category-based config is provided
 */
export async function getKickTopStreams(limit: number = 100): Promise<KickStreamData[]> {
  const cacheKey = `top_${limit}`;
  const cached = streamCache.get(cacheKey);

  if (cached && Date.now() - cached.timestamp < STREAM_CACHE_TTL) {
    return cached.data;
  }

  const client = getKickClient();
  if (!client) {
    console.error('[KickAPI] Client not configured');
    return [];
  }

  try {
    const streams = await client.livestreams.getLivestreams({
      limit: Math.min(limit, 100),
      sort: 'viewer_count',
    });

    if (!streams || !Array.isArray(streams)) {
      return [];
    }

    const transformed = streams.map(transformLivestream);

    streamCache.set(cacheKey, { data: transformed, timestamp: Date.now() });
    return transformed;
  } catch (error) {
    console.error('[KickAPI] Error fetching top streams:', error);
    return [];
  }
}

/**
 * Clear all caches (useful for testing or manual refresh)
 */
export function clearKickCache(): void {
  streamCache.clear();
  categoryCache.clear();
  console.log('[KickAPI] Cache cleared');
}

/**
 * Get cache statistics for monitoring
 */
export function getKickCacheStats(): { streamCacheSize: number; categoryCacheSize: number } {
  return {
    streamCacheSize: streamCache.size,
    categoryCacheSize: categoryCache.size,
  };
}
