import type { Metadata } from 'next'
import { supabase } from '@/lib/supabase'

// Generate metadata dynamically based on server ID
export async function generateMetadata(
  props: { params: { serverId: string } }
): Promise<Metadata> {
  // Destructure after receiving the complete props object
  const { params } = props;
  const serverId = params.serverId;
  let serverName = "Server";
  
  try {
    // Query the database for the server name
    const { data, error } = await supabase
      .from('servers')
      .select('server_name')
      .eq('server_id', serverId)
      .single();
    
    if (data && !error) {
      serverName = data.server_name;
    }
  } catch (error) {
    console.error('Error fetching server name:', error);
  }
  
  return {
    title: `${serverName} Streams - GTA RP Player Count Tracker`,
    description: `Watch active Twitch streams for ${serverName} GTA RP server`,
  };
}

export default function ServerStreamsLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
} 