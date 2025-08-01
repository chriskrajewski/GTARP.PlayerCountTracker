"use strict";

import { NextRequest, NextResponse } from 'next/server';
import { isAllowedQuery, SYSTEM_PROMPT } from '@/lib/grok';
import { rateLimiter } from '@/lib/rateLimiter';
import { createClient } from '@supabase/supabase-js';
import { logApiRequest, sanitizeQuery } from '@/lib/apiLogger';
import { xai } from "@ai-sdk/xai";
import { generateText } from "ai";
import { 
  getServers, 
  getPlayerCounts, 
  getStreamCounts, 
  getViewerCounts,
  getTimeAggregation,
  aggregateDataByTime,
  type TimeRange,
  type TimeAggregation
} from "@/lib/data";

export const runtime = 'edge';

// Utility function to format date as YYYY-MM-DD
function formatDate(date: Date): string {
  return date.toISOString().split('T')[0];
}

// Handler for POST requests to the Grok chat endpoint
export async function POST(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for') || 'unknown';
  
  try {
    // Apply rate limiting
    const rateLimitResponse = await rateLimiter(req);
    if (rateLimitResponse) {
      await logApiRequest({
        ip,
        endpoint: '/api/grok',
        responseStatus: 429,
        level: 'warn',
        message: 'Rate limit exceeded'
      });
      return rateLimitResponse;
    }

    // Parse request body
    const { messages, includeStats = true } = await req.json();

    // Validate input
    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json(
        { error: 'Invalid request: messages array is required' },
        { status: 400 }
      );
    }

    // Get the user's message (the last message in the array)
    const userMessage = messages[messages.length - 1];
    
    // Check if this is a valid query within our allowed topics
    if (!isAllowedQuery(userMessage.content)) {
      await logApiRequest({
        ip,
        endpoint: '/api/grok',
        query: sanitizeQuery(userMessage.content),
        responseStatus: 403,
        level: 'warn',
        message: 'Unauthorized query attempted: ' + sanitizeQuery(userMessage.content)
      });
      
      return NextResponse.json(
        {
          response: "I'm sorry, I can only answer questions related to FiveM GTA RP player counts, viewer counts, and streamer statistics. Please ask a question on these topics."
        },
        { status: 200 }
      );
    }

    // Get API key from environment variables
    const grokApiKey = process.env.GROK_API_KEY;
    if (!grokApiKey) {
      throw new Error('Missing GROK_API_KEY environment variable');
    }
    
    // Set API key for XAI
    process.env.XAI_API_KEY = grokApiKey;

    // Build the prompt with system instruction and context
    let fullPrompt = SYSTEM_PROMPT + "\n\n";
    
    // Add any previous conversation context
    let previousContext = "";
    for (let i = 0; i < messages.length - 1; i++) {
      const msg = messages[i];
      const roleLabel = msg.role === 'user' ? 'User' : 'Assistant';
      previousContext += `${roleLabel}: ${msg.content}\n\n`;
    }
    
    // If this is a short follow-up question, add a reminder to the AI
    const isShortQuestion = userMessage.content.length < 30;
    const isPossibleFollowup = messages.length > 1 && isShortQuestion;
    
    if (isPossibleFollowup) {
      fullPrompt += `# Conversation History\n\nThis appears to be a follow-up question. Here is the conversation history so far:\n\n${previousContext}\n`;
    } else if (messages.length > 1) {
      // Add conversation history context
      fullPrompt += `# Conversation History\n\n${previousContext}\n`;
    }
    
    // Add the current user query
    fullPrompt += `User: ${userMessage.content}\n\nAssistant:`;

    // If includeStats is true, append comprehensive statistics to provide context
    if (includeStats) {
      // Set up supabase client
      const supabaseUrl = process.env.SUPABASE_URL || '';
      const supabaseKey = process.env.SUPABASE_ANON_KEY || '';
      
      if (supabaseUrl && supabaseKey) {
        const supabase = createClient(supabaseUrl, supabaseKey);
        let statsContext = "# Current GTA RP Server and Stream Data\n\n";
        let hasRealData = false;
        
        try {
          console.log("Fetching data from Supabase...");
          
          // Debug the database connection
          console.log("Database connection:", {
            supabaseUrl: supabaseUrl.substring(0, 20) + "...",
            hasKey: !!supabaseKey
          });
          
          // STEP 1: Get all server information first
          // --------------------
          // Get server mapping data
          const { data: serverData, error: serverError } = await supabase
            .from('server_xref')
            .select('server_id, server_name')
            .order('server_id');
            
          console.log("Server data query result:", {
            success: !serverError,
            count: serverData?.length || 0,
            error: serverError?.message
          });
          
          // Create a map of server IDs to names
          const serverNameMap: Record<string, string> = {};
          if (serverData && serverData.length > 0) {
            serverData.forEach(server => {
              serverNameMap[server.server_id] = server.server_name;
            });
            
            console.log("Server ID to Name mapping:", 
              Object.entries(serverNameMap).map(([id, name]) => `${id} => ${name}`).join(', ')
            );
          }
          
          // Find any servers with "unscripted" in the name
          const unscriptedServers = serverData?.filter(s => 
            s.server_name?.toLowerCase().includes('unscripted'));
          
          console.log("Unscripted servers found:", 
            unscriptedServers?.length ? 
            unscriptedServers.map(s => `${s.server_id} => ${s.server_name}`).join(', ') : 
            'None found'
          );
          
          // STEP 2: Get player count data for ALL time ranges
          // --------------------
          // Time ranges for comprehensive data
          const timeRanges: TimeRange[] = ["24h", "7d", "30d"];
          const timeRangeData: Record<string, any[]> = {
            "24h": [],
            "7d": [],
            "30d": []
          };
          
          // Get player counts for all servers across different time ranges
          for (const timeRange of timeRanges) {
            const { data: playerData, error: playerError } = await supabase
              .from('player_counts')
              .select('server_id, timestamp, player_count')
              .order('timestamp', { ascending: false })
              .gte('timestamp', new Date(Date.now() - getTimeRangeInMs(timeRange)).toISOString())
              .limit(10000);
              
            console.log(`Player data query result for ${timeRange}:`, {
              success: !playerError,
              count: playerData?.length || 0,
              error: playerError?.message
            });
            
            if (playerData && playerData.length > 0) {
              timeRangeData[timeRange] = playerData;
              hasRealData = true;
            }
          }
          
          // STEP 3: Get streamer & viewer data
          // --------------------
          // Get streamer data for the last 24 hours
          const { data: streamerData, error: streamerError } = await supabase
            .from('twitch_streams')
            .select('*')
            .order('created_at', { ascending: false })
            .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
            .limit(1000);
            
          console.log("Streamer data query result:", {
            success: !streamerError,
            count: streamerData?.length || 0,
            error: streamerError?.message
          });
          
          // STEP 4: Process and format data for the AI
          // --------------------
          if (!hasRealData) {
            console.log("No data available, using fallback example data");
            // Add fallback data (keeping this part from the original code)
            statsContext += "## Example Player Counts by Server (Fallback Data)\n\n";
            statsContext += "- NoPixel: 220 players\n";
            statsContext += "- Unscripted: 175 players\n";
            statsContext += "- Eclipse: 155 players\n";
            statsContext += "- Legacy: 130 players\n";
            statsContext += "- Mafia World: 110 players\n";
            statsContext += "\n**Total players across all tracked servers: 790**\n\n";
            
            statsContext += "## Example GTA RP Streamers (Fallback Data)\n\n";
            statsContext += "- Buddha: 15000 viewers, playing on NoPixel\n";
            statsContext += "- Summit1g: 25000 viewers, playing on Unscripted\n";
            statsContext += "- Penta: 8000 viewers, playing on NoPixel\n";
            statsContext += "- Kyle: 7500 viewers, playing on NoPixel\n";
            statsContext += "- Sodapoppin: 22000 viewers, playing on Eclipse\n";
            statsContext += "\n**Total viewers across top streamers: 77500**\n\n";
            
            statsContext += "NOTE: This is example fallback data. Real data is currently unavailable.\n\n";
          } else {
            // 4.1: CURRENT PLAYER COUNTS
            // --------------------
            if (timeRangeData["24h"].length > 0) {
              statsContext += "## Current Player Counts by Server\n\n";
              
              // Group by server and get the most recent count for each
              const latestPlayerCounts: Record<string, any> = {};
              timeRangeData["24h"].forEach(record => {
                const serverId = record.server_id;
                if (!latestPlayerCounts[serverId] || 
                    new Date(record.timestamp) > new Date(latestPlayerCounts[serverId].timestamp)) {
                  latestPlayerCounts[serverId] = record;
                }
              });
              
              // Get total player count and create formatted list
              let totalPlayers = 0;
              for (const serverId in latestPlayerCounts) {
                const record = latestPlayerCounts[serverId];
                const serverName = serverNameMap[serverId] || `Server ${serverId}`;
                statsContext += `- ${serverName}: ${record.player_count} players\n`;
                totalPlayers += record.player_count;
              }
              
              statsContext += `\n**Total players across all tracked servers: ${totalPlayers}**\n\n`;
            }
            
            // 4.2: DAILY HISTORICAL DATA FOR PAST WEEK
            // --------------------
            if (timeRangeData["7d"].length > 0) {
              statsContext += "## Daily Player Counts (Past 7 Days)\n\n";
              
              // Process daily averages for each server
              const weekData = timeRangeData["7d"];
              const dailyServerData: Record<string, Record<string, number[]>> = {};
              
              // Group by day and server
              weekData.forEach(record => {
                const day = formatDate(new Date(record.timestamp));
                const serverId = record.server_id;
                
                if (!dailyServerData[day]) {
                  dailyServerData[day] = {};
                }
                
                if (!dailyServerData[day][serverId]) {
                  dailyServerData[day][serverId] = [];
                }
                
                dailyServerData[day][serverId].push(record.player_count);
              });
              
              // Get all server IDs with data
              const allServerIds = Array.from(new Set(weekData.map(r => r.server_id)));
              
              // Get dates in chronological order
              const days = Object.keys(dailyServerData).sort();
              
              // Create a table for each server
              allServerIds.forEach(serverId => {
                const serverName = serverNameMap[serverId] || `Server ${serverId}`;
                statsContext += `### ${serverName}\n\n`;
                statsContext += "| Date | Average Player Count |\n";
                statsContext += "|------|----------------------|\n";
                
                days.forEach(day => {
                  const counts = dailyServerData[day][serverId] || [];
                  if (counts.length > 0) {
                    const avg = Math.round(counts.reduce((sum: number, count: number) => sum + count, 0) / counts.length);
                    statsContext += `| ${day} | ${avg} |\n`;
                  } else {
                    statsContext += `| ${day} | No data |\n`;
                  }
                });
                
                statsContext += "\n";
              });
            }
            
            // 4.3: HOURLY DATA FOR PAST 24 HOURS
            // --------------------
            if (timeRangeData["24h"].length > 0) {
              // Create aggregated hourly data for each server for the past 24 hours
              statsContext += "## Hourly Player Counts (Past 24 Hours)\n\n";
              
              // Group data by server and hour
              const hourlyData: Record<string, Record<string, number[]>> = {};
              const past24hData = timeRangeData["24h"];
              const now = new Date();
              
              past24hData.forEach(record => {
                const recordTime = new Date(record.timestamp);
                const hourKey = `${recordTime.getFullYear()}-${String(recordTime.getMonth() + 1).padStart(2, "0")}-${String(recordTime.getDate()).padStart(2, "0")} ${String(recordTime.getHours()).padStart(2, "0")}:00`;
                const serverId = record.server_id;
                
                if (!hourlyData[hourKey]) {
                  hourlyData[hourKey] = {};
                }
                
                if (!hourlyData[hourKey][serverId]) {
                  hourlyData[hourKey][serverId] = [];
                }
                
                hourlyData[hourKey][serverId].push(record.player_count);
              });
              
              // Get all server IDs with data from the past 24 hours
              const past24hServerIds = Array.from(new Set(past24hData.map(r => r.server_id)));
              
              // Get hours in chronological order
              const hours = Object.keys(hourlyData).sort();
              
              // Create a table for each major server (limit to avoid overloading the context)
              const topServers = past24hServerIds.slice(0, 5);
              
              topServers.forEach(serverId => {
                const serverName = serverNameMap[serverId] || `Server ${serverId}`;
                statsContext += `### ${serverName} - Hourly\n\n`;
                statsContext += "| Hour | Player Count |\n";
                statsContext += "|------|-------------|\n";
                
                hours.forEach(hour => {
                  const counts = hourlyData[hour][serverId] || [];
                  if (counts.length > 0) {
                    const avg = Math.round(counts.reduce((sum: number, count: number) => sum + count, 0) / counts.length);
                    statsContext += `| ${hour} | ${avg} |\n`;
                  }
                });
                
                statsContext += "\n";
              });
            }
            
            // 4.4: STREAM DATA
            // --------------------
            if (streamerData && streamerData.length > 0) {
              statsContext += "## Current GTA RP Streamers\n\n";
              
              // Group by streamer (use streamer_name as the unique identifier)
              const latestStreamerData = new Map();
              streamerData.forEach(record => {
                const streamerName = record.streamer_name;
                if (!latestStreamerData.has(streamerName) || 
                    new Date(record.created_at) > new Date(latestStreamerData.get(streamerName).created_at)) {
                  latestStreamerData.set(streamerName, record);
                }
              });
              
              // Create a mapping of server ID to streamer count
              const serverStreamerCounts: Record<string, number> = {};
              // Also track total viewers per server
              const serverViewerCounts: Record<string, number> = {};
              
              latestStreamerData.forEach((record) => {
                const serverId = record.serverId;
                if (!serverStreamerCounts[serverId]) {
                  serverStreamerCounts[serverId] = 0;
                }
                if (!serverViewerCounts[serverId]) {
                  serverViewerCounts[serverId] = 0;
                }
                
                serverStreamerCounts[serverId]++;
                serverViewerCounts[serverId] += record.viewer_count;
              });
              
              // Server streamer count summary
              statsContext += "### Streamers by Server\n\n";
              statsContext += "| Server | Streamers | Total Viewers |\n";
              statsContext += "|--------|-----------|---------------|\n";
              
              for (const serverId in serverStreamerCounts) {
                const serverName = serverNameMap[serverId] || `Server ${serverId}`;
                const streamerCount = serverStreamerCounts[serverId];
                const viewerCount = serverViewerCounts[serverId] || 0;
                statsContext += `| ${serverName} | ${streamerCount} | ${viewerCount} |\n`;
              }
              
              statsContext += "\n";
              
              // Top streamers list (sorted by viewer count)
              statsContext += "### Top Streamers\n\n";
              statsContext += "| Streamer | Viewers | Server | Game |\n";
              statsContext += "|----------|---------|--------|------|\n";
              
              const topStreamers = Array.from(latestStreamerData.values())
                .sort((a, b) => b.viewer_count - a.viewer_count)
                .slice(0, 20); // Top 20 streamers
              
              topStreamers.forEach(record => {
                const serverName = serverNameMap[record.serverId] || 'Unknown Server';
                statsContext += `| ${record.streamer_name} | ${record.viewer_count} | ${serverName} | ${record.game_name} |\n`;
              });
              
              // Total viewers
              const totalViewers = topStreamers.reduce((sum: number, record: any) => sum + record.viewer_count, 0);
              statsContext += `\n**Total viewers across top streamers: ${totalViewers}**\n\n`;
            } else {
              statsContext += "## GTA RP Streamers\n\nNo streamer data available.\n\n";
            }
            
            // 4.5: PEAK TIMES AND STATISTICS
            // --------------------
            if (timeRangeData["7d"].length > 0) {
              statsContext += "## Peak Times and Statistics\n\n";
              
              // Calculate peak hours for each server
              const hourCounts: Record<number, Record<string, number[]>> = {};
              
              timeRangeData["7d"].forEach(record => {
                const recordTime = new Date(record.timestamp);
                const hour = recordTime.getHours();
                const serverId = record.server_id;
                
                if (!hourCounts[hour]) {
                  hourCounts[hour] = {};
                }
                
                if (!hourCounts[hour][serverId]) {
                  hourCounts[hour][serverId] = [];
                }
                
                hourCounts[hour][serverId].push(record.player_count);
              });
              
              // Calculate average players per hour for each server
              const hourlyAverages: Record<number, Record<string, number>> = {};
              
              for (const hour in hourCounts) {
                hourlyAverages[hour] = {};
                
                for (const serverId in hourCounts[hour]) {
                  const counts = hourCounts[hour][serverId];
                  hourlyAverages[hour][serverId] = Math.round(
                    counts.reduce((sum: number, count: number) => sum + count, 0) / counts.length
                  );
                }
              }
              
              // Get peak hours for major servers
              const allServerIds = Array.from(new Set(timeRangeData["7d"].map(r => r.server_id)));
              const serversToAnalyze = allServerIds.slice(0, 5); // Limit to top 5 to avoid context overload
              
              serversToAnalyze.forEach(serverId => {
                const serverName = serverNameMap[serverId] || `Server ${serverId}`;
                statsContext += `### ${serverName} - Peak Hours\n\n`;
                
                // Find peak hours for this server
                let peakHour = 0;
                let peakAverage = 0;
                
                for (const hour in hourlyAverages) {
                  if (hourlyAverages[hour][serverId] && hourlyAverages[hour][serverId] > peakAverage) {
                    peakHour = parseInt(hour);
                    peakAverage = hourlyAverages[hour][serverId];
                  }
                }
                
                // Format peak time
                const peakTimeStart = `${peakHour}:00`;
                const peakTimeEnd = `${(peakHour + 1) % 24}:00`;
                
                statsContext += `- Peak time: ${peakTimeStart} - ${peakTimeEnd} UTC\n`;
                statsContext += `- Average players during peak: ${peakAverage}\n\n`;
              });
            }
          }
          
          // Add data timestamp
          statsContext += `Data last updated: ${new Date().toISOString()}\n\n`;
          
          // Add statistics context to prompt
          fullPrompt = `${statsContext}\n\n${fullPrompt}`;
          console.log("Added statistics context to prompt, size: " + statsContext.length + " characters");
          console.log("Has real data: " + hasRealData);
          
        } catch (supabaseError) {
          console.error('Error fetching data from Supabase:', supabaseError);
          
          // Add error information to the prompt
          statsContext += "## Error Fetching Data\n\n";
          statsContext += "There was an error retrieving the latest data. Using fallback information.\n\n";
          
          // Add some example data
          statsContext += "## Example Player Counts by Server (Fallback Data)\n\n";
          statsContext += "- NoPixel: 220 players\n";
          statsContext += "- Unscripted: 175 players\n";
          statsContext += "- Eclipse: 155 players\n";
          statsContext += "- Legacy: 130 players\n";
          statsContext += "- Mafia World: 110 players\n";
          statsContext += "\n**Total players across all tracked servers: 790**\n\n";
          
          statsContext += "## Example GTA RP Streamers (Fallback Data)\n\n";
          statsContext += "- Buddha: 15000 viewers, playing on NoPixel\n";
          statsContext += "- Summit1g: 25000 viewers, playing on Unscripted\n";
          statsContext += "- Penta: 8000 viewers, playing on NoPixel\n";
          statsContext += "- Kyle: 7500 viewers, playing on NoPixel\n";
          statsContext += "- Sodapoppin: 22000 viewers, playing on Eclipse\n";
          statsContext += "\n**Total viewers across top streamers: 77500**\n\n";
          
          statsContext += "NOTE: This is example fallback data. Real data is currently unavailable due to a database error.\n\n";
          fullPrompt = `${statsContext}\n\n${fullPrompt}`;
        }
      } else {
        console.error('Missing Supabase credentials');
        // Add a note about missing credentials
        let statsContext = "# Player and Streamer Data\n\n";
        statsContext += "Database credentials are missing. Using fallback information.\n\n";
        
        // Add some example data
        statsContext += "## Example Player Counts by Server (Fallback Data)\n\n";
        statsContext += "- NoPixel: 220 players\n";
        statsContext += "- Unscripted: 175 players\n";
        statsContext += "- Eclipse: 155 players\n";
        statsContext += "- Legacy: 130 players\n";
        statsContext += "- Mafia World: 110 players\n";
        statsContext += "\n**Total players across all tracked servers: 790**\n\n";
        
        statsContext += "## Example GTA RP Streamers (Fallback Data)\n\n";
        statsContext += "- Buddha: 15000 viewers, playing on NoPixel\n";
        statsContext += "- Summit1g: 25000 viewers, playing on Unscripted\n";
        statsContext += "- Penta: 8000 viewers, playing on NoPixel\n";
        statsContext += "- Kyle: 7500 viewers, playing on NoPixel\n";
        statsContext += "- Sodapoppin: 22000 viewers, playing on Eclipse\n";
        statsContext += "\n**Total viewers across top streamers: 77500**\n\n";
        
        statsContext += "NOTE: This is example fallback data. Real data is currently unavailable due to missing database credentials.\n\n";
        fullPrompt = `${statsContext}\n\n${fullPrompt}`;
      }
    }

    // Response content to be populated by API call
    let responseContent = '';

    // Make API call to Grok using the AI SDK
    try {
      console.log("Making API call to Grok with:", {
        model: process.env.GROK_MODEL || 'grok-1',
        promptLength: fullPrompt.length
      });
      
      const result = await generateText({
        model: xai(process.env.GROK_MODEL || 'grok-1'),
        prompt: fullPrompt,
        temperature: 0.7,
        maxTokens: 500,
      });
      
      // Log the result for debugging
      console.log("Raw API response type:", typeof result);
      console.log("Raw API response keys:", Object.keys(result));
      
      // Extract the response text
      responseContent = result.text || 'Sorry, I could not process your request';
    } catch (error: any) {
      console.error("Error with Grok API call:", error);
      // Simply propagate the error to the main error handler
      throw error;
    }

    // Log successful request
    await logApiRequest({
      ip,
      endpoint: '/api/grok',
      query: sanitizeQuery(userMessage.content),
      responseStatus: 200,
      level: 'info',
      message: 'Successfully processed query: ' + sanitizeQuery(userMessage.content)
    });
    
    // Return the response
    return NextResponse.json(
      { response: responseContent },
      { status: 200 }
    );

  } catch (error) {
    console.error('Error in Grok API:', error);
    
    // Log error
    await logApiRequest({
      ip,
      endpoint: '/api/grok',
      responseStatus: 500,
      level: 'error',
      message: `Error processing request: ${error instanceof Error ? error.message : 'Unknown error'}`
    });
    
    return NextResponse.json(
      { 
        error: 'An error occurred connecting to the Grok API. Please ensure you have correctly set up the following environment variables: GROK_API_KEY, GROK_API_BASE_URL, and GROK_MODEL.',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
} 

// Helper function to convert a time range to milliseconds
function getTimeRangeInMs(timeRange: TimeRange): number {
  const now = new Date();
  
  switch (timeRange) {
    case "1h": return 1 * 60 * 60 * 1000;
    case "2h": return 2 * 60 * 60 * 1000;
    case "4h": return 4 * 60 * 60 * 1000;
    case "6h": return 6 * 60 * 60 * 1000;
    case "8h": return 8 * 60 * 60 * 1000;
    case "24h": return 24 * 60 * 60 * 1000;
    case "7d": return 7 * 24 * 60 * 60 * 1000;
    case "30d": return 30 * 24 * 60 * 60 * 1000;
    case "90d": return 90 * 24 * 60 * 60 * 1000;
    case "180d": return 180 * 24 * 60 * 60 * 1000;
    case "365d": return 365 * 24 * 60 * 60 * 1000;
    case "all": return Number.MAX_SAFE_INTEGER;
    default: return 24 * 60 * 60 * 1000; // Default to 24 hours
  }
} 