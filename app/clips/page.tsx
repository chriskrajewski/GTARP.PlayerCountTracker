'use client';

import { useEffect, useState, useCallback, useMemo, memo, Suspense, useTransition, useDeferredValue } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { CommonLayout } from '@/components/common-layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { DateRangePicker } from '@/components/ui/date-range-picker';
import { DateRange } from 'react-day-picker';
import { motion, AnimatePresence, AnimatedSkeleton } from '@/components/ui/motion';
import { fadeInUp, springs, staggerContainer } from '@/lib/motion';
import { 
  AlertCircle, 
  Play, 
  X, 
  Search,
  Film,
  Heart,
  Eye,
  Clock,
  Calendar,
  User,
  SlidersHorizontal,
  Twitch,
  ExternalLink,
  Filter,
  ArrowUpDown,
  Server,
  Sparkles,
  Tv2,
  Loader2,
  ChevronDown,
} from 'lucide-react';
import { Drawer, DrawerContent, DrawerFooter, DrawerHeader, DrawerTitle, DrawerClose } from '@/components/ui/drawer';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

// ═══════════════════════════════════════════════════════════════════════════
// CUSTOM KICK ICON
// ═══════════════════════════════════════════════════════════════════════════

const KickIcon = ({ className }: { className?: string }) => (
  <svg
    viewBox="0 0 24 24"
    fill="currentColor"
    className={className}
  >
    <path d="M1.333 0v24h21.334V0H1.333zm17.12 18.347h-4.32l-3.093-4.907-1.653 1.76v3.147H5.654V5.653h3.733v5.28l4.48-5.28h4.427l-4.907 5.44 4.986 7.254h.08z"/>
  </svg>
);
import { ClipsTimelineWaveform } from '@/components/clips-timeline-waveform';
import { KickClipPlayer } from '@/components/kick-clip-player';
import { useFeatureFlag, FEATURE_FLAGS } from '@/lib/feature-flags';
import { usePWAStandalone, useIsMobileDevice } from '@/hooks/use-pwa-standalone';
import { createBrowserClient } from '@/lib/supabase-browser';
import { getCurrentUser } from '@/lib/user-auth-supabase';
import { useToast } from '@/hooks/use-toast';

// ═══════════════════════════════════════════════════════════════════════════
// INTERFACES
// ═══════════════════════════════════════════════════════════════════════════

type ClipPlatform = 'twitch' | 'kick';

interface ClipData {
  clip_id: string;
  streamer_username: string;
  title: string;
  thumbnail_url: string;
  embed_url: string;
  view_count: number;
  duration: number;
  created_at: string;
  profile_image_url?: string;
  server_id: string;
  server_name?: string;
  platform: ClipPlatform;
  channel_slug?: string; // For Kick clips
}

interface ServerInfo {
  server_id: string;
  server_name: string;
}

interface AllClipsApiResponse {
  success: boolean;
  data: ClipData[];
  servers: ServerInfo[];
  error?: string;
}

interface FavoritesListResponse {
  success: boolean;
  data: Array<{
    clip_id: string;
    platform: ClipPlatform;
  }>;
  error?: string;
}

type QuickRangeKey = 'all' | '7d' | '30d';

const DAY_IN_MS = 24 * 60 * 60 * 1000;

const normalizeDate = (date: Date) => {
  const normalized = new Date(date);
  normalized.setHours(0, 0, 0, 0);
  return normalized;
};

const buildRangeFromDays = (days: number): DateRange => {
  const end = normalizeDate(new Date());
  const start = new Date(end);
  start.setDate(start.getDate() - (days - 1));
  return { from: start, to: end };
};

const QUICK_RANGE_PRESETS: { key: QuickRangeKey; label: string }[] = [
  { key: 'all', label: 'All time' },
  { key: '7d', label: 'Last 7d' },
  { key: '30d', label: 'Last 30d' },
];

const LOCAL_DATE_REGEX = /^(\d{4})-(\d{2})-(\d{2})$/;

const formatDateForQueryParam = (date?: Date): string => {
  if (!date) return '';
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const parseDateParam = (value: string | null): Date | undefined => {
  if (!value) return undefined;
  if (value.includes('T')) {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? undefined : parsed;
  }
  const match = value.match(LOCAL_DATE_REGEX);
  if (!match) return undefined;
  const [, year, month, day] = match;
  return new Date(Number(year), Number(month) - 1, Number(day));
};

const toUtcBoundaryIso = (date: Date, boundary: 'start' | 'end'): string => {
  // We need to convert local timezone day boundary to UTC ISO string
  // Get the date components in local timezone
  const year = date.getFullYear();
  const month = date.getMonth();
  const day = date.getDate();
  
  if (boundary === 'start') {
    // Start of day in local timezone: 00:00:00
    const startOfDay = new Date(year, month, day, 0, 0, 0, 0);
    return startOfDay.toISOString();
  } else {
    // End of day in local timezone: 23:59:59.999
    const endOfDay = new Date(year, month, day, 23, 59, 59, 999);
    return endOfDay.toISOString();
  }
};

const getUtcDateRangeParams = (range: DateRange | undefined) => {
  return {
    startDateUtc: range?.from ? toUtcBoundaryIso(range.from, 'start') : undefined,
    endDateUtc: range?.to ? toUtcBoundaryIso(range.to, 'end') : undefined,
  };
};

// ═══════════════════════════════════════════════════════════════════════════
// ANIMATED BACKGROUND COMPONENTS
// ═══════════════════════════════════════════════════════════════════════════

const CardGradientBackground = memo(function CardGradientBackground() {
  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden rounded-xl">
      <motion.div
        className="absolute -top-1/2 -right-1/2 w-full h-full rounded-full blur-3xl opacity-30"
        style={{ 
          background: 'radial-gradient(circle, rgba(168, 85, 247, 0.15) 0%, transparent 70%)' 
        }}
        animate={{ rotate: 360 }}
        transition={{ duration: 30, repeat: Infinity, ease: "linear" }}
      />
      <div 
        className="absolute inset-0 opacity-[0.02]"
        style={{
          backgroundImage: `
            linear-gradient(rgba(168, 85, 247, 0.5) 1px, transparent 1px),
            linear-gradient(90deg, rgba(168, 85, 247, 0.5) 1px, transparent 1px)
          `,
          backgroundSize: '30px 30px',
        }}
      />
    </div>
  )
});

// ═══════════════════════════════════════════════════════════════════════════
// CLIP CARD SKELETON
// ═══════════════════════════════════════════════════════════════════════════

