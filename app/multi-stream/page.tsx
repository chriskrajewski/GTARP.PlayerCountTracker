"use client";

import { useEffect, useState, useRef } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { ArrowLeft, Twitch, Maximize, Minimize, Grid3X3, Grid2X2, LayoutGrid, Copy, Check, ChevronDown, Users, PanelLeft, PanelRight, PanelBottom, RotateCcw, Lock, Unlock, LayoutPanelTop, MonitorUp, PictureInPicture, Rows3, Rows2, Columns, Table2, Layers, ClipboardList, MessageSquare, Heart } from 'lucide-react';
import Link from 'next/link';
import { Responsive, WidthProvider } from 'react-grid-layout';
import 'react-grid-layout/css/styles.css';
import 'react-resizable/css/styles.css';
import FeedbackForm from '@/components/feedback-form';
import { createPortal } from 'react-dom';
import { useFeatureGate, FEATURE_GATES } from '@/lib/statsig';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

// Create responsive grid layout with width provider
const ResponsiveGridLayout = WidthProvider(Responsive);

interface StreamInfo {
  username: string;
  position: number;
}

type ChatPosition = 'right' | 'left' | 'bottom' | 'grid';
type LayoutConfig = { [key: string]: { x: number, y: number, w: number, h: number, i: string, minW?: number, minH?: number } };
type LayoutType = '2x2' | '1+2' | '1+3' | 'cascade' | 'horizontal' | 'vertical' | 'bigTop' | 'bigBottom' | 'pip' | '3+1' | 'pyramid';

