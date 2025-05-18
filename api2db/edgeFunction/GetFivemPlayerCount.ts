import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import "https://deno.land/std@0.168.0/dotenv/load.ts";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_KEY = Deno.env.get("SUPABASE_ANON_KEY");
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
// List of server IDs to query
const SERVER_IDS = [
  "o3re8y",
  "3lamjz",
  "9mxzbe",
  "46pb7q"
];
function sleep(ms) {
  return new Promise((resolve)=>setTimeout(resolve, ms));
}
const BASE_API_URL = "https://servers-frontend.fivem.net/api/servers/single/";
serve(async (req)=>{
  if (req.method !== "GET") {
    return new Response("Method Not Allowed", {
      status: 405,
      headers: {
        "Allow": "GET"
      }
    });
  }
  try {
    if (!SUPABASE_URL || !SUPABASE_KEY) {
      const errorMessage = "Missing required environment variables: SUPABASE_URL or SUPABASE_KEY";
      console.error(errorMessage);
      throw new Error(errorMessage);
    }
    const headers = {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
      "Accept": "application/json, text/plain, */*",
      "Accept-Language": "en-US,en;q=0.9",
      "Referer": "https://servers.fivem.net/",
      "Origin": "https://servers.fivem.net"
    };
    const timestamp = new Date().toISOString();
    const results = [];
    
    // Iterate through each server ID
    for (const server_id of SERVER_IDS){
      const API_URL = `${BASE_API_URL}${server_id}`;
      try {
        const response = await fetch(API_URL, {
          headers
        });
        if (!response.ok) {
          const errorMessage = `HTTP error for server ${server_id}: ${response.status}`;
          console.error(errorMessage);
          throw new Error(errorMessage);
        }
        const data = await response.json();
        const current_players = data?.Data?.selfReportedClients || 0;
        
        const record = {
          timestamp,
          player_count: current_players,
          server_id
        };
        const { error } = await supabase.from("player_counts").insert(record);
        if (error) {
          const errorMessage = `Supabase error for server ${server_id}: ${error.message}`;
          console.error(errorMessage);
          throw new Error(errorMessage);
        }
        
        results.push(`[${timestamp}] Server ${server_id}: Successfully saved player count: ${current_players}`);
      } catch (serverError) {
        const errorMessage = serverError instanceof Error ? serverError.message : String(serverError);
        console.error(`Server ${server_id}: Error: ${errorMessage}`);
        results.push(`[${timestamp}] Server ${server_id}: Error: ${errorMessage}`);
      }
      await sleep(5000);
    }
    
    return new Response(results.join("\n"), {
      status: 200,
      headers: {
        "Content-Type": "text/plain"
      }
    });
  } catch (error) {
    const timestamp = new Date().toISOString();
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`Unexpected error in Edge Function: ${errorMessage}`);
    return new Response(`[${timestamp}] Unexpected error: ${errorMessage}`, {
      status: 500,
      headers: {
        "Content-Type": "text/plain"
      }
    });
  }
});
