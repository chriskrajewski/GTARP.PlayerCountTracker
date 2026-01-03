import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import "https://deno.land/std@0.168.0/dotenv/load.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_KEY = Deno.env.get("SUPABASE_ANON_KEY");
const KICK_CLIENT_ID = Deno.env.get("KICK_CLIENT_ID");
const KICK_CLIENT_SECRET = Deno.env.get("KICK_CLIENT_SECRET");

const supabase = createClient(SUPABASE_URL!, SUPABASE_KEY!);

// Kick API endpoints
const KICK_OAUTH_URL = "https://id.kick.com/oauth/token";
const KICK_API_BASE = "https://api.kick.com";

/**
 * Stream search configuration interface
 */
interface StreamSearchConfig {
  id: string;
  server_id: string;
  platform: 'twitch' | 'kick';
  search_keyword: string;
  search_type: 'title' | 'category' | 'tag';
  is_active: boolean;
  priority: number;
  created_at: string;
  updated_at: string;
}

/**
 * Kick Clip from API v2
 */
interface KickClipApiResponse {
  id: string;
  livestream_id: string;
  category_id: string;
  channel_id: number;
  user_id: number;
  title: string;
  clip_url: string;
  thumbnail_url: string;
  privacy: string;
  likes: number;
  liked: boolean;
  views: number;
  duration: number;
  started_at: string;
  created_at: string;
  vod_starts_at: number;
  is_mature: boolean;
  video_url: string;
  view_count: number;
  likes_count: number;
  category?: {
    id: number;
    name: string;
    slug: string;
    parent_category?: string;
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
    profile_picture?: string;
  };
}

/**
 * Kick Clips API response structure
 */
interface KickClipsResponse {
  clips: KickClipApiResponse[];
  nextCursor?: string;
}

/**
 * Clip record to be inserted into database
 */
interface KickClipRecord {
  clip_id: string;
  streamer_username: string;
  clip_title: string;
  view_count: number;
  duration_seconds: number;
  thumbnail_url: string;
  clip_url: string;
  serverId: string;
  kick_created_at: string;
  is_valid: boolean;
  channel_slug: string;
  category_name: string | null;
}

/**
 * OAuth token response
 */
interface OAuthTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  scope?: string;
}

// Token cache
let cachedToken: { token: string; expiresAt: number } | null = null;

/**
 * Check if Kick API credentials are configured
 */
function isKickApiConfigured(): boolean {
  return !!(KICK_CLIENT_ID && KICK_CLIENT_SECRET);
}

/**
 * Get OAuth access token using client credentials flow
 * Per Kick docs: pass client_id and client_secret as form body parameters
 */
