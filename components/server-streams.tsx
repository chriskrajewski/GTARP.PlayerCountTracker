"use client";

import { useState, useEffect, useRef } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Loader2, ExternalLink, Twitch, X } from "lucide-react";
import { useFeatureGate, FEATURE_GATES } from "@/lib/statsig";

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
  
  // New state for multi-stream functionality
  const [selectedStreams, setSelectedStreams] = useState<StreamData[]>([]);
  const [isMultiSelectMode, setIsMultiSelectMode] = useState(false);
  
  // New state for search/filter functionality
  const [searchQuery, setSearchQuery] = useState("");
  const [filteredStreams, setFilteredStreams] = useState<StreamData[]>([]);
  
  // For mobile detection - only used on desktop
  const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;

  // FORCE ENABLE for debugging
  const isStreamViewerEnabled = true;
  const isMultiStreamEnabled = true;
  
  useEffect(() => {
    console.log('ServerStreams rendering with features forced ON:', {
      isStreamViewerEnabled,
      isMultiStreamEnabled
    });
  }, []);

  useEffect(() => {
    async function fetchStreams() {
      try {
        if (!isStreamViewerEnabled) {
          setLoading(false);
          return;
        }
        
        setLoading(true);
        setError(null);
        setDetailedError(null);
        
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
  }, [serverId, isStreamViewerEnabled]);

  // Load Twitch embed script once when component mounts
  useEffect(() => {
    if (!isStreamViewerEnabled) return;
    
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
  }, [isStreamViewerEnabled]);

  // Filter streams based on search query
  useEffect(() => {
    if (!searchQuery.trim()) {
      setFilteredStreams(streams);
    } else {
      const query = searchQuery.toLowerCase();
      const filtered = streams.filter((stream) => 
        stream.title.toLowerCase().includes(query) || 
        stream.user_name.toLowerCase().includes(query) ||
        stream.game_name.toLowerCase().includes(query)
      );
      setFilteredStreams(filtered);
    }
  }, [searchQuery, streams]);

  // Function to toggle a stream selection
  const toggleStreamSelection = (stream: StreamData) => {
    setSelectedStreams(prev => {
      // Check if stream is already selected
      const isSelected = prev.some(s => s.id === stream.id);
      
      if (isSelected) {
        // Remove from selected streams
        return prev.filter(s => s.id !== stream.id);
      } else {
        // Add to selected streams (limit to 8 streams max)
        if (prev.length >= 8) {
          alert("You can select up to 8 streams at once");
          return prev;
        }
        return [...prev, stream];
      }
    });
  };

  // Function to launch multi-stream view
  const launchMultiStream = () => {
    if (!isMultiStreamEnabled || selectedStreams.length === 0) {
      alert("Please select at least one stream");
      return;
    }
    
    // Encode the selected stream usernames as a URL parameter
    const streamers = selectedStreams.map(stream => encodeURIComponent(stream.user_name.toLowerCase())).join(',');
    window.open(`/multi-stream?streamers=${streamers}`, "_blank");
  };

  // Toggle multi-select mode
  const toggleMultiSelectMode = () => {
    if (isMultiSelectMode) {
      // Clear selections when exiting multi-select mode
      setSelectedStreams([]);
    }
    setIsMultiSelectMode(!isMultiSelectMode);
  };

  // Handle stream selection
  const handleStreamClick = (stream: StreamData) => {
    // Skip modal on mobile - direct links are handled in the StreamCard component
    if (!isMobile) {
      setActiveStream(stream);
    }
  };

  if (!isStreamViewerEnabled) {
    return (
      <div className="py-12 px-6 bg-gray-800 border border-gray-700 rounded-md text-center">
        <Twitch className="h-10 w-10 mx-auto mb-4 text-purple-400 opacity-50" />
        <h3 className="text-lg font-semibold mb-2 text-gray-100">Stream Viewer Unavailable</h3>
        <p className="text-gray-400 max-w-md mx-auto">
          The stream viewer feature is currently unavailable.
        </p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex justify-center items-center py-10">
          <Loader2 className="h-10 w-10 animate-spin text-purple-400" />
        </div>
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {[...Array(6)].map((_, i) => (
            <Card key={i} className="overflow-hidden bg-gray-800 border-gray-700">
              <Skeleton className="h-[180px] w-full bg-gray-700" />
              <CardContent className="p-4">
                <Skeleton className="h-4 w-3/4 mb-2 bg-gray-700" />
                <Skeleton className="h-4 w-full bg-gray-700" />
                <div className="flex justify-between items-center mt-4">
                  <Skeleton className="h-8 w-8 rounded-full bg-gray-700" />
                  <Skeleton className="h-4 w-16 bg-gray-700" />
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
      <div className="p-6 bg-gray-800 border border-gray-700 rounded-md text-gray-100">
        <h3 className="text-lg font-semibold mb-2">Could not load streams</h3>
        <p className="text-gray-300 mb-4">{error}</p>
        {detailedError && (
          <div className="mt-2 p-4 bg-gray-900 border border-gray-700 rounded text-gray-400 text-sm overflow-x-auto">
            <pre>{detailedError}</pre>
          </div>
        )}
      </div>
    );
  }

  if (streams.length === 0) {
    return (
      <div className="py-12 px-6 bg-gray-800 border border-gray-700 rounded-md text-center">
        <Twitch className="h-10 w-10 mx-auto mb-4 text-purple-400 opacity-50" />
        <h3 className="text-lg font-semibold mb-2 text-gray-100">No Active Streams</h3>
        <p className="text-gray-400 max-w-md mx-auto">
          There are currently no streamers broadcasting live content for {serverName}.
          Check back later or explore other servers!
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Search and filter controls */}
      <div className="flex flex-wrap justify-between items-center gap-4 mb-2">
        <div className="relative w-full md:w-1/2">
          <input
            type="text"
            placeholder="Search streams by title, streamer, or character..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-purple-400 focus:border-transparent"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="absolute right-2 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-white"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
        
        <p className="text-xs sm:text-sm text-gray-400">
          {filteredStreams.length} of {streams.length} {streams.length === 1 ? "stream" : "streams"} live
        </p>
      </div>
      
      {/* Multi-stream controls */}
      {isMultiStreamEnabled && (
        <div className="flex flex-wrap justify-between items-center gap-4 mb-6">
          <div className="flex flex-wrap gap-2 items-center">
            <button
              onClick={toggleMultiSelectMode}
              className="px-3 py-2 rounded-md text-xs sm:text-sm font-medium transition-colors"
              style={{
                backgroundColor: isMultiSelectMode ? '#004D61' : '#18181b',
                color: '#FFFFFF',
                border: isMultiSelectMode ? '1px solid #004D61' : '1px solid #26262c',
                borderRadius: '4px',
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'background-color 0.2s ease'
              }}
            >
              {isMultiSelectMode 
                ? <span className="flex items-center gap-1"><X className="h-4 w-4" /> Cancel</span> 
                : "Select Multiple Streams"}
            </button>
            
            {isMultiSelectMode && (
              <button
                onClick={launchMultiStream}
                disabled={selectedStreams.length === 0}
                className="px-3 py-2 rounded-md text-xs sm:text-sm font-medium transition-colors"
                style={{
                  backgroundColor: selectedStreams.length === 0 ? '#26262c' : '#004D61',
                  color: selectedStreams.length === 0 ? '#ADADB8' : '#FFFFFF',
                  border: selectedStreams.length === 0 ? '1px solid #26262c' : '1px solid #004D61',
                  borderRadius: '4px',
                  fontWeight: 600,
                  cursor: selectedStreams.length === 0 ? 'not-allowed' : 'pointer',
                  opacity: selectedStreams.length === 0 ? 0.7 : 1,
                  transition: 'background-color 0.2s ease'
                }}
              >
                Launch Multi-Stream ({selectedStreams.length})
              </button>
            )}
          </div>
        </div>
      )}
      
      {/* Show "no results" message when search has no matches */}
      {filteredStreams.length === 0 && searchQuery.trim() !== "" && (
        <div className="py-12 px-6 bg-gray-800 border border-gray-700 rounded-md text-center">
          <h3 className="text-lg font-semibold mb-2 text-gray-100">No Matching Streams</h3>
          <p className="text-gray-400 max-w-md mx-auto">
            No streams match your search query. Try a different search term.
          </p>
          <button
            onClick={() => setSearchQuery("")}
            className="mt-4 px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-md text-sm transition-colors"
          >
            Clear Search
          </button>
        </div>
      )}
      
      {/* Stream grid */}
      {filteredStreams.length > 0 && (
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
          {filteredStreams.map((stream) => (
            <StreamCard
              key={stream.id}
              stream={stream}
              onClick={() => handleStreamClick(stream)}
              isMultiSelectMode={isMultiStreamEnabled && isMultiSelectMode}
              isSelected={selectedStreams.some(s => s.id === stream.id)}
              onSelect={toggleStreamSelection}
            />
          ))}
        </div>
      )}
      
      {/* Only render modal on desktop */}
      {!isMobile && activeStream && <StreamModal stream={activeStream} onClose={() => setActiveStream(null)} />}
    </div>
  );
}

function StreamCard({ 
  stream, 
  onClick, 
  isMultiSelectMode = false,
  isSelected = false,
  onSelect
}: { 
  stream: StreamData; 
  onClick: () => void;
  isMultiSelectMode?: boolean;
  isSelected?: boolean;
  onSelect?: (stream: StreamData) => void;
}) {
  const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;

  // Format the stream thumbnail URL
  const thumbnailUrl = stream.thumbnail_url
    .replace('{width}', '440')
    .replace('{height}', '248');
  
  // Format viewer count with commas for thousands
  const formatViewerCount = (count: number): string => {
    return count > 999 ? `${(count / 1000).toFixed(1)}K` : count.toString();
  };
  
  // Calculate and format stream duration
  const formatStreamDuration = (startTimeString: string): string => {
    const startTime = new Date(startTimeString);
    const now = new Date();
    const diffMs = now.getTime() - startTime.getTime();
    const diffHrs = Math.floor(diffMs / (1000 * 60 * 60));
    const diffMins = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
    
    if (diffHrs > 0) {
      return `${diffHrs}h ${diffMins}m`;
    } else {
      return `${diffMins}m`;
    }
  };
  
  // Open Twitch directly on mobile
  const handleCardClick = () => {
    if (isMultiSelectMode && onSelect) {
      onSelect(stream);
    } else if (isMobile) {
      // On mobile, go directly to Twitch
      window.open(`https://www.twitch.tv/${stream.user_name.toLowerCase()}`, '_blank');
    } else {
      // On desktop, show the modal
      onClick();
    }
  };
  
  return (
    <Card 
      className="overflow-hidden cursor-pointer group relative transition-all duration-200 hover:-translate-y-1"
      style={{ 
        backgroundColor: '#0e0e10',
        borderColor: isSelected ? '#004D61' : '#26262c',
        borderWidth: isSelected ? '2px' : '1px',
        borderStyle: 'solid',
        borderRadius: '4px',
      }}
      onClick={handleCardClick}
    >
      {/* Stream thumbnail with gradient overlay */}
      <div className="relative h-[180px] w-full overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-t from-gray-900 via-gray-900/40 to-transparent opacity-60 group-hover:opacity-30 transition-opacity z-10" />
        <img
          src={thumbnailUrl}
          alt={`${stream.user_name} streaming ${stream.game_name}`}
          className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
        />
        
        {/* Stream duration */}
        <div className="absolute top-2 right-2 z-20 px-2 py-1 text-xs font-medium text-white rounded" style={{ backgroundColor: 'rgba(20, 20, 20, 0.95)' }}>
          {formatStreamDuration(stream.started_at)}
        </div>
        
        {/* Viewer count */}
        <div className="absolute bottom-2 right-2 z-20 px-2 py-1 text-xs font-medium text-white rounded flex items-center gap-1" style={{ backgroundColor: '#FF0000' }}>
          <span className="h-1.5 w-1.5 rounded-full bg-white animate-pulse"></span>
          {formatViewerCount(stream.viewer_count)}
        </div>

        {/* Mobile indicator */}
        {isMobile && (
          <div className="absolute bottom-2 left-2 z-20 px-2 py-1 text-xs font-medium text-white rounded flex items-center gap-1 bg-[#004D61]">
            <Twitch className="h-3 w-3" />
            <span>Open</span>
          </div>
        )}
      </div>
      
      <CardContent className="p-4">
        {/* Stream title */}
        <h3 className="font-semibold text-white line-clamp-2 min-h-[48px] mb-2" title={stream.title}>
          {stream.title}
        </h3>
        
        {/* Streamer info and game */}
        <div className="flex items-center justify-between text-sm">
          <div className="flex items-center gap-2 text-gray-300">
            <Twitch className="h-4 w-4" style={{ color: '#9146FF' }} />
            <span>{stream.user_name}</span>
          </div>
          
          <div className="text-xs py-1 px-2 rounded text-white" style={{ backgroundColor: 'rgba(20, 20, 20, 0.95)', border: '1px solid rgba(255, 255, 255, 0.1)' }}>
            {stream.game_name}
          </div>
        </div>
        
        {/* Multi-selection checkbox */}
        {isMultiSelectMode && (
          <div 
            className="absolute top-2 left-2 z-20 h-5 w-5 rounded flex items-center justify-center"
            style={{ 
              backgroundColor: isSelected ? '#004D61' : 'rgba(20, 20, 20, 0.95)',
              border: isSelected ? '1px solid #004D61' : '1px solid rgba(255, 255, 255, 0.3)',
              boxShadow: '0 0 0 1px rgba(0,0,0,0.15)'
            }}
          >
            {isSelected && (
              <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="#FFFFFF">
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function StreamModal({ stream, onClose }: { stream: StreamData, onClose: () => void }) {
  const [playerLoaded, setPlayerLoaded] = useState(false);
  const [isPlayerError, setIsPlayerError] = useState(false);
  
  useEffect(() => {
    // Add overflow:hidden to body when modal is open
    document.body.style.overflow = 'hidden';
    
    // Cleanup when modal closes
    return () => {
      document.body.style.overflow = '';
    };
  }, []);
  
  // Handle player loading state
  useEffect(() => {
    const timer = setTimeout(() => {
      if (!playerLoaded) {
        setIsPlayerError(true);
      }
    }, 5000); // Set timeout for player loading
    
    return () => clearTimeout(timer);
  }, [playerLoaded]);
  
  // Simplify parent domain handling for better Safari compatibility
  const parentDomain = typeof window !== 'undefined' ? window.location.hostname : 'localhost';
  
  // Properly encode usernames to handle Unicode characters
  const encodedUsername = encodeURIComponent(stream.user_name.toLowerCase());
  
  // Create direct Twitch URLs for fallback options
  const twitchChannelUrl = `https://www.twitch.tv/${encodedUsername}`;
  const twitchChatUrl = `https://www.twitch.tv/popout/${encodedUsername}/chat?popout=`;
  
  // Use parent parameter for iframe compatibility
  const iframeUrl = `https://player.twitch.tv/?channel=${encodedUsername}&parent=${parentDomain}&autoplay=true`;
  
  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-2 sm:p-6">
      <div className="relative w-full h-[85vh] sm:h-[80vh] max-w-5xl flex flex-col overflow-hidden rounded-xl shadow-2xl">
        <button 
          className="absolute right-2 top-2 sm:right-4 sm:top-4 z-10 p-2 bg-[#0e0e10]/60 rounded-full text-white hover:bg-[#18181b]/80 transition-colors border border-[#26262c]/50"
          onClick={onClose}
        >
          <X className="h-4 w-4 sm:h-5 sm:w-5" />
        </button>
        
        <div className="flex flex-1 overflow-hidden rounded-t-xl">
          {/* Main content area with proper video aspect ratio */}
          <div className="flex flex-col flex-1">
            {/* Stream header */}
            <div className="bg-[#0e0e10]/80 backdrop-blur-sm p-2 sm:p-3 flex items-center border-b border-[#26262c]/50">
              <div className="flex-1 overflow-hidden">
                <h3 className="text-sm sm:text-base font-semibold text-white flex items-center">
                  <span className="truncate">{stream.user_name}</span>
                  <span className="ml-2 text-xs bg-red-600/90 text-white px-1.5 py-0.5 rounded-sm">LIVE</span>
                </h3>
                <p className="text-[#EFEFF1] text-xs line-clamp-1">{stream.title}</p>
              </div>
              <div className="text-[#ADADB8] text-xs flex items-center gap-1 ml-2 whitespace-nowrap">
                <span className="h-1.5 w-1.5 rounded-full bg-red-500 animate-pulse"></span>
                {stream.viewer_count.toLocaleString()} viewers
              </div>
            </div>
            
            {/* Stream player with 16:9 aspect ratio */}
            <div className="flex-1 bg-black relative min-h-0">
              {isPlayerError ? (
                // Fallback when player fails to load
                <div className="absolute inset-0 flex flex-col items-center justify-center p-4 text-center">
                  <div className="mb-4 text-gray-400">
                    <Twitch className="h-10 w-10 mx-auto mb-2 text-purple-400" />
                    <p className="text-sm sm:text-base">Unable to load the stream player</p>
                  </div>
                  
                  <div className="flex flex-col sm:flex-row gap-2 mt-2">
                    <a 
                      href={twitchChannelUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="py-2 px-4 bg-[#004D61] hover:bg-[#003a4d] text-white rounded text-xs sm:text-sm font-medium"
                    >
                      Open on Twitch
                    </a>
                  </div>
                </div>
              ) : (
                <iframe 
                  src={iframeUrl}
                  className="absolute inset-0 w-full h-full border-0"
                  allowFullScreen
                  allow="autoplay; encrypted-media"
                  onLoad={() => setPlayerLoaded(true)}
                ></iframe>
              )}
            </div>
          </div>
          
          {/* Chat sidebar with OBS Chat as requested - desktop only */}
          <div className="w-[280px] hidden md:flex flex-col flex-shrink-0 border-l border-[#26262c]/50 bg-[#0e0e10]/80 backdrop-blur-sm">
            <div className="p-2 bg-[#18181b]/90 text-white text-xs font-medium border-b border-[#26262c]/50 flex justify-between items-center backdrop-blur-sm">
              <span className="text-[#EFEFF1]">STREAM CHAT</span>
            </div>
            
            {/* Custom container for OBS Chat with forced black background */}
            <div className="flex-1 bg-black/90 overflow-hidden relative">
              <iframe 
                className="w-full h-full border-0"
                srcDoc={`
                  <!DOCTYPE html>
                  <html style="background: #000000;">
                    <head>
                      <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
                      <style>
                        html, body {
                          margin: 0;
                          padding: 0;
                          background-color: rgba(0, 0, 0, 0.85);
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
                          background-color: rgba(0, 0, 0, 0.85);
                        }
                        
                        /* Style the iframe */
                        #obs-chat {
                          border: none;
                          width: 100%;
                          height: 100%;
                          background-color: rgba(0, 0, 0, 0.85);
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
                          background-color: rgba(0, 0, 0, 0.2);
                          z-index: 2;
                          pointer-events: none;
                        }
                      </style>
                    </head>
                    <body>
                      <div id="chat-container">
                        <iframe 
                          id="obs-chat"
                          src="https://nightdev.com/hosted/obschat/?theme=dark&channel=${encodedUsername}&fade=false&bot_activity=true&prevent_clipping=true&background=000000&background_opacity=85&text_color=ffffff&text_opacity=100"
                          allowfullscreen="true"
                        ></iframe>
                        <div id="black-overlay"></div>
                      </div>
                      
                      <script>
                        // Add a script to force transparent background
                        document.addEventListener('DOMContentLoaded', function() {
                          // Reference to the iframe
                          const obsChat = document.getElementById('obs-chat');
                          
                          // Function to check and apply transparent background
                          function forceTransparentBackground() {
                            try {
                              // Try to access the iframe's document
                              const iframeDoc = obsChat.contentDocument || obsChat.contentWindow.document;
                              
                              // Create a style element
                              const style = document.createElement('style');
                              style.textContent = \`
                                html, body, div, iframe, ul, li, p, span {
                                  background-color: rgba(0, 0, 0, 0.85) !important;
                                  background: rgba(0, 0, 0, 0.85) !important;
                                }
                                
                                /* Target specific OBS chat elements */
                                #chat-wrapper, #chat-container {
                                  background-color: rgba(0, 0, 0, 0.85) !important;
                                  background: rgba(0, 0, 0, 0.85) !important;
                                }
                                
                                /* Force any potential white elements to be transparent black */
                                [style*="background-color: white"],
                                [style*="background-color: #fff"],
                                [style*="background-color: rgb(255, 255, 255)"],
                                [style*="background: white"],
                                [style*="background: #fff"],
                                [style*="background: rgb(255, 255, 255)"] {
                                  background-color: rgba(0, 0, 0, 0.85) !important;
                                  background: rgba(0, 0, 0, 0.85) !important;
                                }
                              \`;
                              
                              // Append the style to the iframe's document
                              iframeDoc.head.appendChild(style);
                              
                              // Also directly set background color on body and html
                              iframeDoc.documentElement.style.backgroundColor = 'rgba(0, 0, 0, 0.85)';
                              iframeDoc.body.style.backgroundColor = 'rgba(0, 0, 0, 0.85)';
                            } catch (err) {
                              // Silent error in production
                            }
                          }
                          
                          // Apply transparent background when iframe loads
                          obsChat.onload = forceTransparentBackground;
                          
                          // Also try applying it repeatedly at first
                          let attempts = 0;
                          const interval = setInterval(function() {
                            forceTransparentBackground();
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
            
            <div className="px-3 py-2 bg-[#18181b]/90 backdrop-blur-sm border-t border-[#26262c]/50 text-sm text-center flex items-center justify-center gap-2">
              <Twitch className="h-3.5 w-3.5 text-[#004D61]" />
              <a 
                href={twitchChannelUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[#004D61] hover:text-[#003a4d] hover:underline text-xs transition-colors"
              >
                Watch on Twitch
              </a>
            </div>
          </div>
        </div>
        
        {/* Mobile chat & twitch buttons */}
        <div className="md:hidden p-2 bg-[#0e0e10]/80 backdrop-blur-sm border-t border-[#26262c]/50 text-center rounded-b-xl flex justify-center gap-2">
          <a 
            href={twitchChatUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block py-1.5 px-3 bg-[#18181b] hover:bg-[#26262c] text-white rounded-md font-medium text-xs transition-colors"
          >
            Open Chat
          </a>
          <a 
            href={twitchChannelUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block py-1.5 px-3 bg-[#004D61]/90 hover:bg-[#003a4d] text-white rounded-md font-medium text-xs transition-colors"
          >
            Watch on Twitch
          </a>
        </div>
      </div>
    </div>
  );
} 