function ClipCardSkeleton() {
  return (
    <Card variant="elevated" animated={false} className="overflow-hidden">
      <CardGradientBackground />
      <CardContent className="p-0 relative z-10">
        <AnimatedSkeleton className="w-full aspect-video rounded-none" />
        <div className="p-4 space-y-3">
          <AnimatedSkeleton className="h-4 w-full" />
          <AnimatedSkeleton className="h-3 w-2/3" />
          <div className="flex gap-3">
            <AnimatedSkeleton className="h-3 w-1/4" />
            <AnimatedSkeleton className="h-3 w-1/4" />
            <AnimatedSkeleton className="h-3 w-1/4" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// CLIP CARD COMPONENT
// ═══════════════════════════════════════════════════════════════════════════

const ClipCard = memo(function ClipCard({
  clip,
  onSelect,
  onToggleFavorite,
  isFavorited,
  isSavingFavorite,
  index = 0,
}: {
  clip: ClipData;
  onSelect: (clip: ClipData) => void;
  onToggleFavorite: (clip: ClipData) => void;
  isFavorited: boolean;
  isSavingFavorite: boolean;
  index?: number;
}) {
  const [imageError, setImageError] = useState(false);

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays}d ago`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`;
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const formatDuration = (seconds: number) => {
    if (seconds < 60) return `${seconds}s`;
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return secs > 0 ? `${mins}m ${secs}s` : `${mins}m`;
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{
        delay: index * 0.03,
        ...springs.smooth
      }}
    >
      <Card
        variant="elevated"
        className="overflow-hidden cursor-pointer"
        onClick={() => onSelect(clip)}
      >
        <CardGradientBackground />
        <CardContent className="p-0 relative z-10">
          {/* Thumbnail */}
          <div className="relative aspect-video overflow-hidden bg-gray-900">
            <div className="absolute inset-0 bg-gradient-to-t from-gray-900 via-gray-900/40 to-transparent opacity-60 group-hover:opacity-30 transition-opacity z-10" />
            {imageError ? (
              <div className="w-full h-full bg-gradient-to-br from-purple-900/30 to-gray-900 flex items-center justify-center">
                <div className="text-center">
                  <Film className="h-8 w-8 text-purple-400/50 mx-auto mb-2" />
                  <div className="text-xs text-gray-500">{clip.streamer_username}</div>
                </div>
              </div>
            ) : (
              <motion.img
                src={clip.thumbnail_url}
                alt={clip.title}
                className="w-full h-full object-cover"
                onError={() => setImageError(true)}
                loading="lazy"
                decoding="async"
                whileHover={{ scale: 1.05 }}
                transition={{ duration: 0.3 }}
              />
            )}
            
            {/* Play overlay */}
            <motion.div 
              className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center z-20"
              whileHover={{ opacity: 1 }}
            >
              <motion.div
                className="w-14 h-14 rounded-full bg-purple-500/90 flex items-center justify-center backdrop-blur-sm"
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.95 }}
              >
                <Play className="h-6 w-6 text-white fill-white ml-1" />
              </motion.div>
            </motion.div>
            
            {/* Duration badge */}
            <div 
              className="absolute bottom-2 right-2 px-2 py-1 rounded text-xs font-medium z-20"
              style={{
                background: 'rgba(0, 0, 0, 0.8)',
                backdropFilter: 'blur(4px)',
              }}
            >
              <span className="text-white">{formatDuration(clip.duration)}</span>
            </div>
            
            {/* Platform badge */}
            <div 
              className="absolute top-2 left-2 flex items-center gap-1 px-2 py-1 rounded z-20"
              style={{
                background: clip.platform === 'kick' 
                  ? 'rgba(83, 252, 24, 0.9)' 
                  : 'rgba(145, 70, 255, 0.9)',
                backdropFilter: 'blur(4px)',
              }}
            >
              {clip.platform === 'kick' ? (
                <KickIcon className="h-3 w-3 text-black" />
              ) : (
                <Twitch className="h-3 w-3 text-white" />
              )}
              <span className={`text-xs font-medium ${clip.platform === 'kick' ? 'text-black' : 'text-white'}`}>
                Clip
              </span>
            </div>

            {/* Server badge + favorite button */}
            <div className="absolute top-2 right-2 flex items-center gap-2 z-20">
              <div
                className="flex items-center gap-1 px-2 py-1 rounded"
                style={{
                  background: 'rgba(0, 217, 255, 0.9)',
                  backdropFilter: 'blur(4px)',
                }}
              >
                <Server className="h-3 w-3 text-black" />
                <span className="text-xs font-medium text-black truncate max-w-[80px]">
                  {clip.server_name || clip.server_id}
                </span>
              </div>
              <button
                onClick={(event) => {
                  event.stopPropagation();
                  onToggleFavorite(clip);
                }}
                disabled={isSavingFavorite}
                className="p-1.5 rounded-full border border-white/10 bg-black/60 text-white hover:border-pink-400/60 hover:text-pink-300 transition disabled:opacity-50"
                aria-label={isFavorited ? 'Remove from favorites' : 'Save to favorites'}
              >
                <Heart className={isFavorited ? 'h-4 w-4 fill-current text-pink-400' : 'h-4 w-4'} />
              </button>
            </div>
          </div>
          
          {/* Info section */}
          <div className="p-4 space-y-3">
            <h3 className="font-semibold text-sm line-clamp-2 text-white group-hover:text-purple-300 transition-colors leading-snug">
              {clip.title}
            </h3>
            
            <div className="flex items-center gap-2">
              {clip.profile_image_url ? (
                <img
                  src={clip.profile_image_url}
                  alt={clip.streamer_username}
                  className="w-6 h-6 rounded-full object-cover border border-purple-400/50"
                  onError={(e) => {
                    e.currentTarget.style.display = 'none';
                    const fallback = e.currentTarget.nextElementSibling;
                    if (fallback) (fallback as HTMLElement).style.display = 'flex';
                  }}
                />
              ) : null}
              <div 
                className="w-6 h-6 rounded-full bg-gradient-to-br from-purple-500 to-cyan-500 flex items-center justify-center"
                style={clip.profile_image_url ? { display: 'none' } : {}}
              >
                <User className="h-3 w-3 text-white" />
              </div>
              <span className="text-sm text-gray-300 font-medium truncate">{clip.streamer_username}</span>
            </div>
            
            <div className="flex items-center justify-between text-xs text-gray-500">
              <div className="flex items-center gap-1">
                <Eye className="h-3.5 w-3.5 text-cyan-400/70" />
                <span className="text-gray-400">{clip.view_count.toLocaleString()}</span>
              </div>
              <div className="flex items-center gap-1">
                <Calendar className="h-3.5 w-3.5 text-purple-400/70" />
                <span className="text-gray-400">{formatDate(clip.created_at)}</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
});

// ═══════════════════════════════════════════════════════════════════════════
// CLIP MODAL COMPONENT
// ═══════════════════════════════════════════════════════════════════════════

