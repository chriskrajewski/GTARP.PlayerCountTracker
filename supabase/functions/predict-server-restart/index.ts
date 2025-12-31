import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ============================================================================
// Server Restart Prediction Edge Function with OpenAI ML
// ============================================================================
// This Edge Function uses GPT-4o-mini to analyze historical player count data
// and predict server restart times with ML-enhanced pattern recognition.
//
// EXECUTION MODES:
// 1. CRON MODE (POST with no body or empty serverIds): Refreshes ALL active servers
// 2. API MODE (GET/POST with serverIds): Returns predictions for specific servers
// ============================================================================

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY")!;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// ============================================================================
// Type Definitions
// ============================================================================

interface PlayerCountRecord {
  timestamp: string;
  player_count: number;
  server_id: string;
}

interface RestartEvent {
  timestamp: string;
  playerCountBefore: number;
  playerCountAfter: number;
  downtimeMinutes: number;
}

interface MLPrediction {
  serverId: string;
  nextRestartTime: string | null;
  confidence: number;
  detectedPattern: string | null;
  lastRestartTime: string | null;
  averageDowntime: number;
  patternType: "fixed-interval" | "fixed-time" | "irregular" | "insufficient-data";
  mlReasoning: string;
  isStale: boolean;
  cachedAt: string;
  detectedEventsCount: number;
}

interface CachedPrediction {
  server_id: string;
  next_restart_time: string | null;
  confidence: number;
  detected_pattern: string | null;
  last_restart_time: string | null;
  average_downtime: number;
  pattern_type: string;
  ml_reasoning: string;
  detected_events_count: number;
  updated_at: string;
}

interface CronResult {
  mode: "cron";
  serversProcessed: number;
  successCount: number;
  errorCount: number;
  errors: Array<{ serverId: string; error: string }>;
  duration: number;
  timestamp: string;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Detects restart events from player count data
 * A restart is identified by a rapid drop (>80%) to near-zero (<5 players)
 * followed by recovery within 30 minutes
 */
function detectRestartEvents(data: PlayerCountRecord[]): RestartEvent[] {
  if (data.length < 2) return [];

  const events: RestartEvent[] = [];
  const sortedData = [...data].sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  );

  for (let i = 1; i < sortedData.length; i++) {
    const prev = sortedData[i - 1];
    const curr = sortedData[i];

    const timeDiffMs = new Date(curr.timestamp).getTime() - new Date(prev.timestamp).getTime();
    const timeDiffMinutes = timeDiffMs / (1000 * 60);

    // Only check within 30 minute window
    if (timeDiffMinutes > 30) continue;

    const dropPercentage = ((prev.player_count - curr.player_count) / Math.max(prev.player_count, 1)) * 100;

    // Criteria: >80% drop AND reaches near-zero (<5 players)
    if (dropPercentage > 80 && curr.player_count < 5) {
      // Look ahead to confirm recovery
      let recoveryFound = false;
      let recoveryTime = 0;
      let recoveryIndex = -1;

      for (let j = i + 1; j < Math.min(i + 20, sortedData.length); j++) {
        const future = sortedData[j];
        const recoveryDiffMs = new Date(future.timestamp).getTime() - new Date(curr.timestamp).getTime();
        const recoveryDiffMinutes = recoveryDiffMs / (1000 * 60);

        if (recoveryDiffMinutes > 30) break;

        // Recovery when player count reaches >10% of pre-restart level
        if (future.player_count > prev.player_count * 0.1) {
          recoveryFound = true;
          recoveryTime = Math.round(recoveryDiffMinutes);
          recoveryIndex = j;
          break;
        }
      }

      if (recoveryFound) {
        events.push({
          timestamp: curr.timestamp,
          playerCountBefore: prev.player_count,
          playerCountAfter: curr.player_count,
          downtimeMinutes: recoveryTime,
        });
        i = recoveryIndex; // Skip ahead to avoid duplicates
      }
    }
  }

  return events;
}

/**
 * Formats restart events for OpenAI prompt
 */
