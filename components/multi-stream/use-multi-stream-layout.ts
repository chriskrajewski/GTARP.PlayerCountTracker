"use client";

import { useState, useCallback, useRef, useEffect } from 'react';
import type { 
  StreamInfo, 
  LayoutType, 
  LayoutConfig, 
  LayoutItem,
  ChatPosition 
} from './types';
import { TOTAL_ROWS, DEFAULT_CHAT_WIDTH, GRID_COLS } from './types';

interface UseMultiStreamLayoutOptions {
  streams: StreamInfo[];
  initialLayout?: LayoutType;
  isChatVisible?: boolean;
}

interface UseMultiStreamLayoutReturn {
  layout: LayoutType;
  gridLayout: LayoutConfig;
  isEditMode: boolean;
  chatPosition: ChatPosition;
  setLayout: (layout: LayoutType) => void;
  setGridLayout: (layout: LayoutConfig) => void;
  setIsEditMode: (isEdit: boolean) => void;
  setChatPosition: (position: ChatPosition) => void;
  generateLayout: (layoutType: LayoutType) => void;
  resetLayout: () => void;
  onLayoutChange: (newLayout: LayoutItem[]) => void;
}

/**
 * Generate a stable localStorage key for layout persistence
 * Uses platform:identifier sorted alphabetically for consistency
 */
function getLayoutStorageKey(streams: StreamInfo[]): string {
  const streamKeys = streams
    .map(s => `${s.platform}:${s.username.toLowerCase()}`)
    .sort()
    .join('_');
  return `multistream_layout_v2_${streamKeys}`;
}

/**
 * Hook for managing multi-stream layout state and persistence
 */
