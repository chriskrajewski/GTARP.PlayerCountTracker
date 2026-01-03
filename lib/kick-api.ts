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
 * Fetch livestreams by category ID with pagination support
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
    const allStreams: KickStreamData[] = [];
    let offset = 0;
    const pageSize = 100; // API max per request
    const maxRequests = Math.ceil(limit / pageSize);

    for (let i = 0; i < maxRequests; i++) {
      const streams = await client.livestreams.getLivestreams({
        category_id: categoryId,
        limit: Math.min(pageSize, limit - offset),
        offset: offset,
        sort: 'viewer_count',
      });

      if (!streams || !Array.isArray(streams) || streams.length === 0) {
        break;
      }

      const transformed = streams.map(transformLivestream);
      allStreams.push(...transformed);
      offset += streams.length;

      // Stop if we've reached the requested limit
      if (allStreams.length >= limit) {
        break;
      }
    }

    // Trim to exact limit if needed
    const result = allStreams.slice(0, limit);

    streamCache.set(cacheKey, { data: result, timestamp: Date.now() });
    return result;
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
 * Get top streams from Kick (sorted by viewer count) with pagination support
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
    const allStreams: KickStreamData[] = [];
    let offset = 0;
    const pageSize = 100; // API max per request
    const maxRequests = Math.ceil(limit / pageSize);

    for (let i = 0; i < maxRequests; i++) {
      const streams = await client.livestreams.getLivestreams({
        limit: Math.min(pageSize, limit - offset),
        offset: offset,
        sort: 'viewer_count',
      });

      if (!streams || !Array.isArray(streams) || streams.length === 0) {
        break;
      }

      const transformed = streams.map(transformLivestream);
      allStreams.push(...transformed);
      offset += streams.length;

      // Stop if we've reached the requested limit
      if (allStreams.length >= limit) {
        break;
      }
    }

    // Trim to exact limit if needed
    const result = allStreams.slice(0, limit);

    streamCache.set(cacheKey, { data: result, timestamp: Date.now() });
    return result;
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
  clipCache.clear();
  console.log('[KickAPI] All caches cleared');
}

/**
 * Get cache statistics for monitoring
 */