function formatEventsForPrompt(events: RestartEvent[]): string {
  if (events.length === 0) return "No restart events detected.";

  return events
    .map((e, i) => {
      const date = new Date(e.timestamp);
      const dayOfWeek = date.toLocaleDateString("en-US", { weekday: "long" });
      const time = date.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false });
      const dateStr = date.toISOString().split("T")[0];
      return `${i + 1}. ${dayOfWeek}, ${dateStr} at ${time} UTC - Players dropped from ${e.playerCountBefore} to ${e.playerCountAfter}, recovered in ${e.downtimeMinutes} min`;
    })
    .join("\n");
}

/**
 * Calculates intervals between restart events in hours
 */
function calculateIntervals(events: RestartEvent[]): number[] {
  if (events.length < 2) return [];

  const intervals: number[] = [];
  for (let i = 1; i < events.length; i++) {
    const prev = new Date(events[i - 1].timestamp).getTime();
    const curr = new Date(events[i].timestamp).getTime();
    intervals.push((curr - prev) / (1000 * 60 * 60)); // hours
  }
  return intervals;
}

/**
 * Calls OpenAI GPT-4o-mini to analyze restart patterns and predict next restart
 */
async function getMLPrediction(
  serverId: string,
  events: RestartEvent[],
  intervals: number[]
): Promise<{ nextRestartTime: string | null; confidence: number; pattern: string; patternType: string; reasoning: string }> {
  const currentTime = new Date().toISOString();
  const lastRestart = events.length > 0 ? events[events.length - 1].timestamp : null;

  // Calculate basic statistics for context
  const avgInterval = intervals.length > 0 ? intervals.reduce((a, b) => a + b, 0) / intervals.length : 0;
  const variance = intervals.length > 0
    ? Math.sqrt(intervals.reduce((sum, i) => sum + Math.pow(i - avgInterval, 2), 0) / intervals.length)
    : 0;

  const prompt = `You are an expert at analyzing server restart patterns for gaming servers. Analyze the following restart event data and predict when the next restart will occur.

## Server: ${serverId}
## Current Time: ${currentTime}
## Last Restart: ${lastRestart || "Unknown"}

## Detected Restart Events (last 14 days):
${formatEventsForPrompt(events)}

## Calculated Statistics:
- Number of restart events: ${events.length}
- Average interval between restarts: ${avgInterval.toFixed(2)} hours
- Standard deviation: ${variance.toFixed(2)} hours
- Intervals (hours): ${intervals.length > 0 ? intervals.map(i => i.toFixed(1)).join(", ") : "N/A"}

## Your Task:
1. Analyze the pattern of restarts (look for fixed intervals, fixed times of day, day-of-week patterns, or irregular patterns)
2. Predict the most likely next restart time
3. Provide a confidence score (0-100) based on pattern consistency
4. Classify the pattern type

Respond in this exact JSON format (no markdown, just raw JSON):
{
  "nextRestartTime": "ISO 8601 timestamp or null if unpredictable",
  "confidence": 0-100,
  "patternDescription": "Human readable description like 'Every 6 hours' or 'Daily at 06:00 UTC'",
  "patternType": "fixed-interval" | "fixed-time" | "irregular" | "insufficient-data",
  "reasoning": "Brief explanation of your analysis"
}`;

  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: "You are a data analyst specializing in time series pattern recognition for gaming server restart schedules. Always respond with valid JSON only, no markdown formatting.",
          },
          {
            role: "user",
            content: prompt,
          },
        ],
        temperature: 0.3, // Lower temperature for more consistent predictions
        max_tokens: 500,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[ML Prediction] OpenAI API error: ${response.status} - ${errorText}`);
      throw new Error(`OpenAI API error: ${response.status}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;

    if (!content) {
      throw new Error("No content in OpenAI response");
    }

    // Parse the JSON response
    const parsed = JSON.parse(content.trim());

    return {
      nextRestartTime: parsed.nextRestartTime,
      confidence: Math.min(100, Math.max(0, parsed.confidence || 0)),
      pattern: parsed.patternDescription || "Unknown pattern",
      patternType: parsed.patternType || "irregular",
      reasoning: parsed.reasoning || "No reasoning provided",
    };
  } catch (error) {
    console.error(`[ML Prediction] Error calling OpenAI:`, error);

    // Fallback to basic heuristic prediction
    return getFallbackPrediction(events, intervals, avgInterval, variance);
  }
}

