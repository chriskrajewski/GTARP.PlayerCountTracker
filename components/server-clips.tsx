'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Card, CardContent } from '@/components/ui/card';
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
import { Skeleton } from '@/components/ui/skeleton';
import { AlertCircle, Play, X } from 'lucide-react';

/**
 * Clip response interface
 */
interface ClipData {
  clip_id: string;
  streamer_username: string;
  title: string;
  thumbnail_url: string;
  embed_url: string;
  view_count: number;
  duration: number;
  created_at: string;
}

/**
 * API response interface
 */
interface ClipsApiResponse {
  success: boolean;
  data: ClipData[];
  error?: string;
}

interface ServerClipsProps {
  serverId: string;
  serverName: string;
}

/**
 * Skeleton loader for clip cards
 */
function ClipCardSkeleton() {
  return (
    <div className="space-y-2 rounded-sm overflow-hidden" style={{ backgroundColor: '#0e0e10', border: '1px solid #26262c', borderRadius: '4px' }}>
      <Skeleton className="w-full aspect-video rounded-none" />
      <div className="p-3 space-y-2">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-3 w-2/3" />
        <div className="flex gap-2">
          <Skeleton className="h-3 w-1/3" />
          <Skeleton className="h-3 w-1/3" />
        </div>
      </div>
    </div>
  );
}

/**
 * Individual clip card component
 */
