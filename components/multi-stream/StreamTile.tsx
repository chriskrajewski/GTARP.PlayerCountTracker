"use client";

import { useState, useRef, forwardRef } from 'react';
import { motion } from 'motion/react';
import { Twitch, Volume2, VolumeX, Maximize2, ExternalLink, Star } from 'lucide-react';
import { KickIcon } from './icons';
import type { StreamInfo } from './types';
import { cn } from '@/lib/utils';

interface StreamTileProps {
  stream: StreamInfo;
  index: number;
  parentDomain: string;
  isEditMode: boolean;
  isFocused: boolean;
  isMuted: boolean;
  onFocus: () => void;
  onMuteToggle: () => void;
  className?: string;
}

/**
 * StreamTile - A sleek stream player wrapper with subtle hover overlay
 * 
 * Features:
 * - Twitch/Kick iframe player embedding
 * - Subtle hover overlay with stream info + quick actions
 * - Focus state with accent ring
 * - Drag handle (only visible in edit mode)
 */
export const StreamTile = forwardRef<HTMLDivElement, StreamTileProps>(
  function StreamTile(
    {
      stream,
      index,
      parentDomain,
      isEditMode,
      isFocused,
      isMuted,
      onFocus,
      onMuteToggle,
      className,
    },
    ref
  ) {
    const [isHovered, setIsHovered] = useState(false);
    const iframeRef = useRef<HTMLIFrameElement>(null);
    
    const isTwitch = stream.platform === 'twitch';
    const isKick = stream.platform === 'kick';
    
    // Build player URLs
    const twitchPlayerUrl = `https://player.twitch.tv/?channel=${encodeURIComponent(stream.username)}&parent=${parentDomain}&muted=${isMuted}`;
    const kickPlayerUrl = `https://player.kick.com/${encodeURIComponent(stream.username.toLowerCase())}`;
    const externalUrl = isTwitch 
      ? `https://twitch.tv/${stream.username}` 
      : `https://kick.com/${stream.username.toLowerCase()}`;

    return (
      <div
        ref={ref}
        className={cn(
          "relative w-full h-full bg-black overflow-hidden transition-all duration-200",
          isFocused && "ring-2 ring-[#00D9FF] ring-offset-1 ring-offset-black z-10 shadow-lg shadow-[#00D9FF]/30",
          className
        )}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        {/* Player iframe */}
        {isTwitch ? (
          <iframe
            ref={iframeRef}
            src={twitchPlayerUrl}
            className="absolute inset-0 w-full h-full"
            allowFullScreen
            frameBorder="0"
            allow="autoplay; encrypted-media; fullscreen"
            title={`Twitch stream: ${stream.username}`}
          />
        ) : (
          <iframe
            ref={iframeRef}
            src={kickPlayerUrl}
            className="absolute inset-0 w-full h-full"
            allowFullScreen
            frameBorder="0"
            allow="autoplay; encrypted-media; fullscreen"
            title={`Kick stream: ${stream.username}`}
          />
        )}

        {/* Subtle gradient overlay at top - only on hover or edit mode */}
        <div 
          className={cn(
            "absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-black/70 via-black/30 to-transparent pointer-events-none transition-opacity duration-300",
            (isHovered || isEditMode) ? "opacity-100" : "opacity-0"
          )}
        />

        {/* Stream info + quick actions overlay */}
        <motion.div 
          className={cn(
            "absolute inset-x-0 top-0 p-3 flex items-start justify-between z-20",
            (isHovered || isEditMode) ? "opacity-100" : "opacity-0"
          )}
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: (isHovered || isEditMode) ? 1 : 0, y: (isHovered || isEditMode) ? 0 : -8 }}
          transition={{ duration: 0.2 }}
        >
          {/* Left: Platform badge + username */}
          <div className="flex items-center gap-2">
            <motion.div 
              className={cn(
                "flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-medium backdrop-blur-sm",
                isTwitch ? "bg-[#9146FF]/90 text-white" : "bg-[#53FC18]/90 text-black"
              )}
              whileHover={{ scale: 1.05 }}
              transition={{ type: "spring", stiffness: 400, damping: 10 }}
            >
              {isTwitch ? (
                <Twitch className="h-3 w-3" />
              ) : (
                <KickIcon className="h-3 w-3" />
              )}
              <span>{stream.username}</span>
            </motion.div>
            
            {isFocused && (
              <motion.div 
                className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-[#00D9FF]/90 text-black text-xs font-medium"
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ type: "spring", stiffness: 400, damping: 10 }}
              >
                <Star className="h-2.5 w-2.5 fill-current" />
                <span>Focus</span>
              </motion.div>
            )}
          </div>

          {/* Right: Quick actions */}
          <div className="flex items-center gap-1">
            <motion.button
              onClick={(e) => {
                e.stopPropagation();
                onFocus();
              }}
              className={cn(
                "p-1.5 rounded-md backdrop-blur-sm transition-colors",
                isFocused 
                  ? "bg-[#00D9FF] text-black" 
                  : "bg-black/50 text-white/80 hover:bg-black/70 hover:text-white"
              )}
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.95 }}
              title={isFocused ? "Focused" : "Set as focus"}
            >
              <Star className={cn("h-4 w-4", isFocused && "fill-current")} />
            </motion.button>
            
            <motion.button
              onClick={(e) => {
                e.stopPropagation();
                onMuteToggle();
              }}
              className="p-1.5 rounded-md bg-black/50 text-white/80 hover:bg-black/70 hover:text-white backdrop-blur-sm transition-colors"
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.95 }}
              title={isMuted ? "Unmute" : "Mute"}
            >
              {isMuted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
            </motion.button>
            
            <motion.a
              href={externalUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="p-1.5 rounded-md bg-black/50 text-white/80 hover:bg-black/70 hover:text-white backdrop-blur-sm transition-colors"
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.95 }}
              title={`Open on ${isTwitch ? 'Twitch' : 'Kick'}`}
            >
              <ExternalLink className="h-4 w-4" />
            </motion.a>
          </div>
        </motion.div>

        {/* Edit mode drag handle */}
        {isEditMode && (
          <div className="absolute inset-x-0 top-0 h-10 bg-[#004D61]/40 cursor-grab active:cursor-grabbing z-30 drag-handle flex items-center justify-center">
            <div className="flex items-center gap-1 text-white/90 text-xs font-medium">
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 9h14M5 15h14" />
              </svg>
              <span>Drag to move</span>
            </div>
          </div>
        )}

        {/* Focus ring indicator (bottom edge) - subtle persistent indicator */}
        {isFocused && (
          <motion.div 
            className="absolute inset-x-0 bottom-0 h-1 bg-[#00D9FF]"
            layoutId="focus-indicator"
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
          />
        )}
      </div>
    );
  }
);
