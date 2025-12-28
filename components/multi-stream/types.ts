// Multi-stream shared types

export type Platform = 'twitch' | 'kick';

export interface StreamInfo {
  platform: Platform;
  username: string;
  position: number;
}

export type ChatPosition = 'right' | 'left' | 'bottom' | 'hidden';

export type LayoutType = 
  | '2x2' 
  | '1+2' 
  | '1+3' 
  | 'cascade' 
  | 'horizontal' 
  | 'vertical' 
  | 'bigTop' 
  | 'bigBottom' 
  | 'pip' 
  | '3+1' 
  | 'pyramid';

export interface LayoutItem {
  x: number;
  y: number;
  w: number;
  h: number;
  i: string;
  minW?: number;
  minH?: number;
}

export type LayoutConfig = Record<string, LayoutItem>;

export interface MultiStreamState {
  streams: StreamInfo[];
  layout: LayoutType;
  gridLayout: LayoutConfig;
  activeChatIndex: number;
  chatPosition: ChatPosition;
  isEditMode: boolean;
  isChatVisible: boolean;
  focusedStreamIndex: number | null;
}

// Layout preset metadata for UI
export interface LayoutPreset {
  id: LayoutType;
  name: string;
  icon: string; // lucide icon name
  description: string;
}

export const LAYOUT_PRESETS: LayoutPreset[] = [
  { id: '2x2', name: 'Grid', icon: 'Grid3X3', description: 'Equal grid layout' },
  { id: '1+2', name: 'Feature', icon: 'LayoutGrid', description: 'One large, others small' },
  { id: '1+3', name: 'Theater', icon: 'Grid2X2', description: 'Main top, others bottom' },
  { id: 'horizontal', name: 'Rows', icon: 'Rows3', description: 'Stacked rows' },
  { id: 'vertical', name: 'Columns', icon: 'Columns', description: 'Side by side columns' },
  { id: 'bigTop', name: 'Focus Top', icon: 'LayoutPanelTop', description: 'Large top, small bottom' },
  { id: 'pip', name: 'Picture-in-Picture', icon: 'PictureInPicture', description: 'Main with overlays' },
  { id: 'cascade', name: 'Cascade', icon: 'Layers', description: 'Staggered windows' },
];

// Constants
export const MAX_STREAMS = 8;
export const GRID_COLS = 12;
export const TOTAL_ROWS = 24;
export const DEFAULT_CHAT_WIDTH = 3;
