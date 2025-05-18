"use client";

import { useState, useEffect, useRef } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Loader2, ExternalLink, Twitch, X } from "lucide-react";

// Define Twitch embed types
declare global {
  interface Window {
    Twitch?: {
      Embed: {
        new (
          elementId: HTMLElement,
          options: {
            width: string | number;
            height: string | number;
            channel: string;
            layout?: string;
            autoplay?: boolean;
            muted?: boolean;
            parent?: string[];
          }
        ): {
          addEventListener: (event: string, callback: () => void) => void;
          pause: () => void;
        };
        VIDEO_READY: string;
      };
    };
  }
}

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
  const [activeStream, setActiveStream] = useState<StreamData | null>(null);

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

  // Load Twitch embed script once when component mounts
  useEffect(() => {
    const script = document.createElement('script');
    script.src = 'https://embed.twitch.tv/embed/v1.js';
    script.async = true;
    script.defer = true;
    script.id = 'twitch-embed-script';

    // Only add the script if it doesn't already exist
    if (!document.getElementById('twitch-embed-script')) {
      document.body.appendChild(script);
    }

    // Cleanup function
    return () => {
      // Leave the script in the DOM as other components might need it
    };
  }, []);

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
          <StreamCard 
            key={stream.id} 
            stream={stream} 
            onClick={() => setActiveStream(stream)}
          />
        ))}
      </div>

      {/* Stream Modal */}
      {activeStream && (
        <StreamModal 
          stream={activeStream} 
          onClose={() => setActiveStream(null)} 
        />
      )}
    </div>
  );
}

