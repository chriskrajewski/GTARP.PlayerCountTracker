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

// Function to check which streamers are currently live
async function checkLiveStreamers(usernames: string[], accessToken: string) {
  try {
    // Filter out usernames with Unicode characters (Twitch API limitation)
    const asciiOnlyUsernames = usernames.filter(name => {
      const isAsciiOnly = /^[\x00-\x7F]*$/.test(name);
      if (!isAsciiOnly) {
        // Skip usernames with non-ASCII characters
      }
      return isAsciiOnly;
    });
    
    if (asciiOnlyUsernames.length === 0) {
      return [];
    }
    
    // Process in batches of 100 (Twitch API limit)
    const batchSize = 100;
    const batches = [];
    
    for (let i = 0; i < asciiOnlyUsernames.length; i += batchSize) {
      batches.push(asciiOnlyUsernames.slice(i, i + batchSize));
    }
    
    const allStreams = [];
    
    // Process each batch
    for (let i = 0; i < batches.length; i++) {
      const batch = batches[i];
      
      // Build the query parameters for this batch
      let usernameParams = '';
      
      try {
        // Properly encode each username
        usernameParams = batch.map(username => `user_login=${encodeURIComponent(username.toLowerCase())}`).join('&');
      } catch (e) {
        // Skip this batch if encoding fails
        continue;
      }
      
      if (!usernameParams) {
        continue;
      }
      
      const url = `https://api.twitch.tv/helix/streams?${usernameParams}`;
      
      try {
        const response = await fetch(url, {
          headers: {
            'Client-ID': process.env.TWITCH_CLIENT_ID || '',
            'Authorization': `Bearer ${accessToken}`
          }
        });
        
        if (!response.ok) {
          // Handle specific error cases
          if (response.status === 400) {
            // Try breaking the batch into smaller chunks
            const smallerBatchSize = Math.ceil(batch.length / 2);
            const smallerBatches = [];
            
            for (let j = 0; j < batch.length; j += smallerBatchSize) {
              smallerBatches.push(batch.slice(j, j + smallerBatchSize));
            }
            
            // Process each smaller batch
            for (let k = 0; k < smallerBatches.length; k++) {
              const smallBatch = smallerBatches[k];
              const smallBatchParams = smallBatch.map(
                username => `user_login=${encodeURIComponent(username.toLowerCase())}`
              ).join('&');
              
              const smallBatchUrl = `https://api.twitch.tv/helix/streams?${smallBatchParams}`;
              
              try {
                const smallBatchResponse = await fetch(smallBatchUrl, {
                  headers: {
                    'Client-ID': process.env.TWITCH_CLIENT_ID || '',
                    'Authorization': `Bearer ${accessToken}`
                  }
                });
                
                if (smallBatchResponse.ok) {
                  const smallBatchData = await smallBatchResponse.json();
                  allStreams.push(...smallBatchData.data);
                }
              } catch (smallBatchError) {
                // Skip this smaller batch
              }
            }
          }
          continue;
        }
        
        const data = await response.json();
        
        if (!data || !data.data) {
          continue;
        }
        
        // Add streams from this batch to our results
        data.data.forEach((stream: any, idx: number) => {
          allStreams.push(stream);
        });
      } catch (error) {
        // Skip this batch
      }
    }
    
    return allStreams;
  } catch (error) {
    return [];
  }
}

export async function GET(
  request: Request,
  context: { params: { serverId: string } }
) {
  try {
    // Properly await params in Next.js 13+ API routes
    const params = await Promise.resolve(context.params);
    const serverId = params.serverId;
    
    // Initialize Supabase server client
    const supabase = createServerClient();
    
    // Check for server in database
    const { data: serverData, error: serverError } = await supabase
      .from('servers')
      .select('name')
      .eq('id', serverId)
      .single();
    
    if (serverError) {
      return NextResponse.json({ error: 'Server not found' }, { status: 404 });
    }
    
    const serverName = serverData?.name;
    
    // Fetch streamers associated with this server
    const { data: streamersData, error: supabaseError } = await supabase
      .from('streamers')
      .select('name')
      .eq('server_id', serverId);
      
    if (supabaseError) {
      return NextResponse.json({ error: 'Database error' }, { status: 500 });
    }
    
    if (!streamersData || streamersData.length === 0) {
      return NextResponse.json([]);
    }
    
    // Extract streamer names from data
    const streamerNames = [...new Set(streamersData.map(s => s.name.toLowerCase()))];
    
    // Get access token for Twitch API
    const tokenResponse = await fetch('https://id.twitch.tv/oauth2/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: process.env.TWITCH_CLIENT_ID || '',
        client_secret: process.env.TWITCH_CLIENT_SECRET || '',
        grant_type: 'client_credentials'
      })
    });
    
    if (!tokenResponse.ok) {
      return NextResponse.json({ error: 'Failed to authenticate with Twitch' }, { status: 502 });
    }
    
    const tokenData = await tokenResponse.json();
    const accessToken = tokenData.access_token;
    
    // Check which streamers are currently live
    const streams = await checkLiveStreamers(streamerNames, accessToken);
    
    if (streams.length === 0) {
      return NextResponse.json([]);
    }
    
    // Get user profiles to retrieve profile images
    const userIds = streams.map((stream: any) => stream.user_id);
    const userIdChunks = [];
    
    for (let i = 0; i < userIds.length; i += 100) {
      userIdChunks.push(userIds.slice(i, i + 100));
    }
    
    const userProfiles: any[] = [];
    
    for (const chunk of userIdChunks) {
      const userParams = chunk.map(id => `id=${id}`).join('&');
      
      const usersResponse = await fetch(`https://api.twitch.tv/helix/users?${userParams}`, {
        headers: {
          'Client-ID': process.env.TWITCH_CLIENT_ID || '',
          'Authorization': `Bearer ${accessToken}`
        }
      });
      
      if (usersResponse.ok) {
        const userData = await usersResponse.json();
        userProfiles.push(...userData.data);
      }
    }
    
    // Combine stream data with profile images
    const enhancedStreams = streams.map((stream: any) => {
      const profile = userProfiles.find((prof: any) => prof.id === stream.user_id);
      
      const result = {
        ...stream,
        profile_image_url: profile?.profile_image_url
      };
      
      // Handle potentially missing thumbnail
      if (!result.thumbnail_url) {
        result.thumbnail_url = 'https://static-cdn.jtvnw.net/ttv-static/404_preview-440x248.jpg';
      }
      
      return result;
    });
    
    return NextResponse.json(enhancedStreams);
  } catch (error) {
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
} 