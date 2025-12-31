"use client";

import { useEffect, useState, useCallback, useMemo } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Responsive, WidthProvider } from 'react-grid-layout';
import { AnimatePresence } from 'motion/react';
import 'react-grid-layout/css/styles.css';
import 'react-resizable/css/styles.css';

import { useFeatureGate, FEATURE_GATES } from '@/lib/statsig';
import { cn } from '@/lib/utils';
import { PWABottomDock } from '@/components/pwa-bottom-dock';
import { usePWAStandalone } from '@/hooks/use-pwa-standalone';

import {
  StreamInfo,
  LayoutType,
  LayoutConfig,
  GRID_COLS,
  TOTAL_ROWS,
  DEFAULT_CHAT_WIDTH,
  useMultiStreamLayout,
  useKeyboardShortcuts,
  StreamTile,
  ChatPanel,
  MultiStreamToolbar,
  EmptyState,
  CommandPalette,
} from '@/components/multi-stream';

// Create responsive grid layout with width provider
const ResponsiveGridLayout = WidthProvider(Responsive);

/**
 * Parse streams parameter from URL
 * Supports: streams=twitch:username,kick:slug or legacy streamers=username1,username2
 */
function parseStreamsParam(searchParams: URLSearchParams): StreamInfo[] {
    const streamsParam = searchParams.get('streams');
    const streamersParam = searchParams.get('streamers'); // Legacy support
    
    if (streamsParam) {
      const tokens = streamsParam.split(',').filter(Boolean);
      return tokens.map((token, index) => {
        const trimmed = token.trim();
        const colonIndex = trimmed.indexOf(':');
        
        if (colonIndex > 0) {
          const platform = trimmed.substring(0, colonIndex).toLowerCase() as 'twitch' | 'kick';
          const identifier = decodeURIComponent(trimmed.substring(colonIndex + 1).trim());
          
          if (platform === 'twitch' || platform === 'kick') {
          return { platform, username: identifier, position: index };
          }
        }
        
        // Fallback: treat as Twitch if format is invalid
        return {
          platform: 'twitch' as const,
          username: decodeURIComponent(trimmed),
        position: index,
        };
      });
  }

  if (streamersParam) {
    // Legacy format: all Twitch
    return streamersParam.split(',').filter(Boolean).map((username, index) => ({
        platform: 'twitch' as const,
        username: decodeURIComponent(username),
      position: index,
      }));
    }
    
    return [];
}

