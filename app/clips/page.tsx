'use client';

import { useEffect, useState, useCallback, useMemo, memo, Suspense } from 'react';
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
} from 'lucide-react';

// ═══════════════════════════════════════════════════════════════════════════
// INTERFACES
// ═══════════════════════════════════════════════════════════════════════════

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
  index = 0,
}: {
  clip: ClipData;
  onSelect: (clip: ClipData) => void;
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
            
            {/* Twitch badge */}
            <div className="absolute top-2 left-2 flex items-center gap-1 px-2 py-1 rounded z-20"
              style={{
                background: 'rgba(145, 70, 255, 0.9)',
                backdropFilter: 'blur(4px)',
              }}
            >
              <Twitch className="h-3 w-3 text-white" />
              <span className="text-xs font-medium text-white">Clip</span>
            </div>

            {/* Server badge */}
            <div className="absolute top-2 right-2 flex items-center gap-1 px-2 py-1 rounded z-20"
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
}: {
  clip: ClipData | null;
  isOpen: boolean;
  onClose: () => void;
}) {
  if (!clip) return null;

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

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent 
        className="max-w-4xl border overflow-hidden p-0"
        style={{ 
          backgroundColor: 'rgba(14, 14, 16, 0.98)',
          borderColor: 'rgba(168, 85, 247, 0.2)',
          backdropFilter: 'blur(20px)',
        }}
      >
        <DialogHeader className="p-6 pb-0">
          <DialogTitle className="line-clamp-2 text-white text-lg pr-8">{clip.title}</DialogTitle>
        </DialogHeader>
        
        <div className="p-6 pt-4 space-y-4">
          {/* Video embed */}
          <div className="w-full aspect-video rounded-lg overflow-hidden border"
            style={{ borderColor: 'rgba(168, 85, 247, 0.2)' }}
          >
            <iframe
              src={`https://clips.twitch.tv/embed?clip=${clip.clip_id}&parent=${hostname}`}
              height="100%"
              width="100%"
              allowFullScreen
              className="bg-black"
            />
          </div>
          
          {/* Stats grid */}
          <div 
            className="grid grid-cols-2 md:grid-cols-5 gap-4 p-4 rounded-lg"
            style={{ 
              background: 'linear-gradient(135deg, rgba(24, 24, 27, 0.9) 0%, rgba(18, 18, 21, 0.9) 100%)',
              borderColor: 'rgba(168, 85, 247, 0.15)',
              border: '1px solid rgba(168, 85, 247, 0.15)'
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
            href={`https://clips.twitch.tv/${clip.clip_id}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-300 border"
            style={{
              background: 'linear-gradient(135deg, rgba(145, 70, 255, 0.2) 0%, rgba(20, 184, 166, 0.1) 100%)',
              borderColor: 'rgba(145, 70, 255, 0.3)',
            }}
          >
            <Twitch className="h-4 w-4 text-purple-400" />
            <span className="text-white">Watch on Twitch</span>
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
            background: 'linear-gradient(135deg, rgba(168, 85, 247, 0.2) 0%, rgba(20, 184, 166, 0.1) 100%)',
            border: '1px solid rgba(168, 85, 247, 0.3)',
          }}
          whileHover={{ scale: 1.05, rotate: 5 }}
        >
          <Film className="h-5 w-5 text-purple-400" />
        </motion.div>
        <div>
          <p className="text-gray-400 text-sm flex items-center gap-1.5">
            <Sparkles className="h-3.5 w-3.5 text-cyan-400" />
            All Twitch Clips
          </p>
        </div>
      </div>
      <p className="text-gray-400 leading-relaxed">
        Browse and watch clips from streamers across{' '}
        <span className="text-purple-300 font-medium">all GTA RP servers</span>.
        Discover highlights, funny moments, and epic roleplay from the community.
      </p>
    </motion.div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// LOADING SKELETON
// ═══════════════════════════════════════════════════════════════════════════

function ClipsLoadingSkeleton() {
  return (
    <motion.div 
      className="space-y-6"
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

function AllClipsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [clips, setClips] = useState<ClipData[]>([]);
  const [servers, setServers] = useState<ServerInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedClip, setSelectedClip] = useState<ClipData | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [showFilters, setShowFilters] = useState(false);

  // Get initial filters from URL query params
  const initialServer = searchParams.get('server') || 'all';
  const initialStreamer = searchParams.get('streamer') || 'all';
  const initialSearchQuery = searchParams.get('search') || '';
  const initialStartDate = searchParams.get('startDate') || '';
  const initialEndDate = searchParams.get('endDate') || '';
  const initialOrderBy = searchParams.get('orderBy') || 'views-desc';

  // Initialize date range from URL params
  const getInitialDateRange = (): DateRange | undefined => {
    if (initialStartDate || initialEndDate) {
      return {
        from: initialStartDate ? new Date(initialStartDate) : undefined,
        to: initialEndDate ? new Date(initialEndDate) : undefined,
      };
    }
    return undefined;
  };

  const [selectedServer, setSelectedServer] = useState(initialServer);
  const [selectedStreamer, setSelectedStreamer] = useState(initialStreamer);
  const [searchQuery, setSearchQuery] = useState(initialSearchQuery);
  const [dateRange, setDateRange] = useState<DateRange | undefined>(getInitialDateRange);
  const [orderBy, setOrderBy] = useState(initialOrderBy);

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

        url.searchParams.set('limit', '300');

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
  }, [selectedServer]);

  // Get unique streamers from loaded clips
  const streamers = useMemo(() => {
    const uniqueStreamers = new Set(clips.map((c) => c.streamer_username));
    return Array.from(uniqueStreamers).sort();
  }, [clips]);

  // Helper to format date for URL
  const formatDateForUrl = (date: Date | undefined): string => {
    if (!date) return '';
    return date.toISOString().split('T')[0];
  };

  // URL filter update
  const updateUrlFilters = useCallback(
    (server: string, streamer: string, search: string, range: DateRange | undefined, order: string) => {
      const params = new URLSearchParams();
      if (server !== 'all') params.set('server', server);
      if (streamer !== 'all') params.set('streamer', streamer);
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
      setSelectedServer(value);
      setSelectedStreamer('all'); // Reset streamer when server changes
      updateUrlFilters(value, 'all', searchQuery, dateRange, orderBy);
    },
    [updateUrlFilters, searchQuery, dateRange, orderBy]
  );

  const handleStreamerChange = useCallback(
    (value: string) => {
      setSelectedStreamer(value);
      updateUrlFilters(selectedServer, value, searchQuery, dateRange, orderBy);
    },
    [updateUrlFilters, selectedServer, searchQuery, dateRange, orderBy]
  );

  const handleSearchChange = useCallback(
    (query: string) => {
      setSearchQuery(query);
      updateUrlFilters(selectedServer, selectedStreamer, query, dateRange, orderBy);
    },
    [updateUrlFilters, selectedServer, selectedStreamer, dateRange, orderBy]
  );

  const handleOrderChange = useCallback(
    (value: string) => {
      setOrderBy(value);
      updateUrlFilters(selectedServer, selectedStreamer, searchQuery, dateRange, value);
    },
    [updateUrlFilters, selectedServer, selectedStreamer, searchQuery, dateRange]
  );

  const handleDateRangeChange = useCallback(
    (range: DateRange | undefined) => {
      setDateRange(range);
      updateUrlFilters(selectedServer, selectedStreamer, searchQuery, range, orderBy);
    },
    [updateUrlFilters, selectedServer, selectedStreamer, searchQuery, orderBy]
  );

  const handleClearFilters = useCallback(() => {
    setSelectedServer('all');
    setSelectedStreamer('all');
    setSearchQuery('');
    setDateRange(undefined);
    setOrderBy('views-desc');
    router.push('/clips', { scroll: false });
  }, [router]);

  const handleSelectClip = useCallback((clip: ClipData) => {
    setSelectedClip(clip);
    setIsModalOpen(true);
  }, []);

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
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (c) =>
          c.title.toLowerCase().includes(query) ||
          c.streamer_username.toLowerCase().includes(query) ||
          (c.server_name?.toLowerCase().includes(query))
      );
    }

    // Helper: Get UTC day start timestamp for proper timezone-agnostic date comparison
    const getUTCDayTime = (date: Date | string): number => {
      const d = typeof date === 'string' ? new Date(date) : date;
      const utcYear = d.getUTCFullYear();
      const utcMonth = d.getUTCMonth();
      const utcDate = d.getUTCDate();
      return new Date(Date.UTC(utcYear, utcMonth, utcDate)).getTime();
    };

    // Filter by date
    if (dateRange?.from || dateRange?.to) {
      filtered = filtered.filter((c) => {
        const clipDayTime = getUTCDayTime(c.created_at);
        
        if (dateRange.from) {
          const startDayTime = getUTCDayTime(dateRange.from);
          if (clipDayTime < startDayTime) return false;
        }
        
        if (dateRange.to) {
          const endDayTime = getUTCDayTime(dateRange.to);
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
  }, [clips, selectedStreamer, searchQuery, dateRange, orderBy]);

  const hasActiveFilters = selectedServer !== 'all' || selectedStreamer !== 'all' || searchQuery || dateRange?.from || dateRange?.to;

  if (loading) {
    return <ClipsLoadingSkeleton />;
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
          
          <CardContent className={`relative z-10 space-y-4 ${!showFilters && 'hidden sm:block'}`}>
            {/* Search Bar */}
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
              {searchQuery && (
                <button
                  onClick={() => handleSearchChange('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-300 transition-colors"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>

            {/* Filter Row */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
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

            {/* Active filters indicator */}
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
