"use client";

import { useState, useEffect, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { 
  Search, 
  MessageSquare, 
  Edit3, 
  Maximize, 
  RotateCcw,
  Grid3X3,
  LayoutGrid,
  Grid2X2,
  Rows3,
  Columns,
  LayoutPanelTop,
  PictureInPicture,
  Layers,
  Star,
  Keyboard,
  X,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { StreamInfo, LayoutType } from './types';
import { LAYOUT_PRESETS } from './types';
import { KickIcon } from './icons';
import { Twitch } from 'lucide-react';
import { KEYBOARD_SHORTCUTS } from './use-keyboard-shortcuts';

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  streams: StreamInfo[];
  onToggleChat: () => void;
  onToggleEditMode: () => void;
  onToggleFullscreen: () => void;
  onResetLayout: () => void;
  onLayoutChange: (layout: LayoutType) => void;
  onFocusStream: (index: number) => void;
  onSelectChat: (index: number) => void;
  isChatVisible: boolean;
  isEditMode: boolean;
}

interface Command {
  id: string;
  label: string;
  description?: string;
  icon: typeof Search;
  shortcut?: string;
  action: () => void;
  category: 'action' | 'layout' | 'stream' | 'help';
}

// Map layout type to icon
const layoutIcons: Record<LayoutType, typeof Grid3X3> = {
  '2x2': Grid3X3,
  '1+2': LayoutGrid,
  '1+3': Grid2X2,
  'horizontal': Rows3,
  'vertical': Columns,
  'bigTop': LayoutPanelTop,
  'bigBottom': LayoutPanelTop,
  'pip': PictureInPicture,
  'cascade': Layers,
  '3+1': LayoutGrid,
  'pyramid': Grid3X3,
};

/**
 * CommandPalette - A spotlight-style command palette for quick actions
 * 
 * Accessible via Cmd/Ctrl + K
 */
export function CommandPalette({
  isOpen,
  onClose,
  streams,
  onToggleChat,
  onToggleEditMode,
  onToggleFullscreen,
  onResetLayout,
  onLayoutChange,
  onFocusStream,
  onSelectChat,
  isChatVisible,
  isEditMode,
}: CommandPaletteProps) {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);

  // Build command list
  const commands = useMemo<Command[]>(() => {
    const cmds: Command[] = [
      // Actions
      {
        id: 'toggle-chat',
        label: isChatVisible ? 'Hide Chat' : 'Show Chat',
        icon: MessageSquare,
        shortcut: 'C',
        action: () => { onToggleChat(); onClose(); },
        category: 'action',
      },
      {
        id: 'toggle-edit',
        label: isEditMode ? 'Exit Edit Mode' : 'Edit Layout',
        icon: Edit3,
        shortcut: 'E',
        action: () => { onToggleEditMode(); onClose(); },
        category: 'action',
      },
      {
        id: 'toggle-fullscreen',
        label: 'Toggle Fullscreen',
        icon: Maximize,
        shortcut: 'F',
        action: () => { onToggleFullscreen(); onClose(); },
        category: 'action',
      },
      {
        id: 'reset-layout',
        label: 'Reset Layout',
        icon: RotateCcw,
        shortcut: 'R',
        action: () => { onResetLayout(); onClose(); },
        category: 'action',
      },

      // Layout presets
      ...LAYOUT_PRESETS.map(preset => ({
        id: `layout-${preset.id}`,
        label: `Layout: ${preset.name}`,
        description: preset.description,
        icon: layoutIcons[preset.id],
        action: () => { onLayoutChange(preset.id); onClose(); },
        category: 'layout' as const,
      })),

      // Stream actions
      ...streams.map((stream, index) => ({
        id: `focus-${index}`,
        label: `Focus: ${stream.username}`,
        description: stream.platform === 'twitch' ? 'Twitch' : 'Kick',
        icon: Star,
        shortcut: `${index + 1}`,
        action: () => { onFocusStream(index); onClose(); },
        category: 'stream' as const,
      })),

      // Chat selection (Twitch only)
      ...streams
        .filter(s => s.platform === 'twitch')
        .map((stream, index) => ({
          id: `chat-${index}`,
          label: `Chat: ${stream.username}`,
          description: 'Switch chat to this channel',
          icon: MessageSquare,
          action: () => { onSelectChat(index); onClose(); },
          category: 'stream' as const,
        })),

      // Help
      {
        id: 'show-shortcuts',
        label: 'Keyboard Shortcuts',
        description: 'View all shortcuts',
        icon: Keyboard,
        shortcut: '?',
        action: () => {}, // TODO: Show shortcuts modal
        category: 'help',
      },
    ];

    return cmds;
  }, [
    streams, 
    isChatVisible, 
    isEditMode, 
    onToggleChat, 
    onToggleEditMode, 
    onToggleFullscreen, 
    onResetLayout, 
    onLayoutChange, 
    onFocusStream, 
    onSelectChat, 
    onClose
  ]);

  // Filter commands based on query
  const filteredCommands = useMemo(() => {
    if (!query.trim()) return commands;
    
    const lowerQuery = query.toLowerCase();
    return commands.filter(cmd => 
      cmd.label.toLowerCase().includes(lowerQuery) ||
      cmd.description?.toLowerCase().includes(lowerQuery)
    );
  }, [commands, query]);

  // Group commands by category
  const groupedCommands = useMemo(() => {
    const groups: Record<string, Command[]> = {
      action: [],
      layout: [],
      stream: [],
      help: [],
    };
    
    filteredCommands.forEach(cmd => {
      groups[cmd.category].push(cmd);
    });
    
    return groups;
  }, [filteredCommands]);

  // Reset selection when query changes
  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  // Reset when opened
  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setSelectedIndex(0);
    }
  }, [isOpen]);

  // Handle keyboard navigation
  const handleKeyDown = useCallback((event: React.KeyboardEvent) => {
    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        setSelectedIndex(prev => 
          prev < filteredCommands.length - 1 ? prev + 1 : 0
        );
        break;

      case 'ArrowUp':
        event.preventDefault();
        setSelectedIndex(prev => 
          prev > 0 ? prev - 1 : filteredCommands.length - 1
        );
        break;

      case 'Enter':
        event.preventDefault();
        if (filteredCommands[selectedIndex]) {
          filteredCommands[selectedIndex].action();
        }
        break;

      case 'Escape':
        event.preventDefault();
        onClose();
        break;
    }
  }, [filteredCommands, selectedIndex, onClose]);

  if (!isOpen) return null;

  return typeof window !== 'undefined' ? createPortal(
    <div 
      className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh]"
      onClick={onClose}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />

      {/* Palette */}
      <div 
        className="relative w-full max-w-lg bg-[#18181b] rounded-xl shadow-2xl border border-[#26262c] overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Search input */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-[#26262c]">
          <Search className="h-5 w-5 text-[#ADADB8] flex-shrink-0" />
          <input
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Search commands..."
            className="flex-1 bg-transparent text-white placeholder-[#6B6B6B] focus:outline-none text-sm"
            autoFocus
          />
          <button 
            onClick={onClose}
            className="p-1 rounded hover:bg-[#26262c] text-[#ADADB8] transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Command list */}
        <div className="max-h-[50vh] overflow-y-auto py-2">
          {filteredCommands.length === 0 ? (
            <div className="px-4 py-8 text-center text-[#6B6B6B] text-sm">
              No commands found
            </div>
          ) : (
            <>
              {/* Actions */}
              {groupedCommands.action.length > 0 && (
                <CommandGroup label="Actions" commands={groupedCommands.action} selectedIndex={selectedIndex} allCommands={filteredCommands} />
              )}

              {/* Layouts */}
              {groupedCommands.layout.length > 0 && (
                <CommandGroup label="Layouts" commands={groupedCommands.layout} selectedIndex={selectedIndex} allCommands={filteredCommands} />
              )}

              {/* Streams */}
              {groupedCommands.stream.length > 0 && (
                <CommandGroup label="Streams" commands={groupedCommands.stream} selectedIndex={selectedIndex} allCommands={filteredCommands} />
              )}

              {/* Help */}
              {groupedCommands.help.length > 0 && (
                <CommandGroup label="Help" commands={groupedCommands.help} selectedIndex={selectedIndex} allCommands={filteredCommands} />
              )}
            </>
          )}
        </div>

        {/* Footer hint */}
        <div className="px-4 py-2 border-t border-[#26262c] flex items-center gap-4 text-xs text-[#6B6B6B]">
          <span className="flex items-center gap-1">
            <kbd className="px-1.5 py-0.5 rounded bg-[#26262c] text-[#ADADB8]">↑↓</kbd>
            Navigate
          </span>
          <span className="flex items-center gap-1">
            <kbd className="px-1.5 py-0.5 rounded bg-[#26262c] text-[#ADADB8]">↵</kbd>
            Select
          </span>
          <span className="flex items-center gap-1">
            <kbd className="px-1.5 py-0.5 rounded bg-[#26262c] text-[#ADADB8]">Esc</kbd>
            Close
          </span>
        </div>
      </div>
    </div>,
    document.body
  ) : null;
}

