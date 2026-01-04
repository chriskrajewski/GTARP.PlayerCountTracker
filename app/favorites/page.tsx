'use client';

import { useEffect, useState, useCallback, useMemo, memo, Suspense, useTransition, useDeferredValue } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { CommonLayout } from '@/components/common-layout';
import { useFeatureFlag, FEATURE_FLAGS } from '@/lib/feature-flags';
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
import { LoginModal } from '@/components/login-modal';
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
import { KickClipPlayer } from '@/components/kick-clip-player';
import { usePWAStandalone, useIsMobileDevice } from '@/hooks/use-pwa-standalone';
import { createBrowserClient } from '@/lib/supabase-browser';
import { getCurrentUser } from '@/lib/user-auth-supabase';
import { useToast } from '@/hooks/use-toast';

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
  view_count?: number;
  duration?: number;
  created_at: string;
  profile_image_url?: string;
  server_id: string;
  server_name?: string;
  platform: ClipPlatform;
  channel_slug?: string;
}

interface FavoriteRecord {
  id: number;
  user_id: number;
  clip_id: string;
  platform: ClipPlatform;
  saved_at: string;
  notes: string | null;
  categories: string[] | null;
  viewing_history: string[] | null;
  clip: ClipData | null;
}

interface FavoritesApiResponse {
  success: boolean;
  data: FavoriteRecord[];
  total: number;
  error?: string;
}

const normalizeDate = (date: Date) => {
  const normalized = new Date(date);
  normalized.setHours(0, 0, 0, 0);
  return normalized;
};

