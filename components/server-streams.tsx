"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Loader2, ExternalLink, Twitch } from "lucide-react";

interface StreamData {
  id: string;
  user_id: string;
  user_name: string;
  game_name: string;
  title: string;
  viewer_count: number;
  started_at: string;
  thumbnail_url: string;
  tags: string[];
  profile_image_url?: string;
}

interface ServerStreamsProps {
  serverId: string;
  serverName: string;
}

export default function ServerStreams({ serverId, serverName }: ServerStreamsProps) {
  const [streams, setStreams] = useState<StreamData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [detailedError, setDetailedError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchStreams() {
      try {
        setLoading(true);
        setError(null);
        setDetailedError(null);
        
        console.log(`Fetching streams for server ID: ${serverId}`);
        const response = await fetch(`/api/streams/${serverId}`);
        
        // Handle different error cases
        if (!response.ok) {
          if (response.status === 404) {
            throw new Error("Server not found");
          } else if (response.status === 429) {
            throw new Error("Rate limit exceeded. Please try again later.");
          } else if (response.status >= 500) {
            // Try to get detailed error info from the response
            try {
              const errorData = await response.json();
              if (errorData && errorData.error) {
                setDetailedError(errorData.error);
                throw new Error("Server error");
              }
            } catch (parseErr) {
              // Ignore JSON parsing error and use the default message
            }
            throw new Error("Server error. The Twitch API might be unavailable.");
          } else {
            throw new Error(`Failed to fetch streams: ${response.status} ${response.statusText}`);
          }
        }
        
        const data = await response.json();
        console.log(`Retrieved ${data.length} streams from API`);
        setStreams(data);
      } catch (err) {
        console.error("Error fetching streams:", err);
        if (err instanceof Error) {
          setError(err.message);
        } else {
          setError("Failed to load streams. Please try again later.");
        }
      } finally {
        setLoading(false);
      }
    }
    
    fetchStreams();
  }, [serverId]);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex justify-center items-center py-10">
          <Loader2 className="h-10 w-10 animate-spin text-primary" />
        </div>
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {[...Array(6)].map((_, i) => (
            <Card key={i} className="overflow-hidden">
              <Skeleton className="h-[180px] w-full" />
              <CardContent className="p-4">
                <Skeleton className="h-4 w-3/4 mb-2" />
                <Skeleton className="h-4 w-full" />
                <div className="flex justify-between items-center mt-4">
                  <Skeleton className="h-8 w-8 rounded-full" />
                  <Skeleton className="h-4 w-16" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-8 text-center border rounded-lg bg-muted/20">
        <div className="text-destructive mb-2 text-lg">Error</div>
        <p className="mb-2">{error}</p>
        {detailedError && (
          <p className="text-sm text-muted-foreground mt-2 mb-4">
            Details: {detailedError}
          </p>
        )}
        <p className="text-sm text-muted-foreground mt-4">
          Make sure you have the correct Twitch API credentials in your environment variables.
        </p>
      </div>
    );
  }

  if (streams.length === 0) {
    return (
      <div className="p-10 text-center border rounded-lg bg-muted/20">
        <h2 className="text-xl font-semibold mb-2">No Live Streams</h2>
        <p className="text-muted-foreground">
          There are currently no live streamers broadcasting from {serverName}.
        </p>
        <p className="text-muted-foreground mt-2">
          Streamers from this server may be offline right now. Check back later or try another server.
        </p>
        <p className="text-muted-foreground mt-4 text-sm">
          <Twitch className="h-4 w-4 inline mr-2 text-[#9146FF]" />
          Twitch stream status is updated in real-time
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-lg font-medium">{streams.length} Live {streams.length === 1 ? 'Stream' : 'Streams'}</h2>
      </div>
      
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {streams.map((stream) => (
          <StreamCard key={stream.id} stream={stream} />
        ))}
      </div>
    </div>
  );
}

function StreamCard({ stream }: { stream: StreamData }) {
  // Replace template variables in thumbnail URL with appropriate dimensions
  const thumbnailUrl = stream.thumbnail_url
    ? stream.thumbnail_url
        .replace('{width}', '440')
        .replace('{height}', '248')
    : '/placeholder-stream.jpg'; // Fallback image
    
  // Format viewer count
  const formatViewerCount = (count: number): string => {
    if (count >= 1000) {
      return `${(count / 1000).toFixed(1)}K`;
    }
    return count.toString();
  };
  
  return (
    <Card className="overflow-hidden hover:shadow-md transition-shadow">
      <a 
        href={`https://twitch.tv/${stream.user_name}`} 
        target="_blank" 
        rel="noopener noreferrer"
        className="block"
      >
        <div className="relative aspect-video">
          {/* Use regular img tag for thumbnail for better compatibility */}
          <img 
            src={thumbnailUrl} 
            alt={`${stream.user_name}'s stream`}
            className="absolute inset-0 w-full h-full object-cover"
          />
          <div className="absolute top-2 right-2 bg-red-500 text-white px-2 py-0.5 text-xs font-semibold rounded">
            LIVE
          </div>
          <div className="absolute bottom-2 left-2 bg-black/70 text-white px-2 py-0.5 text-xs font-semibold rounded flex items-center">
            <div className="w-2 h-2 bg-red-500 rounded-full mr-1.5"></div>
            {formatViewerCount(stream.viewer_count)} viewers
          </div>
        </div>
      </a>
      
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          {stream.profile_image_url ? (
            <div className="flex-shrink-0 w-10 h-10 mt-1">
              {/* Use regular img tag for profile image for better compatibility */}
              <img 
                src={stream.profile_image_url}
                alt={stream.user_name}
                className="w-10 h-10 rounded-full"
              />
            </div>
          ) : (
            <div className="flex-shrink-0 w-10 h-10 mt-1 bg-muted rounded-full flex items-center justify-center">
              <Twitch className="h-5 w-5 text-[#9146FF]" />
            </div>
          )}
          
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-sm truncate hover:text-primary">
              <a 
                href={`https://twitch.tv/${stream.user_name}`} 
                target="_blank" 
                rel="noopener noreferrer"
                className="hover:underline flex items-center"
              >
                {stream.user_name}
                <Twitch className="h-3.5 w-3.5 ml-1.5 text-[#9146FF]" />
              </a>
            </h3>
            <p className="text-sm text-muted-foreground line-clamp-2 mt-1">
              {stream.title}
            </p>
            
            <div className="mt-3 flex flex-wrap gap-1">
              {stream.tags && stream.tags.slice(0, 3).map((tag, index) => (
                <span 
                  key={index} 
                  className="inline-flex items-center px-2 py-0.5 rounded text-xs bg-muted"
                >
                  {tag}
                </span>
              ))}
            </div>
          </div>
        </div>
        
        <div className="mt-3 pt-3 border-t text-xs text-muted-foreground">
          Playing: {stream.game_name}
        </div>
      </CardContent>
    </Card>
  );
} 