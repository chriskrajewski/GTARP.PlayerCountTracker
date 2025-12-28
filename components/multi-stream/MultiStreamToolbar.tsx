"use client";

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'motion/react';
import { 
  ArrowLeft, 
  Grid3X3, 
  LayoutGrid, 
  Grid2X2, 
  Rows3, 
  Columns, 
  LayoutPanelTop, 
  PictureInPicture, 
  Layers,
  MessageSquare,
  Copy,
  Check,
  Maximize,
  Minimize,
  Edit3,
  X,
  ChevronDown,
  Heart,
  ClipboardList,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { LayoutType, ChatPosition } from './types';
import { LAYOUT_PRESETS } from './types';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface MultiStreamToolbarProps {
  layout: LayoutType;
  isEditMode: boolean;
  isChatVisible: boolean;
  isFullscreen: boolean;
  onLayoutChange: (layout: LayoutType) => void;
  onEditModeToggle: () => void;
  onChatToggle: () => void;
  onFullscreenToggle: () => void;
  onReset: () => void;
  className?: string;
}

// Map layout type to icon component
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
 * MultiStreamToolbar - A compact, sleek studio toolbar
 * 
 * Features:
 * - Layout preset selector with visual thumbnails
 * - Chat toggle
 * - Edit mode toggle
 * - Share link
 * - Fullscreen toggle
 * - Auto-hide behavior (on scroll/inactivity) - TODO
 */
export function MultiStreamToolbar({
  layout,
  isEditMode,
  isChatVisible,
  isFullscreen,
  onLayoutChange,
  onEditModeToggle,
  onChatToggle,
  onFullscreenToggle,
  onReset,
  className,
}: MultiStreamToolbarProps) {
  const [isCopied, setIsCopied] = useState(false);
  const [isLayoutDropdownOpen, setIsLayoutDropdownOpen] = useState(false);
  const layoutButtonRef = useRef<HTMLButtonElement>(null);
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0 });

  // Copy share link
  const copyShareLink = () => {
    const url = window.location.href;
    navigator.clipboard.writeText(url);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  // Update dropdown position when button is clicked
  useEffect(() => {
    if (isLayoutDropdownOpen && layoutButtonRef.current) {
      const rect = layoutButtonRef.current.getBoundingClientRect();
      setDropdownPosition({
        top: rect.bottom + 8,
        left: rect.left,
      });
    }
  }, [isLayoutDropdownOpen]);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (isLayoutDropdownOpen) {
        const dropdown = document.getElementById('layout-dropdown');
        if (dropdown && !dropdown.contains(e.target as Node) && 
            layoutButtonRef.current && !layoutButtonRef.current.contains(e.target as Node)) {
          setIsLayoutDropdownOpen(false);
        }
      }
    };
    
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isLayoutDropdownOpen]);

  // Close dropdown on escape
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsLayoutDropdownOpen(false);
      }
    };
    
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, []);

  const CurrentLayoutIcon = layoutIcons[layout] || Grid3X3;
  const currentPreset = LAYOUT_PRESETS.find(p => p.id === layout);

  return (
    <TooltipProvider>
      <div
        className={cn(
          "flex items-center justify-between px-4 py-2 bg-[#0e0e10]/95 backdrop-blur-sm border-b border-[#26262c] transition-all duration-300",
          isEditMode && "bg-[#004D61]/10 border-[#00D9FF]/30",
          className
        )}
      >
        {/* Left: Back + Title */}
        <div className="flex items-center gap-3">
          <Link 
            href="/" 
            className="p-1.5 rounded-md text-[#ADADB8] hover:text-white hover:bg-[#26262c] transition-colors"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          
          <div className="flex items-center gap-2">
            <img 
              src="/pepeRP.webp" 
              alt="Logo" 
              className="h-7 w-7" 
            />
            <span className="font-semibold text-white text-sm hidden sm:inline">Multi-Stream</span>
          </div>
          
          {isEditMode && (
            <motion.div 
              className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-[#00D9FF]/20 text-[#00D9FF] text-xs font-medium border border-[#00D9FF]/50"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              transition={{ type: "spring", stiffness: 400, damping: 10 }}
            >
              <Edit3 className="h-3 w-3" />
              <span>Editing Layout</span>
            </motion.div>
          )}
        </div>

        {/* Center: Layout controls */}
        <div className="flex items-center gap-2">
          {/* Quick layout buttons (desktop) */}
          <div className="hidden md:flex items-center bg-[#18181b] rounded-md overflow-hidden">
            {['2x2', '1+2', '1+3'].map((presetId) => {
              const Icon = layoutIcons[presetId as LayoutType];
              const preset = LAYOUT_PRESETS.find(p => p.id === presetId);
              return (
                <Tooltip key={presetId}>
                  <TooltipTrigger asChild>
                    <motion.button
                      onClick={() => onLayoutChange(presetId as LayoutType)}
                      className={cn(
                        "p-2 transition-colors",
                        layout === presetId
                          ? "bg-[#00D9FF] text-black"
                          : "text-[#ADADB8] hover:text-white hover:bg-[#26262c]"
                      )}
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                    >
                      <Icon className="h-4 w-4" />
                    </motion.button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" className="bg-[#18181b] text-white border-[#26262c]">
                    {preset?.name}
                  </TooltipContent>
                </Tooltip>
              );
            })}
            
            {/* More layouts dropdown */}
            <button
              ref={layoutButtonRef}
              onClick={() => setIsLayoutDropdownOpen(!isLayoutDropdownOpen)}
              className={cn(
                "p-2 transition-colors border-l border-[#26262c]",
                isLayoutDropdownOpen
                  ? "bg-[#26262c] text-white"
                  : "text-[#ADADB8] hover:text-white hover:bg-[#26262c]"
              )}
            >
              <ChevronDown className="h-4 w-4" />
            </button>
          </div>

          {/* Mobile: Single layout button */}
          <button
            ref={layoutButtonRef}
            onClick={() => setIsLayoutDropdownOpen(!isLayoutDropdownOpen)}
            className="md:hidden flex items-center gap-1.5 px-3 py-1.5 bg-[#18181b] rounded-md text-[#ADADB8] hover:text-white transition-colors"
          >
            <CurrentLayoutIcon className="h-4 w-4" />
            <ChevronDown className="h-3 w-3" />
          </button>
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-1.5">
            {/* Chat toggle */}
          <Tooltip>
            <TooltipTrigger asChild>
              <motion.button
                onClick={onChatToggle}
                className={cn(
                  "p-2 rounded-md transition-colors",
                  isChatVisible
                    ? "bg-[#00D9FF] text-black"
                    : "text-[#ADADB8] hover:text-white hover:bg-[#26262c]"
                )}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                <MessageSquare className="h-4 w-4" />
              </motion.button>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="bg-[#18181b] text-white border-[#26262c]">
              {isChatVisible ? 'Hide chat' : 'Show chat'}
            </TooltipContent>
          </Tooltip>

          {/* Edit mode toggle */}
          <Tooltip>
            <TooltipTrigger asChild>
              <motion.button
                onClick={onEditModeToggle}
                className={cn(
                  "p-2 rounded-md transition-colors",
                  isEditMode
                    ? "bg-[#00D9FF] text-black"
                    : "text-[#ADADB8] hover:text-white hover:bg-[#26262c]"
                )}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                {isEditMode ? <X className="h-4 w-4" /> : <Edit3 className="h-4 w-4" />}
              </motion.button>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="bg-[#18181b] text-white border-[#26262c]">
              {isEditMode ? 'Done editing' : 'Edit layout'}
            </TooltipContent>
          </Tooltip>

          {/* Share */}
          <Tooltip>
            <TooltipTrigger asChild>
              <motion.button
                onClick={copyShareLink}
                className="p-2 rounded-md text-[#ADADB8] hover:text-white hover:bg-[#26262c] transition-colors"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                {isCopied ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
              </motion.button>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="bg-[#18181b] text-white border-[#26262c]">
              {isCopied ? 'Copied!' : 'Copy share link'}
            </TooltipContent>
          </Tooltip>

          {/* Fullscreen */}
          <Tooltip>
            <TooltipTrigger asChild>
              <motion.button
                onClick={onFullscreenToggle}
                className="p-2 rounded-md text-[#ADADB8] hover:text-white hover:bg-[#26262c] transition-colors"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                {isFullscreen ? <Minimize className="h-4 w-4" /> : <Maximize className="h-4 w-4" />}
              </motion.button>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="bg-[#18181b] text-white border-[#26262c]">
              {isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}
            </TooltipContent>
          </Tooltip>

          {/* Divider */}
          <div className="w-px h-6 bg-[#26262c] mx-1 hidden sm:block" />

          {/* Changelog (desktop) */}
          <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
            <Link 
              href="/changelog"
              className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-[#18181b] text-[#00D9FF] hover:bg-[#00D9FF]/10 hover:text-[#00D9FF] border border-[#26262c] hover:border-[#00D9FF]/50 transition-all text-xs font-medium"
            >
              <ClipboardList className="h-3.5 w-3.5" />
              <span>Changelog</span>
            </Link>
          </motion.div>

          {/* Donate */}
          <Tooltip>
            <TooltipTrigger asChild>
              <motion.a
                href="https://streamelements.com/alantiix/tip"
                target="_blank"
                rel="noopener noreferrer"
                className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-[#18181b] text-[#ff4545] hover:bg-[#ff4545]/10 hover:text-[#ff4545] border border-[#26262c] hover:border-[#ff4545]/50 transition-all text-xs font-medium"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                <Heart className="h-3.5 w-3.5" />
                <span>Donate</span>
              </motion.a>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="bg-[#18181b] text-white border-[#26262c]">
              Buy me a cup of coffee :)
            </TooltipContent>
          </Tooltip>
        </div>
      </div>

      {/* Layout dropdown portal */}
      <AnimatePresence>
        {isLayoutDropdownOpen && typeof window !== 'undefined' && createPortal(
          <motion.div
            id="layout-dropdown"
            className="fixed bg-[#18181b] rounded-lg shadow-xl border border-[#26262c] z-50 overflow-hidden"
            style={{
              top: dropdownPosition.top,
              left: dropdownPosition.left,
              minWidth: 200,
            }}
            initial={{ opacity: 0, scale: 0.95, y: -10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -10 }}
            transition={{ type: "spring", stiffness: 300, damping: 20 }}
          >
            <div className="p-2 grid grid-cols-2 gap-1">
              {LAYOUT_PRESETS.map((preset) => {
                const Icon = layoutIcons[preset.id];
                return (
                  <motion.button
                    key={preset.id}
                    onClick={() => {
                      onLayoutChange(preset.id);
                      setIsLayoutDropdownOpen(false);
                    }}
                    className={cn(
                      "flex flex-col items-center gap-1.5 p-3 rounded-md transition-colors",
                      layout === preset.id
                        ? "bg-[#00D9FF] text-black"
                        : "text-[#ADADB8] hover:text-white hover:bg-[#26262c]"
                    )}
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                  >
                    <Icon className="h-5 w-5" />
                    <span className="text-xs font-medium">{preset.name}</span>
                  </motion.button>
                );
              })}
            </div>
            
            {/* Reset option */}
            <div className="border-t border-[#26262c] p-2">
              <motion.button
                onClick={() => {
                  onReset();
                  setIsLayoutDropdownOpen(false);
                }}
                className="w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-md text-[#ADADB8] hover:text-white hover:bg-[#26262c] transition-colors text-xs"
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                Reset to default
              </motion.button>
            </div>
          </motion.div>,
          document.body
        )}
      </AnimatePresence>
    </TooltipProvider>
  );
}