export default function MultiStreamPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  
  // Feature flag check
  const isMultiStreamEnabled = useFeatureGate(FEATURE_GATES.MULTI_STREAM);
  
  // PWA standalone mode detection
  const { isPWA, isLoading: isPWALoading } = usePWAStandalone();

  // Parse streams from URL
  const streams = useMemo(() => parseStreamsParam(searchParams), [searchParams]);

  // Layout management
  const {
    layout,
    gridLayout,
    isEditMode,
    chatPosition,
    setIsEditMode,
    setChatPosition,
    generateLayout,
    resetLayout,
    onLayoutChange,
  } = useMultiStreamLayout({
    streams,
    initialLayout: '2x2',
    isChatVisible: false, // Default to hidden (watch-first)
  });

  // UI state
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [activeChatIndex, setActiveChatIndex] = useState(0);
  const [focusedStreamIndex, setFocusedStreamIndex] = useState<number | null>(null);
  const [mutedStreams, setMutedStreams] = useState<Set<number>>(() => {
    // Mute all except first stream by default
    const muted = new Set<number>();
    for (let i = 1; i < streams.length; i++) {
      muted.add(i);
    }
    return muted;
  });
  const [isMobile, setIsMobile] = useState(false);
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);

  // Parent domain for Twitch embeds
  const parentDomain = typeof window !== 'undefined' ? window.location.hostname : 'localhost';

  // Twitch streams (for chat)
  const twitchStreams = useMemo(
    () => streams.filter(s => s.platform === 'twitch'),
    [streams]
  );

  // Redirect if feature is disabled
  useEffect(() => {
    if (typeof window !== 'undefined' && !isMultiStreamEnabled) {
      router.push('/');
    }
  }, [isMultiStreamEnabled, router]);

  // Check for mobile device
  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Handle fullscreen changes
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  // Ensure activeChatIndex stays valid
  useEffect(() => {
    if (twitchStreams.length > 0 && activeChatIndex >= twitchStreams.length) {
      setActiveChatIndex(0);
    }
  }, [twitchStreams.length, activeChatIndex]);

  // Toggle fullscreen
  const toggleFullscreen = useCallback(() => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
        document.exitFullscreen();
        setIsFullscreen(false);
      }
  }, []);
  
  // Toggle chat visibility
  const toggleChat = useCallback(() => {
    if (chatPosition === 'hidden') {
      setChatPosition('right');
      // Regenerate layout to accommodate chat
      generateLayout(layout);
        } else {
      setChatPosition('hidden');
      // Regenerate layout without chat space
      generateLayout(layout);
    }
  }, [chatPosition, setChatPosition, generateLayout, layout]);

  // Toggle stream mute
  const toggleMute = useCallback((index: number) => {
    setMutedStreams(prev => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
        } else {
        next.add(index);
      }
      return next;
    });
  }, []);

  // Focus a stream
  const focusStream = useCallback((index: number) => {
    setFocusedStreamIndex(prev => prev === index ? null : index);
  }, []);
  
  // Handle launch from empty state
  const handleLaunch = useCallback((streamsParam: string) => {
    router.push(`/multi-stream?streams=${streamsParam}`);
  }, [router]);

  // Handle layout change from toolbar
  const handleLayoutChange = useCallback((newLayout: LayoutType) => {
    generateLayout(newLayout);
  }, [generateLayout]);

  // Toggle edit mode
  const toggleEditMode = useCallback(() => {
    setIsEditMode(!isEditMode);
  }, [isEditMode, setIsEditMode]);

  // Keyboard shortcuts
  useKeyboardShortcuts({
    onToggleChat: toggleChat,
    onToggleEditMode: toggleEditMode,
    onToggleFullscreen: toggleFullscreen,
    onResetLayout: resetLayout,
    onFocusStream: focusStream,
    onOpenCommandPalette: () => setIsCommandPaletteOpen(true),
    streamCount: streams.length,
    isEnabled: streams.length > 0 && !isCommandPaletteOpen,
  });

  // Build grid layouts for responsive breakpoints
  const gridLayouts = useMemo(() => {
    const base = Object.values(gridLayout);
      return { 
      lg: base,
      md: base.map(item => ({
        ...item,
        w: Math.min(item.w, GRID_COLS),
        h: Math.max(item.h, 3),
      })),
      sm: base.map(item => ({
        ...item,
        w: GRID_COLS,
        h: item.i === 'chat' ? 6 : 10,
      })),
      xs: base.map(item => ({
        ...item,
        w: GRID_COLS,
        h: item.i === 'chat' ? 5 : 8,
      })),
    };
  }, [gridLayout]);

  // If feature disabled, show nothing during redirect
  if (!isMultiStreamEnabled) {
    return null;
  }

  // Empty state (no streams selected)
  if (streams.length === 0) {
    return <EmptyState onLaunch={handleLaunch} />;
  }

  const isChatVisible = chatPosition !== 'hidden';
                
                return (
    <div className="flex flex-col h-screen bg-black text-white overflow-hidden">
      {/* Toolbar */}
      <MultiStreamToolbar
        layout={layout}
        isEditMode={isEditMode}
        isChatVisible={isChatVisible}
        isFullscreen={isFullscreen}
        onLayoutChange={handleLayoutChange}
        onEditModeToggle={toggleEditMode}
        onChatToggle={toggleChat}
        onFullscreenToggle={toggleFullscreen}
        onReset={resetLayout}
      />

      {/* Command Palette */}
      <CommandPalette
        isOpen={isCommandPaletteOpen}
        onClose={() => setIsCommandPaletteOpen(false)}
        streams={streams}
        onToggleChat={toggleChat}
        onToggleEditMode={toggleEditMode}
        onToggleFullscreen={toggleFullscreen}
        onResetLayout={resetLayout}
        onLayoutChange={handleLayoutChange}
        onFocusStream={focusStream}
        onSelectChat={setActiveChatIndex}
        isChatVisible={isChatVisible}
        isEditMode={isEditMode}
      />

      {/* Main content area */}
      <div className="flex-1 flex overflow-hidden">
        {/* Stream grid */}
        <div className={cn(
          "flex-1 relative overflow-auto",
          isEditMode && "bg-[#0a0a0a]"
        )}>
        <ResponsiveGridLayout
          className="layout"
            layouts={gridLayouts}
          breakpoints={{ lg: 1200, md: 996, sm: 768, xs: 480, xxs: 0 }}
            cols={{ lg: GRID_COLS, md: GRID_COLS, sm: GRID_COLS, xs: GRID_COLS, xxs: GRID_COLS }}
          rowHeight={isMobile ? 25 : 30}
            onLayoutChange={(currentLayout) => onLayoutChange(currentLayout)}
            isDraggable={isEditMode}
            isResizable={isEditMode}
            resizeHandles={isMobile ? ['se'] : ['se', 'sw', 'nw', 'ne']}
            margin={isEditMode ? [8, 8] : [2, 2]}
            containerPadding={isEditMode ? [8, 8] : [2, 2]}
            compactType="vertical"
            preventCollision={false}
            maxRows={TOTAL_ROWS + 6}
            useCSSTransforms={true}
            style={{ 
              height: 'calc(100vh - 52px)', 
              minHeight: isMobile ? '300px' : '500px' 
            }}
            draggableHandle={isEditMode ? ".drag-handle" : undefined}
          >
            {/* Stream tiles */}
            {streams.map((stream, index) => (
              <div key={`s${index}`} className="bg-black">
                <StreamTile
                  stream={stream}
                  index={index}
                  parentDomain={parentDomain}
                  isEditMode={isEditMode}
                  isFocused={focusedStreamIndex === index}
                  isMuted={mutedStreams.has(index)}
                  onFocus={() => focusStream(index)}
                  onMuteToggle={() => toggleMute(index)}
                />
                  </div>
            ))}

            {/* Chat tile (only render if visible and in grid layout) */}
            {isChatVisible && gridLayout['chat'] && (
              <div key="chat" className="bg-[#0e0e10]">
                <ChatPanel
                  streams={streams}
                  activeChatIndex={activeChatIndex}
                  isVisible={true}
                  position={chatPosition === 'left' ? 'left' : 'right'}
                  onChatIndexChange={setActiveChatIndex}
                  onClose={() => setChatPosition('hidden')}
                  className="h-full"
                />
                    </div>
            )}
          </ResponsiveGridLayout>

          {/* Edit mode overlay hint */}
          {isEditMode && (
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 px-4 py-2 bg-[#004D61]/90 rounded-full text-white text-sm font-medium backdrop-blur-sm shadow-lg">
              Drag tiles to rearrange • Resize from corners • Click Done when finished
                    </div>
                  )}
                </div>

        {/* Detached chat panel (when not in grid) */}
        {isChatVisible && !gridLayout['chat'] && (
          <div className={cn(
            "w-80 flex-shrink-0 border-l border-[#26262c]",
            chatPosition === 'left' && "order-first border-l-0 border-r"
          )}>
            <ChatPanel
              streams={streams}
              activeChatIndex={activeChatIndex}
              isVisible={true}
              position={chatPosition === 'left' ? 'left' : 'right'}
              onChatIndexChange={setActiveChatIndex}
              onClose={() => setChatPosition('hidden')}
              className="h-full"
            />
                    </div>
                  )}
                </div>
      
      {/* PWA Bottom Dock - only show in PWA mode and when not fullscreen */}
      <AnimatePresence>
        {isPWA && !isPWALoading && !isFullscreen && (
          <PWABottomDock />
        )}
      </AnimatePresence>
    </div>
  );
} 
