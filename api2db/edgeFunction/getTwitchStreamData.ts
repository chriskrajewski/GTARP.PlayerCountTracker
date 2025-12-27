import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { client as KickClient } from "https://esm.sh/@nekiro/kick-api";
import "https://deno.land/std@0.168.0/dotenv/load.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_KEY = Deno.env.get("SUPABASE_ANON_KEY");
const TWITCH_CLIENT_ID = Deno.env.get("TWITCH_CLIENT_ID");
const TWITCH_CLIENT_SECRET = Deno.env.get("TWITCH_CLIENT_SECRET");
const KICK_CLIENT_ID = Deno.env.get("KICK_CLIENT_ID");
const KICK_CLIENT_SECRET = Deno.env.get("KICK_CLIENT_SECRET");

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

/**
 * Stream search configuration interface matching main site
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
 * Twitch API stream interface
 */
interface TwitchApiStream {
  id: string;
  user_id: string;
  user_name: string;
  user_login: string;
  game_id: string;
  game_name: string;
  type: string;
  title: string;
  viewer_count: number;
  started_at: string;
  language: string;
  thumbnail_url: string;
  tag_ids: string[];
  tags: string[];
  is_mature: boolean;
}

/**
 * Kick API stream interface
 */
interface KickStreamData {
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

/**
 * Stream data to be logged to Supabase
 */
interface StreamLogData {
  streamer_name: string;
  stream_title: string;
  viewer_count: number;
  game_name: string;
  serverId: string;
}

/**
 * Create an AbortSignal that times out after specified milliseconds
 * Deno-compatible alternative to AbortSignal.timeout()
 */
function createTimeoutSignal(ms: number): AbortSignal {
  const controller = new AbortController();
  setTimeout(() => controller.abort(), ms);
  return controller.signal;
}

/**
 * Get Twitch OAuth token using body form data (matching main site)
 */
async function getTwitchToken(): Promise<string> {
  if (!TWITCH_CLIENT_ID || !TWITCH_CLIENT_SECRET) {
    throw new Error("Twitch credentials not configured");
  }

  try {
    const response = await fetch("https://id.twitch.tv/oauth2/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: `client_id=${TWITCH_CLIENT_ID}&client_secret=${TWITCH_CLIENT_SECRET}&grant_type=client_credentials`,
      signal: createTimeoutSignal(10000),
    });

    if (!response.ok) {
      throw new Error(`Failed to get Twitch token: ${response.status}`);
    }

    const data = await response.json();
    return data.access_token;
  } catch (error) {
    console.error("Error getting Twitch token:", error);
    throw error;
  }
}

/**
 * Get GTA V game ID from Twitch (matching main site)
 */
async function getGTAGameId(clientId: string, token: string): Promise<string | null> {
  try {
    const response = await fetch(
      `https://api.twitch.tv/helix/games?name=${encodeURIComponent("Grand Theft Auto V")}`,
      {
        headers: {
          "Client-ID": clientId,
          "Authorization": `Bearer ${token}`,
        },
        signal: createTimeoutSignal(10000),
      }
    );

    if (!response.ok) {
      console.error(`Failed to get GTA V game ID: ${response.status}`);
      return null;
    }

    const data = await response.json();
    return data.data?.[0]?.id || null;
  } catch (error) {
    console.error("Error getting GTA game ID:", error);
    return null;
  }
}

/**
 * Fetch all GTA V streams from Twitch (limited pagination to reduce API load)
 * Matches main site implementation: app/api/streams/[serverId]/route.ts
 */
