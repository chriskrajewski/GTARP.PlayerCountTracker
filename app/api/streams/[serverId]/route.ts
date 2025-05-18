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

// Function to fetch stream details by username
async function fetchStreamsByUsernames(accessToken: string, usernames: string[]): Promise<TwitchStream[]> {
  if (usernames.length === 0) return [];
  
  const clientId = process.env.TWITCH_CLIENT_ID;
  
  if (!clientId) {
    throw new Error('Twitch client ID is not configured');
  }
  
  console.log(`Checking live status for ${usernames.length} streamers...`);
  
  // Split into batches of 100 as per Twitch API limits
  const batches = [];
  for (let i = 0; i < usernames.length; i += 100) {
    batches.push(usernames.slice(i, i + 100));
  }
  
  let allStreams: TwitchStream[] = [];
  
  for (let i = 0; i < batches.length; i++) {
    const batch = batches[i];
    console.log(`Processing batch ${i+1}/${batches.length} with ${batch.length} streamers`);
    
    try {
      // Create the query parameters string
      const usernameParams = batch.map(username => `user_login=${encodeURIComponent(username.trim())}`).join('&');
      const url = `https://api.twitch.tv/helix/streams?${usernameParams}`;
      console.log(`Fetching from Twitch API: ${url.substring(0, 100)}...`);
      
      const response = await fetch(url, {
        headers: {
          'Client-ID': clientId,
          'Authorization': `Bearer ${accessToken}`,
        },
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error(`Twitch API error (${response.status}): ${errorText}`);
        
        if (response.status === 401) {
          throw new Error('Twitch authentication failed. Check your credentials.');
        } else if (response.status === 429) {
          throw new Error('Twitch API rate limit exceeded. Try again later.');
        } else {
          throw new Error(`Failed to fetch streams from Twitch: ${response.status} ${response.statusText}`);
        }
      }
      
      const data = await response.json();
      
      if (!data.data || !Array.isArray(data.data)) {
        console.error('Unexpected response format from Twitch API:', JSON.stringify(data).slice(0, 200) + '...');
        throw new Error('Unexpected response format from Twitch API');
      }
      
      console.log(`Batch ${i+1}: Found ${data.data.length} live streams`);
      
      // Log the first few streams for debugging
      if (data.data.length > 0) {
        data.data.slice(0, 3).forEach((stream: TwitchStream, idx: number) => {
          console.log(`Stream ${idx+1}: ${stream.user_name} - "${stream.title.substring(0, 50)}..."`);
        });
      }
      
      allStreams = [...allStreams, ...(data.data as TwitchStream[])];
    } catch (error) {
      console.error(`Error processing batch ${i+1}:`, error);
      // Continue with next batch rather than failing completely
    }
  }
  
  console.log(`Total live streams found: ${allStreams.length}`);
  return allStreams;
}

export async function GET(
  request: Request,
  context: { params: { serverId: string } }
) {
  try {
    // Properly await params in Next.js 13+ API routes
    const params = await Promise.resolve(context.params);
    const serverId = params.serverId;
    console.log(`Fetching streams for server ID: ${serverId}`);
    
    // Get server name for context
    const serverName = await getServerName(serverId);
    console.log(`Server name resolved to: ${serverName}`);
    
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
    
    console.log(`Found ${streamersData?.length || 0} streamers in Supabase for server: ${serverName}`);
    
    if (!streamersData || streamersData.length === 0) {
      return NextResponse.json([]);
    }
    
    // Extract unique streamer names
    const streamerNames = [...new Set(streamersData.map(s => s.streamer_name))];
    console.log(`Unique streamer names: ${streamerNames.slice(0, 20).join(', ')}${streamerNames.length > 20 ? '...' : ''}`);
    
    // Get Twitch token
    const accessToken = await getTwitchToken();
    console.log('Successfully obtained Twitch access token');
    
    // Fetch live stream data for these streamers
    const streams = await fetchStreamsByUsernames(accessToken, streamerNames);
    console.log(`Retrieved ${streams.length} live streams from Twitch API`);
    
    // If no streams found, log some additional debug info
    if (streams.length === 0) {
      console.log('No live streams found. Sample streamer names:', streamerNames.slice(0, 5));
      
      // Check if at least one streamer is valid by getting their user info
      try {
        const sampleUser = streamerNames[0];
        if (sampleUser) {
          console.log(`Checking if user exists: ${sampleUser}`);
          const response = await fetch(
            `https://api.twitch.tv/helix/users?login=${sampleUser}`,
            {
              headers: {
                'Client-ID': process.env.TWITCH_CLIENT_ID!,
                'Authorization': `Bearer ${accessToken}`,
              },
            }
          );
          
          if (response.ok) {
            const userData = await response.json();
            console.log(`User check response: ${JSON.stringify(userData)}`);
          } else {
            console.log(`User check failed: ${response.status} ${response.statusText}`);
          }
        }
      } catch (e) {
        console.error('Error checking sample user:', e);
      }
      
      return NextResponse.json([]);
    }
    
    // Fetch profile images for streamers
    const userIds = streams.map(stream => stream.user_id);
    const userProfiles = await fetchUserProfiles(accessToken, userIds);
    console.log(`Retrieved ${userProfiles.length} user profiles`);

    // Log the first profile image URL for debugging
    if (userProfiles.length > 0) {
      console.log(`Sample profile image URL: ${userProfiles[0].profile_image_url}`);
    }
    
    // Merge profile images with stream data
    const enhancedStreams = streams.map(stream => {
      const profile = userProfiles.find(user => user.id === stream.user_id);
      
      // Log for debugging
      if (profile) {
        console.log(`Found profile for ${stream.user_name}`);
      } else {
        console.log(`No profile found for ${stream.user_name}`);
      }
      
      // Make sure thumbnail_url exists
      if (!stream.thumbnail_url) {
        console.log(`No thumbnail URL for ${stream.user_name}`);
      } else {
        console.log(`Thumbnail URL for ${stream.user_name}: ${stream.thumbnail_url}`);
      }
      
      return {
        ...stream,
        profile_image_url: profile ? profile.profile_image_url : null
      };
    });
    
    return NextResponse.json(enhancedStreams);
  } catch (error) {
    console.error('Error in streams API:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch streams' },
      { status: 500 }
    );
  }
} 