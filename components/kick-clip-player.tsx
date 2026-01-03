'use client';

import { useEffect, useRef, useState, memo } from 'react';
import Hls from 'hls.js';
import { Play, AlertCircle, ExternalLink, Loader2 } from 'lucide-react';

// ═══════════════════════════════════════════════════════════════════════════
// CUSTOM KICK ICON
// ═══════════════════════════════════════════════════════════════════════════

const KickIcon = ({ className }: { className?: string }) => (
  <svg 
    viewBox="0 0 24 24" 
    fill="currentColor" 
    className={className}
    xmlns="http://www.w3.org/2000/svg"
  >
    <path d="M6 3h4v5h2V6h2V3h4v3h-2v2h-2v2h2v2h2v2h-2v2h-2v-2h-2v5h-2v-5H8v-2H6v-2h2v-2H6V3z"/>
  </svg>
);

// ═══════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════

interface KickClipPlayerProps {
  /** The HLS .m3u8 URL for the clip */
  clipUrl: string;
  /** Thumbnail URL for poster image */
  thumbnailUrl: string;
  /** Clip title for accessibility */
  title: string;
  /** Channel slug for external link */
  channelSlug: string;
  /** Clip ID for external link */
  clipId: string;
  /** Optional className for the container */
  className?: string;
}

// ═══════════════════════════════════════════════════════════════════════════
// KICK CLIP PLAYER COMPONENT
// ═══════════════════════════════════════════════════════════════════════════

/**
 * KickClipPlayer - HLS video player for Kick.com clips
 * 
 * Kick clips are stored as HLS (.m3u8) streams. This component uses HLS.js
 * to play these streams in browsers that don't natively support HLS.
 * 
 * Falls back to:
 * 1. Native HLS (Safari/iOS)
 * 2. External link to Kick.com (if HLS.js fails)
 */
export const KickClipPlayer = memo(function KickClipPlayer({
  clipUrl,
  thumbnailUrl,
  title,
  channelSlug,
  clipId,
  className = '',
}: KickClipPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [showPlayButton, setShowPlayButton] = useState(true);

  // Generate external link to Kick
  const externalUrl = `https://kick.com/${channelSlug}?clip=${clipId}`;

  // Initialize HLS player
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !clipUrl) return;

    let hls: Hls | null = null;

    const initPlayer = () => {
      // Check if the clip URL is a valid HLS stream
      if (!clipUrl.includes('.m3u8')) {
        setError('Invalid clip format');
        setIsLoading(false);
        return;
      }

      // Check for HLS.js support
      if (Hls.isSupported()) {
        hls = new Hls({
          enableWorker: true,
          lowLatencyMode: false,
          maxBufferLength: 30,
          maxMaxBufferLength: 60,
        });

        hls.loadSource(clipUrl);
        hls.attachMedia(video);

        hls.on(Hls.Events.MANIFEST_PARSED, () => {
          setIsLoading(false);
          setError(null);
        });

        hls.on(Hls.Events.ERROR, (event, data) => {
          console.error('[KickClipPlayer] HLS error:', data);
          
          if (data.fatal) {
            switch (data.type) {
              case Hls.ErrorTypes.NETWORK_ERROR:
                // Try to recover from network error
                console.log('[KickClipPlayer] Attempting to recover from network error');
                hls?.startLoad();
                break;
              case Hls.ErrorTypes.MEDIA_ERROR:
                // Try to recover from media error
                console.log('[KickClipPlayer] Attempting to recover from media error');
                hls?.recoverMediaError();
                break;
              default:
                // Cannot recover
                setError('Unable to load clip. Try watching on Kick.');
                setIsLoading(false);
                break;
            }
          }
        });

        hlsRef.current = hls;
      } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
        // Native HLS support (Safari, iOS)
        video.src = clipUrl;
        
        video.addEventListener('loadedmetadata', () => {
          setIsLoading(false);
          setError(null);
        });

        video.addEventListener('error', () => {
          setError('Unable to load clip. Try watching on Kick.');
          setIsLoading(false);
        });
      } else {
        setError('Your browser does not support HLS playback.');
        setIsLoading(false);
      }
    };

    initPlayer();

    // Cleanup
    return () => {
      if (hls) {
        hls.destroy();
        hlsRef.current = null;
      }
    };
  }, [clipUrl]);

  // Handle play button click
  const handlePlay = async () => {
    const video = videoRef.current;
    if (!video) return;

    try {
      await video.play();
      setIsPlaying(true);
      setShowPlayButton(false);
    } catch (err) {
      console.error('[KickClipPlayer] Play error:', err);
      setError('Unable to play clip. Try watching on Kick.');
    }
  };

  // Handle video events
  const handlePause = () => {
    setIsPlaying(false);
    setShowPlayButton(true);
  };

  const handleEnded = () => {
    setIsPlaying(false);
    setShowPlayButton(true);
  };

  // If there's an error or no HLS support, show fallback
  if (error) {
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
            <AlertCircle className="h-8 w-8 text-amber-400 mb-2" />
            <p className="text-white text-center text-sm mb-4">{error}</p>
            
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

  return (
    <div className={`relative w-full h-full bg-black ${className}`}>
      {/* Video element */}
      <video
        ref={videoRef}
        className="w-full h-full"
        poster={thumbnailUrl}
        controls={isPlaying}
        playsInline
        onPause={handlePause}
        onEnded={handleEnded}
        onClick={() => {
          if (!isPlaying) handlePlay();
        }}
      />

      {/* Loading overlay */}
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/60">
          <Loader2 className="h-10 w-10 text-[#53fc18] animate-spin" />
        </div>
      )}

      {/* Play button overlay */}
      {showPlayButton && !isLoading && !error && (
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
      )}

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
});

export default KickClipPlayer;