async function fetchGTAVStreams(
  clientId: string,
  token: string,
  gameId: string,
  maxPages: number = 5
): Promise<TwitchApiStream[]> {
  const streams: TwitchApiStream[] = [];
  let cursor: string | null = null;
  let pageCount = 0;

  while (pageCount < maxPages) {
    const params = new URLSearchParams({
      game_id: gameId,
      first: "100",
    });
    if (cursor) params.set("after", cursor);

    try {
      const response = await fetch(
        `https://api.twitch.tv/helix/streams?${params}`,
        {
          headers: {
            "Client-ID": clientId,
            "Authorization": `Bearer ${token}`,
          },
          signal: createTimeoutSignal(15000),
        }
      );

      if (!response.ok) {
        console.error(`[Twitch ETL] Twitch API error: ${response.status}`);
        break;
      }

      const data = await response.json();
      const batch = Array.isArray(data.data) ? data.data : [];
      streams.push(...batch);

      cursor = data.pagination?.cursor || null;
      if (!cursor || batch.length === 0) break;
      pageCount++;
    } catch (error) {
      console.error("[Twitch ETL] Error fetching streams:", error);
      break;
    }
  }

  return streams;
}

/**
 * Load stream search configuration from Supabase for a specific platform
 * Matches main site implementation: lib/stream-config.ts
 */
async function getStreamSearchConfigMap(platform: 'twitch' | 'kick'): Promise<Map<string, StreamSearchConfig[]>> {
  const map = new Map<string, StreamSearchConfig[]>();

  try {
    const { data, error } = await supabase
      .from("stream_search_config")
      .select("*")
      .eq("is_active", true)
      .eq("platform", platform)
      .order("priority", { ascending: false });

    if (error) {
      console.error(`[Stream ETL] Supabase config error for ${platform}:`, error);
      return map;
    }

    if (!data || data.length === 0) {
      console.warn(`[Stream ETL] No active ${platform} config found in stream_search_config`);
      return map;
    }

    // Group configs by server_id
    for (const row of data as StreamSearchConfig[]) {
      const current = map.get(row.server_id) ?? [];
      current.push(row);
      map.set(row.server_id, current);
    }

    console.log(`[Stream ETL] Loaded ${platform} config for ${map.size} servers`);
  } catch (error) {
    console.error(`[Stream ETL] Error fetching ${platform} config:`, error);
  }

  return map;
}

/**
 * Filter Twitch streams by server configuration
 * Matches main site implementation: app/api/streams/[serverId]/route.ts
 */
function filterTwitchStreamsByConfig(
  streams: TwitchApiStream[],
  config: StreamSearchConfig[]
): TwitchApiStream[] {
  if (config.length === 0) {
    return [];
  }

  const titleKeywords: string[] = [];
  const categoryKeywords: string[] = [];
  const tagKeywords: string[] = [];

  for (const rule of config) {
    const keyword = (rule.search_keyword || "").trim().toLowerCase();
    if (!keyword) continue;

    switch (rule.search_type) {
      case "title":
        titleKeywords.push(keyword);
        break;
      case "category":
        categoryKeywords.push(keyword);
        break;
      case "tag":
        tagKeywords.push(keyword);
        break;
    }
  }

  const seen = new Set<string>();
  const matched: TwitchApiStream[] = [];

  for (const stream of streams) {
    const titleLower = (stream.title || "").toLowerCase();
    const gameLower = (stream.game_name || "").toLowerCase();
    const tagsLower = (stream.tags || []).map((t) => (t || "").toLowerCase());

    let isMatch = false;

    if (titleKeywords.length > 0 && titleKeywords.some((k) => titleLower.includes(k))) {
      isMatch = true;
    }

    if (!isMatch && categoryKeywords.length > 0 && categoryKeywords.some((k) => gameLower === k)) {
      isMatch = true;
    }

    if (!isMatch && tagKeywords.length > 0 && tagKeywords.some((k) => tagsLower.includes(k))) {
      isMatch = true;
    }

    if (!isMatch) continue;

    // Dedupe by streamer name
    const key = (stream.user_name || "").toLowerCase();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    matched.push(stream);
  }

  return matched;
}

/**
 * Convert Twitch API streams to database log format
 */