const formatDateForQueryParam = (date?: Date): string => {
  if (!date) return '';
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const LOCAL_DATE_REGEX = /^(\d{4})-(\d{2})-(\d{2})$/;

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

  const formatDuration = (seconds?: number) => {
    if (!seconds || seconds < 0) return 'N/A';
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
                <span className="text-gray-400">{(clip.view_count ?? 0).toLocaleString()}</span>
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
              <p className="font-semibold text-cyan-400">{(clip.view_count ?? 0).toLocaleString()}</p>
            </div>
            <div className="space-y-1">
              <p className="text-xs text-gray-400 flex items-center gap-1">
                <Clock className="h-3 w-3 text-purple-400/70" />
                Duration
              </p>
              <p className="font-semibold text-white">{clip.duration ? `${clip.duration}s` : 'N/A'}</p>
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

function PageHeader() {
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
          <Heart className="h-5 w-5 text-pink-400" />
        </motion.div>
        <div>
          <p className="text-gray-400 text-sm flex items-center gap-1.5">
            <Sparkles className="h-3.5 w-3.5 text-cyan-400" />
            Saved Favorites
            <span className="flex items-center gap-1 ml-1">
              <Twitch className="h-3 w-3 text-purple-400" />
              <span className="text-gray-500">+</span>
              <KickIcon className="h-3 w-3 text-[#53fc18]" />
            </span>
          </p>
        </div>
      </div>
      <p className="text-gray-400 leading-relaxed">
        Your saved clips from{' '}
        <span className="text-purple-300 font-medium">Twitch</span> and{' '}
        <span className="text-[#53fc18] font-medium">Kick</span> streamers across{' '}
        <span className="text-cyan-300 font-medium">all GTA RP servers</span>.
        Browse and manage your favorite highlights and moments.
      </p>
    </motion.div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// MAIN FAVORITES CONTENT COMPONENT
// ═══════════════════════════════════════════════════════════════════════════

export function FavoritesContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { isPWA } = usePWAStandalone();
  const isMobileDevice = useIsMobileDevice();
  const isCompactLayout = isPWA || isMobileDevice;
  const [isPending, startTransition] = useTransition();
  const { toast } = useToast();
  const isFavoritesEnabled = useFeatureFlag(FEATURE_FLAGS.FAVORITES);

  const [clips, setClips] = useState<ClipData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedClip, setSelectedClip] = useState<ClipData | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
  const [favoriteIds, setFavoriteIds] = useState<Set<string>>(new Set());
  const [savingFavorites, setSavingFavorites] = useState<Set<string>>(new Set());
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);

  useEffect(() => {
    if (!isCompactLayout && mobileFiltersOpen) {
      setMobileFiltersOpen(false);
    }
  }, [isCompactLayout, mobileFiltersOpen]);

  // Redirect if favorites feature is disabled
  useEffect(() => {
    if (!isFavoritesEnabled) {
      router.replace('/');
    }
  }, [isFavoritesEnabled, router]);

  // Get initial filters from URL query params
  const initialStreamer = searchParams.get('streamer') || 'all';
  const initialPlatform = searchParams.get('platform') || 'all';
  const initialSearchQuery = searchParams.get('search') || '';
  const initialStartDate = searchParams.get('startDate');
  const initialEndDate = searchParams.get('endDate');
  const initialOrderBy = searchParams.get('orderBy') || 'date-newest';

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

  const [selectedStreamer, setSelectedStreamer] = useState(initialStreamer);
  const [selectedPlatform, setSelectedPlatform] = useState(initialPlatform);
  const [searchQuery, setSearchQuery] = useState(initialSearchQuery);
  const [dateRange, setDateRange] = useState<DateRange | undefined>(getInitialDateRange);
  const [orderBy, setOrderBy] = useState(initialOrderBy);
  const deferredSearchQuery = useDeferredValue(searchQuery);

  const buildFavoriteKey = useCallback((clip: ClipData) => `${clip.platform}:${clip.clip_id}`, []);
  
  const openClipExternally = useCallback((clip: ClipData) => {
    const targetUrl = clip.platform === 'kick'
      ? `https://kick.com/${clip.channel_slug || clip.streamer_username}?clip=${clip.clip_id}`
      : `https://clips.twitch.tv/${clip.clip_id}`;
    
    if (typeof window === 'undefined') return;
    if (isPWA) {
      window.location.href = targetUrl;
    } else {
      window.open(targetUrl, '_blank', 'noopener,noreferrer');
    }
  }, [isPWA]);

  // Fetch favorites
  useEffect(() => {
    const fetchFavorites = async () => {
      try {
        setLoading(true);
        setError(null);

        const currentUser = await getCurrentUser();
        if (!currentUser) {
          setError('Please sign in to view favorites');
          setLoading(false);
          return;
        }

        const supabase = createBrowserClient();
        const { data: { session } } = await supabase.auth.getSession();
        const token = session?.access_token;

        if (!token) {
          setError('Authentication required');
          setLoading(false);
          return;
        }

        const url = new URL('/api/favorites/list', typeof window !== 'undefined' ? window.location.origin : '');
        url.searchParams.set('limit', '300');

        const response = await fetch(url.toString(), {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (!response.ok) {
          throw new Error('Failed to fetch favorites');
        }

        const data: FavoritesApiResponse = await response.json();

        if (!data.success) {
          throw new Error(data.error || 'Failed to fetch favorites');
        }

        // Extract clip data from favorite records
        const clipsList = (data.data || [])
          .filter((record) => record.clip !== null)
          .map((record) => record.clip as ClipData);
        
        setClips(clipsList);
        
        // Initialize favoriteIds with all fetched clips
        const allFavorites = new Set<string>();
        clipsList.forEach((clip) => {
          allFavorites.add(`${clip.platform}:${clip.clip_id}`);
        });
        setFavoriteIds(allFavorites);
      } catch (err) {
        console.error('[Favorites] Error fetching favorites:', err);
        setError(err instanceof Error ? err.message : 'Failed to fetch favorites');
        setClips([]);
      } finally {
        setLoading(false);
      }
    };

    fetchFavorites();
  }, []);

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
    (streamer: string, platform: string, search: string, range: DateRange | undefined, order: string) => {
      const params = new URLSearchParams();
      if (streamer !== 'all') params.set('streamer', streamer);
      if (platform !== 'all') params.set('platform', platform);
      if (search) params.set('search', search);
      if (range?.from) params.set('startDate', formatDateForUrl(range.from));
      if (range?.to) params.set('endDate', formatDateForUrl(range.to));
      if (order !== 'date-newest') params.set('orderBy', order);
      router.push(`?${params.toString()}`, { scroll: false });
    },
    [router]
  );

  // Handlers
  const handleStreamerChange = useCallback(
    (value: string) => {
      startTransition(() => {
        setSelectedStreamer(value);
        updateUrlFilters(value, selectedPlatform, searchQuery, dateRange, orderBy);
      });
    },
    [startTransition, updateUrlFilters, selectedPlatform, searchQuery, dateRange, orderBy]
  );

  const handlePlatformChange = useCallback(
    (value: string) => {
      startTransition(() => {
        setSelectedPlatform(value);
        updateUrlFilters(selectedStreamer, value, searchQuery, dateRange, orderBy);
      });
    },
    [startTransition, updateUrlFilters, selectedStreamer, searchQuery, dateRange, orderBy]
  );

  const handleSearchChange = useCallback(
    (query: string) => {
      setSearchQuery(query);
      updateUrlFilters(selectedStreamer, selectedPlatform, query, dateRange, orderBy);
    },
    [updateUrlFilters, selectedStreamer, selectedPlatform, dateRange, orderBy]
  );

  const handleOrderChange = useCallback(
    (value: string) => {
      startTransition(() => {
        setOrderBy(value);
        updateUrlFilters(selectedStreamer, selectedPlatform, searchQuery, dateRange, value);
      });
    },
    [startTransition, updateUrlFilters, selectedStreamer, selectedPlatform, searchQuery, dateRange]
  );

  const handleDateRangeChange = useCallback(
    (range: DateRange | undefined) => {
      startTransition(() => {
        setDateRange(range);
        updateUrlFilters(selectedStreamer, selectedPlatform, searchQuery, range, orderBy);
      });
    },
    [startTransition, updateUrlFilters, selectedStreamer, selectedPlatform, searchQuery, orderBy]
  );

  const handleClearFilters = useCallback(() => {
    startTransition(() => {
      setSelectedStreamer('all');
      setSelectedPlatform('all');
      setSearchQuery('');
      setDateRange(undefined);
      setOrderBy('date-newest');
      router.push('/favorites', { scroll: false });
    });
  }, [startTransition, router]);

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
        setIsLoginModalOpen(true);
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
          setClips((prevClips) => prevClips.filter((c) => buildFavoriteKey(c) !== favoriteKey));
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

  // Filter and sort clips
  const filteredClips = useMemo(() => {
    let filtered = clips;

    // Filter by streamer
    if (selectedStreamer !== 'all' && selectedStreamer) {
      filtered = filtered.filter(
        (c) => c.streamer_username.toLowerCase() === selectedStreamer.toLowerCase()
      );
    }

    // Filter by platform
    if (selectedPlatform !== 'all' && selectedPlatform) {
      filtered = filtered.filter((c) => c.platform === selectedPlatform);
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

    // Helper: Get local day start timestamp
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
          return (b.view_count ?? 0) - (a.view_count ?? 0);
        case 'views-asc': 
          return (a.view_count ?? 0) - (b.view_count ?? 0);
        case 'date-newest':
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        case 'date-oldest':
          return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
        case 'duration-longest': 
          return (b.duration ?? 0) - (a.duration ?? 0);
        case 'duration-shortest': 
          return (a.duration ?? 0) - (b.duration ?? 0);
        default: 
          return 0;
      }
    });

    return sorted;
  }, [clips, selectedStreamer, selectedPlatform, deferredSearchQuery, dateRange, orderBy]);

  const hasActiveFilters = selectedStreamer !== 'all' || selectedPlatform !== 'all' || searchQuery || dateRange?.from || dateRange?.to;

  const SearchField = ({ className = '', showPending = false }: { className?: string; showPending?: boolean }) => (
    <div className={cn("space-y-1", className)}>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
        <input
          type="text"
          placeholder="Search by title or streamer..."
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
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
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
            <SelectValue placeholder="Sort by" />
          </SelectTrigger>
          <SelectContent
            style={{
              background: 'rgba(18, 18, 21, 0.98)',
              borderColor: 'rgba(168, 85, 247, 0.2)',
            }}
          >
            <SelectItem value="date-newest" className="text-white">Date (Newest)</SelectItem>
            <SelectItem value="date-oldest" className="text-white">Date (Oldest)</SelectItem>
            <SelectItem value="views-desc" className="text-white">Views (High → Low)</SelectItem>
            <SelectItem value="views-asc" className="text-white">Views (Low → High)</SelectItem>
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
            <span className="text-cyan-400 font-semibold">{clips.length}</span> favorites
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

  if (loading) {
    return (
      <motion.div 
        className="space-y-6 pb-24"
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

        {/* Grid skeleton */}
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

  return (
    <motion.div 
      className="space-y-6"
      initial="hidden"
      animate="visible"
      variants={staggerContainer}
    >
      {/* Controls */}
      <motion.div variants={fadeInUp}>
        <Card variant="elevated" className="overflow-hidden">
          <CardGradientBackground />
          <CardHeader className="pb-4 relative z-10">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <CardTitle className="text-lg flex items-center gap-2">
                <Filter className="h-5 w-5 text-purple-400" />
                <span className="bg-gradient-to-r from-white to-purple-200 bg-clip-text text-transparent">
                  Filters & Search
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
            <FiltersGrid />
            <ActiveFiltersBanner />
          </CardContent>
        </Card>
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
                    <p className="font-semibold text-red-400">Unable to load favorites</p>
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
                  <Heart className="h-8 w-8 text-pink-400" />
                </motion.div>
                <h3 className="text-lg font-semibold text-white mb-2">No favorites yet</h3>
                <p className="text-gray-400">
                  Save clips from the Clips page to see them here!
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
                <h3 className="text-lg font-semibold text-white mb-2">No favorites match your filters</h3>
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

      {/* Modals */}
      <ClipModal
        clip={selectedClip}
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        isCompact={isCompactLayout}
      />

      <LoginModal
        isOpen={isLoginModalOpen}
        onOpenChange={setIsLoginModalOpen}
        title="Sign in to save favorites"
        description="Log in with Discord to save and manage your favorite clips."
      />
    </motion.div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// MAIN PAGE COMPONENT
// ═══════════════════════════════════════════════════════════════════════════

export default function FavoritesPage() {
  return (
    <CommonLayout showBackButton pageTitle="Favorites">
      <PageHeader />
      <Suspense fallback={<div>Loading...</div>}>
        <FavoritesContent />
      </Suspense>
    </CommonLayout>
  );
}
