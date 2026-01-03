'use client';

import { useState, useEffect, useRef, memo } from 'react';
import Hls from 'hls.js';
import { Play, ExternalLink, Loader2 } from 'lucide-react';

// ═══════════════════════════════════════════════════════════════════════════
// CUSTOM KICK ICON
// ═══════════════════════════════════════════════════════════════════════════

const KickIcon = ({ className }: { className?: string }) => (
  <svg 
    viewBox="0 0 24 24" 
    fill="currentColor" 
    className={className}
  >
    <path d="M1.333 0v24h21.334V0H1.333zm17.12 18.347h-4.32l-3.093-4.907-1.653 1.76v3.147H5.654V5.653h3.733v5.28l4.48-5.28h4.427l-4.907 5.44 4.986 7.254h.08z"/>
  </svg>
);

// ═══════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════

interface KickClipPlayerProps {
  /** The original clip URL (HLS .m3u8 - not used for embed) */
  clipUrl: string;
  /** Thumbnail URL for poster image */
  thumbnailUrl: string;
  /** Clip title for accessibility */
  title: string;
  /** Channel slug for embed URL */
  channelSlug: string;
  /** Clip ID for embed URL */
  clipId: string;
  /** Optional className for the container */
  className?: string;
}

// ═══════════════════════════════════════════════════════════════════════════
// KICK CLIP PLAYER COMPONENT
// ═══════════════════════════════════════════════════════════════════════════

/**
 * KickClipPlayer - HLS player for Kick.com clips using clip URLs.
 */