function convertStreamsToLogData(
  streams: TwitchApiStream[],
  serverId: string
): StreamLogData[] {
  return streams.map((stream) => ({
    streamer_name: stream.user_name,
    stream_title: stream.title,
    viewer_count: stream.viewer_count,
    game_name: stream.game_name || "Grand Theft Auto V",
    serverId: serverId,
  }));
}

/**
 * Log streams to Supabase in batches
 * Both Twitch and Kick streams are logged to the same table
 */
async function logToSupabase(streams: StreamLogData[]): Promise<number> {
  if (!streams.length) return 0;

  let logged = 0;
  const batchSize = 100;

  // Process in batches to avoid overwhelming Supabase
  for (let i = 0; i < streams.length; i += batchSize) {
    const batch = streams.slice(i, i + batchSize);
    try {
      const { error } = await supabase.from("twitch_streams").insert(batch);
      if (error) {
        console.error(`[Stream ETL] Supabase insert error (batch ${i}-${i + batch.length - 1}):`, error.message);
      } else {
        logged += batch.length;
      }
    } catch (error) {
      console.error(`[Stream ETL] Error inserting batch:`, error);
    }
  }

  return logged;
}

/**
 * Check if Kick API is configured
 */
function isKickApiConfigured(): boolean {
  return !!(KICK_CLIENT_ID && KICK_CLIENT_SECRET);
}

/**
 * Get or create the Kick API client
 */
function getKickClient(): InstanceType<typeof KickClient> | null {
  if (!isKickApiConfigured()) {
    return null;
  }

  try {
    return new KickClient({
      clientId: KICK_CLIENT_ID!,
      clientSecret: KICK_CLIENT_SECRET!,
      debug: false,
    });
  } catch (error) {
    console.error("[Kick ETL] Failed to initialize client:", error);
    return null;
  }
}

/**
 * Transform Kick API livestream response to our standard format
 */