async function getAccessToken(): Promise<string | null> {
  // Check cache first
  if (cachedToken && cachedToken.expiresAt > Date.now() + 60000) {
    return cachedToken.token;
  }

  try {
    const response = await fetch(KICK_OAUTH_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        grant_type: "client_credentials",
        client_id: KICK_CLIENT_ID!,
        client_secret: KICK_CLIENT_SECRET!,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[Kick Clips ETL] OAuth error: ${response.status} - ${errorText}`);
      return null;
    }

    const data: OAuthTokenResponse = await response.json();
    
    // Cache the token
    cachedToken = {
      token: data.access_token,
      expiresAt: Date.now() + (data.expires_in * 1000),
    };

    console.log("[Kick Clips ETL] OAuth token obtained successfully");
    return data.access_token;
  } catch (error) {
    console.error("[Kick Clips ETL] Failed to get OAuth token:", error);
    return null;
  }
}

/**
 * Transform Kick API clip response to database record
 */
function transformClipToRecord(clip: KickClipApiResponse, channelSlug: string, serverId: string): KickClipRecord {
  const streamerName = clip.channel?.username || clip.creator?.username || channelSlug;

  return {
    clip_id: clip.id,
    channel_slug: clip.channel?.slug || channelSlug,
    streamer_username: streamerName.toLowerCase(),
    clip_title: clip.title || 'Untitled Clip',
    view_count: clip.view_count || clip.views || 0,
    duration_seconds: clip.duration || 0,
    thumbnail_url: clip.thumbnail_url || '',
    clip_url: clip.clip_url || clip.video_url || '',
    kick_created_at: clip.created_at || new Date().toISOString(),
    category_name: clip.category?.name || null,
    serverId: serverId,
    is_valid: true,
  };
}

/**
 * Load stream search configuration for Kick from Supabase
 */
async function getStreamSearchConfigMap(): Promise<Map<string, StreamSearchConfig[]>> {
  const map = new Map<string, StreamSearchConfig[]>();

  try {
    const { data, error } = await supabase
      .from("stream_search_config")
      .select("*")
      .eq("is_active", true)
      .eq("platform", "kick")
      .order("priority", { ascending: false });

    if (error) {
      console.error("[Kick Clips ETL] Supabase config error:", error);
      return map;
    }

    if (!data || data.length === 0) {
      console.warn("[Kick Clips ETL] No active Kick config found");
      return map;
    }

    // Group configs by server_id
    for (const row of data as StreamSearchConfig[]) {
      const current = map.get(row.server_id) ?? [];
      current.push(row);
      map.set(row.server_id, current);
    }

    console.log(`[Kick Clips ETL] Loaded config for ${map.size} servers`);
  } catch (error) {
    console.error("[Kick Clips ETL] Error fetching config:", error);
  }

  return map;
}

/**
 * Get all Kick streamers for a server from history table
 */
async function getStreamersForServer(serverId: string): Promise<string[]> {
  try {
    const { data, error } = await supabase
      .from("streamer_server_history")
      .select("streamer_username")
      .eq("serverId", serverId)
      .eq("platform", "kick")
      .order("last_seen", { ascending: false });

    if (error) {
      console.error(`[Kick Clips ETL] Error fetching streamers for ${serverId}:`, error);
      return [];
    }

    // Get unique streamer usernames
    const streamers = new Set<string>();
    if (data) {
      for (const row of data) {
        if (row.streamer_username) {
          streamers.add(row.streamer_username);
        }
      }
    }

    return Array.from(streamers);
  } catch (error) {
    console.error(`[Kick Clips ETL] Exception fetching streamers:`, error);
    return [];
  }
}

/**
 * Generate a random user agent string
 */
function getRandomUserAgent(): string {
  const userAgents = [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Safari/605.1.15",
  ];
  return userAgents[Math.floor(Math.random() * userAgents.length)];
}

/**
 * Get headers matching the KickApi Python library format
 * Reference: https://github.com/Enmn/KickApi/blob/main/kickapi/kickapi.py
 */
function getKickApiHeaders(): Record<string, string> {
  return {
    "Accept": "application/json",
    "Alt-Used": "kick.com",
    "Priority": "u=0, i",
    "Connection": "keep-alive",
    "User-Agent": getRandomUserAgent(),
  };
}

/**
 * Fetch clips for a specific Kick channel
 * Based on KickApi Python library: https://github.com/Enmn/KickApi
 * Note: kick.com uses Cloudflare protection, so requests may be blocked
 */
async function fetchClipsForChannel(
  channelSlug: string,
  _accessToken: string, // OAuth token may not be needed for these endpoints
  maxClips: number = 50
): Promise<KickClipApiResponse[]> {
  const allClips: KickClipApiResponse[] = [];
  const headers = getKickApiHeaders();
  
  try {
    // Try endpoints based on KickApi Python library patterns
    // The channel endpoint returns clips as part of channel data
    const endpoints = [
      // Channel endpoint that includes clips (from Python KickApi)
      `https://kick.com/api/v1/channels/${channelSlug}`,
      // Direct clips endpoint variations
      `https://kick.com/api/v2/channels/${channelSlug}/clips`,
      `https://kick.com/api/v1/channels/${channelSlug}/clips`,
    ];

    for (const baseUrl of endpoints) {
      try {
        const url = baseUrl.includes('/clips') 
          ? `${baseUrl}?limit=${maxClips}`
          : baseUrl;

        console.log(`[Kick Clips ETL] Trying: ${url}`);

        const response = await fetch(url, {
          method: "GET",
          headers: headers,
        });

        console.log(`[Kick Clips ETL] ${channelSlug} response: ${response.status}`);

        if (!response.ok) {
          if (response.status === 403) {
            console.warn(`[Kick Clips ETL] Cloudflare blocked request for ${channelSlug}`);
          }
          continue;
        }

        const data = await response.json();
        const keys = typeof data === 'object' && data !== null ? Object.keys(data).slice(0, 10).join(',') : 'N/A';
        console.log(`[Kick Clips ETL] ${channelSlug} response keys: ${keys}`);
        
        // Handle different response formats
        let clips: KickClipApiResponse[] = [];

        // Check if this is a channel response with clips
        if (data.clips && Array.isArray(data.clips)) {
          clips = data.clips;
        } else if (data.recent_clips && Array.isArray(data.recent_clips)) {
          clips = data.recent_clips;
        } else if (Array.isArray(data)) {
          clips = data;
        } else if (data.data && Array.isArray(data.data)) {
          clips = data.data;
        } else if (data.clip) {
          // Single clip response format from KickApi
          clips = [data.clip];
        }

        if (clips.length > 0) {
          console.log(`[Kick Clips ETL] Found ${clips.length} clips for ${channelSlug} from ${baseUrl}`);
          allClips.push(...clips);
          break; // Found clips, stop trying endpoints
        } else {
          console.log(`[Kick Clips ETL] No clips in response for ${channelSlug} from ${baseUrl}`);
        }
      } catch (endpointError) {
        const errMsg = endpointError instanceof Error ? endpointError.message : String(endpointError);
        console.error(`[Kick Clips ETL] Endpoint error for ${channelSlug}: ${errMsg}`);
        continue;
      }
    }

    return allClips.slice(0, maxClips);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`[Kick Clips ETL] Error fetching clips for ${channelSlug}: ${errorMessage}`);
    return [];
  }
}

