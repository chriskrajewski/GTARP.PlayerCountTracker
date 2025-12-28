"use client";

import { useState } from 'react';
import Link from 'next/link';
import { motion } from 'motion/react';
import { ArrowLeft, Twitch, Zap, Play, ExternalLink } from 'lucide-react';
import { KickIcon } from './icons';
import { MAX_STREAMS } from './types';
import { cn } from '@/lib/utils';

interface EmptyStateProps {
  onLaunch: (streamsParam: string) => void;
}

// Example stream combinations for quick start
const EXAMPLE_COMBOS = [
  { label: 'Popular RP', streams: ['twitch:buddha', 'twitch:anthonyz', 'twitch:kyle'] },
  { label: 'Multi-platform', streams: ['twitch:summit1g', 'kick:trainwreckstv'] },
];

/**
 * EmptyState - A sleek studio quick-start for the multi-stream viewer
 * 
 * Features:
 * - Paste usernames/URLs input
 * - Example quick-start chips
 * - Clear guidance on limits and supported platforms
 */
export function EmptyState({ onLaunch }: EmptyStateProps) {
  const [inputValue, setInputValue] = useState('');
  const [error, setError] = useState<string | null>(null);

  // Validate and parse input
  const parseInput = (input: string): { valid: string[]; error: string | null } => {
    if (!input.trim()) {
      return { valid: [], error: 'Enter at least one stream name' };
    }

    // Split by various delimiters
    const tokens = input
      .split(/[,\s;\n]+/)
      .map(t => t.trim())
      .filter(t => t.length > 0);

    if (tokens.length === 0) {
      return { valid: [], error: 'Enter at least one valid stream name' };
    }

    if (tokens.length > MAX_STREAMS) {
      return { valid: [], error: `Maximum ${MAX_STREAMS} streams allowed` };
    }

    const valid: string[] = [];
    const invalid: string[] = [];

    tokens.forEach(token => {
      const lower = token.toLowerCase();

      // Check for explicit platform prefix
      if (lower.includes(':')) {
        const [platform, identifier] = lower.split(':', 2);
        if ((platform === 'twitch' || platform === 'kick') && identifier) {
          valid.push(`${platform}:${identifier}`);
          return;
        }
      }

      // Check for URLs
      if (token.startsWith('http://') || token.startsWith('https://')) {
        try {
          const url = new URL(token);
          const hostname = url.hostname.toLowerCase();

          if (hostname.includes('twitch.tv')) {
            const username = url.pathname.split('/').filter(Boolean)[0]?.toLowerCase();
            if (username && /^[a-zA-Z0-9_]{4,25}$/.test(username)) {
              valid.push(`twitch:${username}`);
              return;
            }
          } else if (hostname.includes('kick.com')) {
            const slug = url.pathname.split('/').filter(Boolean)[0]?.toLowerCase();
            if (slug && /^[a-z0-9-]+$/.test(slug)) {
              valid.push(`kick:${slug}`);
              return;
            }
          }
        } catch {
          // Invalid URL
        }
        invalid.push(token);
        return;
      }

      // Default: treat as Twitch username
      if (/^[a-zA-Z0-9_]{4,25}$/.test(lower)) {
        valid.push(`twitch:${lower}`);
      } else if (/^[a-z0-9-]+$/.test(lower)) {
        // Could be Kick slug - prompt user to be explicit
        valid.push(`twitch:${lower}`); // Default to Twitch
      } else {
        invalid.push(token);
      }
    });

    if (invalid.length > 0) {
      return { 
        valid, 
        error: `Invalid: ${invalid.join(', ')}. Use format: username, twitch:username, or kick:slug` 
      };
    }

    return { valid, error: null };
  };

  const handleLaunch = () => {
    const { valid, error } = parseInput(inputValue);
    
    if (error && valid.length === 0) {
      setError(error);
      return;
    }

    setError(null);
    onLaunch(valid.join(','));
  };

  const handleExampleClick = (streams: string[]) => {
    onLaunch(streams.join(','));
  };

  return (
    <div className="min-h-screen bg-black flex flex-col">
      {/* Minimal header */}
      <div className="px-4 py-3 border-b border-[#26262c]">
        <div className="flex items-center gap-3 max-w-2xl mx-auto">
          <Link 
            href="/" 
            className="p-1.5 rounded-md text-[#ADADB8] hover:text-white hover:bg-[#26262c] transition-colors"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div className="flex items-center gap-2">
            <img src="/pepeRP.webp" alt="Logo" className="h-7 w-7" />
            <span className="font-semibold text-white">Multi-Stream</span>
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 flex items-center justify-center p-4">
        <div className="w-full max-w-lg space-y-8">
          {/* Hero */}
          <motion.div 
            className="text-center space-y-3"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <motion.div 
              className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-[#00D9FF] via-[#00f0ff] to-[#0099cc] mb-2 shadow-lg shadow-[#00D9FF]/40"
              animate={{ y: [0, -8, 0] }}
              transition={{ duration: 2, repeat: Infinity }}
            >
              <Play className="h-8 w-8 text-black" />
            </motion.div>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-white via-[#00D9FF] to-white bg-clip-text text-transparent">Watch multiple streams</h1>
            <p className="text-[#ADADB8] text-sm max-w-sm mx-auto">
              Enter Twitch usernames or Kick slugs to start watching. Supports up to {MAX_STREAMS} streams.
            </p>
          </motion.div>

          {/* Input area */}
          <div className="space-y-3">
            <div className="relative">
              <textarea
                value={inputValue}
                onChange={(e) => {
                  setInputValue(e.target.value);
                  if (error) setError(null);
                }}
                placeholder="Enter stream names, URLs, or paste a list...&#10;&#10;Examples:&#10;shroud, summit1g&#10;twitch:xqc, kick:trainwreckstv&#10;https://twitch.tv/lirik"
                className={cn(
                  "w-full px-4 py-3 bg-[#18181b] border rounded-lg text-white placeholder-[#6B6B6B] focus:outline-none focus:ring-2 focus:ring-[#004D61] focus:border-transparent resize-none transition-all",
                  error ? "border-red-500" : "border-[#26262c]"
                )}
                rows={5}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                    handleLaunch();
                  }
                }}
              />
            </div>

            {error && (
              <p className="text-red-400 text-sm">{error}</p>
            )}

            <motion.button
              onClick={handleLaunch}
              disabled={!inputValue.trim()}
              className={cn(
                "w-full flex items-center justify-center gap-2 px-4 py-3 rounded-lg font-medium transition-all",
                inputValue.trim()
                  ? "bg-gradient-to-r from-[#00D9FF] to-[#00f0ff] hover:shadow-lg hover:shadow-[#00D9FF]/40 text-black"
                  : "bg-[#26262c] text-[#6B6B6B] cursor-not-allowed"
              )}
              whileHover={inputValue.trim() ? { scale: 1.02 } : {}}
              whileTap={inputValue.trim() ? { scale: 0.98 } : {}}
            >
              <Zap className="h-4 w-4" />
              <span>Launch Multi-Stream</span>
            </motion.button>

            <p className="text-center text-xs text-[#6B6B6B]">
              Press <kbd className="px-1.5 py-0.5 rounded bg-[#26262c] text-[#ADADB8]">⌘</kbd>+<kbd className="px-1.5 py-0.5 rounded bg-[#26262c] text-[#ADADB8]">Enter</kbd> to launch
            </p>
          </div>

          {/* Quick examples */}
          <div className="space-y-3">
            <p className="text-center text-xs text-[#6B6B6B] uppercase tracking-wider">Quick examples</p>
            <motion.div 
              className="flex flex-wrap justify-center gap-2"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.3, duration: 0.5 }}
            >
              {EXAMPLE_COMBOS.map((combo, idx) => (
                <motion.button
                  key={combo.label}
                  onClick={() => handleExampleClick(combo.streams)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#18181b] border border-[#26262c] text-sm text-[#ADADB8] hover:text-[#00D9FF] hover:border-[#00D9FF] transition-colors"
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.4 + idx * 0.1, type: "spring", stiffness: 400, damping: 10 }}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                >
                  <span>{combo.label}</span>
                  <ExternalLink className="h-3 w-3" />
                </motion.button>
              ))}
            </motion.div>
          </div>

          {/* Platform info */}
          <div className="flex items-center justify-center gap-6 pt-4 border-t border-[#26262c]">
            <div className="flex items-center gap-2 text-sm text-[#ADADB8]">
              <Twitch className="h-4 w-4 text-[#9146FF]" />
              <span>Twitch</span>
            </div>
            <div className="flex items-center gap-2 text-sm text-[#ADADB8]">
              <KickIcon className="h-4 w-4 text-[#53FC18]" />
              <span>Kick</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