function ClipCard({
  clip,
  onSelect,
}: {
  clip: ClipData;
  onSelect: (clip: ClipData) => void;
}) {
  const [imageError, setImageError] = useState(false);

  return (
    <Card
      className="overflow-hidden cursor-pointer group relative transition-all duration-200 hover:-translate-y-1"
      style={{
        backgroundColor: '#0e0e10',
        borderColor: '#26262c',
        borderWidth: '1px',
        borderStyle: 'solid',
        borderRadius: '4px',
      }}
      onClick={() => onSelect(clip)}
    >
      <CardContent className="p-0">
        <div className="relative aspect-video overflow-hidden bg-gray-900">
          <div className="absolute inset-0 bg-gradient-to-t from-gray-900 via-gray-900/40 to-transparent opacity-60 group-hover:opacity-30 transition-opacity z-10" />
          {imageError ? (
            <div className="w-full h-full bg-gray-800 flex items-center justify-center">
              <div className="text-center text-gray-500">
                <div className="text-2xl mb-2">🎬</div>
                <div className="text-xs">{clip.streamer_username}</div>
              </div>
            </div>
          ) : (
            <img
              src={clip.thumbnail_url}
              alt={clip.title}
              className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
              onError={() => setImageError(true)}
              loading="lazy"
              decoding="async"
            />
          )}
          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center z-20">
            <Play className="h-12 w-12 text-white fill-white" />
          </div>
        </div>
        <div className="p-3 space-y-2">
          <h3 className="font-semibold text-sm line-clamp-2 text-white hover:text-purple-400 transition-colors">
            {clip.title}
          </h3>
          <p className="text-xs text-gray-400">{clip.streamer_username}</p>
          <div className="flex justify-between text-xs text-gray-500">
            <span>{clip.view_count.toLocaleString()} views</span>
            <span>{clip.duration}s</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * Clip modal viewer with Twitch embed
 */
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

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl border border-gray-700" style={{ backgroundColor: '#0f0f12' }}>
        <DialogHeader>
          <DialogTitle className="line-clamp-2 text-white">{clip.title}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="w-full">
            <iframe
              src={`https://clips.twitch.tv/embed?clip=${clip.clip_id}&parent=${hostname}`}
              height="360"
              width="100%"
              allowFullScreen
              className="rounded-sm"
            />
          </div>
          <div className="grid grid-cols-2 gap-4 text-sm p-4 rounded-sm" style={{ backgroundColor: '#18181b' }}>
            <div>
              <p className="text-gray-400 text-xs">Streamer</p>
              <p className="font-semibold text-white">{clip.streamer_username}</p>
            </div>
            <div>
              <p className="text-gray-400 text-xs">Views</p>
              <p className="font-semibold text-white">{clip.view_count.toLocaleString()}</p>
            </div>
            <div>
              <p className="text-gray-400 text-xs">Duration</p>
              <p className="font-semibold text-white">{clip.duration}s</p>
            </div>
            <div>
              <p className="text-gray-400 text-xs">Created</p>
              <p className="font-semibold text-white text-xs">
                {new Date(clip.created_at).toLocaleDateString()}
              </p>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Main ServerClips component
 */
export function ServerClips({
  serverId,
  serverName,
}: ServerClipsProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [clips, setClips] = useState<ClipData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedClip, setSelectedClip] = useState<ClipData | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Get initial filters from URL query params
  const initialStreamer = searchParams.get('streamer') || 'all';
  const initialSearchQuery = searchParams.get('search') || '';
  const initialStartDate = searchParams.get('startDate') || '';
  const initialEndDate = searchParams.get('endDate') || '';
  const initialOrderBy1 = searchParams.get('orderBy1') || 'views-desc';
  const initialOrderBy2 = searchParams.get('orderBy2') || '';
  const initialOrderBy3 = searchParams.get('orderBy3') || '';

  const [selectedStreamer, setSelectedStreamer] = useState(initialStreamer);
  const [searchQuery, setSearchQuery] = useState(initialSearchQuery);
  const [startDate, setStartDate] = useState(initialStartDate);
  const [endDate, setEndDate] = useState(initialEndDate);
  const [orderBy1, setOrderBy1] = useState(initialOrderBy1);
  const [orderBy2, setOrderBy2] = useState(initialOrderBy2);
  const [orderBy3, setOrderBy3] = useState(initialOrderBy3);

  // Fetch clips on mount or when serverId changes
  useEffect(() => {
    const fetchClips = async () => {
      try {
        setLoading(true);
        setError(null);

        const url = new URL(
          `/api/clips/${serverId}`,
          typeof window !== 'undefined' ? window.location.origin : ''
        );

        // Include streamer filter if selected
        if (selectedStreamer && selectedStreamer !== 'all') {
          url.searchParams.set('streamer', selectedStreamer);
        }

        const response = await fetch(url.toString());

        if (!response.ok) {
          throw new Error('Failed to fetch clips');
        }

        const data: ClipsApiResponse = await response.json();

        if (!data.success) {
          throw new Error(data.error || 'Failed to fetch clips');
        }

        setClips(data.data || []);
      } catch (err) {
        console.error('[Clips] Error fetching clips:', err);
        setError(
          err instanceof Error ? err.message : 'Failed to fetch clips'
        );
        setClips([]);
      } finally {
        setLoading(false);
      }
    };

    fetchClips();
  }, [serverId, selectedStreamer]);

  // Get unique streamers from clips
  const streamers = useMemo(() => {
    const uniqueStreamers = new Set(clips.map((c) => c.streamer_username));
    return Array.from(uniqueStreamers).sort();
  }, [clips]);

  // Update URL with current filters
  const updateUrlFilters = useCallback(
    (streamer: string, search: string, sDate: string, eDate: string, order1: string, order2: string, order3: string) => {
      const params = new URLSearchParams();
      if (streamer !== 'all') {
        params.set('streamer', streamer);
      }
      if (search) {
        params.set('search', search);
      }
      if (sDate) {
        params.set('startDate', sDate);
      }
      if (eDate) {
        params.set('endDate', eDate);
      }
      if (order1 && order1 !== 'views-desc') {
        params.set('orderBy1', order1);
      }
      if (order2) {
        params.set('orderBy2', order2);
      }
      if (order3) {
        params.set('orderBy3', order3);
      }
      router.push(`?${params.toString()}`);
    },
    [router]
  );

  // Handle streamer selection
  const handleStreamerChange = useCallback(
    (value: string) => {
      setSelectedStreamer(value);
      updateUrlFilters(value, searchQuery, startDate, endDate, orderBy1, orderBy2, orderBy3);
    },
    [updateUrlFilters, searchQuery, startDate, endDate, orderBy1, orderBy2, orderBy3]
  );

  // Handle search input change
  const handleSearchChange = useCallback(
    (query: string) => {
      setSearchQuery(query);
      updateUrlFilters(selectedStreamer, query, startDate, endDate, orderBy1, orderBy2, orderBy3);
    },
    [updateUrlFilters, selectedStreamer, startDate, endDate, orderBy1, orderBy2, orderBy3]
  );

  // Handle start date change
  const handleStartDateChange = useCallback(
    (date: string) => {
      setStartDate(date);
      updateUrlFilters(selectedStreamer, searchQuery, date, endDate, orderBy1, orderBy2, orderBy3);
    },
    [updateUrlFilters, selectedStreamer, searchQuery, endDate, orderBy1, orderBy2, orderBy3]
  );

  // Handle end date change
  const handleEndDateChange = useCallback(
    (date: string) => {
      setEndDate(date);
      updateUrlFilters(selectedStreamer, searchQuery, startDate, date, orderBy1, orderBy2, orderBy3);
    },
    [updateUrlFilters, selectedStreamer, searchQuery, startDate, orderBy1, orderBy2, orderBy3]
  );

  // Handle order by changes
  const handleOrderBy1Change = useCallback(
    (value: string) => {
      setOrderBy1(value);
      updateUrlFilters(selectedStreamer, searchQuery, startDate, endDate, value, orderBy2, orderBy3);
    },
    [updateUrlFilters, selectedStreamer, searchQuery, startDate, endDate, orderBy2, orderBy3]
  );

  const handleOrderBy2Change = useCallback(
    (value: string) => {
      setOrderBy2(value);
      updateUrlFilters(selectedStreamer, searchQuery, startDate, endDate, orderBy1, value, orderBy3);
    },
    [updateUrlFilters, selectedStreamer, searchQuery, startDate, endDate, orderBy1, orderBy3]
  );

  const handleOrderBy3Change = useCallback(
    (value: string) => {
      setOrderBy3(value);
      updateUrlFilters(selectedStreamer, searchQuery, startDate, endDate, orderBy1, orderBy2, value);
    },
    [updateUrlFilters, selectedStreamer, searchQuery, startDate, endDate, orderBy1, orderBy2]
  );

  // Clear all filters
  const handleClearFilters = useCallback(() => {
    setSelectedStreamer('all');
    setSearchQuery('');
    setStartDate('');
    setEndDate('');
    setOrderBy1('views-desc');
    setOrderBy2('');
    setOrderBy3('');
    router.push('?');
  }, [router]);

  // Handle clip selection
  const handleSelectClip = useCallback((clip: ClipData) => {
    setSelectedClip(clip);
    setIsModalOpen(true);
  }, []);

  // Handle modal close
  const handleCloseModal = useCallback(() => {
    setIsModalOpen(false);
    setTimeout(() => setSelectedClip(null), 300); // Wait for animation
  }, []);

  // Filter clips based on all criteria
  const filteredClips = useMemo(() => {
    let filtered = clips;

    // Filter by streamer
    if (selectedStreamer !== 'all' && selectedStreamer) {
      filtered = filtered.filter(
        (c) => c.streamer_username.toLowerCase() === selectedStreamer.toLowerCase()
      );
    }

    // Filter by search query (title and streamer username)
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (c) =>
          c.title.toLowerCase().includes(query) ||
          c.streamer_username.toLowerCase().includes(query)
      );
    }

    // Filter by date range
    if (startDate || endDate) {
      filtered = filtered.filter((c) => {
        const clipDate = new Date(c.created_at);
        
        // Check start date
        if (startDate) {
          const start = new Date(startDate);
          start.setHours(0, 0, 0, 0);
          if (clipDate < start) {
            return false;
          }
        }

        // Check end date
        if (endDate) {
          const end = new Date(endDate);
          end.setHours(23, 59, 59, 999);
          if (clipDate > end) {
            return false;
          }
        }

        return true;
      });
    }

    // Helper function to apply sort
    const applySortCriteria = (a: ClipData, b: ClipData, sortBy: string): number => {
      switch (sortBy) {
        case 'views-asc':
          return a.view_count - b.view_count;
        case 'views-desc':
          return b.view_count - a.view_count;
        case 'date-newest':
          // Compare only by day, not exact timestamp
          const dayA = new Date(a.created_at);
          const dayB = new Date(b.created_at);
          dayA.setHours(0, 0, 0, 0);
          dayB.setHours(0, 0, 0, 0);
          return dayB.getTime() - dayA.getTime();
        case 'date-oldest':
          // Compare only by day, not exact timestamp
          const dayA2 = new Date(a.created_at);
          const dayB2 = new Date(b.created_at);
          dayA2.setHours(0, 0, 0, 0);
          dayB2.setHours(0, 0, 0, 0);
          return dayA2.getTime() - dayB2.getTime();
        case 'duration-shortest':
          return a.duration - b.duration;
        case 'duration-longest':
          return b.duration - a.duration;
        case 'title-asc':
          return a.title.localeCompare(b.title);
        case 'title-desc':
          return b.title.localeCompare(a.title);
        default:
          return 0;
      }
    };

    // Apply multi-level sorting
    const sorted = [...filtered].sort((a, b) => {
      // Apply primary sort
      let result = applySortCriteria(a, b, orderBy1);
      if (result !== 0) return result;

      // Apply secondary sort if primary sort resulted in a tie and secondary sort is not 'none'
      if (orderBy2 && orderBy2 !== 'none') {
        result = applySortCriteria(a, b, orderBy2);
        if (result !== 0) return result;
      }

      // Apply tertiary sort if primary and secondary sorts resulted in a tie and tertiary sort is not 'none'
      if (orderBy3 && orderBy3 !== 'none') {
        result = applySortCriteria(a, b, orderBy3);
        if (result !== 0) return result;
      }

      return 0;
    });

    return sorted;
  }, [clips, selectedStreamer, searchQuery, startDate, endDate, orderBy1, orderBy2, orderBy3]);

  return (
    <div className="space-y-6">
      {/* Controls */}
      <div className="space-y-4">
        {/* Search and Date Filters */}
        <div className="flex flex-col gap-4">
          {/* Search Bar */}
          <div className="flex-1">
            <label htmlFor="search-input" className="text-sm text-gray-400 block mb-2">
              Search Clips
            </label>
            <div className="relative">
              <input
                id="search-input"
                type="text"
                placeholder="Search by title or streamer name..."
                value={searchQuery}
                onChange={(e) => handleSearchChange(e.target.value)}
                className="w-full px-4 py-2 rounded-sm bg-gray-800 border border-gray-700 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all"
              />
              {searchQuery && (
                <button
                  onClick={() => handleSearchChange('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-300 transition-colors"
                  aria-label="Clear search"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>

          {/* Streamer Filter and Date Range */}
          <div className="flex flex-col lg:flex-row gap-4">
            {/* Streamer Dropdown */}
            <div className="flex-1 min-w-xs">
              <label htmlFor="streamer-select" className="text-sm text-gray-400 block mb-2">
                Filter by Streamer
              </label>
              <Select value={selectedStreamer} onValueChange={handleStreamerChange}>
                <SelectTrigger id="streamer-select" className="w-full bg-gray-800 border-gray-700 text-white">
                  <SelectValue placeholder="All Streamers" />
                </SelectTrigger>
                <SelectContent className="bg-gray-800 border-gray-700">
                  <SelectItem value="all" className="text-white">
                    All Streamers {streamers.length > 0 && `(${streamers.length})`}
                  </SelectItem>
                  {streamers.map((streamer) => (
                    <SelectItem key={streamer} value={streamer} className="text-white">
                      {streamer}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Start Date Filter */}
            <div className="flex-1 min-w-xs">
              <label htmlFor="start-date" className="text-sm text-gray-400 block mb-2">
                From Date
              </label>
              <input
                id="start-date"
                type="date"
                value={startDate}
                onChange={(e) => handleStartDateChange(e.target.value)}
                className="w-full px-4 py-2 rounded-sm bg-gray-800 border border-gray-700 text-white focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all"
              />
            </div>

            {/* End Date Filter */}
            <div className="flex-1 min-w-xs">
              <label htmlFor="end-date" className="text-sm text-gray-400 block mb-2">
                To Date
              </label>
              <input
                id="end-date"
                type="date"
                value={endDate}
                onChange={(e) => handleEndDateChange(e.target.value)}
                className="w-full px-4 py-2 rounded-sm bg-gray-800 border border-gray-700 text-white focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all"
              />
            </div>

            {/* Order By Dropdown */}
            <div className="flex-1 min-w-xs">
              <label htmlFor="order-by-select-1" className="text-sm text-gray-400 block mb-2">
                Sort By (Primary)
              </label>
              <Select value={orderBy1} onValueChange={handleOrderBy1Change}>
                <SelectTrigger id="order-by-select-1" className="w-full bg-gray-800 border-gray-700 text-white">
                  <SelectValue placeholder="Sort clips" />
                </SelectTrigger>
                <SelectContent className="bg-gray-800 border-gray-700">
                  <SelectItem value="views-desc" className="text-white">
                    Views (High to Low)
                  </SelectItem>
                  <SelectItem value="views-asc" className="text-white">
                    Views (Low to High)
                  </SelectItem>
                  <SelectItem value="date-newest" className="text-white">
                    Date (Newest First)
                  </SelectItem>
                  <SelectItem value="date-oldest" className="text-white">
                    Date (Oldest First)
                  </SelectItem>
                  <SelectItem value="duration-longest" className="text-white">
                    Duration (Longest First)
                  </SelectItem>
                  <SelectItem value="duration-shortest" className="text-white">
                    Duration (Shortest First)
                  </SelectItem>
                  <SelectItem value="title-asc" className="text-white">
                    Title (A-Z)
                  </SelectItem>
                  <SelectItem value="title-desc" className="text-white">
                    Title (Z-A)
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Secondary and Tertiary Sort Options */}
          <div className="flex flex-col lg:flex-row gap-4">
            {/* Order By Dropdown 2 */}
            <div className="flex-1 min-w-xs">
              <label htmlFor="order-by-select-2" className="text-sm text-gray-400 block mb-2">
                Sort By (Secondary) - Optional
              </label>
              <Select value={orderBy2} onValueChange={handleOrderBy2Change}>
                <SelectTrigger id="order-by-select-2" className="w-full bg-gray-800 border-gray-700 text-white">
                  <SelectValue placeholder="None" />
                </SelectTrigger>
                <SelectContent className="bg-gray-800 border-gray-700">
                  <SelectItem value="none" className="text-white">
                    None
                  </SelectItem>
                  <SelectItem value="views-desc" className="text-white">
                    Views (High to Low)
                  </SelectItem>
                  <SelectItem value="views-asc" className="text-white">
                    Views (Low to High)
                  </SelectItem>
                  <SelectItem value="date-newest" className="text-white">
                    Date (Newest First)
                  </SelectItem>
                  <SelectItem value="date-oldest" className="text-white">
                    Date (Oldest First)
                  </SelectItem>
                  <SelectItem value="duration-longest" className="text-white">
                    Duration (Longest First)
                  </SelectItem>
                  <SelectItem value="duration-shortest" className="text-white">
                    Duration (Shortest First)
                  </SelectItem>
                  <SelectItem value="title-asc" className="text-white">
                    Title (A-Z)
                  </SelectItem>
                  <SelectItem value="title-desc" className="text-white">
                    Title (Z-A)
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Order By Dropdown 3 */}
            <div className="flex-1 min-w-xs">
              <label htmlFor="order-by-select-3" className="text-sm text-gray-400 block mb-2">
                Sort By (Tertiary) - Optional
              </label>
              <Select value={orderBy3} onValueChange={handleOrderBy3Change}>
                <SelectTrigger id="order-by-select-3" className="w-full bg-gray-800 border-gray-700 text-white">
                  <SelectValue placeholder="None" />
                </SelectTrigger>
                <SelectContent className="bg-gray-800 border-gray-700">
                  <SelectItem value="none" className="text-white">
                    None
                  </SelectItem>
                  <SelectItem value="views-desc" className="text-white">
                    Views (High to Low)
                  </SelectItem>
                  <SelectItem value="views-asc" className="text-white">
                    Views (Low to High)
                  </SelectItem>
                  <SelectItem value="date-newest" className="text-white">
                    Date (Newest First)
                  </SelectItem>
                  <SelectItem value="date-oldest" className="text-white">
                    Date (Oldest First)
                  </SelectItem>
                  <SelectItem value="duration-longest" className="text-white">
                    Duration (Longest First)
                  </SelectItem>
                  <SelectItem value="duration-shortest" className="text-white">
                    Duration (Shortest First)
                  </SelectItem>
                  <SelectItem value="title-asc" className="text-white">
                    Title (A-Z)
                  </SelectItem>
                  <SelectItem value="title-desc" className="text-white">
                    Title (Z-A)
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Filter Status and Clear Button */}
          {(selectedStreamer !== 'all' || searchQuery || startDate || endDate) && (
            <div className="flex items-center justify-between p-3 rounded-sm" style={{ backgroundColor: '#18181b', border: '1px solid #26262c' }}>
              <p className="text-sm text-gray-400">
                {filteredClips.length > 0
                  ? `Showing ${filteredClips.length} of ${clips.length} clip${clips.length !== 1 ? 's' : ''}`
                  : 'No clips match your filters'}
              </p>
              <button
                onClick={handleClearFilters}
                className="px-3 py-1 text-xs rounded-sm transition-colors"
                style={{
                  backgroundColor: '#26262c',
                  color: '#FFFFFF',
                  border: '1px solid #404043',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#3a3a41')}
                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#26262c')}
              >
                Clear Filters
              </button>
            </div>
          )}
        </div>

        {/* Clips Count */}
        {clips.length > 0 && !searchQuery && selectedStreamer === 'all' && !startDate && !endDate && (
          <div className="text-right">
            <p className="text-sm text-gray-400">Total Clips</p>
            <p className="text-2xl font-bold text-white">{clips.length}</p>
          </div>
        )}
      </div>

      {/* Content */}
      {error ? (
        // Error state
        <div className="flex items-center gap-3 p-4 rounded-sm border border-red-500/30" style={{ backgroundColor: 'rgba(185, 28, 28, 0.1)' }}>
          <AlertCircle className="h-5 w-5 text-red-400 flex-shrink-0" />
          <div>
            <p className="font-semibold text-red-400">Unable to load clips</p>
            <p className="text-sm text-red-300">{error}</p>
          </div>
        </div>
      ) : loading ? (
        // Loading state
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <ClipCardSkeleton key={i} />
          ))}
        </div>
      ) : clips.length === 0 ? (
        // Empty state
        <div className="text-center py-12 rounded-sm border border-gray-700 p-6" style={{ backgroundColor: '#18181b' }}>
          <div className="space-y-2">
            <h3 className="text-lg font-semibold text-white">No clips found</h3>
            <p className="text-gray-400">
              No clips have been collected yet for {serverName}. Check back later!
            </p>
          </div>
        </div>
      ) : filteredClips.length === 0 ? (
        // Empty filtered state
        <div className="text-center py-12 rounded-sm border border-gray-700 p-6" style={{ backgroundColor: '#18181b' }}>
          <div className="space-y-2">
            <h3 className="text-lg font-semibold text-white">No clips from this streamer</h3>
            <p className="text-gray-400">
              Select a different streamer to view their clips.
            </p>
            <button
              onClick={() => handleStreamerChange('all')}
              className="mt-4 px-4 py-2 rounded-sm text-sm font-medium transition-colors"
              style={{
                backgroundColor: '#26262c',
                color: '#FFFFFF',
                border: '1px solid #404043',
                cursor: 'pointer',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#3a3a41')}
              onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#26262c')}
            >
              View All Clips
            </button>
          </div>
        </div>
      ) : (
        // Clips grid
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredClips.map((clip) => (
            <ClipCard
              key={clip.clip_id}
              clip={clip}
              onSelect={handleSelectClip}
            />
          ))}
        </div>
      )}

      {/* Modal */}
      <ClipModal
        clip={selectedClip}
        isOpen={isModalOpen}
        onClose={handleCloseModal}
      />
    </div>
  );
}