export default function MultiStreamPage() {
  // Feature flag check
  const isMultiStreamEnabled = useFeatureGate(FEATURE_GATES.MULTI_STREAM);
  const isFeedbackEnabled = useFeatureGate(FEATURE_GATES.FEEDBACK_FORM);
  const isChangelogEnabled = useFeatureGate(FEATURE_GATES.CHANGELOG);
  
  const router = useRouter();
  const searchParams = useSearchParams();
  const [streams, setStreams] = useState<StreamInfo[]>([]);
  const [layout, setLayout] = useState<LayoutType>('2x2');
  const [activeChatIndex, setActiveChatIndex] = useState(0);
  const [isCopied, setIsCopied] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isChatSelectorOpen, setIsChatSelectorOpen] = useState(false);
  const [chatPosition, setChatPosition] = useState<ChatPosition>('grid');
  const [showTips, setShowTips] = useState(true);
  const [compactType, setCompactType] = useState<'vertical' | null>('vertical');
  const [isLayoutSelectorOpen, setIsLayoutSelectorOpen] = useState(false);
  
  // Refs for positioning modals
  const layoutButtonRef = useRef<HTMLButtonElement>(null);
  const chatButtonRef = useRef<HTMLButtonElement>(null);
  
  // Redirect if feature is disabled
  useEffect(() => {
    if (typeof window !== 'undefined' && !isMultiStreamEnabled) {
      router.push('/');
    }
  }, [isMultiStreamEnabled, router]);
  
  // If feature is disabled, show nothing during the redirect
  if (!isMultiStreamEnabled) {
    return null;
  }
  
  // Modal position state
  const [layoutModalPosition, setLayoutModalPosition] = useState({ top: 0, left: 0 });
  const [chatModalPosition, setChatModalPosition] = useState({ top: 0, right: 0 });
  
  // Update modal positions when buttons are mounted or window is resized
  useEffect(() => {
    const updateModalPositions = () => {
      if (layoutButtonRef.current) {
        const rect = layoutButtonRef.current.getBoundingClientRect();
        setLayoutModalPosition({ 
          top: rect.bottom + window.scrollY, 
          left: rect.left + window.scrollX 
        });
      }
      
      if (chatButtonRef.current) {
        const rect = chatButtonRef.current.getBoundingClientRect();
        setChatModalPosition({ 
          top: rect.bottom + window.scrollY, 
          right: window.innerWidth - rect.right + window.scrollX 
        });
      }
    };
    
    updateModalPositions();
    window.addEventListener('resize', updateModalPositions);
    
    return () => {
      window.removeEventListener('resize', updateModalPositions);
    };
  }, []);
  
  // Close modals when clicking outside
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (isLayoutSelectorOpen && 
          layoutButtonRef.current && 
          !layoutButtonRef.current.contains(e.target as Node)) {
        const modalEl = document.getElementById('layout-selector-modal');
        if (modalEl && !modalEl.contains(e.target as Node)) {
          setIsLayoutSelectorOpen(false);
        }
      }
      
      if (isChatSelectorOpen && 
          chatButtonRef.current && 
          !chatButtonRef.current.contains(e.target as Node)) {
        const modalEl = document.getElementById('chat-selector-modal');
        if (modalEl && !modalEl.contains(e.target as Node)) {
          setIsChatSelectorOpen(false);
        }
      }
    };
    
    document.addEventListener('mousedown', handleOutsideClick);
    
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
    };
  }, [isLayoutSelectorOpen, isChatSelectorOpen]);
  
  // Close modals on escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsLayoutSelectorOpen(false);
        setIsChatSelectorOpen(false);
      }
    };
    
    document.addEventListener('keydown', handleEscape);
    
    return () => {
      document.removeEventListener('keydown', handleEscape);
    };
  }, []);
  
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
  
  // Return parent domain for Twitch embed
  const parentDomain = typeof window !== "undefined" ? window.location.hostname : 'localhost';
  
  // Get active chat username from state
  const activeChatUsername = streams[activeChatIndex]?.username || streams[0]?.username;
  
  // Check if we're on a mobile device
  const [isMobile, setIsMobile] = useState(false);
  
  // Effect to check for mobile device
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    
    return () => window.removeEventListener('resize', checkMobile);
  }, []);
  
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
          // Silent error in production - just generate a new layout
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
        // Silent error in production
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
  const generateLayout = (streamInfos: StreamInfo[], layoutType: LayoutType) => {
    setLayout(layoutType);
    const newGridLayout: LayoutConfig = {};
    const streamCount = streamInfos.length;
    
    // Calculate total available rows (maxRows is set to 30 in the ResponsiveGridLayout)
    const totalRows = 24; // Use 24 rows to leave some spacing
    
    // For predefined layouts, always keep chat small and docked to the right
    const chatWidth = 3; // Fixed small width for chat
    
    // Different layouts
    if (layoutType === '2x2') {
      // Grid layout - evenly distribute streams in a grid
      const cols = Math.min(3, streamCount);
      const rows = Math.ceil(streamCount / cols);
      
      // Calculate row height to fill the space
      const rowHeight = Math.floor(totalRows / rows);
      
      streamInfos.forEach((stream, index) => {
        const row = Math.floor(index / cols);
        const col = index % cols;
        newGridLayout[`s${index}`] = { 
          x: col * 3, 
          y: row * rowHeight, 
          w: 3, 
          h: rowHeight, 
          i: `s${index}`,
          minW: 2,
          minH: 4
        };
      });
    } 
    else if (layoutType === '1+2') {
      // Feature layout - first stream is large
      newGridLayout[`s0`] = { x: 0, y: 0, w: 9 - chatWidth, h: totalRows, i: `s0`, minW: 3, minH: 6 };
      
      // Calculate height for smaller streams
      const smallStreamHeight = Math.floor(totalRows / Math.ceil((streamCount - 1) / 2));
      
      // Layout the rest
      for (let i = 1; i < streamCount; i++) {
        const row = Math.floor((i - 1) / 2);
        const col = (i - 1) % 2;
        newGridLayout[`s${i}`] = { 
          x: 4.5 + (col * 2.25), 
          y: row * smallStreamHeight, 
          w: 2.25, 
          h: smallStreamHeight, 
          i: `s${i}`,
          minW: 2,
          minH: 3
        };
      }
    }
    else if (layoutType === '1+3') {
      // Theater layout - first stream is on top
      const topHeight = Math.floor(totalRows / 2);
      newGridLayout[`s0`] = { x: 0, y: 0, w: 12 - chatWidth, h: topHeight, i: `s0`, minW: 4, minH: 4 };
      
      // Calculate width for bottom streams
      const bottomStreamWidth = Math.floor((12 - chatWidth) / Math.min(3, streamCount - 1));
      
      // Layout the rest
      for (let i = 1; i < streamCount; i++) {
        const col = (i - 1) % 3;
        newGridLayout[`s${i}`] = { 
          x: col * bottomStreamWidth, 
          y: topHeight, 
          w: bottomStreamWidth, 
          h: totalRows - topHeight, 
          i: `s${i}`,
          minW: 2,
          minH: 4
        };
      }
    }
    else if (layoutType === 'cascade') {
      // Cascade layout - staggered streams with better vertical distribution
      const streamHeight = Math.floor(totalRows / streamCount) + 2; // Add overlap
      
      streamInfos.forEach((stream, index) => {
        const offset = index * 1; // Horizontal stagger
        const verticalOffset = index * Math.floor((totalRows - streamHeight) / (streamCount - 1 || 1)); // Vertical stagger
        
        newGridLayout[`s${index}`] = { 
          x: offset, 
          y: verticalOffset, 
          w: 4, 
          h: streamHeight, 
          i: `s${index}`,
          minW: 2,
          minH: 4
        };
      });
    }
    else if (layoutType === 'horizontal') {
      // Horizontal ribbon layout - evenly distributed vertically
      const streamHeight = Math.floor(totalRows / streamCount);
      
      streamInfos.forEach((stream, index) => {
        newGridLayout[`s${index}`] = { 
          x: 0, 
          y: index * streamHeight, 
          w: 12 - chatWidth, 
          h: streamHeight, 
          i: `s${index}`,
          minW: 3,
          minH: 2
        };
      });
    }
    else if (layoutType === 'vertical') {
      // Vertical ribbon layout - full height columns
      const streamWidth = Math.floor((12 - chatWidth) / streamCount);
      
      streamInfos.forEach((stream, index) => {
        newGridLayout[`s${index}`] = { 
          x: index * streamWidth, 
          y: 0, 
          w: streamWidth, 
          h: totalRows, 
          i: `s${index}`,
          minW: 2,
          minH: 4
        };
      });
    }
    else if (layoutType === 'bigTop') {
      // Focus stream at top, others at bottom
      const topHeight = Math.floor(totalRows * 0.6); // Top stream takes 60% of space
      newGridLayout[`s0`] = { x: 0, y: 0, w: 12 - chatWidth, h: topHeight, i: `s0`, minW: 4, minH: 4 };
      
      // Small streams at bottom
      const bottomStreamCount = streamCount - 1;
      const streamWidth = Math.floor((12 - chatWidth) / bottomStreamCount);
      
      for (let i = 1; i < streamCount; i++) {
        newGridLayout[`s${i}`] = { 
          x: (i - 1) * streamWidth, 
          y: topHeight, 
          w: streamWidth, 
          h: totalRows - topHeight, 
          i: `s${i}`,
          minW: 2,
          minH: 3
        };
      }
    }
    else if (layoutType === 'bigBottom') {
      // Small streams at top, focus stream at bottom
      const topHeight = Math.floor(totalRows * 0.3); // Top streams take 30% of space
      const topStreamCount = streamCount - 1;
      const streamWidth = Math.floor((12 - chatWidth) / topStreamCount);
      
      // Small streams at top
      for (let i = 1; i < streamCount; i++) {
        newGridLayout[`s${i}`] = { 
          x: (i - 1) * streamWidth, 
          y: 0, 
          w: streamWidth, 
          h: topHeight, 
          i: `s${i}`,
          minW: 2,
          minH: 2
        };
      }
      
      // Focus stream at bottom
      newGridLayout[`s0`] = { x: 0, y: topHeight, w: 12 - chatWidth, h: totalRows - topHeight, i: `s0`, minW: 4, minH: 4 };
    }
    else if (layoutType === 'pip') {
      // Picture-in-picture layout
      // Main stream fills most of the screen
      newGridLayout[`s0`] = { x: 0, y: 0, w: 12 - chatWidth, h: totalRows, i: `s0`, minW: 4, minH: 4 };
      
      // PiP streams are small and overlaid - positioned in corners
      const pipSize = 3; // Size of PiP windows
      const positions = [
        { x: (12 - chatWidth) - pipSize, y: 0 },             // Top right
        { x: 0, y: 0 },                        // Top left
        { x: 0, y: totalRows - pipSize },      // Bottom left
        { x: (12 - chatWidth) - pipSize, y: totalRows - pipSize }  // Bottom right
      ];
      
      for (let i = 1; i < streamCount && i <= 4; i++) {
        const pos = positions[i-1];
        newGridLayout[`s${i}`] = { 
          x: pos.x, 
          y: pos.y, 
          w: pipSize, 
          h: pipSize, 
          i: `s${i}`,
          minW: 2,
          minH: 2
        };
      }
    }
    else if (layoutType === '3+1') {
      // 3 small streams on left, 1 larger stream on right
      // Larger stream on right
      newGridLayout[`s0`] = { x: 6, y: 0, w: 3, h: totalRows, i: `s0`, minW: 3, minH: 6 };
      
      // Three smaller streams on left - evenly distributed
      const smallStreamCount = Math.min(3, streamCount - 1);
      const smallStreamHeight = Math.floor(totalRows / smallStreamCount);
      
      for (let i = 1; i < streamCount && i <= 3; i++) {
        newGridLayout[`s${i}`] = { 
          x: 0, 
          y: (i - 1) * smallStreamHeight, 
          w: 6, 
          h: smallStreamHeight, 
          i: `s${i}`,
          minW: 3,
          minH: 3
        };
      }
    }
    else if (layoutType === 'pyramid') {
      // Pyramid layout
      if (streamCount >= 3) {
        // Top row: single stream
        const topHeight = Math.floor(totalRows / 2);
        newGridLayout[`s0`] = { x: 3, y: 0, w: 6, h: topHeight, i: `s0`, minW: 3, minH: 3 };
        
        // Bottom row: Two streams
        newGridLayout[`s1`] = { x: 0, y: topHeight, w: 6, h: totalRows - topHeight, i: `s1`, minW: 3, minH: 3 };
        newGridLayout[`s2`] = { x: 6, y: topHeight, w: 3, h: totalRows - topHeight, i: `s2`, minW: 3, minH: 3 };
        
        // If more streams, add them in another row
        if (streamCount > 3) {
          const extraRowHeight = Math.floor(totalRows * 0.25);
          const extraStreamWidth = Math.floor((12 - chatWidth) / (streamCount - 3));
          
          for (let i = 3; i < streamCount; i++) {
            const col = (i - 3);
            newGridLayout[`s${i}`] = { 
              x: col * extraStreamWidth, 
              y: totalRows - extraRowHeight, 
              w: extraStreamWidth, 
              h: extraRowHeight, 
              i: `s${i}`,
              minW: 2,
              minH: 2
            };
          }
        }
      } else {
        // Fallback for less than 3 streams
        generateLayout(streamInfos, '2x2');
        return;
      }
    }
    
    // Always place chat on the right side with a fixed small width
    newGridLayout['chat'] = { 
      x: 12 - chatWidth, 
      y: 0, 
      w: chatWidth, 
      h: totalRows, 
      i: 'chat', 
      minW: 2, 
      minH: 4 
    };
    
    // Update chat panel with minimum dimensions
    newGridLayout['chat'].minW = 2;
    newGridLayout['chat'].minH = 4;
    
    setGridLayout(newGridLayout);
    
    // Also update the chat position state to 'right' to match the layout
    setChatPosition('right');
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
      // Silent error in production
    }
  };

  // Simplified onResize handler to prevent crashes
  const onResize = (layout: any, oldItem: any, newItem: any) => {
    // Avoid doing work during the resize - only at the end
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
      // Silent error in production
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
      document.documentElement.requestFullscreen().catch(() => {
        // Silent error in production
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
    
    // Calculate total available rows (same as in generateLayout)
    const totalRows = 24;
    
    if (position === 'right') {
      // Move chat to the right side
      Object.keys(newLayout).forEach(key => {
        if (key === 'chat') {
          newLayout[key] = { ...newLayout[key], x: 9, y: 0, w: 3, h: totalRows };
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
          newLayout[key] = { ...newLayout[key], x: 0, y: 0, w: 3, h: totalRows };
        } else {
          // Shift streams to the right
          newLayout[key] = { ...newLayout[key], x: newLayout[key].x + 3 };
        }
      });
    } else if (position === 'bottom') {
      // Move chat to the bottom
      const chatHeight = Math.floor(totalRows * 0.2); // 20% height for bottom chat
      Object.keys(newLayout).forEach(key => {
        if (key === 'chat') {
          newLayout[key] = { ...newLayout[key], x: 0, y: totalRows - chatHeight, w: 12, h: chatHeight };
        }
        // Adjust heights of any streams that extend into chat area
        else if (newLayout[key].y + newLayout[key].h > totalRows - chatHeight) {
          newLayout[key].h = Math.max(2, (totalRows - chatHeight) - newLayout[key].y);
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
        // Silent error in production
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
  
  // State to track if the orientation warning has been dismissed
  const [isOrientationWarningDismissed, setIsOrientationWarningDismissed] = useState(false);
  
  if (streams.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-black text-white p-6">
        <h1 className="text-2xl font-bold mb-6">No streams selected</h1>
        <p className="mb-4">Please select at least one stream to watch</p>
        <Link 
          href="/"
          className="px-4 py-2 bg-[#004D61] rounded text-white flex items-center hover:bg-[#003a4d]"
        >
          <ArrowLeft className="mr-2 h-5 w-5" />
          Return to Stream Selection
        </Link>
      </div>
    );
  }
  
  // Portal-based modals for dropdowns
  const LayoutSelectorModal = () => {
    if (!isLayoutSelectorOpen) return null;
    
    const modalWidth = isMobile ? 280 : 200;
    
    return typeof window !== 'undefined' ? createPortal(
      <div 
        id="layout-selector-modal"
        className="fixed bg-[#18181b] rounded shadow-lg border border-[#2f2f35] z-50 overflow-hidden"
        style={{ 
          top: layoutModalPosition.top, 
          left: isMobile ? '50%' : layoutModalPosition.left, 
          width: modalWidth,
          maxWidth: '90vw',
          transform: isMobile ? 'translateX(-50%)' : 'none',
          maxHeight: '80vh',
          overflowY: 'auto'
        }}
      >
        <div className="p-2 grid grid-cols-2 gap-2">
          <button 
            onClick={() => {
              generateLayout(streams, '2x2');
              setIsLayoutSelectorOpen(false);
            }}
            className={`flex flex-col items-center gap-1 p-2 rounded ${layout === '2x2' ? 'bg-[#004D61]' : 'hover:bg-black/40'}`}
          >
            <Grid3X3 className="h-6 w-6" />
            <span className="text-xs">Grid</span>
          </button>
          
          <button 
            onClick={() => {
              generateLayout(streams, '1+2');
              setIsLayoutSelectorOpen(false);
            }}
            className={`flex flex-col items-center gap-1 p-2 rounded ${layout === '1+2' ? 'bg-[#004D61]' : 'hover:bg-black/40'}`}
          >
            <LayoutGrid className="h-6 w-6" />
            <span className="text-xs">Feature</span>
          </button>
          
          <button 
            onClick={() => {
              generateLayout(streams, '1+3');
              setIsLayoutSelectorOpen(false);
            }}
            className={`flex flex-col items-center gap-1 p-2 rounded ${layout === '1+3' ? 'bg-[#004D61]' : 'hover:bg-black/40'}`}
          >
            <Grid2X2 className="h-6 w-6" />
            <span className="text-xs">Theater</span>
          </button>
          
          <button 
            onClick={() => {
              generateLayout(streams, 'horizontal');
              setIsLayoutSelectorOpen(false);
            }}
            className={`flex flex-col items-center gap-1 p-2 rounded ${layout === 'horizontal' ? 'bg-[#004D61]' : 'hover:bg-black/40'}`}
          >
            <Rows3 className="h-6 w-6" />
            <span className="text-xs">Horizontal</span>
          </button>
          
          <button 
            onClick={() => {
              generateLayout(streams, 'vertical');
              setIsLayoutSelectorOpen(false);
            }}
            className={`flex flex-col items-center gap-1 p-2 rounded ${layout === 'vertical' ? 'bg-[#004D61]' : 'hover:bg-black/40'}`}
          >
            <Columns className="h-6 w-6" />
            <span className="text-xs">Vertical</span>
          </button>
          
          <button 
            onClick={() => {
              generateLayout(streams, 'bigTop');
              setIsLayoutSelectorOpen(false);
            }}
            className={`flex flex-col items-center gap-1 p-2 rounded ${layout === 'bigTop' ? 'bg-[#004D61]' : 'hover:bg-black/40'}`}
          >
            <LayoutPanelTop className="h-6 w-6" />
            <span className="text-xs">Big Top</span>
          </button>
          
          <button 
            onClick={() => {
              generateLayout(streams, 'pip');
              setIsLayoutSelectorOpen(false);
            }}
            className={`flex flex-col items-center gap-1 p-2 rounded ${layout === 'pip' ? 'bg-[#004D61]' : 'hover:bg-black/40'}`}
          >
            <PictureInPicture className="h-6 w-6" />
            <span className="text-xs">Picture-in-Picture</span>
          </button>
          
          <button 
            onClick={() => {
              generateLayout(streams, 'cascade');
              setIsLayoutSelectorOpen(false);
            }}
            className={`flex flex-col items-center gap-1 p-2 rounded ${layout === 'cascade' ? 'bg-[#004D61]' : 'hover:bg-black/40'}`}
          >
            <Layers className="h-6 w-6" />
            <span className="text-xs">Cascade</span>
          </button>
          
          {/* Compact mode toggle */}
          <div className="col-span-2 mt-2 pt-2 border-t border-gray-700">
            <button 
              onClick={() => {
                setCompactType(prev => prev === 'vertical' ? null : 'vertical');
                setIsLayoutSelectorOpen(false);
              }}
              className="w-full flex items-center justify-between p-2 hover:bg-black/40 rounded"
            >
              <span className="text-sm">Auto-compact</span>
              <div className={`w-8 h-4 rounded-full flex items-center ${compactType === 'vertical' ? 'bg-[#004D61]' : 'bg-gray-700'}`}>
                <div className={`w-3 h-3 rounded-full bg-white transform transition-transform ${compactType === 'vertical' ? 'translate-x-4' : 'translate-x-1'}`}></div>
              </div>
            </button>
          </div>
        </div>
      </div>,
      document.body
    ) : null;
  };
  
  // Chat selector modal with streamer list
  const ChatSelectorModal = () => {
    if (!isChatSelectorOpen) return null;
    
    return typeof window !== 'undefined' ? createPortal(
      <div 
        id="chat-selector-modal"
        className="fixed bg-[#18181b] rounded shadow-lg border border-[#2f2f35] z-50 overflow-hidden"
        style={{ 
          top: chatModalPosition.top, 
          right: isMobile ? '50%' : chatModalPosition.right,
          transform: isMobile ? 'translateX(50%)' : 'none',
          width: isMobile ? 280 : 200,
          maxWidth: '90vw',
          maxHeight: '80vh',
          overflowY: 'auto'
        }}
      >
        <div className="p-2">
          {/* Chat position controls for mobile */}
          {isMobile && (
            <div className="mb-2 pb-2 border-b border-gray-700">
              <div className="text-xs text-gray-400 mb-1 px-2">Chat Position</div>
              <div className="grid grid-cols-4 gap-1">
                <button
                  onClick={() => {
                    changeChatPosition('left');
                    setIsChatSelectorOpen(false);
                  }}
                  className={`flex flex-col items-center p-2 rounded ${chatPosition === 'left' ? 'bg-[#004D61]' : 'hover:bg-black/40'}`}
                  title="Dock chat to left"
                >
                  <PanelLeft className="h-5 w-5" />
                  <span className="text-xs mt-1">Left</span>
                </button>
                <button
                  onClick={() => {
                    changeChatPosition('right');
                    setIsChatSelectorOpen(false);
                  }}
                  className={`flex flex-col items-center p-2 rounded ${chatPosition === 'right' ? 'bg-[#004D61]' : 'hover:bg-black/40'}`}
                  title="Dock chat to right"
                >
                  <PanelRight className="h-5 w-5" />
                  <span className="text-xs mt-1">Right</span>
                </button>
                <button
                  onClick={() => {
                    changeChatPosition('bottom');
                    setIsChatSelectorOpen(false);
                  }}
                  className={`flex flex-col items-center p-2 rounded ${chatPosition === 'bottom' ? 'bg-[#004D61]' : 'hover:bg-black/40'}`}
                  title="Dock chat to bottom"
                >
                  <PanelBottom className="h-5 w-5" />
                  <span className="text-xs mt-1">Bottom</span>
                </button>
                <button
                  onClick={() => {
                    changeChatPosition('grid');
                    setIsChatSelectorOpen(false);
                  }}
                  className={`flex flex-col items-center p-2 rounded ${chatPosition === 'grid' ? 'bg-[#004D61]' : 'hover:bg-black/40'}`}
                  title="Free position chat"
                >
                  <Grid3X3 className="h-5 w-5" />
                  <span className="text-xs mt-1">Free</span>
                </button>
              </div>
            </div>
          )}
        
          <div className="text-xs text-gray-400 mb-1 px-2">Select Chat</div>
          <div className="space-y-1">
            {streams.map((stream, index) => (
              <button
                key={index}
                onClick={() => {
                  setActiveChatIndex(index);
                  setIsChatSelectorOpen(false);
                }}
                className={`w-full text-left px-3 py-2 rounded flex items-center ${index === activeChatIndex ? 'bg-[#004D61]' : 'hover:bg-black/40'}`}
              >
                <Twitch className="h-4 w-4 mr-2" />
                <span className={`${isMobile ? 'text-sm' : 'text-xs'}`}>{stream.username}</span>
              </button>
            ))}
          </div>
        </div>
      </div>,
      document.body
    ) : null;
  };

  return (
    <div className="flex flex-col h-screen bg-[#0e0e10] text-white overflow-hidden">
      {/* Header with controls */}
      <div className={`flex ${isMobile ? 'flex-col space-y-2 p-2' : 'flex-row items-center justify-between p-3'} 
        twitch-dark-bg text-white z-10 sticky top-0 border-b border-[#26262c]`} style={{ backgroundColor: '#0e0e10' }}>
        
        {/* Left section - Back button and title */}
        <div className={`${isMobile ? 'w-full flex justify-between' : 'flex items-center gap-4'}`}>
          <div className="flex items-center">
            <Link href="/" className="text-white/80 hover:text-white mr-3">
              <ArrowLeft className="h-5 w-5" />
            </Link>
            <h1 className="font-bold flex items-center">
              <img 
                src="https://cdn.7tv.app/emote/01FHJJSFZ00001HW666WR6HKPB/2x.avif" 
                alt="Twitch Logo" 
                className="h-9 w-9 mr-2" 
              />
              <span>Multi-Stream Viewer</span>
            </h1>
          </div>
          
          {/* Mobile layout controls */}
          {isMobile && (
            <div className="flex items-center">
              {/* Layout selector button for mobile */}
              <button
                ref={layoutButtonRef}
                onClick={() => {
                  setIsLayoutSelectorOpen(!isLayoutSelectorOpen);
                  if (layoutButtonRef.current) {
                    const rect = layoutButtonRef.current.getBoundingClientRect();
                    setLayoutModalPosition({
                      top: rect.bottom + window.scrollY,
                      left: rect.left + window.scrollX
                    });
                  }
                }}
                className="p-2 bg-black/40 rounded hover:bg-black/60 mr-2"
                title="Change layout"
              >
                <Grid3X3 className="h-5 w-5" />
              </button>
              
              {/* Chat selector button for mobile */}
              <button
                ref={chatButtonRef}
                onClick={() => {
                  setIsChatSelectorOpen(!isChatSelectorOpen);
                  if (chatButtonRef.current) {
                    const rect = chatButtonRef.current.getBoundingClientRect();
                    setChatModalPosition({
                      top: rect.bottom + window.scrollY,
                      right: window.innerWidth - rect.right + window.scrollX
                    });
                  }
                }}
                className="p-2 bg-black/40 rounded hover:bg-black/60"
                title="Chat options"
              >
                <MessageSquare className="h-5 w-5" />
              </button>
            </div>
          )}
        </div>
        
        {/* Center controls - Only visible on desktop */}
        {!isMobile && (
          <div className="flex items-center gap-4">
            {/* Layout controls with dropdown for more options */}
            <div className="flex bg-black/40 rounded overflow-hidden">
              <button 
                onClick={() => generateLayout(streams, '2x2')}
                className={`p-2 ${layout === '2x2' ? 'bg-[#004D61]' : 'hover:bg-black/60'}`}
                title="Grid layout"
              >
                <Grid3X3 className="h-5 w-5" />
              </button>
              <button 
                onClick={() => generateLayout(streams, '1+2')}
                className={`p-2 ${layout === '1+2' ? 'bg-[#004D61]' : 'hover:bg-black/60'}`}
                title="Feature layout"
              >
                <LayoutGrid className="h-5 w-5" />
              </button>
              <button 
                onClick={() => generateLayout(streams, '1+3')}
                className={`p-2 ${layout === '1+3' ? 'bg-[#004D61]' : 'hover:bg-black/60'}`}
                title="Theater layout"
              >
                <Grid2X2 className="h-5 w-5" />
              </button>
              <button
                ref={layoutButtonRef}
                onClick={() => {
                  setIsLayoutSelectorOpen(!isLayoutSelectorOpen);
                  if (layoutButtonRef.current) {
                    const rect = layoutButtonRef.current.getBoundingClientRect();
                    setLayoutModalPosition({
                      top: rect.bottom + window.scrollY,
                      left: rect.left + window.scrollX
                    });
                  }
                }}
                className="p-2 hover:bg-black/60"
                title="More layouts"
              >
                <ChevronDown className="h-5 w-5" />
              </button>
            </div>
            
            {/* Chat controls */}
            <div className="flex items-center gap-2">
              {/* Chat selector dropdown */}
              <div className="relative">
                <button
                  ref={chatButtonRef}
                  onClick={() => {
                    setIsChatSelectorOpen(!isChatSelectorOpen);
                    if (chatButtonRef.current) {
                      const rect = chatButtonRef.current.getBoundingClientRect();
                      setChatModalPosition({
                        top: rect.bottom + window.scrollY,
                        right: window.innerWidth - rect.right + window.scrollX
                      });
                    }
                  }}
                  className="px-3 py-1.5 bg-black/40 rounded flex items-center hover:bg-black/60 text-sm"
                  title="Select chat to display"
                >
                  <Users className="h-4 w-4 mr-1" />
                  <span className="max-w-[100px] truncate">{activeChatUsername}</span>
                  <ChevronDown className="h-3 w-3 ml-1" />
                </button>
              </div>
              
              {/* Chat position controls */}
              <div className="flex bg-black/40 rounded overflow-hidden">
                <button
                  onClick={() => changeChatPosition('left')}
                  className={`p-1.5 ${chatPosition === 'left' ? 'bg-[#004D61]' : 'hover:bg-black/60'}`}
                  title="Dock chat to left"
                >
                  <PanelLeft className="h-4 w-4" />
                </button>
                <button
                  onClick={() => changeChatPosition('right')}
                  className={`p-1.5 ${chatPosition === 'right' ? 'bg-[#004D61]' : 'hover:bg-black/60'}`}
                  title="Dock chat to right"
                >
                  <PanelRight className="h-4 w-4" />
                </button>
                <button
                  onClick={() => changeChatPosition('bottom')}
                  className={`p-1.5 ${chatPosition === 'bottom' ? 'bg-[#004D61]' : 'hover:bg-black/60'}`}
                  title="Dock chat to bottom"
                >
                  <PanelBottom className="h-4 w-4" />
                </button>
                <button
                  onClick={() => changeChatPosition('grid')}
                  className={`p-1.5 ${chatPosition === 'grid' ? 'bg-[#004D61]' : 'hover:bg-black/60'}`}
                  title="Free position chat"
                >
                  <Grid3X3 className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
        )}
        
        {/* Right section - Only visible on desktop */}
        <div className={`flex items-center gap-2 ${isMobile ? 'w-full justify-between mt-2' : ''}`}>
          {/* Mobile layout: more condensed controls */}
          {isMobile ? (
            <>
              <button
                onClick={copyShareLink}
                className="p-2 bg-black/40 rounded hover:bg-black/60"
                title="Copy share link"
              >
                {isCopied ? <Check className="h-5 w-5 text-green-500" /> : <Copy className="h-5 w-5" />}
              </button>
              
              <button
                onClick={toggleFullscreen}
                className="p-2 bg-black/40 rounded hover:bg-black/60"
                title={isFullscreen ? "Exit fullscreen" : "Fullscreen"}
              >
                {isFullscreen ? <Minimize className="h-5 w-5" /> : <Maximize className="h-5 w-5" />}
              </button>
              
              <button 
                onClick={resetLayout}
                className="p-2 bg-black/40 rounded hover:bg-black/60"
                title="Reset layout"
              >
                <RotateCcw className="h-5 w-5" />
              </button>
              
              <button 
                onClick={() => setCompactType(prev => prev === 'vertical' ? null : 'vertical')}
                className="p-2 bg-black/40 rounded hover:bg-black/60"
                title={compactType === 'vertical' ? "Switch to free positioning" : "Switch to auto-compact mode"}
              >
                {compactType === 'vertical' ? <Lock className="h-5 w-5" /> : <Unlock className="h-5 w-5" />}
              </button>
            </>
          ) : (
            <>
              {/* Desktop layout: full controls */}
              <button
                onClick={copyShareLink}
                className="p-2 bg-black/40 rounded hover:bg-black/60"
                title="Copy share link"
              >
                {isCopied ? <Check className="h-5 w-5 text-green-500" /> : <Copy className="h-5 w-5" />}
              </button>
              
              <button
                onClick={toggleFullscreen}
                className="p-2 bg-black/40 rounded hover:bg-black/60"
                title={isFullscreen ? "Exit fullscreen" : "Fullscreen"}
              >
                {isFullscreen ? <Minimize className="h-5 w-5" /> : <Maximize className="h-5 w-5" />}
              </button>
              
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
              
              {/* Feedback Button */}
              <FeedbackForm 
                trigger={
                  <button className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#18181b] text-[#EFEFF1] rounded-md hover:bg-[#26262c] transition-colors text-xs font-medium" style={{ color: '#EFEFF1' }}>
                    <MessageSquare className="h-3.5 w-3.5 text-[#EFEFF1]" />
                    <span className="text-[#EFEFF1]">Feedback</span>
                  </button>
                }
              />
              
              {/* Changelog Button */}
              <Link href="/changelog" className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#18181b] text-[#EFEFF1] rounded-md hover:bg-[#26262c] transition-colors text-xs font-medium" style={{ color: '#EFEFF1' }}>
                <ClipboardList className="h-3.5 w-3.5 text-[#EFEFF1]" />
                <span className="text-[#EFEFF1]">Changelog</span>
              </Link>
              
              {/* Donate Button */}
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <a 
                      href="https://streamelements.com/alantiix/tip" 
                      target="_blank" 
                      rel="noopener noreferrer" 
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#18181b] text-[#EFEFF1] rounded-md hover:bg-[#26262c] transition-colors text-xs font-medium"
                    >
                      <Heart className="h-3.5 w-3.5 text-[#ff4545]" />
                      <span className="text-[#EFEFF1]">Donate</span>
                    </a>
                  </TooltipTrigger>
                  <TooltipContent className="bg-[#18181b] text-white border-[#26262c]">
                    Buy me a cup of coffee :)
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </>
          )}
        </div>
      </div>
      
      {/* Grid layout for streams and chat */}
      <div className="flex-1 bg-black relative overflow-auto">
        {/* Tips overlay */}
        {showTips && (
          <div className="absolute top-4 right-4 left-4 z-50 bg-[#18181b]/90 p-4 rounded-lg text-white shadow-lg border border-[#004D61] max-w-md mx-auto">
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
                <div className="mr-2 w-6 h-6 bg-[#004D61] rounded-full flex items-center justify-center text-xs">1</div>
                <span>Drag streams and chat using the handles at the top</span>
              </li>
              <li className="flex items-center">
                <div className="mr-2 w-6 h-6 bg-[#004D61] rounded-full flex items-center justify-center text-xs">2</div>
                <span>Resize panels from any edge or corner</span>
              </li>
              <li className="flex items-center">
                <div className="mr-2 w-6 h-6 bg-[#004D61] rounded-full flex items-center justify-center text-xs">3</div>
                <span>Use the layout presets at the top to quickly organize streams</span>
              </li>
              {isMobile && (
                <li className="flex items-center">
                  <div className="mr-2 w-6 h-6 bg-[#004D61] rounded-full flex items-center justify-center text-xs">4</div>
                  <span className="text-yellow-300">On mobile: rotate to landscape for better viewing</span>
                </li>
              )}
            </ul>
          </div>
        )}
        
        {/* Mobile orientation warning */}
        {isMobile && window.innerHeight > window.innerWidth && !isOrientationWarningDismissed && (
          <div className="absolute top-4 right-4 left-4 z-40 bg-yellow-700/90 p-3 rounded-lg text-white shadow-lg border border-yellow-600 text-sm">
            <div className="flex justify-between items-center">
              <p>Rotate your device to landscape mode for a better viewing experience</p>
              <button 
                onClick={() => setIsOrientationWarningDismissed(true)}
                className="ml-2 p-1 bg-yellow-600/50 rounded hover:bg-yellow-600 flex-shrink-0"
                aria-label="Dismiss orientation warning"
              >
                <span className="text-white font-bold text-xs px-1">✕</span>
              </button>
            </div>
          </div>
        )}
        
        <ResponsiveGridLayout
          className="layout"
          layouts={{ 
            lg: Object.values(gridLayout),
            md: Object.values(gridLayout).map(item => ({
              ...item,
              w: Math.min(item.w, 12), // Ensure items don't exceed container width
              h: Math.max(item.h, 3)   // Ensure minimum height for visibility
            })),
            sm: Object.values(gridLayout).map(item => ({
              ...item,
              w: 12,                    // Full width on small screens
              h: item.i === 'chat' ? 6 : 12  // Smaller height for chat on mobile
            })),
            xs: Object.values(gridLayout).map(item => ({
              ...item,
              w: 12,                    // Full width on extra small screens
              h: item.i === 'chat' ? 6 : 8    // Even smaller for mobile
            }))
          }}
          breakpoints={{ lg: 1200, md: 996, sm: 768, xs: 480, xxs: 0 }}
          cols={{ lg: 12, md: 12, sm: 12, xs: 12, xxs: 12 }}
          rowHeight={isMobile ? 25 : 30}
          onLayoutChange={onLayoutChange}
          onResize={onResize}
          onResizeStop={onResizeStop} 
          isDraggable={true}
          isResizable={true}
          resizeHandles={isMobile ? ['se'] : ['se', 'sw', 'nw', 'ne']} // Simplify on mobile
          margin={[4, 4]} // Larger margins to avoid collisions
          containerPadding={[4, 4]}
          compactType={compactType}
          preventCollision={compactType === null}
          maxRows={30}
          useCSSTransforms={false} // Disable CSS transforms that can cause cursor issues
          style={{ height: 'calc(100vh - 50px)', minHeight: isMobile ? '300px' : '500px' }}
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
                <div className="absolute top-0 left-0 text-white text-xs px-2 py-1 m-2 rounded z-10" style={{ backgroundColor: 'rgba(20, 20, 20, 0.95)' }}>
                  {stream.username}
                  {index === activeChatIndex && (
                    <span className="ml-1 px-1 rounded-sm" style={{ backgroundColor: '#004D61' }}>Chat</span>
                  )}
                </div>
                {/* Improved drag handle */}
                <div className={`absolute top-0 right-0 left-0 ${isMobile ? 'h-16' : 'h-12'} bg-black/50 cursor-grab z-40 drag-handle flex items-center justify-center opacity-30 hover:opacity-80 transition-opacity`}>
                  <div className={`px-2 py-0.5 rounded bg-[#004D61]/80 flex items-center justify-center text-white ${isMobile ? 'text-sm py-1' : 'text-xs'}`}>
                    <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-1"><path d="M5 9h14M5 15h14"></path></svg>
                    {isMobile ? 'Drag to Move' : 'Move'}
                  </div>
                </div>
                
                {/* Simplified corner indicators - only render when hovering */}
                <div className="absolute top-0 left-0 w-4 h-4 border-t-2 border-l-2 border-[#004D61] opacity-0 group-hover:opacity-100 transition-opacity"></div>
                <div className="absolute top-0 right-0 w-4 h-4 border-t-2 border-r-2 border-[#004D61] opacity-0 group-hover:opacity-100 transition-opacity"></div>
                <div className="absolute bottom-0 left-0 w-4 h-4 border-b-2 border-l-2 border-[#004D61] opacity-0 group-hover:opacity-100 transition-opacity"></div>
                <div className="absolute bottom-0 right-0 w-4 h-4 border-b-2 border-r-2 border-[#004D61] opacity-0 group-hover:opacity-100 transition-opacity"></div>
                
                {/* Mobile-specific resize indicator */}
                {isMobile && (
                  <div className="absolute bottom-0 right-0 w-24 h-24 flex items-center justify-center pointer-events-none z-30 opacity-50">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M22 2L12 12M22 12L22 2L12 2" stroke="#004D61" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" transform="rotate(135 12 12)"/>
                    </svg>
                  </div>
                )}
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
                      <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
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
                          color: #004D61;
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
                        
                        /* Mobile optimizations */
                        @media (max-width: 768px) {
                          #chat-title {
                            height: 44px;
                            font-size: 16px;
                            padding: 10px 15px;
                          }
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
                                
                                /* Mobile optimizations */
                                @media (max-width: 768px) {
                                  .chat-line { 
                                    font-size: 14px !important; 
                                  }
                                  .chat-badges img {
                                    width: 18px;
                                    height: 18px;
                                  }
                                }
                              \`;
                              
                              // Append the style to the iframe's document
                              iframeDoc.head.appendChild(style);
                              
                              // Also directly set background color on body and html
                              iframeDoc.documentElement.style.backgroundColor = '#000000';
                              iframeDoc.body.style.backgroundColor = '#000000';
                            } catch (err) {
                              // Silent error in production
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
              <div className="absolute top-0 right-0 left-0 h-12 bg-black/50 cursor-grab z-40 drag-handle flex items-center justify-center opacity-30 hover:opacity-80 transition-opacity">
                <div className="px-2 py-0.5 rounded bg-[#004D61]/80 flex items-center justify-center text-white text-xs">
                  <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-1"><path d="M5 9h14M5 15h14"></path></svg>
                  Move Chat
                </div>
              </div>
              
              {/* Resize indicator overlays that appear on hover */}
              <div className="absolute inset-0 pointer-events-none z-10 opacity-0 group-hover:opacity-100 transition-opacity">
                {/* Corner indicators */}
                <div className="absolute top-0 left-0 w-4 h-4 border-t-2 border-l-2 border-[#004D61]"></div>
                <div className="absolute top-0 right-0 w-4 h-4 border-t-2 border-r-2 border-[#004D61]"></div>
                <div className="absolute bottom-0 left-0 w-4 h-4 border-b-2 border-l-2 border-[#004D61]"></div>
                <div className="absolute bottom-0 right-0 w-4 h-4 border-b-2 border-r-2 border-[#004D61]"></div>
              </div>
              
              {/* Border overlay on hover */}
              <div className="absolute inset-0 border-2 border-transparent group-hover:border-[#004D61] pointer-events-none transition-colors z-10"></div>
            </div>
          </div>
        </ResponsiveGridLayout>
      </div>
      
      {/* Render portal-based modals */}
      <LayoutSelectorModal />
      <ChatSelectorModal />
    </div>
  );
} 