export function useMultiStreamLayout({
  streams,
  initialLayout = '2x2',
  isChatVisible = false,
}: UseMultiStreamLayoutOptions): UseMultiStreamLayoutReturn {
  const [layout, setLayoutState] = useState<LayoutType>(initialLayout);
  const [gridLayout, setGridLayoutState] = useState<LayoutConfig>({});
  const [isEditMode, setIsEditMode] = useState(false);
  const [chatPosition, setChatPosition] = useState<ChatPosition>(isChatVisible ? 'right' : 'hidden');
  
  // Throttling for layout updates
  const throttleTimerRef = useRef<number | null>(null);
  const lastUpdateTimeRef = useRef<number>(0);
  const pendingLayoutRef = useRef<LayoutConfig | null>(null);

  // Throttled layout update to prevent performance issues
  const throttledSetGridLayout = useCallback((newLayout: LayoutConfig) => {
    const now = Date.now();
    const timeSinceLastUpdate = now - lastUpdateTimeRef.current;
    
    pendingLayoutRef.current = newLayout;
    
    if (timeSinceLastUpdate < 100) {
      if (throttleTimerRef.current === null) {
        throttleTimerRef.current = window.setTimeout(() => {
          if (pendingLayoutRef.current) {
            setGridLayoutState(pendingLayoutRef.current);
            lastUpdateTimeRef.current = Date.now();
            pendingLayoutRef.current = null;
          }
          throttleTimerRef.current = null;
        }, 100 - timeSinceLastUpdate);
      }
    } else {
      setGridLayoutState(newLayout);
      lastUpdateTimeRef.current = now;
      pendingLayoutRef.current = null;
      
      if (throttleTimerRef.current !== null) {
        clearTimeout(throttleTimerRef.current);
        throttleTimerRef.current = null;
      }
    }
  }, []);

  // Generate layout based on preset
  const generateLayout = useCallback((layoutType: LayoutType) => {
    setLayoutState(layoutType);
    const newGridLayout: LayoutConfig = {};
    const streamCount = streams.length;
    
    // Chat width - only allocate space if chat is visible
    const chatWidth = chatPosition !== 'hidden' ? DEFAULT_CHAT_WIDTH : 0;
    const availableWidth = GRID_COLS - chatWidth;

    // Generate stream layouts based on preset
    switch (layoutType) {
      case '2x2': {
        const cols = Math.min(3, streamCount);
        const rows = Math.ceil(streamCount / cols);
        const rowHeight = Math.floor(TOTAL_ROWS / rows);
        const colWidth = Math.floor(availableWidth / cols);
        
        streams.forEach((_, index) => {
          const row = Math.floor(index / cols);
          const col = index % cols;
          newGridLayout[`s${index}`] = {
            x: col * colWidth,
            y: row * rowHeight,
            w: colWidth,
            h: rowHeight,
            i: `s${index}`,
            minW: 2,
            minH: 4,
          };
        });
        break;
      }
      
      case '1+2': {
        // Feature layout - first stream is large
        newGridLayout['s0'] = { x: 0, y: 0, w: Math.floor(availableWidth * 0.6), h: TOTAL_ROWS, i: 's0', minW: 3, minH: 6 };
        
        const smallStreamHeight = Math.floor(TOTAL_ROWS / Math.max(1, streamCount - 1));
        const smallStreamWidth = availableWidth - newGridLayout['s0'].w;
        
        for (let i = 1; i < streamCount; i++) {
          newGridLayout[`s${i}`] = {
            x: newGridLayout['s0'].w,
            y: (i - 1) * smallStreamHeight,
            w: smallStreamWidth,
            h: smallStreamHeight,
            i: `s${i}`,
            minW: 2,
            minH: 3,
          };
        }
        break;
      }
      
      case '1+3': {
        // Theater layout - first stream on top
        const topHeight = Math.floor(TOTAL_ROWS * 0.6);
        newGridLayout['s0'] = { x: 0, y: 0, w: availableWidth, h: topHeight, i: 's0', minW: 4, minH: 4 };
        
        const bottomCount = Math.min(3, streamCount - 1);
        const bottomWidth = Math.floor(availableWidth / Math.max(1, bottomCount));
        
        for (let i = 1; i < streamCount && i <= 4; i++) {
          newGridLayout[`s${i}`] = {
            x: (i - 1) * bottomWidth,
            y: topHeight,
            w: bottomWidth,
            h: TOTAL_ROWS - topHeight,
            i: `s${i}`,
            minW: 2,
            minH: 4,
          };
        }
        break;
      }
      
      case 'horizontal': {
        const streamHeight = Math.floor(TOTAL_ROWS / streamCount);
        streams.forEach((_, index) => {
          newGridLayout[`s${index}`] = {
            x: 0,
            y: index * streamHeight,
            w: availableWidth,
            h: streamHeight,
            i: `s${index}`,
            minW: 3,
            minH: 2,
          };
        });
        break;
      }
      
      case 'vertical': {
        const streamWidth = Math.floor(availableWidth / streamCount);
        streams.forEach((_, index) => {
          newGridLayout[`s${index}`] = {
            x: index * streamWidth,
            y: 0,
            w: streamWidth,
            h: TOTAL_ROWS,
            i: `s${index}`,
            minW: 2,
            minH: 4,
          };
        });
        break;
      }
      
      case 'bigTop': {
        const topHeight = Math.floor(TOTAL_ROWS * 0.65);
        newGridLayout['s0'] = { x: 0, y: 0, w: availableWidth, h: topHeight, i: 's0', minW: 4, minH: 4 };
        
        const bottomCount = streamCount - 1;
        const bottomWidth = Math.floor(availableWidth / Math.max(1, bottomCount));
        
        for (let i = 1; i < streamCount; i++) {
          newGridLayout[`s${i}`] = {
            x: (i - 1) * bottomWidth,
            y: topHeight,
            w: bottomWidth,
            h: TOTAL_ROWS - topHeight,
            i: `s${i}`,
            minW: 2,
            minH: 3,
          };
        }
        break;
      }
      
      case 'pip': {
        // Main stream fills screen, others as small overlays
        newGridLayout['s0'] = { x: 0, y: 0, w: availableWidth, h: TOTAL_ROWS, i: 's0', minW: 4, minH: 4 };
        
        const pipSize = 4;
        const positions = [
          { x: availableWidth - pipSize, y: 0 },
          { x: 0, y: 0 },
          { x: 0, y: TOTAL_ROWS - pipSize },
          { x: availableWidth - pipSize, y: TOTAL_ROWS - pipSize },
        ];
        
        for (let i = 1; i < streamCount && i <= 4; i++) {
          const pos = positions[i - 1];
          newGridLayout[`s${i}`] = {
            x: pos.x,
            y: pos.y,
            w: pipSize,
            h: pipSize,
            i: `s${i}`,
            minW: 2,
            minH: 2,
          };
        }
        break;
      }
      
      case 'cascade': {
        const streamHeight = Math.floor(TOTAL_ROWS / streamCount) + 2;
        streams.forEach((_, index) => {
          const offset = index * 1;
          const verticalOffset = index * Math.floor((TOTAL_ROWS - streamHeight) / Math.max(1, streamCount - 1));
          
          newGridLayout[`s${index}`] = {
            x: offset,
            y: verticalOffset,
            w: 4,
            h: streamHeight,
            i: `s${index}`,
            minW: 2,
            minH: 4,
          };
        });
        break;
      }
      
      default:
        // Fallback to grid
        generateLayout('2x2');
        return;
    }
    
    // Add chat panel if visible
    if (chatPosition !== 'hidden') {
      newGridLayout['chat'] = {
        x: chatPosition === 'left' ? 0 : GRID_COLS - chatWidth,
        y: 0,
        w: chatWidth,
        h: TOTAL_ROWS,
        i: 'chat',
        minW: 2,
        minH: 4,
      };
    }
    
    setGridLayoutState(newGridLayout);
  }, [streams, chatPosition]);

  // Handle layout changes from react-grid-layout
  const onLayoutChange = useCallback((newLayout: LayoutItem[]) => {
    const updatedLayout: LayoutConfig = {};
    newLayout.forEach((item) => {
      updatedLayout[item.i] = {
        x: item.x,
        y: item.y,
        w: item.w,
        h: item.h,
        i: item.i,
        minW: gridLayout[item.i]?.minW,
        minH: gridLayout[item.i]?.minH,
      };
    });
    throttledSetGridLayout(updatedLayout);
  }, [gridLayout, throttledSetGridLayout]);

  // Reset layout to default
  const resetLayout = useCallback(() => {
    generateLayout('2x2');
    
    // Clear saved layout from localStorage
    if (typeof window !== 'undefined' && streams.length > 0) {
      try {
        const layoutKey = getLayoutStorageKey(streams);
        localStorage.removeItem(layoutKey);
      } catch {
        // Silent error
      }
    }
  }, [streams, generateLayout]);

  // Load saved layout on mount or when streams change
  useEffect(() => {
    if (streams.length === 0) return;
    
    const layoutKey = getLayoutStorageKey(streams);
    
    try {
      const savedLayout = localStorage.getItem(layoutKey);
      if (savedLayout) {
        const parsed = JSON.parse(savedLayout);
        if (parsed && typeof parsed === 'object' && Object.keys(parsed).length > 0) {
          setGridLayoutState(parsed.gridLayout || parsed);
          if (parsed.layoutType) {
            setLayoutState(parsed.layoutType);
          }
          return;
        }
      }
    } catch {
      // Silent error, generate new layout
    }
    
    generateLayout(initialLayout);
  }, [streams, initialLayout, generateLayout]);

  // Save layout to localStorage when it changes
  useEffect(() => {
    if (typeof window === 'undefined' || streams.length === 0 || Object.keys(gridLayout).length === 0) {
      return;
    }
    
    try {
      const layoutKey = getLayoutStorageKey(streams);
      localStorage.setItem(layoutKey, JSON.stringify({
        gridLayout,
        layoutType: layout,
        savedAt: Date.now(),
      }));
    } catch {
      // Silent error
    }
  }, [gridLayout, layout, streams]);

  // Cleanup throttle timer on unmount
  useEffect(() => {
    return () => {
      if (throttleTimerRef.current !== null) {
        clearTimeout(throttleTimerRef.current);
      }
    };
  }, []);

  return {
    layout,
    gridLayout,
    isEditMode,
    chatPosition,
    setLayout: setLayoutState,
    setGridLayout: throttledSetGridLayout,
    setIsEditMode,
    setChatPosition,
    generateLayout,
    resetLayout,
    onLayoutChange,
  };
}