/**
 * Insert clips into database with deduplication
 */
async function insertClips(clips: KickClipRecord[]): Promise<number> {
  if (!clips.length) return 0;

  let inserted = 0;
  const batchSize = 100;

  // Process in batches
  for (let i = 0; i < clips.length; i += batchSize) {
    const batch = clips.slice(i, i + batchSize);
    try {
      const { error } = await supabase
        .from("kick_clips")
        .upsert(batch, {
          onConflict: "clip_id",
          ignoreDuplicates: true
        });

      if (error) {
        console.error(`[Kick Clips ETL] Supabase insert error (batch ${i}-${i + batch.length - 1}):`, error.message);
      } else {
        inserted += batch.length;
      }
    } catch (error) {
      console.error(`[Kick Clips ETL] Error inserting batch:`, error);
    }
  }

  return inserted;
}

/**
 * Process a single streamer's clips with category filtering
 */
async function processStreamerClips(
  streamerUsername: string,
  accessToken: string,
  categoryKeywords: string[],
  serverId: string
): Promise<{ clips: KickClipRecord[]; totalFound: number; matched: number }> {
  try {
    const clips = await fetchClipsForChannel(streamerUsername, accessToken);

    if (clips.length === 0) {
      return { clips: [], totalFound: 0, matched: 0 };
    }

    // Filter clips by category if we have category keywords configured
    let filteredClips = clips;
    if (categoryKeywords.length > 0) {
      filteredClips = clips.filter(clip => {
        const clipCategory = (clip.category?.name || '').toLowerCase();
        const clipCategorySlug = (clip.category?.slug || '').toLowerCase();
        const clipParentCategory = (clip.category?.parent_category || '').toLowerCase();
        
        return categoryKeywords.some(keyword => 
          clipCategory.includes(keyword) || 
          clipCategorySlug.includes(keyword) ||
          clipParentCategory.includes(keyword) ||
          keyword.includes(clipCategory) ||
          keyword.includes(clipCategorySlug)
        );
      });
    }

    const clipRecords = filteredClips.map(clip => 
      transformClipToRecord(clip, streamerUsername, serverId)
    );

    return { 
      clips: clipRecords, 
      totalFound: clips.length, 
      matched: filteredClips.length 
    };
  } catch (error) {
    console.error(`[Kick Clips ETL] Error processing ${streamerUsername}:`, error);
    return { clips: [], totalFound: 0, matched: 0 };
  }
}

/**
 * Main edge function handler
 * Supports query parameters:
 * - offset: Starting index for streamers (default 0)
 * - limit: Max streamers to process per run (default 15)
 * - serverId: Optional specific server to process
 */
