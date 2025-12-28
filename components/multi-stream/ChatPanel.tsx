"use client";

import { useState, useMemo } from 'react';
import { MessageSquare, X, ExternalLink, ChevronLeft, ChevronRight, Twitch } from 'lucide-react';
import { KickIcon } from './icons';
import type { StreamInfo } from './types';
import { cn } from '@/lib/utils';

interface ChatPanelProps {
  streams: StreamInfo[];
  activeChatIndex: number;
  isVisible: boolean;
  position: 'left' | 'right';
  onChatIndexChange: (index: number) => void;
  onClose: () => void;
  className?: string;
}

/**
 * ChatPanel - A sleek collapsible chat sidebar
 * 
 * Features:
 * - Tabbed chat switching for multiple Twitch streams
 * - Popout chat action
 * - Friendly Kick-only fallback
 * - Smooth slide-in animation
 */
export function ChatPanel({
  streams,
  activeChatIndex,
  isVisible,
  position,
  onChatIndexChange,
  onClose,
  className,
}: ChatPanelProps) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  
  // Filter to Twitch streams only (Kick doesn't support embedded chat)
  const twitchStreams = useMemo(
    () => streams.filter(s => s.platform === 'twitch'),
    [streams]
  );
  
  const kickStreams = useMemo(
    () => streams.filter(s => s.platform === 'kick'),
    [streams]
  );
  
  const hasTwitchStreams = twitchStreams.length > 0;
  const activeStream = twitchStreams[activeChatIndex] ?? twitchStreams[0];
  const activeUsername = activeStream?.username ?? '';
  
  // OBS Chat URL for cleaner embed with dark theme
  const chatEmbedUrl = activeUsername
    ? `https://nightdev.com/hosted/obschat/?theme=dark&channel=${encodeURIComponent(activeUsername)}&fade=false&bot_activity=true&prevent_clipping=true&background=0a0a0a&background_opacity=100&text_color=ffffff&text_opacity=100`
    : '';

  if (!isVisible) return null;

  return (
    <div
      className={cn(
        "flex flex-col h-full bg-[#0e0e10] border-[#26262c] transition-all duration-300",
        position === 'left' ? "border-r" : "border-l",
        isCollapsed ? "w-10" : "w-full",
        className
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 bg-[#18181b] border-b border-[#26262c]">
        {!isCollapsed && (
          <>
            <div className="flex items-center gap-2">
              <MessageSquare className="h-4 w-4 text-[#ADADB8]" />
              <span className="text-sm font-medium text-white">Chat</span>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setIsCollapsed(true)}
                className="p-1 rounded hover:bg-[#26262c] text-[#ADADB8] hover:text-white transition-colors"
                title="Collapse"
              >
                {position === 'left' ? <ChevronLeft className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
              </button>
              <button
                onClick={onClose}
                className="p-1 rounded hover:bg-[#26262c] text-[#ADADB8] hover:text-white transition-colors"
                title="Hide chat"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </>
        )}
        
        {isCollapsed && (
          <button
            onClick={() => setIsCollapsed(false)}
            className="p-1.5 rounded hover:bg-[#26262c] text-[#ADADB8] hover:text-white transition-colors mx-auto"
            title="Expand"
          >
            {position === 'left' ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
          </button>
        )}
      </div>

      {!isCollapsed && (
        <>
          {/* Twitch stream tabs */}
          {hasTwitchStreams && twitchStreams.length > 1 && (
            <div className="flex items-center gap-1 px-2 py-1.5 bg-[#18181b]/50 border-b border-[#26262c] overflow-x-auto">
              {twitchStreams.map((stream, idx) => (
                <button
                  key={stream.username}
                  onClick={() => onChatIndexChange(idx)}
                  className={cn(
                    "flex items-center gap-1 px-2 py-1 rounded text-xs font-medium transition-colors whitespace-nowrap",
                    idx === activeChatIndex
                      ? "bg-[#00D9FF] text-black"
                      : "bg-[#26262c] text-[#ADADB8] hover:bg-[#3a3a43] hover:text-white"
                  )}
                >
                  <Twitch className="h-3 w-3" />
                  <span className="max-w-[80px] truncate">{stream.username}</span>
                </button>
              ))}
            </div>
          )}

          {/* Chat content */}
          <div className="flex-1 relative bg-[#0a0a0a] overflow-hidden">
            {hasTwitchStreams && activeUsername ? (
              // Twitch chat embed via OBS Chat
              <iframe
                src={chatEmbedUrl}
                className="absolute inset-0 w-full h-full border-0"
                title={`Chat: ${activeUsername}`}
                sandbox="allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox"
                style={{
                  backgroundColor: '#0a0a0a',
                  colorScheme: 'dark',
                  filter: 'invert(0)'
                }}
              />
            ) : (
              // Kick-only fallback
              <div className="absolute inset-0 flex flex-col items-center justify-center p-4 text-center">
                <KickIcon className="h-10 w-10 mb-3 text-[#53FC18]" />
                <h3 className="text-white font-medium mb-2">Chat Unavailable</h3>
                <p className="text-[#ADADB8] text-sm mb-4">
                  Embedded chat is only available for Twitch streams
                </p>
                
                {kickStreams.length > 0 && (
                  <div className="space-y-2 w-full max-w-[200px]">
                    <p className="text-xs text-[#ADADB8]">Open chat on Kick:</p>
                    {kickStreams.map((stream) => (
                      <a
                        key={stream.username}
                        href={`https://kick.com/${encodeURIComponent(stream.username.toLowerCase())}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center justify-center gap-2 px-3 py-2 bg-[#53FC18] hover:bg-[#45D015] text-black rounded-md text-sm font-medium transition-colors"
                      >
                        <KickIcon className="h-4 w-4" />
                        <span>{stream.username}</span>
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Footer with popout link */}
          {hasTwitchStreams && activeUsername && (
            <div className="px-3 py-2 bg-[#18181b] border-t border-[#26262c] flex items-center justify-center">
              <a
                href={`https://www.twitch.tv/popout/${activeUsername}/chat?popout=`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 text-xs text-[#00D9FF] hover:text-[#00f0ff] transition-colors"
              >
                <ExternalLink className="h-3 w-3" />
                <span>Popout chat</span>
              </a>
            </div>
          )}
        </>
      )}
    </div>
  );
}
