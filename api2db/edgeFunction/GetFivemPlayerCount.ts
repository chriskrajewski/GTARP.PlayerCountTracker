import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import "https://deno.land/std@0.168.0/dotenv/load.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_KEY = Deno.env.get("SUPABASE_ANON_KEY");
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

/**
 * Server configuration interface
 */
interface ServerConfig {
  server_id: string;
  server_name: string;
  order: number;
}
/**
 * Fetch active server IDs from the server_xref table
 * Falls back to an empty array if no servers are configured
 */
async function getActiveServerIds(): Promise<string[]> {
  try {
    const { data, error } = await supabase
      .from("server_xref")
      .select("server_id")
      .order("order", { ascending: true });

    if (error) {
      console.error(`[FiveM ETL] Supabase error fetching servers: ${error.message}`);
      return [];
    }

    if (!data || data.length === 0) {
      console.warn("[FiveM ETL] No servers configured in server_xref table");
      return [];
    }

    const serverIds = data
      .map((row: ServerConfig) => row.server_id)
      .filter((id: string | null) => id !== null && id.trim() !== "");

    console.log(`[FiveM ETL] Loaded ${serverIds.length} active servers from database`);
    return serverIds;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`[FiveM ETL] Error fetching server IDs: ${errorMessage}`);
    return [];
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
const BASE_API_URL = "https://servers-frontend.fivem.net/api/servers/single/";

/**
 * Normalize resources array by removing duplicates and sorting
 */
function normalizeResources(resources: unknown[]): string[] {
  if (!Array.isArray(resources)) return [];
  const unique = new Set<string>();
  for (const entry of resources) {
    if (typeof entry === "string" && entry.trim()) {
      unique.add(entry.trim());
    } else if (entry && typeof entry === "object") {
      try {
        unique.add(JSON.stringify(entry));
      } catch (_err) {
        // ignore serialization issues for non-JSON-safe entries
      }
    }
  }
  return Array.from(unique).sort((a, b) => a.localeCompare(b));
}

/**
 * Calculate differences between two resource arrays
 */
function diffResources(
  previous: string[],
  current: string[]
): { added: string[]; removed: string[] } {
  const prevSet = new Set(previous);
  const currSet = new Set(current);
  const added: string[] = [];
  const removed: string[] = [];
  for (const value of currSet) {
    if (!prevSet.has(value)) added.push(value);
  }
  for (const value of prevSet) {
    if (!currSet.has(value)) removed.push(value);
  }
  return {
    added: added.sort((a, b) => a.localeCompare(b)),
    removed: removed.sort((a, b) => a.localeCompare(b))
  };
}

/**
 * Check if resources have changed between two snapshots
 */
function resourcesChanged(previous: string[], current: string[]): boolean {
  if (previous.length !== current.length) return true;
  for (let i = 0; i < previous.length; i++) {
    if (previous[i] !== current[i]) return true;
  }
  return false;
}

/**
 * Main edge function handler
 * Fetches FiveM server player counts and resource data from configured servers
 */
serve(async (req) => {
  console.log(`[FiveM ETL] Received ${req.method} request to fetch FiveM server player counts`);
  if (req.method !== "GET") {
    console.warn(`[FiveM ETL] Invalid request method: ${req.method}. Only GET is allowed.`);
    return new Response("Method Not Allowed", {
      status: 405,
      headers: {
        "Allow": "GET"
      }
    });
  }
  try {
    console.log("[FiveM ETL] Validating environment variables");
    if (!SUPABASE_URL || !SUPABASE_KEY) {
      const errorMessage = "Missing required environment variables: SUPABASE_URL or SUPABASE_KEY";
      console.error(`[FiveM ETL] ${errorMessage}`);
      throw new Error(errorMessage);
    }

    // Fetch active server IDs from database
    const SERVER_IDS = await getActiveServerIds();
    if (SERVER_IDS.length === 0) {
      const errorMessage = "No servers configured in server_xref table";
      console.error(`[FiveM ETL] ${errorMessage}`);
      return new Response(`[${new Date().toISOString()}] ${errorMessage}`, {
        status: 400,
        headers: {
          "Content-Type": "text/plain"
        }
      });
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
    console.log(`[FiveM ETL] Processing ${SERVER_IDS.length} servers`);
    // Iterate through each server ID
    for (const server_id of SERVER_IDS) {
      console.log(`[FiveM ETL] Fetching data for server ${server_id}`);
      const API_URL = `${BASE_API_URL}${server_id}`;
      try {
        const response = await fetch(API_URL, {
          headers
        });
        if (!response.ok) {
          const errorMessage = `HTTP error for server ${server_id}: ${response.status}`;
          console.error(`[FiveM ETL] ${errorMessage}`);
          throw new Error(errorMessage);
        }
        const data = await response.json();
        let current_players = data?.Data?.selfReportedClients || 0;
        console.log(`[FiveM ETL] Server ${server_id}: Fetched player count: ${current_players}`);
        
        // Mitigation for FiveM API bug: if API returns 0, fetch last non-zero value from database
        if (current_players === 0) {
          try {
            const { data: lastData, error: lastError } = await supabase
              .from("player_counts")
              .select("player_count")
              .eq("server_id", server_id)
              .gt("player_count", 0)
              .order("timestamp", { ascending: false })
              .limit(1);
            
            if (!lastError && lastData && lastData.length > 0) {
              const lastNonZeroCount = lastData[0].player_count;
              console.log(`[FiveM ETL] Server ${server_id}: API returned 0, using last non-zero value: ${lastNonZeroCount}`);
              current_players = lastNonZeroCount;
            }
          } catch (fallbackError) {
            console.error(`[FiveM ETL] Server ${server_id}: Error fetching fallback player count: ${fallbackError}`);
          }
        }
        
        // Extract max capacity from multiple possible sources for robustness
        // Priority: vars.sv_maxClients (string) -> svMaxclients (number) -> sv_maxclients (number)
        let max_capacity = 0;
        if (data?.Data?.vars?.sv_maxClients) {
          max_capacity = parseInt(data.Data.vars.sv_maxClients, 10) || 0;
        } else if (typeof data?.Data?.svMaxclients === 'number') {
          max_capacity = data.Data.svMaxclients;
        } else if (typeof data?.Data?.sv_maxclients === 'number') {
          max_capacity = data.Data.sv_maxclients;
        }
        console.log(`[FiveM ETL] Server ${server_id}: Fetched max capacity: ${max_capacity}`);
        
        // Insert player count record
        const playerRecord = {
          timestamp,
          player_count: current_players,
          server_id
        };
        const { error: playerError } = await supabase.from("player_counts").insert(playerRecord);
        if (playerError) {
          const errorMessage = `Supabase error for server ${server_id} player_counts: ${playerError.message}`;
          console.error(`[FiveM ETL] ${errorMessage}`);
          throw new Error(errorMessage);
        }
        console.log(`[FiveM ETL] Server ${server_id}: Successfully saved player count: ${current_players}`);
        
        // Insert capacity record if we have a valid capacity
        if (max_capacity > 0) {
          const capacityRecord = {
            timestamp,
            max_capacity: max_capacity,
            server_id
          };
          const { error: capacityError } = await supabase.from("server_capacity").insert(capacityRecord);
          if (capacityError) {
            // Log error but don't fail the entire operation
            console.error(`[FiveM ETL] Server ${server_id}: Failed to save capacity: ${capacityError.message}`);
          } else {
            console.log(`[FiveM ETL] Server ${server_id}: Successfully saved max capacity: ${max_capacity}`);
          }
        } else {
          console.warn(`[FiveM ETL] Server ${server_id}: No valid max capacity found in API response`);
        }
        const normalizedResources = normalizeResources(data?.Data?.resources);
        try {
          const { data: snapshotData, error: snapshotError } = await supabase.from("server_resource_snapshots").select("id, resources").eq("server_id", server_id).order("timestamp", {
            ascending: false
          }).limit(1);
          if (snapshotError) {
            console.error(`[FiveM ETL] Server ${server_id}: Failed to load previous resource snapshot: ${snapshotError.message}`);
          }
          const hasPreviousSnapshot = Array.isArray(snapshotData) && snapshotData.length > 0;
          const previousResources = hasPreviousSnapshot && Array.isArray(snapshotData?.[0]?.resources) ? normalizeResources(snapshotData[0].resources) : [];
          const shouldInsertSnapshot = !snapshotError && (!hasPreviousSnapshot || resourcesChanged(previousResources, normalizedResources));
          if (shouldInsertSnapshot) {
            const { error: snapshotInsertError } = await supabase.from("server_resource_snapshots").insert({
              server_id,
              timestamp,
              resources: normalizedResources
            });
            if (snapshotInsertError) {
              console.error(`[FiveM ETL] Server ${server_id}: Failed to insert resource snapshot: ${snapshotInsertError.message}`);
            } else {
              console.log(`[FiveM ETL] Server ${server_id}: Stored new resource snapshot with ${normalizedResources.length} entries`);
            }
            if (hasPreviousSnapshot) {
              const { added, removed } = diffResources(previousResources, normalizedResources);
              if (added.length > 0 || removed.length > 0) {
                const { error: changeInsertError } = await supabase.from("server_resource_changes").insert({
                  server_id,
                  timestamp,
                  added_resources: added,
                  removed_resources: removed
                });
                if (changeInsertError) {
                  console.error(`[FiveM ETL] Server ${server_id}: Failed to insert resource change log: ${changeInsertError.message}`);
                } else {
                  console.log(`[FiveM ETL] Server ${server_id}: Logged resource changes. Added: ${added.length}, Removed: ${removed.length}`);
                }
              }
            }
          }
        } catch (resourceError) {
          const errorMessage = resourceError instanceof Error ? resourceError.message : String(resourceError);
          console.error(`[FiveM ETL] Server ${server_id}: Error processing resource changes: ${errorMessage}`);
        }
        results.push(`[${timestamp}] Server ${server_id}: Successfully saved player count: ${current_players}`);
      } catch (serverError) {
        const errorMessage = serverError instanceof Error ? serverError.message : String(serverError);
        console.error(`[FiveM ETL] Server ${server_id}: Error: ${errorMessage}`);
        results.push(`[${timestamp}] Server ${server_id}: Error: ${errorMessage}`);
      }
      await sleep(10000);
    }
    console.log(`[FiveM ETL] Completed processing ${SERVER_IDS.length} servers. ${results.length} results recorded.`);
    return new Response(results.join("\n"), {
      status: 200,
      headers: {
        "Content-Type": "text/plain"
      }
    });
  } catch (error) {
    const timestamp = new Date().toISOString();
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`[FiveM ETL] Unexpected error in Edge Function: ${errorMessage}`);
    return new Response(`[${timestamp}] Unexpected error: ${errorMessage}`, {
      status: 500,
      headers: {
        "Content-Type": "text/plain"
      }
    });
  }
});