/**
 * Fallback prediction using basic heuristics when OpenAI fails
 */
function getFallbackPrediction(
  events: RestartEvent[],
  intervals: number[],
  avgInterval: number,
  variance: number
): { nextRestartTime: string | null; confidence: number; pattern: string; patternType: string; reasoning: string } {
  if (events.length < 2) {
    return {
      nextRestartTime: null,
      confidence: 0,
      pattern: "Insufficient data",
      patternType: "insufficient-data",
      reasoning: "Not enough restart events detected to establish a pattern (fallback mode)",
    };
  }

  const lastRestart = new Date(events[events.length - 1].timestamp);
  const varianceMinutes = variance * 60;

  // Check for fixed-interval pattern (variance < 2 hours)
  if (varianceMinutes < 120) {
    const nextRestart = new Date(lastRestart.getTime() + avgInterval * 60 * 60 * 1000);
    const hours = Math.round(avgInterval);

    let confidence = Math.min(events.length * 15, 60);
    if (varianceMinutes < 15) confidence += 35;
    else if (varianceMinutes < 60) confidence += 20;
    else confidence += 10;

    return {
      nextRestartTime: nextRestart.toISOString(),
      confidence: Math.min(confidence, 100),
      pattern: hours === 1 ? "Every hour" : hours === 24 ? "Daily" : `Every ${hours} hours`,
      patternType: "fixed-interval",
      reasoning: `Detected consistent ${hours}-hour interval pattern with low variance (fallback mode)`,
    };
  }

  // Check for fixed-time pattern
  const timeMap = new Map<string, number>();
  events.forEach((e) => {
    const date = new Date(e.timestamp);
    const timeKey = `${String(date.getUTCHours()).padStart(2, "0")}:${String(date.getUTCMinutes()).padStart(2, "0")}`;
    timeMap.set(timeKey, (timeMap.get(timeKey) || 0) + 1);
  });

  let mostCommonTime = "";
  let maxOccurrences = 0;
  timeMap.forEach((count, time) => {
    if (count > maxOccurrences) {
      maxOccurrences = count;
      mostCommonTime = time;
    }
  });

  if (maxOccurrences >= events.length * 0.5) {
    const [hours, minutes] = mostCommonTime.split(":").map(Number);
    const nextRestart = new Date();
    nextRestart.setUTCHours(hours, minutes, 0, 0);
    if (nextRestart <= new Date()) {
      nextRestart.setUTCDate(nextRestart.getUTCDate() + 1);
    }

    let confidence = Math.min(events.length * 15, 60);
    if (varianceMinutes < 30) confidence += 30;
    else if (varianceMinutes < 120) confidence += 15;
    else confidence += 5;

    return {
      nextRestartTime: nextRestart.toISOString(),
      confidence: Math.min(confidence, 100),
      pattern: `Daily at ${mostCommonTime} UTC`,
      patternType: "fixed-time",
      reasoning: `Detected fixed daily restart time pattern (fallback mode)`,
    };
  }

  // Irregular pattern
  return {
    nextRestartTime: null,
    confidence: Math.min(events.length * 10 + 5, 40),
    pattern: "Irregular restarts",
    patternType: "irregular",
    reasoning: `No consistent pattern detected - restarts appear irregular (fallback mode)`,
  };
}

/**
 * Get cached prediction from database
 */
async function getCachedPrediction(serverId: string): Promise<CachedPrediction | null> {
  const { data, error } = await supabase
    .from("server_restart_predictions")
    .select("*")
    .eq("server_id", serverId)
    .single();

  if (error || !data) {
    return null;
  }

  return data as CachedPrediction;
}

/**
 * Save prediction to database cache
 */