export function getKickCacheStats(): { streamCacheSize: number; categoryCacheSize: number; clipCacheSize: number } {
  return {
    streamCacheSize: streamCache.size,
    categoryCacheSize: categoryCache.size,
    clipCacheSize: clipCache.size,
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// CLIP DATA STRUCTURES AND CACHING
// ═══════════════════════════════════════════════════════════════════════════

// Kick API endpoints for direct HTTP requests (clips not supported by @nekiro/kick-api)
const KICK_OAUTH_URL = "https://id.kick.com/oauth/token";
const KICK_API_BASE = "https://api.kick.com";

/**
 * Kick clip data structure
 */
export interface KickClipData {
  clip_id: string;
  channel_slug: string;
  streamer_username: string;
  title: string;
  view_count: number;
  duration_seconds: number;
  thumbnail_url: string;
  clip_url: string;
  created_at: string;
  category_name: string;
}

/**
 * Kick Clip API response structure (v2 API)
 */
interface KickClipApiResponse {
  id: string;
  title: string;
  clip_url: string;
  thumbnail_url: string;
  views: number;
  view_count: number;
  duration: number;
  created_at: string;
  video_url: string;
  category?: {
    id: number;
    name: string;
    slug: string;
  };
  creator?: {
    id: number;
    username: string;
    slug: string;
  };
  channel?: {
    id: number;
    username: string;
    slug: string;
  };
}

const clipCache = new Map<string, CacheEntry<KickClipData[]>>();
const CLIP_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

// OAuth token cache for clips API
let clipsOAuthToken: { token: string; expiresAt: number } | null = null;

/**
 * Get OAuth access token for clips API using client credentials flow
 * Per Kick docs: pass client_id and client_secret as form body parameters
 */
async function getClipsAccessToken(): Promise<string | null> {
  // Check cache first
  if (clipsOAuthToken && clipsOAuthToken.expiresAt > Date.now() + 60000) {
    return clipsOAuthToken.token;
  }

  if (!process.env.KICK_CLIENT_ID || !process.env.KICK_CLIENT_SECRET) {
    console.error('[KickAPI] Kick credentials not configured for clips');
    return null;
  }

  try {
    const response = await fetch(KICK_OAUTH_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        grant_type: "client_credentials",
        client_id: process.env.KICK_CLIENT_ID,
        client_secret: process.env.KICK_CLIENT_SECRET,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[KickAPI] OAuth error for clips: ${response.status} - ${errorText}`);
      return null;
    }

    const data = await response.json();
    
    // Cache the token
    clipsOAuthToken = {
      token: data.access_token,
      expiresAt: Date.now() + (data.expires_in * 1000),
    };

    return data.access_token;
  } catch (error) {
    console.error("[KickAPI] Failed to get OAuth token for clips:", error);
    return null;
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// CLIP API FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Fetch clips for a specific channel using direct HTTP requests
 * The @nekiro/kick-api package does NOT support clips, so we use direct API calls
 * @param channelSlug - The Kick channel slug (username)
 * @param limit - Maximum number of clips to fetch (default 50)
 */
export async function getKickClipsForChannel(
  channelSlug: string,
  limit: number = 50
): Promise<KickClipData[]> {
  const cacheKey = `channel_clips_${channelSlug}_${limit}`;
  const cached = clipCache.get(cacheKey);

  if (cached && Date.now() - cached.timestamp < CLIP_CACHE_TTL) {
    return cached.data;
  }

  // Get OAuth token for clips API
  const accessToken = await getClipsAccessToken();
  if (!accessToken) {
    console.error('[KickAPI] Could not get access token for clips');
    return [];
  }

  try {
    const allClips: KickClipApiResponse[] = [];
    
    // Try multiple possible endpoints
    const endpoints = [
      `${KICK_API_BASE}/public/v1/channels/${channelSlug}/clips`,
      `${KICK_API_BASE}/v2/channels/${channelSlug}/clips`,
      `${KICK_API_BASE}/v1/channels/${channelSlug}/clips`,
    ];

    for (const baseUrl of endpoints) {
      try {
        const url = new URL(baseUrl);
        url.searchParams.set("limit", String(Math.min(limit, 50)));

        const response = await fetch(url.toString(), {
          method: "GET",
          headers: {
            "Authorization": `Bearer ${accessToken}`,
            "Accept": "application/json",
          },
        });

        if (!response.ok) {
          if (response.status === 404) {
            continue; // Try next endpoint
          }
          console.error(`[KickAPI] Clips API error for ${channelSlug}: ${response.status}`);
          continue;
        }

        const data = await response.json();
        
        // Handle different response formats
        let clips: KickClipApiResponse[] = [];
        if (Array.isArray(data)) {
          clips = data;
        } else if (data.clips && Array.isArray(data.clips)) {
          clips = data.clips;
        } else if (data.data && Array.isArray(data.data)) {
          clips = data.data;
        }

        if (clips.length > 0) {
          allClips.push(...clips);
          break; // Found clips, don't try other endpoints
        }
      } catch {
        continue; // Try next endpoint
      }
    }

    const transformedClips = allClips.slice(0, limit).map((clip) => transformKickClip(clip, channelSlug));
    
    if (transformedClips.length > 0) {
      clipCache.set(cacheKey, { data: transformedClips, timestamp: Date.now() });
    }
    
    return transformedClips;
  } catch (error) {
    console.error(`[KickAPI] Error fetching clips for channel ${channelSlug}:`, error);
    return [];
  }
}

/**
 * Fetch clips by category ID
 * Note: Category-based clip fetching requires iterating through channels
 * @param categoryId - The Kick category ID
 * @param limit - Maximum number of clips to fetch (default 100)
 */
export async function getKickClipsByCategory(
  categoryId: number,
  limit: number = 100
): Promise<KickClipData[]> {
  // Category-based clip fetching would require fetching streams in category,
  // then fetching clips for each channel. Not currently implemented.
  console.warn(`[KickAPI] Category-based clip fetching (category ${categoryId}) is not yet implemented`);
  return [];
}

/**
 * Fetch clips by category name/query
 * Note: Category-based clip fetching requires iterating through channels
 */
export async function getKickClipsByCategoryQuery(
  categoryQuery: string,
  limit: number = 100
): Promise<KickClipData[]> {
  // Category-based clip fetching would require fetching streams in category,
  // then fetching clips for each channel. Not currently implemented.
  console.warn(`[KickAPI] Category-based clip fetching ("${categoryQuery}") is not yet implemented`);
  return [];
}

/**
 * Fetch top clips from Kick (sorted by view count)
 * Note: Global top clips require a different API endpoint
 * @param limit - Maximum number of clips to fetch (default 100)
 * @param timeRange - Time range: 'day', 'week', 'month', 'all' (default 'week')
 */
export async function getKickTopClips(
  limit: number = 100,
  timeRange: 'day' | 'week' | 'month' | 'all' = 'week'
): Promise<KickClipData[]> {
  // Global top clips would require a different API endpoint
  console.warn('[KickAPI] Global top clips fetching is not yet implemented');
  return [];
}

/**
 * Transform Kick API clip response to our standard format
 */
function transformKickClip(clip: KickClipApiResponse, channelSlugOverride?: string): KickClipData {
  const channelSlug = channelSlugOverride || clip.channel?.slug || clip.creator?.slug || '';
  const streamerName = clip.channel?.username || clip.creator?.username || channelSlug;

  return {
    clip_id: clip.id?.toString() || '',
    channel_slug: channelSlug,
    streamer_username: streamerName,
    title: clip.title || 'Untitled Clip',
    view_count: clip.view_count || clip.views || 0,
    duration_seconds: clip.duration || 0,
    thumbnail_url: clip.thumbnail_url || '',
    clip_url: clip.clip_url || clip.video_url || '',
    created_at: clip.created_at || new Date().toISOString(),
    category_name: clip.category?.name || '',
  };
}

/**
 * Clear clip cache
 */
export function clearKickClipCache(): void {
  clipCache.clear();
  clipsOAuthToken = null;
  console.log('[KickAPI] Clip cache cleared');
}
