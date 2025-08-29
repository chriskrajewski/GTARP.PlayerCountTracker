import { NextResponse } from 'next/server';
import { getServerName } from '@/lib/data';
import { createServerClient } from '@/lib/supabase-server';

interface TwitchUser {
  id: string;
  login: string;
  display_name: string;
  profile_image_url: string;
}

interface TwitchStream {
  id: string;
  user_id: string;
  user_name: string;
  game_name: string;
  title: string;
  viewer_count: number;
  started_at: string;
  thumbnail_url: string;
  tags: string[];
}

// Function to get Twitch access token
async function getTwitchToken() {
  const clientId = process.env.TWITCH_CLIENT_ID;
  const clientSecret = process.env.TWITCH_CLIENT_SECRET;
  
  if (!clientId || !clientSecret) {
    throw new Error('Twitch credentials are not configured');
  }
  
  const response = await fetch('https://id.twitch.tv/oauth2/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `client_id=${clientId}&client_secret=${clientSecret}&grant_type=client_credentials`,
  });
  
  if (!response.ok) {
    throw new Error('Failed to obtain Twitch access token');
  }
  
  const data = await response.json();
  return data.access_token;
}

// Function to fetch user profile images
async function fetchUserProfiles(accessToken: string, userIds: string[]): Promise<TwitchUser[]> {
  if (userIds.length === 0) return [];
  
  const clientId = process.env.TWITCH_CLIENT_ID;
  
  if (!clientId) {
    throw new Error('Twitch client ID is not configured');
  }
  
  // Split into batches of 100 as per Twitch API limits
  const batches = [];
  for (let i = 0; i < userIds.length; i += 100) {
    batches.push(userIds.slice(i, i + 100));
  }
  
  let allUsers: TwitchUser[] = [];
  
  for (const batch of batches) {
    const userIdParams = batch.map(id => `id=${id}`).join('&');
    const response = await fetch(
      `https://api.twitch.tv/helix/users?${userIdParams}`,
      {
        headers: {
          'Client-ID': clientId,
          'Authorization': `Bearer ${accessToken}`,
        },
      }
    );
    
    if (!response.ok) {
      throw new Error('Failed to fetch user profiles from Twitch');
    }
    
    const data = await response.json();
    allUsers = [...allUsers, ...(data.data as TwitchUser[])];
  }
  
  return allUsers;
}