async function savePredictionToCache(prediction: MLPrediction): Promise<void> {
  const { error } = await supabase
    .from("server_restart_predictions")
    .upsert(
      {
        server_id: prediction.serverId,
        next_restart_time: prediction.nextRestartTime,
        confidence: prediction.confidence,
        detected_pattern: prediction.detectedPattern,
        last_restart_time: prediction.lastRestartTime,
        average_downtime: prediction.averageDowntime,
        pattern_type: prediction.patternType,
        ml_reasoning: prediction.mlReasoning,
        detected_events_count: prediction.detectedEventsCount,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "server_id" }
    );

  if (error) {
    console.error(`[ML Prediction] Error saving to cache:`, error);
  }
}

/**
 * Generate prediction for a single server
 */
async function generatePrediction(serverId: string, daysBack: number = 14): Promise<MLPrediction> {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - daysBack);

  // Fetch player count data
  const { data: playerData, error } = await supabase
    .from("player_counts")
    .select("timestamp, player_count, server_id")
    .eq("server_id", serverId)
    .gte("timestamp", startDate.toISOString())
    .order("timestamp", { ascending: true });

  if (error) {
    console.error(`[ML Prediction] Error fetching player data for ${serverId}:`, error);
    throw new Error(`Failed to fetch player data: ${error.message}`);
  }

  const records = (playerData || []) as PlayerCountRecord[];

  // Detect restart events
  const events = detectRestartEvents(records);
  const intervals = calculateIntervals(events);

  // Calculate average downtime
  const avgDowntime = events.length > 0
    ? Math.round(events.reduce((sum, e) => sum + e.downtimeMinutes, 0) / events.length)
    : 0;

  // Get ML prediction from OpenAI
  const mlResult = await getMLPrediction(serverId, events, intervals);

  const prediction: MLPrediction = {
    serverId,
    nextRestartTime: mlResult.nextRestartTime,
    confidence: mlResult.confidence,
    detectedPattern: mlResult.pattern,
    lastRestartTime: events.length > 0 ? events[events.length - 1].timestamp : null,
    averageDowntime: avgDowntime,
    patternType: mlResult.patternType as MLPrediction["patternType"],
    mlReasoning: mlResult.reasoning,
    isStale: false,
    cachedAt: new Date().toISOString(),
    detectedEventsCount: events.length,
  };

  // Save to cache
  await savePredictionToCache(prediction);

  return prediction;
}

/**
 * Get all active server IDs from server_xref table
 */
async function getAllActiveServerIds(): Promise<string[]> {
  const { data, error } = await supabase
    .from("server_xref")
    .select("server_id")
    .order("order", { ascending: true });

  if (error) {
    console.error(`[ML Prediction] Error fetching server list:`, error);
    return [];
  }

  return (data || []).map((row: { server_id: string }) => row.server_id).filter(Boolean);
}

/**
 * CRON MODE: Refresh predictions for all active servers
 * This is designed to be called by a scheduled cron job
 */
async function refreshAllPredictions(daysBack: number = 14): Promise<CronResult> {
  const startTime = Date.now();
  const errors: Array<{ serverId: string; error: string }> = [];
  let successCount = 0;

  console.log(`[ML Prediction CRON] Starting scheduled refresh of all server predictions`);

  // Get all active servers
  const serverIds = await getAllActiveServerIds();
  
  if (serverIds.length === 0) {
    console.warn(`[ML Prediction CRON] No active servers found in server_xref`);
    return {
      mode: "cron",
      serversProcessed: 0,
      successCount: 0,
      errorCount: 0,
      errors: [],
      duration: Date.now() - startTime,
      timestamp: new Date().toISOString(),
    };
  }

  console.log(`[ML Prediction CRON] Processing ${serverIds.length} servers`);

  // Process each server sequentially to avoid rate limits
  for (const serverId of serverIds) {
    try {
      console.log(`[ML Prediction CRON] Processing server: ${serverId}`);
      await generatePrediction(serverId, daysBack);
      successCount++;
      console.log(`[ML Prediction CRON] Successfully updated prediction for ${serverId}`);
      
      // Small delay between servers to avoid rate limits (500ms)
      await new Promise(resolve => setTimeout(resolve, 500));
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      console.error(`[ML Prediction CRON] Error processing ${serverId}:`, errorMessage);
      errors.push({ serverId, error: errorMessage });
    }
  }

  const duration = Date.now() - startTime;
  console.log(`[ML Prediction CRON] Completed. Processed ${serverIds.length} servers in ${duration}ms. Success: ${successCount}, Errors: ${errors.length}`);

  return {
    mode: "cron",
    serversProcessed: serverIds.length,
    successCount,
    errorCount: errors.length,
    errors,
    duration,
    timestamp: new Date().toISOString(),
  };
}

