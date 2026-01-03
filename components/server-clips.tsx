'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
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
import { AlertCircle, Play } from 'lucide-react';

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
    <div className="space-y-2">
      <Skeleton className="w-full aspect-video rounded-lg" />
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-3 w-2/3" />
      <div className="flex gap-2">
        <Skeleton className="h-3 w-1/3" />
        <Skeleton className="h-3 w-1/3" />
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
  return (
    <Card
      className="overflow-hidden cursor-pointer hover:shadow-lg transition-shadow duration-200"
      onClick={() => onSelect(clip)}
    >
      <CardContent className="p-0">
        <div className="relative aspect-video overflow-hidden bg-gray-900">
          <img
            src={clip.thumbnail_url}
            alt={clip.title}
            className="w-full h-full object-cover hover:scale-105 transition-transform duration-300"
            onError={(e) => {
              e.currentTarget.src = '/placeholder-clip.png';
            }}
          />
          <div className="absolute inset-0 bg-black/40 opacity-0 hover:opacity-100 transition-opacity duration-300 flex items-center justify-center">
            <Play className="h-12 w-12 text-white fill-white" />
          </div>
        </div>
        <div className="p-3 space-y-2">
          <h3 className="font-semibold text-sm line-clamp-2 hover:text-cyan-400 transition-colors">
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
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle className="line-clamp-2">{clip.title}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="w-full">
            <iframe
              src={`https://clips.twitch.tv/embed?clip=${clip.clip_id}&parent=${hostname}`}
              height="360"
              width="100%"
              allowFullScreen
              className="rounded-lg"
            />
          </div>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-gray-400">Streamer</p>
              <p className="font-semibold">{clip.streamer_username}</p>
            </div>
            <div>
              <p className="text-gray-400">Views</p>
              <p className="font-semibold">{clip.view_count.toLocaleString()}</p>
            </div>
            <div>
              <p className="text-gray-400">Duration</p>
              <p className="font-semibold">{clip.duration}s</p>
            </div>
            <div>
              <p className="text-gray-400">Created</p>
              <p className="font-semibold text-xs">
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

  // Get initial streamer filter from URL query param
  const initialStreamer = searchParams.get('streamer') || 'all';
  const [selectedStreamer, setSelectedStreamer] = useState(initialStreamer);

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

  // Handle streamer selection and update URL
  const handleStreamerChange = useCallback(
    (value: string) => {
      setSelectedStreamer(value);
      const params = new URLSearchParams();
      if (value !== 'all') {
        params.set('streamer', value);
      }
      router.push(`?${params.toString()}`);
    },
    [router]
  );

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

  // Filter clips based on selected streamer
  const filteredClips = useMemo(() => {
    if (selectedStreamer === 'all' || !selectedStreamer) {
      return clips;
    }
    return clips.filter(
      (c) => c.streamer_username.toLowerCase() === selectedStreamer.toLowerCase()
    );
  }, [clips, selectedStreamer]);

  return (
    <div className="space-y-6">
      {/* Controls */}
      <div className="flex items-center gap-4">
        <div className="flex-1">
          <label htmlFor="streamer-select" className="text-sm text-gray-400 block mb-2">
            Filter by Streamer
          </label>
          <Select value={selectedStreamer} onValueChange={handleStreamerChange}>
            <SelectTrigger id="streamer-select" className="w-full max-w-xs">
              <SelectValue placeholder="All Streamers" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">
                All Streamers {streamers.length > 0 && `(${streamers.length})`}
              </SelectItem>
              {streamers.map((streamer) => (
                <SelectItem key={streamer} value={streamer}>
                  {streamer}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {clips.length > 0 && (
          <div className="text-right">
            <p className="text-sm text-gray-400">Total Clips</p>
            <p className="text-2xl font-bold">{filteredClips.length}</p>
          </div>
        )}
      </div>

      {/* Content */}
      {error ? (
        // Error state
        <div className="flex items-center gap-3 p-4 rounded-lg bg-red-500/10 border border-red-500/20">
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
        <div className="text-center py-12">
          <div className="space-y-2">
            <h3 className="text-lg font-semibold">No clips found</h3>
            <p className="text-gray-400">
              No clips have been collected yet for {serverName}. Check back later!
            </p>
          </div>
        </div>
      ) : filteredClips.length === 0 ? (
        // Empty filtered state
        <div className="text-center py-12">
          <div className="space-y-2">
            <h3 className="text-lg font-semibold">No clips from this streamer</h3>
            <p className="text-gray-400">
              Select a different streamer to view their clips.
            </p>
            <Button
              variant="outline"
              onClick={() => handleStreamerChange('all')}
              className="mt-4"
            >
              View All Clips
            </Button>
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
