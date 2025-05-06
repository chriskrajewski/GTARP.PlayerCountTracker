import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import "https://deno.land/std@0.168.0/dotenv/load.ts";
// Initialize Supabase client
const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_KEY = Deno.env.get("SUPABASE_ANON_KEY");
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
const TWITCH_CLIENT_ID = Deno.env.get("TWITCH_CLIENT_ID");
const TWITCH_CLIENT_SECRET = Deno.env.get("TWITCH_CLIENT_SECRET");
// Configuration for server IDs and keywords
const SEARCH_CONFIG = [
  {
    serverId: "o3re8y",
    keyword: "unscripted"
  },
  {
    serverId: "46pb7q",
    keyword: "onx"
  },
  {
    serverId: "3lamjz",
    keyword: "nopixel"
  },
  {
    serverId: "9mxzbe",
    keyword: "prodigy"
  }
];
async function getTwitchOAuthToken(clientId, clientSecret) {
  const url = "https://id.twitch.tv/oauth2/token";
  const params = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    grant_type: "client_credentials"
  });
  const response = await fetch(`${url}?${params}`, {
    method: "POST"
  });
  if (!response.ok) {
    throw new Error(`Failed to obtain Twitch OAuth token: ${response.statusText}`);
  }
  const data = await response.json();
  return data.access_token;
}
async function getGameId(clientId, token, gameName) {
  const url = "https://api.twitch.tv/helix/games";
  const headers = {
    "Client-ID": clientId,
    "Authorization": `Bearer ${token}`
  };
  const params = new URLSearchParams({
    name: gameName
  });
  const response = await fetch(`${url}?${params}`, {
    headers
  });
  if (!response.ok) {
    console.error(`Failed to fetch game ID for ${gameName}: ${response.statusText}`);
    return null;
  }
  const data = await response.json();
  const games = data.data || [];
  return games.length > 0 ? games[0].id : null;
}
async function getStreams(clientId, token, gameId, config) {
  const url = "https://api.twitch.tv/helix/streams";
  const headers = {
    "Client-ID": clientId,
    "Authorization": `Bearer ${token}`
  };
  const streams = [];
  let cursor = null;
  while(true){
    const params = new URLSearchParams({
      game_id: gameId,
      first: "100"
    });
    if (cursor) {
      params.set("after", cursor);
    }
    const response = await fetch(`${url}?${params}`, {
      headers
    });
    if (!response.ok) {
      console.error(`Failed to fetch streams: ${response.statusText}`);
      break;
    }
    const data = await response.json();
    for (const stream of data.data || []){
      if (stream.title.toLowerCase().includes(config.keyword.toLowerCase())) {
        streams.push({
          streamer_name: stream.user_name,
          stream_title: stream.title,
          viewer_count: stream.viewer_count,
          game_name: "Grand Theft Auto V",
          serverId: config.serverId
        });
      }
    }
    cursor = data.pagination?.cursor || null;
    if (!cursor) break;
    await new Promise((resolve)=>setTimeout(resolve, 500)); // Avoid rate limits
  }
  return streams;
}
async function logToSupabase(supabase, streams) {
  if (!streams.length) {
    console.log("No streams to log to Supabase");
    return;
  }
  for (const stream of streams){
    const { error } = await supabase.from("twitch_streams").insert({
      streamer_name: stream.streamer_name,
      stream_title: stream.stream_title,
      viewer_count: stream.viewer_count,
      game_name: stream.game_name,
      serverId: stream.serverId
    });
    if (error) {
      console.error(`Supabase error: ${error.message}`);
    }
  }
}
serve(async (req)=>{
  if (req.method !== "GET") {
    return new Response("Method Not Allowed", {
      status: 405
    });
  }
  try {
    // Validate environment variables
    if (!TWITCH_CLIENT_ID || !TWITCH_CLIENT_SECRET || !SUPABASE_URL || !SUPABASE_KEY) {
      throw new Error("Missing required environment variables");
    }
    // Get Twitch OAuth token
    const token = await getTwitchOAuthToken(TWITCH_CLIENT_ID, TWITCH_CLIENT_SECRET);
    // Get game ID for Grand Theft Auto V
    const gameId = await getGameId(TWITCH_CLIENT_ID, token, "Grand Theft Auto V");
    if (!gameId) {
      throw new Error("Could not find game ID for Grand Theft Auto V");
    }
    // Fetch streams for each serverId/keyword pair
    let allStreams = [];
    for (const config of SEARCH_CONFIG){
      const streams = await getStreams(TWITCH_CLIENT_ID, token, gameId, config);
      allStreams = allStreams.concat(streams);
    }
    // Log to Supabase
    await logToSupabase(supabase, allStreams);
    return new Response(`Successfully logged ${allStreams.length} streams`, {
      status: 200,
      headers: {
        "Content-Type": "text/plain"
      }
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`Error: ${errorMessage}`);
    return new Response(`Error: ${errorMessage}`, {
      status: 500,
      headers: {
        "Content-Type": "text/plain"
      }
    });
  }
});
