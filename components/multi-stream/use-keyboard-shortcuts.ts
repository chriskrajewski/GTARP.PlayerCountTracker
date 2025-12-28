"use client";

import { useEffect, useCallback } from 'react';

interface UseKeyboardShortcutsOptions {
  onToggleChat: () => void;
  onToggleEditMode: () => void;
  onToggleFullscreen: () => void;
  onResetLayout: () => void;
  onFocusStream: (index: number) => void;
  onOpenCommandPalette: () => void;
  streamCount: number;
  isEnabled?: boolean;
}

/**
 * Hook for managing keyboard shortcuts in multi-stream viewer
 * 
 * Shortcuts:
 * - Cmd/Ctrl + K: Open command palette
 * - C: Toggle chat
 * - E: Toggle edit mode
 * - F: Toggle fullscreen
 * - R: Reset layout
 * - 1-8: Focus stream by number
 * - Escape: Close edit mode / command palette
 */
export function useKeyboardShortcuts({
  onToggleChat,
  onToggleEditMode,
  onToggleFullscreen,
  onResetLayout,
  onFocusStream,
  onOpenCommandPalette,
  streamCount,
  isEnabled = true,
}: UseKeyboardShortcutsOptions) {
  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    if (!isEnabled) return;

    // Ignore if user is typing in an input/textarea
    const target = event.target as HTMLElement;
    if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
      return;
    }

    // Cmd/Ctrl + K: Command palette
    if ((event.metaKey || event.ctrlKey) && event.key === 'k') {
      event.preventDefault();
      onOpenCommandPalette();
      return;
    }

    // Single key shortcuts (no modifiers except shift)
    if (event.metaKey || event.ctrlKey || event.altKey) {
      return;
    }

    switch (event.key.toLowerCase()) {
      case 'c':
        event.preventDefault();
        onToggleChat();
        break;

      case 'e':
        event.preventDefault();
        onToggleEditMode();
        break;

      case 'f':
        event.preventDefault();
        onToggleFullscreen();
        break;

      case 'r':
        event.preventDefault();
        onResetLayout();
        break;

      case '1':
      case '2':
      case '3':
      case '4':
      case '5':
      case '6':
      case '7':
      case '8':
        const streamIndex = parseInt(event.key) - 1;
        if (streamIndex < streamCount) {
          event.preventDefault();
          onFocusStream(streamIndex);
        }
        break;

      default:
        break;
    }
  }, [
    isEnabled,
    onToggleChat,
    onToggleEditMode,
    onToggleFullscreen,
    onResetLayout,
    onFocusStream,
    onOpenCommandPalette,
    streamCount,
  ]);

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);
}

/**
 * Get keyboard shortcut descriptions for display in UI
 */
export const KEYBOARD_SHORTCUTS = [
  { key: '⌘K', description: 'Open command palette' },
  { key: 'C', description: 'Toggle chat' },
  { key: 'E', description: 'Toggle edit mode' },
  { key: 'F', description: 'Toggle fullscreen' },
  { key: 'R', description: 'Reset layout' },
  { key: '1-8', description: 'Focus stream by number' },
  { key: 'Esc', description: 'Close modal / exit edit' },
];