/**
 * API MODE: Return cached predictions for specific servers
 * Does NOT refresh predictions - just reads from cache
 */
async function getCachedPredictions(serverIds: string[]): Promise<MLPrediction[]> {
  const predictions: MLPrediction[] = [];

  for (const serverId of serverIds) {
    const cached = await getCachedPrediction(serverId);

    if (cached) {
      // Check if prediction is stale (older than 30 minutes for cron mode)
      const cacheAge = Date.now() - new Date(cached.updated_at).getTime();
      const isStale = cacheAge > 30 * 60 * 1000; // 30 minutes

      predictions.push({
        serverId: cached.server_id,
        nextRestartTime: cached.next_restart_time,
        confidence: cached.confidence,
        detectedPattern: cached.detected_pattern,
        lastRestartTime: cached.last_restart_time,
        averageDowntime: cached.average_downtime,
        patternType: cached.pattern_type as MLPrediction["patternType"],
        mlReasoning: cached.ml_reasoning || "",
        isStale,
        cachedAt: cached.updated_at,
        detectedEventsCount: cached.detected_events_count || 0,
      });
    } else {
      // No cached prediction - return empty
      predictions.push({
        serverId,
        nextRestartTime: null,
        confidence: 0,
        detectedPattern: null,
        lastRestartTime: null,
        averageDowntime: 0,
        patternType: "insufficient-data",
        mlReasoning: "No prediction available. Waiting for cron job to generate.",
        isStale: true,
        cachedAt: new Date().toISOString(),
        detectedEventsCount: 0,
      });
    }
  }

  return predictions;
}

// ============================================================================
// Main Handler
// ============================================================================

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
      },
    });
  }

  if (req.method !== "GET" && req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    const url = new URL(req.url);
    let serverIds: string[] = [];
    let daysBack = 14;
    let cronMode = false;

    // Parse request parameters
    if (req.method === "GET") {
      const serverIdsParam = url.searchParams.get("serverIds");
      serverIds = serverIdsParam ? serverIdsParam.split(",").filter(Boolean) : [];
      daysBack = Math.min(30, Math.max(7, parseInt(url.searchParams.get("daysBack") || "14", 10)));
      cronMode = url.searchParams.get("cron") === "true";
    } else {
      // POST request
      const contentType = req.headers.get("content-type") || "";
      
      if (contentType.includes("application/json")) {
        try {
          const body = await req.json();
          serverIds = body.serverIds || [];
          daysBack = Math.min(30, Math.max(7, body.daysBack || 14));
          cronMode = body.cron === true;
        } catch {
          // Empty body or invalid JSON - treat as cron mode
          cronMode = true;
        }
      } else {
        // No JSON body - treat as cron mode
        cronMode = true;
      }
    }

    // CRON MODE: Refresh all servers
    if (cronMode || serverIds.length === 0) {
      console.log(`[ML Prediction] CRON MODE - Refreshing all servers`);
      const result = await refreshAllPredictions(daysBack);
      
      return new Response(JSON.stringify(result), {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
      });
    }

    // API MODE: Return cached predictions for specific servers
    console.log(`[ML Prediction] API MODE - Returning cached predictions for ${serverIds.length} servers`);
    
    // Limit to 20 servers per request
    if (serverIds.length > 20) {
      serverIds = serverIds.slice(0, 20);
    }

    const predictions = await getCachedPredictions(serverIds);

    return new Response(JSON.stringify({ 
      predictions, 
      source: "cache",
      timestamp: new Date().toISOString() 
    }), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
        "Cache-Control": "public, max-age=60",
      },
    });
  } catch (error) {
    console.error(`[ML Prediction] Unexpected error:`, error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Internal server error",
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
});
