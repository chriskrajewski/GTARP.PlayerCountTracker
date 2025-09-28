import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import "https://deno.land/std@0.168.0/dotenv/load.ts";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_KEY = Deno.env.get("SUPABASE_ANON_KEY");
const TWITCH_CLIENT_ID = Deno.env.get("TWITCH_CLIENT_ID");
const TWITCH_CLIENT_SECRET = Deno.env.get("TWITCH_CLIENT_SECRET");
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
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
  },
  {
    serverId: "l7o9o4",
    keyword: "district 10"
  },
  {
    serverId: "7pkv5d",
    keyword: "SmileRP"
  },
  {
    serverId: "k8px4v",
    keyword: "Time2RP"
  },
  {
    serverId: "vqkmaq",
    keyword: "unscripted public"
  },
  {
    serverId: "wmev57",
    keyword: "newdayrp"
  },
  {
    serverId: "77qvev",
    keyword: "rebirth"
  },
  {
    serverId: "r8q73g",
    keyword: "nopixel public"
  },
  {
    serverId: "775kda",
    keyword: "prodigy public"
  },
  {
    serverId: "68oab8",
    keyword: "echorp"
  },
  {
    serverId: "ak44p9",
    keyword: "free2rp"
  }
];
const BASE_API_URL = "https://servers-frontend.fivem.net/api/servers/single/";
// small sleep helper
function sleep(ms) {
  return new Promise((resolve)=>setTimeout(resolve, ms));
}
async function getTwitchOAuthToken(clientId, clientSecret) {
  const url = "https://id.twitch.tv/oauth2/token";
  const params = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    grant_type: "client_credentials"
  });
  const res = await fetch(`${url}?${params}`, {
    method: "POST"
  });
  if (!res.ok) throw new Error(`Twitch token error: ${res.statusText}`);
  const { access_token } = await res.json();
  return access_token;
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
  const res = await fetch(`${url}?${params}`, {
    headers
  });
  if (!res.ok) {
    console.warn(`Could not fetch game ID for ${gameName}: ${res.statusText}`);
    return null;
  }
  const { data } = await res.json();
  return Array.isArray(data) && data[0]?.id ? data[0].id : null;
}
async function getStreams(clientId, token, gameId, { serverId, keyword }) {
  const headers = {
    "Client-ID": clientId,
    "Authorization": `Bearer ${token}`
  };
  const lowerKeyword = keyword.toLowerCase().trim();
  if (!lowerKeyword) {
    console.warn(`Empty keyword for server ${serverId}, skipping.`);
    return [];
  }
  let cursor = null;
  const found = [];
  try {
    while(true){
      const params = new URLSearchParams({
        game_id: gameId,
        first: "100"
      });
      if (cursor) params.set("after", cursor);
      const res = await fetch(`https://api.twitch.tv/helix/streams?${params}`, {
        headers
      });
      if (!res.ok) {
        console.warn(`Twitch streams fetch failed for ${serverId}: ${res.statusText}`);
        break;
      }
      const json = await res.json();
      const batch = Array.isArray(json.data) ? json.data : [];
      for (const s of batch){
        const title = (s.title || "").toLowerCase();
        if (title.includes(lowerKeyword)) {
          found.push({
            streamer_name: s.user_name,
            stream_title: s.title,
            viewer_count: s.viewer_count,
            game_name: "Grand Theft Auto V",
            serverId
          });
        }
      }
      cursor = json.pagination?.cursor || null;
      if (!cursor) break;
      // throttle a bit
      await sleep(500);
    }
  } catch (err) {
    console.error(`Error scanning streams for ${serverId}:`, err);
  }
  console.log(`→ [${serverId}] found ${found.length} matching streams`);
  return found;
}
async function logToSupabase(supabase, streams) {
  if (!streams.length) return;
  for (const row of streams){
    const { error } = await supabase.from("twitch_streams").insert(row);
    if (error) console.error("Supabase insert error:", error.message);
  }
}
serve(async (req)=>{
  if (req.method !== "GET") {
    return new Response("Method Not Allowed", {
      status: 405,
      headers: {
        Allow: "GET"
      }
    });
  }
  try {
    // 1) Get token + game ID
    const token = await getTwitchOAuthToken(TWITCH_CLIENT_ID, TWITCH_CLIENT_SECRET);
    const gameId = await getGameId(TWITCH_CLIENT_ID, token, "Grand Theft Auto V");
    if (!gameId) throw new Error("Unable to find GTA V game ID");
    // 2) For each config, safely fetch & log
    let totalLogged = 0;
    for (const cfg of SEARCH_CONFIG){
      try {
        const streams = await getStreams(TWITCH_CLIENT_ID, token, gameId, cfg);
        await logToSupabase(supabase, streams);
        totalLogged += streams.length;
      } catch (_e) {
      // already logged inside getStreams/logToSupabase
      }
      await sleep(1000);
    }
    return new Response(`Logged ${totalLogged} streams`, {
      status: 200,
      headers: {
        "Content-Type": "text/plain"
      }
    });
  } catch (err) {
    console.error("Edge function error:", err);
    return new Response(`Error: ${err.message}`, {
      status: 500,
      headers: {
        "Content-Type": "text/plain"
      }
    });
  }
});