serve(async (req) => {
  if (req.method !== "GET") {
    return new Response("Method Not Allowed", {
      status: 405,
      headers: { Allow: "GET" },
    });
  }

  try {
    // Parse query parameters
    const url = new URL(req.url);
    const offset = parseInt(url.searchParams.get("offset") || "0", 10);
    const limit = parseInt(url.searchParams.get("limit") || "15", 10);
    const targetServerId = url.searchParams.get("serverId");

    console.log(`[Kick Clips ETL] Starting with offset=${offset}, limit=${limit}, serverId=${targetServerId || 'all'}`);

    if (!isKickApiConfigured()) {
      console.warn("[Kick Clips ETL] Kick credentials not configured");
      return new Response(JSON.stringify({ error: "Kick credentials not configured" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Get OAuth access token
    console.log("[Kick Clips ETL] Obtaining OAuth access token...");
    const accessToken = await getAccessToken();
    if (!accessToken) {
      throw new Error("Failed to obtain OAuth access token");
    }

    // Load stream search configuration
    console.log("[Kick Clips ETL] Loading stream search config...");
    const configMap = await getStreamSearchConfigMap();

    if (configMap.size === 0) {
      console.warn("[Kick Clips ETL] No stream search config found for Kick");
      return new Response(JSON.stringify({ error: "No Kick configuration found" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    let totalClipsFetched = 0;
    let totalClipsInserted = 0;
    let totalStreamersProcessed = 0;
    let totalStreamersRemaining = 0;

    // Process each server (or just the target server)
    const serverIds = targetServerId 
      ? [targetServerId] 
      : Array.from(configMap.keys());
    
    console.log(`[Kick Clips ETL] Processing ${serverIds.length} servers`);

    for (const serverId of serverIds) {
      const config = configMap.get(serverId) || [];
      if (config.length === 0) continue;

      try {
        // Get Kick streamers that have played on this server
        const allStreamers = await getStreamersForServer(serverId);
        if (allStreamers.length === 0) {
          console.log(`[Kick Clips ETL] No Kick streamer history for ${serverId}, skipping`);
          continue;
        }

        // Apply pagination
        const streamersToProcess = allStreamers.slice(offset, offset + limit);
        const remaining = Math.max(0, allStreamers.length - offset - limit);
        totalStreamersRemaining += remaining;
        
        console.log(`[Kick Clips ETL] Server ${serverId}: processing ${streamersToProcess.length} streamers (${offset}-${offset + streamersToProcess.length} of ${allStreamers.length}, ${remaining} remaining)`);

        if (streamersToProcess.length === 0) {
          continue;
        }

        // Get the category keywords to filter by from server config
        const categoryKeywords = config
          .filter(c => c.search_type === 'category')
          .map(c => c.search_keyword.toLowerCase());
        
        console.log(`[Kick Clips ETL] Server ${serverId} category filters: ${categoryKeywords.join(', ') || 'none'}`);

        // Process streamers in parallel (batches of 5 for rate limiting)
        const PARALLEL_BATCH_SIZE = 5;
        const allClipsToInsert: KickClipRecord[] = [];

        for (let i = 0; i < streamersToProcess.length; i += PARALLEL_BATCH_SIZE) {
          const batch = streamersToProcess.slice(i, i + PARALLEL_BATCH_SIZE);
          
          const results = await Promise.all(
            batch.map(streamer => 
              processStreamerClips(streamer, accessToken, categoryKeywords, serverId)
            )
          );

          for (let j = 0; j < results.length; j++) {
            const result = results[j];
            const streamer = batch[j];
            
            if (result.totalFound > 0) {
              console.log(`[Kick Clips ETL] ${streamer}: ${result.matched}/${result.totalFound} clips matched`);
            }
            
            totalClipsFetched += result.matched;
            allClipsToInsert.push(...result.clips);
          }

          totalStreamersProcessed += batch.length;
        }

        // Insert all matched clips for this server
        if (allClipsToInsert.length > 0) {
          const inserted = await insertClips(allClipsToInsert);
          totalClipsInserted += inserted;
          console.log(`[Kick Clips ETL] Server ${serverId}: inserted ${inserted} clips`);
        }
      } catch (error) {
        console.error(`[Kick Clips ETL] Error processing server ${serverId}:`, error);
      }
    }

    const response = {
      success: true,
      streamersProcessed: totalStreamersProcessed,
      streamersRemaining: totalStreamersRemaining,
      clipsFound: totalClipsFetched,
      clipsInserted: totalClipsInserted,
      nextOffset: totalStreamersRemaining > 0 ? offset + limit : null,
      message: `Processed ${totalStreamersProcessed} streamers, found ${totalClipsFetched} clips, inserted ${totalClipsInserted}`,
    };

    console.log(`[Kick Clips ETL] Complete: ${JSON.stringify(response)}`);

    return new Response(JSON.stringify(response), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[Kick Clips ETL] Edge function error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});