export const KickClipPlayer = memo(function KickClipPlayer({
  clipUrl,
  thumbnailUrl,
  title,
  channelSlug,
  clipId,
  className = '',
}: KickClipPlayerProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [showEmbed, setShowEmbed] = useState(false);
  const [embedError, setEmbedError] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  
  // Generate external link to Kick
  const externalUrl = `https://kick.com/${channelSlug}?clip=${clipId}`;

  // Handle play button click - show the player
  const handlePlay = () => {
    if (!clipUrl) {
      setEmbedError(true);
      return;
    }
    setEmbedError(false);
    setShowEmbed(true);
    setIsLoading(true);
  };
  useEffect(() => {
    if (!showEmbed || !clipUrl) {
      return;
    }

    const video = videoRef.current;
    if (!video) {
      setEmbedError(true);
      setIsLoading(false);
      return;
    }

    let hls: Hls | null = null;
    let cancelled = false;

    const handleLoaded = () => {
      if (!cancelled) {
        setIsLoading(false);
      }
    };

    const handleFatalError = () => {
      if (!cancelled) {
        setEmbedError(true);
        setIsLoading(false);
      }
    };

    if (Hls.isSupported()) {
      hls = new Hls({
        enableWorker: true,
        lowLatencyMode: true,
        backBufferLength: 30,
      });
      hls.loadSource(clipUrl);
      hls.attachMedia(video);
      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        video
          .play()
          .catch(() => {
            // Autoplay might be blocked; user already interacted.
          });
      });
      hls.on(Hls.Events.ERROR, (_, data) => {
        if (data?.fatal) {
          handleFatalError();
        }
      });
      video.addEventListener('loadedmetadata', handleLoaded);
      video.addEventListener('error', handleFatalError);
    } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
      video.src = clipUrl;
      video.addEventListener('loadedmetadata', handleLoaded);
      video.addEventListener('error', handleFatalError);
      video
        .play()
        .catch(() => {
          // Ignore autoplay restrictions
        });
    } else {
      handleFatalError();
    }

    return () => {
      cancelled = true;
      video.removeEventListener('loadedmetadata', handleLoaded);
      video.removeEventListener('error', handleFatalError);
      if (hls) {
        hls.destroy();
      } else {
        video.pause();
        video.removeAttribute('src');
        video.load();
      }
    };
  }, [clipUrl, showEmbed]);

  // If embed errored, show fallback with link
  if (embedError) {
    return (
      <div className={`relative w-full h-full bg-black ${className}`}>
        <a
          href={externalUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="block w-full h-full relative group"
        >
          {/* Thumbnail background */}
          <img
            src={thumbnailUrl}
            alt={title}
            className="w-full h-full object-cover opacity-50"
          />
          
          {/* Error overlay */}
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/60 p-4">
            <p className="text-white text-center text-sm mb-4">
              Unable to load clip playback. Click to watch on Kick.
            </p>
            
            {/* Watch on Kick button */}
            <div
              className="flex items-center gap-2 px-4 py-2 rounded-lg transition-all group-hover:scale-105"
              style={{
                background: 'rgba(83, 252, 24, 0.9)',
              }}
            >
              <KickIcon className="h-5 w-5 text-black" />
              <span className="text-black font-medium">Watch on Kick</span>
              <ExternalLink className="h-4 w-4 text-black" />
            </div>
          </div>
        </a>
      </div>
    );
  }

  // Show thumbnail with play button initially
  if (!showEmbed) {
    return (
      <div className={`relative w-full h-full bg-black ${className}`}>
        {/* Thumbnail */}
        <img
          src={thumbnailUrl}
          alt={title}
          className="w-full h-full object-cover"
          onError={(e) => {
            // If thumbnail fails, show placeholder
            e.currentTarget.style.display = 'none';
          }}
        />
        
        {/* Play button overlay */}
        <div
          className="absolute inset-0 flex items-center justify-center cursor-pointer group"
          onClick={handlePlay}
        >
          {/* Semi-transparent overlay */}
          <div className="absolute inset-0 bg-black/40 group-hover:bg-black/20 transition-colors" />
          
          {/* Play button */}
          <div
            className="relative z-10 w-16 h-16 rounded-full flex items-center justify-center transition-transform group-hover:scale-110"
            style={{
              background: 'rgba(83, 252, 24, 0.9)',
            }}
          >
            <Play className="h-8 w-8 text-black fill-black ml-1" />
          </div>

          {/* Kick branding */}
          <div
            className="absolute bottom-4 left-4 flex items-center gap-1.5 px-2 py-1 rounded"
            style={{
              background: 'rgba(83, 252, 24, 0.9)',
            }}
          >
            <KickIcon className="h-4 w-4 text-black" />
            <span className="text-black text-xs font-medium">Kick Clip</span>
          </div>
        </div>

        {/* External link button (always visible in corner) */}
        <a
          href={externalUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="absolute top-2 right-2 z-20 flex items-center gap-1 px-2 py-1 rounded text-xs font-medium transition-opacity opacity-70 hover:opacity-100"
          style={{
            background: 'rgba(0, 0, 0, 0.7)',
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <KickIcon className="h-3 w-3 text-[#53fc18]" />
          <span className="text-white">Kick</span>
          <ExternalLink className="h-3 w-3 text-gray-400" />
        </a>
      </div>
    );
  }

  // Show embedded player
  return (
    <div className={`relative w-full h-full bg-black ${className}`}>
      {/* Loading overlay */}
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/60 z-10">
          <Loader2 className="h-10 w-10 text-[#53fc18] animate-spin" />
        </div>
      )}

      <video
        ref={videoRef}
        controls
        playsInline
        poster={thumbnailUrl}
        className="w-full h-full bg-black"
        preload="metadata"
      />

      {/* External link button (always visible in corner) */}
      <a
        href={externalUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="absolute top-2 right-2 z-20 flex items-center gap-1 px-2 py-1 rounded text-xs font-medium transition-opacity opacity-70 hover:opacity-100"
        style={{
          background: 'rgba(0, 0, 0, 0.7)',
        }}
      >
        <KickIcon className="h-3 w-3 text-[#53fc18]" />
        <span className="text-white">Kick</span>
        <ExternalLink className="h-3 w-3 text-gray-400" />
      </a>
    </div>
  );
});

export default KickClipPlayer;