function transformKickLivestream(stream: any): KickStreamData {
  return {
    channel_slug: stream.slug || '',
    user_name: stream.slug || '',
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
async function getKickCategoryIdByName(categoryName: string): Promise<number | null> {
  const client = getKickClient();
  if (!client) {
    return null;
  }

  try {
    const categories = await client.categories.getCategories({ q: categoryName });

    if (!categories || categories.length === 0) {
      return null;
    }

    const lowerName = categoryName.toLowerCase();
    const exactMatch = categories.find(
      (c: any) => c.name.toLowerCase() === lowerName
    );
    return exactMatch?.id || categories[0]?.id || null;
  } catch (error) {
    console.error(`[Kick ETL] Error fetching category "${categoryName}":`, error);
    return null;
  }
}

/**
 * Fetch livestreams by category ID from Kick API
 */
async function getKickStreamsByCategoryId(
  categoryId: number,
  limit: number = 100
): Promise<KickStreamData[]> {
  const client = getKickClient();
  if (!client) {
    return [];
  }

  try {
    const streams = await client.livestreams.getLivestreams({
      category_id: categoryId,
      limit: Math.min(limit, 100),
      sort: 'viewer_count',
    });

    if (!streams || !Array.isArray(streams)) {
      return [];
    }

    return streams.map(transformKickLivestream);
  } catch (error) {
    console.error(`[Kick ETL] Error fetching streams for category ${categoryId}:`, error);
    return [];
  }
}

/**
 * Fetch livestreams by category name/query from Kick API
 */
async function getKickStreamsByCategoryQuery(
  categoryQuery: string,
  limit: number = 100
): Promise<KickStreamData[]> {
  const categoryId = await getKickCategoryIdByName(categoryQuery);

  if (!categoryId) {
    return [];
  }

  return getKickStreamsByCategoryId(categoryId, limit);
}

/**
 * Get top streams from Kick (sorted by viewer count)
 */
async function getKickTopStreams(limit: number = 100): Promise<KickStreamData[]> {
  const client = getKickClient();
  if (!client) {
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

    return streams.map(transformKickLivestream);
  } catch (error) {
    console.error("[Kick ETL] Error fetching top streams:", error);
    return [];
  }
}

/**
 * Partition keywords into include and exclude lists
 * Matches main site implementation: app/api/streams/[serverId]/route.ts
 */
function partitionKeywords(keywords: string[]): { include: string[]; exclude: string[] } {
  const include: string[] = [];
  const exclude: string[] = [];
  for (const raw of keywords) {
    const k = (raw || "").trim().toLowerCase();
    if (!k) continue;
    if (k.startsWith("!") && k.length > 1) exclude.push(k.slice(1));
    else include.push(k);
  }
  return { include, exclude };
}

/**
 * Fetch Kick streams for a server based on configuration
 * Matches main site implementation: app/api/streams/[serverId]/route.ts
 */
async function fetchKickStreams(
  serverId: string,
  config: StreamSearchConfig[]
): Promise<KickStreamData[]> {
  if (!isKickApiConfigured() || config.length === 0) {
    return [];
  }

  const categoryRules = config.filter((c) => c.search_type === "category");
  const titleRules = config.filter((c) => c.search_type === "title");

  // Build candidate pool from categories or top streams
  let poolStreams: KickStreamData[] = [];
  if (categoryRules.length) {
    const poolSeen = new Set<string>();
    for (const rule of categoryRules) {
      const keyword = (rule.search_keyword || "").trim().toLowerCase();
      if (!keyword) continue;

      const candidates = await getKickStreamsByCategoryQuery(keyword, 100);
      for (const s of candidates) {
        const key = (s.channel_slug || s.user_name || "").toLowerCase();
        if (!key || poolSeen.has(key)) continue;
        poolSeen.add(key);
        poolStreams.push(s);
      }
    }
  } else {
    poolStreams = await getKickTopStreams(100);
  }

  const { include, exclude } = partitionKeywords(titleRules.map((r) => r.search_keyword));

  // If no include keywords, can't filter reliably
  if (include.length === 0) {
    return [];
  }

  // Filter by title keywords
  const seen = new Set<string>();
  const matched: KickStreamData[] = [];

  for (const s of poolStreams) {
    const title = (s.title || "").toLowerCase();
    if (!include.some((k) => title.includes(k))) continue;
    if (exclude.length && exclude.some((k) => title.includes(k))) continue;

    const key = (s.channel_slug || s.user_name || "").toLowerCase();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    matched.push(s);
  }

  return matched;
}

/**
 * Convert Kick API streams to database log format
 */
function convertKickStreamsToLogData(
  streams: KickStreamData[],
  serverId: string
): StreamLogData[] {
  return streams.map((stream) => ({
    streamer_name: stream.user_name || stream.channel_slug,
    stream_title: stream.title,
    viewer_count: stream.viewer_count,
    game_name: stream.category_name || "Unknown",
    serverId: serverId,
  }));
}

/**
 * Main edge function handler
 * Processes both Twitch and Kick streams for database history ETL
 */
serve(async (req) => {
  if (req.method !== "GET") {
    return new Response("Method Not Allowed", {
      status: 405,
      headers: {
        Allow: "GET",
      },
    });
  }

  try {
    let twitchLogged = 0;
    let kickLogged = 0;
    const results: string[] = [];

    // ============================================
    // PROCESS TWITCH STREAMS
    // ============================================
    if (TWITCH_CLIENT_ID && TWITCH_CLIENT_SECRET) {
      try {
        // 1) Get Twitch authentication token
        const token = await getTwitchToken();
        if (!token) {
          throw new Error("Failed to authenticate with Twitch");
        }

        // 2) Get GTA V game ID
        const gameId = await getGTAGameId(TWITCH_CLIENT_ID, token);
        if (!gameId) {
          throw new Error("Unable to find GTA V game ID");
        }

        // 3) Load Twitch stream search configuration from Supabase
        const twitchConfigMap = await getStreamSearchConfigMap("twitch");
        if (twitchConfigMap.size > 0) {
          // 4) Fetch all GTA V streams once (matching main site approach)
          console.log("[Stream ETL] Fetching all GTA V streams from Twitch...");
          const allTwitchStreams = await fetchGTAVStreams(TWITCH_CLIENT_ID, token, gameId);
          console.log(`[Stream ETL] Fetched ${allTwitchStreams.length} total Twitch streams`);

          // 5) Filter streams by server config and log to database
          const twitchServerIds = Array.from(twitchConfigMap.keys());

          for (const serverId of twitchServerIds) {
            const config = twitchConfigMap.get(serverId) || [];
            if (config.length === 0) continue;

            try {
              // Filter streams matching this server's config
              const matchedStreams = filterTwitchStreamsByConfig(allTwitchStreams, config);

              if (matchedStreams.length > 0) {
                // Convert to log format
                const logData = convertStreamsToLogData(matchedStreams, serverId);

                // Log to Supabase
                const logged = await logToSupabase(logData);
                twitchLogged += logged;

                console.log(`[Stream ETL] Twitch Server ${serverId}: ${matchedStreams.length} matched, ${logged} logged`);
              }
            } catch (error) {
              console.error(`[Stream ETL] Error processing Twitch server ${serverId}:`, error);
            }
          }
        } else {
          console.warn("[Stream ETL] No active Twitch config found");
        }
      } catch (err) {
        console.error("[Stream ETL] Twitch processing error:", err);
        results.push(`Twitch error: ${err.message}`);
      }
    } else {
      console.warn("[Stream ETL] Twitch credentials not configured");
    }

    // ============================================
    // PROCESS KICK STREAMS
    // ============================================
    if (isKickApiConfigured()) {
      try {
        // 1) Load Kick stream search configuration from Supabase
        const kickConfigMap = await getStreamSearchConfigMap("kick");
        if (kickConfigMap.size > 0) {
          const kickServerIds = Array.from(kickConfigMap.keys());

          // 2) Process each server's Kick streams
          for (const serverId of kickServerIds) {
            const config = kickConfigMap.get(serverId) || [];
            if (config.length === 0) continue;

            try {
              // Fetch Kick streams for this server
              const matchedKickStreams = await fetchKickStreams(serverId, config);

              if (matchedKickStreams.length > 0) {
                // Convert to log format
                const logData = convertKickStreamsToLogData(matchedKickStreams, serverId);

                // Log to Supabase
                const logged = await logToSupabase(logData);
                kickLogged += logged;

                console.log(`[Stream ETL] Kick Server ${serverId}: ${matchedKickStreams.length} matched, ${logged} logged`);
              }
            } catch (error) {
              console.error(`[Stream ETL] Error processing Kick server ${serverId}:`, error);
            }
          }
        } else {
          console.warn("[Stream ETL] No active Kick config found");
        }
      } catch (err) {
        console.error("[Stream ETL] Kick processing error:", err);
        results.push(`Kick error: ${err.message}`);
      }
    } else {
      console.warn("[Stream ETL] Kick API not configured");
    }

    // ============================================
    // RETURN RESULTS
    // ============================================
    const totalLogged = twitchLogged + kickLogged;
    const summary = `Logged ${totalLogged} streams (Twitch: ${twitchLogged}, Kick: ${kickLogged})`;
    results.push(summary);

    return new Response(results.join("\n"), {
      status: 200,
      headers: {
        "Content-Type": "text/plain",
      },
    });
  } catch (err) {
    console.error("[Stream ETL] Edge function error:", err);
    return new Response(`Error: ${err.message}`, {
      status: 500,
      headers: {
        "Content-Type": "text/plain",
      },
    });
  }
});