function ClipModal({
  clip,
  isOpen,
  onClose,
  isCompact,
}: {
  clip: ClipData | null;
  isOpen: boolean;
  onClose: () => void;
  isCompact?: boolean;
}) {
  if (!clip) return null;
  const compactLayout = Boolean(isCompact);

  const hostname =
    typeof window !== 'undefined'
      ? window.location.hostname
      : 'localhost';

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  // Generate embed URL based on platform
  const getEmbedUrl = () => {
    if (clip.platform === 'kick') {
      // Kick clips use direct URL - they don't have an official embed API
      // So we'll show a thumbnail with a link to watch
      return null;
    }
    return `https://clips.twitch.tv/embed?clip=${clip.clip_id}&parent=${hostname}`;
  };

  // Generate external link URL based on platform
  const getExternalUrl = () => {
    if (clip.platform === 'kick') {
      const channelSlug = clip.channel_slug || clip.streamer_username;
      return `https://kick.com/${channelSlug}?clip=${clip.clip_id}`;
    }
    return `https://clips.twitch.tv/${clip.clip_id}`;
  };

  const embedUrl = getEmbedUrl();
  const externalUrl = getExternalUrl();
  const isKick = clip.platform === 'kick';

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent 
        className={cn(
          "max-w-4xl border overflow-hidden p-0",
          compactLayout && "w-[calc(100vw-1.5rem)] max-w-none !top-4 !-translate-x-1/2 !left-1/2 rounded-3xl overflow-y-auto max-h-[90vh] pb-6"
        )}
        style={{ 
          backgroundColor: 'rgba(14, 14, 16, 0.98)',
          borderColor: isKick ? 'rgba(83, 252, 24, 0.2)' : 'rgba(168, 85, 247, 0.2)',
          backdropFilter: 'blur(20px)',
          paddingBottom: compactLayout ? 'calc(1rem + env(safe-area-inset-bottom, 0px))' : undefined,
        }}
      >
        <DialogHeader className={cn("p-6 pb-0", compactLayout && "px-4 pt-4")}>
          <div className="flex items-center gap-2">
            {isKick ? (
              <div className="px-2 py-1 rounded text-xs font-medium flex items-center gap-1"
                style={{ background: 'rgba(83, 252, 24, 0.2)', color: '#53fc18' }}>
                <KickIcon className="h-3 w-3" />
                Kick
              </div>
            ) : (
              <div className="px-2 py-1 rounded text-xs font-medium flex items-center gap-1"
                style={{ background: 'rgba(145, 70, 255, 0.2)', color: '#a855f7' }}>
                <Twitch className="h-3 w-3" />
                Twitch
              </div>
            )}
          </div>
          <DialogTitle className="line-clamp-2 text-white text-lg pr-8">{clip.title}</DialogTitle>
        </DialogHeader>
        
        <div className={cn("p-6 pt-4 space-y-4", compactLayout && "px-4")}>
          {/* Video embed or HLS player */}
          <div className="w-full aspect-video rounded-lg overflow-hidden border"
            style={{ borderColor: isKick ? 'rgba(83, 252, 24, 0.2)' : 'rgba(168, 85, 247, 0.2)' }}
          >
            {embedUrl ? (
              <iframe
                src={embedUrl}
                height="100%"
                width="100%"
                allowFullScreen
                className="bg-black"
              />
            ) : (
              // Kick clips - use HLS player for embedded playback
              <KickClipPlayer
                clipUrl={clip.embed_url}
                thumbnailUrl={clip.thumbnail_url}
                title={clip.title}
                channelSlug={clip.channel_slug || clip.streamer_username}
                clipId={clip.clip_id}
              />
            )}
          </div>
          
          {/* Stats grid */}
          <div 
            className="grid grid-cols-2 sm:grid-cols-5 gap-4 p-4 rounded-lg"
            style={{ 
              background: 'linear-gradient(135deg, rgba(24, 24, 27, 0.9) 0%, rgba(18, 18, 21, 0.9) 100%)',
              borderColor: isKick ? 'rgba(83, 252, 24, 0.15)' : 'rgba(168, 85, 247, 0.15)',
              border: `1px solid ${isKick ? 'rgba(83, 252, 24, 0.15)' : 'rgba(168, 85, 247, 0.15)'}`
            }}
          >
            <div className="space-y-1">
              <p className="text-xs text-gray-400 flex items-center gap-1">
                <User className="h-3 w-3 text-purple-400/70" />
                Streamer
              </p>
              <p className="font-semibold text-white">{clip.streamer_username}</p>
            </div>
            <div className="space-y-1">
              <p className="text-xs text-gray-400 flex items-center gap-1">
                <Server className="h-3 w-3 text-cyan-400/70" />
                Server
              </p>
              <p className="font-semibold text-cyan-400">{clip.server_name || clip.server_id}</p>
            </div>
            <div className="space-y-1">
              <p className="text-xs text-gray-400 flex items-center gap-1">
                <Eye className="h-3 w-3 text-cyan-400/70" />
                Views
              </p>
              <p className="font-semibold text-cyan-400">{clip.view_count.toLocaleString()}</p>
            </div>
            <div className="space-y-1">
              <p className="text-xs text-gray-400 flex items-center gap-1">
                <Clock className="h-3 w-3 text-purple-400/70" />
                Duration
              </p>
              <p className="font-semibold text-white">{clip.duration}s</p>
            </div>
            <div className="space-y-1">
              <p className="text-xs text-gray-400 flex items-center gap-1">
                <Calendar className="h-3 w-3 text-purple-400/70" />
                Created
              </p>
              <p className="font-semibold text-white text-sm">{formatDate(clip.created_at)}</p>
            </div>
          </div>
          
          {/* External link */}
          <a
            href={externalUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-300 border"
            style={{
              background: isKick 
                ? 'linear-gradient(135deg, rgba(83, 252, 24, 0.2) 0%, rgba(20, 184, 166, 0.1) 100%)'
                : 'linear-gradient(135deg, rgba(145, 70, 255, 0.2) 0%, rgba(20, 184, 166, 0.1) 100%)',
              borderColor: isKick ? 'rgba(83, 252, 24, 0.3)' : 'rgba(145, 70, 255, 0.3)',
            }}
          >
            {isKick ? (
              <KickIcon className="h-4 w-4 text-[#53fc18]" />
            ) : (
              <Twitch className="h-4 w-4 text-purple-400" />
            )}
            <span className="text-white">Watch on {isKick ? 'Kick' : 'Twitch'}</span>
            <ExternalLink className="h-3.5 w-3.5 text-gray-400" />
          </a>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// PAGE HEADER COMPONENT
// ═══════════════════════════════════════════════════════════════════════════

export function PageHeader() {
  return (
    <motion.div 
      className="mb-6"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
    >
      <div className="flex items-center gap-3 mb-2">
        <motion.div
          className="w-10 h-10 rounded-lg flex items-center justify-center"
          style={{
            background: 'linear-gradient(135deg, rgba(168, 85, 247, 0.2) 0%, rgba(83, 252, 24, 0.1) 100%)',
            border: '1px solid rgba(168, 85, 247, 0.3)',
          }}
          whileHover={{ scale: 1.05, rotate: 5 }}
        >
          <Film className="h-5 w-5 text-purple-400" />
        </motion.div>
        <div>
          <p className="text-gray-400 text-sm flex items-center gap-1.5">
            <Sparkles className="h-3.5 w-3.5 text-cyan-400" />
            All Clips
            <span className="flex items-center gap-1 ml-1">
              <Twitch className="h-3 w-3 text-purple-400" />
              <span className="text-gray-500">+</span>
              <KickIcon className="h-3 w-3 text-[#53fc18]" />
            </span>
          </p>
        </div>
      </div>
      <p className="text-gray-400 leading-relaxed">
        Browse and watch clips from{' '}
        <span className="text-purple-300 font-medium">Twitch</span> and{' '}
        <span className="text-[#53fc18] font-medium">Kick</span> streamers across{' '}
        <span className="text-cyan-300 font-medium">all GTA RP servers</span>.
        Discover highlights, funny moments, and epic roleplay from the community.
      </p>
    </motion.div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// LOADING SKELETON
// ═══════════════════════════════════════════════════════════════════════════

interface ClipsLoadingSkeletonProps {
  isCompact?: boolean;
}

export function ClipsLoadingSkeleton({ isCompact = false }: ClipsLoadingSkeletonProps = {}) {
  return (
    <motion.div 
      className={cn("space-y-6", isCompact && "pb-24")}
      initial="hidden"
      animate="visible"
      variants={staggerContainer}
    >
      {/* Filters skeleton */}
      <motion.div variants={fadeInUp}>
        <Card variant="elevated" animated={false}>
          <CardContent className="p-6 space-y-4">
            <AnimatedSkeleton className="h-5 w-32 mb-4" />
            <AnimatedSkeleton className="h-12 w-full" />
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <AnimatedSkeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Clips grid skeleton */}
      <motion.div 
        className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
        variants={fadeInUp}
      >
        {Array.from({ length: 9 }).map((_, i) => (
          <ClipCardSkeleton key={i} />
        ))}
      </motion.div>
    </motion.div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// MAIN PAGE CONTENT COMPONENT
// ═══════════════════════════════════════════════════════════════════════════

interface AllClipsContentProps {
  defaultServerId?: string;
  pagePath?: string;
}

export function AllClipsContent({ defaultServerId, pagePath = '/clips' }: AllClipsContentProps = {}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const isTimelineEnabled = useFeatureFlag(FEATURE_FLAGS.CLIPS_TIMELINE);
  const { isPWA } = usePWAStandalone();
  const isMobileDevice = useIsMobileDevice();
  const isCompactLayout = isPWA || isMobileDevice;
  const [isPending, startTransition] = useTransition();
  const { toast } = useToast();

  const [clips, setClips] = useState<ClipData[]>([]);
  const [servers, setServers] = useState<ServerInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedClip, setSelectedClip] = useState<ClipData | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
  const [favoriteIds, setFavoriteIds] = useState<Set<string>>(new Set());
  const [savingFavorites, setSavingFavorites] = useState<Set<string>>(new Set());
  const resolvedDefaultServer = defaultServerId || 'all';
  useEffect(() => {
    if (!isCompactLayout && mobileFiltersOpen) {
      setMobileFiltersOpen(false);
    }
  }, [isCompactLayout, mobileFiltersOpen]);

  // Get initial filters from URL query params
  const initialServer = searchParams.get('server') || resolvedDefaultServer;
  const initialStreamer = searchParams.get('streamer') || 'all';
  const initialPlatform = searchParams.get('platform') || 'all';
  const initialSearchQuery = searchParams.get('search') || '';
  const initialStartDate = searchParams.get('startDate');
  const initialEndDate = searchParams.get('endDate');
  const initialOrderBy = searchParams.get('orderBy') || 'views-desc';

  // Initialize date range from URL params
  const getInitialDateRange = (): DateRange | undefined => {
    const fromDate = parseDateParam(initialStartDate);
    const toDate = parseDateParam(initialEndDate);
    if (fromDate || toDate) {
      return {
        from: fromDate,
        to: toDate,
      };
    }
    return undefined;
  };

  const [selectedServer, setSelectedServer] = useState(initialServer);
  const [selectedStreamer, setSelectedStreamer] = useState(initialStreamer);
  const [selectedPlatform, setSelectedPlatform] = useState(initialPlatform);
  const [searchQuery, setSearchQuery] = useState(initialSearchQuery);
  const [dateRange, setDateRange] = useState<DateRange | undefined>(getInitialDateRange);
  const [orderBy, setOrderBy] = useState(initialOrderBy);
  const deferredSearchQuery = useDeferredValue(searchQuery);
  const getClipExternalUrl = useCallback((clip: ClipData): string => {
    if (clip.platform === 'kick') {
      const channelSlug = clip.channel_slug || clip.streamer_username;
      return `https://kick.com/${channelSlug}?clip=${clip.clip_id}`;
    }
    return `https://clips.twitch.tv/${clip.clip_id}`;
  }, []);
  const openClipExternally = useCallback((clip: ClipData) => {
    const targetUrl = getClipExternalUrl(clip);
    if (typeof window === 'undefined') return;
    if (isPWA) {
      window.location.href = targetUrl;
    } else {
      window.open(targetUrl, '_blank', 'noopener,noreferrer');
    }
  }, [getClipExternalUrl, isPWA]);

  /**
   * Build a stable key for favorite lookups.
   */
  const buildFavoriteKey = useCallback((clip: ClipData) => `${clip.platform}:${clip.clip_id}`, []);

  useEffect(() => {
    let isMounted = true;

    /**
     * Load favorites for the current user to hydrate UI state.
     */
    const loadFavorites = async () => {
      const currentUser = await getCurrentUser();
      if (!currentUser || typeof window === 'undefined') {
        return;
      }

      const supabase = createBrowserClient();
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;

      if (!token) {
        return;
      }

      const response = await fetch('/api/favorites/list?limit=500', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        return;
      }

      const data = (await response.json()) as FavoritesListResponse;
      if (!data.success) {
        return;
      }

      if (isMounted) {
        const nextFavorites = new Set<string>();
        data.data.forEach((favorite) => {
          nextFavorites.add(`${favorite.platform}:${favorite.clip_id}`);
        });
        setFavoriteIds(nextFavorites);
      }
    };

    loadFavorites();

    return () => {
      isMounted = false;
    };
  }, []);

  /**
   * Save or remove a clip from favorites.
   */
  const handleToggleFavorite = useCallback(async (clip: ClipData) => {
    const favoriteKey = buildFavoriteKey(clip);
    if (savingFavorites.has(favoriteKey)) {
      return;
    }

    setSavingFavorites((prev) => new Set(prev).add(favoriteKey));

    try {
      const supabase = createBrowserClient();
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;

      if (!token) {
        toast({
          title: 'Sign in required',
          description: 'Log in to save favorites.',
          variant: 'destructive',
        });
        router.push('/auth');
        return;
      }

      const isFavorited = favoriteIds.has(favoriteKey);
      const endpoint = isFavorited ? '/api/favorites/remove' : '/api/favorites/save';
      const method = isFavorited ? 'DELETE' : 'POST';
      const payload = {
        clip_id: clip.clip_id,
        platform: clip.platform,
      };

      const response = await fetch(endpoint, {
        method,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        toast({
          title: 'Favorite update failed',
          description: 'Please try again.',
          variant: 'destructive',
        });
        return;
      }

      setFavoriteIds((prev) => {
        const next = new Set(prev);
        if (isFavorited) {
          next.delete(favoriteKey);
        } else {
          next.add(favoriteKey);
        }
        return next;
      });

      toast({
        title: isFavorited ? 'Removed from favorites' : 'Added to favorites',
      });
    } finally {
      setSavingFavorites((prev) => {
        const next = new Set(prev);
        next.delete(favoriteKey);
        return next;
      });
    }
  }, [buildFavoriteKey, favoriteIds, router, savingFavorites, toast]);

  // Fetch clips
  useEffect(() => {
    const fetchClips = async () => {
      try {
        setLoading(true);
        setError(null);

        const url = new URL(
          '/api/clips/all',
          typeof window !== 'undefined' ? window.location.origin : ''
        );

        // Add server filter to API call for better performance
        if (selectedServer && selectedServer !== 'all') {
          url.searchParams.set('server', selectedServer);
        }

        // Add platform filter to API call
        if (selectedPlatform && selectedPlatform !== 'all') {
          url.searchParams.set('platform', selectedPlatform);
        }

        // Increased limit to 500 to ensure we capture all clips for filtering
        // especially when filtering by specific streamer or narrow date ranges
        url.searchParams.set('limit', '500');

        const { startDateUtc, endDateUtc } = getUtcDateRangeParams(dateRange);
        if (startDateUtc) {
          url.searchParams.set('startDate', startDateUtc);
        }
        if (endDateUtc) {
          url.searchParams.set('endDate', endDateUtc);
        }

        const response = await fetch(url.toString());

        if (!response.ok) {
          throw new Error('Failed to fetch clips');
        }

        const data: AllClipsApiResponse = await response.json();

        if (!data.success) {
          throw new Error(data.error || 'Failed to fetch clips');
        }

        setClips(data.data || []);
        setServers(data.servers || []);
      } catch (err) {
        console.error('[All Clips] Error fetching clips:', err);
        setError(err instanceof Error ? err.message : 'Failed to fetch clips');
        setClips([]);
      } finally {
        setLoading(false);
      }
    };

    fetchClips();
  }, [selectedServer, selectedPlatform, selectedStreamer, dateRange]);

  // Get unique streamers from loaded clips
  const streamers = useMemo(() => {
    const uniqueStreamers = new Set(clips.map((c) => c.streamer_username));
    return Array.from(uniqueStreamers).sort();
  }, [clips]);

  // Helper to format date for URL
  const formatDateForUrl = (date: Date | undefined): string => {
    if (!date) return '';
    return formatDateForQueryParam(date);
  };

  // URL filter update
  const updateUrlFilters = useCallback(
    (server: string, streamer: string, platform: string, search: string, range: DateRange | undefined, order: string) => {
      const params = new URLSearchParams();
      if (server !== 'all') params.set('server', server);
      if (streamer !== 'all') params.set('streamer', streamer);
      if (platform !== 'all') params.set('platform', platform);
      if (search) params.set('search', search);
      if (range?.from) params.set('startDate', formatDateForUrl(range.from));
      if (range?.to) params.set('endDate', formatDateForUrl(range.to));
      if (order !== 'views-desc') params.set('orderBy', order);
      router.push(`?${params.toString()}`, { scroll: false });
    },
    [router]
  );

  // Handlers
  const handleServerChange = useCallback(
    (value: string) => {
      startTransition(() => {
        setSelectedServer(value);
        setSelectedStreamer('all');
        updateUrlFilters(value, 'all', selectedPlatform, searchQuery, dateRange, orderBy);
      });
    },
    [startTransition, updateUrlFilters, selectedPlatform, searchQuery, dateRange, orderBy]
  );

  const handleStreamerChange = useCallback(
    (value: string) => {
      startTransition(() => {
        setSelectedStreamer(value);
        updateUrlFilters(selectedServer, value, selectedPlatform, searchQuery, dateRange, orderBy);
      });
    },
    [startTransition, updateUrlFilters, selectedServer, selectedPlatform, searchQuery, dateRange, orderBy]
  );

  const handlePlatformChange = useCallback(
    (value: string) => {
      startTransition(() => {
        setSelectedPlatform(value);
        updateUrlFilters(selectedServer, selectedStreamer, value, searchQuery, dateRange, orderBy);
      });
    },
    [startTransition, updateUrlFilters, selectedServer, selectedStreamer, searchQuery, dateRange, orderBy]
  );

  const handleSearchChange = useCallback(
    (query: string) => {
      setSearchQuery(query);
      updateUrlFilters(selectedServer, selectedStreamer, selectedPlatform, query, dateRange, orderBy);
    },
    [updateUrlFilters, selectedServer, selectedStreamer, selectedPlatform, dateRange, orderBy]
  );

  const handleOrderChange = useCallback(
    (value: string) => {
      startTransition(() => {
        setOrderBy(value);
        updateUrlFilters(selectedServer, selectedStreamer, selectedPlatform, searchQuery, dateRange, value);
      });
    },
    [startTransition, updateUrlFilters, selectedServer, selectedStreamer, selectedPlatform, searchQuery, dateRange]
  );

  const handleDateRangeChange = useCallback(
    (range: DateRange | undefined) => {
      startTransition(() => {
        setDateRange(range);
        updateUrlFilters(selectedServer, selectedStreamer, selectedPlatform, searchQuery, range, orderBy);
      });
    },
    [startTransition, updateUrlFilters, selectedServer, selectedStreamer, selectedPlatform, searchQuery, orderBy]
  );

  // Handle waveform time range selection
  const handleWaveformSelect = useCallback(
    (startDate: Date, endDate: Date) => {
      const newRange: DateRange = { from: startDate, to: endDate };
      startTransition(() => {
        setDateRange(newRange);
        setOrderBy('views-desc');
        updateUrlFilters(selectedServer, selectedStreamer, selectedPlatform, searchQuery, newRange, 'views-desc');
      });
    },
    [startTransition, updateUrlFilters, selectedServer, selectedStreamer, selectedPlatform, searchQuery]
  );

  const handleQuickRangeSelect = useCallback(
    (preset: QuickRangeKey) => {
      startTransition(() => {
        if (preset === 'all') {
          setDateRange(undefined);
          updateUrlFilters(selectedServer, selectedStreamer, selectedPlatform, searchQuery, undefined, orderBy);
          return;
        }
        const days = preset === '7d' ? 7 : 30;
        const newRange = buildRangeFromDays(days);
        setDateRange(newRange);
        updateUrlFilters(selectedServer, selectedStreamer, selectedPlatform, searchQuery, newRange, orderBy);
      });
    },
    [startTransition, updateUrlFilters, selectedServer, selectedStreamer, selectedPlatform, searchQuery, orderBy]
  );

  const activeQuickRange = useMemo<QuickRangeKey | 'custom'>(() => {
    if (!dateRange?.from && !dateRange?.to) return 'all';
    if (dateRange?.from && dateRange?.to) {
      const normalizedStart = normalizeDate(dateRange.from);
      const normalizedEnd = normalizeDate(dateRange.to);
      const today = normalizeDate(new Date());
      const diffDays = Math.round((normalizedEnd.getTime() - normalizedStart.getTime()) / DAY_IN_MS);
      const endsToday = normalizedEnd.getTime() === today.getTime();
      if (endsToday && diffDays === 6) return '7d';
      if (endsToday && diffDays === 29) return '30d';
    }
    return 'custom';
  }, [dateRange]);

  const handleClearFilters = useCallback(() => {
    startTransition(() => {
      setSelectedServer(resolvedDefaultServer);
      setSelectedStreamer('all');
      setSelectedPlatform('all');
      setSearchQuery('');
      setDateRange(undefined);
      setOrderBy('views-desc');
      router.push(pagePath, { scroll: false });
    });
  }, [startTransition, router, pagePath, resolvedDefaultServer]);

  const handleSelectClip = useCallback((clip: ClipData) => {
    if (isCompactLayout) {
      openClipExternally(clip);
      return;
    }
    setSelectedClip(clip);
    setIsModalOpen(true);
  }, [isCompactLayout, openClipExternally]);

  const handleCloseModal = useCallback(() => {
    setIsModalOpen(false);
    setTimeout(() => setSelectedClip(null), 300);
  }, []);

  // Filter and sort clips
  const filteredClips = useMemo(() => {
    let filtered = clips;

    // Filter by streamer (client-side since we already fetched by server)
    if (selectedStreamer !== 'all' && selectedStreamer) {
      filtered = filtered.filter(
        (c) => c.streamer_username.toLowerCase() === selectedStreamer.toLowerCase()
      );
    }

    // Filter by search
    const normalizedSearch = deferredSearchQuery.trim().toLowerCase();
    if (normalizedSearch) {
      filtered = filtered.filter(
        (c) =>
          c.title.toLowerCase().includes(normalizedSearch) ||
          c.streamer_username.toLowerCase().includes(normalizedSearch) ||
          (c.server_name?.toLowerCase().includes(normalizedSearch))
      );
    }

    // Helper: Get local day start timestamp so comparisons respect user timezone
    const getLocalDayTime = (date: Date | string): number => {
      const baseDate = typeof date === 'string' ? new Date(date) : new Date(date.getTime());
      baseDate.setHours(0, 0, 0, 0);
      return baseDate.getTime();
    };

    // Filter by date
    if (dateRange?.from || dateRange?.to) {
      filtered = filtered.filter((c) => {
        const clipDayTime = getLocalDayTime(c.created_at);
        
        if (dateRange.from) {
          const startDayTime = getLocalDayTime(dateRange.from);
          if (clipDayTime < startDayTime) return false;
        }
        
        if (dateRange.to) {
          const endDayTime = getLocalDayTime(dateRange.to);
          if (clipDayTime > endDayTime) return false;
        }
        
        return true;
      });
    }

    // Sort
    const sorted = [...filtered].sort((a, b) => {
      switch (orderBy) {
        case 'views-desc': 
          return b.view_count - a.view_count;
        case 'views-asc': 
          return a.view_count - b.view_count;
        case 'date-newest':
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        case 'date-oldest':
          return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
        case 'duration-longest': 
          return b.duration - a.duration;
        case 'duration-shortest': 
          return a.duration - b.duration;
        default: 
          return 0;
      }
    });

    return sorted;
  }, [clips, selectedStreamer, deferredSearchQuery, dateRange, orderBy]);

  const hasActiveFilters = selectedServer !== 'all' || selectedStreamer !== 'all' || selectedPlatform !== 'all' || searchQuery || dateRange?.from || dateRange?.to;
  const shouldShowTimeline = isTimelineEnabled && clips.length > 0 && !isCompactLayout;
  const selectedServerLabel = useMemo(() => {
    if (selectedServer === 'all') return 'All Servers';
    return servers.find((server) => server.server_id === selectedServer)?.server_name || selectedServer;
  }, [selectedServer, servers]);
  const selectedPlatformLabel = selectedPlatform === 'all' ? 'All Platforms' : selectedPlatform === 'twitch' ? 'Twitch' : 'Kick';
  const selectedStreamerLabel = selectedStreamer === 'all' ? 'All Streamers' : selectedStreamer;
  const dateRangeLabel = useMemo(() => {
    if (!dateRange?.from && !dateRange?.to) return 'All Time';
    const format = (date?: Date) =>
      date
        ? date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
        : null;
    const fromLabel = format(dateRange?.from);
    const toLabel = format(dateRange?.to);
    if (fromLabel && toLabel) return `${fromLabel} – ${toLabel}`;
    return fromLabel || toLabel || 'All Time';
  }, [dateRange]);

  const SearchField = ({ className = '', showPending = false }: { className?: string; showPending?: boolean }) => (
    <div className={cn("space-y-1", className)}>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
        <input
          type="text"
          placeholder="Search by title, streamer, or server name..."
          value={searchQuery}
          onChange={(e) => handleSearchChange(e.target.value)}
          className="w-full pl-10 pr-10 py-3 rounded-lg text-white placeholder-gray-500 transition-all duration-300 border"
          style={{
            background: 'linear-gradient(135deg, rgba(24, 24, 27, 0.9) 0%, rgba(18, 18, 21, 0.9) 100%)',
            borderColor: 'rgba(168, 85, 247, 0.15)',
          }}
        />
        {searchQuery ? (
          <button
            onClick={() => handleSearchChange('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-300 transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        ) : null}
      </div>
      {showPending && (
        <div className="flex items-center gap-2 text-xs text-gray-500 pl-1">
          <Loader2 className="h-3.5 w-3.5 animate-spin text-purple-400" />
          Updating filters...
        </div>
      )}
    </div>
  );

  const FiltersGrid = () => (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
      {/* Server Select */}
      <div className="space-y-2">
        <label className="text-xs text-gray-400 flex items-center gap-1">
          <Server className="h-3 w-3 text-cyan-400/70" />
          Server
        </label>
        <Select value={selectedServer} onValueChange={handleServerChange}>
          <SelectTrigger 
            className="w-full border text-white"
            style={{
              background: 'linear-gradient(135deg, rgba(24, 24, 27, 0.9) 0%, rgba(18, 18, 21, 0.9) 100%)',
              borderColor: 'rgba(168, 85, 247, 0.15)',
            }}
          >
            <SelectValue placeholder="All Servers" />
          </SelectTrigger>
          <SelectContent 
            style={{
              background: 'rgba(18, 18, 21, 0.98)',
              borderColor: 'rgba(168, 85, 247, 0.2)',
            }}
          >
            <SelectItem value="all" className="text-white">
              All Servers ({servers.length})
            </SelectItem>
            {servers.map((server) => (
              <SelectItem key={server.server_id} value={server.server_id} className="text-white">
                {server.server_name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Platform Select */}
      <div className="space-y-2">
        <label className="text-xs text-gray-400 flex items-center gap-1">
          <Tv2 className="h-3 w-3 text-purple-400/70" />
          Platform
        </label>
        <Select value={selectedPlatform} onValueChange={handlePlatformChange}>
          <SelectTrigger 
            className="w-full border text-white"
            style={{
              background: 'linear-gradient(135deg, rgba(24, 24, 27, 0.9) 0%, rgba(18, 18, 21, 0.9) 100%)',
              borderColor: 'rgba(168, 85, 247, 0.15)',
            }}
          >
            <SelectValue placeholder="All Platforms" />
          </SelectTrigger>
          <SelectContent 
            style={{
              background: 'rgba(18, 18, 21, 0.98)',
              borderColor: 'rgba(168, 85, 247, 0.2)',
            }}
          >
            <SelectItem value="all" className="text-white">
              <div className="flex items-center gap-2">
                <Tv2 className="h-3 w-3" />
                All Platforms
              </div>
            </SelectItem>
            <SelectItem value="twitch" className="text-white">
              <div className="flex items-center gap-2">
                <Twitch className="h-3 w-3 text-purple-400" />
                Twitch
              </div>
            </SelectItem>
            <SelectItem value="kick" className="text-white">
              <div className="flex items-center gap-2">
                <KickIcon className="h-3 w-3 text-[#53fc18]" />
                Kick
              </div>
            </SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Streamer Select */}
      <div className="space-y-2">
        <label className="text-xs text-gray-400 flex items-center gap-1">
          <User className="h-3 w-3 text-purple-400/70" />
          Streamer
        </label>
        <Select value={selectedStreamer} onValueChange={handleStreamerChange}>
          <SelectTrigger 
            className="w-full border text-white"
            style={{
              background: 'linear-gradient(135deg, rgba(24, 24, 27, 0.9) 0%, rgba(18, 18, 21, 0.9) 100%)',
              borderColor: 'rgba(168, 85, 247, 0.15)',
            }}
          >
            <SelectValue placeholder="All Streamers" />
          </SelectTrigger>
          <SelectContent 
            style={{
              background: 'rgba(18, 18, 21, 0.98)',
              borderColor: 'rgba(168, 85, 247, 0.2)',
            }}
          >
            <SelectItem value="all" className="text-white">
              All Streamers ({streamers.length})
            </SelectItem>
            {streamers.map((streamer) => (
              <SelectItem key={streamer} value={streamer} className="text-white">
                {streamer}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Sort By */}
      <div className="space-y-2">
        <label className="text-xs text-gray-400 flex items-center gap-1">
          <ArrowUpDown className="h-3 w-3 text-cyan-400/70" />
          Sort By
        </label>
        <Select value={orderBy} onValueChange={handleOrderChange}>
          <SelectTrigger 
            className="w-full border text-white"
            style={{
              background: 'linear-gradient(135deg, rgba(24, 24, 27, 0.9) 0%, rgba(18, 18, 21, 0.9) 100%)',
              borderColor: 'rgba(168, 85, 247, 0.15)',
            }}
          >
            <SelectValue placeholder="Sort clips" />
          </SelectTrigger>
          <SelectContent
            style={{
              background: 'rgba(18, 18, 21, 0.98)',
              borderColor: 'rgba(168, 85, 247, 0.2)',
            }}
          >
            <SelectItem value="views-desc" className="text-white">Views (High → Low)</SelectItem>
            <SelectItem value="views-asc" className="text-white">Views (Low → High)</SelectItem>
            <SelectItem value="date-newest" className="text-white">Date (Newest)</SelectItem>
            <SelectItem value="date-oldest" className="text-white">Date (Oldest)</SelectItem>
            <SelectItem value="duration-longest" className="text-white">Duration (Longest)</SelectItem>
            <SelectItem value="duration-shortest" className="text-white">Duration (Shortest)</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Date Range Picker */}
      <div className="space-y-2">
        <label className="text-xs text-gray-400 flex items-center gap-1">
          <Calendar className="h-3 w-3 text-cyan-400/70" />
          Date Range
        </label>
        <DateRangePicker
          dateRange={dateRange}
          onDateRangeChange={handleDateRangeChange}
          placeholder="All Time"
        />
      </div>
    </div>
  );

  const MobileSelectField = ({
    label,
    value,
    onChange,
    options,
  }: {
    label: string;
    value: string;
    onChange: (val: string) => void;
    options: { value: string; label: string }[];
  }) => (
    <div className="space-y-1">
      <label className="text-xs text-gray-400">{label}</label>
      <div className="relative">
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full appearance-none rounded-lg border bg-gradient-to-r from-black/60 to-zinc-900/60 text-white text-sm px-3 py-2 pr-8 focus:outline-none focus:ring-2 focus:ring-purple-500/40 border-white/10"
        >
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500 pointer-events-none" />
      </div>
    </div>
  );

  const MobileFilterControls = () => (
    <div className="space-y-4">
      <MobileSelectField
        label="Server"
        value={selectedServer}
        onChange={handleServerChange}
        options={[
          { value: 'all', label: `All Servers (${servers.length})` },
          ...servers.map((server) => ({
            value: server.server_id,
            label: server.server_name,
          })),
        ]}
      />
      <MobileSelectField
        label="Platform"
        value={selectedPlatform}
        onChange={handlePlatformChange}
        options={[
          { value: 'all', label: 'All Platforms' },
          { value: 'twitch', label: 'Twitch' },
          { value: 'kick', label: 'Kick' },
        ]}
      />
      <MobileSelectField
        label="Streamer"
        value={selectedStreamer}
        onChange={handleStreamerChange}
        options={[
          { value: 'all', label: `All Streamers (${streamers.length})` },
          ...streamers.map((streamer) => ({
            value: streamer,
            label: streamer,
          })),
        ]}
      />
      <MobileSelectField
        label="Sort By"
        value={orderBy}
        onChange={handleOrderChange}
        options={[
          { value: 'views-desc', label: 'Views (High → Low)' },
          { value: 'views-asc', label: 'Views (Low → High)' },
          { value: 'date-newest', label: 'Date (Newest)' },
          { value: 'date-oldest', label: 'Date (Oldest)' },
          { value: 'duration-longest', label: 'Duration (Longest)' },
          { value: 'duration-shortest', label: 'Duration (Shortest)' },
        ]}
      />
      <div className="space-y-2">
        <p className="text-xs text-gray-400 flex items-center gap-1">
          <Calendar className="h-3 w-3 text-cyan-400/70" />
          Quick Date Range
        </p>
        <div className="grid grid-cols-3 gap-2">
          {QUICK_RANGE_PRESETS.map((preset) => (
            <button
              key={preset.key}
              type="button"
              onClick={() => handleQuickRangeSelect(preset.key)}
              className={cn(
                "px-3 py-2 rounded-lg text-xs font-medium border transition-colors",
                activeQuickRange === preset.key
                  ? "border-purple-500/60 text-white bg-purple-500/20"
                  : "border-white/10 text-gray-300 hover:border-white/30"
              )}
            >
              {preset.label}
            </button>
          ))}
        </div>
        {activeQuickRange === 'custom' && (
          <p className="text-xs text-gray-500">
            Custom range selected
          </p>
        )}
      </div>
    </div>
  );

  const ActiveFiltersBanner = () => (
    <AnimatePresence>
      {hasActiveFilters && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          exit={{ opacity: 0, height: 0 }}
          className="flex items-center justify-between p-3 rounded-lg"
          style={{
            background: 'linear-gradient(135deg, rgba(168, 85, 247, 0.1) 0%, rgba(20, 184, 166, 0.05) 100%)',
            borderColor: 'rgba(168, 85, 247, 0.2)',
            border: '1px solid rgba(168, 85, 247, 0.2)',
          }}
        >
          <p className="text-sm text-gray-300">
            Showing <span className="text-purple-400 font-semibold">{filteredClips.length}</span> of{' '}
            <span className="text-cyan-400 font-semibold">{clips.length}</span> clips
          </p>
          <motion.button
            onClick={handleClearFilters}
            className="px-3 py-1.5 text-xs rounded-lg font-medium border transition-colors"
            style={{
              background: 'rgba(24, 24, 27, 0.9)',
              borderColor: 'rgba(168, 85, 247, 0.3)',
              color: '#c4b5fd',
            }}
            whileHover={{ scale: 1.02, borderColor: 'rgba(168, 85, 247, 0.5)' }}
            whileTap={{ scale: 0.98 }}
          >
            Clear Filters
          </motion.button>
        </motion.div>
      )}
    </AnimatePresence>
  );

  const FilterControls = ({ showBanner = true }: { showBanner?: boolean }) => (
    <>
      <FiltersGrid />
      {showBanner && <ActiveFiltersBanner />}
    </>
  );

  if (loading) {
    return <ClipsLoadingSkeleton isCompact={isCompactLayout} />;
  }

  return (
    <motion.div 
      className="space-y-6"
      initial="hidden"
      animate="visible"
      variants={staggerContainer}
    >
      {/* Timeline Waveform Visualization */}
      {shouldShowTimeline && (
        <motion.div variants={fadeInUp}>
          <ClipsTimelineWaveform
            clips={clips}
            onTimeRangeSelect={handleWaveformSelect}
            selectedRange={dateRange}
            className="mb-2"
          />
        </motion.div>
      )}

      {/* Controls */}
      <motion.div variants={fadeInUp}>
        {isCompactLayout ? (
          <Drawer
            shouldScaleBackground={false}
            open={mobileFiltersOpen}
            onOpenChange={setMobileFiltersOpen}
          >
            <Card variant="elevated" className="overflow-hidden">
              <CardGradientBackground />
              <CardContent className="relative z-10 space-y-4">
                <SearchField />
                <motion.button
                  type="button"
                  onClick={() => setMobileFiltersOpen(true)}
                  className="w-full inline-flex items-center justify-center gap-2 px-4 py-3 rounded-lg text-sm font-medium border"
                  style={{
                    background: 'linear-gradient(135deg, rgba(24, 24, 27, 0.9) 0%, rgba(18, 18, 21, 0.9) 100%)',
                    borderColor: 'rgba(168, 85, 247, 0.2)',
                  }}
                  whileHover={{ scale: 1.01 }}
                  whileTap={{ scale: 0.99 }}
                >
                  <SlidersHorizontal className="h-4 w-4 text-purple-400" />
                  <span className="text-white">Filters &amp; Sort</span>
                </motion.button>
                <div className="grid grid-cols-2 gap-3 text-xs text-gray-400">
                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-gray-500">Server</p>
                    <p className="text-sm text-white">{selectedServerLabel}</p>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-gray-500">Platform</p>
                    <p className="text-sm text-white">{selectedPlatformLabel}</p>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-gray-500">Streamer</p>
                    <p className="text-sm text-white truncate">{selectedStreamerLabel}</p>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-gray-500">Date Range</p>
                    <p className="text-sm text-white">{dateRangeLabel}</p>
                  </div>
                </div>
                <div className="text-sm text-gray-300">
                  {hasActiveFilters ? (
                    <>
                      Showing <span className="text-purple-400 font-semibold">{filteredClips.length}</span> of{' '}
                      <span className="text-cyan-400 font-semibold">{clips.length}</span> clips
                    </>
                  ) : (
                    <>All {clips.length} clips are visible</>
                  )}
                </div>
              </CardContent>
            </Card>
            <DrawerContent className="bg-[#08080b] text-white border-t border-purple-500/30">
              <DrawerHeader className="text-left relative">
                <DrawerTitle className="text-lg text-white flex items-center gap-2">
                  <Filter className="h-4 w-4 text-purple-400" />
                  Filters &amp; Search
                </DrawerTitle>
                <DrawerClose asChild>
                  <button
                    type="button"
                    className="absolute right-4 top-4 rounded-full p-2 text-gray-400 hover:text-white hover:bg-white/10 transition-colors"
                    aria-label="Close filters"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </DrawerClose>
              </DrawerHeader>
              <div className="px-4 pb-4 space-y-4 max-h-[70vh] overflow-y-auto">
                <SearchField showPending={isPending} />
                <MobileFilterControls />
                <ActiveFiltersBanner />
              </div>
              <DrawerFooter className="px-4 pb-6">
                <Button
                  variant="outline"
                  className="border-purple-500/40 text-purple-200 hover:bg-purple-500/10"
                  onClick={() => {
                    handleClearFilters();
                    setMobileFiltersOpen(false);
                  }}
                >
                  Clear All Filters
                </Button>
                <Button
                  className="bg-gradient-to-r from-purple-500 to-cyan-500 text-black font-semibold hover:opacity-90"
                  onClick={() => setMobileFiltersOpen(false)}
                >
                  Done
                </Button>
              </DrawerFooter>
            </DrawerContent>
          </Drawer>
        ) : (
          <Card variant="elevated" className="overflow-hidden">
            <CardGradientBackground />
            <CardHeader className="pb-4 relative z-10">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Filter className="h-5 w-5 text-purple-400" />
                  <span className="bg-gradient-to-r from-white to-purple-200 bg-clip-text text-transparent">
                    Filters &amp; Search
                  </span>
                </CardTitle>
                
                <motion.button
                  onClick={() => setShowFilters(!showFilters)}
                  className="sm:hidden inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium border"
                  style={{
                    background: 'linear-gradient(135deg, rgba(24, 24, 27, 0.9) 0%, rgba(18, 18, 21, 0.9) 100%)',
                    borderColor: 'rgba(168, 85, 247, 0.2)',
                  }}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  <SlidersHorizontal className="h-4 w-4 text-purple-400" />
                  <span className="text-white">{showFilters ? 'Hide' : 'Show'} Filters</span>
                </motion.button>
              </div>
            </CardHeader>
            
            <CardContent className={cn("relative z-10 space-y-4", !showFilters && "hidden sm:block")}>
              <SearchField />
              <FilterControls />
            </CardContent>
          </Card>
        )}
      </motion.div>

      {/* Content */}
      <AnimatePresence mode="wait">
        {error ? (
          <motion.div
            key="error"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
          >
            <Card variant="elevated" className="overflow-hidden">
              <CardGradientBackground />
              <CardContent className="p-6 relative z-10">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-red-500/20 flex items-center justify-center">
                    <AlertCircle className="h-5 w-5 text-red-400" />
                  </div>
                  <div>
                    <p className="font-semibold text-red-400">Unable to load clips</p>
                    <p className="text-sm text-red-300/70">{error}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ) : clips.length === 0 ? (
          <motion.div
            key="empty"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
          >
            <Card variant="elevated" className="overflow-hidden">
              <CardGradientBackground />
              <CardContent className="py-16 relative z-10 text-center">
                <motion.div
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ delay: 0.1, ...springs.bouncy }}
                  className="w-16 h-16 rounded-full bg-purple-500/20 flex items-center justify-center mx-auto mb-4"
                >
                  <Film className="h-8 w-8 text-purple-400" />
                </motion.div>
                <h3 className="text-lg font-semibold text-white mb-2">No clips found</h3>
                <p className="text-gray-400">
                  No clips have been collected yet. Check back later!
                </p>
              </CardContent>
            </Card>
          </motion.div>
        ) : filteredClips.length === 0 ? (
          <motion.div
            key="no-results"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
          >
            <Card variant="elevated" className="overflow-hidden">
              <CardGradientBackground />
              <CardContent className="py-16 relative z-10 text-center">
                <motion.div
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ delay: 0.1, ...springs.bouncy }}
                  className="w-16 h-16 rounded-full bg-cyan-500/20 flex items-center justify-center mx-auto mb-4"
                >
                  <Search className="h-8 w-8 text-cyan-400" />
                </motion.div>
                <h3 className="text-lg font-semibold text-white mb-2">No clips match your filters</h3>
                <p className="text-gray-400 mb-4">Try adjusting your search or filter criteria.</p>
                <motion.button
                  onClick={handleClearFilters}
                  className="px-4 py-2 rounded-lg text-sm font-medium border transition-all"
                  style={{
                    background: 'linear-gradient(135deg, rgba(168, 85, 247, 0.2) 0%, rgba(20, 184, 166, 0.1) 100%)',
                    borderColor: 'rgba(168, 85, 247, 0.3)',
                    color: '#c4b5fd',
                  }}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  Clear All Filters
                </motion.button>
              </CardContent>
            </Card>
          </motion.div>
        ) : (
          <motion.div
            key="clips"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
          >
            {filteredClips.map((clip, index) => (
              <ClipCard
                key={clip.clip_id}
                clip={clip}
                onSelect={handleSelectClip}
                onToggleFavorite={handleToggleFavorite}
                isFavorited={favoriteIds.has(buildFavoriteKey(clip))}
                isSavingFavorite={savingFavorites.has(buildFavoriteKey(clip))}
                index={index}
              />
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Modal */}
      <ClipModal
        clip={selectedClip}
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        isCompact={isCompactLayout}
      />
    </motion.div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// MAIN PAGE COMPONENT
// ═══════════════════════════════════════════════════════════════════════════

export default function AllClipsPage() {
  return (
    <CommonLayout showBackButton pageTitle="Clips">
      <PageHeader />
      <Suspense fallback={<ClipsLoadingSkeleton />}>
        <AllClipsContent />
      </Suspense>
    </CommonLayout>
  );
}