function StreamCard({ stream, onClick }: { stream: StreamData; onClick: () => void }) {
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
    <Card className="overflow-hidden hover:shadow-md transition-shadow relative group">
      <div 
        className="cursor-pointer"
        onClick={onClick}
      >
        <div className="relative aspect-video">
          {/* Use regular img tag for thumbnail for better Safari compatibility */}
          <img 
            src={thumbnailUrl} 
            alt={`${stream.user_name}'s stream`}
            loading="lazy"
            className="absolute inset-0 w-full h-full object-cover"
          />
          <div className="absolute top-2 right-2 bg-red-500 text-white px-2 py-0.5 text-xs font-semibold rounded">
            LIVE
          </div>
          <div className="absolute bottom-2 left-2 bg-black/70 text-white px-2 py-0.5 text-xs font-semibold rounded flex items-center">
            <div className="w-2 h-2 bg-red-500 rounded-full mr-1.5"></div>
            {formatViewerCount(stream.viewer_count)} viewers
          </div>
          
          {/* Play button overlay */}
          <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
            <div className="bg-white/20 p-4 rounded-full">
              <Twitch className="h-8 w-8 text-white" />
            </div>
          </div>
        </div>
      </div>
      
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          {stream.profile_image_url ? (
            <div className="flex-shrink-0 w-10 h-10 mt-1">
              {/* Use regular img tag for profile image for better Safari compatibility */}
              <img 
                src={stream.profile_image_url}
                alt={stream.user_name}
                loading="lazy"
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

function StreamModal({ stream, onClose }: { stream: StreamData, onClose: () => void }) {
  useEffect(() => {
    // Add overflow:hidden to body when modal is open
    document.body.style.overflow = 'hidden';
    
    // Cleanup when modal closes
    return () => {
      document.body.style.overflow = '';
    };
  }, []);
  
  // Simplify parent domain handling for better Safari compatibility
  const parentDomain = typeof window !== 'undefined' ? window.location.hostname : 'localhost';
  
  // Properly encode usernames to handle Unicode characters
  const encodedUsername = encodeURIComponent(stream.user_name.toLowerCase());
  
  // Use encoded username in all URLs
  const iframeUrl = `https://player.twitch.tv/?channel=${encodedUsername}&parent=${parentDomain}&autoplay=true`;
  
  // Use the OBS chat URL as requested in the original requirement
  const obsChannelName = encodedUsername;
  
  return (
    <div className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center">
      <div className="relative w-full h-[90vh] max-w-[95vw] flex flex-col">
        <button 
          className="absolute top-4 right-4 z-10 p-2 bg-black/50 rounded-full text-white hover:bg-black/80 transition-colors"
          onClick={onClose}
        >
          <X className="h-6 w-6" />
        </button>
        
        <div className="flex flex-1 overflow-hidden">
          {/* Main content area with proper video aspect ratio */}
          <div className="flex flex-col flex-1">
            {/* Stream header */}
            <div className="bg-black p-4 flex items-center">
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-white flex items-center">
                  {stream.user_name}
                  <span className="ml-2 text-xs bg-red-600 text-white px-2 py-0.5 rounded">LIVE</span>
                </h3>
                <p className="text-gray-300 text-sm line-clamp-1">{stream.title}</p>
              </div>
              <div className="text-gray-300 text-sm">
                {stream.viewer_count.toLocaleString()} viewers
              </div>
            </div>
            
            {/* Stream player with 16:9 aspect ratio */}
            <div className="flex-1 bg-black relative min-h-0">
              <iframe 
                src={iframeUrl}
                className="absolute inset-0 w-full h-full border-0"
                allowFullScreen
                allow="autoplay; encrypted-media"
              ></iframe>
            </div>
          </div>
          
          {/* Chat sidebar with OBS Chat as requested */}
          <div className="w-[340px] hidden md:flex flex-col flex-shrink-0 border-l border-black bg-black">
            <div className="p-2 bg-black text-white text-sm font-medium border-b border-black flex justify-between items-center">
              <span>STREAM CHAT</span>
            </div>
            
            {/* Custom container for OBS Chat with forced black background */}
            <div className="flex-1 bg-black overflow-hidden relative">
              <iframe 
                className="w-full h-full border-0"
                srcDoc={`
                  <!DOCTYPE html>
                  <html style="background: #000000;">
                    <head>
                      <style>
                        html, body {
                          margin: 0;
                          padding: 0;
                          background-color: #000000;
                          height: 100%;
                          width: 100%;
                          overflow: hidden;
                        }
                        
                        /* Container for OBS chat */
                        #chat-container {
                          position: absolute;
                          top: 0;
                          left: 0;
                          right: 0;
                          bottom: 0;
                          background-color: #000000;
                        }
                        
                        /* Style the iframe */
                        #obs-chat {
                          border: none;
                          width: 100%;
                          height: 100%;
                          background-color: #000000;
                          position: relative;
                          z-index: 1;
                        }
                        
                        /* Add black overlay */
                        #black-overlay {
                          position: absolute;
                          top: 0;
                          left: 0;
                          width: 100%;
                          height: 100%;
                          background-color: #000000;
                          opacity: 0.2;
                          z-index: 2;
                          pointer-events: none;
                        }
                      </style>
                    </head>
                    <body>
                      <div id="chat-container">
                        <iframe 
                          id="obs-chat"
                          src="https://nightdev.com/hosted/obschat/?theme=dark&channel=${obsChannelName}&fade=false&bot_activity=true&prevent_clipping=true&background=000000&background_opacity=100&text_color=ffffff&text_opacity=100"
                          allowfullscreen="true"
                        ></iframe>
                        <div id="black-overlay"></div>
                      </div>
                      
                      <script>
                        // Add a script to force black background
                        document.addEventListener('DOMContentLoaded', function() {
                          // Reference to the iframe
                          const obsChat = document.getElementById('obs-chat');
                          
                          // Function to check and apply black background
                          function forceBlackBackground() {
                            try {
                              // Try to access the iframe's document
                              const iframeDoc = obsChat.contentDocument || obsChat.contentWindow.document;
                              
                              // Create a style element
                              const style = document.createElement('style');
                              style.textContent = \`
                                html, body, div, iframe, ul, li, p, span {
                                  background-color: #000000 !important;
                                  background: #000000 !important;
                                }
                                
                                /* Target specific OBS chat elements */
                                #chat-wrapper, #chat-container {
                                  background-color: #000000 !important;
                                  background: #000000 !important;
                                }
                                
                                /* Force any potential white elements to be black */
                                [style*="background-color: white"],
                                [style*="background-color: #fff"],
                                [style*="background-color: rgb(255, 255, 255)"],
                                [style*="background: white"],
                                [style*="background: #fff"],
                                [style*="background: rgb(255, 255, 255)"] {
                                  background-color: #000000 !important;
                                  background: #000000 !important;
                                }
                              \`;
                              
                              // Append the style to the iframe's document
                              iframeDoc.head.appendChild(style);
                              
                              // Also directly set background color on body and html
                              iframeDoc.documentElement.style.backgroundColor = '#000000';
                              iframeDoc.body.style.backgroundColor = '#000000';
                              
                              console.log('Applied black background to OBS chat');
                            } catch (err) {
                              console.error('Failed to apply black background:', err);
                            }
                          }
                          
                          // Apply black background when iframe loads
                          obsChat.onload = forceBlackBackground;
                          
                          // Also try applying it repeatedly at first
                          let attempts = 0;
                          const interval = setInterval(function() {
                            forceBlackBackground();
                            attempts++;
                            
                            if (attempts >= 10) {
                              clearInterval(interval);
                            }
                          }, 500);
                        });
                      </script>
                    </body>
                  </html>
                `}
                sandbox="allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox"
              ></iframe>
            </div>
            
            <div className="px-2 py-2 bg-black border-t border-black text-sm text-center flex items-center justify-center gap-2">
              <Twitch className="h-4 w-4 text-[#9146FF]" />
              <a 
                href={`https://www.twitch.tv/${encodedUsername}/`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[#9146FF] hover:underline text-sm"
              >
                Watch on Twitch
              </a>
            </div>
          </div>
        </div>
        
        {/* Mobile chat button */}
        <div className="md:hidden p-2 bg-black text-center">
          <a 
            href={`https://www.twitch.tv/popout/${encodedUsername}/chat?popout=`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block py-1.5 px-4 bg-[#9146FF] text-white rounded text-sm"
          >
            Open Chat
          </a>
        </div>
      </div>
    </div>
  );
} 