// Helper component for command groups
function CommandGroup({ 
  label, 
  commands, 
  selectedIndex, 
  allCommands 
}: { 
  label: string; 
  commands: Command[]; 
  selectedIndex: number;
  allCommands: Command[];
}) {
  return (
    <div className="mb-2">
      <div className="px-4 py-1 text-xs text-[#6B6B6B] uppercase tracking-wider">
        {label}
      </div>
      {commands.map(cmd => {
        const globalIndex = allCommands.findIndex(c => c.id === cmd.id);
        const isSelected = globalIndex === selectedIndex;
        const Icon = cmd.icon;
        
        return (
          <button
            key={cmd.id}
            onClick={cmd.action}
            className={cn(
              "w-full flex items-center gap-3 px-4 py-2 text-left transition-colors",
              isSelected 
                ? "bg-[#004D61] text-white" 
                : "text-[#ADADB8] hover:bg-[#26262c] hover:text-white"
            )}
          >
            <Icon className="h-4 w-4 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium truncate">{cmd.label}</div>
              {cmd.description && (
                <div className="text-xs text-[#6B6B6B] truncate">{cmd.description}</div>
              )}
            </div>
            {cmd.shortcut && (
              <kbd className="px-1.5 py-0.5 rounded bg-[#26262c] text-[#6B6B6B] text-xs flex-shrink-0">
                {cmd.shortcut}
              </kbd>
            )}
          </button>
        );
      })}
    </div>
  );
}
