"use client";

import { useEffect, useState, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import { ArrowLeft, Twitch, Maximize, Minimize, Grid3X3, Grid2X2, LayoutGrid, Copy, Check, ChevronDown, Users, PanelLeft, PanelRight, PanelBottom, RotateCcw, Lock, Unlock } from 'lucide-react';
import Link from 'next/link';
import { Responsive, WidthProvider } from 'react-grid-layout';
import 'react-grid-layout/css/styles.css';
import 'react-resizable/css/styles.css';

// Create responsive grid layout with width provider
const ResponsiveGridLayout = WidthProvider(Responsive);

interface StreamInfo {
  username: string;
  position: number;
}

type ChatPosition = 'right' | 'left' | 'bottom' | 'grid';
type LayoutConfig = { [key: string]: { x: number, y: number, w: number, h: number, i: string, minW?: number, minH?: number } };

export default function MultiStreamPage() {
  const searchParams = useSearchParams();
  const [streams, setStreams] = useState<StreamInfo[]>([]);
  const [layout, setLayout] = useState<'2x2' | '1+2' | '1+3'>('2x2');
  const [activeChatIndex, setActiveChatIndex] = useState(0);
  const [isCopied, setIsCopied] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isChatSelectorOpen, setIsChatSelectorOpen] = useState(false);
  const [chatPosition, setChatPosition] = useState<ChatPosition>('grid');
  const [showTips, setShowTips] = useState(true);
  const [compactType, setCompactType] = useState<'vertical' | null>('vertical');
  
  // Layouts for the grid - each stream gets an ID like s0, s1, etc., and the chat is 'chat'
  const [gridLayout, setGridLayout] = useState<LayoutConfig>({});
  
  // Throttling mechanism to prevent too many updates
  const throttleTimerRef = useRef<number | null>(null);
  const lastUpdateTimeRef = useRef<number>(0);
  const pendingLayoutRef = useRef<LayoutConfig | null>(null);

  // Throttled layout update function
  const throttledSetGridLayout = (newLayout: LayoutConfig) => {
    const now = Date.now();
    const timeSinceLastUpdate = now - lastUpdateTimeRef.current;
    
    // Store the latest layout in the ref
    pendingLayoutRef.current = newLayout;
    
    // If we've updated recently, throttle the update
    if (timeSinceLastUpdate < 100) { // 100ms throttle
      if (throttleTimerRef.current === null) {
        throttleTimerRef.current = window.setTimeout(() => {
          if (pendingLayoutRef.current) {
            setGridLayout(pendingLayoutRef.current);
            lastUpdateTimeRef.current = Date.now();
            pendingLayoutRef.current = null;
          }
          throttleTimerRef.current = null;
        }, 100 - timeSinceLastUpdate);
      }
    } else {
      // It's been long enough, update immediately
      setGridLayout(newLayout);
      lastUpdateTimeRef.current = now;
      pendingLayoutRef.current = null;
      
      // Clear any pending timer
      if (throttleTimerRef.current !== null) {
        clearTimeout(throttleTimerRef.current);
        throttleTimerRef.current = null;
      }
    }
  };
  
  // Get parent domain for Twitch embed
  const parentDomain = typeof window !== 'undefined' ? window.location.hostname : 'localhost';
  
  // Initialize and configure layouts
  useEffect(() => {
    // Extract streamers from URL parameters
    const streamersParam = searchParams.get('streamers');
    if (streamersParam) {
      const streamUsernames = streamersParam.split(',').filter(Boolean);
      
      // Create stream info objects with position
      const streamInfos = streamUsernames.map((username, index) => ({
        username: decodeURIComponent(username),
        position: index
      }));
      
      setStreams(streamInfos);
      
      // Generate a layout key based on the streamers (sorted to ensure consistency)
      const layoutKey = `multistream_layout_${streamUsernames.sort().join('_')}`;
      
      // Try to load saved layout from localStorage
      if (typeof window !== 'undefined') {
        try {
          const savedLayout = localStorage.getItem(layoutKey);
          if (savedLayout) {
            const parsedLayout = JSON.parse(savedLayout);
            // Validate that it has the correct structure before using it
            if (parsedLayout && typeof parsedLayout === 'object') {
              setGridLayout(parsedLayout);
              
              // Determine which layout type it most resembles
              if (parsedLayout['s0'] && parsedLayout['s0'].w >= 6) {
                if (parsedLayout['s0'].y === 0) {
                  setLayout('1+2');
                } else {
                  setLayout('1+3');
                }
              } else {
                setLayout('2x2');
              }
              
              return; // Skip generating a new layout
            }
          }
        } catch (error) {
          console.error('Error loading saved layout:', error);
          // Continue with generating a new layout
        }
      }
      
      // If no valid saved layout, generate a new one
      generateLayout(streamInfos, '2x2');
    }
  }, [searchParams]);
  
  // Check if tips have been seen before
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const tipsShown = localStorage.getItem('multiStreamTipsShown');
      if (tipsShown === 'true') {
        setShowTips(false);
      }
    }
  }, []);
  
  // Add a hint to show where to drag and resize after tips are dismissed
  useEffect(() => {
    if (!showTips && streams.length > 0) {
      // Wait a bit after tips are dismissed to show the hint
      const timer = setTimeout(() => {
        const firstStreamElement = document.querySelector('.stream-panel');
        if (firstStreamElement) {
          // Add a temporary class to show drag handle
          firstStreamElement.classList.add('show-hint');
          
          // Remove the hint after 3 seconds
          setTimeout(() => {
            firstStreamElement.classList.remove('show-hint');
          }, 3000);
        }
      }, 1000);
      
      return () => clearTimeout(timer);
    }
  }, [showTips, streams.length]);
  
  // Save the layout to localStorage whenever it changes
  useEffect(() => {
    if (typeof window !== 'undefined' && streams.length > 0 && Object.keys(gridLayout).length > 0) {
      try {
        // Generate the same layout key as used for loading
        const streamUsernames = streams.map(stream => stream.username).sort();
        const layoutKey = `multistream_layout_${streamUsernames.join('_')}`;
        
        // Save the current layout
        localStorage.setItem(layoutKey, JSON.stringify(gridLayout));
      } catch (error) {
        console.error('Error saving layout to localStorage:', error);
      }
    }
  }, [gridLayout, streams]);
  
  // Save tips state when dismissed
  const dismissTips = () => {
    setShowTips(false);
    if (typeof window !== 'undefined') {
      localStorage.setItem('multiStreamTipsShown', 'true');
    }
  };
  
  // Generate layout based on selected preset
  const generateLayout = (streamInfos: StreamInfo[], layoutType: '2x2' | '1+2' | '1+3') => {
    setLayout(layoutType);
    const newGridLayout: LayoutConfig = {};
    const streamCount = streamInfos.length;
    
    // Add the chat panel
    newGridLayout['chat'] = { x: 9, y: 0, w: 3, h: 12, i: 'chat' };
    
    // Different layouts
    if (layoutType === '2x2') {
      // Grid layout
      const cols = Math.min(3, streamCount);
      const rows = Math.ceil(streamCount / 3);
      
      streamInfos.forEach((stream, index) => {
        const row = Math.floor(index / cols);
        const col = index % cols;
        newGridLayout[`s${index}`] = { 
          x: col * 3, 
          y: row * 6, 
          w: 3, 
          h: 6, 
          i: `s${index}`,
          minW: 2,  // Minimum width of 2 columns
          minH: 4   // Minimum height of 4 rows
        };
      });
    } 
    else if (layoutType === '1+2') {
      // Feature layout - first stream is large
      newGridLayout[`s0`] = { x: 0, y: 0, w: 6, h: 12, i: `s0`, minW: 3, minH: 6 };
      
      // Layout the rest
      for (let i = 1; i < streamCount; i++) {
        const row = Math.floor((i - 1) / 3);
        const col = (i - 1) % 3;
        newGridLayout[`s${i}`] = { 
          x: 6 + col, 
          y: row * 4, 
          w: 3, 
          h: 4, 
          i: `s${i}`,
          minW: 2,
          minH: 3
        };
      }
    }
    else if (layoutType === '1+3') {
      // Theater layout - first stream is on top
      newGridLayout[`s0`] = { x: 0, y: 0, w: 9, h: 6, i: `s0`, minW: 4, minH: 4 };
      
      // Layout the rest
      for (let i = 1; i < streamCount; i++) {
        const col = (i - 1) % 3;
        newGridLayout[`s${i}`] = { 
          x: col * 3, 
          y: 6, 
          w: 3, 
          h: 6, 
          i: `s${i}`,
          minW: 2,
          minH: 4
        };
      }
    }
    
    // Update chat panel with minimum dimensions
    newGridLayout['chat'].minW = 2;
    newGridLayout['chat'].minH = 4;
    
    setGridLayout(newGridLayout);
  };
  
  const onLayoutChange = (layout: any) => {
    // Update layout when user moves things around
    const newGridLayout: LayoutConfig = {};
    layout.forEach((item: any) => {
      newGridLayout[item.i] = { x: item.x, y: item.y, w: item.w, h: item.h, i: item.i };
      
      // If we're updating the chat, also store its minWidth/minHeight
      if (item.i === 'chat' && gridLayout['chat']) {
        newGridLayout[item.i].minW = gridLayout['chat'].minW;
        newGridLayout[item.i].minH = gridLayout['chat'].minH;
      }
    });
    
    // Use throttled update to prevent performance issues
    throttledSetGridLayout(newGridLayout);
  };
  
  // Simplified drag/resize logic with better performance
  const onDragStop = (layout: any, oldItem: any, newItem: any, placeholder: any, event: any, element: any) => {
    // Don't do anything in auto-compact mode
    if (compactType === 'vertical') {
      return;
    }
    
    try {
      // Only auto-resize in free positioning mode
      const newLayouts = layout.map((item: any) => {
        if (item.i === newItem.i) {
          return { ...item };
        }
        return item;
      });
      
      // Simple update without complex calculations
      const updatedGridLayout: LayoutConfig = {};
      newLayouts.forEach((item: any) => {
        updatedGridLayout[item.i] = { 
          x: item.x, 
          y: item.y, 
          w: item.w, 
          h: item.h, 
          i: item.i,
          minW: gridLayout[item.i]?.minW,
          minH: gridLayout[item.i]?.minH
        };
      });
      
      // Use direct update for final position to ensure it's applied
      setGridLayout(updatedGridLayout);
    } catch (error) {
      console.error("Error in drag handler:", error);
    }
  };

  // Simplified onResize handler to prevent crashes
  const onResize = (layout: any, oldItem: any, newItem: any) => {
    try {
      // Avoid doing work during the resize - only at the end
    } catch (error) {
      console.error("Error in resize handler:", error);
    }
  };
  
  // Handle resize end event
  const onResizeStop = (layout: any, oldItem: any, newItem: any) => {
    try {
      // Only refresh chat when resize is complete
      if (newItem.i === 'chat') {
        // Force a refresh of the chat iframe by re-rendering
        setActiveChatIndex(prevIndex => prevIndex);
      }
      
      // Update layout with the final position
      onLayoutChange(layout);
    } catch (error) {
      console.error("Error in resize stop handler:", error);
    }
  };
  
  const copyShareLink = () => {
    const url = window.location.href;
    navigator.clipboard.writeText(url);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };
  
  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(err => {
        console.error(`Error attempting to enable full-screen mode: ${err.message}`);
      });
      setIsFullscreen(true);
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen();
        setIsFullscreen(false);
      }
    }
  };
  
  // Handle layout changes when exiting fullscreen with Escape key
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
    };
  }, []);
  
  // Change chat position
  const changeChatPosition = (position: ChatPosition) => {
    setChatPosition(position);
    
    // Create a new layout to reposition the chat
    const newLayout = { ...gridLayout };
    
    if (position === 'right') {
      // Move chat to the right side
      Object.keys(newLayout).forEach(key => {
        if (key === 'chat') {
          newLayout[key] = { ...newLayout[key], x: 9, y: 0, w: 3, h: 12 };
        } else {
          // Ensure streams don't overlap with chat
          if (newLayout[key].x >= 9) {
            newLayout[key] = { ...newLayout[key], x: Math.max(0, newLayout[key].x - 3) };
          }
        }
      });
    } else if (position === 'left') {
      // Move chat to the left side
      Object.keys(newLayout).forEach(key => {
        if (key === 'chat') {
          newLayout[key] = { ...newLayout[key], x: 0, y: 0, w: 3, h: 12 };
        } else {
          // Shift streams to the right
          newLayout[key] = { ...newLayout[key], x: newLayout[key].x + 3 };
        }
      });
    } else if (position === 'bottom') {
      // Move chat to the bottom
      Object.keys(newLayout).forEach(key => {
        if (key === 'chat') {
          newLayout[key] = { ...newLayout[key], x: 0, y: 12, w: 12, h: 4 };
        }
      });
    } else {
      // Grid - just leave it where it is
      // No changes needed
    }
    
    setGridLayout(newLayout);
  };
  
  const resetLayout = () => {
    // Reset the layout to the default 2x2 layout
    generateLayout(streams, '2x2');
    
    // Clear saved layout from localStorage
    if (typeof window !== 'undefined' && streams.length > 0) {
      try {
        const streamUsernames = streams.map(stream => stream.username).sort();
        const layoutKey = `multistream_layout_${streamUsernames.join('_')}`;
        localStorage.removeItem(layoutKey);
      } catch (error) {
        console.error('Error clearing saved layout:', error);
      }
    }
  };
  
  // Remove complex snapping logic that was causing issues
  const onDragStart = () => {};
  const onDrag = () => {};

  // Helper function to check available width at current position
  const checkAvailableWidth = (layout: any, currentItem: any) => {
    // Start with the maximum available width
    let availableWidth = 12 - currentItem.x;
    
    // Find the closest item to the right that would block expansion
    layout.forEach((item: any) => {
      if (
        item.i !== currentItem.i && // Not the same item
        item.y < currentItem.y + currentItem.h && // Overlaps vertically
        item.y + item.h > currentItem.y &&
        item.x > currentItem.x && // Is to the right
        item.x < currentItem.x + availableWidth // Is closer than current limit
      ) {
        // Update available width
        availableWidth = Math.min(availableWidth, item.x - currentItem.x);
      }
    });
    
    return availableWidth;
  };

  // Helper function to check available height at current position
  const checkAvailableHeight = (layout: any, currentItem: any) => {
    // Start with a reasonable maximum height
    let availableHeight = 30; // Large enough value
    
    // Find the closest item below that would block expansion
    layout.forEach((item: any) => {
      if (
        item.i !== currentItem.i && // Not the same item
        item.x < currentItem.x + currentItem.w && // Overlaps horizontally
        item.x + item.w > currentItem.x &&
        item.y > currentItem.y && // Is below
        item.y < currentItem.y + availableHeight // Is closer than current limit
      ) {
        // Update available height
        availableHeight = Math.min(availableHeight, item.y - currentItem.y);
      }
    });
    
    return availableHeight;
  };
  
  // Clean up throttling timers when component unmounts
  useEffect(() => {
    return () => {
      if (throttleTimerRef.current !== null) {
        clearTimeout(throttleTimerRef.current);
        throttleTimerRef.current = null;
      }
    };
  }, []);
  
  if (streams.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-black text-white p-6">
        <h1 className="text-2xl font-bold mb-6">No streams selected</h1>
        <p className="mb-4">Please select at least one stream to watch</p>
        <Link 
          href="/"
          className="px-4 py-2 bg-[#9146FF] rounded text-white flex items-center hover:bg-[#7a30e0]"
        >
          <ArrowLeft className="mr-2 h-5 w-5" />
          Return to Stream Selection
        </Link>
      </div>
    );
  }
  
  // Get current active chat username
  const activeChatUsername = streams[activeChatIndex]?.username || streams[0]?.username;
  
  return (
    <div className="flex flex-col h-screen bg-black">
      {/* Header with controls */}
      <div className="bg-[#0e0e10] text-white px-4 py-2 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/" className="text-white hover:text-gray-300 py-2">
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <h1 className="font-bold flex items-center">
            <Twitch className="h-5 w-5 mr-2 text-[#9146FF]" />
            GTA RP Multi-Stream Viewer
          </h1>
        </div>
        
        <div className="flex items-center gap-4">
          {/* Layout controls */}
          <div className="flex bg-black/40 rounded overflow-hidden">
            <button 
              onClick={() => generateLayout(streams, '2x2')}
              className={`p-2 ${layout === '2x2' ? 'bg-[#9146FF]' : 'hover:bg-black/60'}`}
              title="Grid layout"
            >
              <Grid3X3 className="h-5 w-5" />
            </button>
            <button 
              onClick={() => generateLayout(streams, '1+2')}
              className={`p-2 ${layout === '1+2' ? 'bg-[#9146FF]' : 'hover:bg-black/60'}`}
              title="Feature layout"
            >
              <LayoutGrid className="h-5 w-5" />
            </button>
            <button 
              onClick={() => generateLayout(streams, '1+3')}
              className={`p-2 ${layout === '1+3' ? 'bg-[#9146FF]' : 'hover:bg-black/60'}`}
              title="Theater layout"
            >
              <Grid2X2 className="h-5 w-5" />
            </button>
          </div>
          
          {/* Chat controls */}
          <div className="flex items-center gap-2">
            {/* Chat selector dropdown */}
            <div className="relative">
              <button
                onClick={() => setIsChatSelectorOpen(!isChatSelectorOpen)}
                className="px-3 py-1.5 bg-black/40 rounded flex items-center hover:bg-black/60 text-sm"
                title="Select chat to display"
              >
                <Users className="h-4 w-4 mr-1" />
                <span className="max-w-[100px] truncate">{activeChatUsername}</span>
                <ChevronDown className="h-3 w-3 ml-1" />
              </button>
              
              {isChatSelectorOpen && (
                <div className="absolute top-full right-0 mt-1 bg-[#18181b] rounded shadow-lg z-50 w-[200px]">
                  <div className="p-1">
                    {streams.map((stream, idx) => (
                      <button
                        key={stream.username}
                        onClick={() => {
                          setActiveChatIndex(idx);
                          setIsChatSelectorOpen(false);
                        }}
                        className={`w-full text-left px-3 py-2 rounded text-sm flex items-center ${
                          idx === activeChatIndex 
                            ? 'bg-[#9146FF] text-white' 
                            : 'hover:bg-black/40'
                        }`}
                      >
                        <Twitch className="h-3.5 w-3.5 mr-2 text-[#9146FF]" />
                        {stream.username}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
            
            {/* Chat position controls */}
            <div className="flex bg-black/40 rounded overflow-hidden">
              <button
                onClick={() => changeChatPosition('left')}
                className={`p-1.5 ${chatPosition === 'left' ? 'bg-[#9146FF]' : 'hover:bg-black/60'}`}
                title="Dock chat to left"
              >
                <PanelLeft className="h-4 w-4" />
              </button>
              <button
                onClick={() => changeChatPosition('right')}
                className={`p-1.5 ${chatPosition === 'right' ? 'bg-[#9146FF]' : 'hover:bg-black/60'}`}
                title="Dock chat to right"
              >
                <PanelRight className="h-4 w-4" />
              </button>
              <button
                onClick={() => changeChatPosition('bottom')}
                className={`p-1.5 ${chatPosition === 'bottom' ? 'bg-[#9146FF]' : 'hover:bg-black/60'}`}
                title="Dock chat to bottom"
              >
                <PanelBottom className="h-4 w-4" />
              </button>
              <button
                onClick={() => changeChatPosition('grid')}
                className={`p-1.5 ${chatPosition === 'grid' ? 'bg-[#9146FF]' : 'hover:bg-black/60'}`}
                title="Free position chat"
              >
                <Grid3X3 className="h-4 w-4" />
              </button>
            </div>
          </div>
          
          {/* Share button */}
          <button 
            onClick={copyShareLink} 
            className="p-2 bg-black/40 rounded hover:bg-black/60"
            title="Copy share link"
          >
            {isCopied ? <Check className="h-5 w-5 text-green-500" /> : <Copy className="h-5 w-5" />}
          </button>
          
          {/* Fullscreen toggle */}
          <button 
            onClick={toggleFullscreen}
            className="p-2 bg-black/40 rounded hover:bg-black/60"
            title={isFullscreen ? "Exit fullscreen" : "Fullscreen"}
          >
            {isFullscreen ? <Minimize className="h-5 w-5" /> : <Maximize className="h-5 w-5" />}
          </button>
          
          {/* Reset layout button */}
          <button 
            onClick={resetLayout}
            className="p-2 bg-black/40 rounded hover:bg-black/60 relative group"
            title="Reset layout"
          >
            <RotateCcw className="h-5 w-5" />
            <span className="absolute -bottom-10 right-0 bg-[#18181b] text-white text-xs py-1 px-2 rounded shadow-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-50">
              Reset to default layout
            </span>
          </button>

          {/* Toggle layout collision mode */}
          <button 
            onClick={() => setCompactType(prev => prev === 'vertical' ? null : 'vertical')}
            className="p-2 bg-black/40 rounded hover:bg-black/60 relative group"
            title={compactType === 'vertical' ? "Switch to free positioning" : "Switch to auto-compact mode"}
          >
            {compactType === 'vertical' ? <Lock className="h-5 w-5" /> : <Unlock className="h-5 w-5" />}
            <span className="absolute -bottom-10 right-0 bg-[#18181b] text-white text-xs py-1 px-2 rounded shadow-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-50">
              {compactType === 'vertical' ? "Auto-compact mode (on)" : "Free positioning mode (on)"}
            </span>
          </button>
        </div>
      </div>
      
      {/* Grid layout for streams and chat */}
      <div className="flex-1 bg-black relative overflow-auto">
        {/* Tips overlay */}
        {showTips && (
          <div className="absolute top-4 right-4 left-4 z-50 bg-[#18181b]/90 p-4 rounded-lg text-white shadow-lg border border-[#9146FF] max-w-md mx-auto">
            <div className="flex justify-between items-start mb-2">
              <h3 className="font-bold text-lg">💡 Quick Tips</h3>
              <button 
                onClick={dismissTips}
                className="text-white/60 hover:text-white"
              >
                ✕
              </button>
            </div>
            <ul className="space-y-2 text-sm">
              <li className="flex items-center">
                <div className="mr-2 w-6 h-6 bg-[#9146FF] rounded-full flex items-center justify-center text-xs">1</div>
                <span>Drag streams and chat using the purple handles at the top</span>
              </li>
              <li className="flex items-center">
                <div className="mr-2 w-6 h-6 bg-[#9146FF] rounded-full flex items-center justify-center text-xs">2</div>
                <span>Resize panels from any edge or corner</span>
              </li>
              <li className="flex items-center">
                <div className="mr-2 w-6 h-6 bg-[#9146FF] rounded-full flex items-center justify-center text-xs">3</div>
                <span>Use the layout presets at the top to quickly organize streams</span>
              </li>
            </ul>
          </div>
        )}
        
        <ResponsiveGridLayout
          className="layout"
          layouts={{ lg: Object.values(gridLayout) }}
          breakpoints={{ lg: 1200, md: 996, sm: 768, xs: 480, xxs: 0 }}
          cols={{ lg: 12, md: 12, sm: 12, xs: 12, xxs: 12 }}
          rowHeight={30}
          onLayoutChange={onLayoutChange}
          onResize={onResize}
          onResizeStop={onResizeStop} 
          isDraggable={true}
          isResizable={true}
          resizeHandles={['se', 'sw', 'nw', 'ne']} // Simplify to just corners
          margin={[4, 4]} // Larger margins to avoid collisions
          containerPadding={[4, 4]}
          compactType={compactType}
          preventCollision={compactType === null}
          maxRows={30}
          useCSSTransforms={false} // Disable CSS transforms that can cause cursor issues
          style={{ height: 'calc(100vh - 50px)', minHeight: '500px' }}
          autoSize={true}
          verticalCompact={compactType === 'vertical'}
          draggableHandle=".drag-handle"
          onDragStop={onDragStop}
        >
          {/* Stream panels */}
          {streams.map((stream, index) => (
            <div key={`s${index}`} className="bg-black stream-panel">
              <div className="w-full h-full relative group">
                <iframe
                  src={`https://player.twitch.tv/?channel=${encodeURIComponent(stream.username)}&parent=${parentDomain}&muted=${index !== 0}`}
                  height="100%"
                  width="100%"
                  allowFullScreen={true}
                  frameBorder="0"
                  style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
                ></iframe>
                <div className="absolute top-0 left-0 bg-black/70 text-white text-xs px-2 py-1 m-2 rounded z-10">
                  {stream.username}
                  {index === activeChatIndex && (
                    <span className="ml-1 bg-[#9146FF] px-1 rounded-sm">Chat</span>
                  )}
                </div>
                {/* Simplified drag handle */}
                <div className="absolute top-0 right-0 left-0 h-12 bg-black/50 cursor-grab z-40 drag-handle flex items-center justify-center">
                  <div className="px-3 py-1 rounded bg-[#9146FF] flex items-center justify-center text-white text-xs">
                    DRAG
                  </div>
                </div>
                
                {/* Simplified corner indicators - only render when hovering */}
                <div className="absolute top-0 left-0 w-4 h-4 border-t-2 border-l-2 border-[#9146FF] opacity-0 group-hover:opacity-100 transition-opacity"></div>
                <div className="absolute top-0 right-0 w-4 h-4 border-t-2 border-r-2 border-[#9146FF] opacity-0 group-hover:opacity-100 transition-opacity"></div>
                <div className="absolute bottom-0 left-0 w-4 h-4 border-b-2 border-l-2 border-[#9146FF] opacity-0 group-hover:opacity-100 transition-opacity"></div>
                <div className="absolute bottom-0 right-0 w-4 h-4 border-b-2 border-r-2 border-[#9146FF] opacity-0 group-hover:opacity-100 transition-opacity"></div>
              </div>
            </div>
          ))}
          
          {/* Chat panel */}
          <div key="chat" className="bg-black stream-panel">
            <div className="w-full h-full relative group">
              {/* Custom HTML using iframe with srcDoc to force black background for chat */}
              <iframe 
                className="w-full h-full border-0 absolute inset-0"
                srcDoc={`
                  <!DOCTYPE html>
                  <html style="background: #000000; height: 100%; width: 100%; overflow: hidden;">
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
                          display: flex;
                          flex-direction: column;
                        }
                        
                        /* Style the iframe */
                        #obs-chat {
                          border: none;
                          width: 100%;
                          height: 100%;
                          flex: 1;
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
                        
                        /* Chat title bar */
                        #chat-title {
                          position: relative;
                          padding: 8px 12px;
                          background-color: #0e0e10;
                          color: white;
                          font-size: 14px;
                          font-family: Arial, sans-serif;
                          z-index: 3;
                          display: flex;
                          justify-content: space-between;
                          align-items: center;
                          height: 36px;
                          box-sizing: border-box;
                        }
                        
                        #chat-title a {
                          color: #9146FF;
                          text-decoration: none;
                        }
                        
                        #chat-title a:hover {
                          text-decoration: underline;
                        }
                        
                        #obs-chat-container {
                          position: relative;
                          flex: 1;
                          display: flex;
                          overflow: hidden;
                        }
                      </style>
                    </head>
                    <body>
                      <div id="chat-container">
                        <div id="chat-title">
                          <span>Chat: ${activeChatUsername}</span>
                          <a href="https://www.twitch.tv/${activeChatUsername}" target="_blank">Open on Twitch</a>
                        </div>
                        <div id="obs-chat-container">
                          <iframe 
                            id="obs-chat"
                            src="https://nightdev.com/hosted/obschat/?theme=dark&channel=${activeChatUsername}&fade=false&bot_activity=true&prevent_clipping=true&background=000000&background_opacity=100&text_color=ffffff&text_opacity=100"
                            allowfullscreen="true"
                            style="width: 100%; height: 100%; border: none;"
                          ></iframe>
                          <div id="black-overlay"></div>
                        </div>
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
                          
                          // Handle window resize to ensure chat fills the area
                          window.addEventListener('resize', function() {
                            const container = document.getElementById('chat-container');
                            const obsChat = document.getElementById('obs-chat');
                            if (container && obsChat) {
                              // Force a repaint to ensure proper sizing
                              obsChat.style.display = 'none';
                              setTimeout(function() {
                                obsChat.style.display = 'block';
                              }, 0);
                            }
                          });
                        });
                      </script>
                    </body>
                  </html>
                `}
                sandbox="allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox"
              ></iframe>
              {/* Improved drag handle with visual indicator - make it larger */}
              <div className="absolute top-0 right-0 left-0 h-12 bg-black/50 cursor-grab z-40 drag-handle flex items-center justify-center">
                <div className="px-3 py-1 rounded bg-[#9146FF] flex items-center justify-center text-white text-xs">
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-1"><path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7"></path></svg>
                  DRAG CHAT
                </div>
              </div>
              
              {/* Resize indicator overlays that appear on hover */}
              <div className="absolute inset-0 pointer-events-none z-10 opacity-0 group-hover:opacity-100 transition-opacity">
                {/* Corner indicators */}
                <div className="absolute top-0 left-0 w-4 h-4 border-t-2 border-l-2 border-[#9146FF]"></div>
                <div className="absolute top-0 right-0 w-4 h-4 border-t-2 border-r-2 border-[#9146FF]"></div>
                <div className="absolute bottom-0 left-0 w-4 h-4 border-b-2 border-l-2 border-[#9146FF]"></div>
                <div className="absolute bottom-0 right-0 w-4 h-4 border-b-2 border-r-2 border-[#9146FF]"></div>
              </div>
              
              {/* Border overlay on hover */}
              <div className="absolute inset-0 border-2 border-transparent group-hover:border-[#9146FF] pointer-events-none transition-colors z-10"></div>
            </div>
          </div>
        </ResponsiveGridLayout>
      </div>
    </div>
  );
} 