// Function to get live status of streamers
async function getLiveStreamerStatus(usernames: string[], accessToken: string) {
  if (!usernames.length) return [];
  
  // Filter out non-ASCII usernames as Twitch API has issues with them
  const asciiOnlyUsernames = usernames.filter(name => {
    if (/^[\x00-\x7F]*$/.test(name)) {
      return true;
    }
    return false;
  });
  
  if (asciiOnlyUsernames.length === 0) {
    return [];
  }
  
  // Split into batches of 100 (Twitch API limit)
  const batchSize = 100;
  const batches = [];
  for (let i = 0; i < asciiOnlyUsernames.length; i += batchSize) {
    batches.push(asciiOnlyUsernames.slice(i, i + batchSize));
  }
  
  const allStreams = [];
  
  // Process each batch
  for (let i = 0; i < batches.length; i++) {
    const batch = batches[i];
    
    try {
      // Create the user_login query parameters
      let usernameParams = '';
      for (const username of batch) {
        try {
          // Append each username to the query
          usernameParams += `&user_login=${encodeURIComponent(username.toLowerCase())}`;
        } catch (e) {
          console.error(`Failed to encode username: ${username}`, e);
        }
      }
      
      // If all usernames failed encoding, skip this batch
      if (!usernameParams) {
        continue;
      }
      
      const url = `https://api.twitch.tv/helix/streams?first=100${usernameParams}`;
      
      const response = await fetch(url, {
        headers: {
          'Client-ID': process.env.TWITCH_CLIENT_ID || '',
          'Authorization': `Bearer ${accessToken}`
        }
      });
      
      // Handle API errors
      if (!response.ok) {
        const errorText = await response.text();
        console.error(`Twitch API error (${response.status}): ${errorText}`);
        
        // Special handling for 400 Bad Request (could be from malformed usernames)
        if (response.status === 400) {
          console.error('Bad Request error. Query params used:', usernameParams.substring(0, 200) + '...');
          
          // Try processing in smaller batches
          const smallerBatchSize = 20;
          const smallerBatches = [];
          for (let j = 0; j < batch.length; j += smallerBatchSize) {
            smallerBatches.push(batch.slice(j, j + smallerBatchSize));
          }
          
          // Process each smaller batch
          for (let k = 0; k < smallerBatches.length; k++) {
            try {
              const smallBatch = smallerBatches[k];
              let smallBatchParams = '';
              for (const username of smallBatch) {
                try {
                  smallBatchParams += `&user_login=${encodeURIComponent(username.toLowerCase())}`;
                } catch (e) {
                  // Skip usernames that can't be encoded
                  continue;
                }
              }
              
              if (!smallBatchParams) continue;
              
              const smallBatchUrl = `https://api.twitch.tv/helix/streams?first=100${smallBatchParams}`;
              
              const smallBatchResponse = await fetch(smallBatchUrl, {
                headers: {
                  'Client-ID': process.env.TWITCH_CLIENT_ID || '',
                  'Authorization': `Bearer ${accessToken}`
                }
              });
              
              if (smallBatchResponse.ok) {
                const smallBatchData = await smallBatchResponse.json();
                allStreams.push(...smallBatchData.data);
              } else {
                // If this smaller batch also fails, just continue
                continue;
              }
            } catch (smallBatchError) {
              console.error(`Error processing small batch ${k+1}:`, smallBatchError);
              continue;
            }
          }
          
          // Continue to next main batch after processing smaller batches
          continue;
        } else if (response.status === 400) {
          console.error(`Failed batch ${i+1} due to malformed query params`);
          continue;
        } else {
          console.error(`Failed batch ${i+1} with status ${response.status}`);
          continue;
        }
      }
      
      const data = await response.json();
      
      // Validate the response format
      if (!data || !Array.isArray(data.data)) {
        console.error('Unexpected response format from Twitch API:', JSON.stringify(data).slice(0, 200) + '...');
        continue;
      }
      
      // Add streams from this batch to the overall list
      allStreams.push(...data.data);
      
    } catch (error) {
      console.error(`Error processing batch ${i+1}:`, error);
      continue; // Continue with the next batch even if this one fails
    }
  }
  
  return allStreams;
}

export async function GET(
  request: Request,
  context: { params: Promise<{ serverId: string }> }
) {
  try {
    // Properly await params in Next.js 15+ API routes
    const params = await context.params;
    const serverId = params.serverId;
    
    if (!serverId) {
      return NextResponse.json(
        { error: 'Server ID is required' },
        { status: 400 }
      );
    }
    
    // Get server name for context
    const serverName = await getServerName(serverId);
    
    // Initialize Supabase server client
    const supabase = createServerClient();
    
    // Query Supabase for streamers on this server - get most recent records with limit
    const { data: streamersData, error: supabaseError } = await supabase
      .from('twitch_streams')
      .select('streamer_name')
      .eq('serverId', serverId)
      .order('created_at', { ascending: false })
      .limit(100);  // Limit to 100 streamers to avoid too many API calls
    
    if (supabaseError) {
      console.error('Supabase error:', supabaseError);
      throw new Error(`Failed to fetch streamers from database: ${supabaseError.message}`);
    }
    
    if (!streamersData || streamersData.length === 0) {
      return NextResponse.json([]);
    }
    
    // Extract unique streamer names
    const streamerNames = [...new Set(streamersData.map(s => s.streamer_name))];
    
    // Get Twitch token
    const accessToken = await getTwitchToken();
    
    if (!accessToken) {
      return NextResponse.json(
        { error: 'Could not authenticate with Twitch' },
        { status: 500 }
      );
    }
    
    // Get live status for all streamers
    const streams = await getLiveStreamerStatus(streamerNames, accessToken);
    
    if (streams.length === 0) {
      // If no streams, just return empty array
      return NextResponse.json([]);
    }
    
    // Fetch profile images for streamers
    const userIds = streams.map(stream => stream.user_id);
    const userProfiles = await fetchUserProfiles(accessToken, userIds);
    
    // Map to enrich stream data with profile images
    const enrichedStreams = streams.map(stream => {
      // Find matching user profile
      const userProfile = userProfiles.find(profile => profile.id === stream.user_id);
      
      const enrichedStream = {
        ...stream,
        profile_image_url: userProfile?.profile_image_url
      };
      
      return enrichedStream;
    });
    
    return NextResponse.json(enrichedStreams);
  } catch (error) {
    console.error('Error in streams API:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch streams' },
      { status: 500 }
    );
  }
} 